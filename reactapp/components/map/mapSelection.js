import PropTypes from "prop-types";

// The clicked-location pin's fill and the selected-feature outline's stroke.
// Shared with the Map Selection legend entries, so a legend swatch always
// matches what a click draws.
export const MARKER_PIN_COLOR = "#007bff";
export const HIGHLIGHT_STROKE_COLOR = "#00008b";

// The two things a click marks on the map, in the order the Map Selection
// editor and the legend list them.
export const MAP_SELECTION_KEYS = ["clickedLocation", "selectedFeature"];

// What the editor rows and the legend entries call each mark; the user docs use
// the same names.
export const MAP_SELECTION_LABELS = {
  clickedLocation: "Clicked location",
  selectedFeature: "Selected feature",
};

/**
 * Resolve a map's saved `mapSelection` arg to a full setting for each mark:
 * `{ clickedLocation: { map, legend }, selectedFeature: { map, legend } }`.
 *
 * The saved value holds only what differs from the defaults, which are what a
 * click drew before the setting existed -- on the map, not in the legend -- so
 * a map saved without it, or with `{}`, behaves exactly as it always has. A
 * legend entry for a mark the map does not draw would describe nothing, so
 * `legend` is off whenever `map` is. Anything malformed is ignored in favor of
 * the default rather than trusted, since the value is hand-editable JSON.
 */
export function resolveMapSelection(value) {
  const saved = value && typeof value === "object" ? value : {};
  return Object.fromEntries(
    MAP_SELECTION_KEYS.map((key) => {
      const entry =
        saved[key] && typeof saved[key] === "object" ? saved[key] : {};
      const map = typeof entry.map === "boolean" ? entry.map : true;
      return [key, { map, legend: map && entry.legend === true }];
    }),
  );
}

// Single-item entries, which the legend draws as the symbol beside the title,
// the same as a layer with one symbol.
const MAP_SELECTION_LEGEND_ENTRIES = {
  clickedLocation: {
    title: MAP_SELECTION_LABELS.clickedLocation,
    items: [
      {
        label: MAP_SELECTION_LABELS.clickedLocation,
        symbol: "pin",
        color: MARKER_PIN_COLOR,
      },
    ],
  },
  selectedFeature: {
    title: MAP_SELECTION_LABELS.selectedFeature,
    items: [
      {
        label: MAP_SELECTION_LABELS.selectedFeature,
        symbol: "circle",
        color: "transparent",
        stroke: HIGHLIGHT_STROKE_COLOR,
      },
    ],
  },
};

// The legend entries a resolved Map Selection setting asks for. They describe
// what a click would draw, so they are listed whether or not anything has been
// clicked yet.
export function mapSelectionLegendEntries(resolved) {
  return MAP_SELECTION_KEYS.filter((key) => resolved?.[key]?.legend).map(
    (key) => MAP_SELECTION_LEGEND_ENTRIES[key],
  );
}

// Only what differs from the defaults is saved; see resolveMapSelection.
const mapSelectionEntryPropType = PropTypes.shape({
  map: PropTypes.bool,
  legend: PropTypes.bool,
});

export const mapSelectionPropType = PropTypes.shape({
  clickedLocation: mapSelectionEntryPropType,
  selectedFeature: mapSelectionEntryPropType,
});
