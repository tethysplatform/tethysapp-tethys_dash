import { useState } from "react";
import PropTypes from "prop-types";
import { render, screen, fireEvent } from "@testing-library/react";
import AnchorPicker, {
  ANCHOR_GRID,
  ANCHOR_LABELS,
  normalizeAnchor,
} from "components/inputs/AnchorPicker";
import { LABEL_ANCHOR_OPTIONS } from "components/map/labelStyle";

const Harness = ({ initial = "center", onChange }) => {
  const [anchor, setAnchor] = useState(initial);
  return (
    <AnchorPicker
      value={anchor}
      onChange={(next) => {
        setAnchor(next);
        if (onChange) onChange(next);
      }}
    />
  );
};

Harness.propTypes = {
  initial: PropTypes.string,
  onChange: PropTypes.func,
};

const cellFor = (anchor) =>
  screen.getByLabelText(`${ANCHOR_LABELS[anchor]} Anchor`);

test("exposes all nine anchor positions, laid out spatially", () => {
  render(<Harness onChange={jest.fn()} />);

  // Every anchor the renderer understands has a cell, and no extras.
  expect(ANCHOR_GRID.flat().sort()).toEqual([...LABEL_ANCHOR_OPTIONS].sort());
  for (const anchor of LABEL_ANCHOR_OPTIONS) {
    expect(cellFor(anchor)).toBeInTheDocument();
  }

  // The grid reads the way it draws: north on top, west on the left.
  const rendered = screen
    .getAllByRole("radio")
    .map((cell) => cell.getAttribute("data-testid"));
  expect(rendered).toEqual(
    ANCHOR_GRID.flat().map((anchor) => `anchor-option-${anchor}`),
  );
});

test("reports the clicked anchor and marks exactly one cell selected", () => {
  const onChange = jest.fn();
  render(<Harness onChange={onChange} />);

  expect(cellFor("center")).toHaveAttribute("aria-checked", "true");

  fireEvent.click(cellFor("se"));

  expect(onChange).toHaveBeenCalledWith("se");
  expect(cellFor("se")).toHaveAttribute("aria-checked", "true");
  expect(
    screen
      .getAllByRole("radio")
      .filter((c) => c.getAttribute("aria-checked") === "true"),
  ).toHaveLength(1);
});

test("an unrecognized stored anchor shows the default rather than nothing", () => {
  render(<AnchorPicker value="middle-left" onChange={jest.fn()} />);

  expect(cellFor("center")).toHaveAttribute("aria-checked", "true");
  expect(normalizeAnchor("middle-left")).toBe("center");
  expect(normalizeAnchor(undefined)).toBe("center");
  // Case and padding are tolerated because a plugin writes these by hand.
  expect(normalizeAnchor("  NE ")).toBe("ne");
});

test("arrow keys move focus inside the grid without selecting; Enter commits", () => {
  const onChange = jest.fn();
  render(<Harness onChange={onChange} />);

  const center = cellFor("center");
  center.focus();
  expect(center).toHaveFocus();

  fireEvent.keyDown(center, { key: "ArrowUp" });
  expect(cellFor("n")).toHaveFocus();
  // Moving focus is not a selection -- tabbing past the grid must not rewrite
  // the author's anchor.
  expect(onChange).not.toHaveBeenCalled();
  expect(cellFor("center")).toHaveAttribute("aria-checked", "true");

  fireEvent.keyDown(cellFor("n"), { key: "ArrowRight" });
  expect(cellFor("ne")).toHaveFocus();

  fireEvent.keyDown(cellFor("ne"), { key: "Enter" });
  expect(onChange).toHaveBeenCalledWith("ne");
  expect(cellFor("ne")).toHaveAttribute("aria-checked", "true");
});

test("Space commits the focused anchor", () => {
  const onChange = jest.fn();
  render(<Harness onChange={onChange} />);

  const center = cellFor("center");
  center.focus();
  fireEvent.keyDown(center, { key: "ArrowDown" });
  fireEvent.keyDown(cellFor("s"), { key: " " });

  expect(onChange).toHaveBeenCalledWith("s");
});

test("arrow keys clamp at the edges instead of wrapping around the grid", () => {
  render(<Harness initial="nw" onChange={jest.fn()} />);

  const nw = cellFor("nw");
  nw.focus();

  fireEvent.keyDown(nw, { key: "ArrowUp" });
  expect(cellFor("nw")).toHaveFocus();
  fireEvent.keyDown(cellFor("nw"), { key: "ArrowLeft" });
  expect(cellFor("nw")).toHaveFocus();
});

test("keys the grid does not handle are left alone", () => {
  const onChange = jest.fn();
  render(<Harness onChange={onChange} />);

  const center = cellFor("center");
  center.focus();
  fireEvent.keyDown(center, { key: "Tab" });

  expect(onChange).not.toHaveBeenCalled();
  expect(center).toHaveFocus();
});

test("only the roving cell is in the tab order, and it follows the selection", () => {
  render(<Harness initial="sw" onChange={jest.fn()} />);

  expect(cellFor("sw")).toHaveAttribute("tabindex", "0");
  const others = LABEL_ANCHOR_OPTIONS.filter((a) => a !== "sw");
  for (const anchor of others) {
    expect(cellFor(anchor)).toHaveAttribute("tabindex", "-1");
  }

  // Once focus moves, the tab stop moves with it so a re-entry lands where the
  // author left off rather than snapping back.
  const sw = cellFor("sw");
  sw.focus();
  fireEvent.keyDown(sw, { key: "ArrowUp" });
  expect(cellFor("w")).toHaveAttribute("tabindex", "0");
  expect(cellFor("sw")).toHaveAttribute("tabindex", "-1");
});

test("the group is exposed as a radiogroup with a name", () => {
  render(<Harness onChange={jest.fn()} />);
  expect(screen.getByRole("radiogroup")).toHaveAccessibleName("Label Anchor");
});
