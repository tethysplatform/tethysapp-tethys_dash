import { useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
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
  const containerRef = useRef(null);
  latest = annotations;
  return (
    <div ref={containerRef}>
      <AnnotationsPane
        annotations={annotations}
        onChange={setAnnotations}
        onEditOnMap={onEditOnMap}
        containerRef={containerRef}
      />
    </div>
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

test("editing one item leaves the others as they were", () => {
  mount({ defaults: {}, items: [arrow, text] });
  expand("Text: Gauge 1");

  fireEvent.change(screen.getByLabelText("Text: Gauge 1 Text"), {
    target: { value: "Gauge 2" },
  });

  expect(latest.items[0]).toBe(arrow);
  expect(latest.items[1]).toEqual({ ...text, text: "Gauge 2" });
});

test("a text item with no text yet edits from a blank field", () => {
  const blank = { id: "a4", kind: "text", coordinates: [0, 0] };
  mount({ defaults: {}, items: [blank] });
  expand("Text (empty)");

  const field = screen.getByLabelText("Text (empty) Text");
  expect(field).toHaveValue("");
  fireEvent.change(field, { target: { value: "Dam" } });

  expect(latest.items[0]).toEqual({ ...blank, text: "Dam" });
  expect(screen.getByText("Text: Dam")).toBeInTheDocument();
});

test("items written without ids still list and take overrides", () => {
  const { id: _a1, ...first } = arrow;
  const { id: _a3, ...label } = text;
  mount({ defaults: {}, items: [first, label] });

  expect(screen.getByText("Arrow 1")).toBeInTheDocument();
  expect(screen.getByText("Text: Gauge 1")).toBeInTheDocument();

  expand("Arrow 1");
  fireEvent.change(screen.getByLabelText("Arrow 1 Line Width"), {
    target: { value: "3" },
  });

  expect(latest.items).toEqual([{ ...first, style: { lineWidth: 3 } }, label]);
  expect(latest.items[0]).not.toHaveProperty("id");
});

test("a text item's placement is a compact select that stores an override", () => {
  mount({ defaults: { textAnchor: "s" }, items: [text] });
  expand("Text: Gauge 1");

  const select = screen.getByLabelText("Text: Gauge 1 Text Placement");
  expect(select).toHaveValue("s");
  expect(
    within(select)
      .getAllByRole("option")
      .map((o) => o.textContent),
  ).toEqual([
    "Center",
    "North",
    "Northeast",
    "East",
    "Southeast",
    "South",
    "Southwest",
    "West",
    "Northwest",
  ]);

  fireEvent.change(select, { target: { value: "ne" } });

  expect(latest.items[0].style).toEqual({ textAnchor: "ne" });
  expect(latest.defaults).toEqual({ textAnchor: "s" });
  expect(
    screen.getByRole("button", { name: "Reset Text: Gauge 1 Text Placement" }),
  ).toBeInTheDocument();
});

test("the default text placement is picked on the anchor grid", () => {
  mount({ defaults: {}, items: [] });

  const grid = screen.getByRole("radiogroup", {
    name: "Default Text Placement",
  });
  fireEvent.click(
    within(grid).getByRole("radio", { name: "Northeast Anchor" }),
  );

  expect(latest.defaults).toEqual({ textAnchor: "ne" });
  expect(
    within(
      screen.getByRole("radiogroup", { name: "Default Text Placement" }),
    ).getByRole("radio", { name: "Northeast Anchor" }),
  ).toHaveAttribute("aria-checked", "true");
});

describe("the color controls", () => {
  // react-color-palette measures its saturation area; jsdom has no observer.
  let realResizeObserver;
  beforeAll(() => {
    realResizeObserver = global.ResizeObserver;
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });
  afterAll(() => {
    if (realResizeObserver) global.ResizeObserver = realResizeObserver;
    else delete global.ResizeObserver;
  });

  const pickColor = (label, hex) => {
    fireEvent.click(screen.getByLabelText(`${label} color popover square`));
    fireEvent.change(screen.getByRole("textbox", { name: "HEX" }), {
      target: { value: hex },
    });
  };

  test("picking a default color stores it as a hex string", async () => {
    mount({ defaults: { lineWidth: 3 }, items: [arrow] });

    pickColor("Default Line Color", "#2aff00");

    await waitFor(() =>
      expect(latest.defaults).toEqual({ lineWidth: 3, lineColor: "#2aff00" }),
    );
    // A default is not an override: the item still carries no style.
    expect(latest.items[0]).toBe(arrow);
  });

  test("picking an item color stores an override that reset removes", async () => {
    mount({ defaults: {}, items: [text] });
    expand("Text: Gauge 1");

    pickColor("Text: Gauge 1 Text Outline Color", "#00ffff");

    await waitFor(() =>
      expect(latest.items[0].style).toEqual({ haloColor: "#00ffff" }),
    );
    expect(latest.defaults).toEqual({});

    fireEvent.click(
      screen.getByRole("button", {
        name: "Reset Text: Gauge 1 Text Outline Color",
      }),
    );
    expect(latest.items[0]).toEqual(text);
  });
});

test("text rotation takes zero and negative angles, per item and as the default", () => {
  mount({ defaults: {}, items: [text] });

  fireEvent.change(screen.getByLabelText("Default Text Rotation"), {
    target: { value: "30" },
  });
  expect(latest.defaults).toEqual({ textRotation: 30 });

  expand("Text: Gauge 1");
  const itemRotation = screen.getByLabelText("Text: Gauge 1 Text Rotation");
  expect(itemRotation).toHaveAttribute("placeholder", "30");

  fireEvent.change(itemRotation, { target: { value: "-45" } });
  expect(latest.items[0].style).toEqual({ textRotation: -45 });

  // Zero is a real angle, not "unset".
  fireEvent.change(screen.getByLabelText("Text: Gauge 1 Text Rotation"), {
    target: { value: "0" },
  });
  expect(latest.items[0].style).toEqual({ textRotation: 0 });
});

test("lines are not offered a text rotation", () => {
  mount({ defaults: {}, items: [arrow] });
  expand("Arrow 1");

  expect(
    screen.queryByLabelText("Arrow 1 Text Rotation"),
  ).not.toBeInTheDocument();
});
