import { getRenderPixel } from "ol/render";
import { apply as applyTransform } from "ol/transform";
import { equivalent, get as getProjection, getTransform } from "ol/proj";
import { unByKey } from "ol/Observable";

// Border width, in screen pixels, when none is saved.
export const DEFAULT_BORDER_WIDTH = 2;
export const MIN_BORDER_WIDTH = 1;
// Guards against a typo turning the border into a slab over the image.
export const MAX_BORDER_WIDTH = 50;

// Points sampled along each edge of a reprojected footprint, so a curved edge
// is traced rather than cut straight across.
const EDGE_SAMPLES = 16;

// True for a hex color whose alpha is zero ("#rrggbb00" or "#rgb0") -- the
// picker's "no border" value.
export function isTransparentColor(color) {
  if (typeof color !== "string") return false;
  const hex = color.trim();
  return /^#[0-9a-f]{8}$/i.test(hex)
    ? hex.slice(7).toLowerCase() === "00"
    : /^#[0-9a-f]{4}$/i.test(hex) && hex[4] === "0";
}

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
      getRenderPixel(
        event,
        applyTransform(frameState.coordinateToPixelTransform, [...coordinate]),
      ),
    );
    drawBorder(event.context, pixels, border, {
      opacity: layer.getOpacity(),
      pixelRatio: frameState.pixelRatio,
    });
  });
  return () => unByKey(key);
}
