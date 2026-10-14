import Style from "ol/style/Style.js";
import Stroke from "ol/style/Stroke.js";
import Fill from "ol/style/Fill.js";
import Text from "ol/style/Text.js";
import RegularShape from "ol/style/RegularShape.js";
import Point from "ol/geom/Point.js";
import {
  ANNOTATION_KIND_KEY,
  ANNOTATION_STYLE_KEY,
  ANNOTATION_TEXT_KEY,
  resolveAnnotationStyle,
} from "components/map/annotations";
import {
  composeLabelFont,
  haloWidthForSize,
  labelAnchorPadding,
  resolveAnchor,
} from "components/map/labelStyle";

// Every size here is in screen pixels, so lines, arrowheads and text stay the
// same size on screen at every zoom while their geometry stays geographic.

/** Arrowhead radius for a line width: large enough to read at width 1. */
export function arrowheadRadius(lineWidth) {
  return Math.max(5, lineWidth * 2 + 3);
}

/**
 * Clockwise rotation from north for an arrowhead pointing from `from` to `to`.
 * A 3-point RegularShape with no rotation points straight up, so the heading
 * is the rotation. Map Y grows north, so this needs no sign flip.
 */
export function arrowheadRotation(from, to) {
  return Math.atan2(to[0] - from[0], to[1] - from[1]);
}

function arrowheadStyle(tip, previous, color, lineWidth) {
  return new Style({
    geometry: new Point(tip),
    image: new RegularShape({
      points: 3,
      radius: arrowheadRadius(lineWidth),
      rotation: arrowheadRotation(previous, tip),
      rotateWithView: true,
      fill: new Fill({ color }),
    }),
  });
}

// The last vertex that differs from `coordinates[index]`, walking in `step`
// direction -- a duplicated end vertex (a double click can leave one) would
// otherwise give a zero-length segment and an arrowhead pointing north.
function distinctNeighbor(coordinates, index, step) {
  const end = coordinates[index];
  for (let i = index + step; i >= 0 && i < coordinates.length; i += step) {
    const candidate = coordinates[i];
    if (candidate[0] !== end[0] || candidate[1] !== end[1]) return candidate;
  }
  return null;
}

// Style caches live with one style function -- one layer build -- rather than
// for the page: a layer is rebuilt on any change to its config, so its caches
// go with it, and text typed one keystroke at a time never piles up.
const createCaches = () => ({ stroke: new Map(), text: new Map() });

function lineStyle(color, width, caches) {
  const key = `${color}|${width}`;
  let style = caches.stroke.get(key);
  if (!style) {
    style = new Style({
      stroke: new Stroke({ color, width, lineCap: "round", lineJoin: "round" }),
    });
    caches.stroke.set(key, style);
  }
  return style;
}

function lineStyles(geometry, resolved, caches) {
  const coordinates = geometry.getCoordinates();
  if (!Array.isArray(coordinates) || coordinates.length < 2) return [];
  const styles = [lineStyle(resolved.lineColor, resolved.lineWidth, caches)];
  const { arrowheads } = resolved;
  const last = coordinates.length - 1;

  if (arrowheads === "start" || arrowheads === "both") {
    const neighbor = distinctNeighbor(coordinates, 0, 1);
    if (neighbor) {
      styles.push(
        arrowheadStyle(
          coordinates[0],
          neighbor,
          resolved.lineColor,
          resolved.lineWidth,
        ),
      );
    }
  }
  if (arrowheads === "end" || arrowheads === "both") {
    const neighbor = distinctNeighbor(coordinates, last, -1);
    if (neighbor) {
      styles.push(
        arrowheadStyle(
          coordinates[last],
          neighbor,
          resolved.lineColor,
          resolved.lineWidth,
        ),
      );
    }
  }
  return styles;
}

function textStyles(text, resolved, caches) {
  const content = String(text ?? "");
  if (content.trim() === "") return [];
  const key = [
    content,
    resolved.textColor,
    resolved.textSize,
    resolved.haloColor,
    resolved.textAnchor,
  ].join("|");
  let style = caches.text.get(key);
  if (!style) {
    const anchor = resolveAnchor(resolved.textAnchor, labelAnchorPadding);
    style = new Style({
      text: new Text({
        text: content,
        font: composeLabelFont(resolved.textSize),
        fill: new Fill({ color: resolved.textColor }),
        stroke: new Stroke({
          color: resolved.haloColor,
          width: haloWidthForSize(resolved.textSize),
        }),
        textAlign: anchor.textAlign,
        textBaseline: anchor.textBaseline,
        offsetX: anchor.offsetX,
        offsetY: anchor.offsetY,
        // An annotation is placed on purpose; never hide it for running off
        // the edge of its point, and never declutter it.
        overflow: true,
      }),
    });
    caches.text.set(key, style);
  }
  return [style];
}

/**
 * Styles for one annotation feature against a layer's defaults. Never throws:
 * a throw inside an OpenLayers style function takes down the whole layer, so a
 * malformed feature draws nothing instead.
 */
export function annotationFeatureStyles(
  feature,
  defaults,
  caches = createCaches(),
) {
  try {
    const geometry = feature?.getGeometry?.();
    if (!geometry) return [];
    const resolved = resolveAnnotationStyle(
      defaults,
      feature.get(ANNOTATION_STYLE_KEY),
    );
    const kind = feature.get(ANNOTATION_KIND_KEY);
    if (kind === "text") {
      return textStyles(feature.get(ANNOTATION_TEXT_KEY), resolved, caches);
    }
    if (kind === "line") {
      return lineStyles(geometry, resolved, caches);
    }
    return [];
  } catch {
    return [];
  }
}

/** The style function for an Annotations layer with the given defaults. */
export function createAnnotationStyleFunction(defaults) {
  const caches = createCaches();
  return (feature) => annotationFeatureStyles(feature, defaults, caches);
}
