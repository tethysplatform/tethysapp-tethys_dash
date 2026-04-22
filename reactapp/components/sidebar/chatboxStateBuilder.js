// Pure helpers that build the system-prompt payload the chatbox injects
// before the first LLM call of each user turn. Separated from ChatSidebar
// so the logic is testable without mounting React contexts.
//
// The injection's job is to make the LLM's patch_visualization tool calls
// land on allowed paths without guessing. It carries three things:
//   - dashboard_state: one {uuid, source, vizType, title, tabId} per
//     grid item, so the LLM can resolve which viz the user meant.
//   - editable_paths_by_source: the whitelist prefixes for every source
//     type actually present in the current dashboard. Without these,
//     the LLM has no way to know paths must start with "/args/..." and
//     will try viz-native paths (e.g., "/layout/title" for Plotly).
//   - variable_input_values: current filter values, useful context when
//     the user's request references a filter.

import { LLM_EDITABLE_PATHS } from "../../config/editableSchemas";
import { baseMapLayers } from "../visualizations/utilities";

/**
 * Best-effort title extraction across viz types. Prefers top-level args.title
 * (map/variable_input/card), then the Plotly layout.title, then the Table
 * inlineData.title. Falls back to null.
 */
function extractTitle(args) {
  const title =
    args?.title ??
    args?.inlineData?.layout?.title ??
    args?.inlineData?.title ??
    null;
  return typeof title === "string" ? title.slice(0, 120) : null;
}

/**
 * Build a compact dashboard-state snapshot the LLM can reason over when
 * emitting patch_visualization tool calls.
 *
 * @param {Array} tabs - TabContext tabs array
 * @returns {Array} per-item {uuid, source, vizType, title, tabId}
 */
export function buildDashboardState(tabs) {
  if (!Array.isArray(tabs)) return [];
  const out = [];
  for (const tab of tabs) {
    if (!Array.isArray(tab?.gridItems)) continue;
    for (const item of tab.gridItems) {
      if (!item?.uuid) continue;
      let args = {};
      try {
        args = item.args_string ? JSON.parse(item.args_string) : {};
      } catch {
        // Skip items with unparseable args_string — they won't be patchable
        // anyway (reducer also guards on parse failure).
        continue;
      }
      out.push({
        uuid: item.uuid,
        source: item.source || "",
        vizType: args?.vizType || null,
        title: extractTitle(args),
        tabId: tab.id,
      });
    }
  }
  return out;
}

/**
 * Return the editable-path whitelist filtered to the sources actually
 * present in `items`. Keeps the injection small — a dashboard with only
 * plots doesn't need the map or variable-input whitelists in-context.
 *
 * Sources not in LLM_EDITABLE_PATHS (e.g., "Text", "Custom Image") are
 * omitted — they aren't patchable and telling the LLM otherwise would
 * just produce whitelist_rejected errors.
 *
 * @param {Array<{source?: string}>} items - dashboard_state entries
 * @returns {Object<string, string[]>} source name -> list of allowed prefixes
 */
export function buildEditablePathsBySource(items) {
  if (!Array.isArray(items)) return {};
  const out = {};
  for (const item of items) {
    const source = item?.source;
    if (!source || out[source]) continue;
    const prefixes = LLM_EDITABLE_PATHS[source];
    if (prefixes) out[source] = prefixes;
  }
  return out;
}

/**
 * Flatten the grouped ``baseMapLayers`` constant into a flat
 * ``[{label, value}, ...]`` list the LLM can scan directly.
 *
 * ``baseMapLayers`` is shaped as react-select option groups
 * (``[{label: "...", options: [{label, value}]}]``); the LLM doesn't need
 * the group headers.
 */
function flattenBaseMapOptions() {
  const out = [];
  for (const group of baseMapLayers) {
    if (Array.isArray(group?.options)) {
      for (const opt of group.options) {
        if (opt?.label && opt?.value) {
          out.push({ label: opt.label, value: opt.value });
        }
      }
    }
  }
  return out;
}

/**
 * Return per-source value-hint maps for whitelisted paths whose values are
 * drawn from a fixed catalog the LLM can't reliably guess.
 *
 * Today only ``/args/baseMap`` on ``Map`` qualifies: the persisted value is
 * a full ArcGIS MapServer URL, but users ask for "satellite" or "imagery".
 * Without this, the LLM emits a human-readable label, the reducer writes
 * it, and the renderer silently fails at ``Map.js`` because
 * ``getBaseMapLayer`` rejects anything without a ``/``.
 *
 * @param {Array<{source?: string}>} items - dashboard_state entries
 * @returns {Object} source -> path -> {description, options: [{label, value}]}
 */
export function buildValueHintsBySource(items) {
  if (!Array.isArray(items)) return {};
  const out = {};
  const sources = new Set(items.map((i) => i?.source).filter(Boolean));
  if (sources.has("Map")) {
    out.Map = {
      "/args/baseMap": {
        description:
          "Basemap URL from the ArcGIS catalog. Use `value` verbatim; " +
          "users refer to these by `label` (e.g., 'satellite' or " +
          "'imagery' means World Imagery).",
        options: flattenBaseMapOptions(),
      },
    };
  }
  return out;
}

/**
 * Build the full system-message payload for the chatbox beforeFirstMessage
 * injection. Returns null if there is nothing useful to inject — either
 * the dashboard has no grid items, or every item's source is outside the
 * whitelist (nothing patchable anyway).
 *
 * @param {Array} tabs - TabContext tabs array
 * @param {Object} variableInputValues - current variable input values
 * @returns {Object|null} {dashboard_state, editable_paths_by_source, value_hints_by_source, variable_input_values}
 */
export function buildPatchContext(tabs, variableInputValues) {
  const dashboardState = buildDashboardState(tabs);
  if (dashboardState.length === 0) return null;
  const editablePathsBySource = buildEditablePathsBySource(dashboardState);
  // If nothing in the dashboard is patchable, skip the injection — the
  // LLM has no use for it (and the create tools provide their own context).
  if (Object.keys(editablePathsBySource).length === 0) return null;
  return {
    dashboard_state: dashboardState,
    editable_paths_by_source: editablePathsBySource,
    value_hints_by_source: buildValueHintsBySource(dashboardState),
    variable_input_values: variableInputValues || {},
  };
}

/**
 * Build a per-turn in-turn-delta summary from the engine's pending state.
 *
 * Round-robin allocates ``budget`` slots across three categories so the LLM
 * always sees some entries from each bucket it touched (rather than e.g.
 * 30 created UUIDs and zero patched UUIDs when the budget is tight).
 * Includes an accurate ``_note`` with the total omitted count — NOT the
 * difference between total-and-budget, which was wrong when one bucket
 * alone fit under the budget (review COR-02).
 *
 * @param {string[]} createdUuids
 * @param {string[]} patchedUuids
 * @param {string[]} layerUpdateUuids
 * @param {number} budget - max distinct UUIDs to include across all categories
 * @returns {Object} {created_this_turn?, patched_this_turn?, layer_updates_this_turn?, _note?}
 */
export function buildDeltaSummary(
  createdUuids,
  patchedUuids,
  layerUpdateUuids,
  budget,
) {
  const take = { created: [], patched: [], layer: [] };
  const queues = [
    [createdUuids || [], take.created],
    [patchedUuids || [], take.patched],
    [layerUpdateUuids || [], take.layer],
  ];
  let remaining = budget;
  // Round-robin pull one from each non-empty queue until budget exhausted
  // or all queues are drained.
  // Bounded by max-rounds = budget to avoid pathological loop cases.
  for (let round = 0; round < budget && remaining > 0; round++) {
    let progressed = false;
    for (const [src, dest] of queues) {
      if (remaining <= 0) break;
      if (dest.length < src.length) {
        dest.push(src[dest.length]);
        remaining--;
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  const summary = {};
  if (take.created.length > 0) summary.created_this_turn = take.created;
  if (take.patched.length > 0) summary.patched_this_turn = take.patched;
  if (take.layer.length > 0) summary.layer_updates_this_turn = take.layer;
  const omitted =
    (createdUuids?.length || 0) - take.created.length +
    ((patchedUuids?.length || 0) - take.patched.length) +
    ((layerUpdateUuids?.length || 0) - take.layer.length);
  if (omitted > 0) {
    summary._note =
      `${omitted} earlier in-turn mutations omitted; ` +
      `full dashboard_state re-injects on the next user turn.`;
  }
  return summary;
}
