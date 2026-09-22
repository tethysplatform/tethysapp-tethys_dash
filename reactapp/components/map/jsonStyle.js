// The JSON rule-style engine: it turns a layer's style rules into the
// per-feature callback OpenLayers invokes on every render frame.
//
// Extracted from ModuleLoader.js so its coverage is measured against a module
// no test mocks. Two suites under __tests__/components/visualizations mock
// ModuleLoader with the `jest.mock(..., () => ({ ...jest.requireActual(...) }))`
// shape, which shadow-instruments it and under-reports these branches in the
// merged coverage report -- the same effect that moved ranking.js out of
// utilities.js.
//
// Unlike ranking.js and viewGroup.js this module is not React-free: the style
// defaults live in RuleEditor.js, which pulls in React. That coupling came
// along from ModuleLoader.js rather than being introduced here.

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
  defaultStroke,
  defaultStrokeWidth,
  defaultSize,
  defaultZIndex,
  defaultShape,
  defaultHatchSpacing,
  defaultHatchDirection,
  defaultDotSpacing,
  defaultDotRadius,
} from "components/inputs/RuleEditor.js";

const styleCache = new Map();

function createDotFill({ color, radius, spacing }) {
  const canvas = document.createElement("canvas");
  canvas.width = spacing;
  canvas.height = spacing;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.arc(spacing / 2, spacing / 2, radius, 0, Math.PI * 2);
  ctx.fill();

  const pattern = ctx.createPattern(canvas, "repeat");

  return new Fill({
    color: pattern,
  });
}

function createHatchFill({ color, spacing, direction }) {
  const canvas = document.createElement("canvas");
  canvas.width = spacing;
  canvas.height = spacing;

  const ctx = canvas.getContext("2d");
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;

  if (direction === "horizontal" || direction === "cross") {
    ctx.beginPath();
    ctx.moveTo(0, spacing / 2);
    ctx.lineTo(spacing, spacing / 2);
    ctx.stroke();
  }

  if (direction === "vertical" || direction === "cross") {
    ctx.beginPath();
    ctx.moveTo(spacing / 2, 0);
    ctx.lineTo(spacing / 2, spacing);
    ctx.stroke();
  }

  if (direction === "diagonal") {
    ctx.beginPath();
    ctx.moveTo(0, spacing);
    ctx.lineTo(spacing, 0);
    ctx.stroke();
  }

  const pattern = ctx.createPattern(canvas, "repeat");

  return new Fill({
    color: pattern,
  });
}

function mergeStyleProperties(base, override) {
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(override).filter(([, v]) => v !== undefined),
    ),
  };
}

export function matchesCondition(featureValue, type, conditionValue) {
  const a = featureValue;

  // Presence checks must operate on the raw value: Number("") is 0, which would
  // defeat the empty-string check after numeric coercion.
  if (type === "isNull") {
    return a === null || a === undefined || a === "";
  }
  if (type === "isNotNull") {
    return a !== null && a !== undefined && a !== "";
  }

  // A field the feature does not carry cannot satisfy a comparison. Without this
  // the negated operators invert into a match: `!=` becomes `undefined !== x`,
  // and `notIn` becomes "not in the list", both true -- so one saved rule
  // repaints every feature of a layer whose .dbf is missing or whose schema
  // drifted upstream. The layer still renders, so nothing fails and nobody is
  // told. The presence checks above deliberately run first: asking whether an
  // absent field is null is a question with a real answer.
  if (a === null || a === undefined) return false;

  const coerce = (v) => (typeof v === "string" && !isNaN(v) ? Number(v) : v);

  const av = coerce(a);

  // List membership: conditionValue is a comma-separated list of literals.
  if (type === "in" || type === "notIn") {
    const list =
      typeof conditionValue === "string"
        ? conditionValue
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s !== "")
            .map(coerce)
        : [];
    if (list.length === 0) return false;
    const found = list.includes(av);
    return type === "in" ? found : !found;
  }

  const b = coerce(conditionValue);

  switch (type) {
    case "=":
      return av === b;
    case "!=":
      return av !== b;
    case "<":
      return av < b;
    case "<=":
      return av <= b;
    case ">":
      return av > b;
    case ">=":
      return av >= b;
    default:
      return false;
  }
}

export function resolveAllStyleValues(merged, properties) {
  if (!merged.propertyRefs || typeof merged.propertyRefs !== "object") {
    return merged;
  }
  const resolved = { ...merged };
  for (const [key, fieldName] of Object.entries(merged.propertyRefs)) {
    if (typeof fieldName !== "string" || !fieldName) continue;
    const fv = properties[fieldName];
    if (fv !== undefined && fv !== null && fv !== "") {
      resolved[key] = fv;
    }
  }
  return resolved;
}

function evaluateCondition({ field, type, value, valueIsField }, properties) {
  const fv = properties[field];
  let ruleValue = valueIsField ? properties[value] : value;
  if (
    typeof fv === "number" &&
    typeof ruleValue === "string" &&
    !isNaN(ruleValue)
  ) {
    ruleValue = Number(ruleValue);
  }
  return matchesCondition(fv, type, ruleValue);
}

export function ruleMatches(rule, properties) {
  const conditions = [];

  if (rule.conditionField && rule.conditionType) {
    conditions.push({
      field: rule.conditionField,
      type: rule.conditionType,
      value: rule.conditionValue,
      valueIsField: !!rule.conditionValueIsField,
    });
  }

  if (Array.isArray(rule.conditions)) {
    for (const c of rule.conditions) {
      if (c && c.field && c.type) {
        conditions.push(c);
      }
    }
  }

  if (conditions.length === 0) return false;

  const combinator = rule.conditionCombinator === "OR" ? "OR" : "AND";
  return combinator === "OR"
    ? conditions.some((c) => evaluateCondition(c, properties))
    : conditions.every((c) => evaluateCondition(c, properties));
}

export function resolveSize(feature, rules, defaultSize) {
  let size = defaultSize;
  let bestThreshold = null;

  for (const rule of rules) {
    if (rule.size == null) continue;

    const featureValue = feature.get(rule.conditionField);
    if (featureValue == null) continue;

    const ruleValue = Number(rule.conditionValue);
    const fv = Number(featureValue);

    if (isNaN(ruleValue) || isNaN(fv)) continue;

    const matches = matchesCondition(fv, rule.conditionType, ruleValue);
    if (!matches) continue;

    if (bestThreshold === null || ruleValue > bestThreshold) {
      bestThreshold = ruleValue;
      size = Number(rule.size);
    }
  }

  return size;
}

export function createTrapezoidIconStyle({ size, fill, stroke, rotation = 0 }) {
  const canvasSize = size * 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;

  const ctx = canvas.getContext("2d");
  ctx.translate(canvasSize / 2, canvasSize / 2);

  ctx.fillStyle = fill.getColor();
  ctx.strokeStyle = stroke.getColor();
  ctx.lineWidth = stroke.getWidth();

  const topHalfWidth = size * 0.5;
  const baseHalfWidth = size;
  const halfHeight = size * 0.5;

  ctx.beginPath();
  ctx.moveTo(-topHalfWidth, -halfHeight);
  ctx.lineTo(topHalfWidth, -halfHeight);
  ctx.lineTo(baseHalfWidth, halfHeight);
  ctx.lineTo(-baseHalfWidth, halfHeight);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  return new Style({
    image: new Icon({
      img: canvas,
      imgSize: [canvasSize, canvasSize],
      anchor: [0.5, 0.5],
      rotation,
    }),
  });
}

export function createDiamondIconStyle({ size, fill, stroke, rotation = 0 }) {
  const canvasSize = size * 2;

  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;

  const ctx = canvas.getContext("2d");
  ctx.translate(canvasSize / 2, canvasSize / 2);

  const horizontalScale = 0.6; // controls how pointy the diamond is

  ctx.fillStyle = fill.getColor();
  ctx.strokeStyle = stroke.getColor();
  ctx.lineWidth = stroke.getWidth();

  // --- Top triangle ---
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * horizontalScale, 0);
  ctx.lineTo(-size * horizontalScale, 0);
  ctx.closePath();
  ctx.fill();

  // Stroke only outer edges
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * horizontalScale, 0);
  ctx.moveTo(0, -size);
  ctx.lineTo(-size * horizontalScale, 0);
  ctx.stroke();

  // --- Bottom triangle ---
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(size * horizontalScale, 0);
  ctx.lineTo(-size * horizontalScale, 0);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(size * horizontalScale, 0);
  ctx.moveTo(0, size);
  ctx.lineTo(-size * horizontalScale, 0);
  ctx.stroke();

  return new Style({
    image: new Icon({
      img: canvas,
      imgSize: [canvasSize, canvasSize],
      anchor: [0.5, 0.5],
      rotation,
    }),
  });
}

export function buildPointStyle(
  shape,
  size,
  fill,
  stroke,
  iconUrl,
  rotation = 0,
) {
  const rotationRad = (Number(rotation) || 0) * (Math.PI / 180);

  switch (shape) {
    case "circle":
      return new Style({
        image: new CircleStyle({ radius: size, fill, stroke }),
      });

    case "square":
      return new Style({
        image: new RegularShape({
          points: 4,
          radius: size,
          angle: Math.PI / 4,
          rotation: rotationRad,
          fill,
          stroke,
        }),
      });

    case "rectangle":
      return new Style({
        image: new RegularShape({
          fill: fill,
          stroke: stroke,
          radius: size / Math.SQRT2,
          radius2: size,
          points: 4,
          angle: 0,
          rotation: rotationRad,
          scale: [1, 0.5],
        }),
      });

    case "triangle":
      return new Style({
        image: new RegularShape({
          points: 3,
          radius: size,
          rotation: rotationRad,
          fill,
          stroke,
        }),
      });

    case "star":
      return new Style({
        image: new RegularShape({
          points: 5,
          radius: size,
          radius2: size / 2,
          rotation: rotationRad,
          fill,
          stroke,
        }),
      });

    case "diamond":
      return createDiamondIconStyle({
        size,
        fill,
        stroke,
        rotation: rotationRad,
      });

    case "trapezoid":
      return createTrapezoidIconStyle({
        size,
        fill,
        stroke,
        rotation: rotationRad,
      });

    case "cross":
      return new Style({
        image: new RegularShape({
          points: 4,
          radius: size,
          radius2: 0,
          angle: 0,
          rotation: rotationRad,
          fill,
          stroke,
        }),
      });

    case "x":
      return new Style({
        image: new RegularShape({
          points: 4,
          radius: size,
          radius2: 0,
          angle: Math.PI / 4,
          rotation: rotationRad,
          fill,
          stroke,
        }),
      });

    case "icon":
      if (iconUrl) {
        return new Style({
          image: new Icon({
            src: iconUrl,
            scale: size / 10, // optional scaling
            rotation: rotationRad,
          }),
        });
      }
      // fallback to circle if no iconUrl
      return new Style({
        image: new CircleStyle({ radius: size, fill, stroke }),
      });

    default:
      // fallback to circle
      return new Style({
        image: new CircleStyle({ radius: size, fill, stroke }),
      });
  }
}

export function getGeometryBucket(feature) {
  const type = feature.getGeometry()?.getType().toLowerCase();
  if (type === "point" || type === "multipoint") return "point";
  if (type === "linestring" || type === "multilinestring") return "linestring";
  if (type === "polygon" || type === "multipolygon") return "polygon";
  return "point";
}

export function buildPolygonFill(merged) {
  if (merged.polygonFillType === "hatch") {
    return createHatchFill({
      color: merged.fill || defaultFill,
      spacing: merged.hatchSpacing || defaultHatchSpacing,
      direction: merged.hatchDirection || defaultHatchDirection,
    });
  }

  if (merged.polygonFillType === "dot") {
    return createDotFill({
      color: merged.fill || defaultFill,
      radius: merged.dotRadius || defaultDotRadius,
      spacing: merged.dotSpacing || defaultDotSpacing,
    });
  }

  // solid default
  return new Fill({ color: merged.fill || defaultFill });
}

// Every feature field this style can read.
//
// The resulting style is a pure function of the geometry bucket and these
// values, which is what lets a cache key be built from them instead of from
// the merged result. Three readers name fields and they disagree on scope, so
// this takes the union of all three rather than filtering per geometry:
//
//   - ruleMatches / evaluateCondition read conditionField, every
//     conditions[].field, and -- where the *IsField flags are set -- the field
//     named by the comparand rather than the comparand itself.
//   - resolveAllStyleValues reads every propertyRefs target, on rules and on
//     the geometry defaults alike.
//   - resolveSize reads conditionField for every rule carrying a size,
//     ignoring geometryType, conditions[] and the combinator. A polygon rule
//     can therefore decide a point feature's size, so filtering this list by
//     bucket would drop a field that changes the result. conditionField is
//     taken whether or not conditionType is present, for the same reason.
//
// Returns an empty list for anything not rule-shaped. The style function is
// reached from the catch around ol-mapbox-style's applyStyle, so it is handed
// whatever the layer config held -- including a style URL string or a Mapbox
// style object whose fetch failed. Those survive the pipeline today on
// optional chaining, and throwing here would propagate out through the awaited
// layer add and take the layer with it.
export function collectStyleFields(styleJson) {
  const fields = [];
  const seen = new Set();

  const take = (name) => {
    if (typeof name !== "string" || !name || seen.has(name)) return;
    seen.add(name);
    fields.push(name);
  };

  const takePropertyRefs = (carrier) => {
    const refs = carrier?.propertyRefs;
    if (!refs || typeof refs !== "object") return;
    for (const target of Object.values(refs)) take(target);
  };

  if (!styleJson || typeof styleJson !== "object") return fields;

  const defaults = styleJson.default;
  if (defaults && typeof defaults === "object") {
    for (const bucket of Object.values(defaults)) {
      if (bucket && typeof bucket === "object") takePropertyRefs(bucket);
    }
  }

  const rules = Array.isArray(styleJson.rules) ? styleJson.rules : [];
  for (const rule of rules) {
    if (!rule || typeof rule !== "object") continue;
    take(rule.conditionField);
    if (rule.conditionValueIsField) take(rule.conditionValue);
    if (Array.isArray(rule.conditions)) {
      for (const condition of rule.conditions) {
        if (!condition || typeof condition !== "object") continue;
        take(condition.field);
        if (condition.valueIsField) take(condition.value);
      }
    }
    takePropertyRefs(rule);
  }

  return fields;
}

export function createJsonStyleFunction(styleJson) {
  return function (feature) {
    let properties = feature.getProperties();
    const geometryBucket = getGeometryBucket(feature); // 'point', 'line', 'polygon'

    // --- Defaults (geometry-specific) ---
    // Copied, not referenced. The point block below assigns merged.size and
    // merged.shape, and when no rule matched there is nothing between here and
    // there that clones -- resolveAllStyleValues returns its argument untouched
    // absent propertyRefs. Writing through would land in the caller's own style
    // config, where resolveSize's borrowed size then applies to every later
    // feature that matches nothing.
    let merged = { ...(styleJson.default?.[geometryBucket] || {}) };

    // --- Apply matching rules ---
    for (const rule of styleJson.rules || []) {
      // Only apply rule if it matches this geometry type
      const ruleGeom = rule.geometryType || geometryBucket;
      if (ruleGeom !== geometryBucket) continue;

      if (ruleMatches(rule, properties)) {
        merged = mergeStyleProperties(merged, rule);
      }
    }

    // --- Resolve any field references against this feature's properties ---
    merged = resolveAllStyleValues(merged, properties);

    // --- Set sensible defaults for points ---
    if (geometryBucket === "point") {
      if (merged.size == null) merged.size = defaultSize;
      if (!merged.shape) merged.shape = defaultShape;
      merged.size = resolveSize(feature, styleJson.rules || [], merged.size);
    }

    // --- Cache lookup ---
    const cacheKey = `${geometryBucket}:${JSON.stringify(merged)}`;
    if (styleCache.has(cacheKey)) {
      return styleCache.get(cacheKey);
    }

    // --- Build style ---
    // Ensure strokeDash is an array of numbers or undefined
    let lineDash = undefined;
    if (merged.strokeDash && typeof merged.strokeDash === "string") {
      // Accept empty string as solid
      if (merged.strokeDash.trim() !== "") {
        lineDash = merged.strokeDash
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => !isNaN(n));
        if (lineDash.length === 0) lineDash = undefined;
      }
    } else if (Array.isArray(merged.strokeDash)) {
      lineDash = merged.strokeDash.map(Number).filter((n) => !isNaN(n));
      if (lineDash.length === 0) lineDash = undefined;
    }

    const stroke = lineDash
      ? new Stroke({
          color: merged.stroke || defaultStroke,
          width: merged.strokeWidth ?? defaultStrokeWidth,
          lineDash,
        })
      : new Stroke({
          color: merged.stroke || defaultStroke,
          width: merged.strokeWidth ?? defaultStrokeWidth,
        });

    const zIndex = merged.zIndex ?? defaultZIndex;
    let style;

    // --- POINT ---
    if (geometryBucket === "point") {
      const fill = new Fill({ color: merged.fill || defaultFill });
      style = buildPointStyle(
        merged.shape,
        merged.size,
        fill,
        stroke,
        merged.iconUrl,
        merged.rotation,
      );
    }
    // --- LINE ---
    else if (geometryBucket === "linestring") {
      style = new Style({ stroke, zIndex });
    }
    // --- POLYGON ---
    else {
      const fill = buildPolygonFill(merged);
      style = new Style({ fill, stroke, zIndex });
    }

    // --- Cache & return ---
    styleCache.set(cacheKey, style);
    return style;
  };
}
