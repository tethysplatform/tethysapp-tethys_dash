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

// Grid item `source` for the built-in Map visualization. A plugin-supplied map
// carries the plugin's own source name instead, and its extent only exists once
// the plugin has run -- so it can never supply a group's opening view (R19).
export const BUILT_IN_MAP_SOURCE = "Map";

// A stored extent still carrying a variable token has no value until the
// dashboard's variable inputs resolve, which may be long after load and may
// never happen at all. Such an extent seeds nothing (R4).
const VARIABLE_TOKEN_PATTERN = /\$\{[^}]+\}/;

/**
 * Parse a stored extent string into the seed a group opens at.
 *
 * The two shapes the map itself accepts are both handled, and in the same
 * coordinate space the map reads them in: the numbers are view coordinates in
 * the map's own projection, never lon/lat awaiting a transform.
 *
 *  - three parts, `x,y,zoom` -- a center and a zoom level, resolvable by any
 *    member on its own because it needs no viewport size.
 *  - four parts, `minX,minY,maxX,maxY` -- a bounding box, which only resolves
 *    against a viewport size and so is resolved by the first member that has
 *    one (AE11).
 *
 * @param {*} extent the stored extent string
 * @returns {{type: "center", center: Array<number>, zoom: number}
 *          |{type: "bbox", bbox: Array<number>}
 *          |null} null when the extent seeds nothing
 */
export function parseSeedExtent(extent) {
  if (typeof extent !== "string") return null;
  const trimmed = extent.trim();
  if (trimmed === "" || VARIABLE_TOKEN_PATTERN.test(trimmed)) return null;

  const parts = trimmed.split(",").map((part) => parseFloat(part.trim()));
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 3) {
    return { type: "center", center: [parts[0], parts[1]], zoom: parts[2] };
  }
  if (parts.length === 4) return { type: "bbox", bbox: parts };
  return null;
}

const parseArgs = (argsString) => {
  if (typeof argsString !== "string" || argsString.trim() === "") return null;
  try {
    const parsed = JSON.parse(argsString);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    // A grid item whose args do not parse simply supplies no seed. Every other
    // grid item on the dashboard must still be scanned.
    return null;
  }
};

/**
 * Scan a dashboard's tabs for the members flagged to supply their group's
 * opening view.
 *
 * This is the provider's job rather than a member's: the flagged map may sit on
 * a tab that has never mounted, so it would never register and could never seed
 * itself, and no map component can read another grid item's stored extent.
 *
 * Duplicate flags on one group are resolved in tab-then-grid order and the rest
 * ignored (R28) -- including when the winner's own extent seeds nothing, so the
 * outcome does not depend on which flagged member happens to be parseable.
 *
 * @param {Array<object>} tabs the dashboard's tabs, in their stored order
 * @returns {Map<string, object|null>} group name to seed, or null for a group
 *   whose flagged member supplies no usable extent
 */
export function discoverGroupSeeds(tabs) {
  const seeds = new Map();
  if (!Array.isArray(tabs)) return seeds;

  tabs.forEach((tab) => {
    const gridItems = Array.isArray(tab?.gridItems) ? tab.gridItems : [];
    gridItems.forEach((gridItem) => {
      // R19: a plugin map's extent does not exist until the plugin has run.
      if (!gridItem || gridItem.source !== BUILT_IN_MAP_SOURCE) return;
      const args = parseArgs(gridItem.args_string);
      if (!args) return;
      const settings = readViewGroupSettings(args.map_extent);
      if (!settings.viewGroup || !settings.isInitialExtent) return;
      if (seeds.has(settings.viewGroup)) return;
      seeds.set(settings.viewGroup, parseSeedExtent(settings.extent));
    });
  });

  return seeds;
}
