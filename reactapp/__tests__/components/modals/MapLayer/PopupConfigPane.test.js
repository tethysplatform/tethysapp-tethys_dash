/* eslint-disable no-template-curly-in-string */
// This file tests literal `${feature.x}` template syntax handling.
import { useState } from "react";
import PropTypes from "prop-types";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PopupConfigPane from "components/modals/MapLayer/PopupConfigPane";

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
  expect(screen.queryByLabelText("Popup Width Percent")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Popup Height Percent")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Popup Left Percent")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Popup Top Percent")).not.toBeInTheDocument();
  expect(screen.queryByTestId("popup-preview-canvas")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Popup Title Template")).not.toBeInTheDocument();
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
