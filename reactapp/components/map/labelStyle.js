import Text from "ol/style/Text.js";
import Fill from "ol/style/Fill.js";
import Stroke from "ol/style/Stroke.js";
import PropTypes from "prop-types";
import { substituteTemplateString } from "components/modals/PopupModal/substituteTemplateString";

// Render defaults for labels, exported the way `RuleEditor` exports the style
// defaults the loader consumes -- the editor seeds its controls from these so
// the value an author sees is the value that actually renders.
export const defaultLabelAnchor = "center";
export const defaultLabelColor = "#000000";
export const defaultLabelSize = 13;
export const defaultLabelHaloColor = "rgba(255, 255, 255, 0.85)";
// Box drawn behind a label when the author allows overlapping labels, so the
// later-drawn label of a colliding pair stays readable over the one beneath.
// Same light semi-opaque family as the halo, and it carries the halo's existing
// assumption rather than a new one: both are built for dark-ish text, so an
// author who picks a light text color gets light text on a light box.
export const defaultLabelBackgroundColor = "rgba(255, 255, 255, 0.75)";
// Width at `defaultLabelSize`; scaled with the font so a small label is not
// swallowed by its own outline (see `haloWidthForSize`).
export const defaultLabelHaloWidth = 3;
export const defaultLabelFontFamily = "sans-serif";
// Breathing room around the label box for the declutter test. Ignored by
// OpenLayers under line placement, so it is only set for point placement.
export const defaultLabelPadding = [2, 4, 2, 4];
// Gap between the edge of a feature's symbol and the label box, in pixels.
export const labelAnchorPadding = 3;

// The nine anchors as data. `textAlign` picks which edge of the label box sits
// on the geometry and `textBaseline` does the same vertically; the offsets then
// push the box clear of the symbol. Only "top"/"middle"/"bottom" are used --
// "alphabetic" and "hanging" sit on the glyph metrics rather than the box and
// mis-anchor by a few pixels at every size.
//
// `offsetX`/`offsetY` are unit signs, multiplied by the resolved gap. Canvas Y
// grows downward, so north is negative.
export const LABEL_ANCHORS = {
  center: {
    textAlign: "center",
    textBaseline: "middle",
    offsetX: 0,
    offsetY: 0,
  },
  n: { textAlign: "center", textBaseline: "bottom", offsetX: 0, offsetY: -1 },
  ne: { textAlign: "left", textBaseline: "bottom", offsetX: 1, offsetY: -1 },
  e: { textAlign: "left", textBaseline: "middle", offsetX: 1, offsetY: 0 },
  se: { textAlign: "left", textBaseline: "top", offsetX: 1, offsetY: 1 },
  s: { textAlign: "center", textBaseline: "top", offsetX: 0, offsetY: 1 },
  sw: { textAlign: "right", textBaseline: "top", offsetX: -1, offsetY: 1 },
  w: { textAlign: "right", textBaseline: "middle", offsetX: -1, offsetY: 0 },
  nw: { textAlign: "right", textBaseline: "bottom", offsetX: -1, offsetY: -1 },
};

export const LABEL_ANCHOR_OPTIONS = Object.keys(LABEL_ANCHORS);

/**
 * Resolve an authored anchor name to its alignment/baseline/offset triple.
 * An unrecognized name -- a plugin-supplied config, or a rename -- falls back
 * to the default rather than leaving the label unanchored.
 *
 * @param {string} anchor one of `LABEL_ANCHOR_OPTIONS`
 * @param {number} distance pixel gap the offset signs are multiplied by
 */
export function resolveAnchor(anchor, distance = 0) {
  const key = String(anchor ?? "")
    .trim()
    .toLowerCase();
  const spec = LABEL_ANCHORS[key] || LABEL_ANCHORS[defaultLabelAnchor];
  const gap = Number.isFinite(distance) ? distance : 0;
  return {
    textAlign: spec.textAlign,
    textBaseline: spec.textBaseline,
    offsetX: spec.offsetX * gap,
    offsetY: spec.offsetY * gap,
  };
}

/**
 * Halo width proportional to the font size. A fixed width dominates the
 * letterforms at small sizes and disappears at large ones.
 */
export function haloWidthForSize(size) {
  const scaled = (Number(size) / defaultLabelSize) * defaultLabelHaloWidth;
  if (!Number.isFinite(scaled)) return defaultLabelHaloWidth;
  return Math.max(1, Math.round(scaled * 100) / 100);
}

/** `ol/style/Text` has no numeric size option -- size lives in the shorthand. */
export function composeLabelFont(size) {
  return `${resolveLabelSize(size)}px ${defaultLabelFontFamily}`;
}

// `Number()` maps "" and whitespace to 0, so a blank field would read as a
// real threshold. Anything blank, null or unparseable becomes NaN instead.
function toFiniteOrNaN(value) {
  if (value === null || value === undefined) return NaN;
  if (typeof value === "string" && value.trim() === "") return NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function resolveLabelSize(size) {
  const parsed = Number(size);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultLabelSize;
}

function resolveLabelColor(color) {
  if (typeof color === "string" && color.trim() !== "") return color;
  return defaultLabelColor;
}

/**
 * Classify a feature's geometry into the three buckets the style pipeline
 * branches on: "point", "linestring" or "polygon".
 *
 * Multi-part geometries fold into their single-part bucket, and anything
 * unrecognized -- a `GeometryCollection`, a `Circle`, a feature carrying no
 * geometry at all -- falls back to "point", the only placement that works
 * without a line or a ring to follow.
 *
 * This is the single implementation of the classification. `ModuleLoader`
 * re-exports it under its own historical name, `getGeometryBucket`. It lives
 * here, in the lower-level module, so the dependency runs one way: the loader
 * already imports this module, and nothing reachable from here imports the
 * loader back (`substituteTemplateString` reaches `map/utilities`, whose only
 * reference to the loader is a deliberate dynamic `import()` inside a
 * function). Callers that already computed the bucket pass it in instead of
 * paying for it twice.
 */
export function labelGeometryBucket(feature) {
  let type;
  try {
    type = feature?.getGeometry?.()?.getType?.();
  } catch {
    return "point";
  }
  const lowered = String(type ?? "").toLowerCase();
  if (lowered === "linestring" || lowered === "multilinestring") {
    return "linestring";
  }
  if (lowered === "polygon" || lowered === "multipolygon") return "polygon";
  // Points and anything unrecognized: point placement is the only mode that
  // works without a line to follow.
  return "point";
}

/**
 * The single-part geometry a multi-part feature's label should sit on.
 *
 * OpenLayers emits one label per part, so a basin made of three islands draws
 * its name three times. Returning a single part here -- the caller sets it as
 * the text style's geometry -- makes the label count match the feature count.
 * Single-part geometries return `undefined`: OpenLayers already picks the
 * polygon interior point on its own, and no geometry override is needed.
 */
export function resolveLabelGeometry(feature) {
  try {
    const geometry = feature?.getGeometry?.();
    const type = geometry?.getType?.();

    if (type === "MultiPolygon") {
      const polygons = geometry.getPolygons?.() || [];
      if (polygons.length === 0) return undefined;
      // Largest part by area: the label belongs on the mainland, not on the
      // first island the coordinate list happens to start with.
      let largest = polygons[0];
      let largestArea = largest.getArea?.() ?? 0;
      for (const polygon of polygons.slice(1)) {
        const area = polygon.getArea?.() ?? 0;
        if (area > largestArea) {
          largest = polygon;
          largestArea = area;
        }
      }
      return largest.getInteriorPoint?.() ?? undefined;
    }

    if (type === "MultiLineString") {
      const lines = geometry.getLineStrings?.() || [];
      if (lines.length === 0) return undefined;
      // Longest part: the shortest stub cannot fit the text under line
      // placement, so labeling it would drop the label entirely.
      let longest = lines[0];
      let longestLength = longest.getLength?.() ?? 0;
      for (const line of lines.slice(1)) {
        const length = line.getLength?.() ?? 0;
        if (length > longestLength) {
          longest = line;
          longestLength = length;
        }
      }
      return longest;
    }

    if (type === "MultiPoint") {
      return geometry.getPoint?.(0) ?? undefined;
    }

    return undefined;
  } catch {
    // A geometry that does not answer these calls still gets a label; it just
    // gets OpenLayers' default placement. Throwing here would take down the
    // whole layer's render.
    return undefined;
  }
}

/**
 * Resolve a label template against a feature's own attributes.
 *
 * Delegates to the popup title's substituter so `${feature.<key>}` means the
 * same thing in a label as it does in a popup title: a missing or null key
 * substitutes empty and the rest of the template still renders, `0` and `false`
 * survive, objects serialize, and a template that arrived as a number (layer
 * props are type-coerced on load) is coerced rather than dereferenced.
 */
export function resolveLabelText(template, feature) {
  let properties;
  try {
    properties = feature?.getProperties?.();
  } catch {
    properties = undefined;
  }
  try {
    return substituteTemplateString(template, properties);
  } catch {
    return "";
  }
}

// One `Text` -- and with it one `Fill` and one `Stroke` -- per label
// configuration and geometry bucket. The style function this feeds runs for
// every feature in the viewport on every rebuild, so allocating here would mint
// three objects per feature per zoom step. Reusing one object and writing only
// the per-feature parts onto it is safe for the same reason the geometry style
// cache is: OpenLayers consumes the returned style synchronously during the
// rebuild and never retains it.
//
// The key carries every field that shapes the cached object -- the geometry
// bucket, because line placement builds different options than point
// placement, and the size, color and anchor the constructor reads -- so two
// label configurations never share one object. It also carries the template,
// so that configurations differing only in their text are still distinct
// entries; the resolved *text* is deliberately absent, since keying on it
// would mint one entry per feature, which is the allocation this avoids.
//
// The cache is module-level and shared across layers and across Map widgets,
// which is why the key can rely on nothing but the configuration itself. Key
// space is bounded by the authored configurations on screen, but a plugin that
// rewrites its layer config on every fetch could still walk it upward, so the
// cache is emptied wholesale once it passes the cap rather than growing the
// way the geometry `styleCache` does.
const labelTextCache = new Map();
const LABEL_TEXT_CACHE_LIMIT = 200;

/** Test seam, and the reset a long-lived page would need if one is ever added. */
export function clearLabelTextCache() {
  labelTextCache.clear();
}

function cachedLabelText(labelConfig, bucket) {
  const size = resolveLabelSize(labelConfig.size);
  const color = resolveLabelColor(labelConfig.color);
  // `String()` rather than `JSON.stringify`: a template that arrived as an
  // object must not throw here, and a collision between two such templates is
  // harmless because the text is written per feature anyway.
  const key = [
    bucket,
    size,
    color,
    // Shapes the cached object too: an overlapping label is built with a
    // background box and a decluttered one without.
    labelConfig.allowOverlap ? "overlap" : "declutter",
    String(labelConfig.anchor ?? ""),
    String(labelConfig.template ?? ""),
  ].join(" ");

  const cached = labelTextCache.get(key);
  if (cached) return cached;

  const options = {
    font: composeLabelFont(size),
    fill: new Fill({ color }),
    // The halo renders under the fill, which is the only thing keeping dark
    // text legible over a dark basemap.
    stroke: new Stroke({
      color: defaultLabelHaloColor,
      width: haloWidthForSize(size),
    }),
  };

  if (bucket === "linestring") {
    // Under line placement OpenLayers repurposes textAlign and ignores
    // offsets, rotation, padding and the background options, so setting the
    // anchor here would present settings that silently do nothing.
    options.placement = "line";
  } else {
    options.placement = "point";
    // Alignment and baseline come from the anchor, which is in the key; the
    // offsets it also carries are scaled by the feature's own symbol size and
    // are written per call instead.
    const { textAlign, textBaseline } = resolveAnchor(labelConfig.anchor);
    options.textAlign = textAlign;
    options.textBaseline = textBaseline;
    options.padding = defaultLabelPadding;
    if (labelConfig.allowOverlap) {
      // Only ever set under point placement: OpenLayers ignores
      // `backgroundFill`/`backgroundStroke` entirely under line placement, so
      // setting them there would promise a box that never draws. The padding
      // above sizes this box as well as the declutter box.
      //
      // Whether the layer declutters at all is a layer-level decision made by
      // `applyVectorStyleFunction` in `map/Map.js`, not a `declutterMode` on
      // this Text.
      options.backgroundFill = new Fill({ color: defaultLabelBackgroundColor });
    }
    if (bucket === "polygon") {
      // Without this OpenLayers measures the polygon's horizontal chord at the
      // label row and silently skips any label wider than it.
      options.overflow = true;
    }
  }

  const text = new Text(options);
  if (labelTextCache.size >= LABEL_TEXT_CACHE_LIMIT) labelTextCache.clear();
  labelTextCache.set(key, text);
  return text;
}

/**
 * Build the `ol/style/Text` for one feature, or `null` when this feature draws
 * no label.
 *
 * The returned object is **shared** by every feature drawn with the same label
 * configuration: only the resolved text and the anchor offsets are written per
 * feature. Callers must read it before styling the next feature, which is what
 * OpenLayers does, and must never hold onto it.
 *
 * Returns `null` -- never throws -- for every unusable input, because this runs
 * inside the render path: an exception raised on one feature does not lose one
 * label, it takes down the layer.
 *
 * @param {Object} args
 * @param {Object} args.labelConfig
 *   `{ template, anchor, color, size, minZoom, allowOverlap }`
 * @param {Object} args.feature the OpenLayers feature being styled
 * @param {number} args.resolution the style function's second argument
 * @param {number} args.symbolSize the **effective pixel radius** of this
 *   feature's rendered symbol -- not the authored `size`, which is a scale
 *   factor rather than a measurement for some shapes. The caller resolves it
 *   (see `effectiveSymbolRadius` in `ModuleLoader`) so the anchor gap clears
 *   symbols whose size varies per feature.
 * @param {string} args.geometryBucket "point" | "linestring" | "polygon";
 *   derived from the feature when omitted
 * @param {number} args.minZoomResolution the configured `minZoom` already
 *   converted to a **resolution** by the map scope, which owns the only view
 *   that can convert it. The zoom level itself is never read here, so the two
 *   units cannot be confused at this boundary.
 * @returns {import("ol/style/Text.js").default|null}
 */
export function buildLabelStyle({
  labelConfig,
  feature,
  resolution,
  symbolSize = 0,
  geometryBucket,
  minZoomResolution,
} = {}) {
  if (!labelConfig || typeof labelConfig !== "object") return null;

  // A blank field means no floor -- `Number("")` is 0, which would otherwise
  // hide the label at every resolution but the one at the very bottom.
  const floor = toFiniteOrNaN(minZoomResolution);
  const currentResolution = toFiniteOrNaN(resolution);
  if (Number.isFinite(floor) && Number.isFinite(currentResolution)) {
    if (currentResolution > floor) return null;
  }

  const text = resolveLabelText(labelConfig.template, feature);
  // An empty or whitespace-only result means no label, rather than a second
  // "enabled" flag whose state could disagree with the template.
  if (typeof text !== "string" || text.trim() === "") return null;

  const bucket = geometryBucket || labelGeometryBucket(feature);
  const label = cachedLabelText(labelConfig, bucket);

  label.setText(text);
  if (bucket === "linestring") {
    // Line placement ignores offsets, but the shared object is left in a fully
    // defined state on every path rather than carrying whatever the last
    // caller wrote.
    label.setOffsetX(0);
    label.setOffsetY(0);
  } else {
    // The gap is measured from the geometry, not from the rendered symbol, so
    // it has to carry the symbol's own radius or the label lands on top of a
    // large symbol and floats away from a small one. Resolving an authored
    // size into that radius is the caller's job -- only the caller knows which
    // shape was drawn and can measure an icon's image.
    const radius = Number(symbolSize);
    const gap =
      (Number.isFinite(radius) ? Math.max(radius, 0) : 0) + labelAnchorPadding;
    const { offsetX, offsetY } = resolveAnchor(labelConfig.anchor, gap);
    label.setOffsetX(offsetX);
    label.setOffsetY(offsetY);
  }

  return label;
}

buildLabelStyle.propTypes = {
  labelConfig: PropTypes.shape({
    // `${feature.<key>}` tokens plus literal text. May arrive as a number.
    template: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    anchor: PropTypes.oneOf(LABEL_ANCHOR_OPTIONS),
    color: PropTypes.string,
    size: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    // Authored zoom level. Not read here -- the map scope converts it and
    // passes the result as `minZoomResolution`.
    minZoom: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    // Draw every label, colliding or not, each with a background box. The
    // layer-level declutter switch reads the same field (see `map/Map.js`).
    allowOverlap: PropTypes.bool,
  }),
  feature: PropTypes.object,
  resolution: PropTypes.number,
  symbolSize: PropTypes.number,
  geometryBucket: PropTypes.oneOf(["point", "linestring", "polygon"]),
  // A resolution, not a zoom level: `labelConfig.minZoom` already converted.
  minZoomResolution: PropTypes.number,
};

export default buildLabelStyle;
