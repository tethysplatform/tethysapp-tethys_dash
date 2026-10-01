import { resolveRamp } from "./colorRamps";
import PropTypes from "prop-types";

const TRANSPARENT = [0, 0, 0, 0];

// Guards that run ahead of whichever coloring expression follows: nodata cells
// first, then anything the author asked to mask. Both are evaluated before the
// value is colored, so a masked cell never reaches the ramp or the class lookup.
//
// `maskBelow` is a raw data value, so it only means something when band 1 holds
// raw values. In normalized mode band 1 carries 0-1 scaled bytes and there is no
// range on hand to convert the threshold with, so it is skipped there — the
// render-time resolve rebuilds the style with a real range anyway.
function transparencyGuards({ hasNodata, maskBelow, isNormalized = false }) {
  const branches = [];
  if (hasNodata) {
    branches.push(["==", ["band", 2], 0], TRANSPARENT);
  }
  const maskValue = Number(maskBelow);
  const maskIsSet =
    maskBelow !== undefined && maskBelow !== null && maskBelow !== "";
  if (!isNormalized && maskIsSet && Number.isFinite(maskValue)) {
    branches.push(["<=", ["band", 1], maskValue], TRANSPARENT);
  }
  return branches;
}

// Color a raster by discrete class rather than a continuous ramp, for rasters
// whose values are labels (land cover, hazard class) where a gradient would
// imply a continuum between categories that does not exist.
//
// Values with no matching class fall through to `fallbackColor`, or become
// transparent when none is given. Because the mask guard is evaluated first, a
// class at or below `maskBelow` is hidden despite having a color — which is how
// a listed class gets hidden once a fallback color makes omission insufficient.
// A class needs a color and a genuinely numeric value. Blank is checked before
// Number(), because `Number("")` is 0 — a freshly added, unfilled row would
// otherwise silently become class 0 and shadow a real one.
export function isUsableClass(entry) {
  const value = entry?.value;
  if (value === undefined || value === null) return false;
  if (String(value).trim() === "") return false;
  return Number.isFinite(Number(value)) && Boolean(entry?.color);
}

export function buildCategoricalStyleColor({
  classes,
  hasNodata = false,
  maskBelow,
  fallbackColor,
}) {
  const usable = (classes ?? []).filter(isUsableClass);
  if (usable.length === 0) {
    throw new Error("At least one class with a value and color is required");
  }

  const matchExpr = ["match", ["band", 1]];
  for (const entry of usable) {
    matchExpr.push(Number(entry.value), entry.color);
  }
  matchExpr.push(fallbackColor || TRANSPARENT);

  const branches = transparencyGuards({ hasNodata, maskBelow });
  if (branches.length === 0) return matchExpr;
  return ["case", ...branches, matchExpr];
}

// The style modes that color by a class table rather than a ramp. Every caller
// that branches on the mode asks this rather than naming a mode, so a class
// mode added here is handled everywhere the table is.
//
// "categorical" colors exact values; "ranges" colors the interval each class's
// value closes. Both carry the same `classes` / `fallbackColor` fields and both
// need raw, un-interpolated band values, so they differ only in how the table
// compiles (see buildClassStyleColor).
export const CLASS_STYLE_MODES = ["categorical", "ranges"];

export function isClassStyleMode(mode) {
  return CLASS_STYLE_MODES.includes(mode);
}

// True when a raster source is styled by its class table: a class mode with at
// least one class that can be drawn. A class mode with an empty table falls
// back to the ramp, as it always has for Categorical.
export function hasClassStyle(source) {
  return (
    isClassStyleMode(source?.styleMode) &&
    (source.classes ?? []).some(isUsableClass)
  );
}

// The classes a Ranges style draws, in the order it tests them: usable ones
// only, ascending by numeric value (saved values are strings, so a string sort
// would put "10" before "2"), and with any bound repeating a lower one dropped
// -- a second class closing the same interval could never be reached.
export function sortedRangeClasses(classes) {
  const sorted = (classes ?? [])
    .filter(isUsableClass)
    .map((entry) => ({ entry, bound: Number(entry.value) }))
    .sort((a, b) => a.bound - b.bound);
  return sorted
    .filter((item, i) => i === 0 || item.bound !== sorted[i - 1].bound)
    .map(({ entry }) => entry);
}

// Color a continuous raster by value range: each class's value is the upper
// bound of its interval, and the previous class's value the lower one, so a
// cell takes the first class whose bound is at or above it -- (prev, value].
// The first class reaches down to whatever the guards leave (everything above
// `maskBelow`, when one is set). Values above the last bound take
// `fallbackColor`, or are transparent when none is given.
//
// Compiled as one `case` chain of `<=` tests in ascending order, after the same
// nodata and mask guards Categorical uses, so the mask still wins over a class.
export function buildRangesStyleColor({
  classes,
  hasNodata = false,
  maskBelow,
  fallbackColor,
}) {
  const ordered = sortedRangeClasses(classes);
  if (ordered.length === 0) {
    throw new Error("At least one class with a value and color is required");
  }

  const branches = transparencyGuards({ hasNodata, maskBelow });
  for (const entry of ordered) {
    branches.push(["<=", ["band", 1], Number(entry.value)], entry.color);
  }
  return ["case", ...branches, fallbackColor || TRANSPARENT];
}

// Compile a class-table style for whichever class mode the source is in.
export function buildClassStyleColor({ styleMode, ...options }) {
  return styleMode === "ranges"
    ? buildRangesStyleColor(options)
    : buildCategoricalStyleColor(options);
}

// The default legend's swatches for a class-table style: one per class, with
// its label, or its value when it has none. Ranges lists them in the order it
// draws them, ascending, and says what an unlabelled bound means.
export function classLegendItems(source) {
  if (source?.styleMode === "ranges") {
    return sortedRangeClasses(source.classes).map((entry) => ({
      color: entry.color,
      label: entry.label || `Up to ${entry.value}`,
      symbol: "square",
    }));
  }
  return (source?.classes ?? []).map((entry) => ({
    color: entry.color,
    label: entry.label || String(entry.value),
    symbol: "square",
  }));
}

buildCategoricalStyleColor.propTypes = {
  classes: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      color: PropTypes.string,
      label: PropTypes.string,
    }),
  ).isRequired,
  hasNodata: PropTypes.bool,
  maskBelow: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  // Color for values matching no class. Transparent when omitted.
  fallbackColor: PropTypes.string,
};

buildRangesStyleColor.propTypes = buildCategoricalStyleColor.propTypes;

export function buildGeoTIFFStyleColor({
  rampName,
  rampMin,
  rampMax,
  rampReverse = false,
  hasNodata = false,
  maskBelow,
}) {
  const colors = resolveRamp(rampName, rampReverse);
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

  const branches = transparencyGuards({ hasNodata, maskBelow, isNormalized });
  if (branches.length === 0) return interpolateExpr;
  return ["case", ...branches, interpolateExpr];
}

buildGeoTIFFStyleColor.propTypes = {
  rampName: PropTypes.string.isRequired,
  rampMin: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  rampMax: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  // Flip the ramp so its last color lands on the low end of the range.
  rampReverse: PropTypes.bool,
  hasNodata: PropTypes.bool,
  // Cells at or below this raw value render transparent.
  maskBelow: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
