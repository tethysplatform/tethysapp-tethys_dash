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

beforeEach(() => {
  latest = undefined;
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
});

test("the default text rotation takes zero and negative angles", () => {
  mount({ defaults: {}, items: [text] });

  fireEvent.change(screen.getByLabelText("Default Text Rotation"), {
    target: { value: "-45" },
  });
  expect(latest.defaults).toEqual({ textRotation: -45 });

  // Zero is a real angle, not "unset".
  fireEvent.change(screen.getByLabelText("Default Text Rotation"), {
    target: { value: "0" },
  });
  expect(latest.defaults).toEqual({ textRotation: 0 });
  expect(latest.items).toEqual([text]);
});

test("the defaults are split into collapsible line/arrow and text sections", async () => {
  mount({ defaults: {}, items: [] });

  const lineToggle = screen.getByRole("button", {
    name: "Line/Arrow Default Styles",
  });
  const textToggle = screen.getByRole("button", {
    name: "Text Default Styles",
  });
  // Both start collapsed, like the rule sections of the style editor.
  expect(lineToggle).toHaveAttribute("aria-expanded", "false");
  expect(textToggle).toHaveAttribute("aria-expanded", "false");

  // Each section holds only its own kind's fields.
  const lineSection = screen.getByRole("group", {
    name: "Line/Arrow Default Styles",
  });
  const textSection = screen.getByRole("group", {
    name: "Text Default Styles",
  });
  expect(
    within(lineSection).getByLabelText("Default Line Width"),
  ).toBeInTheDocument();
  expect(
    within(lineSection).queryByLabelText("Default Text Size"),
  ).not.toBeInTheDocument();
  expect(
    within(textSection).getByLabelText("Default Text Size"),
  ).toBeInTheDocument();
  expect(
    within(textSection).queryByLabelText("Default Line Width"),
  ).not.toBeInTheDocument();

  // Opening one leaves the other as it was.
  fireEvent.click(textToggle);
  await waitFor(() =>
    expect(textToggle).toHaveAttribute("aria-expanded", "true"),
  );
  expect(lineToggle).toHaveAttribute("aria-expanded", "false");
});

test("the tab lists no annotations: they are edited on the map", () => {
  mount({ defaults: {}, items: [arrow, plainLine, text] });

  expect(screen.queryByText("Arrow 1")).not.toBeInTheDocument();
  expect(screen.queryByText("Text: Gauge 1")).not.toBeInTheDocument();
  expect(
    screen.queryByText(/This layer has no annotations yet/),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Delete/ }),
  ).not.toBeInTheDocument();
});
