import { useState } from "react";
import PropTypes from "prop-types";
import { render, screen, fireEvent, within } from "@testing-library/react";
import AnnotationsPane from "components/modals/MapLayer/AnnotationsPane";

const arrow = {
  id: "a1",
  kind: "line",
  coordinates: [
    [0, 0],
    [1, 1],
  ],
};
const plainLine = {
  id: "a2",
  kind: "line",
  coordinates: [
    [0, 0],
    [1, 0],
  ],
  style: { arrowheads: "none" },
};
const text = { id: "a3", kind: "text", coordinates: [0, 0], text: "Gauge 1" };

let latest;
const Harness = ({ initial, onEditOnMap }) => {
  const [annotations, setAnnotations] = useState(initial);
  latest = annotations;
  return (
    <AnnotationsPane
      annotations={annotations}
      onChange={setAnnotations}
      onEditOnMap={onEditOnMap}
    />
  );
};
Harness.propTypes = {
  initial: PropTypes.object,
  onEditOnMap: PropTypes.func,
};

const mount = (initial, props = {}) =>
  render(<Harness initial={initial} {...props} />);

const expand = (name) =>
  fireEvent.click(screen.getByRole("button", { name: `Expand ${name}` }));

beforeEach(() => {
  latest = undefined;
});

test("lists items by kind and creation order", () => {
  mount({ defaults: {}, items: [arrow, plainLine, text] });

  expect(screen.getByText("Arrow 1")).toBeInTheDocument();
  expect(screen.getByText("Line 1")).toBeInTheDocument();
  expect(screen.getByText("Text: Gauge 1")).toBeInTheDocument();
});

test("shows the empty state when there are no items", () => {
  mount({ defaults: {}, items: [] });

  expect(
    screen.getByText(/This layer has no annotations yet/),
  ).toBeInTheDocument();
});

test("editing a default stores it, and clearing a number removes it", () => {
  mount({ defaults: {}, items: [] });

  fireEvent.change(screen.getByLabelText("Default Line Width"), {
    target: { value: "4" },
  });
  expect(latest.defaults).toEqual({ lineWidth: 4 });

  fireEvent.change(screen.getByLabelText("Default Line Width"), {
    target: { value: "" },
  });
  expect(latest.defaults).toEqual({});
});

test("the default arrowheads never offer 'None'", () => {
  mount({ defaults: {}, items: [] });

  const select = screen.getByLabelText("Default Arrowheads");
  const options = within(select)
    .getAllByRole("option")
    .map((o) => o.textContent);
  expect(options).toEqual(["End", "Start", "Both ends"]);
});

test("an item override shows a reset that returns it to the default (AE1)", () => {
  mount({ defaults: { lineWidth: 2 }, items: [arrow] });
  expand("Arrow 1");

  const width = screen.getByLabelText("Arrow 1 Line Width");
  // Un-overridden: empty, with the inherited value as the placeholder.
  expect(width).toHaveValue("");
  expect(width).toHaveAttribute("placeholder", "2");

  fireEvent.change(width, { target: { value: "6" } });
  expect(latest.items[0].style).toEqual({ lineWidth: 6 });
  expect(screen.getByLabelText("Arrow 1 Line Width")).toHaveValue("6");

  fireEvent.click(
    screen.getByRole("button", { name: "Reset Arrow 1 Line Width" }),
  );
  expect(latest.items[0]).not.toHaveProperty("style");
  expect(screen.getByLabelText("Arrow 1 Line Width")).toHaveValue("");
});

test("clearing a number field leaves it empty to type into", () => {
  mount({ defaults: { lineWidth: 4 }, items: [] });
  const width = screen.getByLabelText("Default Line Width");
  expect(width).toHaveValue("4");

  fireEvent.change(width, { target: { value: "" } });
  expect(screen.getByLabelText("Default Line Width")).toHaveValue("");
  expect(screen.getByLabelText("Default Line Width")).toHaveAttribute(
    "placeholder",
    "2",
  );
  fireEvent.change(screen.getByLabelText("Default Line Width"), {
    target: { value: "6" },
  });
  expect(latest.defaults).toEqual({ lineWidth: 6 });
});

test("an un-overridden item shows its layer default value", () => {
  mount({ defaults: { arrowheads: "both" }, items: [arrow] });
  expand("Arrow 1");

  expect(screen.getByLabelText("Arrow 1 Arrowheads")).toHaveValue("both");
  expect(screen.getAllByText("Layer default").length).toBeGreaterThan(0);
});

test("an item's arrowheads can be set to none, turning it into a line", () => {
  mount({ defaults: {}, items: [arrow] });
  expand("Arrow 1");

  fireEvent.change(screen.getByLabelText("Arrow 1 Arrowheads"), {
    target: { value: "none" },
  });

  expect(latest.items[0].style).toEqual({ arrowheads: "none" });
  expect(screen.getByText("Line 1")).toBeInTheDocument();
});

test("a text item edits its text and offers only text overrides", () => {
  mount({ defaults: {}, items: [text] });
  expand("Text: Gauge 1");

  fireEvent.change(screen.getByLabelText("Text: Gauge 1 Text"), {
    target: { value: "Gauge 2" },
  });
  expect(latest.items[0].text).toBe("Gauge 2");
  expect(screen.getByLabelText("Text: Gauge 2 Text Size")).toBeInTheDocument();
  expect(
    screen.queryByLabelText("Text: Gauge 2 Line Width"),
  ).not.toBeInTheDocument();
});

test("deleting an item removes it", () => {
  mount({ defaults: {}, items: [arrow, text] });

  fireEvent.click(screen.getByRole("button", { name: "Delete Arrow 1" }));

  expect(latest.items).toEqual([text]);
});

test("Edit on map calls back, and is disabled without a handler", () => {
  const onEditOnMap = jest.fn();
  const { unmount } = mount({ defaults: {}, items: [] }, { onEditOnMap });
  fireEvent.click(
    screen.getByRole("button", { name: "Edit annotations on map" }),
  );
  expect(onEditOnMap).toHaveBeenCalledTimes(1);
  unmount();

  mount({ defaults: {}, items: [] });
  expect(
    screen.getByRole("button", { name: "Edit annotations on map" }),
  ).toBeDisabled();
});
