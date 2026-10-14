// The saved source type names of the two decoration layer types. Kept in a
// module of their own, with no imports, so the layer registry in
// `map/utilities.js` can name them without an import cycle through
// `labelStyle.js`. These strings are persisted data: renaming one is a
// migration over every dashboard that uses it.
export const ANNOTATION_SOURCE_TYPE = "Annotations";
export const LINKED_EXTENT_SOURCE_TYPE = "Linked Extents";

// Set on every decoration layer's OpenLayers instance, so code that hit-tests
// the whole map -- a vector tile query has no single layer to filter on -- can
// leave author-placed shapes out of a data query.
export const DECORATION_LAYER_KEY = "decorationLayer";
