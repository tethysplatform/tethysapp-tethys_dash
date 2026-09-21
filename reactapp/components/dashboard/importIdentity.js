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
// uuid and nothing else. The list is a vocabulary, not a dispatch table. It
// declares, per key, WHERE the key lives, WHEN it is applied and WHAT happens
// to it; the locators stay in the appliers below, because they do not
// generalize -- a `layerId` sits at `configuration.props` gated on
// `pluginSource`, a nested uuid at a popup grid item's root, and the view-group
// keys inside `map_extent` in any of its historical shapes. Adding a key costs
// a rule entry AND a locator. The payoff is that the scope and action of every
// key are declared in one readable place.
//
// Nothing here touches React or OpenLayers, so the rules are testable without
// mounting anything.

import { v4 as uuidv4 } from "uuid";
import {
  BUILT_IN_MAP_SOURCE,
  clearGridItemGroupInitialExtent,
  clearGridItemViewGroupSettings,
  normalizeViewGroupName,
  parseGridItemArgs,
  readViewGroupSettings,
} from "components/map/viewGroup";

/**
 * The identity rules, as a list rather than an object keyed by key name.
 *
 * `isGroupInitialExtent` needs two entries -- cleared on collision at the top
 * level, stripped outright inside a popup -- which a name-keyed object cannot
 * hold. Every rule carries:
 *
 *  - `key`       the identity field itself.
 *  - `position`  `"item"` for the grid item being processed, `"popup"` for one
 *                nested in a layer's `popupConfig.gridItems`. The same key can
 *                need different treatment at each, so position qualifies a rule
 *                as much as the key does. One key appears at most once per
 *                position.
 *  - `scope`     `"item"` when one grid item carries everything needed to
 *                decide, `"batch"` when the decision spans the whole import and
 *                the target dashboard. The two scopes are applied by the two
 *                appliers below, at different points in the import.
 *  - `action`    `"mint"` replaces the value with a fresh one, `"strip"` removes
 *                the key, `"clearOnCollision"` removes it only when something
 *                else already claims it.
 */
export const IDENTITY_RULES = [
  // A plugin-backed layer's runtime id. Re-minted, never preserved: the id from
  // the file addresses a layer in the dashboard it was exported from.
  { key: "layerId", position: "item", scope: "item", action: "mint" },
  // A popup-nested grid item's uuid is the request-id key for the
  // visualizations embedded in that popup, so duplicates are unsafe by
  // construction. Prophylactic rather than a fix for an observed defect.
  { key: "uuid", position: "popup", scope: "item", action: "mint" },
  // Popup layouts nest real grid items, so a nested map's layers have exactly
  // the same identity problem as a top-level map's.
  { key: "layerId", position: "popup", scope: "item", action: "mint" },
  // A map inside a popup layout never joins a view group (R27), and the group
  // discovery pass never scans popup subtrees -- so a group name left in there
  // would be invisible to enforcement while still sitting in saved config.
  // Stripping both keys outright is the only state the two readers agree on.
  { key: "viewGroup", position: "popup", scope: "item", action: "strip" },
  {
    key: "isGroupInitialExtent",
    position: "popup",
    scope: "item",
    action: "strip",
  },
  // At the top level the flag is kept unless something else already supplies
  // the group's opening view -- a co-imported sibling earlier in the batch, or
  // a member already on the target dashboard. Two stored flags would let a
  // later save of the losing map flip which map seeds the group.
  {
    key: "isGroupInitialExtent",
    position: "item",
    scope: "batch",
    action: "clearOnCollision",
  },
];

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
  return clearGridItemViewGroupSettings(normalized);
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
 * @param {boolean} descendPopups whether to apply the popup rules to each
 *   layer's popup layout
 * @returns {*} the normalized grid item, or the original reference
 */
function normalizeGridItemLayers(gridItem, descendPopups) {
  if (!isPlainObject(gridItem)) return gridItem;

  const read = readArgs(gridItem);
  if (!read || !Array.isArray(read.args.layers)) return gridItem;

  let changed = false;
  const layers = read.args.layers.map((layer) => {
    let next = mintLayerId(layer);
    if (descendPopups) next = normalizePopupSubtree(next);
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
 * The popup descent is opt-out for one caller only. Import re-mints nested
 * uuids because they are the request-id key for the visualizations embedded in
 * a popup, and an imported dashboard has no prior state keyed on them. A copy
 * does: popup-nested Live Chat messages are stored against the nested grid item
 * uuid (`tethysapp/tethysdash/model.py`), so re-minting on copy would silently
 * start the copy with an empty chat history.
 *
 * @param {*} gridItem the grid item to normalize
 * @param {object} [options]
 * @param {boolean} [options.descendPopups=true] false applies the top-level
 *   rules only, leaving every popup subtree exactly as it arrived
 * @returns {*} the normalized grid item, or the original reference when there
 *   was nothing to change
 */
export function applyItemIdentityRules(
  gridItem,
  { descendPopups = true } = {},
) {
  return normalizeGridItemLayers(gridItem, descendPopups);
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
