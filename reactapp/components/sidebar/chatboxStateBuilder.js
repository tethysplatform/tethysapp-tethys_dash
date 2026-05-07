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

// Common per-layer fields available regardless of source type. Templates
// carry an "{N}" placeholder that extractMapLayers substitutes with the
// layer's actual index, so the LLM gets a copy-paste-safe absolute JSON
// Pointer rather than a relative fragment it has to assemble.
const COMMON_FIELD_PATH_TEMPLATES = {
  opacity: "/args/layers/{N}/configuration/props/opacity",
  visible: "/args/layers/{N}/configuration/layerVisibility",
};

// Source-type-specific field paths. Only sources whose persisted shape
// matches the standard `source.props.url` / `source.props.params` template
// are listed here. GeoJSON (data at source.geojson) and GeoTIFF (sources
// array at source.props.sources) deliberately omit shape-specific entries
// — common paths still apply, but their internal shape is non-standard
// and naming a wrong path is worse than naming none.
const SOURCE_FIELD_PATH_TEMPLATES = {
  "ESRI Image and Map Service": {
    url: "/args/layers/{N}/configuration/props/source/props/url",
    params: "/args/layers/{N}/configuration/props/source/props/params",
  },
  "ESRI Feature Service": {
    url: "/args/layers/{N}/configuration/props/source/props/url",
    params: "/args/layers/{N}/configuration/props/source/props/params",
  },
  WMS: {
    url: "/args/layers/{N}/configuration/props/source/props/url",
    params: "/args/layers/{N}/configuration/props/source/props/params",
  },
  KML: {
    url: "/args/layers/{N}/configuration/props/source/props/url",
  },
  "Image Tile": {
    url: "/args/layers/{N}/configuration/props/source/props/url",
  },
  "Vector Tile": {
    url: "/args/layers/{N}/configuration/props/source/props/url",
  },
  "PMTiles Vector": {
    url: "/args/layers/{N}/configuration/props/source/props/url",
  },
  "PMTiles Raster": {
    url: "/args/layers/{N}/configuration/props/source/props/url",
  },
  "Static Image": {
    url: "/args/layers/{N}/configuration/props/source/props/url",
  },
  // GeoJSON, GeoTIFF: common paths only — non-standard internal shape.
  GeoJSON: {},
  GeoTIFF: {},
};

function buildFieldPaths(sourceType, index) {
  // null source_type → no field_paths emitted at all (caller omits the key).
  if (typeof sourceType !== "string") return null;
  const sourceSpecific = SOURCE_FIELD_PATH_TEMPLATES[sourceType];
  if (sourceSpecific === undefined) {
    // Unknown source type — emit common paths only. The LLM can still
    // edit opacity/visibility without us having to recognize every plugin.
    return substituteIndex(COMMON_FIELD_PATH_TEMPLATES, index);
  }
  return substituteIndex(
    { ...COMMON_FIELD_PATH_TEMPLATES, ...sourceSpecific },
    index,
  );
}

function substituteIndex(templates, index) {
  const out = {};
  for (const [field, template] of Object.entries(templates)) {
    out[field] = template.replace("{N}", String(index));
  }
  return out;
}

/**
 * Per-layer summary for Map items. Names + indices + source-type + paths to
 * common editable fields — never persisted values (params, style, url, etc.).
 *
 * Without per-layer info the LLM has no way to construct precise
 * `/args/layers/N/...` patch paths. Without field_paths it knows the index
 * and source type but doesn't know that, e.g., `params` is nested at
 * `configuration.props.source.props.params`, not at `layer.params`. RFC 6902
 * `add` to `/args/layers/N/params` silently creates a top-level field the
 * renderer never reads — invisible failure.
 */
function extractMapLayers(args) {
  const layers = Array.isArray(args?.layers) ? args.layers : [];
  return layers.map((layer, index) => {
    const sourceType =
      typeof layer?.configuration?.props?.source?.type === "string"
        ? layer.configuration.props.source.type
        : null;
    const entry = {
      index,
      name:
        typeof layer?.configuration?.props?.name === "string"
          ? layer.configuration.props.name
          : null,
      source_type: sourceType,
    };
    const fieldPaths = buildFieldPaths(sourceType, index);
    if (fieldPaths) entry.field_paths = fieldPaths;
    return entry;
  });
}

/**
 * Build a compact dashboard-state snapshot the LLM can reason over when
 * emitting patch_visualization tool calls.
 *
 * @param {Array} tabs - TabContext tabs array
 * @returns {Array} per-item {uuid, source, vizType, title, tabId, layers?}
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
      const entry = {
        uuid: item.uuid,
        source: item.source || "",
        vizType: args?.vizType || null,
        title: extractTitle(args),
        tabId: tab.id,
      };
      if (item.source === "Map") {
        entry.layers = extractMapLayers(args);
      }
      out.push(entry);
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
export function buildEditablePathsBySource(items, pluginEditablePaths) {
  if (!Array.isArray(items)) return {};
  const pluginPaths = pluginEditablePaths || {};
  const out = {};
  for (const item of items) {
    const source = item?.source;
    if (!source || out[source]) continue;
    // Static built-in whitelist takes precedence so existing viz types
    // behave identically. Plugin-provided whitelists come from the server
    // (list_available_visualizations result cached at app load); the
    // server is authoritative for plugin sources per R9.
    const prefixes = LLM_EDITABLE_PATHS[source] || pluginPaths[source];
    if (prefixes && prefixes.length > 0) out[source] = prefixes;
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

// ---------------------------------------------------------------------------
// Plan 2026-05-07-005 (T2): per-source-type arg-routing templates.
//
// `add_map_service_layer` exposes overlapping dict-typed args (source_props,
// style, params, legend, popup_options, attribute_variables, layer_props).
// Smaller LLMs categorize source-type-specific keys into the wrong arg
// (observed: rampName/rampMin/rampMax landed in `style` instead of
// `source_props` for GeoTIFF — silent semantic failure since the renderer
// reads from source.<key>, not configuration.style.<key>).
//
// These templates name WHICH ARG should carry WHICH KEY for each source
// type. Hand-curated rather than registry-derived because the JS-side
// `sourcePropertiesOptions` registry in reactapp/components/map/utilities.js
// is currently lossy (e.g., GeoTIFF ramp fields exist in Python's
// `available_source_properties` but not in JS).
//
// Drift sources (canonical):
//   - tethysapp/tethysdash/plugin_helpers.py::available_source_properties
//   - tethysapp/tethysdash/mcp/tethysdash_mcp_server.py::add_map_service_layer
//
// When a new source-type field is added to either canonical source, add
// it here too. The templates use field NAMES + types + brief routing
// notes — never concrete example values (workspace memory:
// "no concrete example values in MCP tool descriptions — LLMs copy them
// verbatim"; same applies to system-message payload content).
//
// When T3 ships (per-source-type tool split, e.g., add_geotiff_layer,
// add_wms_layer, ...), these templates become obsolete — delete this
// helper and its tests then.
// ---------------------------------------------------------------------------

const _MAP_LAYER_ARG_ROUTING_TEMPLATES = {
  WMS: {
    source_props: ["url", "attributions", "projection"],
    params: ["LAYERS", "STYLES", "TIME"],
    ambiguity_warnings: [
      "STYLES (the WMS SLD style name) goes in `params`, NOT in the `style` arg.",
      "`style` is for inline OL feature styling (rules/default keys); WMS rendering uses params.STYLES.",
      "LAYERS is normally set via the flat `wms_layers` argument, not via params directly.",
    ],
  },
  "ESRI Image and Map Service": {
    source_props: ["url", "attributions", "projection"],
    params: ["LAYERS", "LAYERDEFS", "TIME", "mosaicRule"],
    ambiguity_warnings: [
      "LAYERS / LAYERDEFS / TIME / mosaicRule all go in `params`, NOT in the `style` arg.",
      "LAYERDEFS is a string-keyed dict of per-layer SQL filters, e.g. {layer_id_string: where_clause}.",
      "LAYERS accepts directive-prefixed forms (show:/hide:/include:/exclude:) plus bare integer lists; bare lists are canonicalized to `show:` form.",
    ],
  },
  "ESRI Feature Service": {
    source_props: ["url", "attributions"],
    params: ["WHERE", "TIME"],
    ambiguity_warnings: [
      "WHERE (the SQL filter clause) goes in `params`, NOT in the `style` arg.",
      "Required `layer` (integer index) is set via the flat `layer_id` argument, not source_props directly.",
    ],
  },
  GeoJSON: {
    source_props: [],
    params: null,
    ambiguity_warnings: [
      "GeoJSON does not accept a `params` argument — supplying it is rejected (invalid_source_params).",
      "Inline geometry uses the flat `geojson` arg; hosted GeoJSON URL uses the flat `geojson_url` arg.",
      "`attributions` is not yet supported in the source_props allowlist for GeoJSON.",
    ],
  },
  KML: {
    source_props: ["url", "attributions", "projection"],
    params: null,
    ambiguity_warnings: [
      "KML does not accept a `params` argument — supplying it is rejected (invalid_source_params).",
    ],
  },
  "Image Tile": {
    source_props: ["url", "attributions", "projection"],
    params: null,
    ambiguity_warnings: [
      "Image Tile does not accept a `params` argument — supplying it is rejected (invalid_source_params).",
      "Tile URL templates contain {z}/{x}/{y} placeholders, passed through verbatim by the producer.",
    ],
  },
  "Vector Tile": {
    source_props: ["url", "urls", "attributions", "projection"],
    params: null,
    ambiguity_warnings: [
      "Vector Tile does not accept a `params` argument — supplying it is rejected (invalid_source_params).",
      "Multi-URL templates can be supplied via source_props.urls (array form) — the flat `url` arg is single-URL only.",
    ],
  },
  "PMTiles Vector": {
    source_props: ["url", "attributions", "tileSize"],
    params: null,
    ambiguity_warnings: [
      "PMTiles Vector does not accept a `params` argument — supplying it is rejected (invalid_source_params).",
    ],
  },
  "PMTiles Raster": {
    source_props: ["url", "attributions", "tileSize"],
    params: null,
    ambiguity_warnings: [
      "PMTiles Raster does not accept a `params` argument — supplying it is rejected (invalid_source_params).",
    ],
  },
  GeoTIFF: {
    source_props: [
      "sources",
      "attributions",
      "bands",
      "nodata",
      "min",
      "max",
      "rampName",
      "rampMin",
      "rampMax",
    ],
    params: null,
    ambiguity_warnings: [
      "Auto-legend keys (rampName / rampMin / rampMax) and band-control keys (bands / nodata / min / max) ALL go in `source_props`, NOT in the `style` arg.",
      "`style` is for inline OL feature styling (rules/default keys); raster auto-legends use source_props plus legend='default'.",
      "GeoTIFF does not accept a `params` argument — supplying it is rejected (invalid_source_params).",
      "rampName values are the keys of the COLOR_RAMPS catalog (e.g., the names shown in the Style tab of the Edit Visualization modal).",
    ],
  },
  "Static Image": {
    source_props: ["url", "attributions"],
    params: ["projection", "imageExtent"],
    ambiguity_warnings: [
      "Static Image's `params` carries projection + imageExtent (flat keys onto source.props per the Static Image builder convention).",
      "imageExtent is a comma-separated bounding-box string, not a numeric array.",
    ],
  },
};

/**
 * Plan 2026-05-07-005 (T2). Returns a per-source-type arg-routing
 * template object the LLM consults before calling
 * ``add_map_service_layer``. Each entry names which keys go in
 * ``source_props``, which (if any) go in ``params``, and the
 * highest-impact ambiguity zones to avoid.
 *
 * Gated on the dashboard containing a Map item — same gate-on-presence
 * pattern as ``buildValueHintsBySource``. When no Map is present, returns
 * ``{}`` to keep the system-message payload lean.
 *
 * Returned templates use field NAMES + types + brief routing notes.
 * Never concrete example values (workspace memory: "no concrete example
 * values ... LLMs copy them verbatim").
 *
 * @param {Array<{source?: string}>} items - dashboard_state entries
 * @returns {Object} per-source-type routing object, or {} when no Map
 */
export function buildMapLayerArgRouting(items) {
  if (!Array.isArray(items)) return {};
  const sources = new Set(items.map((i) => i?.source).filter(Boolean));
  if (!sources.has("Map")) return {};
  return _MAP_LAYER_ARG_ROUTING_TEMPLATES;
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
export function buildPatchContext(tabs, variableInputValues, pluginEditablePaths) {
  const dashboardState = buildDashboardState(tabs);
  if (dashboardState.length === 0) return null;
  const editablePathsBySource = buildEditablePathsBySource(
    dashboardState,
    pluginEditablePaths,
  );
  // If nothing in the dashboard is patchable, skip the injection — the
  // LLM has no use for it (and the create tools provide their own context).
  if (Object.keys(editablePathsBySource).length === 0) return null;
  return {
    dashboard_state: dashboardState,
    editable_paths_by_source: editablePathsBySource,
    value_hints_by_source: buildValueHintsBySource(dashboardState),
    // Plan 2026-05-07-005 (T2): per-source-type arg-routing for
    // add_map_service_layer. Empty {} when no Map is in the dashboard
    // (keeps the system-message payload lean for non-Map workflows).
    map_layer_arg_routing: buildMapLayerArgRouting(dashboardState),
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
