import { COLOR_RAMPS } from "./colorRamps";
import PropTypes from "prop-types";

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

  return ["case", ["==", ["band", 2], 0], [0, 0, 0, 0], interpolateExpr];
}

buildGeoTIFFStyleColor.propTypes = {
  rampName: PropTypes.string.isRequired,
  rampMin: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  rampMax: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  hasNodata: PropTypes.bool,
};
