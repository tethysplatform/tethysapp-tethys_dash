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
  buildLabelStyle,
  labelGeometryBucket,
  resolveLabelGeometry,
} from "components/map/labelStyle";
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

// Point symbols opt out of decluttering, on every construction site in this
// module without exception.
//
// A layer that declutters its labels declutters its *symbols* too unless each
// one says otherwise, and a dropped symbol is not merely invisible: OpenLayers
// also leaves it out of the declutter-aware hit test, so the feature stops
// answering clicks and hovers. A labeled point layer would quietly lose both
// its graphics and its popups wherever two markers overlapped.
//
// One constant rather than a literal per site: the previous attempt annotated
// each construction by hand and missed the two canvas-icon helpers, which are
// separate exported functions far from `buildPointStyle`. A test walks the
// whole shape set to keep that from happening again.
export const SYMBOL_DECLUTTER_MODE = "none";

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
      declutterMode: SYMBOL_DECLUTTER_MODE,
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
      declutterMode: SYMBOL_DECLUTTER_MODE,
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
        image: new CircleStyle({
          declutterMode: SYMBOL_DECLUTTER_MODE,
          radius: size,
          fill,
          stroke,
        }),
      });

    case "square":
      return new Style({
        image: new RegularShape({
          declutterMode: SYMBOL_DECLUTTER_MODE,
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
          declutterMode: SYMBOL_DECLUTTER_MODE,
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
          declutterMode: SYMBOL_DECLUTTER_MODE,
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
          declutterMode: SYMBOL_DECLUTTER_MODE,
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
          declutterMode: SYMBOL_DECLUTTER_MODE,
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
          declutterMode: SYMBOL_DECLUTTER_MODE,
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
            declutterMode: SYMBOL_DECLUTTER_MODE,
            src: iconUrl,
            scale: size / 10, // optional scaling
            rotation: rotationRad,
          }),
        });
      }
      // fallback to circle if no iconUrl
      return new Style({
        image: new CircleStyle({
          declutterMode: SYMBOL_DECLUTTER_MODE,
          radius: size,
          fill,
          stroke,
        }),
      });

    default:
      // fallback to circle
      return new Style({
        image: new CircleStyle({
          declutterMode: SYMBOL_DECLUTTER_MODE,
          radius: size,
          fill,
          stroke,
        }),
      });
  }
}

// A URL icon's `size` is a *scale factor*, not a pixel measurement: the "icon"
// branch of `buildPointStyle` feeds it to OpenLayers as `scale: size / 10`.
// Every other shape's `size` is a pixel radius (or, for the canvas-drawn
// diamond and trapezoid, the half-extent of a `2 * size` canvas anchored at its
// center), which is why only the icon case needs measuring.
export const ICON_SCALE_DIVISOR = 10;

// Natural edge length assumed for a URL icon whose image has not decoded yet.
// 32px is the ubiquitous marker/pin sprite, so it is the least wrong guess
// available -- but it is still a guess, which is the point of naming it. See
// `effectiveSymbolRadius` for why a guess is unavoidable here.
export const FALLBACK_ICON_IMAGE_SIZE = 32;

// Half the rendered bounding box of a loaded `ol/style/Icon`, or `undefined`
// while the image is still in flight. `getWidth`/`getHeight` already fold in
// the scale and answer `undefined` before the load completes, which is exactly
// the distinction this needs -- no image state constant has to be read.
function measuredIconRadius(image) {
  let width;
  let height;
  try {
    width = image.getWidth?.();
    height = image.getHeight?.();
  } catch {
    // A stand-in image, or one whose scale is mid-update: fall through to the
    // estimate rather than taking down the layer's render.
    return undefined;
  }
  const extent = Math.max(
    Number.isFinite(width) ? width : 0,
    Number.isFinite(height) ? height : 0,
  );
  // The larger axis, halved: the anchor gap is one scalar applied on both
  // axes, so the label has to clear the whole box, not the narrow side.
  return extent > 0 ? extent / 2 : undefined;
}

/**
 * The pixel radius a point symbol actually covers, which is the gap the label
 * anchor has to clear.
 *
 * Per shape:
 * - circle, square, triangle, star, cross, x: `size` is the radius (the
 *   circumradius for the `RegularShape` ones), so it is the answer.
 * - rectangle: `RegularShape` with `radius2 = size` and `scale [1, 0.5]`, so
 *   `size` is the horizontal half-extent and the vertical one is smaller.
 * - diamond, trapezoid: drawn onto a `size * 2` canvas anchored at its center,
 *   so `size` is again the half-extent -- known at construction, no measuring.
 * - icon **without** a `iconUrl`: `buildPointStyle` falls back to a circle of
 *   radius `size`.
 * - icon **with** a `iconUrl`: `size` is a scale factor. The real radius is
 *   half the image's rendered box, which does not exist until the image loads,
 *   so it is measured when available and estimated otherwise.
 *
 * The estimate is `FALLBACK_ICON_IMAGE_SIZE / 2 * scale` rather than `size`:
 * passing the scale factor through as if it were a radius is the bug this
 * replaces, and a wrong-by-a-known-assumption number is at least one a reader
 * can see and correct. The estimate is short-lived -- OpenLayers re-renders the
 * layer once an icon image loads, and this function runs again per feature on
 * every rebuild, so the measured value takes over from the next frame on.
 *
 * @param {string|undefined} shape the resolved `merged.shape`
 * @param {number|string|undefined} size the resolved `merged.size`
 * @param {import("ol/style/Image.js").default|null} [image] the built style's
 *   image, the only object that can answer for a URL icon
 * @returns {number} a non-negative pixel radius
 */
export function effectiveSymbolRadius(shape, size, image) {
  const parsed = Number(size);
  const authored = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

  if (shape !== "icon") return authored;

  // `getSrc` is what separates an `Icon` from the `CircleStyle` that
  // `buildPointStyle` substitutes when no `iconUrl` was configured.
  if (typeof image?.getSrc !== "function") return authored;

  const measured = measuredIconRadius(image);
  if (measured !== undefined) return measured;

  return (FALLBACK_ICON_IMAGE_SIZE / 2) * (authored / ICON_SCALE_DIVISOR);
}

// Geometry-bucket classification lives in `labelStyle`, the lower-level module
// of the pair, and is re-exported here under the name this file's call sites,
// `ModuleLoader`'s re-export list and the tests have always used. A second copy
// lived here and drifted from the first in exactly the way duplicated
// classifications do: this one assumed a feature that answers `getGeometry`,
// the other tolerates one that does not.
export { labelGeometryBucket as getGeometryBucket };

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

// The `Style` that carries the label where it cannot ride on the geometry
// style, cached per label `Text` and zIndex. Without this the point path
// allocates a wrapper for every feature on every rebuild, on top of the text
// itself. Keyed weakly on the `Text`, so its entries die with the label cache
// that owns them rather than forming a second unbounded cache; the inner map
// is bounded by the distinct zIndex values the layer's style rules author.
const labelWrapperCache = new WeakMap();

function labelWrapperFor(label, zIndex) {
  let byZIndex = labelWrapperCache.get(label);
  if (!byZIndex) {
    byZIndex = new Map();
    labelWrapperCache.set(label, byZIndex);
  }
  // `undefined` is a real zIndex ("let OpenLayers decide") and must not collide
  // with a numeric one.
  const key = zIndex ?? "auto";
  let wrapper = byZIndex.get(key);
  if (!wrapper) {
    wrapper = new Style({ text: label, zIndex });
    byZIndex.set(key, wrapper);
  }
  return wrapper;
}

// The authored shape and size a point `Style` was built from.
//
// `effectiveSymbolRadius` needs both, and neither survives the trip: the two
// caches below are keyed so that a hit returns *before* the merged style
// exists, which is the whole point of keying on inputs. Recording them beside
// the style -- rather than inside the cache entries -- keeps both caches
// holding plain `Style` objects, and keeps the record out of the cache key, so
// two features that resolve to the same style still share one entry.
//
// Weak and module-level: an entry dies with the style it describes, so the
// wholesale `resetStyleCache` clear needs no counterpart here, and keying on
// object identity means style functions cannot read each other's records.
// Non-point styles are deliberately absent -- they carry no symbol, and a
// missing record resolves to a zero radius, which is the right gap for a label
// anchored on a line or a ring.
const symbolMetadata = new WeakMap();

/**
 * Attach this feature's label to a style that may be shared with many others.
 *
 * Both caches hand out one `Style` per distinct *result*, so the same object
 * styles every feature that resolved to it. Per-feature label text therefore
 * stays out of both keys -- folding it in would mint one entry per feature,
 * which is the allocation those caches exist to avoid -- and is written onto
 * the shared object instead. That is safe for the same reason the caches are:
 * OpenLayers consumes the returned style synchronously during a rebuild and
 * never retains it.
 *
 * Mutating a shared object demands an invariant: the text and the geometry are
 * cleared unconditionally, before anything decides whether this feature draws a
 * label. Clearing only on the paths that set them would let a feature whose
 * template resolves empty draw its predecessor's label, and an unlabeled layer
 * sharing a style with a labeled one draw that layer's text. The label `Text`
 * and its wrapper `Style` are cached per label configuration too, which makes
 * the invariant matter more, not less: nothing here may return a style whose
 * text was written for an earlier feature.
 *
 * @param {import("ol/style/Style.js").default} style the geometry style, built
 *   or cached
 * @param {Object} args
 * @param {Object} [args.labelConfig] the layer's label configuration, absent
 *   on an unlabeled layer
 * @param {Object} args.feature the feature being styled
 * @param {number} args.resolution the style function's second argument
 * @param {string} args.geometryBucket the bucket the caller already computed
 * @returns {import("ol/style/Style.js").default|Array} one style, or the
 *   geometry style and the label style as two, per the split below.
 */
export function applyLabelToStyle(
  style,
  { labelConfig, feature, resolution, geometryBucket } = {},
) {
  style.setText(undefined);
  style.setGeometry(undefined);

  // Read before the label is built, not after: the anchor gap is measured in
  // pixels and, for a URL icon, only the image knows how many it covers.
  const image = style.getImage?.();
  const symbol = symbolMetadata.get(style);

  const label = buildLabelStyle({
    labelConfig,
    feature,
    resolution,
    // A pixel radius, resolved from the authored size and the drawn symbol --
    // the two are the same number for every shape but a URL icon.
    symbolSize: effectiveSymbolRadius(symbol?.shape, symbol?.size, image),
    geometryBucket,
    // The authored `minZoom` is a zoom level and this compares resolutions;
    // the map scope owns the only view that can convert between them and
    // publishes the result under a name that says which unit it is.
    minZoomResolution: labelConfig?.minZoomResolution,
  });
  if (!label) return style;

  // `ol/style/Text` has no geometry option, so the single-part override that
  // keeps a multi-part feature to one label has to live on the Style.
  const labelGeometry = resolveLabelGeometry(feature);

  // Two styles rather than one wherever sharing would damage the geometry
  // drawing. OpenLayers declutters an image and text carried by one style as a
  // pair and drops both on collision; and a geometry override would replace
  // what the fill and stroke draw, hiding a multi-polygon behind its own label
  // point. Where neither applies -- a single-part line or polygon -- the label
  // rides on the cached style and costs no allocation.
  if (image || labelGeometry) {
    const labelStyle = labelWrapperFor(label, style.getZIndex());
    labelStyle.setGeometry(labelGeometry);
    return [style, labelStyle];
  }

  style.setText(label);
  return style;
}

// Field separator for the cache key. A unit separator cannot appear in a
// value the key ever reads without being length-prefixed first.
const KEY_SEPARATOR = "\u001f";

// One field value, encoded so that nothing the pipeline treats differently can
// share an encoding.
//
// matchesCondition returns early for null and undefined but lets "" through to
// Number(""), which is 0 -- so a rule `v < 5` matches "" and not null. A rule
// comparing against "true" matches the string and not the boolean. And
// propertyRefs injects the raw value into the style, so 10 and "10" produce
// different Style content. Each therefore needs its own encoding.
//
// undefined and null share one, which is safe rather than lazy: they are
// interchangeable at all three read sites.
//
// Strings and serialized values are length-prefixed so a value containing the
// separator cannot bleed into the next field. Non-primitives go through
// JSON.stringify so they compare by content -- an array-valued attribute
// reached through propertyRefs is a supported shape, and identity comparison
// would drop the hit rate to zero for it.
function encodeKeyValue(value) {
  if (value === null || value === undefined) return "~";
  switch (typeof value) {
    case "string":
      return "s" + value.length + ":" + value;
    case "number":
      // NaN takes its own tag: it is not null, and matchesCondition does not
      // early-return on it the way it does for null.
      return Number.isNaN(value) ? "x" : "n" + value;
    case "boolean":
      return value ? "b1" : "b0";
    case "bigint":
      // JSON.stringify throws on these, and a GeoParquet int64 column can
      // produce one.
      return "g" + value.toString();
    default: {
      let json;
      try {
        json = JSON.stringify(value);
      } catch {
        // Circular, or otherwise unserializable. Fall back to a stable tag
        // rather than throwing out of a render frame; such a value cannot
        // drive a rule comparison meaningfully anyway.
        return "e";
      }
      if (json === undefined) return "u";
      return "j" + json.length + ":" + json;
    }
  }
}

// The resolved style, encoded so equal results share one Style instance.
//
// Deliberately not JSON.stringify: resolveAllStyleValues injects raw feature
// values into the result, so a Date would serialize to the same text as the
// string of its own ISO form and the two would share a Style built from the
// wrong one -- the collision the input key exists to prevent, one layer down.
// A BigInt would throw outright. Keys are sorted so property order cannot
// change the result.
function encodeResolvedStyle(geometryBucket, merged) {
  let key = geometryBucket;
  for (const name of Object.keys(merged).sort()) {
    key += KEY_SEPARATOR + name + ":" + encodeKeyValue(merged[name]);
  }
  return key;
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

/**
 * Build the per-feature style function for a vector layer.
 *
 * @param {Object|null|undefined} styleJson the layer's rule-based style, which
 *   may be absent: a layer configured with a label and no style rules still
 *   needs this function, and reaches it with nothing to merge.
 * @param {Object} [labelConfig] `{ template, anchor, color, size,
 *   minZoomResolution }`, a sibling of the style on the layer config -- the
 *   authored `minZoom` having been converted to a resolution by the map scope,
 *   which owns the view that can convert it.
 * @returns {Function} `(feature, resolution) => Style | Style[]`. The
 *   resolution is OpenLayers' own second argument and is what the label's zoom
 *   floor is compared against.
 */
export function createJsonStyleFunction(styleJson, labelConfig) {
  // One cache per style function, not one per module.
  //
  // The key below is built from the fields *this* style names, so it means
  // nothing outside this style definition -- a shared cache would serve one
  // layer a style computed for another. Scoping here also ends the
  // page-lifetime growth of the module-global map this replaces: the cache
  // becomes unreachable with the style function.
  //
  // Deliberately uncapped: capping would turn a layer whose fields carry
  // near-unique values into an all-miss-every-frame layer, which is slower
  // than doing nothing. Growth is bounded instead by resetStyleCache below,
  // called when the layer's features are replaced.
  const styleCache = new Map();

  // Distinct inputs routinely resolve to the same style -- a threshold rule
  // collapses every value past it into one result -- so the Style objects are
  // keyed on the resolved style as well, and features sharing a result share
  // one instance. Without this, keying on inputs alone would allocate a Style,
  // its Stroke and Fill, and its rendered canvas per distinct value, where the
  // output-keyed cache this replaces allocated two for the whole layer.
  const stylesByResolved = new Map();

  // Read through a defaulted object rather than guarding each access: a
  // label-only layer -- a label and no style rules at all -- passes nothing
  // here, and every lookup below that is not optional-chained would throw on
  // it.
  const json = styleJson && typeof styleJson === "object" ? styleJson : {};

  // Collected once. The style is a pure function of the geometry bucket and
  // these fields' values, so a hit needs neither the rule loop nor the
  // property-bag copy.
  const keyFields = collectStyleFields(json);
  const rules = Array.isArray(json.rules) ? json.rules : [];

  const styleFunction = function (feature, resolution) {
    const geometryBucket = labelGeometryBucket(feature); // point/line/polygon

    let cacheKey = geometryBucket;
    for (let i = 0; i < keyFields.length; i++) {
      cacheKey += KEY_SEPARATOR + encodeKeyValue(feature.get(keyFields[i]));
    }
    // Every return path below goes through `applyLabelToStyle`, including the
    // two cache hits: the style it hands back is shared, so it carries
    // whatever label the previous feature wrote until this one overwrites it.
    const labelArgs = { labelConfig, feature, resolution, geometryBucket };

    const cached = styleCache.get(cacheKey);
    if (cached) return applyLabelToStyle(cached, labelArgs);

    const properties = feature.getProperties();

    // --- Defaults (geometry-specific) ---
    // Copied, not referenced. The point block below assigns merged.size and
    // merged.shape, and when no rule matched there is nothing between here and
    // there that clones -- resolveAllStyleValues returns its argument untouched
    // absent propertyRefs. Writing through would land in the caller's own style
    // config, where resolveSize's borrowed size then applies to every later
    // feature that matches nothing.
    let merged = { ...(json.default?.[geometryBucket] || {}) };

    // --- Apply matching rules ---
    for (const rule of rules) {
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
      merged.size = resolveSize(feature, rules, merged.size);
    }

    // Resolved identically to something already built? Share that instance.
    // Only reached on a miss, so the serialization here costs what it cost
    // before this cache was keyed on inputs -- once per feature on the first
    // frame, and nothing thereafter.
    const resolvedKey = encodeResolvedStyle(geometryBucket, merged);
    const shared = stylesByResolved.get(resolvedKey);
    if (shared) {
      styleCache.set(cacheKey, shared);
      return applyLabelToStyle(shared, labelArgs);
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
    stylesByResolved.set(resolvedKey, style);
    // Recorded before the first attach, so the two cache hits above resolve
    // the same symbol radius on later frames that this call does now. The
    // resolved key carries both values, so a style shared by two features was
    // built from one shape and one size.
    if (geometryBucket === "point") {
      symbolMetadata.set(style, { shape: merged.shape, size: merged.size });
    }
    return applyLabelToStyle(style, labelArgs);
  };

  // Called when the layer's feature set is replaced. Keys are built from
  // feature values, so entries computed against the old dataset are dead
  // weight -- and a refreshing layer keeps its style function across every
  // refetch, so without this they accumulate for the life of the page.
  styleFunction.resetStyleCache = () => {
    styleCache.clear();
    stylesByResolved.clear();
  };

  // Exist for tests; nothing in the app needs them.
  styleFunction.cachedStyleCount = () => styleCache.size;
  styleFunction.distinctStyleCount = () => stylesByResolved.size;

  return styleFunction;
}
