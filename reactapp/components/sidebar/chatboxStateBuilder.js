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
 * Build the full system-message payload for the chatbox beforeFirstMessage
 * injection. Returns null if there is nothing useful to inject — either
 * the dashboard has no grid items, or every item's source is outside the
 * whitelist (nothing patchable anyway).
 *
 * @param {Array} tabs - TabContext tabs array
 * @param {Object} variableInputValues - current variable input values
 * @returns {Object|null} {dashboard_state, editable_paths_by_source, variable_input_values}
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
    variable_input_values: variableInputValues || {},
  };
}
