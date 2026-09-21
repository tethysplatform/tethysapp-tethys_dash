// Identity rules for grid items that arrive from outside the dashboard they are
// about to live in -- an import file, or a copy of an item already on the board.
//
// Identity fields in such a payload mean nothing here. A `layerId` authored in
// another dashboard names no layer in this one, and a hand-written or
// script-generated file can repeat one id across two layers, or omit it
// entirely -- which is the defect this module exists for: three independent
// consumers read a missing `layerId` as "not a runtime layer" and early-return,
// so the layer draws unstyled and nothing errors. The rules therefore re-mint
// rather than mint-if-missing: if every id is replaced there is no collision
// left to detect.
//
// The rules live in one list because two independent code paths apply them --
// the import chokepoint in `components/dashboard/DashboardItem.js` and the copy
// handler beside it -- and those two had already drifted: copy re-minted the
// grid item uuid and cleared the view-group flag, while import re-minted the
// uuid and nothing else. The keys this module owns, and what happens to each:
//
//   layerId               on every plugin-backed layer, top level and nested -- re-minted
//   uuid                  on every popup-nested grid item -- re-minted
//   viewGroup             on a popup-nested map -- stripped
//   isGroupInitialExtent  on a popup-nested map -- stripped
//                         on a top-level map -- cleared when the group is claimed
//
// The first four are decided from one grid item alone and applied by
// `applyItemIdentityRules`; the last spans the whole import and the target
// dashboard, so it is applied by `applyBatchIdentityRules` at the call sites,
// once every item has been processed. The locators stay in the appliers because
// they do not generalize -- a `layerId` sits at `configuration.props` gated on
// `pluginSource`, a nested uuid at a popup grid item's root, and the view-group
// keys inside `map_extent` in any of its historical shapes.
//
// Nothing here touches React or OpenLayers, so the rules are testable without
// mounting anything.

import { v4 as uuidv4 } from "uuid";
import {
  BUILT_IN_MAP_SOURCE,
  clearGridItemGroupInitialExtent,
  clearViewGroupSettings,
  normalizeViewGroupName,
  parseGridItemArgs,
  readViewGroupSettings,
} from "components/map/viewGroup";

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * Read a grid item's args in whichever representation they arrived in.
 *
 * The two callers disagree. Inside `handleGridItemImport` the args have already
 * been parsed into an object; `copyGridItem` hands over a live grid item whose
 * `args_string` is still a JSON string. An applier written against one shape
 * would silently no-op for the other while every byte-identical assertion still
 * passed, so the representation is recorded here and restored on the way out.
 *
 * @param {*} gridItem
 * @returns {{args: object, wasString: boolean}|null} null when the args are
 *   missing or uninterpretable, which leaves the grid item untouched
 */
function readArgs(gridItem) {
  const raw = gridItem?.args_string;
  if (typeof raw === "string") {
    const parsed = parseGridItemArgs(raw);
    return parsed ? { args: parsed, wasString: true } : null;
  }
  return isPlainObject(raw) ? { args: raw, wasString: false } : null;
}

/**
 * Re-mint one layer's runtime id, when it has one to re-mint.
 *
 * `pluginSource` is the gate the runtime consumers themselves use, so a layer
 * without one is returned by reference: eleven import tests compare whole
 * `args_string` strings byte for byte, and leaving static layers alone is what
 * keeps them passing.
 *
 * @param {*} layer one entry of a map's `layers` array
 * @returns {*} the layer with a fresh id, or the original reference
 */
function mintLayerId(layer) {
  const props = layer?.configuration?.props;
  if (!isPlainObject(props) || !props.pluginSource) return layer;

  return {
    ...layer,
    configuration: {
      ...layer.configuration,
      props: { ...props, layerId: uuidv4() },
    },
  };
}

/**
 * Normalize one grid item nested in a layer's popup layout.
 *
 * Its uuid is re-minted, the layer rules are applied to it as to any other map,
 * and its view-group membership is stripped.
 *
 * @param {*} nested a popup grid item
 * @returns {*} the normalized grid item, or the original reference
 */
function normalizePopupGridItem(nested) {
  if (!isPlainObject(nested)) return nested;

  let normalized = { ...nested, uuid: uuidv4() };
  // Deliberately not descended into again: popup-within-popup nesting is out
  // of scope, and one level is what every scenario covers.
  normalized = normalizeGridItemLayers(normalized, false);
  return stripViewGroup(normalized);
}

/**
 * Remove a nested map's view-group membership.
 *
 * A map inside a popup layout never joins a group, and `discoverGroupSeeds`
 * never scans popup subtrees -- so a group name or seed flag left down here
 * would sit in saved config where the enforcement pass cannot see it.
 *
 * Reads the args through `readArgs` rather than a grid-item-level viewGroup
 * helper, because those parse `args_string` as a string only: a hand-authored
 * file may nest an item whose args arrived already parsed, and the strip has to
 * work on both representations like the rest of this module.
 *
 * @param {*} gridItem a popup grid item
 * @returns {*} the grid item without group keys, or the original reference
 */
function stripViewGroup(gridItem) {
  if (gridItem?.source !== BUILT_IN_MAP_SOURCE) return gridItem;

  const read = readArgs(gridItem);
  if (!read) return gridItem;

  const mapExtent = clearViewGroupSettings(read.args.map_extent);
  if (mapExtent === read.args.map_extent) return gridItem;

  const nextArgs = { ...read.args, map_extent: mapExtent };
  return {
    ...gridItem,
    args_string: read.wasString ? JSON.stringify(nextArgs) : nextArgs,
  };
}

/**
 * Apply the popup rules to one layer's popup layout.
 *
 * A `popupConfig` with no `gridItems` key at all is the common case -- that is
 * a table-mode popup -- so an absent or non-array `gridItems` is a normal path,
 * not an error, and returns the layer by reference.
 *
 * @param {*} layer one entry of a map's `layers` array
 * @returns {*} the layer with its popup subtree normalized, or the original
 */
function normalizePopupSubtree(layer) {
  const nestedItems = layer?.popupConfig?.gridItems;
  if (!Array.isArray(nestedItems)) return layer;

  let changed = false;
  const normalized = nestedItems.map((nested) => {
    const next = normalizePopupGridItem(nested);
    if (next !== nested) changed = true;
    return next;
  });
  if (!changed) return layer;

  return {
    ...layer,
    popupConfig: { ...layer.popupConfig, gridItems: normalized },
  };
}

/**
 * Walk one grid item's `layers`, applying the layer identity rules.
 *
 * Total by construction: a grid item whose args are missing, do not parse, or
 * carry no `layers` array is returned by reference rather than rewritten. That
 * reference discipline is load-bearing throughout the view-group code -- some
 * callers compare by identity to tell whether anything changed.
 *
 * @param {*} gridItem
 * @param {boolean} [descend=true] false stops at this item's own layers and
 *   leaves their popup layouts alone. Only the popup walk passes false, to hold
 *   the recursion to one level -- popup-within-popup nesting is out of scope.
 * @returns {*} the normalized grid item, or the original reference
 */
function normalizeGridItemLayers(gridItem, descend = true) {
  if (!isPlainObject(gridItem)) return gridItem;

  const read = readArgs(gridItem);
  if (!read || !Array.isArray(read.args.layers)) return gridItem;

  let changed = false;
  const layers = read.args.layers.map((layer) => {
    let next = mintLayerId(layer);
    if (descend) next = normalizePopupSubtree(next);
    if (next !== layer) changed = true;
    return next;
  });
  if (!changed) return gridItem;

  const nextArgs = { ...read.args, layers };
  return {
    ...gridItem,
    args_string: read.wasString ? JSON.stringify(nextArgs) : nextArgs,
  };
}

/**
 * Apply every `scope: "item"` rule to one grid item.
 *
 * Re-mints the runtime id of each plugin-backed layer, then descends into each
 * layer's popup layout to re-mint the nested grid item uuids, re-mint the
 * nested layers' ids, and strip view-group membership from the nested maps.
 *
 * Normalizes on entry and restores on exit: `args_string` may arrive as a JSON
 * string or as an already-parsed object, and comes back in whichever form it
 * arrived in.
 *
 * Total: any subtree it cannot interpret is left alone and the grid item is
 * returned unchanged. It never throws.
 *
 * Every caller descends, import and copy alike. A nested uuid is the request-id
 * key for the visualizations embedded in that popup, so two subtrees sharing one
 * would cross-deliver progress and loading messages whenever both popups are
 * open. Nothing durable is keyed on it: popup grid items live inside the parent
 * item's `args_string` and never become rows of their own, so the server cannot
 * associate state -- Live Chat included -- with a nested uuid.
 *
 * @param {*} gridItem the grid item to normalize
 * @returns {*} the normalized grid item, or the original reference when there
 *   was nothing to change
 */
export function applyItemIdentityRules(gridItem) {
  return normalizeGridItemLayers(gridItem);
}

/**
 * Collect the group names already claimed by the target dashboard.
 *
 * Accepts any non-string iterable -- an array, a Set, or the keys of the seed
 * map `discoverGroupSeeds` returns. Membership is decided by name alone, never
 * by seed value: a flagged member whose extent does not parse seeds null but
 * still claims its group.
 *
 * @param {*} targetGroupNames
 * @returns {Set<string>} the normalized claimed names
 */
function claimedGroupNames(targetGroupNames) {
  const claimed = new Set();
  if (
    !targetGroupNames ||
    typeof targetGroupNames === "string" ||
    typeof targetGroupNames[Symbol.iterator] !== "function"
  ) {
    return claimed;
  }
  for (const name of targetGroupNames) {
    const normalized = normalizeViewGroupName(name);
    if (normalized) claimed.add(normalized);
  }
  return claimed;
}

/**
 * Apply every `scope: "batch"` rule across one whole import.
 *
 * At most one member of a view group may be flagged as the group's initial
 * extent. The first flagged member of each group in batch order keeps its flag;
 * every later one is cleared, as is any flagged member of a group the target
 * dashboard already supplies a flagged member for. A per-item check cannot do
 * this: it cannot see co-imported siblings.
 *
 * Positional and pure. At this point the processed items have no stable
 * identity -- uuid and `i` are minted afterwards -- and the modal re-associates
 * items to tabs by slice position, so the output array is the same length and
 * the same order as its input, always. Unparseable and non-map items pass
 * through untouched, and nothing throws.
 *
 * @param {*} gridItems the flat array of processed grid items, in batch order
 * @param {Iterable<string>} [targetGroupNames] group names the target dashboard
 *   already has a flagged member for; empty on the whole-dashboard path, which
 *   always creates a new dashboard
 * @returns {*} a same-length, same-order array, or the input when it is not one
 */
export function applyBatchIdentityRules(gridItems, targetGroupNames) {
  if (!Array.isArray(gridItems)) return gridItems;

  const claimed = claimedGroupNames(targetGroupNames);

  return gridItems.map((gridItem) => {
    // R19: only the built-in Map carries a stored extent that can seed a group.
    // A plugin map's extent does not exist until the plugin has run.
    if (gridItem?.source !== BUILT_IN_MAP_SOURCE) return gridItem;

    const args = parseGridItemArgs(gridItem.args_string);
    const settings = readViewGroupSettings(args?.map_extent);
    if (!settings.viewGroup || !settings.isInitialExtent) return gridItem;

    if (claimed.has(settings.viewGroup)) {
      return clearGridItemGroupInitialExtent(gridItem);
    }
    claimed.add(settings.viewGroup);
    return gridItem;
  });
}
