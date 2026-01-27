import moduleLoader, {
  createJsonStyleFunction,
  matchesCondition,
  resolveSize,
  buildPointStyle,
  getGeometryBucket,
} from "components/map/ModuleLoader";
import WebGLTile from "ol/layer/WebGLTile.js";
import VectorTileLayer from "ol/layer/VectorTile.js";
import VectorLayer from "ol/layer/Vector.js";
import {
  layerConfigGeoJSON,
  layerConfigWebGLTile,
  layerConfigImageWMS,
  layerConfigVectorTile,
  layerConfigArcGISFeatureService,
} from "__tests__/utilities/constants";
import {
  Style,
  Circle as CircleStyle,
  RegularShape,
  Icon,
  Fill,
  Stroke,
} from "ol/style";

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

test("ArcGIS Feature Service Instance", async () => {
  const copiedConfig = {
    ...layerConfigArcGISFeatureService.configuration,
  };
  copiedConfig.props.source.props.params = {
    TIME: "2020-01-01T00:00:00.000Z,2020-12-31T23:59:59.000Z",
  };
  const layerInstance = await moduleLoader(copiedConfig);
  expect(layerInstance instanceof VectorLayer).toBe(true);

  const cachedLayerInstance = await moduleLoader(copiedConfig);
  expect(cachedLayerInstance instanceof VectorLayer).toBe(true);
});

test("Non Constructor Error", async () => {
  jest.mock("ol/layer/Image.js", () => "non function");
  await expect(moduleLoader(layerConfigImageWMS.configuration)).rejects.toThrow(
    "Module 'ImageLayer' does not export a constructor",
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

  it("returns a Style for a with empty string strokeDash", () => {
    const styleJson = {
      default: {
        linestring: { stroke: "#0000ff", strokeWidth: 2, strokeDash: "" },
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
});

describe("matchesCondition", () => {
  it("matches '=' condition", () => {
    expect(matchesCondition("test", "=", "test")).toBe(true);
    expect(matchesCondition("test", "=", "other")).toBe(false);
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
