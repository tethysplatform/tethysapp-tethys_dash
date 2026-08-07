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

  const minIsEmpty =
    rampMin == null || (typeof rampMin === "string" && rampMin.trim() === "");
  const maxIsEmpty =
    rampMax == null || (typeof rampMax === "string" && rampMax.trim() === "");

  let min;
  let max;
  if (minIsEmpty && maxIsEmpty) {
    // Normalized mode: OL scales band 1 to [0,1] from the file's statistics.
    min = 0;
    max = 1;
  } else {
    min = minIsEmpty ? NaN : Number(rampMin);
    max = maxIsEmpty ? NaN : Number(rampMax);
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      throw new Error(
        `rampMin and rampMax must both be set or both empty (got rampMin=${rampMin}, rampMax=${rampMax})`,
      );
    }
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
  rampMin: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  rampMax: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  hasNodata: PropTypes.bool,
};
