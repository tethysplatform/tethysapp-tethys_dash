import Feature from "ol/Feature.js";
import LineString from "ol/geom/LineString.js";
import Point from "ol/geom/Point.js";
import { transform } from "ol/proj.js";
import {
  LABEL_ANCHOR_OPTIONS,
  defaultLabelAnchor,
  defaultLabelColor,
  defaultLabelHaloColor,
  defaultLabelSize,
} from "components/map/labelStyle";

// Author-drawn annotations: the saved shape is
//   configuration.annotations = { defaults: {...style}, items: [...] }
// where each item is
//   { id, kind: "line" | "text", coordinates, text?, style?: {...partial} }.
// Coordinates are stored in EPSG:4326 lon/lat so they never depend on the live
// view projection, which can change after load when a raster is adopted.
//
// This module is React-free and map-free so its rules can be tested directly.

export { ANNOTATION_SOURCE_TYPE } from "components/map/decorationTypes";
const STORAGE_PROJECTION = "EPSG:4326";

// ~1 cm at the equator: enough to round-trip a drawn vertex, short enough that
// a saved dashboard does not carry float noise from the projection math.
const COORDINATE_DECIMALS = 7;

const ANNOTATION_KINDS = ["line", "text"];

// A layer's default arrowheads describe its arrows, so "none" is not offered:
// a plain line pins "none" on itself (see `newAnnotationItem`), which keeps a
// default change from turning lines into arrows.
export const DEFAULT_ARROWHEAD_OPTIONS = ["end", "start", "both"];
export const ARROWHEAD_OPTIONS = ["none", ...DEFAULT_ARROWHEAD_OPTIONS];

export const defaultAnnotationStyle = Object.freeze({
  lineColor: "#222222",
  lineWidth: 2,
  arrowheads: "end",
  textColor: defaultLabelColor,
  textSize: defaultLabelSize,
  haloColor: defaultLabelHaloColor,
  textAnchor: defaultLabelAnchor,
  // Degrees clockwise. Relative to the map, so a rotated callout stays lined
  // up with what it points at.
  textRotation: 0,
});

const ANNOTATION_STYLE_KEYS = Object.keys(defaultAnnotationStyle);

// Feature properties the layer and the editor read back.
export const ANNOTATION_ID_KEY = "annotationId";
export const ANNOTATION_KIND_KEY = "annotationKind";
export const ANNOTATION_TEXT_KEY = "annotationText";
export const ANNOTATION_STYLE_KEY = "annotationStyle";
const SOURCE_COORDINATES_KEY = "annotationSourceCoordinates";
const SOURCE_REVISION_KEY = "annotationSourceRevision";

export function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

// One validator per style key. A value that fails is treated as unset, so it
// falls through to the next layer of the cascade instead of rendering broken.
const STYLE_VALIDATORS = {
  lineColor: isNonEmptyString,
  lineWidth: isPositiveNumber,
  textColor: isNonEmptyString,
  textSize: isPositiveNumber,
  haloColor: isNonEmptyString,
  textAnchor: (value) => LABEL_ANCHOR_OPTIONS.includes(value),
  // Any angle, zero and negative included: 0 is the unrotated default.
  textRotation: isFiniteNumber,
};

/** An angle in degrees as the equivalent whole angle in [0, 360). */
export function normalizeRotation(degrees) {
  return ((Math.round(degrees) % 360) + 360) % 360;
}

function validStyleValue(key, value, arrowheadOptions) {
  if (key === "arrowheads") return arrowheadOptions.includes(value);
  // Callers only pass ANNOTATION_STYLE_KEYS, each of which has a validator.
  return STYLE_VALIDATORS[key](value);
}

/**
 * The layer's default style with every key filled: an authored default that is
 * missing or invalid falls back to `defaultAnnotationStyle`.
 */
export function resolveAnnotationDefaults(defaults) {
  const resolved = {};
  for (const key of ANNOTATION_STYLE_KEYS) {
    const value = defaults?.[key];
    resolved[key] = validStyleValue(key, value, DEFAULT_ARROWHEAD_OPTIONS)
      ? value
      : defaultAnnotationStyle[key];
  }
  return resolved;
}

/**
 * Effective style for one annotation: each valid override wins for its own
 * property, and everything else follows the layer default.
 */
export function resolveAnnotationStyle(defaults, overrides) {
  const resolved = resolveAnnotationDefaults(defaults);
  for (const key of ANNOTATION_STYLE_KEYS) {
    const value = overrides?.[key];
    if (validStyleValue(key, value, ARROWHEAD_OPTIONS)) {
      resolved[key] = value;
    }
  }
  return resolved;
}

function isCoordinatePair(value) {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

/** Does this item carry enough geometry to draw? */
export function isDrawableItem(item) {
  if (!item || typeof item !== "object") return false;
  if (item.kind === "text") return isCoordinatePair(item.coordinates);
  if (item.kind === "line") {
    return (
      Array.isArray(item.coordinates) &&
      item.coordinates.length >= 2 &&
      item.coordinates.every(isCoordinatePair)
    );
  }
  return false;
}

/** A possibly partial or missing saved config, with both keys present. */
export function normalizeAnnotations(config) {
  const defaults =
    config?.defaults && typeof config.defaults === "object"
      ? config.defaults
      : {};
  const items = Array.isArray(config?.items) ? config.items : [];
  return { defaults, items };
}

/**
 * The next id for a new item in this layer. Ids only need to be unique within
 * one layer, so a short counter suffices and is stable under test.
 */
export function nextAnnotationId(items) {
  let highest = 0;
  for (const item of items ?? []) {
    const match = /^a(\d+)$/.exec(item?.id ?? "");
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `a${highest + 1}`;
}

/**
 * A new item created by an editor tool. The Line tool pins `arrowheads: "none"`
 * so a plain line never inherits the layer's arrow ends; the Arrow tool writes
 * nothing and follows the default.
 *
 * @param {"line" | "arrow" | "text"} tool
 */
export function newAnnotationItem(tool, coordinates, items, text = "") {
  const id = nextAnnotationId(items);
  if (tool === "text") {
    return { id, kind: "text", coordinates, text };
  }
  const item = { id, kind: "line", coordinates };
  if (tool === "line") {
    item.style = { arrowheads: "none" };
  }
  return item;
}

/** Is this line item drawn as an arrow, given its layer's defaults? */
export function isArrowItem(item, defaults) {
  if (item?.kind !== "line") return false;
  return resolveAnnotationStyle(defaults, item.style).arrowheads !== "none";
}

/**
 * Human label for an item in the editor list. Lines and arrows are numbered by
 * creation order within their own kind, so "Arrow 2" stays "Arrow 2" until an
 * earlier arrow is deleted.
 */
export function annotationLabel(item, items, defaults) {
  if (item?.kind === "text") {
    const text = String(item.text ?? "").trim();
    return text ? `Text: ${text}` : "Text (empty)";
  }
  const arrow = isArrowItem(item, defaults);
  const kindName = arrow ? "Arrow" : "Line";
  let position = 0;
  for (const other of items ?? []) {
    if (other?.kind === "line" && isArrowItem(other, defaults) === arrow) {
      position += 1;
    }
    if (other === item || other?.id === item?.id) break;
  }
  return `${kindName} ${position}`;
}

/**
 * Remove one property override; an item left with no overrides drops its
 * `style` key so the saved config stays minimal.
 */
export function resetAnnotationOverride(item, key) {
  if (!item?.style || !(key in item.style)) return item;
  const { [key]: _removed, ...rest } = item.style;
  const next = { ...item };
  if (Object.keys(rest).length) {
    next.style = rest;
  } else {
    delete next.style;
  }
  return next;
}

function roundCoordinate(value) {
  const factor = 10 ** COORDINATE_DECIMALS;
  return Math.round(value * factor) / factor;
}

function toView(coordinate, viewProjection) {
  return transform(coordinate.slice(0, 2), STORAGE_PROJECTION, viewProjection);
}

function toStorage(coordinate, viewProjection) {
  return transform(
    coordinate.slice(0, 2),
    viewProjection,
    STORAGE_PROJECTION,
  ).map(roundCoordinate);
}

/**
 * OL features for the drawable items, read into the view projection. Each
 * feature carries its id, kind, text and style overrides, plus the stored
 * coordinates and the geometry revision they produced -- so an item the editor
 * never touched is written back byte-for-byte instead of through a lossy
 * projection round trip.
 */
export function itemsToFeatures(items, viewProjection) {
  const features = [];
  for (const item of items ?? []) {
    if (!isDrawableItem(item)) continue;
    const geometry =
      item.kind === "text"
        ? new Point(toView(item.coordinates, viewProjection))
        : new LineString(
            item.coordinates.map((c) => toView(c, viewProjection)),
          );
    const feature = new Feature({ geometry });
    feature.setId(item.id);
    feature.set(ANNOTATION_ID_KEY, item.id);
    feature.set(ANNOTATION_KIND_KEY, item.kind);
    feature.set(ANNOTATION_STYLE_KEY, item.style ?? null);
    if (item.kind === "text") {
      feature.set(ANNOTATION_TEXT_KEY, item.text ?? "");
    }
    feature.set(SOURCE_COORDINATES_KEY, item.coordinates);
    feature.set(SOURCE_REVISION_KEY, geometry.getRevision());
    features.push(feature);
  }
  return features;
}

/**
 * Move features from one view projection to another in place, keeping the
 * "untouched" marker valid: a feature that had not been edited before the
 * swap still writes back its original stored coordinates afterwards.
 */
export function reprojectAnnotationFeatures(features, from, to) {
  for (const feature of features ?? []) {
    const geometry = feature.getGeometry();
    if (!geometry) continue;
    const untouched =
      feature.get(SOURCE_REVISION_KEY) === geometry.getRevision();
    geometry.transform(from, to);
    if (untouched) {
      feature.set(SOURCE_REVISION_KEY, geometry.getRevision());
    }
  }
}

/**
 * Items for the given features, written back to EPSG:4326. The feature order
 * is the item order. Untouched features keep their stored coordinates.
 */
export function featuresToItems(features, viewProjection) {
  const items = [];
  for (const feature of features ?? []) {
    const geometry = feature.getGeometry();
    const kind = feature.get(ANNOTATION_KIND_KEY);
    if (!geometry || !ANNOTATION_KINDS.includes(kind)) continue;

    const untouched =
      feature.get(SOURCE_REVISION_KEY) === geometry.getRevision() &&
      feature.get(SOURCE_COORDINATES_KEY) !== undefined;
    let coordinates;
    if (untouched) {
      coordinates = feature.get(SOURCE_COORDINATES_KEY);
    } else if (kind === "text") {
      coordinates = toStorage(geometry.getCoordinates(), viewProjection);
    } else {
      coordinates = geometry
        .getCoordinates()
        .map((c) => toStorage(c, viewProjection));
    }

    const item = { id: feature.get(ANNOTATION_ID_KEY), kind, coordinates };
    if (kind === "text") {
      item.text = feature.get(ANNOTATION_TEXT_KEY) ?? "";
    }
    const style = feature.get(ANNOTATION_STYLE_KEY);
    if (style && Object.keys(style).length) {
      item.style = style;
    }
    if (isDrawableItem(item)) items.push(item);
  }
  return items;
}
