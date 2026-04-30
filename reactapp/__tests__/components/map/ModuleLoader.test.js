import moduleLoader, {
  createJsonStyleFunction,
  matchesCondition,
  resolveSize,
  buildPointStyle,
  getGeometryBucket,
  loadESRIJSON,
  buildPolygonFill,
} from "components/map/ModuleLoader";
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
  const geoTIFFLayerConfig = () => ({
    type: "WebGLTile",
    props: {
      name: "GeoTIFF Layer",
      source: {
        type: "GeoTIFF",
        props: {
          sources: [
            {
              url: "https://example.com/cog.tif",
              bands: "1,2,3",
              min: "0",
              max: "255",
              nodata: "0",
            },
          ],
        },
      },
      zIndex: 0,
    },
  });

  test("GeoTIFF type resolves to the ol/source/GeoTIFF module", async () => {
    const config = geoTIFFLayerConfig();
    const layerInstance = await moduleLoader(config);
    expect(layerInstance instanceof WebGLTile).toBe(true);
    expect(GeoTIFF.constructorSpy).toHaveBeenCalled();
  });

  test("GeoTIFF sources array passes through to constructor", async () => {
    const config = geoTIFFLayerConfig();
    // Drop bands so this test focuses on plain URL + numeric string pass-through.
    config.props.source.props.sources = [
      { url: "https://example.com/a.tif", min: "0", max: "255" },
    ];
    await moduleLoader(config);
    const calls = GeoTIFF.constructorSpy.mock.calls;
    const callArgs = calls[calls.length - 1][0];
    expect(Array.isArray(callArgs.sources)).toBe(true);
    expect(callArgs.sources).toHaveLength(1);
    expect(callArgs.sources[0].url).toBe("https://example.com/a.tif");
    // numeric strings should be cast by convertType before hitting the ctor
    expect(callArgs.sources[0].min).toBe(0);
    expect(callArgs.sources[0].max).toBe(255);
  });

  test("GeoTIFF bands CSV string is parsed to a number array", async () => {
    const config = geoTIFFLayerConfig();
    config.props.source.props.sources = [
      { url: "https://example.com/b.tif", bands: "1,2,3" },
    ];
    await moduleLoader(config);
    const calls = GeoTIFF.constructorSpy.mock.calls;
    const callArgs = calls[calls.length - 1][0];
    expect(callArgs.sources[0].bands).toEqual([1, 2, 3]);
  });

  test("GeoTIFF empty bands string is dropped (not passed as [])", async () => {
    // Regression: `bands: ""` from the UI used to parse to `[]`, which tells
    // ol/source/GeoTIFF to read ZERO bands and throws
    // "Unsupported data format/bitsPerSample" at tile-decode time. Empty
    // bands must be dropped so OL falls back to reading all bands.
    const config = geoTIFFLayerConfig();
    config.props.source.props.sources = [
      { url: "https://example.com/c.tif", bands: "" },
    ];
    await moduleLoader(config);
    const calls = GeoTIFF.constructorSpy.mock.calls;
    const callArgs = calls[calls.length - 1][0];
    expect(callArgs.sources[0]).not.toHaveProperty("bands");
    expect(callArgs.sources[0].url).toBe("https://example.com/c.tif");
  });

  test("GeoTIFF empty projection and empty overviews are dropped", async () => {
    const config = geoTIFFLayerConfig();
    config.props.source.props.sources = [
      {
        url: "https://example.com/d.tif",
        projection: "",
        overviews: [],
      },
    ];
    await moduleLoader(config);
    const calls = GeoTIFF.constructorSpy.mock.calls;
    const callArgs = calls[calls.length - 1][0];
    expect(callArgs.sources[0]).not.toHaveProperty("projection");
    expect(callArgs.sources[0]).not.toHaveProperty("overviews");
  });

  test("GeoTIFF empty sources throws GeoTIFFEmptySources", async () => {
    const config = geoTIFFLayerConfig();
    config.props.source.props.sources = [];
    const callCountBefore = GeoTIFF.constructorSpy.mock.calls.length;
    await expect(moduleLoader(config)).rejects.toThrow("GeoTIFFEmptySources");
    // The GeoTIFF constructor must not have been invoked for this call.
    expect(GeoTIFF.constructorSpy.mock.calls.length).toBe(callCountBefore);
  });

  test("GeoTIFF minimum config (url only) instantiates", async () => {
    const config = geoTIFFLayerConfig();
    config.props.source.props.sources = [
      { url: "https://example.com/minimal.tif" },
    ];
    const layerInstance = await moduleLoader(config);
    expect(layerInstance instanceof WebGLTile).toBe(true);
    const calls = GeoTIFF.constructorSpy.mock.calls;
    const callArgs = calls[calls.length - 1][0];
    expect(callArgs.sources).toEqual([
      { url: "https://example.com/minimal.tif" },
    ]);
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
