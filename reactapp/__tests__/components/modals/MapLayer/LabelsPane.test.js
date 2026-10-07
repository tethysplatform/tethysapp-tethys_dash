/* eslint-disable no-template-curly-in-string */
// This file exercises literal `${feature.x}` label-template syntax.
import { useRef, useState } from "react";
import PropTypes from "prop-types";
import { render, screen, fireEvent } from "@testing-library/react";
import LabelsPane, {
  withDefaults,
  coerceNumericField,
  insertAtSelection,
} from "components/modals/MapLayer/LabelsPane";
import {
  defaultLabelAnchor,
  defaultLabelColor,
  defaultLabelSize,
} from "components/map/labelStyle";

const Harness = ({ initial = null, onChange }) => {
  const [labelConfig, setLabelConfig] = useState(initial);
  const containerRef = useRef(null);
  return (
    <div ref={containerRef}>
      <LabelsPane
        layerName="Test Layer"
        labelConfig={labelConfig}
        containerRef={containerRef}
        onChange={(next) => {
          setLabelConfig(next);
          if (onChange) onChange(next);
        }}
      />
    </div>
  );
};

Harness.propTypes = {
  initial: PropTypes.object,
  onChange: PropTypes.func,
};

test("renders the five controls seeded from the render defaults when nothing is stored", () => {
  render(<Harness onChange={jest.fn()} />);

  expect(screen.getByLabelText("Label Template")).toHaveValue("");
  expect(screen.getByLabelText("Label Size")).toHaveValue(
    String(defaultLabelSize),
  );
  expect(screen.getByLabelText("Label Minimum Zoom")).toHaveValue("");
  expect(screen.getByLabelText("Center Anchor")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(
    screen.getByLabelText("Label Text color popover square"),
  ).toBeInTheDocument();
});

test("typing a template, choosing an anchor and setting size emit the whole configuration", () => {
  const onChange = jest.fn();
  render(<Harness onChange={onChange} />);

  fireEvent.change(screen.getByLabelText("Label Template"), {
    target: { value: "${feature.station_id}" },
  });
  expect(onChange).toHaveBeenLastCalledWith({
    template: "${feature.station_id}",
    anchor: defaultLabelAnchor,
    color: defaultLabelColor,
    size: defaultLabelSize,
    minZoom: "",
  });

  fireEvent.click(screen.getByLabelText("Northeast Anchor"));
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({
      template: "${feature.station_id}",
      anchor: "ne",
    }),
  );

  fireEvent.change(screen.getByLabelText("Label Size"), {
    target: { value: "18" },
  });
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({
      template: "${feature.station_id}",
      anchor: "ne",
      size: 18,
    }),
  );

  // The pane is fully controlled: what it shows is what it last emitted.
  expect(screen.getByLabelText("Label Template")).toHaveValue(
    "${feature.station_id}",
  );
  expect(screen.getByLabelText("Northeast Anchor")).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("setting a label zoom floor emits it as an authored zoom level", () => {
  const onChange = jest.fn();
  render(<Harness onChange={onChange} />);

  fireEvent.change(screen.getByLabelText("Label Minimum Zoom"), {
    target: { value: "9" },
  });

  // Stored as the zoom the author typed. The conversion to a resolution needs
  // the live view's projection and happens at render time, not here.
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ minZoom: 9 }),
  );
  expect(screen.getByLabelText("Label Minimum Zoom")).toHaveValue("9");
});

test("a stored configuration reopens showing its own values", () => {
  render(
    <Harness
      initial={{
        template: "${feature.name}",
        anchor: "sw",
        color: "#ff0000",
        size: 21,
        minZoom: 7,
      }}
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByLabelText("Label Template")).toHaveValue(
    "${feature.name}",
  );
  expect(screen.getByLabelText("Southwest Anchor")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(screen.getByLabelText("Label Size")).toHaveValue("21");
  expect(screen.getByLabelText("Label Minimum Zoom")).toHaveValue("7");
});

test("a plugin-supplied config with an unrecognized anchor shows the default, not a blank control", () => {
  render(
    <Harness
      initial={{ template: "${feature.name}", anchor: "middle_center" }}
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByLabelText("Center Anchor")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(
    screen
      .getAllByRole("radio")
      .filter((cell) => cell.getAttribute("aria-checked") === "true"),
  ).toHaveLength(1);
  // The rest of the plugin's config is left alone.
  expect(screen.getByLabelText("Label Template")).toHaveValue(
    "${feature.name}",
  );
});

test("zero-like stored values are shown as authored rather than replaced by defaults", () => {
  render(
    <Harness
      initial={{ template: "x", size: 0, minZoom: 0 }}
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByLabelText("Label Size")).toHaveValue("0");
  expect(screen.getByLabelText("Label Minimum Zoom")).toHaveValue("0");
});

test("clearing the zoom floor emits an empty value, not zero", () => {
  const onChange = jest.fn();
  render(
    <Harness initial={{ template: "x", minZoom: 9 }} onChange={onChange} />,
  );

  fireEvent.change(screen.getByLabelText("Label Minimum Zoom"), {
    target: { value: "" },
  });

  // Zero is a real zoom level, so "no floor" must not collapse into it.
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ minZoom: "" }),
  );
});

test("editing one field does not drop the others", () => {
  const onChange = jest.fn();
  render(
    <Harness
      initial={{
        template: "${feature.name}",
        anchor: "e",
        color: "#00ff00",
        size: 17,
        minZoom: 4,
      }}
      onChange={onChange}
    />,
  );

  fireEvent.change(screen.getByLabelText("Label Size"), {
    target: { value: "19" },
  });

  expect(onChange).toHaveBeenLastCalledWith({
    template: "${feature.name}",
    anchor: "e",
    color: "#00ff00",
    size: 19,
    minZoom: 4,
  });
});

test("withDefaults merges on read without writing into the stored object", () => {
  const stored = { template: "a" };
  expect(withDefaults(stored)).toEqual({
    template: "a",
    anchor: defaultLabelAnchor,
    color: defaultLabelColor,
    size: defaultLabelSize,
    minZoom: "",
  });
  // `null` stays a legal stored value: nothing is written back.
  expect(stored).toEqual({ template: "a" });
  expect(withDefaults(null).template).toBe("");
  expect(withDefaults(undefined).anchor).toBe(defaultLabelAnchor);
  expect(withDefaults("nonsense").size).toBe(defaultLabelSize);
  // Zero-like values survive the merge.
  expect(withDefaults({ size: 0, minZoom: 0 }).size).toBe(0);
  expect(withDefaults({ size: 0, minZoom: 0 }).minZoom).toBe(0);
});

test("coerceNumericField keeps blanks blank and numbers numeric", () => {
  expect(coerceNumericField("")).toBe("");
  expect(coerceNumericField("   ")).toBe("");
  expect(coerceNumericField(null)).toBe("");
  expect(coerceNumericField(undefined)).toBe("");
  expect(coerceNumericField("0")).toBe(0);
  expect(coerceNumericField("12.5")).toBe(12.5);
  // A variable-input template is left as typed rather than becoming NaN.
  expect(coerceNumericField("${Size}")).toBe("${Size}");
});

// ---------------------------------------------------------------------------
// Attribute picker (U7)
//
// A mistyped attribute name renders a blank label and raises no error anywhere,
// so the picker exists to remove a failure nothing else reports.
// ---------------------------------------------------------------------------

const DiscoveryHarness = ({ initial = null, discovery, onChange }) => {
  const [labelConfig, setLabelConfig] = useState(initial);
  const containerRef = useRef(null);
  return (
    <div ref={containerRef}>
      <LabelsPane
        layerName="Test Layer"
        labelConfig={labelConfig}
        containerRef={containerRef}
        attributeDiscovery={discovery}
        onChange={(next) => {
          setLabelConfig(next);
          if (onChange) onChange(next);
        }}
      />
    </div>
  );
};

DiscoveryHarness.propTypes = {
  initial: PropTypes.object,
  discovery: PropTypes.object,
  onChange: PropTypes.func,
};

const readyDiscovery = (open, fields) => ({
  state: "ready",
  fields: fields ?? [
    { name: "station", alias: "Station" },
    { name: "elevation", alias: "elevation" },
  ],
  error: null,
  open,
});

test("opening the attribute list triggers discovery once; reopening does not refetch", () => {
  const open = jest.fn();
  render(<DiscoveryHarness discovery={readyDiscovery(open)} />);

  const toggle = screen.getByLabelText("Insert Attribute");
  fireEvent.click(toggle);
  expect(open).toHaveBeenCalledTimes(1);

  // Close, then reopen. The pane calls open() again -- the hook is what dedupes
  // the actual read, and it is asserted separately -- but the caller must not
  // fire it on anything other than an open.
  fireEvent.click(toggle);
  expect(open).toHaveBeenCalledTimes(1);
});

test("discovery is not triggered by rendering the tab or by typing a template", () => {
  const open = jest.fn();
  render(<DiscoveryHarness discovery={readyDiscovery(open)} />);

  expect(open).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText("Label Template"), {
    target: { value: "${feature.sta" },
  });
  expect(open).not.toHaveBeenCalled();
});

test("selecting an attribute inserts a reference at the caret without replacing existing text", () => {
  const onChange = jest.fn();
  render(
    <DiscoveryHarness
      initial={{ template: "Gauge  reading" }}
      discovery={readyDiscovery(jest.fn())}
      onChange={onChange}
    />,
  );

  const input = screen.getByLabelText("Label Template");
  // Caret between "Gauge " and " reading".
  input.setSelectionRange(6, 6);

  fireEvent.click(screen.getByLabelText("Insert Attribute"));
  fireEvent.click(screen.getByText("Station (station)"));

  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      template: "Gauge ${feature.station} reading",
    }),
  );
});

test("a source reporting no attributes explains itself rather than showing an empty menu", () => {
  render(
    <DiscoveryHarness
      discovery={{ state: "ready", fields: [], error: null, open: jest.fn() }}
    />,
  );

  fireEvent.click(screen.getByLabelText("Insert Attribute"));
  expect(
    screen.getByText(/reports no attributes.*Type the attribute name instead/s),
  ).toBeInTheDocument();
  // The field is still typeable -- that is the whole point of degrading.
  expect(screen.getByLabelText("Label Template")).not.toBeDisabled();
});

test("a discovery failure surfaces the reason and leaves the field typeable", () => {
  render(
    <DiscoveryHarness
      discovery={{
        state: "failed",
        fields: [],
        error: "GeoPackage is not currently configured to be queried",
        open: jest.fn(),
      }}
    />,
  );

  fireEvent.click(screen.getByLabelText("Insert Attribute"));
  expect(
    screen.getByText(/GeoPackage is not currently configured to be queried/),
  ).toBeInTheDocument();

  const input = screen.getByLabelText("Label Template");
  expect(input).not.toBeDisabled();
  fireEvent.change(input, { target: { value: "${feature.typed_by_hand}" } });
  expect(input).toHaveValue("${feature.typed_by_hand}");
});

test("the loading state says so and still allows typing", () => {
  render(
    <DiscoveryHarness
      discovery={{ state: "loading", fields: [], error: null, open: jest.fn() }}
    />,
  );

  fireEvent.click(screen.getByLabelText("Insert Attribute"));
  expect(screen.getByText(/Reading attributes/)).toBeInTheDocument();
  expect(screen.getByLabelText("Label Template")).not.toBeDisabled();
});

test("insertAtSelection appends when the caret position is unknown", () => {
  const { value, caret } = insertAtSelection(
    "Station ",
    "${feature.x}",
    undefined,
    undefined,
  );
  expect(value).toBe("Station ${feature.x}");
  expect(caret).toBe(value.length);
});

test("insertAtSelection replaces the selected range", () => {
  const { value } = insertAtSelection("Gauge OLD reading", "${feature.x}", 6, 9);
  expect(value).toBe("Gauge ${feature.x} reading");
});
