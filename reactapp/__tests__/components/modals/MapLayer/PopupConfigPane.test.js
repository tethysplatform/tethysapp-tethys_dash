/* eslint-disable no-template-curly-in-string */
// This file tests literal `${feature.x}` template syntax handling.
import { useState } from "react";
import PropTypes from "prop-types";
import { render, screen, fireEvent, createEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PopupConfigPane, {
  reconcilePosition,
  clampPct,
  withDefaults,
  DEFAULT_POSITION,
} from "components/modals/MapLayer/PopupConfigPane";

const SAMPLE_POSITION = {
  leftPct: 20,
  topPct: 20,
  widthPct: 60,
  heightPct: 60,
};

const Harness = ({ initial = null, onChange, ...rest }) => {
  const [popupConfig, setPopupConfig] = useState(initial);
  return (
    <PopupConfigPane
      layerName="Test Layer"
      popupConfig={popupConfig}
      onChange={(next) => {
        setPopupConfig(next);
        if (onChange) onChange(next);
      }}
      {...rest}
    />
  );
};

Harness.propTypes = {
  initial: PropTypes.object,
  onChange: PropTypes.func,
};

test("renders with popupConfig=null and shows the modal-enable checkbox unchecked, no advanced controls", () => {
  render(<Harness onChange={jest.fn()} />);

  const modalCheckbox = screen.getByLabelText("Enable Custom Popup Modal");
  expect(modalCheckbox).not.toBeChecked();

  // Advanced controls hidden until the custom popup modal is enabled
  expect(
    screen.queryByLabelText("Popup Width Percent"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Popup Height Percent"),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Popup Left Percent")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Popup Top Percent")).not.toBeInTheDocument();
  expect(screen.queryByTestId("popup-preview-canvas")).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Popup Title Template"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Edit Popup Layout Button"),
  ).not.toBeInTheDocument();
});

test("checking the modal-enable checkbox reveals position canvas + numeric inputs + title + Edit popup layout button", async () => {
  const onChange = jest.fn();
  render(<Harness onChange={onChange} />);

  const modalCheckbox = screen.getByLabelText("Enable Custom Popup Modal");
  await userEvent.click(modalCheckbox);

  expect(screen.getByTestId("popup-preview-canvas")).toBeInTheDocument();
  expect(screen.getByLabelText("Popup Left Percent")).toBeInTheDocument();
  expect(screen.getByLabelText("Popup Top Percent")).toBeInTheDocument();
  expect(screen.getByLabelText("Popup Width Percent")).toBeInTheDocument();
  expect(screen.getByLabelText("Popup Height Percent")).toBeInTheDocument();
  expect(screen.getByLabelText("Popup Title Template")).toBeInTheDocument();
  expect(screen.getByLabelText("Edit Popup Layout Button")).toBeInTheDocument();

  // First onChange call carries the new mode.
  expect(onChange).toHaveBeenCalled();
  const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
  expect(lastCall.mode).toBe("modal");
});

test("setting position fields and title emits the full popupConfig via onChange", () => {
  const onChange = jest.fn();
  render(
    <Harness
      initial={{
        mode: "modal",
        position: { ...SAMPLE_POSITION },
        titleTemplate: "",
        gridItems: [],
      }}
      onChange={onChange}
    />,
  );

  const widthInput = screen.getByLabelText("Popup Width Percent");
  fireEvent.change(widthInput, { target: { value: "60" } });
  const heightInput = screen.getByLabelText("Popup Height Percent");
  fireEvent.change(heightInput, { target: { value: "50" } });
  const leftInput = screen.getByLabelText("Popup Left Percent");
  fireEvent.change(leftInput, { target: { value: "15" } });
  const topInput = screen.getByLabelText("Popup Top Percent");
  fireEvent.change(topInput, { target: { value: "25" } });
  const titleInput = screen.getByLabelText("Popup Title Template");
  fireEvent.change(titleInput, {
    target: { value: "Site: ${feature.station_name}" },
  });

  const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
  expect(last.mode).toBe("modal");
  expect(last.position.widthPct).toBe(60);
  expect(last.position.heightPct).toBe(50);
  expect(last.position.leftPct).toBe(15);
  expect(last.position.topPct).toBe(25);
  expect(last.titleTemplate).toBe("Site: ${feature.station_name}");
});

test("invalid widthPct is clamped to the size range before onChange", () => {
  const onChange = jest.fn();
  render(
    <Harness
      initial={{
        mode: "modal",
        position: { ...SAMPLE_POSITION },
        titleTemplate: "",
        gridItems: [],
      }}
      onChange={onChange}
    />,
  );

  const widthInput = screen.getByLabelText("Popup Width Percent");

  fireEvent.change(widthInput, { target: { value: "150" } });
  let last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
  expect(last.position.widthPct).toBe(100);

  fireEvent.change(widthInput, { target: { value: "5" } });
  last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
  expect(last.position.widthPct).toBe(20);
});

test("setting widthPct above remaining canvas space reconciles by shrinking leftPct", () => {
  const onChange = jest.fn();
  render(
    <Harness
      initial={{
        mode: "modal",
        position: { leftPct: 70, topPct: 0, widthPct: 30, heightPct: 30 },
        titleTemplate: "",
        gridItems: [],
      }}
      onChange={onChange}
    />,
  );

  const widthInput = screen.getByLabelText("Popup Width Percent");
  fireEvent.change(widthInput, { target: { value: "60" } });
  const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
  // 70 + 60 > 100, so left clamps to 100 - 60 = 40
  expect(last.position.widthPct).toBe(60);
  expect(last.position.leftPct).toBe(40);
});

test("toggling the modal-enable checkbox preserves position + title in form state across re-checks", async () => {
  render(<Harness />);

  const modalCheckbox = screen.getByLabelText("Enable Custom Popup Modal");
  await userEvent.click(modalCheckbox);
  const widthInput = screen.getByLabelText("Popup Width Percent");
  fireEvent.change(widthInput, { target: { value: "75" } });
  const titleInput = screen.getByLabelText("Popup Title Template");
  fireEvent.change(titleInput, { target: { value: "T-${feature.id}" } });

  // Uncheck → modal-only fields disappear.
  await userEvent.click(screen.getByLabelText("Enable Custom Popup Modal"));
  expect(
    screen.queryByLabelText("Popup Width Percent"),
  ).not.toBeInTheDocument();

  // Re-check → previously typed width and title still present in state.
  await userEvent.click(screen.getByLabelText("Enable Custom Popup Modal"));
  expect(screen.getByLabelText("Popup Width Percent").value).toBe("75");
  expect(screen.getByLabelText("Popup Title Template").value).toBe(
    "T-${feature.id}",
  );
});

test("hostDashboardEditable=false hides the Edit popup layout button", () => {
  render(
    <Harness
      initial={{
        mode: "modal",
        position: { ...SAMPLE_POSITION },
        titleTemplate: "",
        gridItems: [],
      }}
      onChange={jest.fn()}
      hostDashboardEditable={false}
    />,
  );

  expect(
    screen.queryByLabelText("Edit Popup Layout Button"),
  ).not.toBeInTheDocument();
});

test("clicking Edit popup layout calls onOpenLayoutEditor", async () => {
  const onOpenLayoutEditor = jest.fn();
  render(
    <Harness
      initial={{
        mode: "modal",
        position: { ...SAMPLE_POSITION },
        titleTemplate: "",
        gridItems: [],
      }}
      onChange={jest.fn()}
      onOpenLayoutEditor={onOpenLayoutEditor}
    />,
  );

  const button = screen.getByLabelText("Edit Popup Layout Button");
  await userEvent.click(button);
  expect(onOpenLayoutEditor).toHaveBeenCalledTimes(1);
});

test("title template input accepts ${feature.x} syntax verbatim", () => {
  const onChange = jest.fn();
  render(
    <Harness
      initial={{
        mode: "modal",
        position: { ...SAMPLE_POSITION },
        titleTemplate: "",
        gridItems: [],
      }}
      onChange={onChange}
    />,
  );

  const titleInput = screen.getByLabelText("Popup Title Template");
  const value = "${feature.station_name} (${feature.state_id})";
  fireEvent.change(titleInput, { target: { value } });

  const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
  expect(last.titleTemplate).toBe(value);
});

test("preview canvas reflects current position via inline percent style", () => {
  render(
    <Harness
      initial={{
        mode: "modal",
        position: { leftPct: 10, topPct: 5, widthPct: 80, heightPct: 70 },
        titleTemplate: "",
        gridItems: [],
      }}
      onChange={jest.fn()}
    />,
  );

  const rect = screen.getByTestId("popup-preview-rect");
  expect(rect).toHaveStyle("left: 10%");
  expect(rect).toHaveStyle("top: 5%");
  expect(rect).toHaveStyle("width: 80%");
  expect(rect).toHaveStyle("height: 70%");
});

test("dragging the PreviewCanvas rect calls handleCanvasChange with the reconciled position", () => {
  // JSDOM returns zero from getBoundingClientRect, so canvasWidth/canvasHeight
  // fall back to 1 inside PreviewCanvas. A 1px pointer move therefore equals
  // 100% of the canvas: dxPct = (1 - 0) / 1 * 100 = 100.
  //
  // computeNextPosition("body", start={left:20,top:20,w:60,h:60}, dx=100, dy=100):
  //   leftPct = clamp(20 + 100, 0, 100-60) = clamp(120, 0, 40) = 40
  //   topPct  = clamp(20 + 100, 0, 100-60) = clamp(120, 0, 40) = 40
  //
  // reconcilePosition: 40+60=100 and 40+60=100, so no further adjustment.
  const onChange = jest.fn();
  render(
    <Harness
      initial={{
        mode: "modal",
        position: { leftPct: 20, topPct: 20, widthPct: 60, heightPct: 60 },
        titleTemplate: "",
        gridItems: [],
      }}
      onChange={onChange}
    />,
  );

  const rect = screen.getByTestId("popup-preview-rect");

  // JSDOM's pointer-event constructor drops clientX/clientY from the init
  // dict; use createEvent + defineProperty (the same workaround used in
  // PreviewCanvas.test.js).
  function ptr(type, clientX, clientY) {
    const e = createEvent[type](rect, { bubbles: true, cancelable: true });
    Object.defineProperty(e, "clientX", { value: clientX });
    Object.defineProperty(e, "clientY", { value: clientY });
    Object.defineProperty(e, "pointerId", { value: 1 });
    return e;
  }

  fireEvent(rect, ptr("pointerDown", 0, 0));
  fireEvent(rect, ptr("pointerMove", 1, 1));

  const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
  expect(last.position.leftPct).toBe(40);
  expect(last.position.topPct).toBe(40);
  expect(last.position.widthPct).toBe(60);
  expect(last.position.heightPct).toBe(60);
});

describe("reconcilePosition", () => {
  test("does not modify a position that fits within the canvas bounds", () => {
    const input = { leftPct: 20, topPct: 20, widthPct: 60, heightPct: 60 };
    const output = reconcilePosition(input);
    expect(output).toEqual(input);
  });

  test("if widthPct causes overflow, shrink width to fit", () => {
    const input = { leftPct: 30, topPct: 0, widthPct: 80, heightPct: 30 };
    const output = reconcilePosition(input);
    expect(output.widthPct).toBe(80);
    expect(output.leftPct).toBe(20);
  });

  test("if leftPct + widthPct causes overflow, clamp left to keep width intact", () => {
    const input = { leftPct: 70, topPct: 0, widthPct: 40, heightPct: 30 };
    const output = reconcilePosition(input);
    expect(output.widthPct).toBe(40);
    expect(output.leftPct).toBe(60);
  });

  test("if widthPct > 100, width doesnt change and left to 0", () => {
    const input = { leftPct: 0, topPct: 0, widthPct: 150, heightPct: 30 };
    const output = reconcilePosition(input);
    expect(output.widthPct).toBe(150);
    expect(output.leftPct).toBe(0);
  });

  test("if heightPct  > 100, height doesnt change and top to 0", () => {
    const input = { leftPct: 0, topPct: 100, widthPct: 30, heightPct: 150 };
    const output = reconcilePosition(input);
    expect(output.heightPct).toBe(150);
    expect(output.topPct).toBe(0);
  });

  test("if topPct + heightPct causes overflow, clamp top to keep height intact", () => {
    const input = { leftPct: 0, topPct: 70, widthPct: 40, heightPct: 40 };
    const output = reconcilePosition(input);
    expect(output.heightPct).toBe(40);
    expect(output.topPct).toBe(60);
  });
});

describe("clampPct", () => {
  test("returns fallback for empty/null/undefined input", () => {
    expect(clampPct("", 42, 0, 100)).toBe(42);
    expect(clampPct(null, 42, 0, 100)).toBe(42);
    expect(clampPct(undefined, 42, 0, 100)).toBe(42);
  });

  test("returns fallback for non-numeric input", () => {
    expect(clampPct("abc", 42, 0, 100)).toBe(42);
    expect(clampPct({}, 42, 0, 100)).toBe(42);
  });

  test("clamps numeric input to the supplied min/max range", () => {
    expect(clampPct(-10, 0, 20, 80)).toBe(20);
    expect(clampPct(10, 0, 20, 80)).toBe(20);
    expect(clampPct(50, 0, 20, 80)).toBe(50);
    expect(clampPct(90, 0, 20, 80)).toBe(80);
    expect(clampPct(150, 0, 20, 80)).toBe(80);
  });
});

describe("withDefaults", () => {
  test("returns default position and titleTemplate when popupConfig is null", () => {
    const result = withDefaults(null);
    expect(result.position).toEqual(DEFAULT_POSITION);
    expect(result.titleTemplate).toBe("");
  });

  test("returns the original popupConfig values when all fields are present", () => {
    const input = {
      mode: "modal",
      position: { leftPct: 10, topPct: 10, widthPct: 50, heightPct: 50 },
      titleTemplate: "Test",
      gridItems: [],
    };
    const result = withDefaults(input);
    expect(result).toEqual(input);
  });

  test("fills in missing  fields with defaults", () => {
    const input = {
      mode: "modal",
      position: {},
      gridItems: [],
    };
    const result = withDefaults(input);
    expect(result.position).toEqual({
      leftPct: DEFAULT_POSITION.leftPct,
      topPct: DEFAULT_POSITION.topPct,
      widthPct: DEFAULT_POSITION.widthPct,
      heightPct: DEFAULT_POSITION.heightPct,
    });
    expect(result.titleTemplate).toBe("");
  });
});
