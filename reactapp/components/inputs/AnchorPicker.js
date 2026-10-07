import PropTypes from "prop-types";
import { memo, useCallback, useRef, useState } from "react";
import styled from "styled-components";
import {
  LABEL_ANCHORS,
  LABEL_ANCHOR_OPTIONS,
  defaultLabelAnchor,
} from "components/map/labelStyle";

// The nine anchors laid out the way they read on the map, so the control is a
// picture of the placement rather than a list of compass abbreviations. The
// values are exactly the keys `LABEL_ANCHORS` is keyed on -- the picker is the
// only thing that writes them, so a rename here is a rename of stored data.
export const ANCHOR_GRID = [
  ["nw", "n", "ne"],
  ["w", "center", "e"],
  ["sw", "s", "se"],
];

// Spelled-out names: the accessible name is API here (the suite reads controls
// by label), and "nw" is not something a screen reader can pronounce.
export const ANCHOR_LABELS = {
  nw: "Northwest",
  n: "North",
  ne: "Northeast",
  w: "West",
  center: "Center",
  e: "East",
  sw: "Southwest",
  s: "South",
  se: "Southeast",
};

/**
 * Coerce a stored anchor to one the grid can show. A plugin-written config, or
 * a value from an older rename, otherwise leaves every cell unselected -- which
 * reads as "no anchor" when the renderer is in fact using the default.
 */
export function normalizeAnchor(anchor) {
  const key = String(anchor ?? "")
    .trim()
    .toLowerCase();
  return LABEL_ANCHORS[key] ? key : defaultLabelAnchor;
}

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 2.75rem);
  grid-template-rows: repeat(3, 2.25rem);
  gap: 4px;
  width: max-content;
`;

const Cell = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 4px;
  cursor: pointer;
  /* Selected state: filled + solid blue border. */
  background: ${({ $selected }) => ($selected ? "#e7f1ff" : "#fff")};
  border: 2px solid ${({ $selected }) => ($selected ? "#007bff" : "#ccc")};

  &:hover {
    border-color: ${({ $selected }) => ($selected ? "#007bff" : "#999")};
  }

  /* Focus indicator is deliberately a different shape and color from the
     selected state: with a roving tabindex the focused cell is frequently not
     the selected one, and an author has to be able to tell them apart. */
  &:focus {
    outline: 2px dashed #b8860b;
    outline-offset: 2px;
  }
`;

const Dot = styled.span`
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ $selected }) => ($selected ? "#007bff" : "#adb5bd")};
`;

const positionOf = (anchor) => {
  for (let row = 0; row < ANCHOR_GRID.length; row += 1) {
    const col = ANCHOR_GRID[row].indexOf(anchor);
    if (col !== -1) return { row, col };
  }
  return { row: 1, col: 1 };
};

const ARROW_DELTAS = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/**
 * A 3x3 spatial picker for the nine label anchors.
 *
 * Keyboard model is the conventional roving-tabindex grid: one cell is in the
 * tab order, the arrow keys move focus inside the grid without committing, and
 * Enter or Space commits the focused cell. Moving focus does not select, so an
 * author tabbing through the editor cannot change the anchor by accident.
 */
const AnchorPicker = ({
  value,
  onChange,
  label = "Label Anchor",
  disabled = false,
}) => {
  const selected = normalizeAnchor(value);
  // The cell that holds the tab stop. Null until the user has moved focus, so
  // the tab stop follows the selection until it is deliberately moved.
  const [focused, setFocused] = useState(null);
  const roving = focused && LABEL_ANCHORS[focused] ? focused : selected;
  const cellRefs = useRef({});

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onChange(roving);
        return;
      }
      const delta = ARROW_DELTAS[event.key];
      if (!delta) return;
      event.preventDefault();
      const { row, col } = positionOf(roving);
      // Clamped rather than wrapped: the grid is a picture of the map, and
      // walking off the north edge onto the south row would misread as motion.
      const nextRow = Math.min(Math.max(row + delta[0], 0), 2);
      const nextCol = Math.min(Math.max(col + delta[1], 0), 2);
      const next = ANCHOR_GRID[nextRow][nextCol];
      if (next === roving) return;
      setFocused(next);
      cellRefs.current[next]?.focus();
    },
    [onChange, roving],
  );

  return (
    <Grid role="radiogroup" aria-label={label} data-testid="anchor-picker">
      {ANCHOR_GRID.map((row) =>
        row.map((anchor) => {
          const isSelected = anchor === selected;
          return (
            <Cell
              key={anchor}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${ANCHOR_LABELS[anchor]} Anchor`}
              data-testid={`anchor-option-${anchor}`}
              data-selected={isSelected ? "true" : "false"}
              disabled={disabled}
              $selected={isSelected}
              tabIndex={anchor === roving ? 0 : -1}
              ref={(node) => {
                cellRefs.current[anchor] = node;
              }}
              onFocus={() => setFocused(anchor)}
              onKeyDown={handleKeyDown}
              onClick={() => onChange(anchor)}
            >
              <Dot aria-hidden="true" $selected={isSelected} />
            </Cell>
          );
        }),
      )}
    </Grid>
  );
};

AnchorPicker.propTypes = {
  value: PropTypes.oneOfType([
    PropTypes.oneOf(LABEL_ANCHOR_OPTIONS),
    PropTypes.string,
  ]),
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  disabled: PropTypes.bool,
};

export default memo(AnchorPicker);
