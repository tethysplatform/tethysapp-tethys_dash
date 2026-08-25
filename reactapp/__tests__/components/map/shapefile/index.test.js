import fs from "fs";
import path from "path";
import { bytes } from "../../../utilities/bytes";
import { interpretShapefile } from "components/map/shapefile/index";

// Read from disk rather than imported: the asset transform turns a non-JS import
// into its filename string, so a binary fixture cannot be `import`ed.
const FIXTURES = path.join(__dirname, "../../../utilities/fixtures/shapefile");

function load(name) {
  const components = {};
  ["shp", "dbf", "prj", "shx"].forEach((extension) => {
    const file = path.join(FIXTURES, `${name}.${extension}`);
    if (fs.existsSync(file)) {
      components[extension] = new Uint8Array(fs.readFileSync(file));
    }
  });
  return components;
}

describe("interpretShapefile — geometry fidelity", () => {
  // These expectations come from pyshp reading the same files back through its
  // own ring-nesting implementation, which makes this a cross-implementation
  // check. Shapefile encodes interior rings by winding direction with no parent
  // pointer, so a parser that re-derives containment wrongly draws a basin's
  // holes as filled polygons on top of it -- and the better-known JS parser has
  // a filed bug for exactly that. This is the gate on the parser choice.
  it("reads a polygon with an interior ring as one polygon with a hole", async () => {
    const result = await interpretShapefile(load("holes"));

    expect(result.error).toBeUndefined();
    const [feature] = result.featureCollection.features;
    expect(feature.geometry.type).toBe("Polygon");
    // Two rings on one polygon -- not two separate polygons, and not a
    // MultiPolygon.
    expect(feature.geometry.coordinates).toHaveLength(2);
    const [exterior, interior] = feature.geometry.coordinates;
    expect(exterior).toHaveLength(5);
    expect(interior).toHaveLength(5);
    // The interior ring is the inner square, whatever winding it ended up with.
    const interiorXs = interior.map(([x]) => x).sort((a, b) => a - b);
    expect(interiorXs[0]).toBe(3);
    expect(interiorXs[interiorXs.length - 1]).toBe(7);
  });

  it("reads a multi-part record as one multi-geometry feature", async () => {
    const result = await interpretShapefile(load("multipart"));

    expect(result.error).toBeUndefined();
    // One record in, one feature out -- not two features.
    expect(result.featureCollection.features).toHaveLength(1);
    const [feature] = result.featureCollection.features;
    expect(feature.geometry.type).toBe("MultiPolygon");
    expect(feature.geometry.coordinates).toHaveLength(2);
    expect(feature.properties.NAME).toBe("Two islands, one record");
  });

  it("normalizes ring winding to the GeoJSON spec", async () => {
    // Shapefile writes exterior rings clockwise; the GeoJSON spec wants them
    // counter-clockwise. Signed area is positive for a counter-clockwise ring.
    const result = await interpretShapefile(load("holes"));
    const [exterior] =
      result.featureCollection.features[0].geometry.coordinates;
    const area = exterior.reduce((sum, [x1, y1], index) => {
      const [x2, y2] = exterior[(index + 1) % exterior.length];
      return sum + (x1 * y2 - x2 * y1);
    }, 0);
    expect(area).toBeGreaterThan(0);
  });

  it("reads points with their attributes", async () => {
    const result = await interpretShapefile(load("points"));

    expect(result.featureCollection.features).toHaveLength(2);
    expect(result.featureCollection.features[0].geometry.type).toBe("Point");
    expect(result.featureCollection.features[0].properties).toEqual({
      GAGE_ID: "06730200",
      STAGE_FT: 4.25,
    });
  });
});

describe("interpretShapefile — payload contract", () => {
  it("names the resolved projection on the collection's crs", async () => {
    const result = await interpretShapefile(load("holes"));
    // The existing vector-swap path reads dataProjection from exactly here, so
    // both vector paths produce interchangeable payloads.
    expect(result.featureCollection.crs.properties.name).toBe(
      result.projectionCode,
    );
    expect(result.projectionCode).toMatch(/^WKT:/);
  });

  it("returns plain GeoJSON with no OpenLayers objects", async () => {
    const result = await interpretShapefile(load("holes"));
    expect(result.featureCollection.type).toBe("FeatureCollection");
    // Round-trips through JSON, which an OpenLayers feature would not.
    expect(() => JSON.stringify(result.featureCollection)).not.toThrow();
  });
});

describe("interpretShapefile — attributes", () => {
  it("reads geometry with no attributes when the .dbf is absent", async () => {
    const components = load("holes");
    delete components.dbf;

    const result = await interpretShapefile(components);

    expect(result.error).toBeUndefined();
    expect(result.featureCollection.features[0].geometry.type).toBe("Polygon");
    expect(result.featureCollection.features[0].properties).toEqual({});
  });
});

describe("interpretShapefile — projection resolution", () => {
  it("registers the .prj and uses it", async () => {
    const result = await interpretShapefile(load("holes"));
    expect(result.error).toBeUndefined();
    expect(result.projectionCode).toBeTruthy();
  });

  it("falls back to the supplied projection when there is no .prj", async () => {
    const components = load("holes");
    delete components.prj;

    const result = await interpretShapefile(components, {
      fallbackProjection: "EPSG:5070",
    });

    expect(result.error).toBeUndefined();
    expect(result.projectionCode).toBe("EPSG:5070");
    expect(result.featureCollection.crs.properties.name).toBe("EPSG:5070");
  });

  it("reports a missing projection with no fallback rather than guessing", async () => {
    const components = load("holes");
    delete components.prj;

    const result = await interpretShapefile(components);

    expect(result.featureCollection).toBeUndefined();
    expect(result.error.reason).toBe("missing_projection");
    expect(result.error.stage).toBe("parse");
  });

  it("reports an unresolvable fallback projection by name", async () => {
    const components = load("holes");
    delete components.prj;

    const result = await interpretShapefile(components, {
      fallbackProjection: "EPSG:99999",
    });

    expect(result.error.reason).toBe("unresolvable_projection");
    expect(result.error.detail).toContain("EPSG:99999");
  });

  it("reports an unresolvable .prj naming the projection method", async () => {
    const components = load("holes");
    components.prj = bytes(
      'PROJCS["x",GEOGCS["g",DATUM["d",SPHEROID["s",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["Degree",0.0174532925199433]],PROJECTION["Totally_Not_A_Real_Projection"],UNIT["Meter",1.0]]',
    );

    const result = await interpretShapefile(components);

    expect(result.error.reason).toBe("unresolvable_projection");
    expect(result.error.detail).toContain("Totally_Not_A_Real_Projection");
  });

  it("does not fall back when a .prj is present but unresolvable", async () => {
    // A present-but-broken .prj must not quietly become the fallback's problem:
    // the file said what it was and the answer is to report it, not to draw the
    // features using a projection the author guessed.
    const components = load("holes");
    components.prj = bytes("not wkt at all");

    const result = await interpretShapefile(components, {
      fallbackProjection: "EPSG:5070",
    });

    expect(result.featureCollection).toBeUndefined();
    expect(result.error.reason).toBe("unresolvable_projection");
  });
});

describe("interpretShapefile — failure paths", () => {
  it("reports missing geometry", async () => {
    const result = await interpretShapefile({ prj: bytes('PROJCS["x"]') });
    expect(result.error.reason).toBe("no_geometry");
  });

  it("reports unreadable geometry rather than throwing", async () => {
    const components = load("holes");
    components.shp = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

    const result = await interpretShapefile(components);

    expect(result.featureCollection).toBeUndefined();
    expect(result.error.reason).toBe("unreadable_geometry");
    expect(result.error.stage).toBe("parse");
  });

  it("reports an empty components object", async () => {
    expect((await interpretShapefile({})).error.reason).toBe("no_geometry");
    expect((await interpretShapefile(undefined)).error.reason).toBe(
      "no_geometry",
    );
  });
});

describe("interpretShapefile — projection field accepts a definition", () => {
  const ESRI_ALBERS = `PROJCS["NAD_1983_Albers",GEOGCS["GCS_North_American_1983",DATUM["D_North_American_1983",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Albers"],PARAMETER["False_Easting",0.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",-96.0],PARAMETER["Standard_Parallel_1",29.5],PARAMETER["Standard_Parallel_2",45.5],PARAMETER["Latitude_Of_Origin",23.0],UNIT["Meter",1.0]]`;

  it("accepts WKT as the fallback when there is no .prj", async () => {
    // Without this, a .prj-less shapefile in a CRS the table does not cover has
    // no authorable path at all -- there is no code to type that resolves.
    const components = load("holes");
    delete components.prj;

    const result = await interpretShapefile(components, {
      fallbackProjection: ESRI_ALBERS,
    });

    expect(result.error).toBeUndefined();
    expect(result.projectionCode).toMatch(/^WKT:/);
  });

  it("accepts a proj4 definition as the fallback", async () => {
    const components = load("holes");
    delete components.prj;

    const result = await interpretShapefile(components, {
      fallbackProjection:
        "+proj=aea +lat_0=23 +lon_0=-96 +lat_1=29.5 +lat_2=45.5 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs",
    });

    expect(result.error).toBeUndefined();
    expect(result.projectionCode).toBeTruthy();
  });

  it("reports a malformed definition as unparsable rather than as an unknown code", async () => {
    const components = load("holes");
    delete components.prj;

    const result = await interpretShapefile(components, {
      fallbackProjection: 'PROJCS["broken",GARBAGE[',
    });

    expect(result.error.reason).toBe("unresolvable_projection");
    expect(result.error.detail).toMatch(/could not be parsed/);
  });

  it("still treats a short token as a code", async () => {
    const components = load("holes");
    delete components.prj;

    const result = await interpretShapefile(components, {
      fallbackProjection: "EPSG:5070",
    });

    expect(result.projectionCode).toBe("EPSG:5070");
  });
});
