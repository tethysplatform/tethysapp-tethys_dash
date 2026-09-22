// Tests for the JSON rule-style engine.
//
// Split out of ModuleLoader.test.js alongside the module itself, so the suite
// sits next to what it covers and the engine's coverage is attributed to a
// module no other suite mocks.
import {
  createJsonStyleFunction,
  matchesCondition,
  ruleMatches,
  resolveAllStyleValues,
  resolveSize,
  buildPointStyle,
  createTrapezoidIconStyle,
  createDiamondIconStyle,
  getGeometryBucket,
  buildPolygonFill,
  collectStyleFields,
} from "components/map/jsonStyle";
import {
  defaultFill,
  defaultSize,
  defaultHatchSpacing,
  defaultDotSpacing,
  defaultDotRadius,
  defaultStroke,
  defaultStrokeWidth,
} from "components/inputs/RuleEditor.js";
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

describe("the style function does not write into the style config", () => {
  // resolveSize matches on the flat conditionField/conditionType/conditionValue
  // triple alone, ignoring geometryType -- so a polygon rule can decide a point
  // feature's size. When no rule matches under ruleMatches, `merged` is still
  // the caller's own default object, so writing the resolved size into it
  // leaks that size onto every later feature that matches nothing.
  const styleWithDefaultsAndSizeRule = () => ({
    default: { point: { fill: "#0000ff", size: 10 } },
    rules: [
      {
        geometryType: "polygon",
        conditionField: "rank",
        conditionType: "=",
        conditionValue: 5,
        size: 20,
      },
    ],
  });

  it("leaves a later unmatched feature at the declared default size", () => {
    const styleFn = createJsonStyleFunction(styleWithDefaultsAndSizeRule());
    styleFn(mockFeature({ rank: 5 }));
    const unmatched = styleFn(mockFeature({ rank: 1 }));
    expect(unmatched.getImage().getRadius()).toBe(10);
  });

  it("leaves the style config itself untouched", () => {
    const styleJson = styleWithDefaultsAndSizeRule();
    const before = JSON.parse(JSON.stringify(styleJson));
    const styleFn = createJsonStyleFunction(styleJson);
    styleFn(mockFeature({ rank: 5 }));
    styleFn(mockFeature({ rank: 1 }));
    expect(styleJson).toEqual(before);
  });

  it("resolves a feature the same way whatever was styled before it", () => {
    const styleFn = createJsonStyleFunction(styleWithDefaultsAndSizeRule());
    const first = styleFn(mockFeature({ rank: 1 }))
      .getImage()
      .getRadius();
    styleFn(mockFeature({ rank: 5 }));
    const second = styleFn(mockFeature({ rank: 1 }))
      .getImage()
      .getRadius();
    expect(second).toBe(first);
  });

  it("still resolves propertyRefs declared on the defaults block", () => {
    const styleFn = createJsonStyleFunction({
      default: {
        point: { fill: "#000000", size: 7, propertyRefs: { fill: "color" } },
      },
    });
    expect(
      styleFn(mockFeature({ color: "#ff0000" }))
        .getImage()
        .getFill()
        .getColor(),
    ).toBe("#ff0000");
    expect(
      styleFn(mockFeature({ color: "#00ff00" }))
        .getImage()
        .getFill()
        .getColor(),
    ).toBe("#00ff00");
  });
});

describe("collectStyleFields", () => {
  it("takes a cross-bucket size rule's condition field", () => {
    // resolveSize ignores geometryType, so this polygon rule can decide a point
    // feature's size. Filtering the collection by bucket would drop "rank" and
    // two point features differing only in it would share the wrong size.
    expect(
      collectStyleFields({
        default: { point: { size: 10 } },
        rules: [
          {
            geometryType: "polygon",
            conditionField: "rank",
            conditionType: "=",
            conditionValue: 5,
            size: 20,
          },
        ],
      }),
    ).toEqual(["rank"]);
  });

  it("takes a condition field even when conditionType is absent", () => {
    expect(collectStyleFields({ rules: [{ conditionField: "kind" }] })).toEqual(
      ["kind"],
    );
  });

  it("takes the field named by a comparand, not the comparand itself", () => {
    expect(
      collectStyleFields({
        rules: [
          {
            conditionField: "a",
            conditionType: "=",
            conditionValue: "b",
            conditionValueIsField: true,
          },
          {
            conditions: [
              { field: "c", type: "=", value: "d", valueIsField: true },
              { field: "e", type: "=", value: "literal" },
            ],
          },
        ],
      }),
    ).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("takes propertyRefs targets from rules and from the geometry defaults", () => {
    expect(
      collectStyleFields({
        default: { point: { propertyRefs: { fill: "color" } } },
        rules: [{ conditionField: "t", propertyRefs: { rotation: "bearing" } }],
      }),
    ).toEqual(["color", "t", "bearing"]);
  });

  it("yields an empty list for a style that names nothing", () => {
    expect(
      collectStyleFields({ default: { point: { fill: "#fff" } } }),
    ).toEqual([]);
    expect(collectStyleFields({ rules: [] })).toEqual([]);
  });

  it("yields an empty list rather than throwing on a style it cannot read", () => {
    // What applyLayerStyle's catch actually hands over when applyStyle fails.
    expect(collectStyleFields("https://example.com/style.json")).toEqual([]);
    expect(collectStyleFields({ version: 8, layers: [], sources: {} })).toEqual(
      [],
    );
    expect(collectStyleFields(null)).toEqual([]);
    expect(collectStyleFields(undefined)).toEqual([]);
    expect(collectStyleFields({ default: "nope", rules: "nope" })).toEqual([]);
    expect(
      collectStyleFields({ rules: [null, 7, { propertyRefs: 3 }] }),
    ).toEqual([]);
    expect(
      collectStyleFields({
        rules: [{ conditions: [null, 7, { field: "f" }] }],
      }),
    ).toEqual(["f"]);
  });

  it("lists each field once, in a stable order", () => {
    const styleJson = {
      rules: [
        { conditionField: "b" },
        { conditionField: "a" },
        { conditionField: "b" },
      ],
    };
    expect(collectStyleFields(styleJson)).toEqual(["b", "a"]);
    expect(collectStyleFields(styleJson)).toEqual(
      collectStyleFields(styleJson),
    );
  });
});
