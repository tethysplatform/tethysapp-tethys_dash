import VectorSource from "ol/source/Vector.js";
import {
  ANNOTATION_SOURCE_TYPE,
  itemsToFeatures,
  normalizeAnnotations,
} from "components/map/annotations";
import { createAnnotationStyleFunction } from "components/map/annotationStyle";
import { LINKED_EXTENT_SOURCE_TYPE } from "components/map/linkedExtent";

// Decoration layers: map layers whose content the author places rather than
// reads from data -- Annotations and Linked Extents. They share four rules:
//
//   - they are plain VectorLayers built with no network read, so the source is
//     constructed here rather than through the module importer;
//   - they never take part in click queries, hover, popups or snapping;
//   - the layer-property rows that only mean something for queryable or
//     image-rendered layers are not offered for them;
//   - the map keeps the live layer across a reconcile as long as its whole
//     config is unchanged, and rebuilds it on any change (see `map/Map.js`).
//
// Nothing here touches React.

export const DECORATION_SOURCE_TYPES = [
  ANNOTATION_SOURCE_TYPE,
  LINKED_EXTENT_SOURCE_TYPE,
];

// `layerPropertiesOptions` keys with no effect on a decoration layer: they
// tune queries and snapping, which decorations never take part in, or the
// VectorImageLayer swap, which `renderAsImage` would make and decorations do
// not need.
export const DECORATION_HIDDEN_LAYER_PROPS = [
  "minZoomQuery",
  "clickTolerance",
  "snapToFeatures",
  "snapSublayer",
  "renderAsImage",
  "imageRatio",
];

export function isDecorationSourceType(sourceType) {
  return DECORATION_SOURCE_TYPES.includes(sourceType);
}

/** Is this layer configuration (`layers[i].configuration`) a decoration? */
export function isDecorationLayerConfig(config) {
  return isDecorationSourceType(config?.props?.source?.type);
}

/** Is this saved layer entry (`layers[i]`) a decoration? */
export function isDecorationLayerEntry(entry) {
  return isDecorationLayerConfig(entry?.configuration);
}

/**
 * The OpenLayers source and style for a decoration layer config, built in the
 * given view projection. A Linked Extents source starts empty: its outlines
 * come from the linked extent registry, not from the config.
 */
export function buildDecorationContent(config, viewProjection) {
  const sourceType = config?.props?.source?.type;
  if (sourceType === ANNOTATION_SOURCE_TYPE) {
    const { defaults, items } = normalizeAnnotations(config.annotations);
    return {
      source: new VectorSource({
        features: itemsToFeatures(items, viewProjection),
      }),
      style: createAnnotationStyleFunction(defaults),
    };
  }
  return { source: new VectorSource(), style: undefined };
}
