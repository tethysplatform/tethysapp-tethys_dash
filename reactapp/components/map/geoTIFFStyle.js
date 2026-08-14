import { COLOR_RAMPS } from "./colorRamps";
import PropTypes from "prop-types";

export function buildGeoTIFFStyleColor({
  rampName,
  rampMin,
  rampMax,
  hasNodata = false,
  maskBelow,
}) {
  const colors = COLOR_RAMPS[rampName];
  if (!colors) {
    throw new Error(`Unknown color ramp: ${rampName}`);
  }

  const minIsEmpty =
    rampMin == null || (typeof rampMin === "string" && rampMin.trim() === "");
  const maxIsEmpty =
    rampMax == null || (typeof rampMax === "string" && rampMax.trim() === "");

  const isNormalized = minIsEmpty && maxIsEmpty;

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

  const TRANSPARENT = [0, 0, 0, 0];
  const branches = [];
  if (hasNodata) {
    branches.push(["==", ["band", 2], 0], TRANSPARENT);
  }

  // `maskBelow` is a raw data value, so it only means something when the ramp
  // spans raw values. In normalized mode band 1 carries 0-1 scaled bytes and
  // there is no range on hand to convert the threshold with, so it is skipped —
  // the render-time resolve rebuilds this style with a real range anyway.
  const maskValue = Number(maskBelow);
  const maskIsSet =
    maskBelow !== undefined && maskBelow !== null && maskBelow !== "";
  if (!isNormalized && maskIsSet && Number.isFinite(maskValue)) {
    branches.push(["<=", ["band", 1], maskValue], TRANSPARENT);
  }

  if (branches.length === 0) return interpolateExpr;
  return ["case", ...branches, interpolateExpr];
}

buildGeoTIFFStyleColor.propTypes = {
  rampName: PropTypes.string.isRequired,
  rampMin: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  rampMax: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  hasNodata: PropTypes.bool,
  // Cells at or below this raw value render transparent.
  maskBelow: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
