import {
  ANNOTATION_SOURCE_TYPE,
  isNonEmptyString,
  normalizeAnnotations,
} from "components/map/annotations";
import { buildDecorationLayerEntry } from "components/map/decorationLayers";
import { BUILT_IN_MAP_SOURCE } from "components/map/viewGroup";

// Annotation groups: a map's annotations, stored in its grid item's settings
// (`metadata_string`) rather than among its layers.
//
//   "annotations": [{ name, defaults, items, layerVisibility?, layerProps? }]
//
// Settings, not args, because a plugin map's args are handed to the plugin as
// keyword arguments, and an `annotations` keyword it does not declare would
// break it; every map type has settings. `defaults` and `items` are the shape
// `annotations.js` already reads and writes. `layerVisibility` and `layerProps`
// are carried over from an Annotations layer when it is migrated, so a
// converted dashboard opens looking exactly as it did.
//
// At render time each group becomes an ordinary Annotations decoration layer,
// appended after the map's own layers, so everything decoration layers already
// do -- no network read, no queries, kept across a reconcile while unchanged --
// applies to groups unchanged. Nothing here touches React.

/** The settings key that holds a map's annotation groups. */
export const ANNOTATIONS_METADATA_KEY = "annotations";

/**
 * The OpenLayers layer property naming the group a layer draws. The layers
 * control reads it to list groups in their own section.
 */
export const ANNOTATION_GROUP_KEY = "annotationGroup";

// A group's layer gets an internal name the author never sees (the layers
// control shows its `title`), so a group may share a name with a map layer
// without the two being taken for one layer by anything keyed on the name.
const GROUP_LAYER_NAME_PREFIX = "annotation-group:";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * `base`, or `base (2)`, `base (3)`, ... -- the first spelling not in `taken`.
 *
 * @param {string} base the name wanted
 * @param {Set<string>} taken names already in use
 * @returns {string}
 */
export function uniqueGroupName(base, taken) {
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base} (${suffix})`)) suffix += 1;
  return `${base} (${suffix})`;
}

/**
 * A saved `annotations` setting as a list of well-formed groups. Entries that
 * are not objects or have no name are dropped; names are trimmed; `defaults`
 * and `items` are always present. Any other key on a group is kept, so a
 * setting written by a newer build survives a round trip through this one.
 *
 * @param {unknown} value the saved setting
 * @returns {Array<object>}
 */
export function normalizeAnnotationGroups(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((group) => isPlainObject(group) && isNonEmptyString(group.name))
    .map((group) => ({
      ...group,
      name: group.name.trim(),
      ...normalizeAnnotations(group),
    }));
}

/**
 * The layer entries the map draws for a list of groups, in group order, so a
 * later group draws above an earlier one once appended after the map layers.
 * Duplicate group names, which only a hand-edited setting can produce, are
 * kept apart by suffixing the internal name.
 *
 * @param {unknown} groups the saved setting
 * @returns {Array<object>} `layers[i]`-shaped entries
 */
export function buildAnnotationGroupLayers(groups) {
  const used = new Set();
  return normalizeAnnotationGroups(groups).map((group) => {
    const key = uniqueGroupName(group.name, used);
    used.add(key);
    return buildDecorationLayerEntry({
      sourceType: ANNOTATION_SOURCE_TYPE,
      layerProps: {
        ...(isPlainObject(group.layerProps) ? group.layerProps : {}),
        name: `${GROUP_LAYER_NAME_PREFIX}${key}`,
        title: group.name,
        [ANNOTATION_GROUP_KEY]: group.name,
      },
      layerVisibility: group.layerVisibility,
      annotations: group,
    });
  });
}

function isAnnotationLayerEntry(entry) {
  return entry?.configuration?.props?.source?.type === ANNOTATION_SOURCE_TYPE;
}

// The parts of an Annotations layer's props that mean something on a group:
// everything but its identity, its marker source and its stacking slot, which
// a group takes from its place in the list.
function carriedLayerProps(props) {
  const {
    name: _name,
    source: _source,
    zIndex: _zIndex,
    ...rest
  } = isPlainObject(props) ? props : {};
  return rest;
}

/**
 * Move a built-in map's Annotations layers out of its args and into its
 * settings as annotation groups, appended after any groups already there.
 * Each group takes its layer's name, suffixed if a group already has it.
 *
 * @param {object} args the map's parsed args
 * @param {object} metadata the map's parsed settings
 * @returns {{args: object, metadata: object, migrated: boolean}} the inputs
 *   themselves, with `migrated: false`, when there was nothing to move
 */
export function migrateMapAnnotationLayers(args, metadata) {
  const layers = Array.isArray(args?.layers) ? args.layers : [];
  const annotationLayers = layers.filter(isAnnotationLayerEntry);
  if (annotationLayers.length === 0) {
    return { args, metadata, migrated: false };
  }

  const existing = Array.isArray(metadata?.[ANNOTATIONS_METADATA_KEY])
    ? metadata[ANNOTATIONS_METADATA_KEY]
    : [];
  const taken = new Set(
    normalizeAnnotationGroups(existing).map((group) => group.name),
  );
  const migratedGroups = annotationLayers.map((entry) => {
    const configuration = entry.configuration;
    const layerName = configuration.props.name;
    let name;
    if (isNonEmptyString(layerName)) {
      name = uniqueGroupName(layerName.trim(), taken);
    } else {
      let number = 1;
      while (taken.has(`Annotations ${number}`)) number += 1;
      name = `Annotations ${number}`;
    }
    taken.add(name);
    const saved = isPlainObject(configuration.annotations)
      ? configuration.annotations
      : {};
    // Keys beyond `defaults` and `items` are kept, as a group keeps them.
    const group = {
      ...saved,
      name,
      ...normalizeAnnotations(saved),
    };
    const layerProps = carriedLayerProps(configuration.props);
    if (Object.keys(layerProps).length > 0) group.layerProps = layerProps;
    if (configuration.layerVisibility === false) group.layerVisibility = false;
    return group;
  });

  return {
    args: {
      ...args,
      layers: layers.filter((entry) => !isAnnotationLayerEntry(entry)),
    },
    metadata: {
      ...(isPlainObject(metadata) ? metadata : {}),
      [ANNOTATIONS_METADATA_KEY]: [...existing, ...migratedGroups],
    },
    migrated: true,
  };
}

// Read a grid item field that may be a JSON string (a loaded dashboard) or an
// already-parsed object (an import mid-flight). A missing value reads as empty
// with `wasString: null` -- no representation of its own -- so the caller can
// match the item's other field rather than guess. `null` means unreadable.
function readField(value) {
  if (isPlainObject(value)) return { parsed: value, wasString: false };
  if (typeof value === "string") {
    if (value.trim() === "") return { parsed: {}, wasString: true };
    try {
      const parsed = JSON.parse(value);
      return isPlainObject(parsed) ? { parsed, wasString: true } : null;
    } catch {
      return null;
    }
  }
  if (value === undefined || value === null) {
    return { parsed: {}, wasString: null };
  }
  return null;
}

/**
 * Migrate one grid item's Annotations layers into its settings. Only the
 * built-in Map can hold them -- a plugin map's layers come from its plugin.
 * Each field keeps the representation it arrived in (string or object). A
 * grid item whose args or settings do not parse is left alone rather than
 * rewritten.
 *
 * @param {object} gridItem
 * @returns {object} a new grid item, or the same reference when unchanged
 */
export function migrateGridItemAnnotationLayers(gridItem) {
  if (!gridItem || gridItem.source !== BUILT_IN_MAP_SOURCE) return gridItem;
  const argsField = readField(gridItem.args_string);
  const metadataField = readField(gridItem.metadata_string);
  if (!argsField || !metadataField) return gridItem;

  const { args, metadata, migrated } = migrateMapAnnotationLayers(
    argsField.parsed,
    metadataField.parsed,
  );
  if (!migrated) return gridItem;

  // Args are always present once there is a layer to move, so a missing
  // settings value is written the way the args are: a string on a loaded
  // dashboard, an object mid-import (where the caller stringifies it once).
  const argsAsString = argsField.wasString !== false;
  const metadataAsString = metadataField.wasString ?? argsAsString;
  return {
    ...gridItem,
    args_string: argsAsString ? JSON.stringify(args) : args,
    metadata_string: metadataAsString ? JSON.stringify(metadata) : metadata,
  };
}

/**
 * Migrate every built-in map on every tab. Tabs and grid items with nothing
 * to move are kept by reference.
 *
 * @param {Array<object>} tabs
 * @returns {Array<object>}
 */
export function migrateTabsAnnotationLayers(tabs) {
  if (!Array.isArray(tabs)) return tabs;
  return tabs.map((tab) => {
    if (!Array.isArray(tab?.gridItems)) return tab;
    let changed = false;
    const gridItems = tab.gridItems.map((gridItem) => {
      const migrated = migrateGridItemAnnotationLayers(gridItem);
      if (migrated !== gridItem) changed = true;
      return migrated;
    });
    return changed ? { ...tab, gridItems } : tab;
  });
}
