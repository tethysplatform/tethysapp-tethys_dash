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
 * The nested container of a doubly-nested `{extent: {extent, ...}}` value.
 *
 * That form is the one shape whose group keys live a level down, so the reader
 * below and the flag-stripper further on both have to agree on exactly when
 * the inner value counts as a container. An array is never one: a stored
 * extent may legitimately be an array of numbers.
 *
 * @param {*} mapExtent a stored map extent value in any of its shapes
 * @returns {object|null} the nested container, or null when there is none
 */
export function nestedExtentContainer(mapExtent) {
  const nested = mapExtent?.extent;
  return nested && typeof nested === "object" && !Array.isArray(nested)
    ? nested
    : null;
}

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

  const nested = nestedExtentContainer(mapExtent);

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

// The synthetic tab the popup modal and the popup layout editor mount their
// reused `DashboardLayout` under. Those subtrees see the dashboard's providers,
// so view-group membership has to be declined explicitly (R27).
export const POPUP_TAB_ID = "popup";

/**
 * Whether a map may join a view group.
 *
 * The view half (`components/map/Map.js`) and the cursor half
 * (`components/visualizations/Map.js`) register with the group separately, so
 * the rule that decides membership lives here rather than in either of them:
 * the two halves must never be enabled independently of each other.
 *
 * R27: the DataViewer preview map and the popup-modal / popup-editor maps
 * never join a group. Neither does a map with no grid item UUID -- an unkeyed
 * member cannot be addressed, unregistered, or told apart from another unkeyed
 * one.
 *
 * @param {object} params
 * @param {string|null} params.viewGroupName the resolved group name, if any
 * @param {boolean} params.hasViewGroupContext whether a group provider is above
 * @param {boolean} params.dataviewerViz whether this is the DataViewer preview
 * @param {*} params.activeTabId the id of the tab the map is mounted under
 * @param {*} params.gridItemUUID the map's grid item UUID, if it has one
 * @returns {boolean}
 */
export function isViewGroupMember({
  viewGroupName,
  hasViewGroupContext,
  dataviewerViz,
  activeTabId,
  gridItemUUID,
}) {
  return Boolean(
    viewGroupName &&
    hasViewGroupContext &&
    !dataviewerViz &&
    activeTabId !== POPUP_TAB_ID &&
    gridItemUUID,
  );
}

// Grid item `source` for the built-in Map visualization. A plugin-supplied map
// carries the plugin's own source name instead, and its extent only exists once
// the plugin has run -- so it can never supply a group's opening view (R19).
export const BUILT_IN_MAP_SOURCE = "Map";

// A stored extent still carrying a variable token has no value until the
// dashboard's variable inputs resolve, which may be long after load and may
// never happen at all. Such an extent seeds nothing (R4).
//
// The pattern is deliberately permissive: variable input names routinely carry
// spaces (`${Basin Extent}` is the documented form), so anything but a closing
// brace counts as part of the name.
const VARIABLE_TOKEN_PATTERN = /\$\{[^}]+\}/;

/**
 * Whether a value still carries a `${...}` variable token.
 *
 * This is the single predicate for that question. The editor's extent field
 * and the seed parser below both have to answer it the same way -- a value one
 * of them reads as a literal extent and the other as a template produces a
 * group that either cannot be seeded or is seeded with a token.
 *
 * @param {*} value the value to test; a non-string never contains a token
 * @returns {boolean}
 */
export function containsVariableToken(value) {
  return typeof value === "string" && VARIABLE_TOKEN_PATTERN.test(value);
}

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
  if (trimmed === "" || containsVariableToken(trimmed)) return null;

  const parts = trimmed.split(",").map((part) => parseFloat(part.trim()));
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 3) {
    return { type: "center", center: [parts[0], parts[1]], zoom: parts[2] };
  }
  if (parts.length === 4) return { type: "bbox", bbox: parts };
  return null;
}

/**
 * Parse a grid item's stored `args_string`.
 *
 * A grid item whose args are missing or do not parse yields null rather than
 * throwing: it simply contributes nothing, and every other grid item on the
 * dashboard must still be processed.
 *
 * @param {*} argsString the grid item's stored `args_string`
 * @returns {object|null} the parsed args object, or null
 */
export function parseGridItemArgs(argsString) {
  if (typeof argsString !== "string" || argsString.trim() === "") return null;
  try {
    const parsed = JSON.parse(argsString);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

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
      const args = parseGridItemArgs(gridItem.args_string);
      if (!args) return;
      const settings = readViewGroupSettings(args.map_extent);
      if (!settings.viewGroup || !settings.isInitialExtent) return;
      if (seeds.has(settings.viewGroup)) return;
      seeds.set(settings.viewGroup, parseSeedExtent(settings.extent));
    });
  });

  return seeds;
}

/**
 * Strip the "this map supplies its group's initial extent" flag out of a
 * stored `map_extent` value, whichever of its historical shapes it arrived in
 * (bare string, `{extent}`, `{extent, variable}`, or the doubly nested
 * `{extent: {extent, ...}}` form).
 *
 * Returns the value it was given when there was no flag to clear, so callers
 * can compare by identity to tell whether anything changed.
 *
 * @param {*} mapExtent the stored map extent value
 * @returns {*} the value with the flag removed, or the original reference
 */
export function clearGroupInitialExtent(mapExtent) {
  if (!mapExtent || typeof mapExtent !== "object" || Array.isArray(mapExtent)) {
    return mapExtent;
  }

  const nested = nestedExtentContainer(mapExtent);
  const outerFlagged = "isGroupInitialExtent" in mapExtent;
  const nestedFlagged = nested !== null && "isGroupInitialExtent" in nested;
  if (!outerFlagged && !nestedFlagged) return mapExtent;

  const cleared = { ...mapExtent };
  delete cleared.isGroupInitialExtent;
  if (nestedFlagged) {
    const clearedNested = { ...nested };
    delete clearedNested.isGroupInitialExtent;
    cleared.extent = clearedNested;
  }
  return cleared;
}

/**
 * Strip the whole view-group membership -- the group name and the
 * initial-extent flag -- out of a stored `map_extent` value, in whichever of
 * its historical shapes it arrived.
 *
 * Used where a map can never join a group at all (R27: the popup subtrees), so
 * that a value written before that exclusion existed cannot linger in the
 * saved args.
 *
 * Returns the value it was given when there was nothing to strip, so callers
 * can compare by identity to tell whether anything changed.
 *
 * @param {*} mapExtent the stored map extent value
 * @returns {*} the value with the group keys removed, or the original reference
 */
export function clearViewGroupSettings(mapExtent) {
  if (!mapExtent || typeof mapExtent !== "object" || Array.isArray(mapExtent)) {
    return mapExtent;
  }

  const nested = nestedExtentContainer(mapExtent);
  const groupKeys = ["viewGroup", "isGroupInitialExtent"];
  const outerHas = groupKeys.some((key) => key in mapExtent);
  const nestedHas = nested !== null && groupKeys.some((key) => key in nested);
  if (!outerHas && !nestedHas) return mapExtent;

  const cleared = { ...mapExtent };
  groupKeys.forEach((key) => delete cleared[key]);
  if (nestedHas) {
    const clearedNested = { ...nested };
    groupKeys.forEach((key) => delete clearedNested[key]);
    cleared.extent = clearedNested;
  }
  return cleared;
}

/**
 * Clear the group initial-extent flag on one grid item.
 *
 * Only the built-in Map carries a stored extent to flag; a plugin map's extent
 * does not exist until the plugin has run, so it is left alone. A grid item
 * whose args do not parse is left alone too rather than being rewritten.
 *
 * @param {object} gridItem the grid item to clear
 * @returns {object} a new grid item with the flag cleared, or the original
 *   reference when there was nothing to clear
 */
export function clearGridItemGroupInitialExtent(gridItem) {
  if (!gridItem || gridItem.source !== BUILT_IN_MAP_SOURCE) return gridItem;

  const args = parseGridItemArgs(gridItem.args_string);
  if (!args) return gridItem;

  const mapExtent = clearGroupInitialExtent(args.map_extent);
  if (mapExtent === args.map_extent) return gridItem;

  return {
    ...gridItem,
    args_string: JSON.stringify({ ...args, map_extent: mapExtent }),
  };
}

/**
 * Enforce R28 across the whole dashboard: at most one member of a view group
 * may be flagged as the group's initial extent.
 *
 * The just-saved grid item is the winner, so every other member of the same
 * group -- on any tab, since a group spans tabs -- has its flag cleared. Only
 * the flag is touched; the losing members stay in the group.
 *
 * @param {Array<object>} tabs the complete tab list, already carrying the save
 * @param {string} groupName the saved map's view group name
 * @param {object} savedGridItem the grid item being saved, matched by identity
 * @returns {Array<object>} the tab list, with untouched tabs kept by reference
 */
export function enforceSingleGroupInitialExtent(
  tabs,
  groupName,
  savedGridItem,
) {
  const normalizedGroup = normalizeViewGroupName(groupName);
  if (!normalizedGroup || !Array.isArray(tabs)) return tabs;

  return tabs.map((tab) => {
    const gridItems = Array.isArray(tab?.gridItems) ? tab.gridItems : [];
    let tabChanged = false;

    const updatedGridItems = gridItems.map((gridItem) => {
      if (gridItem === savedGridItem) return gridItem;
      if (!gridItem || gridItem.source !== BUILT_IN_MAP_SOURCE) return gridItem;

      const args = parseGridItemArgs(gridItem.args_string);
      const settings = readViewGroupSettings(args?.map_extent);
      if (settings.viewGroup !== normalizedGroup || !settings.isInitialExtent) {
        return gridItem;
      }

      // The else cannot fire today: reaching here means the flag was read as
      // set, which means the key is present, which is exactly the condition
      // under which the clear returns a new grid item. Kept as a guard so the
      // two readers drifting apart cannot mark a tab changed for nothing.
      const cleared = clearGridItemGroupInitialExtent(gridItem);
      /* istanbul ignore else -- unreachable, see comment above */
      if (cleared !== gridItem) tabChanged = true;
      return cleared;
    });

    return tabChanged ? { ...tab, gridItems: updatedGridItems } : tab;
  });
}
