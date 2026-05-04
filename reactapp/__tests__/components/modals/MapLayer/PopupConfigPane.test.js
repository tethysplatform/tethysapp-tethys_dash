/* eslint-disable no-template-curly-in-string */
// This file tests literal `${feature.x}` template syntax handling.
import { useState } from "react";
import PropTypes from "prop-types";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PopupConfigPane from "components/modals/MapLayer/PopupConfigPane";

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

test("renders with popupConfig=null and shows table mode selected, no advanced controls", () => {
  render(<Harness onChange={jest.fn()} />);

  const tableRadio = screen.getByLabelText("Popup Mode Table");
  const modalRadio = screen.getByLabelText("Popup Mode Modal");
  expect(tableRadio).toBeChecked();
  expect(modalRadio).not.toBeChecked();

  // Advanced controls hidden until modal mode is selected
  expect(screen.queryByLabelText("Popup Width Percent")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Popup Height Percent")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Popup Anchor Name")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Popup Title Template")).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Edit Popup Layout Button"),
  ).not.toBeInTheDocument();
});

test("toggling mode to modal reveals size/anchor/title and the Edit popup layout button", async () => {
  const onChange = jest.fn();
  render(<Harness onChange={onChange} />);

  const modalRadio = screen.getByLabelText("Popup Mode Modal");
  await userEvent.click(modalRadio);

  expect(screen.getByLabelText("Popup Width Percent")).toBeInTheDocument();
  expect(screen.getByLabelText("Popup Height Percent")).toBeInTheDocument();
  expect(screen.getByLabelText("Popup Anchor Name")).toBeInTheDocument();
  expect(screen.getByLabelText("Popup Anchor Offset X")).toBeInTheDocument();
  expect(screen.getByLabelText("Popup Anchor Offset Y")).toBeInTheDocument();
  expect(screen.getByLabelText("Popup Title Template")).toBeInTheDocument();
  expect(screen.getByLabelText("Edit Popup Layout Button")).toBeInTheDocument();

  // First onChange call carries the new mode.
  expect(onChange).toHaveBeenCalled();
  const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
  expect(lastCall.mode).toBe("modal");
});

test("setting size, anchor, and title emits the full popupConfig via onChange", async () => {
  const onChange = jest.fn();
  render(
    <Harness
      initial={{
        mode: "modal",
        size: { widthPct: 60, heightPct: 60 },
        anchor: { name: "center", offsetX: 0, offsetY: 0 },
        titleTemplate: "",
        gridItems: [],
      }}
      onChange={onChange}
    />,
  );

  const widthInput = screen.getByLabelText("Popup Width Percent");
  fireEvent.change(widthInput, { target: { value: "60" } });
  // 60 -> 50 height
  const heightInput = screen.getByLabelText("Popup Height Percent");
  fireEvent.change(heightInput, { target: { value: "50" } });
  // anchor (still center, but exercise the change handler)
  const anchorSelect = screen.getByLabelText("Popup Anchor Name");
  fireEvent.change(anchorSelect, { target: { value: "center" } });
  // title
  const titleInput = screen.getByLabelText("Popup Title Template");
  fireEvent.change(titleInput, {
    target: { value: "Site: ${feature.station_name}" },
  });

  // Verify the most recent emitted popupConfig has all fields
  const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
  expect(last.mode).toBe("modal");
  expect(last.size.widthPct).toBe(60);
  expect(last.size.heightPct).toBe(50);
  expect(last.anchor.name).toBe("center");
  expect(last.titleTemplate).toBe("Site: ${feature.station_name}");
});

test("invalid widthPct values are clamped to the 20–95 range before onChange", () => {
  const onChange = jest.fn();
  render(
    <Harness
      initial={{
        mode: "modal",
        size: { widthPct: 60, heightPct: 60 },
        anchor: { name: "center", offsetX: 0, offsetY: 0 },
        titleTemplate: "",
        gridItems: [],
      }}
      onChange={onChange}
    />,
  );

  const widthInput = screen.getByLabelText("Popup Width Percent");

  fireEvent.change(widthInput, { target: { value: "150" } });
  let last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
  expect(last.size.widthPct).toBe(95);

  fireEvent.change(widthInput, { target: { value: "-10" } });
  last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
  expect(last.size.widthPct).toBe(20);

  // Empty string coerces to 0 via Number(""), which is below the min and is
  // therefore clamped to SIZE_MIN.
  fireEvent.change(widthInput, { target: { value: "" } });
  last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
  expect(last.size.widthPct).toBe(20);
});

test("toggling mode table → modal → table preserves size/anchor/title in form state", async () => {
  render(<Harness />);

  // table -> modal
  await userEvent.click(screen.getByLabelText("Popup Mode Modal"));
  const widthInput = screen.getByLabelText("Popup Width Percent");
  fireEvent.change(widthInput, { target: { value: "75" } });
  const titleInput = screen.getByLabelText("Popup Title Template");
  fireEvent.change(titleInput, { target: { value: "T-${feature.id}" } });

  // modal -> table (controls hidden)
  await userEvent.click(screen.getByLabelText("Popup Mode Table"));
  expect(
    screen.queryByLabelText("Popup Width Percent"),
  ).not.toBeInTheDocument();

  // table -> modal again; previously typed width and title still present
  await userEvent.click(screen.getByLabelText("Popup Mode Modal"));
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
        size: { widthPct: 60, heightPct: 60 },
        anchor: { name: "center", offsetX: 0, offsetY: 0 },
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
        size: { widthPct: 60, heightPct: 60 },
        anchor: { name: "center", offsetX: 0, offsetY: 0 },
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
        size: { widthPct: 60, heightPct: 60 },
        anchor: { name: "center", offsetX: 0, offsetY: 0 },
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

test("anchor offsets accept negative values and persist them in the emitted config", () => {
  const onChange = jest.fn();
  render(
    <Harness
      initial={{
        mode: "modal",
        size: { widthPct: 60, heightPct: 60 },
        anchor: { name: "center", offsetX: 0, offsetY: 0 },
        titleTemplate: "",
        gridItems: [],
      }}
      onChange={onChange}
    />,
  );

  const offsetX = screen.getByLabelText("Popup Anchor Offset X");
  fireEvent.change(offsetX, { target: { value: "-50" } });
  const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
  expect(last.anchor.offsetX).toBe(-50);
});

test("anchor select updates anchor.name to a non-default option", () => {
  const onChange = jest.fn();
  render(
    <Harness
      initial={{
        mode: "modal",
        size: { widthPct: 60, heightPct: 60 },
        anchor: { name: "center", offsetX: 0, offsetY: 0 },
        titleTemplate: "",
        gridItems: [],
      }}
      onChange={onChange}
    />,
  );

  const anchorSelect = screen.getByLabelText("Popup Anchor Name");
  fireEvent.change(anchorSelect, { target: { value: "top-right" } });
  const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
  expect(last.anchor.name).toBe("top-right");
});
