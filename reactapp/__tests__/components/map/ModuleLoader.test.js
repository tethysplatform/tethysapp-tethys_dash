import moduleLoader, {
  createJsonStyleFunction,
  matchesCondition,
  ruleMatches,
  resolveAllStyleValues,
  resolveSize,
  buildPointStyle,
  createTrapezoidIconStyle,
  createDiamondIconStyle,
  getGeometryBucket,
  loadESRIJSON,
  buildPolygonFill,
  withAntimeridianFix,
  withIsolatedCanvas,
  withAutoCrossOrigin,
  applyAutoRamp,
  loadGeoPackage,
  s3UrlToHttps,
  registerGeoPackageProjections,
  GeoPackageError,
  loadZarr,
  loadGeoParquet,
  geoParquetCRSToProjection,
  readGeoParquetGeoMetadata,
  GeoParquetError,
  ZarrError,
  coerceParquetValue,
  clearClientSourceCaches,
  readCoveringBBoxPaths,
  parseBBox,
  bboxIntersectsFilter,
  resolveReadColumns,
  geometryIntersectsBBox,
} from "components/map/ModuleLoader";
import { fromUrl } from "geotiff";
import DataTile from "ol/source/DataTile.js";
import { readSlice } from "components/map/zarrReader";
import WebGLTile from "ol/layer/WebGLTile.js";
import ImageLayer from "ol/layer/Image.js";
import VectorTileLayer from "ol/layer/VectorTile.js";
import VectorLayer from "ol/layer/Vector.js";
import KML from "ol/format/KML.js";
import GeoTIFF from "ol/source/GeoTIFF.js";
import { Vector as VectorSource } from "ol/source.js";
import {
  layerConfigGeoJSON,
  layerConfigWebGLTile,
  layerConfigImageWMS,
  layerConfigVectorTile,
  layerConfigArcGISFeatureService,
  layerConfigPMTilesVector,
  layerConfigPMTilesRaster,
  layerConfigKML,
  layerConfigStaticImage,
} from "__tests__/utilities/constants";
import {
  Style,
  Circle as CircleStyle,
  RegularShape,
  Icon,
  Fill,
  Stroke,
} from "ol/style";
import {
  defaultFill,
  defaultSize,
  defaultHatchSpacing,
  defaultDotSpacing,
  defaultDotRadius,
  defaultStroke,
  defaultStrokeWidth,
} from "components/inputs/RuleEditor.js";
import { get as getProjection } from "ol/proj";
import proj4 from "proj4";
import { loadGpkg } from "ol-load-geopackage";
import {
  asyncBufferFromUrl,
  parquetMetadataAsync,
  parquetReadObjects,
} from "hyparquet";

jest.mock("geotiff", () => ({ fromUrl: jest.fn() }));

jest.mock("ol-load-geopackage", () => ({
  __esModule: true,
  initSqlJsWasm: jest.fn(),
  loadGpkg: jest.fn(),
}));

// zarrReader is mocked so the Zarr DataTile path can be driven with canned slices
// (the real reader pulls in zarrita, which jest resolves only via the stub).
jest.mock("components/map/zarrReader", () => ({
  __esModule: true,
  readSlice: jest.fn(),
  readMetadata: jest.fn(),
}));

jest.mock(
  "hyparquet",
  () => ({
    __esModule: true,
    asyncBufferFromUrl: jest.fn(),
    parquetMetadataAsync: jest.fn(),
    parquetReadObjects: jest.fn(),
  }),
  { virtual: true },
);
jest.mock("hyparquet-compressors", () => ({ compressors: { __mock: true } }), {
  virtual: true,
});

jest.mock("ol/source/GeoTIFF.js", () => {
  const ActualSource = jest.requireActual("ol/source/Source.js").default;
  const spy = jest.fn();
  class MockGeoTIFFSource extends ActualSource {
    constructor(options) {
      super({ projection: null });
      this.options = options;
      spy(options);
    }
  }

  MockGeoTIFFSource.constructorSpy = spy;
  return {
    __esModule: true,
    default: MockGeoTIFFSource,
  };
});

function mockFeature(props, geometryType = "Point") {
  return {
    getProperties: () => props,
    get: (key) => props[key],
    getGeometry: () => ({ getType: () => geometryType }),
  };
}

test("WebGLTile Instance", async () => {
  const layerInstance = await moduleLoader(layerConfigWebGLTile.configuration);
  expect(layerInstance instanceof WebGLTile).toBe(true);

  const cachedLayerInstance = await moduleLoader(
    layerConfigWebGLTile.configuration,
  );
  expect(cachedLayerInstance instanceof WebGLTile).toBe(true);
});

test("VectorTileLayer Instance", async () => {
  const layerInstance = await moduleLoader(layerConfigVectorTile.configuration);
  expect(layerInstance instanceof VectorTileLayer).toBe(true);

  const cachedLayerInstance = await moduleLoader(
    layerConfigVectorTile.configuration,
  );
  expect(cachedLayerInstance instanceof VectorTileLayer).toBe(true);
});

test("GeoJSON Instance", async () => {
  const layerInstance = await moduleLoader(layerConfigGeoJSON.configuration);
  expect(layerInstance instanceof VectorLayer).toBe(true);
  expect(layerInstance.getOpacity()).toBe(0.5);

  const cachedLayerInstance = await moduleLoader(
    layerConfigGeoJSON.configuration,
  );
  expect(cachedLayerInstance instanceof VectorLayer).toBe(true);
});

test("GeoJSON URL string source (URL-based VectorSource path)", async () => {
  // When `source.geojson` is a string, loadGeoJSON returns a VectorSource
  // with `url` + a GeoJSON format pre-configured to reproject into the
  // map projection — covers the URL-based branch.
  const config = {
    type: "VectorLayer",
    props: {
      name: "Remote GeoJSON Layer",
      source: {
        type: "GeoJSON",
        props: {},
        geojson: "https://example.com/data.geojson",
      },
      zIndex: 1,
    },
  };

  const layerInstance = await moduleLoader(config, "EPSG:3857");
  expect(layerInstance instanceof VectorLayer).toBe(true);
  const source = layerInstance.getSource();
  expect(source instanceof VectorSource).toBe(true);
  expect(source.getUrl()).toBe("https://example.com/data.geojson");
});

test("ArcGIS Feature Service Instance", async () => {
  const copiedConfig = {
    ...layerConfigArcGISFeatureService.configuration,
  };
  copiedConfig.props.source.props.params = {
    TIME: "2020-01-01T00:00:00.000Z,2020-12-31T23:59:59.000Z",
  };
  let layerInstance = await moduleLoader(copiedConfig);
  expect(layerInstance instanceof VectorLayer).toBe(true);

  let cachedLayerInstance = await moduleLoader(copiedConfig);
  expect(cachedLayerInstance instanceof VectorLayer).toBe(true);

  copiedConfig.props.source.props = {};
  layerInstance = await moduleLoader(copiedConfig);
  expect(layerInstance instanceof VectorLayer).toBe(true);

  cachedLayerInstance = await moduleLoader(copiedConfig);
  expect(cachedLayerInstance instanceof VectorLayer).toBe(true);
});

test("PMTiles Vector Layer Instance", async () => {
  const layerInstance = await moduleLoader(
    layerConfigPMTilesVector.configuration,
  );
  expect(layerInstance instanceof VectorTileLayer).toBe(true);
  const cachedLayerInstance = await moduleLoader(
    layerConfigVectorTile.configuration,
  );
  expect(cachedLayerInstance instanceof VectorTileLayer).toBe(true);
});

test("PMTiles Raster Layer Instance", async () => {
  const layerInstance = await moduleLoader(
    layerConfigPMTilesRaster.configuration,
  );
  expect(layerInstance instanceof WebGLTile).toBe(true);
  const cachedLayerInstance = await moduleLoader(
    layerConfigPMTilesRaster.configuration,
  );
  expect(cachedLayerInstance instanceof WebGLTile).toBe(true);
});

test("Static Image Layer Instance", async () => {
  const layerInstance = await moduleLoader(
    layerConfigStaticImage.configuration,
  );
  expect(layerInstance instanceof ImageLayer).toBe(true);
  const cachedLayerInstance = await moduleLoader(
    layerConfigStaticImage.configuration,
  );
  expect(cachedLayerInstance instanceof ImageLayer).toBe(true);
});

test("Static Image imageExtent string is parsed to numeric array", async () => {
  const config = JSON.parse(
    JSON.stringify(layerConfigStaticImage.configuration),
  );
  config.props.source.props.imageExtent = "-100.5, 30.2, -90.1, 40.8";
  const layerInstance = await moduleLoader(config);
  const source = layerInstance.getSource();
  const extent = source.getImageExtent();
  expect(extent).toEqual([-100.5, 30.2, -90.1, 40.8]);
});

test("KML Layer Instance", async () => {
  const layerInstance = await moduleLoader(layerConfigKML.configuration);
  expect(layerInstance instanceof VectorLayer).toBe(true);
  expect(layerInstance.getSource().format_ instanceof KML).toBe(true);
  const cachedLayerInstance = await moduleLoader(layerConfigKML.configuration);
  expect(cachedLayerInstance instanceof VectorLayer).toBe(true);
});

describe("GeoTIFF source", () => {
  const geoTIFFLayerConfig = (props = {}) => ({
    type: "WebGLTile",
    props: {
      name: "GeoTIFF Layer",
      source: {
        type: "GeoTIFF",
        props: { url: "https://example.com/cog.tif", ...props },
      },
      zIndex: 0,
    },
  });

  const lastCtorArgs = () => {
    const calls = GeoTIFF.constructorSpy.mock.calls;
    return calls[calls.length - 1][0];
  };

  test("GeoTIFF type resolves to the ol/source/GeoTIFF module", async () => {
    const layerInstance = await moduleLoader(geoTIFFLayerConfig());
    expect(layerInstance instanceof WebGLTile).toBe(true);
    expect(GeoTIFF.constructorSpy).toHaveBeenCalled();
  });

  test("a flat url becomes OpenLayers' single-entry sources array", async () => {
    await moduleLoader(geoTIFFLayerConfig());
    expect(lastCtorArgs().sources).toEqual([
      { url: "https://example.com/cog.tif" },
    ]);
  });

  test("nodata rides inside the source entry, cast to a number", async () => {
    // OL compares `sourceValue !== nodata` strictly, so a string would never
    // match and the mask would silently do nothing.
    await moduleLoader(geoTIFFLayerConfig({ nodata: "-9999" }));
    expect(lastCtorArgs().sources[0].nodata).toBe(-9999);
  });

  test("a nodata of 0 is kept, not treated as unset", async () => {
    await moduleLoader(geoTIFFLayerConfig({ nodata: "0" }));
    expect(lastCtorArgs().sources[0].nodata).toBe(0);
  });

  test("projection sits at the source options level, not in the entry", async () => {
    await moduleLoader(geoTIFFLayerConfig({ projection: "EPSG:32615" }));
    const args = lastCtorArgs();
    expect(args.projection).toBe("EPSG:32615");
    expect(args.sources[0]).not.toHaveProperty("projection");
  });

  test("an empty projection is dropped", async () => {
    await moduleLoader(geoTIFFLayerConfig({ projection: "" }));
    expect(lastCtorArgs()).not.toHaveProperty("projection");
  });

  test("nodata is omitted when applyAutoRamp has not resolved one", async () => {
    // A layer with no ramp never reaches applyAutoRamp, so nothing sets nodata
    // and OL falls back to the file's own tag — which is the right default.
    await moduleLoader(geoTIFFLayerConfig());
    expect(lastCtorArgs().sources[0]).not.toHaveProperty("nodata");
  });

  test("normalize passes through to the constructor", async () => {
    await moduleLoader(geoTIFFLayerConfig({ normalize: false }));
    expect(lastCtorArgs().normalize).toBe(false);
  });

  test("a missing url throws GeoTIFFEmptySources", async () => {
    const config = geoTIFFLayerConfig();
    delete config.props.source.props.url;
    const before = GeoTIFF.constructorSpy.mock.calls.length;
    await expect(moduleLoader(config)).rejects.toThrow("GeoTIFFEmptySources");
    expect(GeoTIFF.constructorSpy.mock.calls.length).toBe(before);
  });
});

test("Non Constructor Error", async () => {
  const badConfig = JSON.parse(
    JSON.stringify(layerConfigImageWMS.configuration),
  );
  badConfig.type = "bad-module";
  await expect(moduleLoader(badConfig)).rejects.toThrow(
    "Module 'bad-module' does not export a constructor.",
  );
});

test("Non Existing OL Import", async () => {
  const layerConfig = {
    type: "BadLayer",
    props: {
      name: "ImageWMS Layer",
      source: {
        type: "WMS",
        props: {
          url: "https://ahocevar.com/geoserver/wms",
          params: { LAYERS: "topp:states" },
        },
      },
      zIndex: 1,
    },
  };
  await expect(moduleLoader(layerConfig)).rejects.toThrow(
    "No module path found for type 'BadLayer'.",
  );
});

test("Missing Import in Mapper", async () => {
  const layerConfig = {
    type: "InvalidForTesting",
    props: {
      name: "ImageWMS Layer",
      source: {
        type: "WMS",
        props: {
          url: "https://ahocevar.com/geoserver/wms",
          params: { LAYERS: "topp:states" },
        },
      },
      zIndex: 1,
    },
  };
  await expect(moduleLoader(layerConfig)).rejects.toThrow(
    "No importer found for module path 'DontUseThis'.",
  );
});

test("Null Props", async () => {
  const layerConfig = {
    type: "WebGLTile",
    props: {
      source: {
        type: "Image Tile",
        props: null,
      },
      name: "World Light Gray Base",
      zIndex: 0,
    },
  };
  const layerInstance = await moduleLoader(layerConfig);
  expect(layerInstance instanceof WebGLTile).toBe(true);

  const cachedLayerInstance = await moduleLoader(layerConfig);
  expect(cachedLayerInstance instanceof WebGLTile).toBe(true);
});

describe("createJsonStyleFunction", () => {
  it("returns a Style for a point with default", () => {
    const styleJson = {
      default: { point: { fill: "#ff0000", size: 10 } },
    };
    const styleFn = createJsonStyleFunction(styleJson);
    const feature = mockFeature({});
    const style = styleFn(feature);
    expect(style).toBeInstanceOf(Style);
    const fillColor = style.getImage().getFill().getColor();
    expect(fillColor).toBe("#ff0000");
    const size = style.getImage().getRadius();
    expect(size).toBe(10);
  });

  it("applies rule based on condition", () => {
    const styleJson = {
      default: { point: { fill: "#ff0000", size: 10 } },
      rules: [
        {
          geometryType: "point",
          conditionField: "type",
          conditionType: "=",
          conditionValue: "special",
          fill: "#00ff00",
          size: 15,
        },
        {
          geometryType: "point",
          conditionField: "type",
          conditionType: "=",
          conditionValue: "not special",
          fill: "#be1879",
          size: 30,
        },
      ],
    };
    const styleFn = createJsonStyleFunction(styleJson);
    const feature = mockFeature({ type: "special" });
    const style = styleFn(feature);
    expect(style).toBeInstanceOf(Style);
    const fillColor = style.getImage().getFill().getColor();
    expect(fillColor).toBe("#00ff00");
    const size = style.getImage().getRadius();
    expect(size).toBe(15);
  });

  it("returns a Style for a line", () => {
    const styleJson = {
      default: { linestring: { stroke: "#0000ff", strokeWidth: 2 } },
      rules: [{ geometryType: "point" }],
    };
    const styleFn = createJsonStyleFunction(styleJson);
    const feature = mockFeature({}, "LineString");
    const style = styleFn(feature);
    expect(style).toBeInstanceOf(Style);
    const strokeColor = style.getStroke().getColor();
    expect(strokeColor).toBe("#0000ff");
    const strokeWidth = style.getStroke().getWidth();
    expect(strokeWidth).toBe(2);
  });

  it("returns a Style for a with strokeDash", () => {
    const styleJson = {
      default: {
        linestring: { stroke: "#0000ff", strokeWidth: 2, strokeDash: [4, 8] },
      },
    };
    const styleFn = createJsonStyleFunction(styleJson);
    const feature = mockFeature({}, "LineString");
    const style = styleFn(feature);
    expect(style).toBeInstanceOf(Style);
    const strokeColor = style.getStroke().getColor();
    expect(strokeColor).toBe("#0000ff");
    const strokeWidth = style.getStroke().getWidth();
    expect(strokeWidth).toBe(2);
    const strokeDash = style.getStroke().getLineDash();
    expect(strokeDash).toEqual([4, 8]);
  });

  it("returns a Style for default stroke", () => {
    const styleJson = {
      default: {
        linestring: { strokeDash: [4, 8] },
      },
    };
    const styleFn = createJsonStyleFunction(styleJson);
    const feature = mockFeature({}, "LineString");
    const style = styleFn(feature);
    expect(style).toBeInstanceOf(Style);
    const strokeColor = style.getStroke().getColor();
    expect(strokeColor).toBe(defaultStroke);
    const strokeWidth = style.getStroke().getWidth();
    expect(strokeWidth).toBe(defaultStrokeWidth);
    const strokeDash = style.getStroke().getLineDash();
    expect(strokeDash).toEqual([4, 8]);
  });

  it("returns a Style for default stroke with lineDash", () => {
    const styleJson = {
      default: {
        linestring: {},
      },
    };
    const styleFn = createJsonStyleFunction(styleJson);
    const feature = mockFeature({}, "LineString");
    const style = styleFn(feature);
    expect(style).toBeInstanceOf(Style);
    const strokeColor = style.getStroke().getColor();
    expect(strokeColor).toBe(defaultStroke);
    const strokeWidth = style.getStroke().getWidth();
    expect(strokeWidth).toBe(defaultStrokeWidth);
    const strokeDash = style.getStroke().getLineDash();
    expect(strokeDash).toEqual(null);
  });

  it("returns a Style for a with empty strokeDash", () => {
    const styleJson = {
      default: {
        linestring: { stroke: "#0000ff", strokeWidth: 2, strokeDash: [] },
      },
    };
    const styleFn = createJsonStyleFunction(styleJson);
    const feature = mockFeature({}, "LineString");
    const style = styleFn(feature);
    expect(style).toBeInstanceOf(Style);
    const strokeColor = style.getStroke().getColor();
    expect(strokeColor).toBe("#0000ff");
    const strokeWidth = style.getStroke().getWidth();
    expect(strokeWidth).toBe(2);
    const strokeDash = style.getStroke().getLineDash();
    expect(strokeDash).toEqual(null);
  });

  it("returns a Style for a with string strokeDash", () => {
    const styleJson = {
      default: {
        linestring: { stroke: "#0000ff", strokeWidth: 2, strokeDash: "4,8" },
      },
    };
    const styleFn = createJsonStyleFunction(styleJson);
    const feature = mockFeature({}, "LineString");
    const style = styleFn(feature);
    expect(style).toBeInstanceOf(Style);
    const strokeColor = style.getStroke().getColor();
    expect(strokeColor).toBe("#0000ff");
    const strokeWidth = style.getStroke().getWidth();
    expect(strokeWidth).toBe(2);
    const strokeDash = style.getStroke().getLineDash();
    expect(strokeDash).toEqual([4, 8]);
  });

  it("returns a Style for a with string strokeDash bad values", () => {
    const styleJson = {
      default: {
        linestring: { stroke: "#0000ff", strokeWidth: 2, strokeDash: "bad,r" },
      },
    };
    const styleFn = createJsonStyleFunction(styleJson);
    const feature = mockFeature({}, "LineString");
    const style = styleFn(feature);
    expect(style).toBeInstanceOf(Style);
    const strokeColor = style.getStroke().getColor();
    expect(strokeColor).toBe("#0000ff");
    const strokeWidth = style.getStroke().getWidth();
    expect(strokeWidth).toBe(2);
    const strokeDash = style.getStroke().getLineDash();
    expect(strokeDash).toEqual(null);
  });

  it("returns a Style for a with empty string strokeDash", () => {
    const styleJson = {
      default: {
        linestring: { stroke: "#0000ff", strokeWidth: 2, strokeDash: " " },
      },
    };
    const styleFn = createJsonStyleFunction(styleJson);
    const feature = mockFeature({}, "LineString");
    const style = styleFn(feature);
    expect(style).toBeInstanceOf(Style);
    const strokeColor = style.getStroke().getColor();
    expect(strokeColor).toBe("#0000ff");
    const strokeWidth = style.getStroke().getWidth();
    expect(strokeWidth).toBe(2);
    const strokeDash = style.getStroke().getLineDash();
    expect(strokeDash).toEqual(null);
  });

  it("returns a Style for a polygon", () => {
    const styleJson = {
      default: { polygon: { fill: "#cccccc", stroke: "#333333" } },
    };
    const styleFn = createJsonStyleFunction(styleJson);
    const feature = mockFeature({}, "Polygon");
    const style = styleFn(feature);
    expect(style).toBeInstanceOf(Style);
    const fillColor = style.getFill().getColor();
    expect(fillColor).toBe("#cccccc");
    const strokeColor = style.getStroke().getColor();
    expect(strokeColor).toBe("#333333");
  });

  it("caches styles for same config", () => {
    const styleJson = {
      default: { point: { fill: "#ff0000", size: 10 } },
    };
    const styleFn = createJsonStyleFunction(styleJson);
    const feature = mockFeature({});
    const style1 = styleFn(feature);
    const style2 = styleFn(feature);
    expect(style1).toBe(style2);
    const fillColor1 = style1.getImage().getFill().getColor();
    const fillColor2 = style2.getImage().getFill().getColor();
    expect(fillColor1).toBe(fillColor2);
  });

  it("fixes strings to number for rule if needed", () => {
    const styleJson = {
      default: { point: { fill: "#ff0000", size: "10" } },
      rules: [
        {
          conditionField: "value",
          conditionType: ">",
          conditionValue: "5",
          size: "20",
        },
      ],
    };
    const styleFn = createJsonStyleFunction(styleJson);
    const feature = mockFeature({ value: 10 });
    const style = styleFn(feature);
    expect(style.getImage().getRadius()).toBe(20);
  });

  it("returns point with default style when no geometry type match", () => {
    const styleJson = {
      default: { polygon: { fill: "#ff0000", size: 10 } },
    };

    const styleFn = createJsonStyleFunction(styleJson);
    const feature = mockFeature({}, "UnknownGeometry");
    const style = styleFn(feature);
    expect(style).toBeInstanceOf(Style);
    const fillColor = style.getImage().getFill().getColor();
    expect(fillColor).toBe(defaultFill);
    const size = style.getImage().getRadius();
    expect(size).toBe(defaultSize);
  });

  it("resolves rotation from a feature property via propertyRefs", () => {
    const styleJson = {
      rules: [
        {
          conditionField: "type",
          conditionType: "=",
          conditionValue: "gage",
          geometryType: "point",
          shape: "rectangle",
          rotation: 0,
          propertyRefs: { rotation: "bearing" },
        },
      ],
    };
    const styleFn = createJsonStyleFunction(styleJson);
    const feature = mockFeature({ type: "gage", bearing: 90 }, "Point");
    expect(styleFn(feature).getImage().getRotation()).toBeCloseTo(Math.PI / 2);
  });

  it("falls back to the rule literal when the referenced field is missing", () => {
    const styleJson = {
      rules: [
        {
          conditionField: "type",
          conditionType: "=",
          conditionValue: "gage",
          geometryType: "point",
          shape: "rectangle",
          rotation: 45,
          propertyRefs: { rotation: "bearing" },
        },
      ],
    };
    const styleFn = createJsonStyleFunction(styleJson);
    const feature = mockFeature({ type: "gage" }, "Point");
    expect(styleFn(feature).getImage().getRotation()).toBeCloseTo(Math.PI / 4);
  });

  it("resolves fill, size, and shape from feature properties via propertyRefs", () => {
    const styleFn = createJsonStyleFunction({
      rules: [
        {
          conditionField: "type",
          conditionType: "=",
          conditionValue: "marker",
          geometryType: "point",
          fill: "#000000",
          size: 5,
          shape: "circle",
          propertyRefs: {
            fill: "color",
            size: "radius",
            shape: "kind",
          },
        },
      ],
    });
    const feature = mockFeature(
      { type: "marker", color: "#ff0000", radius: 12, kind: "square" },
      "Point",
    );
    const style = styleFn(feature);
    expect(style.getImage().getFill().getColor()).toBe("#ff0000");
    expect(style.getImage()).toBeInstanceOf(RegularShape);
  });

  it("resolves stroke and strokeWidth from feature properties for linestrings", () => {
    const styleFn = createJsonStyleFunction({
      rules: [
        {
          conditionField: "type",
          conditionType: "=",
          conditionValue: "road",
          geometryType: "linestring",
          stroke: "#000000",
          strokeWidth: 1,
          propertyRefs: { stroke: "color", strokeWidth: "width" },
        },
      ],
    });
    const feature = mockFeature(
      { type: "road", color: "#0000ff", width: 6 },
      "LineString",
    );
    const style = styleFn(feature);
    expect(style.getStroke().getColor()).toBe("#0000ff");
    expect(style.getStroke().getWidth()).toBe(6);
  });

  it("each feature gets its own resolved style values", () => {
    const styleFn = createJsonStyleFunction({
      rules: [
        {
          conditionField: "type",
          conditionType: "=",
          conditionValue: "p",
          geometryType: "point",
          fill: "#000",
          size: 5,
          propertyRefs: { fill: "color" },
        },
      ],
    });
    const featA = mockFeature({ type: "p", color: "#ff0000" }, "Point");
    const featB = mockFeature({ type: "p", color: "#00ff00" }, "Point");
    expect(styleFn(featA).getImage().getFill().getColor()).toBe("#ff0000");
    expect(styleFn(featB).getImage().getFill().getColor()).toBe("#00ff00");
  });
});

describe("resolveAllStyleValues", () => {
  it("returns merged unchanged when propertyRefs is absent", () => {
    const merged = { fill: "#abc", size: 5 };
    expect(resolveAllStyleValues(merged, {})).toBe(merged);
  });

  it("substitutes referenced keys from feature properties", () => {
    const merged = {
      fill: "#000",
      size: 5,
      propertyRefs: { fill: "color", size: "radius" },
    };
    const resolved = resolveAllStyleValues(merged, {
      color: "#ff0000",
      radius: 12,
    });
    expect(resolved.fill).toBe("#ff0000");
    expect(resolved.size).toBe(12);
  });

  it("falls back to the rule literal when the feature value is missing/empty", () => {
    const merged = { fill: "#000", propertyRefs: { fill: "color" } };
    expect(resolveAllStyleValues(merged, {}).fill).toBe("#000");
    expect(resolveAllStyleValues(merged, { color: "" }).fill).toBe("#000");
    expect(resolveAllStyleValues(merged, { color: null }).fill).toBe("#000");
  });

  it("skips propertyRefs entries where fieldName is empty or not a string (line 451)", () => {
    const merged = {
      fill: "#000",
      size: 5,
      propertyRefs: {
        fill: "color", // valid — resolved
        size: "", // empty string → continue (line 451)
        rotation: 42, // non-string → continue (line 451)
      },
    };
    const resolved = resolveAllStyleValues(merged, { color: "#ff0000" });
    expect(resolved.fill).toBe("#ff0000");
    expect(resolved.size).toBe(5); // unchanged; empty fieldName was skipped
  });
});

describe("matchesCondition", () => {
  it("matches '=' condition", () => {
    expect(matchesCondition("test", "=", "test")).toBe(true);
    expect(matchesCondition("test", "=", "other")).toBe(false);
    expect(matchesCondition(1, "=", "1")).toBe(true);
    expect(matchesCondition("1", "=", 1)).toBe(true);
  });

  it("matches '!=' condition", () => {
    expect(matchesCondition("test", "!=", "other")).toBe(true);
    expect(matchesCondition("test", "!=", "test")).toBe(false);
  });

  it("matches '>' condition", () => {
    expect(matchesCondition(5, ">", 3)).toBe(true);
    expect(matchesCondition(2, ">", 3)).toBe(false);
  });

  it("matches '<' condition", () => {
    expect(matchesCondition(2, "<", 3)).toBe(true);
    expect(matchesCondition(5, "<", 3)).toBe(false);
  });

  it("matches '>=' condition", () => {
    expect(matchesCondition(5, ">=", 3)).toBe(true);
    expect(matchesCondition(3, ">=", 3)).toBe(true);
    expect(matchesCondition(2, ">=", 3)).toBe(false);
  });

  it("matches '<=' condition", () => {
    expect(matchesCondition(2, "<=", 3)).toBe(true);
    expect(matchesCondition(3, "<=", 3)).toBe(true);
    expect(matchesCondition(5, "<=", 3)).toBe(false);
  });

  it("matches nonsense condition", () => {
    expect(matchesCondition(2, "adasd", 3)).toBe(false);
    expect(matchesCondition(3, "asdad", 3)).toBe(false);
    expect(matchesCondition(5, "asdasd", 3)).toBe(false);
  });

  it("matches 'isNull' condition", () => {
    expect(matchesCondition(null, "isNull")).toBe(true);
    expect(matchesCondition(undefined, "isNull")).toBe(true);
    expect(matchesCondition("", "isNull")).toBe(true);
    expect(matchesCondition(0, "isNull")).toBe(false);
    expect(matchesCondition("0", "isNull")).toBe(false);
    expect(matchesCondition("x", "isNull")).toBe(false);
  });

  it("matches 'isNotNull' condition", () => {
    expect(matchesCondition(null, "isNotNull")).toBe(false);
    expect(matchesCondition(undefined, "isNotNull")).toBe(false);
    expect(matchesCondition("", "isNotNull")).toBe(false);
    expect(matchesCondition(0, "isNotNull")).toBe(true);
    expect(matchesCondition(-1, "isNotNull")).toBe(true);
    expect(matchesCondition("x", "isNotNull")).toBe(true);
  });

  it("handles 'in' list membership (numeric coercion)", () => {
    expect(matchesCondition(36, "in", "0, 36, 42")).toBe(true);
    expect(matchesCondition("36", "in", "0, 36, 42")).toBe(true);
    expect(matchesCondition(5, "in", "0, 36, 42")).toBe(false);
  });

  it("handles 'in' list membership (string values)", () => {
    expect(matchesCondition("high", "in", "low, high")).toBe(true);
    expect(matchesCondition("medium", "in", "low, high")).toBe(false);
  });

  it("handles 'notIn' list membership", () => {
    expect(matchesCondition(5, "notIn", "0, 36, 42")).toBe(true);
    expect(matchesCondition(36, "notIn", "0, 36, 42")).toBe(false);
  });

  it("returns false for an empty or whitespace-only list", () => {
    expect(matchesCondition(1, "in", "")).toBe(false);
    expect(matchesCondition(1, "in", "  ,  ")).toBe(false);
    expect(matchesCondition(1, "notIn", "")).toBe(false);
  });

  it("returns false when the list value is not a string", () => {
    expect(matchesCondition(1, "in", 1)).toBe(false);
    expect(matchesCondition(1, "in", undefined)).toBe(false);
    expect(matchesCondition(1, "notIn", null)).toBe(false);
  });
});

describe("ruleMatches", () => {
  it("matches a legacy single-condition rule", () => {
    const rule = {
      conditionField: "type",
      conditionType: "=",
      conditionValue: "a",
    };
    expect(ruleMatches(rule, { type: "a" })).toBe(true);
    expect(ruleMatches(rule, { type: "b" })).toBe(false);
  });

  it("ANDs a legacy condition with conditions[] entries", () => {
    const rule = {
      conditionField: "type",
      conditionType: "=",
      conditionValue: "streamflow_gage",
      conditions: [{ field: "bankfull", type: "isNotNull" }],
    };
    expect(ruleMatches(rule, { type: "streamflow_gage", bankfull: 100 })).toBe(
      true,
    );
    expect(ruleMatches(rule, { type: "streamflow_gage", bankfull: null })).toBe(
      false,
    );
    expect(ruleMatches(rule, { type: "streamflow_gage", bankfull: "" })).toBe(
      false,
    );
    expect(ruleMatches(rule, { type: "reservoir", bankfull: 100 })).toBe(false);
  });

  it("ANDs multiple entries within conditions[]", () => {
    const rule = {
      conditions: [
        { field: "type", type: "=", value: "gage" },
        { field: "active", type: "=", value: "true" },
      ],
    };
    expect(ruleMatches(rule, { type: "gage", active: "true" })).toBe(true);
    expect(ruleMatches(rule, { type: "gage", active: "false" })).toBe(false);
    expect(ruleMatches(rule, { type: "other", active: "true" })).toBe(false);
  });

  it("does not match when no conditions are defined", () => {
    expect(ruleMatches({}, { type: "a" })).toBe(false);
    expect(ruleMatches({ conditions: [] }, { type: "a" })).toBe(false);
  });

  it("ORs conditions when conditionCombinator is OR", () => {
    const rule = {
      conditionCombinator: "OR",
      conditionField: "buildCat",
      conditionType: "=",
      conditionValue: "0",
      conditions: [{ field: "buildCat", type: "=", value: "36" }],
    };
    expect(ruleMatches(rule, { buildCat: 0 })).toBe(true);
    expect(ruleMatches(rule, { buildCat: 36 })).toBe(true);
    expect(ruleMatches(rule, { buildCat: 5 })).toBe(false);
  });

  it("ORs conditions across different fields", () => {
    const rule = {
      conditionCombinator: "OR",
      conditionField: "buildCat",
      conditionType: "=",
      conditionValue: "0",
      conditions: [{ field: "risk", type: "=", value: "high" }],
    };
    expect(ruleMatches(rule, { buildCat: 5, risk: "high" })).toBe(true);
    expect(ruleMatches(rule, { buildCat: 0, risk: "low" })).toBe(true);
    expect(ruleMatches(rule, { buildCat: 5, risk: "low" })).toBe(false);
  });

  it("defaults to AND when conditionCombinator is unset or invalid", () => {
    const rule = {
      conditionCombinator: "bogus",
      conditionField: "type",
      conditionType: "=",
      conditionValue: "a",
      conditions: [{ field: "active", type: "=", value: "true" }],
    };
    expect(ruleMatches(rule, { type: "a", active: "true" })).toBe(true);
    expect(ruleMatches(rule, { type: "a", active: "false" })).toBe(false);
  });

  it("matches a rule using the 'in' list operator", () => {
    const rule = {
      conditionField: "buildCat",
      conditionType: "in",
      conditionValue: "0, 36, 42",
    };
    expect(ruleMatches(rule, { buildCat: 36 })).toBe(true);
    expect(ruleMatches(rule, { buildCat: 5 })).toBe(false);
  });

  it("skips malformed entries in conditions[]", () => {
    const rule = {
      conditionField: "type",
      conditionType: "=",
      conditionValue: "a",
      conditions: [
        { field: "", type: "=", value: "ignored" },
        { field: "missing-type", value: "x" },
      ],
    };
    expect(ruleMatches(rule, { type: "a" })).toBe(true);
  });

  it("compares against another field when valueIsField is true", () => {
    const rule = {
      conditions: [
        { field: "value", type: ">", value: "bankfull", valueIsField: true },
      ],
    };
    expect(ruleMatches(rule, { value: 100, bankfull: 50 })).toBe(true);
    expect(ruleMatches(rule, { value: 10, bankfull: 50 })).toBe(false);
    expect(ruleMatches(rule, { value: "100", bankfull: "50" })).toBe(true);
  });

  it("compares against another field via legacy conditionValueIsField", () => {
    const rule = {
      conditionField: "value",
      conditionType: "<",
      conditionValue: "bankfull",
      conditionValueIsField: true,
    };
    expect(ruleMatches(rule, { value: 10, bankfull: 50 })).toBe(true);
    expect(ruleMatches(rule, { value: 100, bankfull: 50 })).toBe(false);
  });

  it("returns false when the referenced field is missing", () => {
    const rule = {
      conditions: [
        { field: "value", type: ">", value: "missing", valueIsField: true },
      ],
    };
    expect(ruleMatches(rule, { value: 100 })).toBe(false);
  });
});

describe("resolveSize", () => {
  it("returns default size when no rules", () => {
    const size = resolveSize(mockFeature({}), [], 10);
    expect(size).toBe(10);
  });

  it("applies size from matching rule", () => {
    const rules = [
      {
        conditionField: "value",
        conditionType: ">",
        conditionValue: 5,
        size: 20,
      },
      {
        conditionField: "value",
        conditionType: "<=",
        conditionValue: 5,
        size: 15,
      },
    ];
    const size1 = resolveSize(mockFeature({ value: 10 }), rules, 10);
    expect(size1).toBe(20);

    const size2 = resolveSize(mockFeature({ value: 3 }), rules, 10);
    expect(size2).toBe(15);
  });

  it("returns default size when no conditions match", () => {
    const rules = [
      {
        conditionField: "value",
        conditionType: ">",
        conditionValue: 5,
        size: 20,
      },
    ];
    const size = resolveSize(mockFeature({ value: 2 }), rules, 10);
    expect(size).toBe(10);
  });

  it("returns default size when no rule size given", () => {
    const rules = [
      {
        conditionField: "value",
        conditionType: ">",
        conditionValue: 5,
      },
    ];
    const size = resolveSize(mockFeature({ value: 2 }), rules, 10);
    expect(size).toBe(10);
  });

  it("returns default size when no feature value", () => {
    const rules = [
      {
        conditionField: "value",
        conditionType: ">",
        conditionValue: 5,
        size: 20,
      },
    ];
    const size = resolveSize(mockFeature({}), rules, 10);
    expect(size).toBe(10);
  });

  it("return biggest size when matching multuple thresholds", () => {
    const rules = [
      {
        conditionField: "value",
        conditionType: ">",
        conditionValue: 11,
        size: 60,
      },
      {
        conditionField: "value",
        conditionType: ">",
        conditionValue: 8,
        size: 40,
      },
      {
        conditionField: "value",
        conditionType: ">",
        conditionValue: 7,
        size: 30,
      },
      {
        conditionField: "value",
        conditionType: ">",
        conditionValue: 5,
        size: 20,
      },
    ];
    const size = resolveSize(mockFeature({ value: 9 }), rules, 10);
    expect(size).toBe(40);
  });
});

describe("buildPointStyle", () => {
  const stroke = new Stroke({ color: "#0000ff", width: 2 });
  const fill = new Fill({ color: "#ff0000" });

  it("builds style with fill and stroke", () => {
    const style = buildPointStyle(null, 10, fill, stroke);
    expect(style).toBeInstanceOf(Style);
    const image = style.getImage();
    expect(image).toBeInstanceOf(CircleStyle);
    expect(image.getRadius()).toBe(10);
    expect(image.getFill().getColor()).toBe("#ff0000");
    expect(image.getStroke().getColor()).toBe("#0000ff");
    expect(image.getStroke().getWidth()).toBe(2);
  });

  it("builds style with icon", () => {
    const style = buildPointStyle(
      "icon",
      16,
      fill,
      stroke,
      "https://example.com/icon.png",
    );
    expect(style).toBeInstanceOf(Style);
    const image = style.getImage();
    expect(image).toBeInstanceOf(Icon);
    expect(image.getScale()).toBe(16 / 10); // assuming original icon size is 32
    expect(image.getSrc()).toBe("https://example.com/icon.png");
  });

  it("builds style of circle when icon shape but no url", () => {
    const style = buildPointStyle("icon", 16, fill, stroke, null);
    expect(style).toBeInstanceOf(Style);
    const image = style.getImage();
    expect(image).toBeInstanceOf(CircleStyle);
    expect(image.getRadius()).toBe(16);
    expect(image.getFill().getColor()).toBe("#ff0000");
    expect(image.getStroke().getColor()).toBe("#0000ff");
    expect(image.getStroke().getWidth()).toBe(2);
  });

  it("builds style of circle  shape", () => {
    const style = buildPointStyle("circle", 12, fill, stroke);
    expect(style).toBeInstanceOf(Style);
    const image = style.getImage();
    expect(image).toBeInstanceOf(CircleStyle);
    expect(image.getRadius()).toBe(12);
    expect(image.getFill().getColor()).toBe("#ff0000");
    expect(image.getStroke().getColor()).toBe("#0000ff");
    expect(image.getStroke().getWidth()).toBe(2);
  });

  it("builds style of square shape", () => {
    const style = buildPointStyle("square", 14, fill, stroke);
    expect(style).toBeInstanceOf(Style);
    const image = style.getImage();
    expect(image).toBeInstanceOf(RegularShape);
    expect(image.getRadius()).toBe(14);
    expect(image.getPoints()).toBe(4);
    expect(image.getAngle()).toBe(Math.PI / 4);
    expect(image.getFill().getColor()).toBe("#ff0000");
    expect(image.getStroke().getColor()).toBe("#0000ff");
    expect(image.getStroke().getWidth()).toBe(2);
  });

  it("builds style of rectangle shape", () => {
    const style = buildPointStyle("rectangle", 16, fill, stroke);
    expect(style).toBeInstanceOf(Style);
    const image = style.getImage();
    expect(image).toBeInstanceOf(RegularShape);
    expect(image.getRadius()).toBe(16 / Math.SQRT2);
    expect(image.getPoints()).toBe(4);
    expect(image.getFill().getColor()).toBe("#ff0000");
    expect(image.getStroke().getColor()).toBe("#0000ff");
    expect(image.getStroke().getWidth()).toBe(2);
  });

  it("builds style of triangle shape", () => {
    const style = buildPointStyle("triangle", 15, fill, stroke);
    expect(style).toBeInstanceOf(Style);
    const image = style.getImage();
    expect(image).toBeInstanceOf(RegularShape);
    expect(image.getRadius()).toBe(15);
    expect(image.getPoints()).toBe(3);
    expect(image.getFill().getColor()).toBe("#ff0000");
    expect(image.getStroke().getColor()).toBe("#0000ff");
    expect(image.getStroke().getWidth()).toBe(2);
  });

  describe("trapezoid", () => {
    let restoreGetContext;

    beforeEach(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
        fillStyle: null,
        strokeStyle: null,
        lineWidth: null,
        translate: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        closePath: jest.fn(),
        fill: jest.fn(),
        stroke: jest.fn(),
      }));
      restoreGetContext = () => {
        HTMLCanvasElement.prototype.getContext = original;
      };
    });

    afterEach(() => {
      restoreGetContext();
    });

    it("builds style of trapezoid shape", () => {
      const style = buildPointStyle("trapezoid", 10, fill, stroke);
      expect(style).toBeInstanceOf(Style);
      expect(style.getImage()).toBeInstanceOf(Icon);
    });

    it("applies rotation to a trapezoid", () => {
      const style = buildPointStyle("trapezoid", 10, fill, stroke, null, 90);
      expect(style.getImage().getRotation()).toBeCloseTo(Math.PI / 2);
    });

    it("uses rotation=0 default when createTrapezoidIconStyle is called without rotation (line 525)", () => {
      const trapFill = new Fill({ color: "#ff0000" });
      const trapStroke = new Stroke({ color: "#0000ff", width: 1 });
      const style = createTrapezoidIconStyle({
        size: 10,
        fill: trapFill,
        stroke: trapStroke,
      });
      expect(style).toBeInstanceOf(Style);
      expect(style.getImage().getRotation()).toBe(0);
    });
  });

  it("builds style of star shape", () => {
    const style = buildPointStyle("star", 18, fill, stroke);
    expect(style).toBeInstanceOf(Style);
    const image = style.getImage();
    expect(image).toBeInstanceOf(RegularShape);
    expect(image.getRadius()).toBe(18);
    expect(image.getPoints()).toBe(5);
    expect(image.getFill().getColor()).toBe("#ff0000");
    expect(image.getStroke().getColor()).toBe("#0000ff");
    expect(image.getStroke().getWidth()).toBe(2);
  });

  it("builds style of cross shape", () => {
    const style = buildPointStyle("cross", 17, fill, stroke);
    expect(style).toBeInstanceOf(Style);
    const image = style.getImage();
    expect(image).toBeInstanceOf(RegularShape);
    expect(image.getRadius()).toBe(17);
    expect(image.getPoints()).toBe(4);
    expect(image.getAngle()).toBe(0);
    expect(image.getFill().getColor()).toBe("#ff0000");
    expect(image.getStroke().getColor()).toBe("#0000ff");
    expect(image.getStroke().getWidth()).toBe(2);
  });

  it("builds style of x shape", () => {
    const style = buildPointStyle("x", 19, fill, stroke);
    expect(style).toBeInstanceOf(Style);
    const image = style.getImage();
    expect(image).toBeInstanceOf(RegularShape);
    expect(image.getRadius()).toBe(19);
    expect(image.getPoints()).toBe(4);
    expect(image.getAngle()).toBe(Math.PI / 4);
    expect(image.getFill().getColor()).toBe("#ff0000");
    expect(image.getStroke().getColor()).toBe("#0000ff");
    expect(image.getStroke().getWidth()).toBe(2);
  });

  it("builds style of a diamond shape", () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;

    const mockBeginPath = jest.fn();
    const mockMoveTo = jest.fn();
    const mockLineTo = jest.fn();
    const mockStroke = jest.fn();
    const mockTranslate = jest.fn();
    const mockClosePath = jest.fn();
    const mockFill = jest.fn();

    let mockCtxInstance = null;
    class MockCTX {
      constructor() {
        this.fillStyle = null;
        this.strokeStyle = null;
        this.lineWidth = null;
      }
      beginPath = mockBeginPath;
      moveTo = mockMoveTo;
      lineTo = mockLineTo;
      stroke = mockStroke;
      translate = mockTranslate;
      closePath = mockClosePath;
      fill = mockFill;
    }
    const mockGetContext = jest.fn(() => {
      mockCtxInstance = new MockCTX();
      return mockCtxInstance;
    });
    HTMLCanvasElement.prototype.getContext = mockGetContext;

    // Mocks for Fill and Stroke
    const fill = new Fill({ color: "#ff00ff" });
    const stroke = new Stroke({ color: "#00ff00", width: 3 });
    const size = 8;
    const scaledSize = size * 0.6;

    const style = buildPointStyle("diamond", size, fill, stroke);

    expect(style).toBeInstanceOf(Style);
    expect(mockGetContext).toHaveBeenCalledWith("2d");
    expect(mockCtxInstance.lineWidth).toBe(3);
    expect(mockCtxInstance.strokeStyle).toBe("#00ff00");

    expect(mockBeginPath).toHaveBeenCalledTimes(4);
    expect(mockClosePath).toHaveBeenCalledTimes(2);
    expect(mockFill).toHaveBeenCalledTimes(2);
    expect(mockStroke).toHaveBeenCalledTimes(2);

    expect(mockMoveTo).toHaveBeenCalledTimes(6);
    expect(mockLineTo).toHaveBeenCalledTimes(8);

    // top triangle
    expect(mockMoveTo.mock.calls[0]).toEqual([0, -size]);
    expect(mockLineTo.mock.calls[0]).toEqual([scaledSize, 0]);
    expect(mockLineTo.mock.calls[1]).toEqual([-scaledSize, 0]);

    //outer edges
    expect(mockMoveTo.mock.calls[1]).toEqual([0, -size]);
    expect(mockLineTo.mock.calls[2]).toEqual([scaledSize, 0]);
    expect(mockMoveTo.mock.calls[2]).toEqual([0, -size]);
    expect(mockLineTo.mock.calls[3]).toEqual([-scaledSize, 0]);

    // bottom triangle
    expect(mockMoveTo.mock.calls[3]).toEqual([0, size]);
    expect(mockLineTo.mock.calls[4]).toEqual([scaledSize, 0]);
    expect(mockLineTo.mock.calls[5]).toEqual([-scaledSize, 0]);

    expect(mockMoveTo.mock.calls[4]).toEqual([0, size]);
    expect(mockLineTo.mock.calls[6]).toEqual([scaledSize, 0]);
    expect(mockMoveTo.mock.calls[5]).toEqual([0, size]);
    expect(mockLineTo.mock.calls[7]).toEqual([-scaledSize, 0]);

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it("uses rotation=0 default when createDiamondIconStyle is called without rotation (line 561)", () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      fillStyle: null,
      strokeStyle: null,
      lineWidth: null,
      translate: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      fill: jest.fn(),
      stroke: jest.fn(),
    }));
    const diamondFill = new Fill({ color: "#ff00ff" });
    const diamondStroke = new Stroke({ color: "#00ff00", width: 2 });
    const style = createDiamondIconStyle({
      size: 8,
      fill: diamondFill,
      stroke: diamondStroke,
    });
    expect(style).toBeInstanceOf(Style);
    expect(style.getImage().getRotation()).toBe(0);
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it("applies rotation to a rectangle (degrees → radians)", () => {
    const style = buildPointStyle("rectangle", 10, fill, stroke, null, 90);
    expect(style.getImage().getRotation()).toBeCloseTo(Math.PI / 2);
  });

  it("applies rotation to square, triangle, star, cross, x, and icon", () => {
    const cases = [
      ["square", null],
      ["triangle", null],
      ["star", null],
      ["cross", null],
      ["x", null],
      ["icon", "https://example.com/icon.png"],
    ];
    cases.forEach(([shape, iconUrl]) => {
      const style = buildPointStyle(shape, 10, fill, stroke, iconUrl, 180);
      expect(style.getImage().getRotation()).toBeCloseTo(Math.PI);
    });
  });

  it("defaults rotation to 0 when omitted or invalid", () => {
    expect(
      buildPointStyle("square", 10, fill, stroke).getImage().getRotation(),
    ).toBe(0);
    expect(
      buildPointStyle("square", 10, fill, stroke, null, "garbage")
        .getImage()
        .getRotation(),
    ).toBe(0);
  });

  it("accepts numeric-string rotation from rule JSON", () => {
    const style = buildPointStyle("triangle", 10, fill, stroke, null, "45");
    expect(style.getImage().getRotation()).toBeCloseTo(Math.PI / 4);
  });
});

describe("getGeometryBucket", () => {
  it("returns 'point' for Point geometry", () => {
    const feature = mockFeature({}, "Point");
    const bucket = getGeometryBucket(feature);
    expect(bucket).toBe("point");
  });

  it("returns 'point' for MultiPoint geometry", () => {
    const feature = mockFeature({}, "MultiPoint");
    const bucket = getGeometryBucket(feature);
    expect(bucket).toBe("point");
  });

  it("returns 'linestring' for LineString geometry", () => {
    const feature = mockFeature({}, "LineString");
    const bucket = getGeometryBucket(feature);
    expect(bucket).toBe("linestring");
  });

  it("returns 'linestring' for MultiLineString geometry", () => {
    const feature = mockFeature({}, "MultiLineString");
    const bucket = getGeometryBucket(feature);
    expect(bucket).toBe("linestring");
  });

  it("returns 'polygon' for Polygon geometry", () => {
    const feature = mockFeature({}, "Polygon");
    const bucket = getGeometryBucket(feature);
    expect(bucket).toBe("polygon");
  });

  it("returns 'polygon' for MultiPolygon geometry", () => {
    const feature = mockFeature({}, "MultiPolygon");
    const bucket = getGeometryBucket(feature);
    expect(bucket).toBe("polygon");
  });

  it("returns null for other geometry types", () => {
    const feature = mockFeature({}, "GeometryCollection");
    const bucket = getGeometryBucket(feature);
    expect(bucket).toBe("point");
  });
});

describe("loadESRIJSON", () => {
  it("loadESRIJSON returns VectorSource with correct URL", () => {
    const config = {
      props: {
        url: "https://example.com/arcgis/rest/services/test/",
        layer: "0",
        params: {
          WHERE: "1=1",
          TIME: "123,456",
        },
        attributions: "Test Attribution",
      },
    };

    const vectorSource = loadESRIJSON(config);

    expect(vectorSource).toBeInstanceOf(VectorSource);

    // Mock extent, resolution, projection for the url function
    const extent = [0, 0, 10, 10];
    const resolution = 1;
    const projection = { getCode: () => "EPSG:3857" };

    const url = vectorSource.getUrl();
    const generatedUrl = url(extent, resolution, projection);

    expect(generatedUrl).toContain(
      "https://example.com/arcgis/rest/services/test/0/query/",
    );
    expect(generatedUrl).toContain("where=1=1");
    expect(generatedUrl).toContain("time=123,456");
    expect(generatedUrl).toContain("outFields=*");
  });

  it("loadESRIJSON url appends /", () => {
    const config = {
      props: {
        url: "https://example.com/arcgis/rest/services/test",
        layer: "0",
        attributions: "Test Attribution",
      },
    };

    const vectorSource = loadESRIJSON(config);

    expect(vectorSource).toBeInstanceOf(VectorSource);

    // Mock extent, resolution, projection for the url function
    const extent = [0, 0, 10, 10];
    const resolution = 1;
    const projection = { getCode: () => "EPSG:3857" };

    const url = vectorSource.getUrl();
    const generatedUrl = url(extent, resolution, projection);

    expect(generatedUrl).toContain(
      "https://example.com/arcgis/rest/services/test/0/query/",
    );
    expect(generatedUrl).toContain("outFields=*");
  });
});

describe("buildPolygonFill createDotFill", () => {
  it("creates a Fill with a canvas pattern", () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;

    const mockCreatePattern = jest.fn(() => "mockPattern");
    const mockBeginPath = jest.fn();
    const mockArc = jest.fn();
    const mockFill = jest.fn();

    let mockCtxInstance = null;
    class MockCTX {
      constructor() {
        this.fillStyle = null;
      }
      beginPath = mockBeginPath;
      arc = mockArc;
      fill = mockFill;
      createPattern = mockCreatePattern;
    }
    const mockGetContext = jest.fn(() => {
      mockCtxInstance = new MockCTX();
      return mockCtxInstance;
    });
    HTMLCanvasElement.prototype.getContext = mockGetContext;

    const fill = buildPolygonFill({
      polygonFillType: "dot",
      fill: "#123456",
      dotRadius: 3,
      dotSpacing: 12,
    });
    expect(fill).toBeInstanceOf(Fill);
    // The color property should be the mocked pattern string
    expect(fill.getColor()).toBe("mockPattern");

    expect(mockGetContext).toHaveBeenCalledWith("2d");
    const mockCanvas = mockCreatePattern.mock.calls[0][0];
    expect(mockCanvas.width).toBe(12);
    expect(mockCanvas.height).toBe(12);
    expect(mockBeginPath).toHaveBeenCalled();
    expect(mockArc).toHaveBeenCalledWith(6, 6, 3, 0, 2 * Math.PI);
    expect(mockFill).toHaveBeenCalled();
    expect(mockCtxInstance.fillStyle).toBe("#123456");

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it("creates a Fill with a canvas pattern with defaults", () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;

    const mockCreatePattern = jest.fn(() => "mockPattern");
    const mockBeginPath = jest.fn();
    const mockArc = jest.fn();
    const mockFill = jest.fn();

    let mockCtxInstance = null;
    class MockCTX {
      constructor() {
        this.fillStyle = null;
      }
      beginPath = mockBeginPath;
      arc = mockArc;
      fill = mockFill;
      createPattern = mockCreatePattern;
    }
    const mockGetContext = jest.fn(() => {
      mockCtxInstance = new MockCTX();
      return mockCtxInstance;
    });
    HTMLCanvasElement.prototype.getContext = mockGetContext;

    const fill = buildPolygonFill({
      polygonFillType: "dot",
    });
    expect(fill).toBeInstanceOf(Fill);
    // The color property should be the mocked pattern string
    expect(fill.getColor()).toBe("mockPattern");

    expect(mockGetContext).toHaveBeenCalledWith("2d");
    const mockCanvas = mockCreatePattern.mock.calls[0][0];
    expect(mockCanvas.width).toBe(defaultDotSpacing);
    expect(mockCanvas.height).toBe(defaultDotSpacing);
    expect(mockBeginPath).toHaveBeenCalled();
    expect(mockArc).toHaveBeenCalledWith(
      defaultDotSpacing / 2,
      defaultDotSpacing / 2,
      defaultDotRadius,
      0,
      2 * Math.PI,
    );
    expect(mockFill).toHaveBeenCalled();
    expect(mockCtxInstance.fillStyle).toBe(defaultFill);

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });
});

describe("buildPolygonFill createHatchFill", () => {
  it("creates a Fill with a diagonal hatch pattern", () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;

    const mockCreatePattern = jest.fn(() => "mockPattern");
    const mockBeginPath = jest.fn();
    const mockMoveTo = jest.fn();
    const mockLineTo = jest.fn();
    const mockStroke = jest.fn();

    let mockCtxInstance = null;
    class MockCTX {
      constructor() {
        this.strokeStyle = null;
        this.lineWidth = null;
      }
      beginPath = mockBeginPath;
      moveTo = mockMoveTo;
      lineTo = mockLineTo;
      stroke = mockStroke;
      createPattern = mockCreatePattern;
    }
    const mockGetContext = jest.fn(() => {
      mockCtxInstance = new MockCTX();
      return mockCtxInstance;
    });
    HTMLCanvasElement.prototype.getContext = mockGetContext;

    const fill = buildPolygonFill({
      polygonFillType: "hatch",
      fill: "#abcdef",
      hatchSpacing: 10,
      hatchDirection: "diagonal",
    });
    expect(fill).toBeInstanceOf(Fill);
    expect(mockGetContext).toHaveBeenCalledWith("2d");
    const mockCanvas = mockCreatePattern.mock.calls[0][0];
    expect(mockCreatePattern.mock.calls[0][1]).toBe("repeat");
    expect(mockCanvas.width).toBe(10);
    expect(mockCanvas.height).toBe(10);
    expect(mockBeginPath).toHaveBeenCalled();
    expect(mockMoveTo).toHaveBeenCalledWith(0, 10);
    expect(mockLineTo).toHaveBeenCalledWith(10, 0);
    expect(mockStroke).toHaveBeenCalled();
    expect(mockCtxInstance.strokeStyle).toBe("#abcdef");
    expect(mockCtxInstance.lineWidth).toBe(1);

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it("creates a Fill with defaults", () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;

    const mockCreatePattern = jest.fn(() => "mockPattern");
    const mockBeginPath = jest.fn();
    const mockMoveTo = jest.fn();
    const mockLineTo = jest.fn();
    const mockStroke = jest.fn();

    let mockCtxInstance = null;
    class MockCTX {
      constructor() {
        this.strokeStyle = null;
        this.lineWidth = null;
      }
      beginPath = mockBeginPath;
      moveTo = mockMoveTo;
      lineTo = mockLineTo;
      stroke = mockStroke;
      createPattern = mockCreatePattern;
    }
    const mockGetContext = jest.fn(() => {
      mockCtxInstance = new MockCTX();
      return mockCtxInstance;
    });
    HTMLCanvasElement.prototype.getContext = mockGetContext;

    const fill = buildPolygonFill({
      polygonFillType: "hatch",
    });
    expect(fill).toBeInstanceOf(Fill);
    expect(mockGetContext).toHaveBeenCalledWith("2d");
    const mockCanvas = mockCreatePattern.mock.calls[0][0];
    expect(mockCreatePattern.mock.calls[0][1]).toBe("repeat");
    expect(mockCanvas.width).toBe(defaultHatchSpacing);
    expect(mockCanvas.height).toBe(defaultHatchSpacing);
    expect(mockBeginPath).toHaveBeenCalled();
    expect(mockMoveTo).toHaveBeenCalledWith(0, defaultHatchSpacing);
    expect(mockLineTo).toHaveBeenCalledWith(defaultHatchSpacing, 0);
    expect(mockStroke).toHaveBeenCalled();
    expect(mockCtxInstance.strokeStyle).toBe(defaultFill);
    expect(mockCtxInstance.lineWidth).toBe(1);

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it("creates a Fill with a horizontal hatch pattern", () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;

    const mockCreatePattern = jest.fn(() => "mockPattern");
    const mockBeginPath = jest.fn();
    const mockMoveTo = jest.fn();
    const mockLineTo = jest.fn();
    const mockStroke = jest.fn();

    let mockCtxInstance = null;
    class MockCTX {
      constructor() {
        this.strokeStyle = null;
        this.lineWidth = null;
      }
      beginPath = mockBeginPath;
      moveTo = mockMoveTo;
      lineTo = mockLineTo;
      stroke = mockStroke;
      createPattern = mockCreatePattern;
    }
    const mockGetContext = jest.fn(() => {
      mockCtxInstance = new MockCTX();
      return mockCtxInstance;
    });
    HTMLCanvasElement.prototype.getContext = mockGetContext;

    const fill = buildPolygonFill({
      polygonFillType: "hatch",
      fill: "#abcdef",
      hatchSpacing: 10,
      hatchDirection: "horizontal",
    });
    expect(fill).toBeInstanceOf(Fill);
    expect(mockGetContext).toHaveBeenCalledWith("2d");
    const mockCanvas = mockCreatePattern.mock.calls[0][0];
    expect(mockCreatePattern.mock.calls[0][1]).toBe("repeat");
    expect(mockCanvas.width).toBe(10);
    expect(mockCanvas.height).toBe(10);
    expect(mockBeginPath).toHaveBeenCalled();
    expect(mockMoveTo).toHaveBeenCalledWith(0, 5);
    expect(mockLineTo).toHaveBeenCalledWith(10, 5);
    expect(mockStroke).toHaveBeenCalled();
    expect(mockCtxInstance.strokeStyle).toBe("#abcdef");
    expect(mockCtxInstance.lineWidth).toBe(1);

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it("creates a Fill with a vertical hatch pattern", () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;

    const mockCreatePattern = jest.fn(() => "mockPattern");
    const mockBeginPath = jest.fn();
    const mockMoveTo = jest.fn();
    const mockLineTo = jest.fn();
    const mockStroke = jest.fn();

    let mockCtxInstance = null;
    class MockCTX {
      constructor() {
        this.strokeStyle = null;
        this.lineWidth = null;
      }
      beginPath = mockBeginPath;
      moveTo = mockMoveTo;
      lineTo = mockLineTo;
      stroke = mockStroke;
      createPattern = mockCreatePattern;
    }
    const mockGetContext = jest.fn(() => {
      mockCtxInstance = new MockCTX();
      return mockCtxInstance;
    });
    HTMLCanvasElement.prototype.getContext = mockGetContext;

    const fill = buildPolygonFill({
      polygonFillType: "hatch",
      fill: "#abcdef",
      hatchSpacing: 10,
      hatchDirection: "vertical",
    });
    expect(fill).toBeInstanceOf(Fill);
    expect(mockGetContext).toHaveBeenCalledWith("2d");
    const mockCanvas = mockCreatePattern.mock.calls[0][0];
    expect(mockCreatePattern.mock.calls[0][1]).toBe("repeat");
    expect(mockCanvas.width).toBe(10);
    expect(mockCanvas.height).toBe(10);
    expect(mockBeginPath).toHaveBeenCalled();
    expect(mockMoveTo).toHaveBeenCalledWith(5, 0);
    expect(mockLineTo).toHaveBeenCalledWith(5, 10);
    expect(mockStroke).toHaveBeenCalled();
    expect(mockCtxInstance.strokeStyle).toBe("#abcdef");
    expect(mockCtxInstance.lineWidth).toBe(1);

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it("creates a Fill with a cross hatch pattern", () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;

    const mockCreatePattern = jest.fn(() => "mockPattern");
    const mockBeginPath = jest.fn();
    const mockMoveTo = jest.fn();
    const mockLineTo = jest.fn();
    const mockStroke = jest.fn();

    let mockCtxInstance = null;
    class MockCTX {
      constructor() {
        this.strokeStyle = null;
        this.lineWidth = null;
      }
      beginPath = mockBeginPath;
      moveTo = mockMoveTo;
      lineTo = mockLineTo;
      stroke = mockStroke;
      createPattern = mockCreatePattern;
    }
    const mockGetContext = jest.fn(() => {
      mockCtxInstance = new MockCTX();
      return mockCtxInstance;
    });
    HTMLCanvasElement.prototype.getContext = mockGetContext;

    const fill = buildPolygonFill({
      polygonFillType: "hatch",
      fill: "#abcdef",
      hatchSpacing: 10,
      hatchDirection: "cross",
    });
    expect(fill).toBeInstanceOf(Fill);
    expect(mockGetContext).toHaveBeenCalledWith("2d");
    const mockCanvas = mockCreatePattern.mock.calls[0][0];
    expect(mockCreatePattern.mock.calls[0][1]).toBe("repeat");
    expect(mockCanvas.width).toBe(10);
    expect(mockCanvas.height).toBe(10);
    expect(mockBeginPath).toHaveBeenCalledTimes(2);
    const firstMoveToCall = mockMoveTo.mock.calls[0];
    const firstLineToCall = mockLineTo.mock.calls[0];
    const secondMoveToCall = mockMoveTo.mock.calls[1];
    const secondLineToCall = mockLineTo.mock.calls[1];
    expect(firstMoveToCall).toEqual([0, 5]);
    expect(firstLineToCall).toEqual([10, 5]);
    expect(secondMoveToCall).toEqual([5, 0]);
    expect(secondLineToCall).toEqual([5, 10]);
    expect(mockStroke).toHaveBeenCalledTimes(2);
    expect(mockCtxInstance.strokeStyle).toBe("#abcdef");
    expect(mockCtxInstance.lineWidth).toBe(1);

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it("creates a solid fill when polygonFillType is unknown", () => {
    const fill = buildPolygonFill({
      polygonFillType: "unknown",
      fill: "#abcdef",
    });
    expect(fill).toBeInstanceOf(Fill);
    expect(fill.getColor()).toBe("#abcdef");
  });

  it("creates a default solid fill when polygonFillType is unknown and no fill", () => {
    const fill = buildPolygonFill({
      polygonFillType: "unknown",
    });
    expect(fill).toBeInstanceOf(Fill);
    expect(fill.getColor()).toBe(defaultFill);
  });
});

describe("withAntimeridianFix", () => {
  it("returns original props if layer type is not 'ESRI Image and Map Service'", () => {
    const props = {
      url: "https://example.com/arcgis/rest/services/test/0/query/",
    };
    const result = withAntimeridianFix("ESRI Feature Service", props);
    expect(result).toEqual(props);
  });

  it("returns original props if imageLoadFunction is not null", () => {
    const props = {
      url: "https://example.com/arcgis/rest/services/test/0/query/",
      imageLoadFunction: () => {},
    };
    const result = withAntimeridianFix("ESRI Image and Map Service", props);
    expect(result).toEqual(props);
  });

  it("returns modified props with imageLoadFunction that fixes antimeridian", () => {
    const props = {
      url: "https://example.com/arcgis/rest/services/test/0/query/",
    };
    const result = withAntimeridianFix("ESRI Image and Map Service", props);
    expect(result).toHaveProperty("imageLoadFunction");
    expect(typeof result.imageLoadFunction).toBe("function");

    // Invoke the injected loader with an out-of-range BBOX (one world-width
    // west of valid EPSG:3857 — the reported bug shape) and confirm it rewrote
    // the underlying <img>.src via rewriteArcGISExportUrlForAntimeridian.
    const mockImg = { src: null };
    const mockImage = { getImage: () => mockImg };
    const srcUrl =
      "https://example.com/MapServer/export?" +
      "BBOX=-26121778,5687665,-25841122,5804555" +
      "&BBOXSR=3857&IMAGESR=3857&f=image";

    result.imageLoadFunction(mockImage, srcUrl);

    expect(mockImg.src).not.toBe(srcUrl); // sanity: the URL was rewritten
    const rewritten = new URL(mockImg.src);
    const bbox = rewritten.searchParams.get("BBOX").split(",").map(Number);
    // Shifted CRS: BBOX X is centered at 0 with original half-width on each
    // side; Y is untouched.
    const halfWidth = (-25841122 - -26121778) / 2;
    expect(bbox[0]).toBeCloseTo(-halfWidth, 3);
    expect(bbox[2]).toBeCloseTo(halfWidth, 3);
    expect(bbox[1]).toBe(5687665);
    expect(bbox[3]).toBe(5804555);
    // BBOXSR and IMAGESR now carry the custom WKT with the wrapped center
    // longitude as Central_Meridian (≈ +126.6° E for this input).
    const bboxSR = JSON.parse(rewritten.searchParams.get("BBOXSR"));
    expect(bboxSR.wkt).toContain("WGS_1984_Web_Mercator_Auxiliary_Sphere");
    const lonMatch = bboxSR.wkt.match(/Central_Meridian",(-?\d+\.?\d*)/);
    expect(parseFloat(lonMatch[1])).toBeCloseTo(126.6, 1);
    expect(rewritten.searchParams.get("IMAGESR")).toBe(
      rewritten.searchParams.get("BBOXSR"),
    );
  });
});

/* The CORS probe is stubbed throughout these blocks. Left unstubbed it would
   reach msw with no handler registered, and every probing test uses its own
   hostname because the module caches probe results per origin for the lifetime
   of the module. */
describe("withIsolatedCanvas", () => {
  /* OpenLayers merges consecutive layers onto one canvas when their className
     matches, so a unique className per raster layer is what stops a tainted
     layer from blanking its neighbours. */
  it.each([["ImageLayer"], ["TileLayer"]])(
    "gives %s its own className",
    (type) => {
      const first = withIsolatedCanvas(type, {});
      const second = withIsolatedCanvas(type, {});
      expect(first.className).not.toBe(second.className);
      // The conventional class is retained for anything selecting on it.
      expect(first.className).toMatch(/^ol-layer /);
    },
  );

  it("leaves an explicit className alone", () => {
    expect(
      withIsolatedCanvas("ImageLayer", { className: "mine" }).className,
    ).toBe("mine");
  });

  /* Vector layers cannot taint a canvas, and WebGLTile renders to its own WebGL
     canvas regardless, so neither needs isolating. */
  it.each([["VectorLayer"], ["WebGLTile"], ["VectorTileLayer"]])(
    "leaves %s sharing",
    (type) => {
      expect(withIsolatedCanvas(type, {})).not.toHaveProperty("className");
    },
  );
});

describe("withAutoCrossOrigin", () => {
  it("requests CORS when the server allows it", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({ ok: true });
    const url = "https://cors-ok.example.com/wms";
    expect((await withAutoCrossOrigin("WMS", { url })).crossOrigin).toBe(
      "anonymous",
    );
    expect(global.fetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({ method: "HEAD", mode: "cors" }),
    );
  });

  /* Asking for CORS from a server that does not send the header makes the images
     fail to load outright, so a rejected probe must leave the option unset. */
  it("leaves the option unset when the probe is rejected", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new TypeError("CORS"));
    const result = await withAutoCrossOrigin("WMS", {
      url: "https://no-cors.example.com/wms",
    });
    expect(result).not.toHaveProperty("crossOrigin");
  });

  it("probes each origin once and shares the result", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({ ok: true });
    const url = "https://probe-once.example.com/MapServer";
    await Promise.all([
      withAutoCrossOrigin("ESRI Image and Map Service", { url }),
      withAutoCrossOrigin("ESRI Image and Map Service", { url: `${url}/2` }),
    ]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not probe source types that are already CORS-clean", async () => {
    jest.spyOn(global, "fetch");
    const props = { url: "https://image-tile.example.com/tile/{z}/{y}/{x}" };
    expect(await withAutoCrossOrigin("Image Tile", props)).toBe(props);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([[true], [false], ["anonymous"]])(
    "lets an explicit setting (%p) win over detection",
    async (crossOrigin) => {
      jest.spyOn(global, "fetch");
      const props = { url: "https://explicit.example.com/wms", crossOrigin };
      expect(await withAutoCrossOrigin("WMS", props)).toBe(props);
      expect(global.fetch).not.toHaveBeenCalled();
    },
  );
});

/* Only the ol/source/Image* classes are covered here. ol/source/ImageTile (the
   "Image Tile" type) defaults crossOrigin to "anonymous" of its own accord - see
   DataTile.js, `options.crossOrigin || 'anonymous'` - so it is already CORS-clean
   and deliberately exposes no toggle. These two default to null and are among the
   sources that actually taint the map canvas. */
describe.each([
  ["ESRI Image and Map Service", "https://esri-co.example.com/MapServer"],
  ["WMS", "https://wms-co.example.com/wms"],
])("crossOrigin on %s", (sourceType, url) => {
  beforeEach(() => {
    // Detection off, so the unset cases below are about the explicit value only.
    jest.spyOn(global, "fetch").mockRejectedValue(new TypeError("CORS"));
  });

  const buildSource = async (crossOrigin) => {
    const layer = await moduleLoader(
      {
        type: "ImageLayer",
        props: {
          source: {
            type: sourceType,
            props: {
              url,
              ...(crossOrigin === undefined ? {} : { crossOrigin }),
            },
          },
        },
      },
      "EPSG:3857",
    );
    return layer.getSource();
  };

  // The GUI renders crossOrigin as a checkbox, so a checked box arrives as
  // boolean true rather than the attribute value OpenLayers expects.
  it("translates a checked box into the crossorigin attribute value", async () => {
    expect((await buildSource(true)).crossOrigin_).toBe("anonymous");
  });

  it("passes an explicit 'anonymous' through", async () => {
    expect((await buildSource("anonymous")).crossOrigin_).toBe("anonymous");
  });

  it.each([[false], [undefined]])(
    "leaves the option unset when not enabled (%p)",
    async (value) => {
      expect((await buildSource(value)).crossOrigin_).toBeNull();
    },
  );
});

describe("applyZarrRamp", () => {
  const zarrRampLayer = (source = {}) => ({
    type: "WebGLTile",
    props: {
      name: "flood",
      source: {
        type: "Zarr",
        rampName: "turbo",
        props: { url: "https://x/store.zarr", variable: "depth", index: "7" },
        ...source,
      },
    },
  });

  const sliceWith = (over = {}) => ({
    width: 5,
    height: 4,
    extent: [-100, 180, -75, 200],
    crs: "EPSG:3857",
    data: new Float32Array(40),
    min: 0,
    max: 17.45,
    ...over,
  });

  beforeEach(() => {
    clearClientSourceCaches();
    readSlice.mockReset();
    readSlice.mockResolvedValue(sliceWith());
  });

  test("fits the ramp to the slice's real value range", async () => {
    const config = zarrRampLayer();

    await applyAutoRamp(config); // delegates to applyZarrRamp for Zarr sources

    expect(config.props.source.resolvedRampMin).toBe(0);
    expect(config.props.source.resolvedRampMax).toBeCloseTo(17.45, 4);
    const color = config.style.color;
    expect(color[0]).toBe("case"); // hasNodata wraps the ramp in an alpha guard
    const interpolate = color[3];
    expect(interpolate[0]).toBe("interpolate");
    expect(interpolate[3]).toBe(0);
    expect(interpolate[interpolate.length - 2]).toBeCloseTo(17.45, 4);
  });

  test("honors an author-pinned range instead of the slice range", async () => {
    const config = zarrRampLayer({ rampMin: "0", rampMax: "5" });

    await applyAutoRamp(config);

    const interpolate = config.style.color[3];
    expect(interpolate[interpolate.length - 2]).toBe(5);
    expect(config.props.source.resolvedRampMax).toBe(5);
  });

  test("reads the slice only once for a slice it already resolved", async () => {
    const config = zarrRampLayer();

    await applyAutoRamp(config);
    await applyAutoRamp(config);

    expect(readSlice).toHaveBeenCalledTimes(1);
    expect(config.props.source.resolvedRampMax).toBeCloseTo(17.45, 4);
  });

  test("re-resolves when the slice index moves", async () => {
    const config = zarrRampLayer();
    await applyAutoRamp(config);

    readSlice.mockResolvedValue(sliceWith({ max: 300 }));
    config.props.source.props.index = "8";
    await applyAutoRamp(config);

    expect(readSlice).toHaveBeenCalledTimes(2);
    expect(config.props.source.resolvedRampMax).toBe(300);
  });

  test("passes the mask threshold into the style as a transparent branch", async () => {
    const config = zarrRampLayer();
    config.props.source.props.mask_below = "0.05";

    await applyAutoRamp(config);

    // nodata guard is branch 1; the mask is branch 2 on band 1.
    expect(config.style.color[3]).toEqual(["<=", ["band", 1], 0.05]);
  });

  test("styles categorical Zarr layers by class without a range", async () => {
    const config = zarrRampLayer({
      rampName: undefined,
      styleMode: "categorical",
      classes: [
        { value: "0", color: "#aaa" },
        { value: "1", color: "#bbb" },
      ],
    });

    await applyAutoRamp(config);

    expect(config.style.color[0]).toBe("case");
    expect(config.style.color[3]).toEqual([
      "match",
      ["band", 1],
      0,
      "#aaa",
      1,
      "#bbb",
      [0, 0, 0, 0],
    ]);
  });

  test("falls back to grayscale fitted to the slice without a ramp or classes", async () => {
    // A DataTile carries raw values with no normalization, so an unstyled layer
    // would paint raw floats into the color channels. The GeoTIFF source this
    // replaced rendered `normalize: true` grayscale; keep that behavior.
    const config = zarrRampLayer({ rampName: undefined });

    await applyAutoRamp(config);

    expect(readSlice).toHaveBeenCalledTimes(1);
    expect(config.style.color).toBeDefined();
    expect(config.props.source.resolvedRampMax).toBeGreaterThan(
      config.props.source.resolvedRampMin,
    );
  });
});

describe("loadZarr", () => {
  const zarrSource = (props = {}) => ({
    type: "Zarr",
    props: {
      url: "https://x/store.zarr",
      variable: "depth",
      index: "0",
      ...props,
    },
  });

  beforeEach(() => {
    clearClientSourceCaches();
    readSlice.mockReset();
    readSlice.mockResolvedValue({
      width: 5,
      height: 4,
      extent: [-100, 180, -75, 200],
      crs: "EPSG:3857",
      data: new Float32Array(40),
      min: 0,
      max: 18,
    });
  });

  test("builds a DataTile source with a getView shim over the slice extent", async () => {
    const source = await loadZarr(zarrSource(), "EPSG:3857");

    expect(source).toBeInstanceOf(DataTile);
    expect(source.getTileGrid().getResolutions()).toEqual([5]); // 25m / 5px
    const view = await source.getView();
    expect(view.projection).toBe("EPSG:3857");
    expect(view.extent).toEqual([-100, 180, -75, 200]);
    expect(view.center).toEqual([-87.5, 190]);
  });

  test("reads the slice from the source's fields (index and mask coerced)", async () => {
    await loadZarr(zarrSource({ index: "3", mask_below: "0.5" }), "EPSG:3857");

    expect(readSlice).toHaveBeenCalledWith({
      url: "https://x/store.zarr",
      variable: "depth",
      index: 3,
      maskBelow: 0.5,
    });
  });

  test("adopts the store CRS in getView when it differs from the map", async () => {
    readSlice.mockResolvedValue({
      width: 5,
      height: 4,
      extent: [0, 0, 25, 20],
      crs: "EPSG:4326",
      data: new Float32Array(40),
      min: 0,
      max: 1,
    });

    const source = await loadZarr(zarrSource(), "EPSG:3857");
    const view = await source.getView();

    expect(view.projection).toBe("EPSG:4326");
  });
});

describe("applyAutoRamp", () => {
  const geotiffRampLayer = (source = {}) => ({
    type: "WebGLTile",
    props: {
      name: "flood",
      source: {
        type: "GeoTIFF",
        rampName: "turbo",
        props: { url: "https://x/depth.tif" },
        ...source,
      },
    },
  });

  // geotiff.js: getGDALMetadata(0) returns items tagged for sample 0, while
  // getGDALMetadata(null) returns the dataset-level items. Writers put
  // STATISTICS_* in either place, so the mock has to tell them apart.
  const mockGDALMetadata = ({ band = {}, dataset = {}, fileNodata = null }) =>
    fromUrl.mockResolvedValue({
      getImage: jest.fn().mockResolvedValue({
        getGDALMetadata: jest.fn((sample) =>
          sample === null ? dataset : band,
        ),
        getGDALNoData: jest.fn(() => fileNodata),
      }),
    });

  const mockStats = (meta) => mockGDALMetadata({ band: meta });

  beforeEach(() => {
    fromUrl.mockReset();
  });

  test("styles raw values over the slice range and turns normalize off", async () => {
    mockStats({ STATISTICS_MINIMUM: "0", STATISTICS_MAXIMUM: "17.45" });
    const config = geotiffRampLayer();

    await applyAutoRamp(config);

    // normalize off => OL keeps float32 tile data, so getData reports depths.
    expect(config.props.source.props.normalize).toBe(false);
    expect(config.props.source.resolvedRampMin).toBe(0);
    expect(config.props.source.resolvedRampMax).toBeCloseTo(17.45, 4);
    // The author's own fields stay empty so the ramp keeps meaning "auto".
    expect(config.props.source.rampMin).toBeUndefined();
    expect(config.props.source.rampMax).toBeUndefined();

    const color = config.style.color;
    // hasNodata wraps the interpolate in a `case` against the alpha band.
    expect(color[0]).toBe("case");
    const interpolate = color[3];
    expect(interpolate[0]).toBe("interpolate");
    expect(interpolate[3]).toBe(0);
    expect(interpolate[interpolate.length - 2]).toBeCloseTo(17.45, 4);
  });

  test("reads stats from the source's own URL", async () => {
    mockStats({ STATISTICS_MINIMUM: "1", STATISTICS_MAXIMUM: "2" });
    const config = geotiffRampLayer();

    await applyAutoRamp(config);

    expect(fromUrl.mock.calls[0][0]).toBe("https://x/depth.tif");
  });

  test("does not refetch for a file it already resolved", async () => {
    mockStats({ STATISTICS_MINIMUM: "0", STATISTICS_MAXIMUM: "9" });
    const config = geotiffRampLayer();

    // Safe to call from both the legend build and the layer build in one render.
    await applyAutoRamp(config);
    await applyAutoRamp(config);

    expect(fromUrl).toHaveBeenCalledTimes(1);
    expect(config.props.source.resolvedRampMax).toBe(9);
  });

  test("re-resolves when the source URL changes", async () => {
    mockStats({ STATISTICS_MINIMUM: "0", STATISTICS_MAXIMUM: "9" });
    const config = geotiffRampLayer();
    await applyAutoRamp(config);

    // A new file: same layer object, different URL — the ramp must refit.
    mockStats({ STATISTICS_MINIMUM: "0", STATISTICS_MAXIMUM: "300" });
    config.props.source.props.url = "https://x/depth2.tif";
    await applyAutoRamp(config);

    expect(fromUrl).toHaveBeenCalledTimes(2);
    expect(config.props.source.resolvedRampMax).toBe(300);
  });

  test("leaves non-Zarr layers alone", async () => {
    const config = {
      type: "WebGLTile",
      props: { source: { type: "GeoTIFF", rampName: "turbo", props: {} } },
    };

    await applyAutoRamp(config);

    expect(fromUrl).not.toHaveBeenCalled();
    expect(config.style).toBeUndefined();
  });

  test("honors an author-pinned range instead of auto-fitting", async () => {
    mockStats({ STATISTICS_MINIMUM: "0", STATISTICS_MAXIMUM: "99" });
    const config = geotiffRampLayer({ rampMin: "0", rampMax: "5" });

    await applyAutoRamp(config);

    // The file's 0-99 range is ignored; the ramp keeps the author's 0-5.
    const interpolate = config.style.color[3];
    expect(interpolate[interpolate.length - 2]).toBe(5);
    expect(config.props.source.rampMax).toBe("5");
  });

  test("does nothing without a ramp style", async () => {
    const config = geotiffRampLayer({ rampName: undefined });

    await applyAutoRamp(config);

    expect(fromUrl).not.toHaveBeenCalled();
    expect(config.style).toBeUndefined();
  });

  test.each([
    ["missing stats", {}],
    [
      "unparseable stats",
      { STATISTICS_MINIMUM: "n/a", STATISTICS_MAXIMUM: "x" },
    ],
    [
      "a degenerate range",
      { STATISTICS_MINIMUM: "5", STATISTICS_MAXIMUM: "5" },
    ],
  ])("falls back to normalized rendering on %s", async (_label, meta) => {
    mockStats(meta);
    // Missing stats triggers a sidecar (.aux.xml) probe; stub it so the GeoTIFF
    // vehicle doesn't attempt a real fetch.
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    const config = geotiffRampLayer();

    await applyAutoRamp(config);

    // No usable range, so raw-value styling is not switched on...
    expect(config.props.source.props.normalize).toBeUndefined();
    // ...but the style is still rebuilt so nodata cells stay transparent.
    expect(config.style.color[0]).toBe("case");
    expect(config.style.color[3][0]).toBe("interpolate");
  });

  test("falls back to normalized rendering when the header cannot be read", async () => {
    fromUrl.mockRejectedValue(new Error("network"));
    const config = geotiffRampLayer();

    await expect(applyAutoRamp(config)).resolves.toBeTruthy();

    expect(config.props.source.props.normalize).toBeUndefined();
    expect(config.props.source.resolvedRampMin).toBeUndefined();
  });

  test("reads dataset-level STATISTICS_* when the band carries none", async () => {
    // GDAL and MATLAB's Mapping Toolbox write STATISTICS_* at dataset level, so
    // a band-only lookup finds nothing and the layer renders flat.
    mockGDALMetadata({
      band: {},
      dataset: { STATISTICS_MINIMUM: "0", STATISTICS_MAXIMUM: "1" },
    });
    const config = geotiffRampLayer();

    await applyAutoRamp(config);

    expect(config.props.source.props.normalize).toBe(false);
    expect(config.props.source.resolvedRampMin).toBe(0);
    expect(config.props.source.resolvedRampMax).toBe(1);
  });

  test("prefers band-level STATISTICS_* over dataset-level", async () => {
    mockGDALMetadata({
      band: { STATISTICS_MINIMUM: "2", STATISTICS_MAXIMUM: "8" },
      dataset: { STATISTICS_MINIMUM: "0", STATISTICS_MAXIMUM: "100" },
    });
    const config = geotiffRampLayer();

    await applyAutoRamp(config);

    expect(config.props.source.resolvedRampMin).toBe(2);
    expect(config.props.source.resolvedRampMax).toBe(8);
  });

  test("resolves only the max when the author pinned the min", async () => {
    mockStats({ STATISTICS_MINIMUM: "0.4", STATISTICS_MAXIMUM: "17.45" });
    const config = geotiffRampLayer({ rampMin: "0" });

    await applyAutoRamp(config);

    // Pinned min is honored; the file's minimum of 0.4 is ignored.
    expect(config.props.source.resolvedRampMin).toBe(0);
    expect(config.props.source.resolvedRampMax).toBeCloseTo(17.45, 4);
    expect(config.props.source.props.normalize).toBe(false);
    const interpolate = config.style.color[3];
    expect(interpolate[3]).toBe(0);
    expect(interpolate[interpolate.length - 2]).toBeCloseTo(17.45, 4);
  });

  test("resolves only the min when the author pinned the max", async () => {
    mockStats({ STATISTICS_MINIMUM: "0.4", STATISTICS_MAXIMUM: "17.45" });
    const config = geotiffRampLayer({ rampMax: "20" });

    await applyAutoRamp(config);

    expect(config.props.source.resolvedRampMin).toBeCloseTo(0.4, 4);
    expect(config.props.source.resolvedRampMax).toBe(20);
  });

  test("still reads the header when both bounds are pinned, to settle nodata", async () => {
    // The header also carries GDAL_NODATA, and a pinned layer needs its
    // transparency right just as much as an auto-fitted one.
    mockStats({ STATISTICS_MINIMUM: "0", STATISTICS_MAXIMUM: "17" });
    const config = geotiffRampLayer({ rampMin: "1", rampMax: "5" });

    await applyAutoRamp(config);

    expect(fromUrl).toHaveBeenCalledTimes(1);
    // Pinned bounds are not overwritten by the resolved ones.
    expect(config.props.source.resolvedRampMin).toBe(1);
    expect(config.props.source.resolvedRampMax).toBe(5);
  });

  test("treats a pinned min of 0 as set, not as empty", async () => {
    // A falsy-but-valid bound must not be mistaken for "resolve me".
    mockStats({ STATISTICS_MINIMUM: "5", STATISTICS_MAXIMUM: "9" });
    const config = geotiffRampLayer({ rampMin: 0 });

    await applyAutoRamp(config);

    expect(config.props.source.resolvedRampMin).toBe(0);
    expect(config.props.source.resolvedRampMax).toBe(9);
  });

  test("bails when a pinned min exceeds the file's maximum", async () => {
    mockStats({ STATISTICS_MINIMUM: "0", STATISTICS_MAXIMUM: "1" });
    const config = geotiffRampLayer({ rampMin: "50" });

    await applyAutoRamp(config);

    expect(config.props.source.props.normalize).toBeUndefined();
    expect(config.props.source.resolvedRampMin).toBeUndefined();
  });

  test("bails when a pinned bound is not a number", async () => {
    mockStats({ STATISTICS_MINIMUM: "0", STATISTICS_MAXIMUM: "1" });
    const config = geotiffRampLayer({ rampMin: "abc" });

    await applyAutoRamp(config);

    expect(config.props.source.props.normalize).toBeUndefined();
    expect(config.props.source.resolvedRampMin).toBeUndefined();
  });

  test("lifts a resolved min to the mask threshold", async () => {
    // A GeoTIFF is masked in the style, after its statistics were written, so
    // the stats still describe values the mask hides. Without this the bottom of
    // the ramp would be spent on invisible pixels.
    mockStats({ STATISTICS_MINIMUM: "0", STATISTICS_MAXIMUM: "1" });
    const config = geotiffRampLayer();
    config.props.source.props.mask_below = "0.05";

    await applyAutoRamp(config);

    expect(config.props.source.resolvedRampMin).toBeCloseTo(0.05, 6);
    expect(config.props.source.resolvedRampMax).toBe(1);
  });

  test("passes the mask threshold into the style as a transparent branch", async () => {
    mockStats({ STATISTICS_MINIMUM: "0", STATISTICS_MAXIMUM: "1" });
    const config = geotiffRampLayer();
    config.props.source.props.mask_below = "0.05";

    await applyAutoRamp(config);

    // Zarr sets hasNodata, so nodata is guard 1 and the mask is guard 2.
    expect(config.style.color[3]).toEqual(["<=", ["band", 1], 0.05]);
  });

  test("leaves a pinned min alone even when a mask threshold is higher", async () => {
    mockStats({ STATISTICS_MINIMUM: "0", STATISTICS_MAXIMUM: "1" });
    const config = geotiffRampLayer({ rampMin: "0" });
    config.props.source.props.mask_below = "0.05";

    await applyAutoRamp(config);

    expect(config.props.source.resolvedRampMin).toBe(0);
  });

  test("does not lift the min when the mask is below the file minimum", async () => {
    mockStats({ STATISTICS_MINIMUM: "3", STATISTICS_MAXIMUM: "9" });
    const config = geotiffRampLayer();
    config.props.source.props.mask_below = "1";

    await applyAutoRamp(config);

    expect(config.props.source.resolvedRampMin).toBe(3);
  });

  test("does not lift the min when the mask covers the whole range", async () => {
    // Clamping here would invert the range and bail out; instead keep the ramp
    // and let the mask render every cell transparent.
    mockStats({ STATISTICS_MINIMUM: "0", STATISTICS_MAXIMUM: "1" });
    const config = geotiffRampLayer();
    config.props.source.props.mask_below = "5";

    await applyAutoRamp(config);

    expect(config.props.source.resolvedRampMin).toBe(0);
    expect(config.props.source.resolvedRampMax).toBe(1);
    expect(config.style.color[3]).toEqual(["<=", ["band", 1], 5]);
  });

  test("tolerates getGDALMetadata returning null for a file with no GDAL tags", async () => {
    fromUrl.mockResolvedValue({
      getImage: jest.fn().mockResolvedValue({
        getGDALMetadata: jest.fn(() => null),
        getGDALNoData: jest.fn(() => null),
      }),
    });
    const config = geotiffRampLayer();

    await expect(applyAutoRamp(config)).resolves.toBeTruthy();

    expect(config.props.source.props.normalize).toBeUndefined();
    expect(config.props.source.resolvedRampMin).toBeUndefined();
  });

  describe("categorical layers", () => {
    const categoricalLayer = (source = {}) => ({
      type: "WebGLTile",
      props: {
        name: "land use",
        source: {
          type: "GeoTIFF",
          styleMode: "categorical",
          classes: [
            { value: "0", color: "#aaa", label: "Bare" },
            { value: "1", color: "#bbb", label: "Crop" },
          ],
          props: { url: "https://example.com/landuse.tif" },
          ...source,
        },
      },
    });

    test("styles by class and forces raw band values", async () => {
      mockGDALMetadata({ fileNodata: 255 });
      const config = categoricalLayer();

      await applyAutoRamp(config);

      // normalize must be off or band 1 would carry 0-255 scaled bytes and the
      // match would never line up with the class values.
      expect(config.props.source.props.normalize).toBe(false);
      // Nearest neighbor, or resampling blends band 1 into values matching no
      // class and blends band 2 off 0, fringing every nodata boundary.
      expect(config.props.source.props.interpolate).toBe(false);
      expect(config.style.color[0]).toBe("case");
      expect(config.style.color[3]).toEqual([
        "match",
        ["band", 1],
        0,
        "#aaa",
        1,
        "#bbb",
        [0, 0, 0, 0],
      ]);
    });

    test("still discovers nodata", async () => {
      mockGDALMetadata({ fileNodata: 255 });
      const config = categoricalLayer();

      await applyAutoRamp(config);

      expect(config.props.source.props.nodata).toBe(255);
    });

    test("needs no statistics and never requests a sidecar", async () => {
      // The class values are the scale, so there is no range to resolve.
      mockGDALMetadata({ fileNodata: 255 });
      global.fetch = jest.fn();
      const config = categoricalLayer();

      await applyAutoRamp(config);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(config.props.source.resolvedRampMin).toBeUndefined();
    });

    test("applies the fallback color and the mask guard", async () => {
      mockGDALMetadata({ fileNodata: 255 });
      const config = categoricalLayer({ fallbackColor: "#999999" });
      config.props.source.props.mask_below = "0";

      await applyAutoRamp(config);

      expect(config.style.color[3]).toEqual(["<=", ["band", 1], 0]);
      const match = config.style.color[5];
      expect(match[match.length - 1]).toBe("#999999");
    });

    test("ignores a categorical mode with no usable class", async () => {
      // A half-filled table must not take over the style.
      mockStats({ STATISTICS_MINIMUM: "0", STATISTICS_MAXIMUM: "2" });
      const config = categoricalLayer({
        classes: [{ value: "", color: "#aaa" }],
        rampName: "turbo",
      });

      await applyAutoRamp(config);

      expect(config.style.color[3][0]).toBe("interpolate");
      expect(config.props.source.resolvedRampMax).toBe(2);
    });

    test("does nothing when neither a ramp nor classes are set", async () => {
      const config = categoricalLayer({ styleMode: undefined, classes: [] });

      await applyAutoRamp(config);

      expect(fromUrl).not.toHaveBeenCalled();
      expect(config.style).toBeUndefined();
    });
  });

  describe("GeoTIFF sources", () => {
    const geotiffLayer = (source = {}, props = {}) => ({
      type: "WebGLTile",
      props: {
        name: "depth",
        source: {
          type: "GeoTIFF",
          rampName: "turbo",
          props: { url: "https://example.com/depth.tif", ...props },
          ...source,
        },
      },
    });

    test("fits the ramp to the file's stats and turns normalize off", async () => {
      mockStats({ STATISTICS_MINIMUM: "0.05", STATISTICS_MAXIMUM: "11.7" });
      const config = geotiffLayer();

      await applyAutoRamp(config);

      expect(fromUrl).toHaveBeenCalledWith("https://example.com/depth.tif");
      expect(config.props.source.props.normalize).toBe(false);
      expect(config.props.source.resolvedRampMin).toBeCloseTo(0.05, 4);
      expect(config.props.source.resolvedRampMax).toBeCloseTo(11.7, 4);
    });

    test("guards band 2 even when neither author nor file declares nodata", async () => {
      // A NaN default is applied, so OL adds an alpha band regardless.
      mockStats({ STATISTICS_MINIMUM: "0", STATISTICS_MAXIMUM: "10" });
      const config = geotiffLayer();

      await applyAutoRamp(config);

      expect(config.style.color[0]).toBe("case");
      expect(Number.isNaN(config.props.source.props.nodata)).toBe(true);
    });

    test("discovers nodata from the file when the author left it blank", async () => {
      mockGDALMetadata({
        band: { STATISTICS_MINIMUM: "0", STATISTICS_MAXIMUM: "10" },
        fileNodata: 255,
      });
      const config = geotiffLayer();

      await applyAutoRamp(config);

      expect(config.props.source.props.nodata).toBe(255);
      expect(config.style.color[0]).toBe("case");
    });

    test("a NaN nodata declared by the file is kept, not replaced", async () => {
      mockGDALMetadata({
        band: { STATISTICS_MINIMUM: "0", STATISTICS_MAXIMUM: "1" },
        fileNodata: NaN,
      });
      const config = geotiffLayer();

      await applyAutoRamp(config);

      expect(Number.isNaN(config.props.source.props.nodata)).toBe(true);
    });

    const mockSidecar = (xml, ok = true) => {
      global.fetch = jest.fn().mockResolvedValue({
        ok,
        text: jest.fn().mockResolvedValue(xml),
      });
    };

    const PAM_XML = `<PAMDataset><PAMRasterBand band="1"><Metadata>
        <MDI key="STATISTICS_MINIMUM">0</MDI>
        <MDI key="STATISTICS_MAXIMUM">2</MDI>
      </Metadata></PAMRasterBand></PAMDataset>`;

    test("falls back to the .aux.xml sidecar when the TIFF embeds no statistics", async () => {
      // gdalinfo -stats writes STATISTICS_* to a PAM sidecar rather than the
      // file, and geotiff.js cannot see it.
      mockGDALMetadata({ fileNodata: 255 });
      mockSidecar(PAM_XML);
      const config = geotiffLayer();

      await applyAutoRamp(config);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/depth.tif.aux.xml",
      );
      expect(config.props.source.resolvedRampMin).toBe(0);
      expect(config.props.source.resolvedRampMax).toBe(2);
    });

    test("does not request a sidecar when the TIFF already embeds statistics", async () => {
      mockStats({ STATISTICS_MINIMUM: "0", STATISTICS_MAXIMUM: "10" });
      global.fetch = jest.fn();
      const config = geotiffLayer();

      await applyAutoRamp(config);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(config.props.source.resolvedRampMax).toBe(10);
    });

    test("does not request a sidecar when both bounds are pinned", async () => {
      mockGDALMetadata({ fileNodata: 255 });
      global.fetch = jest.fn();
      const config = geotiffLayer({ rampMin: "0", rampMax: "2" });

      await applyAutoRamp(config);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    test("tolerates a 404 from the sidecar", async () => {
      // The normal case for files that embed their statistics.
      mockGDALMetadata({ fileNodata: 255 });
      mockSidecar("", false);
      const config = geotiffLayer();

      await expect(applyAutoRamp(config)).resolves.toBeTruthy();

      expect(config.props.source.resolvedRampMin).toBeUndefined();
      // Nodata still resolved, so the style still guards the alpha band.
      expect(config.props.source.props.nodata).toBe(255);
      expect(config.style.color[0]).toBe("case");
    });

    test("tolerates an unreachable or unparseable sidecar", async () => {
      mockGDALMetadata({ fileNodata: 255 });
      global.fetch = jest.fn().mockRejectedValue(new Error("network"));
      const config = geotiffLayer();

      await expect(applyAutoRamp(config)).resolves.toBeTruthy();

      expect(config.props.source.resolvedRampMin).toBeUndefined();
    });

    test("guards band 2 when the file has nodata but no statistics", async () => {
      // Common for COGs without STATISTICS_*: the ramp cannot be fitted, but
      // nodata cells must still be transparent rather than painted at band 1 = 0.
      mockGDALMetadata({ fileNodata: 255 });
      const config = geotiffLayer();

      await applyAutoRamp(config);

      expect(config.props.source.props.nodata).toBe(255);
      expect(config.style.color[0]).toBe("case");
      // Normalized mode: the ramp still spans OL's 0-1 scaled band.
      expect(config.style.color[3][0]).toBe("interpolate");
      expect(config.props.source.props.normalize).toBeUndefined();
    });

    test("refits when a variable input swaps the URL", async () => {
      mockStats({ STATISTICS_MINIMUM: "0", STATISTICS_MAXIMUM: "10" });
      const config = geotiffLayer();
      await applyAutoRamp(config);

      mockStats({ STATISTICS_MINIMUM: "0", STATISTICS_MAXIMUM: "250" });
      config.props.source.props.url = "https://example.com/depth-storm2.tif";
      await applyAutoRamp(config);

      expect(fromUrl).toHaveBeenCalledTimes(2);
      expect(config.props.source.resolvedRampMax).toBe(250);
    });

    test("skips a source with a blank url", async () => {
      const config = geotiffLayer({}, { url: "" });

      await applyAutoRamp(config);

      expect(fromUrl).not.toHaveBeenCalled();
      expect(config.style).toBeUndefined();
    });

    test.each([
      ["file:", "file:///etc/passwd"],
      ["blob:", "blob:http://x/abc"],
      ["data:", "data:image/tiff;base64,AAA"],
      ["protocol-relative", "//example.com/depth.tif"],
    ])("refuses to fetch a %s URL", async (_label, url) => {
      const config = geotiffLayer({}, { url });

      await applyAutoRamp(config);

      expect(fromUrl).not.toHaveBeenCalled();
      expect(config.style).toBeUndefined();
    });

    test("skips a source with no url at all", async () => {
      const config = geotiffLayer({}, { url: undefined });

      await applyAutoRamp(config);

      expect(fromUrl).not.toHaveBeenCalled();
    });
  });
});

describe("s3UrlToHttps", () => {
  test("passes an https url through unchanged", () => {
    expect(s3UrlToHttps("https://x/y.gpkg")).toBe("https://x/y.gpkg");
  });

  test("returns non-string input unchanged", () => {
    expect(s3UrlToHttps(undefined)).toBeUndefined();
  });

  test("converts s3:// to a virtual-hosted https url, sniffing the region", () => {
    expect(
      s3UrlToHttps("s3://cog-s3-test-1234-us-east-1-an/Guatemala_IBF/f.gpkg"),
    ).toBe(
      "https://cog-s3-test-1234-us-east-1-an.s3.us-east-1.amazonaws.com/Guatemala_IBF/f.gpkg",
    );
  });

  test("honors a region embedded in the bucket name", () => {
    expect(s3UrlToHttps("s3://data-eu-west-2-x/k.gpkg")).toBe(
      "https://data-eu-west-2-x.s3.eu-west-2.amazonaws.com/k.gpkg",
    );
  });

  test("defaults the region when none is in the bucket name", () => {
    expect(s3UrlToHttps("s3://my-bucket/a/b.gpkg")).toBe(
      "https://my-bucket.s3.us-east-1.amazonaws.com/a/b.gpkg",
    );
  });

  test("handles an s3 url with no key", () => {
    expect(s3UrlToHttps("s3://plain-bucket")).toBe(
      "https://plain-bucket.s3.us-east-1.amazonaws.com/",
    );
  });
});

describe("registerGeoPackageProjections", () => {
  test("registers WGS84 UTM zones with proj4 and OpenLayers", () => {
    registerGeoPackageProjections();
    expect(proj4.defs("EPSG:32615")).toBeTruthy();
    expect(proj4.defs("EPSG:32715")).toBeTruthy();
    expect(getProjection("EPSG:32615")).not.toBeNull();
  });

  test("is idempotent", () => {
    expect(() => {
      registerGeoPackageProjections();
      registerGeoPackageProjections();
    }).not.toThrow();
  });
});

describe("loadGeoPackage", () => {
  test("returns the requested table's vector source", async () => {
    const src = new VectorSource();
    loadGpkg.mockResolvedValue([{ roads: src }, {}]);
    const out = await loadGeoPackage(
      { props: { url: "https://h/t1.gpkg", layer: "roads" } },
      "EPSG:3857",
    );
    expect(out).toBe(src);
    expect(loadGpkg).toHaveBeenCalledWith("https://h/t1.gpkg", "EPSG:3857");
  });

  test("translates an s3:// url before loading", async () => {
    loadGpkg.mockResolvedValue([{ t: new VectorSource() }, {}]);
    await loadGeoPackage(
      { props: { url: "s3://b-us-east-1-x/t2.gpkg", layer: "t" } },
      "EPSG:3857",
    );
    expect(loadGpkg).toHaveBeenCalledWith(
      "https://b-us-east-1-x.s3.us-east-1.amazonaws.com/t2.gpkg",
      "EPSG:3857",
    );
  });

  test("rejects when the url is missing", async () => {
    await expect(
      loadGeoPackage({ props: { layer: "t" } }, "EPSG:3857"),
    ).rejects.toThrow(GeoPackageError);
    expect(loadGpkg).not.toHaveBeenCalled();
  });

  test("rejects when the table name is missing", async () => {
    await expect(
      loadGeoPackage({ props: { url: "https://h/t3.gpkg" } }, "EPSG:3857"),
    ).rejects.toThrow(GeoPackageError);
  });

  test("rejects an unknown table, listing the available ones", async () => {
    loadGpkg.mockResolvedValue([
      { roads: new VectorSource(), bldgs: new VectorSource() },
      {},
    ]);
    await expect(
      loadGeoPackage(
        { props: { url: "https://h/t4.gpkg", layer: "nope" } },
        "EPSG:3857",
      ),
    ).rejects.toThrow(/roads|bldgs/);
  });

  test("parses a file only once across layers (cache by url+projection)", async () => {
    loadGpkg.mockResolvedValue([{ t: new VectorSource() }, {}]);
    const cfg = { props: { url: "https://h/t5.gpkg", layer: "t" } };
    await loadGeoPackage(cfg, "EPSG:3857");
    await loadGeoPackage(cfg, "EPSG:3857");
    expect(loadGpkg).toHaveBeenCalledTimes(1);
  });

  test("does not cache a failed load", async () => {
    loadGpkg
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue([{ t: new VectorSource() }, {}]);
    const cfg = { props: { url: "https://h/t6.gpkg", layer: "t" } };
    await expect(loadGeoPackage(cfg, "EPSG:3857")).rejects.toThrow("boom");
    const out = await loadGeoPackage(cfg, "EPSG:3857");
    expect(out).toBeInstanceOf(VectorSource);
    expect(loadGpkg).toHaveBeenCalledTimes(2);
  });

  test("caches separately per display projection", async () => {
    loadGpkg.mockResolvedValue([{ t: new VectorSource() }, {}]);
    const cfg = { props: { url: "https://h/t7.gpkg", layer: "t" } };
    await loadGeoPackage(cfg, "EPSG:3857");
    await loadGeoPackage(cfg, "EPSG:4326");
    expect(loadGpkg).toHaveBeenCalledTimes(2);
  });

  test("moduleLoader routes a GeoPackage config to loadGeoPackage", async () => {
    const src = new VectorSource();
    loadGpkg.mockResolvedValue([{ roads: src }, {}]);
    const out = await moduleLoader(
      {
        type: "GeoPackage",
        props: { url: "https://h/t8.gpkg", layer: "roads" },
      },
      "EPSG:3857",
    );
    expect(out).toBe(src);
  });
});

describe("matchesCondition — a field the feature does not carry", () => {
  // Left unguarded, the negated operators invert into a match: `!=` becomes
  // `undefined !== x` and `notIn` becomes "not in the list", both true. One
  // saved rule then repaints every feature of a layer whose .dbf is missing or
  // whose schema drifted upstream -- and the layer still renders, so nothing
  // fails and nobody is told.
  it.each([
    ["=", "x"],
    ["!=", "x"],
    ["<", 5],
    ["<=", 5],
    [">", 5],
    [">=", 5],
    ["in", "a,b,c"],
    ["notIn", "a,b,c"],
  ])("does not match %s", (operator, conditionValue) => {
    expect(matchesCondition(undefined, operator, conditionValue)).toBe(false);
    expect(matchesCondition(null, operator, conditionValue)).toBe(false);
  });

  it("still answers the presence checks, which are about absence itself", () => {
    // These deliberately run before the guard: asking whether an absent field is
    // null has a real answer, and a rule styling "no data" depends on it.
    expect(matchesCondition(undefined, "isNull", null)).toBe(true);
    expect(matchesCondition(null, "isNull", null)).toBe(true);
    expect(matchesCondition(undefined, "isNotNull", null)).toBe(false);
  });

  it("leaves an empty string as a present value", () => {
    // "" is something the feature carries, so a comparison against it is
    // meaningful rather than unanswerable.
    expect(matchesCondition("", "isNull", null)).toBe(true);
    expect(matchesCondition("", "!=", "x")).toBe(true);
    expect(matchesCondition("", "=", "")).toBe(true);
  });

  it("leaves present-value comparisons untouched", () => {
    // Regression cover: this function styles every vector layer in the app, so
    // the guard must change nothing for a field that is actually there.
    expect(matchesCondition("x", "=", "x")).toBe(true);
    expect(matchesCondition("x", "!=", "y")).toBe(true);
    expect(matchesCondition("x", "!=", "x")).toBe(false);
    expect(matchesCondition(3, "<", 5)).toBe(true);
    expect(matchesCondition(3, ">", 5)).toBe(false);
    expect(matchesCondition(0, "=", 0)).toBe(true);
    expect(matchesCondition(0, "!=", 1)).toBe(true);
    expect(matchesCondition("b", "in", "a,b,c")).toBe(true);
    expect(matchesCondition("d", "in", "a,b,c")).toBe(false);
    expect(matchesCondition("d", "notIn", "a,b,c")).toBe(true);
    expect(matchesCondition("b", "notIn", "a,b,c")).toBe(false);
  });

  it("does not repaint a whole layer through a negated rule", () => {
    // The observable consequence, stated as a scenario: a layer whose features
    // lack POP2020 and a saved rule of `POP2020 != 0`.
    const features = [{}, {}, {}].map(() => ({ POP2020: undefined }));
    const matched = features.filter((f) =>
      matchesCondition(f.POP2020, "!=", 0),
    );
    expect(matched).toHaveLength(0);
  });
});

describe("geoParquetCRSToProjection", () => {
  test("treats null/undefined CRS as WGS84 (spec default)", () => {
    expect(geoParquetCRSToProjection(null)).toBe("EPSG:4326");
    expect(geoParquetCRSToProjection(undefined)).toBe("EPSG:4326");
  });

  test("resolves a PROJJSON id to its projection code", () => {
    expect(
      geoParquetCRSToProjection({ id: { authority: "EPSG", code: 3857 } }),
    ).toBe("EPSG:3857");
  });

  test("falls back to the first entry of an ids array", () => {
    expect(
      geoParquetCRSToProjection({ ids: [{ authority: "EPSG", code: 32615 }] }),
    ).toBe("EPSG:32615");
  });
});

describe("readGeoParquetGeoMetadata", () => {
  test("defaults to 'geometry' + WGS84 when there is no geo key", () => {
    expect(readGeoParquetGeoMetadata({})).toEqual({
      geometryColumn: "geometry",
      dataProjection: "EPSG:4326",
    });
  });

  test("reads primary_column and its CRS from the geo metadata", () => {
    const geo = JSON.stringify({
      primary_column: "geom",
      columns: {
        geom: {
          encoding: "WKB",
          crs: { id: { authority: "EPSG", code: 32615 } },
        },
      },
    });
    const meta = { key_value_metadata: [{ key: "geo", value: geo }] };
    expect(readGeoParquetGeoMetadata(meta)).toEqual({
      geometryColumn: "geom",
      dataProjection: "EPSG:32615",
      bboxColumn: null, // this file declares no GeoParquet 1.1 covering
    });
  });
});

describe("loadGeoParquet", () => {
  const pointRows = [
    { geometry: { type: "Point", coordinates: [-100, 40] }, name: "A" },
    { geometry: { type: "Point", coordinates: [-90, 35] }, name: "B" },
  ];
  const noGeoMeta = { key_value_metadata: undefined };

  beforeEach(() => {
    clearClientSourceCaches();
  });

  test("reads a GeoParquet file into an OL VectorSource of features", async () => {
    asyncBufferFromUrl.mockResolvedValue({});
    parquetMetadataAsync.mockResolvedValue(noGeoMeta);
    parquetReadObjects.mockResolvedValue(pointRows);

    const source = await loadGeoParquet(
      { type: "GeoParquet", props: { url: "https://x/data.parquet" } },
      "EPSG:3857",
    );
    expect(source).toBeInstanceOf(VectorSource);
    const features = source.getFeatures();
    expect(features).toHaveLength(2);
    expect(features[0].get("name")).toBe("A");
    expect(features[0].getGeometry().getType()).toBe("Point");
    // -100 lon in EPSG:3857 is a large negative metre value: reprojection ran.
    expect(features[0].getGeometry().getCoordinates()[0]).toBeCloseTo(
      -11131949.08,
      0,
    );
  });

  test("passes the extended codecs and geoparquet flag to the reader", async () => {
    asyncBufferFromUrl.mockResolvedValue({});
    parquetMetadataAsync.mockResolvedValue(noGeoMeta);
    parquetReadObjects.mockResolvedValue([]);

    await loadGeoParquet(
      { type: "GeoParquet", props: { url: "https://x/data.parquet" } },
      "EPSG:3857",
    );
    expect(parquetReadObjects).toHaveBeenCalledWith(
      expect.objectContaining({
        compressors: { __mock: true },
        geoparquet: true,
      }),
    );
  });

  test("coerces BigInt property values to Number", async () => {
    asyncBufferFromUrl.mockResolvedValue({});
    parquetMetadataAsync.mockResolvedValue(noGeoMeta);
    parquetReadObjects.mockResolvedValue([
      { geometry: { type: "Point", coordinates: [0, 0] }, id: 42n },
    ]);
    const source = await loadGeoParquet(
      { type: "GeoParquet", props: { url: "https://x/d.parquet" } },
      "EPSG:3857",
    );
    expect(source.getFeatures()[0].get("id")).toBe(42);
  });

  test("drops rows with no geometry", async () => {
    asyncBufferFromUrl.mockResolvedValue({});
    parquetMetadataAsync.mockResolvedValue(noGeoMeta);
    parquetReadObjects.mockResolvedValue([
      { geometry: { type: "Point", coordinates: [0, 0] }, name: "keep" },
      { geometry: null, name: "drop" },
    ]);
    const source = await loadGeoParquet(
      { type: "GeoParquet", props: { url: "https://x/d.parquet" } },
      "EPSG:3857",
    );
    expect(source.getFeatures()).toHaveLength(1);
    expect(source.getFeatures()[0].get("name")).toBe("keep");
  });

  test("uses the primary geometry column from geo metadata", async () => {
    asyncBufferFromUrl.mockResolvedValue({});
    parquetMetadataAsync.mockResolvedValue({
      key_value_metadata: [
        {
          key: "geo",
          value: JSON.stringify({
            primary_column: "geom",
            columns: { geom: { encoding: "WKB", crs: null } },
          }),
        },
      ],
    });
    parquetReadObjects.mockResolvedValue([
      { geom: { type: "Point", coordinates: [0, 0] }, name: "A" },
    ]);
    const source = await loadGeoParquet(
      { type: "GeoParquet", props: { url: "https://x/d.parquet" } },
      "EPSG:3857",
    );
    expect(source.getFeatures()).toHaveLength(1);
    expect(source.getFeatures()[0].getGeometry().getType()).toBe("Point");
  });

  test("translates an s3:// url before fetching", async () => {
    asyncBufferFromUrl.mockResolvedValue({});
    parquetMetadataAsync.mockResolvedValue(noGeoMeta);
    parquetReadObjects.mockResolvedValue([]);
    await loadGeoParquet(
      { type: "GeoParquet", props: { url: "s3://b-us-east-1-x/d.parquet" } },
      "EPSG:3857",
    );
    expect(asyncBufferFromUrl).toHaveBeenCalledWith({
      url: "https://b-us-east-1-x.s3.us-east-1.amazonaws.com/d.parquet",
    });
  });

  test("rejects a missing url without touching the network", async () => {
    await expect(
      loadGeoParquet({ type: "GeoParquet", props: {} }, "EPSG:3857"),
    ).rejects.toThrow(GeoParquetError);
    expect(asyncBufferFromUrl).not.toHaveBeenCalled();
  });

  test("moduleLoader routes a GeoParquet config to loadGeoParquet", async () => {
    asyncBufferFromUrl.mockResolvedValue({});
    parquetMetadataAsync.mockResolvedValue(noGeoMeta);
    parquetReadObjects.mockResolvedValue([
      { geometry: { type: "Point", coordinates: [0, 0] }, name: "A" },
    ]);
    const source = await moduleLoader(
      { type: "GeoParquet", props: { url: "https://x/d.parquet" } },
      "EPSG:3857",
    );
    expect(source).toBeInstanceOf(VectorSource);
    expect(source.getFeatures()).toHaveLength(1);
  });
});

describe("geoParquetCRSToProjection - CRS84 aliases", () => {
  // GeoParquet's spec default is OGC:CRS84. OpenLayers registers "CRS:84" and
  // the urn:/http: URI forms but not the bare "OGC:CRS84" that
  // `${authority}:${code}` assembles, and readFeatures treats an unresolvable
  // dataProjection as "no transform" -- silently drawing lon/lat as if it were
  // the view's own units. Every spelling must land on a code OL can resolve.
  test.each([
    [{ id: { authority: "OGC", code: "CRS84" } }, "OGC:CRS84 via id"],
    [{ ids: [{ authority: "OGC", code: "CRS84" }] }, "OGC:CRS84 via ids"],
    [{ id: { authority: "CRS", code: "84" } }, "CRS:84"],
    [{ id: { authority: "ogc", code: "crs84" } }, "lowercased"],
  ])("normalizes %#: %s to EPSG:4326", (crs) => {
    expect(geoParquetCRSToProjection(crs)).toBe("EPSG:4326");
  });

  test("the normalized code is one OpenLayers can actually resolve", () => {
    const code = geoParquetCRSToProjection({
      id: { authority: "OGC", code: "CRS84" },
    });
    expect(getProjection(code)).not.toBeNull();
  });

  test("leaves a real authority code untouched", () => {
    expect(
      geoParquetCRSToProjection({ id: { authority: "EPSG", code: 32615 } }),
    ).toBe("EPSG:32615");
  });
});

describe("coerceParquetValue", () => {
  test("converts a safe BigInt to a Number", () => {
    expect(coerceParquetValue(42n)).toBe(42);
    expect(typeof coerceParquetValue(42n)).toBe("number");
  });

  test("keeps a BigInt beyond the safe range exact by stringifying it", () => {
    // 2^53 + 1 is the smallest integer Number cannot represent; rounding it
    // would silently corrupt 64-bit ids (OSM, H3, snowflake).
    const big = 9007199254740993n;
    expect(coerceParquetValue(big)).toBe("9007199254740993");
  });

  test("walks arrays and nested plain objects", () => {
    expect(coerceParquetValue([1n, [2n, { a: 3n }]])).toEqual([
      1,
      [2, { a: 3 }],
    ]);
    expect(coerceParquetValue({ outer: { inner: 7n } })).toEqual({
      outer: { inner: 7 },
    });
  });

  test("leaves non-BigInt values, including Dates, alone", () => {
    const d = new Date(0);
    expect(coerceParquetValue(d)).toBe(d);
    expect(coerceParquetValue("x")).toBe("x");
    expect(coerceParquetValue(null)).toBeNull();
  });

  test("the coerced result survives a JSON round-trip", () => {
    // This is the whole point: the popup and variable-input paths JSON
    // round-trip feature properties, which throws on a raw BigInt.
    expect(() =>
      JSON.stringify(coerceParquetValue({ id: 12n, tags: [3n] })),
    ).not.toThrow();
  });
});

describe("loadGeoParquet - review findings", () => {
  const rows = [{ geometry: { type: "Point", coordinates: [-100, 40] }, n: 1 }];
  const geoMeta = (crs) => ({
    key_value_metadata: [
      {
        key: "geo",
        value: JSON.stringify({
          primary_column: "geometry",
          columns: { geometry: { crs } },
        }),
      },
    ],
  });

  beforeEach(() => {
    clearClientSourceCaches();
    asyncBufferFromUrl.mockReset().mockResolvedValue({});
    parquetMetadataAsync.mockReset().mockResolvedValue(geoMeta(null));
    parquetReadObjects.mockReset().mockResolvedValue(rows);
  });

  test("reads the file once and serves later layers from the cache", async () => {
    const cfg = { props: { url: "https://x/a.parquet" } };
    await loadGeoParquet(cfg, "EPSG:3857");
    await loadGeoParquet(cfg, "EPSG:3857");

    expect(asyncBufferFromUrl).toHaveBeenCalledTimes(1);
    expect(parquetReadObjects).toHaveBeenCalledTimes(1);
  });

  test("gives each layer its own VectorSource and Feature instances", async () => {
    const cfg = { props: { url: "https://x/a.parquet" } };
    const a = await loadGeoParquet(cfg, "EPSG:3857");
    const b = await loadGeoParquet(cfg, "EPSG:3857");

    expect(a).not.toBe(b);
    // Sharing Feature objects across sources would leak selection/style state.
    expect(a.getFeatures()[0]).not.toBe(b.getFeatures()[0]);
  });

  test("re-reads after a failure instead of caching the rejection", async () => {
    asyncBufferFromUrl.mockRejectedValueOnce(new Error("boom"));
    const cfg = { props: { url: "https://x/flaky.parquet" } };

    await expect(loadGeoParquet(cfg, "EPSG:3857")).rejects.toThrow(
      GeoParquetError,
    );
    const source = await loadGeoParquet(cfg, "EPSG:3857");
    expect(source).toBeInstanceOf(VectorSource);
  });

  test("wraps a read failure with a CORS hint", async () => {
    asyncBufferFromUrl.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(
      loadGeoParquet({ props: { url: "https://x/a.parquet" } }, "EPSG:3857"),
    ).rejects.toThrow(/Access-Control-Allow-Origin/);
  });

  test("rejects a file whose declared CRS is not registered", async () => {
    parquetMetadataAsync.mockResolvedValue(
      geoMeta({ id: { authority: "EPSG", code: 999999 } }),
    );
    await expect(
      loadGeoParquet({ props: { url: "https://x/odd.parquet" } }, "EPSG:3857"),
    ).rejects.toThrow(/not registered/);
  });

  test("renders a CRS84 file at its real coordinates, not raw lon/lat", async () => {
    parquetMetadataAsync.mockResolvedValue(
      geoMeta({ id: { authority: "OGC", code: "CRS84" } }),
    );
    const source = await loadGeoParquet(
      { props: { url: "https://x/crs84.parquet" } },
      "EPSG:3857",
    );
    const [x, y] = source.getFeatures()[0].getGeometry().getCoordinates();
    // -100,40 reprojected into Web Mercator, not passed through untransformed.
    expect(x).toBeCloseTo(-11131949.08, 0);
    expect(y).toBeCloseTo(4865942.28, 0);
  });

  test("drops a residual 'geometry' property so it cannot clobber the geometry", async () => {
    parquetMetadataAsync.mockResolvedValue({
      key_value_metadata: [
        {
          key: "geo",
          value: JSON.stringify({
            primary_column: "geom",
            columns: { geom: { crs: null } },
          }),
        },
      ],
    });
    parquetReadObjects.mockResolvedValue([
      {
        geom: { type: "Point", coordinates: [-100, 40] },
        geometry: "not a geometry",
        n: 1,
      },
    ]);
    const source = await loadGeoParquet(
      { props: { url: "https://x/g.parquet" } },
      "EPSG:4326",
    );
    const feature = source.getFeatures()[0];
    expect(feature.getGeometry().getCoordinates()).toEqual([-100, 40]);
    // OL keeps the geometry under the default geometry name, so "geometry"
    // must still hold the Geometry -- not the string column that shared its
    // name (ol/format/GeoJSON applies properties after setGeometry).
    expect(feature.get("geometry")).toBe(feature.getGeometry());
  });

  test("coerces BigInt columns so the popup's JSON round-trip cannot throw", async () => {
    parquetReadObjects.mockResolvedValue([
      {
        geometry: { type: "Point", coordinates: [-100, 40] },
        id: 9007199254740993n,
        nested: { code: 5n },
      },
    ]);
    const source = await loadGeoParquet(
      { props: { url: "https://x/b.parquet" } },
      "EPSG:4326",
    );
    const props = source.getFeatures()[0].getProperties();
    expect(props.id).toBe("9007199254740993");
    expect(props.nested).toEqual({ code: 5 });
    expect(() => JSON.stringify(props.nested)).not.toThrow();
  });
});

describe("loadZarr - review findings", () => {
  const slice = (over = {}) => ({
    width: 5,
    height: 4,
    extent: [-100, 180, -75, 200],
    pixelSize: { x: 5, y: 5 },
    crs: "EPSG:3857",
    data: new Float32Array(40),
    min: 0,
    max: 18,
    ...over,
  });
  const cfg = (props = {}) => ({
    type: "Zarr",
    props: {
      url: "https://x/store.zarr",
      variable: "depth",
      index: "0",
      ...props,
    },
  });

  beforeEach(() => {
    clearClientSourceCaches();
    readSlice.mockReset();
    readSlice.mockResolvedValue(slice());
  });

  test("re-reads after a failed slice instead of caching the rejection", async () => {
    // A transient CORS/network blip must not pin the layer to that error for
    // the life of the page.
    readSlice.mockRejectedValueOnce(new Error("Failed to fetch"));

    await expect(loadZarr(cfg(), "EPSG:3857")).rejects.toThrow(ZarrError);
    const source = await loadZarr(cfg(), "EPSG:3857");

    expect(source).toBeInstanceOf(DataTile);
    expect(readSlice).toHaveBeenCalledTimes(2);
  });

  test("serves a repeated slice from the cache across separate config objects", async () => {
    // Variable-input changes rebuild the config, so a memo held on the source
    // object would never survive to serve a revisited slice.
    await loadZarr(cfg(), "EPSG:3857");
    await loadZarr(cfg(), "EPSG:3857");
    expect(readSlice).toHaveBeenCalledTimes(1);
  });

  test("wraps a read failure with a CORS hint naming the store", async () => {
    readSlice.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(loadZarr(cfg(), "EPSG:3857")).rejects.toThrow(
      /Access-Control-Allow-Origin/,
    );
  });

  test("translates an s3:// store URL to its public https form", async () => {
    await loadZarr(cfg({ url: "s3://bucket/store.zarr" }), "EPSG:3857");
    expect(readSlice).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://bucket.s3.us-east-1.amazonaws.com/store.zarr",
      }),
    );
  });

  test("rejects a store whose crs attr is not a registered projection", async () => {
    readSlice.mockResolvedValue(slice({ crs: "EPSG:999999" }));
    await expect(loadZarr(cfg(), "EPSG:3857")).rejects.toThrow(
      /not registered/,
    );
  });

  test("falls back to the map projection when the store declares no crs", async () => {
    readSlice.mockResolvedValue(slice({ crs: undefined }));
    const source = await loadZarr(cfg(), "EPSG:3857");
    expect((await source.getView()).projection).toBe("EPSG:3857");
  });

  test("rejects a grid too large to upload as a single WebGL texture", async () => {
    // The whole slice is one tile, so an oversized grid fails the texture
    // upload and renders blank with no error unless it is caught here.
    readSlice.mockResolvedValue(slice({ width: 40000, height: 40000 }));
    await expect(loadZarr(cfg(), "EPSG:3857")).rejects.toThrow(
      /exceeds this browser's maximum texture size/,
    );
  });

  test("rejects non-square cells rather than drawing them stretched", async () => {
    readSlice.mockResolvedValue(slice({ pixelSize: { x: 5, y: 12 } }));
    await expect(loadZarr(cfg(), "EPSG:3857")).rejects.toThrow(
      /non-square cells/,
    );
  });

  test("tolerates float rounding in the pixel sizes", async () => {
    readSlice.mockResolvedValue(
      slice({ pixelSize: { x: 5, y: 5.0000000001 } }),
    );
    await expect(loadZarr(cfg(), "EPSG:3857")).resolves.toBeInstanceOf(
      DataTile,
    );
  });

  test("treats the string 'false' from a GUI field as false", async () => {
    const source = await loadZarr(cfg({ interpolate: "false" }), "EPSG:3857");
    expect(source.interpolate_ ?? source.getInterpolate?.()).toBe(false);
  });

  test("treats the string 'true' from a GUI field as true", async () => {
    const source = await loadZarr(cfg({ interpolate: "true" }), "EPSG:3857");
    expect(source.interpolate_ ?? source.getInterpolate?.()).toBe(true);
  });
});

describe("applyZarrRamp - review findings", () => {
  const rampLayer = (source = {}) => ({
    type: "WebGLTile",
    props: {
      name: "flood",
      source: {
        type: "Zarr",
        rampName: "turbo",
        props: { url: "https://x/store.zarr", variable: "depth", index: "7" },
        ...source,
      },
    },
  });

  beforeEach(() => {
    clearClientSourceCaches();
    readSlice.mockReset();
    readSlice.mockResolvedValue({
      width: 2,
      height: 2,
      extent: [0, 0, 10, 10],
      pixelSize: { x: 5, y: 5 },
      crs: "EPSG:3857",
      data: new Float32Array(8),
      min: 3,
      max: 3, // uniform slice -> degenerate range
    });
  });

  test("widens a degenerate range so the ramp cannot divide by zero", async () => {
    // Equal stops compile to an interpolate whose GPU form divides by
    // (stop2 - stop1), yielding NaN colors.
    const config = await applyAutoRamp(rampLayer());
    const source = config.props.source;

    expect(source.resolvedRampMax).toBeGreaterThan(source.resolvedRampMin);
    expect(JSON.stringify(config.style.color)).not.toMatch(/null|NaN/);
  });

  test("widens an inverted author-pinned range", async () => {
    const config = await applyAutoRamp(
      rampLayer({ rampMin: "100", rampMax: "10" }),
    );
    const source = config.props.source;
    expect(source.resolvedRampMax).toBeGreaterThan(source.resolvedRampMin);
  });

  test("rebuilds the style when the ramp changes but the slice does not", async () => {
    // The gate keys on the slice, so a ramp-only edit must still restyle.
    const first = await applyAutoRamp(rampLayer({ rampName: "turbo" }));
    const firstColor = JSON.stringify(first.style.color);

    const second = await applyAutoRamp(rampLayer({ rampName: "viridis" }));
    expect(JSON.stringify(second.style.color)).not.toEqual(firstColor);
  });
});

describe("GeoParquet read-narrowing helpers", () => {
  const covering = {
    bbox: {
      xmin: ["bbox", "xmin"],
      ymin: ["bbox", "ymin"],
      xmax: ["bbox", "xmax"],
      ymax: ["bbox", "ymax"],
    },
  };

  test("reads GeoParquet 1.1 covering paths as dotted filter paths", () => {
    expect(readCoveringBBoxPaths(covering)).toEqual({
      xmin: "bbox.xmin",
      ymin: "bbox.ymin",
      xmax: "bbox.xmax",
      ymax: "bbox.ymax",
    });
  });

  test("returns null when the file declares no usable covering", () => {
    expect(readCoveringBBoxPaths(undefined)).toBeNull();
    expect(readCoveringBBoxPaths({})).toBeNull();
    expect(readCoveringBBoxPaths({ bbox: { xmin: ["bbox", "xmin"] } })).toBeNull();
  });

  test("parses a bbox and rejects malformed or inverted input", () => {
    expect(parseBBox("-105.4,39.9,-105.1,40.15")).toEqual({
      minx: -105.4,
      miny: 39.9,
      maxx: -105.1,
      maxy: 40.15,
    });
    expect(parseBBox("")).toBeNull();
    expect(parseBBox(undefined)).toBeNull();
    expect(() => parseBBox("1,2,3")).toThrow(GeoParquetError);
    expect(() => parseBBox("a,b,c,d")).toThrow(/four comma-separated numbers/);
    expect(() => parseBBox("10,10,0,0")).toThrow(/inverted/);
  });

  test("builds an intersection filter, not a containment one", () => {
    const filter = bboxIntersectsFilter(readCoveringBBoxPaths(covering), {
      minx: 0,
      miny: 0,
      maxx: 10,
      maxy: 10,
    });
    // Overlap holds unless one box is strictly beyond the other on some axis.
    expect(filter).toEqual({
      $and: [
        { "bbox.xmin": { $lte: 10 } },
        { "bbox.xmax": { $gte: 0 } },
        { "bbox.ymin": { $lte: 10 } },
        { "bbox.ymax": { $gte: 0 } },
      ],
    });
  });

  test("resolveReadColumns keeps geometry and adds the filter's own columns", () => {
    expect(
      resolveReadColumns({
        columns: "name, city",
        geometryColumn: "geometry",
        bboxColumn: readCoveringBBoxPaths(covering),
        usingBBoxFilter: true,
      }),
    ).toEqual(["geometry", "name", "city", "bbox"]);
  });

  test("resolveReadColumns means 'all columns' when none are requested", () => {
    expect(
      resolveReadColumns({ columns: "", geometryColumn: "geometry" }),
    ).toBeUndefined();
    expect(
      resolveReadColumns({ columns: "  ,  ", geometryColumn: "geometry" }),
    ).toBeUndefined();
  });

  test("geometryIntersectsBBox covers points, lines and collections", () => {
    const box = { minx: 0, miny: 0, maxx: 10, maxy: 10 };
    const pt = (x, y) => ({ type: "Point", coordinates: [x, y] });
    expect(geometryIntersectsBBox(pt(5, 5), box)).toBe(true);
    expect(geometryIntersectsBBox(pt(50, 5), box)).toBe(false);
    expect(
      geometryIntersectsBBox(
        { type: "LineString", coordinates: [[-5, 5], [50, 5]] },
        box,
      ),
    ).toBe(true); // crosses the box even though no vertex is inside
    expect(
      geometryIntersectsBBox(
        { type: "GeometryCollection", geometries: [pt(50, 50), pt(1, 1)] },
        box,
      ),
    ).toBe(true);
  });
});

describe("loadGeoParquet - narrowing what is read", () => {
  const rows = [
    {
      geometry: { type: "Point", coordinates: [-105.27, 40.02] },
      bbox: { xmin: -105.27, ymin: 40.02, xmax: -105.27, ymax: 40.02 },
      name: "boulder",
    },
    {
      geometry: { type: "Point", coordinates: [-74.0, 40.71] },
      bbox: { xmin: -74.0, ymin: 40.71, xmax: -74.0, ymax: 40.71 },
      name: "nyc",
    },
  ];
  const metaWithCovering = {
    key_value_metadata: [
      {
        key: "geo",
        value: JSON.stringify({
          primary_column: "geometry",
          columns: {
            geometry: {
              crs: null,
              covering: {
                bbox: {
                  xmin: ["bbox", "xmin"],
                  ymin: ["bbox", "ymin"],
                  xmax: ["bbox", "xmax"],
                  ymax: ["bbox", "ymax"],
                },
              },
            },
          },
        }),
      },
    ],
  };
  const metaNoCovering = { key_value_metadata: undefined };

  beforeEach(() => {
    clearClientSourceCaches();
    asyncBufferFromUrl.mockReset().mockResolvedValue({});
    parquetMetadataAsync.mockReset().mockResolvedValue(metaWithCovering);
    parquetReadObjects.mockReset().mockResolvedValue(rows);
  });

  test("reads every column by default", async () => {
    await loadGeoParquet({ props: { url: "https://x/a.parquet" } }, "EPSG:4326");
    expect(parquetReadObjects).toHaveBeenCalledWith(
      expect.not.objectContaining({ columns: expect.anything() }),
    );
  });

  test("passes an author's column list through, always keeping geometry", async () => {
    await loadGeoParquet(
      { props: { url: "https://x/a.parquet", columns: "name" } },
      "EPSG:4326",
    );
    expect(parquetReadObjects).toHaveBeenCalledWith(
      expect.objectContaining({ columns: ["geometry", "name"] }),
    );
  });

  test("pushes a bbox down as a row-group filter when the file has a covering", async () => {
    await loadGeoParquet(
      {
        props: {
          url: "https://x/a.parquet",
          bbox: "-105.4,39.9,-105.1,40.15",
        },
      },
      "EPSG:4326",
    );
    const opts = parquetReadObjects.mock.calls[0][0];
    expect(opts.filter).toEqual({
      $and: [
        { "bbox.xmin": { $lte: -105.1 } },
        { "bbox.xmax": { $gte: -105.4 } },
        { "bbox.ymin": { $lte: 40.15 } },
        { "bbox.ymax": { $gte: 39.9 } },
      ],
    });
    expect(opts.usePageIndex).toBe(true);
  });

  test("keeps the bbox columns readable when pruning columns alongside a filter", async () => {
    await loadGeoParquet(
      {
        props: {
          url: "https://x/a.parquet",
          columns: "name",
          bbox: "-105.4,39.9,-105.1,40.15",
        },
      },
      "EPSG:4326",
    );
    expect(parquetReadObjects).toHaveBeenCalledWith(
      expect.objectContaining({ columns: ["geometry", "name", "bbox"] }),
    );
  });

  test("hides the covering bbox column from feature properties", async () => {
    const source = await loadGeoParquet(
      { props: { url: "https://x/a.parquet" } },
      "EPSG:4326",
    );
    // The popup renders every property it is given, so plumbing must not leak.
    expect(source.getFeatures()[0].get("bbox")).toBeUndefined();
    expect(source.getFeatures()[0].get("name")).toBe("boulder");
  });

  test("filters on decoded geometry when the file has no covering column", async () => {
    parquetMetadataAsync.mockResolvedValue(metaNoCovering);
    const source = await loadGeoParquet(
      {
        props: {
          url: "https://x/plain.parquet",
          bbox: "-105.4,39.9,-105.1,40.15",
        },
      },
      "EPSG:4326",
    );
    // No pushdown available, but the visible result must still be the box.
    expect(parquetReadObjects.mock.calls[0][0].filter).toBeUndefined();
    expect(source.getFeatures()).toHaveLength(1);
    expect(source.getFeatures()[0].get("name")).toBe("boulder");
  });

  test("caps the read with maxFeatures", async () => {
    await loadGeoParquet(
      { props: { url: "https://x/a.parquet", maxFeatures: "500" } },
      "EPSG:4326",
    );
    expect(parquetReadObjects).toHaveBeenCalledWith(
      expect.objectContaining({ rowStart: 0, rowEnd: 500 }),
    );
  });

  test("caches per read-option set, not per URL", async () => {
    const url = "https://x/a.parquet";
    await loadGeoParquet({ props: { url } }, "EPSG:4326");
    await loadGeoParquet({ props: { url, columns: "name" } }, "EPSG:4326");
    // Different columns means a different result, so it cannot reuse the entry.
    expect(parquetReadObjects).toHaveBeenCalledTimes(2);

    await loadGeoParquet({ props: { url, columns: "name" } }, "EPSG:4326");
    expect(parquetReadObjects).toHaveBeenCalledTimes(2);
  });

  test("surfaces a malformed bbox as a GeoParquet error", async () => {
    await expect(
      loadGeoParquet(
        { props: { url: "https://x/a.parquet", bbox: "1,2,3" } },
        "EPSG:4326",
      ),
    ).rejects.toThrow(/four comma-separated numbers/);
  });
});
