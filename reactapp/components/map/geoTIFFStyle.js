// Builds the WebGLTile `style.color` interpolate expression for a GeoTIFF
// layer that has a curated color ramp applied.
//
// Expression form (per OpenLayers' WebGLTile style documentation):
//
//   ['interpolate', ['linear'], ['band', 1],
//     rampMin, stop0,
//     rampMin + (rampMax-rampMin)/255, stop1,
//     ...,
//     rampMax, stop255]
//
// where `stop0..stop255` are the 256 hex strings from COLOR_RAMPS[rampName].
// The result is a bare array — callers wrap it as `{ color: [...] }` before
// assigning to `configuration.style` at save time.
//
// This is a pure function: no React, no side effects, no IO.

import { COLOR_RAMPS } from "./colorRamps";

/**
 * Build the `style.color` interpolate expression array for a ramp-styled
 * GeoTIFF layer.
 *
 * When `hasNodata` is true, the returned expression is wrapped in a `case`
 * check against the alpha band (band 2). OpenLayers appends one alpha band
 * per SourceInfo that declares `nodata`, and substitutes 0 for the nodata
 * sentinel in the data band itself — so the shader MUST read the alpha band
 * to know which pixels are really nodata, otherwise those pixels would be
 * colorized as if they were valid 0s. `case`-wrapped expression returns a
 * transparent color for nodata pixels.
 *
 * @param {{ rampName: string, rampMin: number|string, rampMax: number|string, hasNodata?: boolean }} args
 * @returns {Array} The OL expression.
 * @throws {Error} When `rampName` is not a key of `COLOR_RAMPS`, or when
 *   `rampMin`/`rampMax` cannot be coerced to finite numbers.
 */
export function buildGeoTIFFStyleColor({
  rampName,
  rampMin,
  rampMax,
  hasNodata = false,
}) {
  const colors = COLOR_RAMPS[rampName];
  if (!colors) {
    throw new Error(`Unknown color ramp: ${rampName}`);
  }

  // Reject empty strings up front — `Number("")` silently returns 0, which
  // would otherwise pass the isFinite check and produce a degenerate expression
  // that doesn't match the user's (missing) intent.
  const minIsEmpty = typeof rampMin === "string" && rampMin.trim() === "";
  const maxIsEmpty = typeof rampMax === "string" && rampMax.trim() === "";
  const min = minIsEmpty ? NaN : Number(rampMin);
  const max = maxIsEmpty ? NaN : Number(rampMax);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error(
      `rampMin and rampMax must be finite numbers (got rampMin=${rampMin}, rampMax=${rampMax})`,
    );
  }

  const steps = colors.length;
  const interpolateExpr = ["interpolate", ["linear"], ["band", 1]];

  // Spread stops evenly across [min, max]. When min === max the expression
  // degenerates but remains a valid array — OL handles the clamp gracefully.
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    const value = min + (max - min) * t;
    interpolateExpr.push(value, colors[i]);
  }

  if (!hasNodata) return interpolateExpr;

  // Nodata wrapper: when the alpha band (band 2 for a single-band source with
  // nodata) is 0, return fully-transparent. Otherwise apply the ramp. The
  // `case` operator short-circuits, so the nodata branch doesn't incur the
  // interpolate shader cost for those pixels.
  return [
    "case",
    ["==", ["band", 2], 0],
    [0, 0, 0, 0],
    interpolateExpr,
  ];
}
