import proj4 from "proj4";
import { get as getProjection } from "ol/proj.js";
import {
  PROJECTION_TABLE,
  INITIAL_CODES,
  ensureProjection,
  registerProjectionDefinition,
} from "components/map/projections";

// A projected CRS with no AUTHORITY node, which is how ESRI writes .prj files.
const ESRI_ALBERS_NO_AUTHORITY = `PROJCS["NAD_1983_Albers",GEOGCS["GCS_North_American_1983",DATUM["D_North_American_1983",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Albers"],PARAMETER["False_Easting",0.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",-96.0],PARAMETER["Standard_Parallel_1",29.5],PARAMETER["Standard_Parallel_2",45.5],PARAMETER["Latitude_Of_Origin",23.0],UNIT["Meter",1.0]]`;

// Append an AUTHORITY node to the outermost PROJCS. It has to go before the
// final bracket: a string replace on "]]" lands inside GEOGCS instead, which
// wkt-parser then reports as a nested authority and the module correctly ignores
// -- making any test built that way pass without testing anything.
function withAuthority(wkt, code) {
  const [name, id] = code.split(":");
  return `${wkt.slice(0, -1)},AUTHORITY["${name}","${id}"]]`;
}

// The same body, claiming EPSG:5070 -- which the table already covers -- and
// with a deliberately wrong standard parallel, to prove the seeded definition is
// not replaced by a layer's copy.
const ALBERS_5070_WRONG_PARAMS = withAuthority(
  ESRI_ALBERS_NO_AUTHORITY.replace(
    '"Standard_Parallel_1",29.5',
    '"Standard_Parallel_1",20',
  ),
  "EPSG:5070",
);

// The OGC spelling of the same projection. proj4 does not implement this
// variant: it yields non-finite coordinates even at the projection's own centre,
// so registration reports it rather than rendering features nowhere.
const OGC_ALBERS = `PROJCS["NAD83 / Conus Albers",GEOGCS["NAD83",DATUM["North_American_Datum_1983",SPHEROID["GRS 1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Albers_Conic_Equal_Area"],PARAMETER["latitude_of_center",23],PARAMETER["longitude_of_center",-96],PARAMETER["standard_parallel_1",29.5],PARAMETER["standard_parallel_2",45.5],UNIT["metre",1]]`;

const UNSUPPORTED_METHOD = `PROJCS["nonsense",GEOGCS["g",DATUM["d",SPHEROID["s",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["Degree",0.0174532925199433]],PROJECTION["Totally_Not_A_Real_Projection"],UNIT["Meter",1.0]]`;

describe("projection table", () => {
  it("resolves every code registered at init and gives it an extent", () => {
    INITIAL_CODES.forEach((code) => {
      const projection = getProjection(code);
      expect(projection).toBeTruthy();
      // register() cannot supply an extent, so a null here means the
      // post-registration extent application did not run.
      expect(projection.getExtent()).toEqual(PROJECTION_TABLE[code].extent);
    });
  });

  // Cross-implementation check: the expected values come from PROJ's EPSG
  // database, and the control points sit away from each projection's origin so a
  // wrong standard parallel, scale factor or linear unit moves the result. A
  // point at the origin would return the false easting regardless.
  it.each(INITIAL_CODES)(
    "%s transforms its control point to the coordinate PROJ gives",
    (code) => {
      const { lonLat, projected } = PROJECTION_TABLE[code].controlPoint;
      const [x, y] = proj4("EPSG:4326", code, lonLat);
      expect(x).toBeCloseTo(projected[0], 2);
      expect(y).toBeCloseTo(projected[1], 2);
    },
  );

  it("registers a bounded number of codes at init rather than the whole table", () => {
    // register() is quadratic in registered-definition count, and this module is
    // a static import, so an unbounded init set is a first-render regression on
    // every dashboard.
    expect(INITIAL_CODES.length).toBeLessThanOrEqual(4);
  });

  it("leaves the native projections untouched", () => {
    expect(getProjection("EPSG:4326").getUnits()).toBe("degrees");
    expect(getProjection("EPSG:3857").getUnits()).toBe("m");
    expect(getProjection("EPSG:3857").getExtent()).toBeTruthy();
    // OpenLayers' own UTM factory still answers for zone codes.
    expect(getProjection("EPSG:32615")).toBeTruthy();
  });
});

describe("ensureProjection", () => {
  it("returns null for a code that is neither native nor in the table", () => {
    expect(ensureProjection("EPSG:99999")).toBeNull();
  });

  it("returns null for an empty code without throwing", () => {
    expect(ensureProjection(undefined)).toBeNull();
    expect(ensureProjection("")).toBeNull();
  });

  it("resolves a native code without needing a table entry", () => {
    expect(ensureProjection("EPSG:4326")).toBeTruthy();
  });

  it("registers a table entry on demand and applies its extent", () => {
    const projection = ensureProjection("EPSG:5070");
    expect(projection).toBeTruthy();
    expect(projection.getExtent()).toEqual(
      PROJECTION_TABLE["EPSG:5070"].extent,
    );
  });
});

describe("registerProjectionDefinition", () => {
  it("registers WKT with no authority node and transforms with it", () => {
    const result = registerProjectionDefinition(ESRI_ALBERS_NO_AUTHORITY);
    expect(result.error).toBeUndefined();
    expect(result.code).toMatch(/^WKT:/);
    expect(getProjection(result.code)).toBeTruthy();

    // Assert the resolved parameters, not merely that nothing threw: proj4 has a
    // history of parsing ESRI WKT variants and silently producing wrong ones.
    const [x, y] = proj4("EPSG:4326", result.code, [-105, 40]);
    expect(x).toBeCloseTo(-760465.745, 2);
    expect(y).toBeCloseTo(1923013.98, 2);
  });

  it("reuses an already-resolvable code instead of registering the layer's copy", () => {
    const before = proj4("EPSG:4326", "EPSG:5070", [-105, 40]);

    const result = registerProjectionDefinition(ALBERS_5070_WRONG_PARAMS);
    expect(result.code).toBe("EPSG:5070");

    // The seeded definition survives and the layer's differing parameters are
    // discarded. Without this, one shapefile changes how every other layer on
    // every dashboard in this session transforms.
    const after = proj4("EPSG:4326", "EPSG:5070", [-105, 40]);
    expect(after[0]).toBeCloseTo(before[0], 6);
    expect(after[1]).toBeCloseTo(before[1], 6);
  });

  it("never registers under a claimed authority code", () => {
    const claimed = "EPSG:26985";
    expect(getProjection(claimed)).toBeFalsy();
    const wkt = withAuthority(ESRI_ALBERS_NO_AUTHORITY, claimed);

    const result = registerProjectionDefinition(wkt);

    // Guard against this passing vacuously: the fixture must actually carry a
    // top-level authority, or the module would fall through to a synthetic code
    // for the wrong reason and the assertions below would prove nothing.
    expect(wkt).toContain('AUTHORITY["EPSG","26985"]]');
    expect(result.code).toMatch(/^WKT:/);
    expect(result.code).not.toBe(claimed);
    // The claimed code stays unresolvable, so a later layer naming it by code
    // does not silently inherit this layer's parameters.
    expect(getProjection(claimed)).toBeFalsy();
  });

  it("returns the same code for the same WKT without re-registering", () => {
    const first = registerProjectionDefinition(ESRI_ALBERS_NO_AUTHORITY);
    const second = registerProjectionDefinition(ESRI_ALBERS_NO_AUTHORITY);
    expect(second.code).toBe(first.code);
  });

  it("reports an unparsable definition and names what failed", () => {
    const result = registerProjectionDefinition('PROJCS["broken",GARBAGE[');
    expect(result.code).toBeUndefined();
    expect(result.error.reason).toBe("unparsable");
    expect(result.error.detail).toMatch(/could not be parsed/);
  });

  it("reports an unsupported projection method by name", () => {
    // This one parses cleanly and only fails at transform time, so the message
    // has to come from validating the transform rather than from the parser.
    const result = registerProjectionDefinition(UNSUPPORTED_METHOD);
    expect(result.code).toBeUndefined();
    expect(result.error.reason).toBe("unsupported");
    expect(result.error.detail).toContain("Totally_Not_A_Real_Projection");
  });

  it("reports the OGC Albers variant as unsupported rather than rendering nowhere", () => {
    // proj4 implements the ESRI spelling of Albers but not this one, and the
    // failure is silent: non-finite coordinates, not an exception. Caught by
    // probing the definition at its own centre before registering it.
    const result = registerProjectionDefinition(OGC_ALBERS);
    expect(result.code).toBeUndefined();
    expect(result.error.reason).toBe("unsupported");
    expect(result.error.detail).toContain("Albers_Conic_Equal_Area");
  });

  it("leaves the registry usable after rejecting a definition", () => {
    // A rejected definition must not stay in proj4's registry: register()
    // constructs a transform for every pair of registered codes, so one unusable
    // definition would make it throw and take working projections down with it.
    registerProjectionDefinition(UNSUPPORTED_METHOD);
    const after = registerProjectionDefinition(ESRI_ALBERS_NO_AUTHORITY);
    expect(after.error).toBeUndefined();
    expect(getProjection("EPSG:5070")).toBeTruthy();
  });

  it("reports an empty definition rather than throwing", () => {
    expect(registerProjectionDefinition("").error.reason).toBe("empty");
    expect(registerProjectionDefinition(undefined).error.reason).toBe("empty");
  });
});
