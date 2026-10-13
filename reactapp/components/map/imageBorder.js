import { getRenderPixel } from "ol/render";
import { apply as applyTransform } from "ol/transform";
import { equivalent, get as getProjection, getTransform } from "ol/proj";
import { unByKey } from "ol/Observable";
import { isTransparentColor } from "components/inputs/ColorPicker";

// Border width, in screen pixels, when none is saved.
export const DEFAULT_BORDER_WIDTH = 2;
export const MIN_BORDER_WIDTH = 1;
// Guards against a typo turning the border into a slab over the image.
export const MAX_BORDER_WIDTH = 50;

// The source props a static image's border is saved under.
export const BORDER_PROP_KEYS = ["borderColor", "borderWidth"];

// Static image source props that are not ImageStatic options: the border, and
// the extent editor's aspect-ratio lock. The Source pane edits them outside
// its property table, and the loader lifts them out before building the
// source.
export const STATIC_IMAGE_EXTRA_PROP_KEYS = [
  ...BORDER_PROP_KEYS,
  "keepAspectRatio",
];

// The OL property a Static Image source carries its normalized border under,
// for the ImageLayer built around it to draw.
export const IMAGE_BORDER_KEY = "imageBorder";

// Points sampled along each edge of a reprojected footprint, so a curved edge
// is traced rather than cut straight across.
const EDGE_SAMPLES = 16;

// The border to draw for saved `borderColor` / `borderWidth`, or null for no
// border. A width that is absent or not a number takes the default; a numeric
// width is clamped into [MIN_BORDER_WIDTH, MAX_BORDER_WIDTH].
export function normalizeBorder(color, width) {
  if (typeof color !== "string" || !color.trim() || isTransparentColor(color)) {
    return null;
  }
  const numeric =
    width === undefined || width === null || width === "" ? NaN : Number(width);
  const resolved = Number.isFinite(numeric)
    ? Math.min(MAX_BORDER_WIDTH, Math.max(MIN_BORDER_WIDTH, numeric))
    : DEFAULT_BORDER_WIDTH;
  return { color: color.trim(), width: resolved };
}

// The image's footprint as a closed ring in the view projection. When the
// image is in another projection its edges are densified before transforming,
// so the ring follows the reprojected image's actual outline.
export function footprintRing(extent, sourceProjection, viewProjection) {
  const [minX, minY, maxX, maxY] = extent;
  const corners = [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
  ];
  const source = getProjection(sourceProjection);
  const view = getProjection(viewProjection);
  if (!source || !view || equivalent(source, view)) return corners;

  const transform = getTransform(source, view);
  const ring = [];
  for (let i = 0; i < corners.length; i++) {
    const [x1, y1] = corners[i];
    const [x2, y2] = corners[(i + 1) % corners.length];
    for (let s = 0; s < EDGE_SAMPLES; s++) {
      const t = s / EDGE_SAMPLES;
      ring.push(transform([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]));
    }
  }
  return ring;
}

// A view coordinate's position on a render event's canvas, in canvas pixels.
export function toRenderPixel(event, coordinate) {
  return getRenderPixel(
    event,
    applyTransform(event.frameState.coordinateToPixelTransform, [
      ...coordinate,
    ]),
  );
}

function tracePath(context, pixels) {
  context.beginPath();
  pixels.forEach(([x, y], i) =>
    i === 0 ? context.moveTo(x, y) : context.lineTo(x, y),
  );
  context.closePath();
}

// Stroke `pixels` (a closed ring in canvas pixels) so the visible border lies
// inside the footprint: clip to the ring, then stroke at double width. Layer
// opacity is applied here because OpenLayers only applies it around the
// image's own drawImage call.
export function drawBorder(context, pixels, border, { opacity, pixelRatio }) {
  if (!border || pixels.length < 3) return;
  // A footprint edge outside the view projection's domain transforms to a
  // non-finite point, which would make a malformed clip path.
  if (!pixels.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))) {
    return;
  }
  context.save();
  context.globalAlpha = opacity;
  tracePath(context, pixels);
  context.clip();
  tracePath(context, pixels);
  context.lineWidth = 2 * border.width * pixelRatio;
  context.strokeStyle = border.color;
  context.lineJoin = "miter";
  context.stroke();
  context.restore();
}

// Draw `border` around `layer`'s image on every frame the layer renders.
// `extent` and `projection` describe the image's placement. Returns a function
// that removes the border.
export function attachImageBorder(layer, border, { extent, projection }) {
  if (!border || !extent) return () => {};
  let cachedViewCode = null;
  let cachedRing = null;

  const key = layer.on("postrender", (event) => {
    const frameState = event.frameState;
    if (!frameState || !event.context) return;
    const viewProjection = frameState.viewState.projection;
    const viewCode = viewProjection.getCode();
    if (viewCode !== cachedViewCode) {
      cachedRing = footprintRing(
        extent,
        projection ?? viewCode,
        viewProjection,
      );
      cachedViewCode = viewCode;
    }
    const pixels = cachedRing.map((coordinate) =>
      toRenderPixel(event, coordinate),
    );
    drawBorder(event.context, pixels, border, {
      opacity: layer.getOpacity(),
      pixelRatio: frameState.pixelRatio,
    });
  });
  return () => unByKey(key);
}

// Split a Static Image source config's extra settings (see
// STATIC_IMAGE_EXTRA_PROP_KEYS) from the props ImageStatic is built from,
// which would otherwise receive them. A config with none comes back as the
// same object, so a layer saved without them loads exactly as before.
export function splitStaticImageProps(config) {
  const props = config.props;
  if (!props || !STATIC_IMAGE_EXTRA_PROP_KEYS.some((key) => key in props)) {
    return { config, border: null };
  }
  // eslint-disable-next-line no-unused-vars
  const { borderColor, borderWidth, keepAspectRatio, ...sourceProps } = props;
  return {
    config: { ...config, props: sourceProps },
    border: normalizeBorder(borderColor, borderWidth),
  };
}

// Draw the border a static image source carries (see splitStaticImageProps) around
// the ImageLayer showing it. Returns a function that removes the border.
export function attachSourceBorder(layer) {
  const source = layer.getSource?.();
  const border = source?.get?.(IMAGE_BORDER_KEY);
  if (!border) return () => {};
  return attachImageBorder(layer, border, {
    extent: source.getImageExtent(),
    projection: source.getProjection(),
  });
}
