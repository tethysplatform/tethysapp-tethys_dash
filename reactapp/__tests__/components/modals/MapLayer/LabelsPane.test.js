/* eslint-disable no-template-curly-in-string */
// This file exercises literal `${feature.x}` label-template syntax.
import { useRef, useState } from "react";
import PropTypes from "prop-types";
import { render, screen, fireEvent } from "@testing-library/react";
import LabelsPane, {
  withDefaults,
  coerceNumericField,
} from "components/modals/MapLayer/LabelsPane";
import {
  defaultLabelAnchor,
  defaultLabelColor,
  defaultLabelHaloColor,
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

test("renders the six controls seeded from the render defaults when nothing is stored", () => {
  render(<Harness onChange={jest.fn()} />);

  expect(screen.getByLabelText("Template")).toHaveValue("");
  expect(screen.getByLabelText("Text Size")).toHaveValue(
    String(defaultLabelSize),
  );
  expect(screen.getByLabelText("Minimum Display Zoom")).toHaveValue("");
  expect(screen.getByLabelText("Center Anchor")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(
    screen.getByLabelText("Text Color color popover square"),
  ).toBeInTheDocument();
  // Overlap off by default: labels keep hiding where they collide.
  expect(
    screen.getByLabelText("Allow Overlapping Labels Input"),
  ).not.toBeChecked();
});

test("typing a template, choosing an anchor and setting size emit the whole configuration", () => {
  const onChange = jest.fn();
  render(<Harness onChange={onChange} />);

  fireEvent.change(screen.getByLabelText("Template"), {
    target: { value: "${feature.station_id}" },
  });
  expect(onChange).toHaveBeenLastCalledWith({
    template: "${feature.station_id}",
    anchor: defaultLabelAnchor,
    color: defaultLabelColor,
    haloColor: defaultLabelHaloColor,
    size: defaultLabelSize,
    minZoom: "",
    allowOverlap: false,
  });

  fireEvent.click(screen.getByLabelText("Northeast Anchor"));
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({
      template: "${feature.station_id}",
      anchor: "ne",
    }),
  );

  fireEvent.change(screen.getByLabelText("Text Size"), {
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
  expect(screen.getByLabelText("Template")).toHaveValue(
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

  fireEvent.change(screen.getByLabelText("Minimum Display Zoom"), {
    target: { value: "9" },
  });

  // Stored as the zoom the author typed. The conversion to a resolution needs
  // the live view's projection and happens at render time, not here.
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ minZoom: 9 }),
  );
  expect(screen.getByLabelText("Minimum Display Zoom")).toHaveValue("9");
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

  expect(screen.getByLabelText("Template")).toHaveValue("${feature.name}");
  expect(screen.getByLabelText("Southwest Anchor")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(screen.getByLabelText("Text Size")).toHaveValue("21");
  expect(screen.getByLabelText("Minimum Display Zoom")).toHaveValue("7");
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
  expect(screen.getByLabelText("Template")).toHaveValue("${feature.name}");
});

test("zero-like stored values are shown as authored rather than replaced by defaults", () => {
  render(
    <Harness
      initial={{ template: "x", size: 0, minZoom: 0 }}
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByLabelText("Text Size")).toHaveValue("0");
  expect(screen.getByLabelText("Minimum Display Zoom")).toHaveValue("0");
});

test("clearing the zoom floor emits an empty value, not zero", () => {
  const onChange = jest.fn();
  render(
    <Harness initial={{ template: "x", minZoom: 9 }} onChange={onChange} />,
  );

  fireEvent.change(screen.getByLabelText("Minimum Display Zoom"), {
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

  fireEvent.change(screen.getByLabelText("Text Size"), {
    target: { value: "19" },
  });

  expect(onChange).toHaveBeenLastCalledWith({
    template: "${feature.name}",
    anchor: "e",
    color: "#00ff00",
    haloColor: defaultLabelHaloColor,
    size: 19,
    minZoom: 4,
    allowOverlap: false,
  });
});

test("withDefaults merges on read without writing into the stored object", () => {
  const stored = { template: "a" };
  expect(withDefaults(stored)).toEqual({
    template: "a",
    anchor: defaultLabelAnchor,
    color: defaultLabelColor,
    haloColor: defaultLabelHaloColor,
    size: defaultLabelSize,
    minZoom: "",
    allowOverlap: false,
  });
  // `null` stays a legal stored value: nothing is written back.
  expect(stored).toEqual({ template: "a" });
  expect(withDefaults(null).template).toBe("");
  expect(withDefaults(undefined).anchor).toBe(defaultLabelAnchor);
  expect(withDefaults("nonsense").size).toBe(defaultLabelSize);
  // Zero-like values survive the merge.
  expect(withDefaults({ size: 0, minZoom: 0 }).size).toBe(0);
  expect(withDefaults({ size: 0, minZoom: 0 }).minZoom).toBe(0);
  // A stored `false` is the author having turned the option off, not an absent
  // value for the default to fill in.
  expect(withDefaults({ allowOverlap: false }).allowOverlap).toBe(false);
  expect(withDefaults({ allowOverlap: true }).allowOverlap).toBe(true);
});

test("the overlap checkbox renders unchecked by default and emits when ticked", () => {
  const onChange = jest.fn();
  render(<Harness initial={{ template: "x" }} onChange={onChange} />);

  const checkbox = screen.getByLabelText("Allow Overlapping Labels Input");
  expect(checkbox).not.toBeChecked();

  fireEvent.click(checkbox);

  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ template: "x", allowOverlap: true }),
  );
  // Fully controlled, like every other field on the pane.
  expect(screen.getByLabelText("Allow Overlapping Labels Input")).toBeChecked();
});

test("a stored overlap setting reopens as the author left it", () => {
  render(
    <Harness
      initial={{ template: "x", allowOverlap: true }}
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByLabelText("Allow Overlapping Labels Input")).toBeChecked();
});

test("a stored false survives a round trip through an unrelated edit", () => {
  const onChange = jest.fn();
  render(
    <Harness
      initial={{ template: "x", size: 14, allowOverlap: false }}
      onChange={onChange}
    />,
  );

  expect(
    screen.getByLabelText("Allow Overlapping Labels Input"),
  ).not.toBeChecked();

  fireEvent.change(screen.getByLabelText("Text Size"), {
    target: { value: "15" },
  });

  // `??` rather than `||` in `withDefaults`: a stored `false` must come back
  // out as `false` rather than being refilled from the default.
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ size: 15, allowOverlap: false }),
  );

  fireEvent.click(screen.getByLabelText("Allow Overlapping Labels Input"));
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ size: 15, allowOverlap: true }),
  );
  fireEvent.click(screen.getByLabelText("Allow Overlapping Labels Input"));
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ size: 15, allowOverlap: false }),
  );
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
