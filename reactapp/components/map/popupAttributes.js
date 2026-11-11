/**
 * Applies an author's saved field order to a list of field names.
 *
 * The order is a list rather than the key order of an object because
 * JSON.parse moves integer-like keys ("2020") to the front of every object,
 * so an author's position for a year or ID column would not survive a reload.
 *
 * @param {string[]} names Field names in their natural order (as discovered,
 *   or as the source returned them).
 * @param {string[]} [savedOrder] The author's order. May list fields that are
 *   absent from `names`, and may omit fields that are present.
 * @returns {string[]} The saved names that are present, in saved order,
 *   followed by the remaining names in their natural order, each once.
 */
export function orderAttributeNames(names, savedOrder) {
  const present = new Set(names);
  const ordered = new Set();
  // A hand-edited or imported config may carry anything here; ignore what is
  // not a list rather than fail the popup render.
  for (const name of Array.isArray(savedOrder) ? savedOrder : []) {
    if (present.has(name)) ordered.add(name);
  }
  for (const name of names) {
    ordered.add(name);
  }
  return Array.from(ordered);
}

// Resolves the per-layer table popup trigger from either the new
// `tablePopupType` field or the legacy `queryable` boolean. Accepts any object
// with these keys at the top level — works for attributeProps (used in the
// MapLayer modal) and for hoisted layer config (used in Map.js filters).
//   tablePopupType present  → use it directly ("none", "click", "hover" or
//                             "both"); ask isClickEnabled / isHoverEnabled
//                             rather than comparing the value
//   queryable === false     → "none" (legacy "Allow Layer Query" off)
//   otherwise               → "click" (default)
export function resolveTablePopupType(obj) {
  if (obj?.tablePopupType) return obj.tablePopupType;
  if (obj?.queryable === false) return "none";
  return "click";
}

/** Does this layer open the attribute table on click? */
export function isClickEnabled(obj) {
  const type = resolveTablePopupType(obj);
  return type === "click" || type === "both";
}

/** Does this layer show the hover tooltip? */
export function isHoverEnabled(obj) {
  const type = resolveTablePopupType(obj);
  return type === "hover" || type === "both";
}

export const isFieldMap = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * Which of a sublayer's fields the hover tooltip shows, as a test on the field
 * name.
 *
 * Hover keeps its own list beside the click table's, in one of two shapes:
 * `hoverPopupAttributes` names the only fields to show (a layer whose fields
 * the editor could list), and `omittedHoverAttributes` names the fields to hide
 * (a layer whose fields come back only from a query, so they cannot be listed
 * up front). A layer with neither was saved before hover had a list of its own,
 * when the one hover table hid the click table's omitted fields, so those are
 * what it hides. The editor writes the hover key whenever hover is on, so which
 * key is present is what decides.
 *
 * @param {object} layer The saved layer config.
 * @param {string} sublayerName The queried feature's sublayer.
 * @returns {(field: string) => boolean}
 */
export function hoverFieldFilter(layer, sublayerName) {
  // A hand-edited config may carry anything here: a list that is not an array
  // is read as empty rather than failing the tooltip.
  const listFor = (map) =>
    Array.isArray(map[sublayerName]) ? map[sublayerName] : [];
  if (isFieldMap(layer?.hoverPopupAttributes)) {
    const shown = listFor(layer.hoverPopupAttributes);
    return (field) => shown.includes(field);
  }
  const omittedMap = isFieldMap(layer?.omittedHoverAttributes)
    ? layer.omittedHoverAttributes
    : layer?.omittedPopupAttributes;
  const omitted = isFieldMap(omittedMap) ? listFor(omittedMap) : [];
  return (field) => !omitted.includes(field);
}

/**
 * A feature's attributes as display rows: the fields `isVisible` keeps, in
 * the author's order, each labelled by its alias.
 *
 * Rows are a list rather than an object keyed by display name: an object
 * would move integer-like names ("2020") back to the front, and two fields
 * sharing an alias would collapse into one row.
 *
 * @param {object} attributes The feature's attributes.
 * @param {object} options
 * @param {(field: string) => boolean} options.isVisible
 * @param {object} [options.aliases] Field name to alias, for this sublayer.
 * @param {string[]} [options.order] The author's order, for this sublayer.
 * @returns {{key: string, label: string, value: *}[]}
 */
export function buildAttributeRows(
  attributes,
  { isVisible, aliases = {}, order },
) {
  const safeAttributes = attributes ?? {};
  const visibleFields = Object.keys(safeAttributes).filter(isVisible);
  return orderAttributeNames(visibleFields, order).map((key) => ({
    key,
    label: aliases[key] || key,
    value: safeAttributes[key],
  }));
}

/**
 * The hover tooltip's rows for a queried feature, read from the feature's own
 * layer (`__wrapperLayer`) rather than from maps merged across layers, so
 * hovering one layer never borrows another's settings.
 */
export function hoverAttributeRows(feature) {
  const layer = feature?.__wrapperLayer;
  const sublayerName = feature?.layerName;
  return buildAttributeRows(feature?.attributes, {
    isVisible: hoverFieldFilter(layer, sublayerName),
    aliases: layer?.attributeAliases?.[sublayerName] ?? {},
    order: layer?.attributeOrder?.[sublayerName],
  });
}

// The two questions asked of every feature a click turns up. A feature can
// answer yes to both (the common case), or to exactly one -- a layer with
// `tablePopupType: "none"` or `"hover"` plus a modal is reachable only through
// the modal, and a layer with no popupConfig only through the table. The
// wrapper layer is tagged onto each feature at query time (see the queryCalls
// loop in Map.js's onMapClick).

/** Does this feature belong in the click-driven table popup? */
export function isTableEligible(feature) {
  return isClickEnabled(feature?.__wrapperLayer);
}

/** Does this feature's layer have a custom modal popup configured? */
export function hasModalPopup(feature) {
  return feature?.__wrapperLayer?.popupConfig?.mode === "modal";
}
