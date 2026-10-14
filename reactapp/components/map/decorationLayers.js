import Collection from "ol/Collection.js";
import VectorSource from "ol/source/Vector.js";
import { Fill, Stroke, Style } from "ol/style.js";
import {
  ANNOTATION_SOURCE_TYPE,
  isNonEmptyString,
  itemsToFeatures,
  normalizeAnnotations,
} from "components/map/annotations";
import { createAnnotationStyleFunction } from "components/map/annotationStyle";
import {
  LINKED_EXTENT_LAYER_KEY,
  LINKED_EXTENT_SOURCE_TYPE,
} from "components/map/linkedExtent";
import { DECORATION_LAYER_KEY } from "components/map/decorationTypes";

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

const DECORATION_SOURCE_TYPES = [
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

// A Linked Extents layer's one style, shared by every outline it draws.
export const defaultLinkedExtentStyle = Object.freeze({
  color: "#d35400",
  width: 2,
  fillColor: "rgba(0, 0, 0, 0)",
});

/** The saved outline style with every key filled from the defaults. */
export function resolveLinkedExtentStyle(style) {
  return {
    color: isNonEmptyString(style?.color)
      ? style.color
      : defaultLinkedExtentStyle.color,
    width:
      typeof style?.width === "number" && style.width > 0
        ? style.width
        : defaultLinkedExtentStyle.width,
    fillColor: isNonEmptyString(style?.fillColor)
      ? style.fillColor
      : defaultLinkedExtentStyle.fillColor,
  };
}

function linkedExtentOlStyle(style) {
  const resolved = resolveLinkedExtentStyle(style);
  return new Style({
    stroke: new Stroke({ color: resolved.color, width: resolved.width }),
    fill: new Fill({ color: resolved.fillColor }),
  });
}

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
 * The OpenLayers source, style and layer properties for a decoration layer
 * config, built in the given view projection. A Linked Extents source starts
 * empty: its outlines come from the linked extent registry, not the config,
 * and the map fills it before the layer is drawn.
 */
export function buildDecorationContent(config, viewProjection) {
  const sourceType = config?.props?.source?.type;
  if (sourceType === ANNOTATION_SOURCE_TYPE) {
    const { defaults, items } = normalizeAnnotations(config.annotations);
    return {
      // Collection-backed so features draw in item order; a spatially indexed
      // source would stack overlapping annotations in arbitrary order.
      source: new VectorSource({
        features: new Collection(itemsToFeatures(items, viewProjection)),
      }),
      style: createAnnotationStyleFunction(defaults),
      properties: { [DECORATION_LAYER_KEY]: true },
    };
  }
  return {
    source: new VectorSource(),
    style: linkedExtentOlStyle(config?.linkedExtentStyle),
    properties: {
      [DECORATION_LAYER_KEY]: true,
      [LINKED_EXTENT_LAYER_KEY]: true,
    },
  };
}

/**
 * The saved `layers[i]` entry for a decoration layer, as the layer editor
 * writes it. `tablePopupType: "none"` is a second guard behind the source-type
 * exclusion from queries.
 */
export function buildDecorationLayerEntry({
  sourceType,
  layerProps,
  layerVisibility,
  annotations,
  linkedExtentStyle,
}) {
  const configuration = {
    type: "VectorLayer",
    props: { ...layerProps, source: { type: sourceType, props: {} } },
  };
  if (layerVisibility === false) {
    configuration.layerVisibility = false;
  }
  if (sourceType === ANNOTATION_SOURCE_TYPE) {
    const { defaults, items } = normalizeAnnotations(annotations);
    configuration.annotations = { defaults, items };
  }
  if (
    sourceType === LINKED_EXTENT_SOURCE_TYPE &&
    linkedExtentStyle &&
    Object.keys(linkedExtentStyle).length > 0
  ) {
    configuration.linkedExtentStyle = linkedExtentStyle;
  }
  return { configuration, tablePopupType: "none" };
}
