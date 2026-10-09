import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";

/**
 * Up/down buttons that move one row of a table by one position.
 *
 * A moved row is re-rendered at its new index, so the button that was pressed
 * unmounts with the old position and keyboard focus would fall back to the
 * page. The table hands the row at the new index a fresh `focusRequest` object
 * after each move (see useRowMoveFocus), and that row takes focus on the same
 * direction's button -- or on the other one when the row has just reached the
 * end it was moving towards and that button is now disabled.
 */
const RowMoveButtons = ({ index, count, label, onMove, focusRequest }) => {
  const upRef = useRef(null);
  const downRef = useRef(null);
  const isFirst = index === 0;
  const isLast = index === count - 1;

  useEffect(() => {
    if (!focusRequest) return;
    // Up keeps focus on up unless the row is now first; down keeps it on down
    // unless the row is now last.
    const focusUp = focusRequest.direction === "up" ? !isFirst : isLast;
    (focusUp ? upRef : downRef).current?.focus();
    // Keyed on the request object alone: a new object is made for every move,
    // so two moves that land on the same index still refocus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  return (
    <div className="d-flex gap-1 justify-content-center">
      <button
        ref={upRef}
        type="button"
        className="btn btn-sm btn-outline-secondary"
        onClick={() => onMove(index, -1)}
        disabled={isFirst}
        aria-label={`Move ${label} up`}
      >
        ↑
      </button>
      <button
        ref={downRef}
        type="button"
        className="btn btn-sm btn-outline-secondary"
        onClick={() => onMove(index, 1)}
        disabled={isLast}
        aria-label={`Move ${label} down`}
      >
        ↓
      </button>
    </div>
  );
};

/**
 * Tracks where keyboard focus belongs after a move, for a table of
 * RowMoveButtons. Call `requestFocus` with a move's index and delta, and pass
 * `focusRequestFor(index)` to each row's `focusRequest`. A page holding several
 * tables passes a `scope` naming the table to both, so a move in one table does
 * not pull focus into the same row of another.
 *
 * @returns {[Function, Function]} `[focusRequestFor, requestFocus]`.
 */
export const useRowMoveFocus = () => {
  const [pending, setPending] = useState(null);
  const requestFocus = (index, delta, scope) =>
    setPending({
      scope,
      index: index + delta,
      // a new object per move, so a move landing on the same index refocuses
      request: { direction: delta < 0 ? "up" : "down" },
    });
  const focusRequestFor = (index, scope) =>
    pending && pending.scope === scope && pending.index === index
      ? pending.request
      : undefined;
  return [focusRequestFor, requestFocus];
};

/**
 * Returns a copy of `rows` with the row at `index` moved by `delta` (-1 or 1),
 * or null when the move would leave the table.
 */
export const moveRow = (rows, index, delta) => {
  const target = index + delta;
  if (target < 0 || target >= rows.length) return null;
  const moved = [...rows];
  [moved[index], moved[target]] = [moved[target], moved[index]];
  return moved;
};

RowMoveButtons.propTypes = {
  index: PropTypes.number.isRequired, // the row's position in the table
  count: PropTypes.number.isRequired, // how many rows the table has
  label: PropTypes.string.isRequired, // names the row in the buttons' aria-labels
  onMove: PropTypes.func.isRequired, // called with (index, -1 | 1)
  // set to a new object after a move to pull focus onto this row's buttons
  focusRequest: PropTypes.shape({
    direction: PropTypes.oneOf(["up", "down"]).isRequired,
  }),
};

export default RowMoveButtons;
