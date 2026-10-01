import { findSelectOptionByValue } from "components/visualizations/utilities";

// The source type a dynamic map layer plugin drives when it does not say: every
// plugin written before plugins could choose, and every backend that predates
// the `dynamic_map_layer_source` metadata key.
export const DEFAULT_DYNAMIC_LAYER_SOURCE = "GeoJSON";

/**
 * The dynamic map layer plugin option an editor's source props are bound to.
 *
 * Matched on the plugin's source name first, which a saved layer carries, then
 * on the option value, which is all a freshly picked one has until its source
 * is filled in. Mirrors how the Source tab finds the selected plugin.
 *
 * @param {Array} dynamicMapLayers The grouped plugin options from AppContext.
 * @param {object} sourceProps The editor's source props.
 * @returns {object|null} The plugin option, or null for a static layer (or a
 *   plugin that is no longer installed).
 */
export function findDynamicLayerOption(dynamicMapLayers, sourceProps) {
  if (!Array.isArray(dynamicMapLayers) || !sourceProps) return null;
  return (
    (sourceProps.source &&
      findSelectOptionByValue(
        dynamicMapLayers,
        sourceProps.source,
        "source",
      )) ||
    (sourceProps.type &&
      findSelectOptionByValue(dynamicMapLayers, sourceProps.type)) ||
    null
  );
}

/**
 * The source type ("GeoJSON" or "GeoTIFF") the selected dynamic plugin drives.
 *
 * The plugin's own metadata wins, since it is what the backend will serve; the
 * type restored with a saved layer covers the gap before the plugin list says
 * otherwise. A plugin that declares nothing is GeoJSON.
 *
 * @param {Array} dynamicMapLayers The grouped plugin options from AppContext.
 * @param {object} sourceProps The editor's source props.
 * @returns {string|null} The declared source type, or null when the layer is
 *   not bound to an available dynamic plugin.
 */
export function getDynamicLayerSourceType(dynamicMapLayers, sourceProps) {
  const option = findDynamicLayerOption(dynamicMapLayers, sourceProps);
  if (!option) return null;
  return (
    option.dynamic_map_layer_source ??
    sourceProps.dynamic_map_layer_source ??
    DEFAULT_DYNAMIC_LAYER_SOURCE
  );
}
