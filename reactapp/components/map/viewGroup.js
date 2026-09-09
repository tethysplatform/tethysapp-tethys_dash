// Pure helpers for linked map view groups.
//
// Nothing here touches React or OpenLayers so the rules that decide whether two
// maps are "in the same group" and whether two views are "the same view" can be
// tested on their own, and reused by the registry, the map, and the editor.

// A published center is considered unchanged while it stays within half a
// rendered pixel, which at a given resolution is `resolution * 0.5` map units.
export const CENTER_TOLERANCE_PIXELS = 0.5;
// Resolutions compare equal within 0.1% of the larger of the two.
export const RESOLUTION_TOLERANCE_RATIO = 0.001;
// Rotations compare equal within 1e-6 radians.
export const ROTATION_TOLERANCE_RADIANS = 1e-6;

const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Normalize a raw view group name.
 *
 * Names are trimmed and compared case-SENSITIVELY, so "Basin" and " Basin "
 * are one group while "basin" is another. An empty or whitespace-only name
 * means "no group" and returns null.
 *
 * @param {*} name raw name, typically straight off stored grid item args
 * @returns {string|null} the normalized name, or null for "no group"
 */
export function normalizeViewGroupName(name) {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Compare two centers with a resolution-relative tolerance: they are equal
 * while both components sit within half a pixel at the given resolution.
 *
 * @param {Array<number>} centerA
 * @param {Array<number>} centerB
 * @param {number} resolution map units per pixel to size the tolerance with
 * @returns {boolean}
 */
export function centersAreEqual(centerA, centerB, resolution) {
  if (!Array.isArray(centerA) || !Array.isArray(centerB)) {
    // Two missing centers are "equal"; one missing center is not.
    return (
      (centerA === null || centerA === undefined) &&
      (centerB === null || centerB === undefined)
    );
  }
  if (
    !isFiniteNumber(centerA[0]) ||
    !isFiniteNumber(centerA[1]) ||
    !isFiniteNumber(centerB[0]) ||
    !isFiniteNumber(centerB[1])
  ) {
    return false;
  }
  const tolerance =
    isFiniteNumber(resolution) && resolution > 0
      ? resolution * CENTER_TOLERANCE_PIXELS
      : 0;
  return (
    Math.abs(centerA[0] - centerB[0]) <= tolerance &&
    Math.abs(centerA[1] - centerB[1]) <= tolerance
  );
}

/**
 * Compare two resolutions within RESOLUTION_TOLERANCE_RATIO of the larger one.
 *
 * @param {number} resolutionA
 * @param {number} resolutionB
 * @returns {boolean}
 */
export function resolutionsAreEqual(resolutionA, resolutionB) {
  if (!isFiniteNumber(resolutionA) || !isFiniteNumber(resolutionB)) {
    return resolutionA === resolutionB;
  }
  const scale = Math.max(Math.abs(resolutionA), Math.abs(resolutionB));
  return (
    Math.abs(resolutionA - resolutionB) <= scale * RESOLUTION_TOLERANCE_RATIO
  );
}

/**
 * Compare two rotations within ROTATION_TOLERANCE_RADIANS. A missing rotation
 * reads as 0, which is what an OpenLayers view reports when unrotated.
 *
 * @param {number} rotationA
 * @param {number} rotationB
 * @returns {boolean}
 */
export function rotationsAreEqual(rotationA, rotationB) {
  const a = isFiniteNumber(rotationA) ? rotationA : 0;
  const b = isFiniteNumber(rotationB) ? rotationB : 0;
  return Math.abs(a - b) <= ROTATION_TOLERANCE_RADIANS;
}

/**
 * Compare two `{center, resolution, rotation}` view states with the
 * tolerances above. The tolerance for the center is sized off the second
 * (current) view's resolution, falling back to the first's.
 *
 * @param {object|null} viewA
 * @param {object|null} viewB
 * @returns {boolean}
 */
export function viewsAreEqual(viewA, viewB) {
  if (!viewA || !viewB) return !viewA && !viewB;
  const resolution = isFiniteNumber(viewB.resolution)
    ? viewB.resolution
    : viewA.resolution;
  return (
    resolutionsAreEqual(viewA.resolution, viewB.resolution) &&
    rotationsAreEqual(viewA.rotation, viewB.rotation) &&
    centersAreEqual(viewA.center, viewB.center, resolution)
  );
}

const firstString = (...values) => {
  for (const value of values) {
    if (typeof value === "string") return value;
  }
  return null;
};

/**
 * Read the view group settings out of a stored `map_extent` value.
 *
 * The stored value has accumulated three shapes over time and all three are
 * still in dashboards: a bare extent string, `{extent}`, and
 * `{extent, variable}` -- plus the doubly-nested `{extent: {extent, variable}}`
 * form the map itself tolerates. The group keys are read off the outer object
 * first and off the nested one as a fallback, so an older writer that kept the
 * whole value one level down still resolves.
 *
 * @param {*} mapExtent the stored map extent value in any of its shapes
 * @returns {{extent: string|null, variable: string|null,
 *            viewGroup: string|null, isInitialExtent: boolean}}
 */
export function readViewGroupSettings(mapExtent) {
  const settings = {
    extent: null,
    variable: null,
    viewGroup: null,
    isInitialExtent: false,
  };
  if (!mapExtent) return settings;

  if (typeof mapExtent === "string") {
    settings.extent = mapExtent;
    return settings;
  }
  if (typeof mapExtent !== "object" || Array.isArray(mapExtent)) {
    return settings;
  }

  const nested =
    mapExtent.extent &&
    typeof mapExtent.extent === "object" &&
    !Array.isArray(mapExtent.extent)
      ? mapExtent.extent
      : null;

  settings.extent = firstString(nested ? nested.extent : mapExtent.extent);
  settings.variable = firstString(
    mapExtent.variable,
    nested ? nested.variable : null,
  );
  settings.viewGroup = normalizeViewGroupName(
    firstString(mapExtent.viewGroup, nested ? nested.viewGroup : null),
  );
  // A flag with no group name to apply it to is meaningless.
  settings.isInitialExtent =
    settings.viewGroup !== null &&
    Boolean(
      mapExtent.isGroupInitialExtent ??
        (nested ? nested.isGroupInitialExtent : undefined),
    );

  return settings;
}
