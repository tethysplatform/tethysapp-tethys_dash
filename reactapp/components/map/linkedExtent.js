import { transform } from "ol/proj.js";

// Pure footprint math for linked extent groups.
//
// A member publishes the ground its view currently covers as a closed ring of
// EPSG:4326 lon/lat points; a subscriber transforms the ring into its own view
// projection and draws it. The ring is densified before it leaves the member's
// projection, so a straight edge there bends correctly wherever it lands --
// a Web Mercator view outlined on a state-plane map is a skewed quadrilateral,
// not the rectangle its corners alone would suggest.
//
// Nothing here touches React or a live map.

export const LINKED_EXTENT_SOURCE_TYPE = "Linked Extents";
const EXCHANGE_PROJECTION = "EPSG:4326";

// Points added along each edge, corners excluded.
export const EDGE_DENSITY = 16;

/**
 * The four corners of a view's visible area in the view projection, walking
 * bottom-left, bottom-right, top-right, top-left. Rotation follows OpenLayers'
 * `getForViewAndSize`, so a rotated view gives the rotated rectangle it
 * actually shows rather than its bounding box.
 *
 * @returns {Array<Array<number>>|null} four corners, or null for no area
 */
export function viewCorners({ center, resolution, rotation = 0, size }) {
  if (
    !Array.isArray(center) ||
    !Number.isFinite(center[0]) ||
    !Number.isFinite(center[1]) ||
    !Number.isFinite(resolution) ||
    resolution <= 0 ||
    !Array.isArray(size) ||
    !(size[0] > 0) ||
    !(size[1] > 0)
  ) {
    return null;
  }
  const dx = (resolution * size[0]) / 2;
  const dy = (resolution * size[1]) / 2;
  const cos = Math.cos(rotation || 0);
  const sin = Math.sin(rotation || 0);
  const xCos = dx * cos;
  const xSin = dx * sin;
  const yCos = dy * cos;
  const ySin = dy * sin;
  const [x, y] = center;
  return [
    [x - xCos + ySin, y - xSin - yCos],
    [x + xCos + ySin, y + xSin - yCos],
    [x + xCos - ySin, y + xSin + yCos],
    [x - xCos - ySin, y - xSin + yCos],
  ];
}

/** A closed ring through the corners with `density` points on every edge. */
export function densifyRing(corners, density = EDGE_DENSITY) {
  const ring = [];
  for (let i = 0; i < corners.length; i += 1) {
    const [x0, y0] = corners[i];
    const [x1, y1] = corners[(i + 1) % corners.length];
    for (let step = 0; step <= density; step += 1) {
      const t = step / (density + 1);
      ring.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
  }
  ring.push(ring[0].slice());
  return ring;
}

/**
 * Shift each longitude by whole turns so consecutive points never jump by
 * more than 180 degrees. A view straddling the antimeridian then stays one
 * continuous ring instead of one that wraps the globe.
 */
export function unwrapLongitudes(ring) {
  const out = [];
  let previous = null;
  for (const [lon, lat] of ring) {
    let next = lon;
    if (previous !== null) {
      while (next - previous > 180) next -= 360;
      while (next - previous < -180) next += 360;
    }
    out.push([next, lat]);
    previous = next;
  }
  return out;
}

function transformRing(ring, from, to) {
  const out = [];
  for (const point of ring) {
    const [x, y] = transform(point, from, to);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    out.push([x, y]);
  }
  return out;
}

/**
 * A member's published footprint: its visible area as a densified EPSG:4326
 * ring, or null when it has no area or the ring cannot be expressed in lon/lat
 * (an unregistered projection, a view enclosing a pole). Null is published as
 * "nothing to outline" -- drawing a wrong outline is worse than none.
 */
export function viewFootprint({
  center,
  resolution,
  rotation,
  size,
  projection,
}) {
  const corners = viewCorners({ center, resolution, rotation, size });
  if (!corners || !projection) return null;
  let ring;
  try {
    ring = transformRing(densifyRing(corners), projection, EXCHANGE_PROJECTION);
  } catch {
    return null;
  }
  if (!ring) return null;
  const unwrapped = unwrapLongitudes(ring);
  // A ring around a pole cannot close in lon/lat: unwrapping walks it a full
  // turn, so its first and last points end up 360 degrees apart.
  const first = unwrapped[0];
  const last = unwrapped[unwrapped.length - 1];
  if (Math.abs(first[0] - last[0]) > 1e-6) return null;
  return unwrapped;
}

/**
 * A published ring in a subscriber's view projection, or null when it cannot
 * be transformed there.
 */
export function footprintInProjection(ring, projection) {
  if (!Array.isArray(ring) || ring.length < 4 || !projection) return null;
  try {
    return transformRing(ring, EXCHANGE_PROJECTION, projection);
  } catch {
    return null;
  }
}

/**
 * A key that changes exactly when the published footprint would. Comparing
 * the view inputs is cheaper than comparing densified rings every frame.
 */
export function footprintKey({
  center,
  resolution,
  rotation,
  size,
  projection,
}) {
  if (!Array.isArray(center) || !Array.isArray(size)) return "none";
  return [
    center[0],
    center[1],
    resolution,
    rotation || 0,
    size[0],
    size[1],
    projection,
  ].join("|");
}

/**
 * The members whose outlines a map should draw: every other member with a
 * footprint, minus those sharing this map's view group -- a peer that shares
 * the view would only ever outline this map's own view (R27 of the origin).
 */
export function outlinesToDraw(footprints, { selfIds, viewGroup }) {
  const excluded = new Set(selfIds?.filter(Boolean) ?? []);
  return (footprints ?? []).filter(
    (footprint) =>
      footprint.ring &&
      !excluded.has(footprint.memberId) &&
      !(viewGroup && footprint.viewGroup === viewGroup),
  );
}
