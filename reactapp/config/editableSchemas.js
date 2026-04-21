// R7 LLM-editable-path whitelist — canonical source is editableSchemas.json.
//
// The JSON file is the single source of truth; this module is a thin import
// shim for JS consumers. The Python side loads the same JSON directly
// (tethysapp/tethysdash/editable_schemas.py), so JS and Python cannot drift.
//
// Format: { "<viz source name>": [ "<JSON Pointer prefix>", ... ] }
//
// Matching semantics (see isPathAllowed): a path P is allowed for a given
// source if, for any prefix P_i in the list, P === P_i OR P starts with
// P_i + "/". Structural segment match — RFC 6901 literal dots in segment
// names (e.g., "variable_options_source.metadata") are preserved as single
// segments; do not split on ".".
//
// Not in scope this iteration: Text, Custom Image, render_plugin viz types,
// render_custom_visualization. These fall through to fail-closed rejection.

import LLM_EDITABLE_PATHS from "./editableSchemas.json";

/**
 * Check whether a JSON Pointer path is whitelisted for the given viz source.
 *
 * @param {string} source - viz source name (e.g., "Map", "Inline Plotly")
 * @param {string} jsonPointer - RFC 6901 JSON Pointer path (e.g., "/args/title")
 * @returns {boolean} true if the path is allowed; false otherwise
 */
export function isPathAllowed(source, jsonPointer) {
  const prefixes = LLM_EDITABLE_PATHS[source];
  if (!prefixes) return false;
  for (const prefix of prefixes) {
    if (jsonPointer === prefix) return true;
    if (jsonPointer.startsWith(prefix + "/")) return true;
  }
  return false;
}

export { LLM_EDITABLE_PATHS };
export default LLM_EDITABLE_PATHS;
