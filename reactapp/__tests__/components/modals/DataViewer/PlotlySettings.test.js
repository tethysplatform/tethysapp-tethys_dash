// No need to import React for test file
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import PlotlySettings from "components/modals/DataViewer/PlotlySettings";
import {
  VariableInputsContext,
  DataViewerModeContext,
} from "components/contexts/Contexts";
import selectEvent from "react-select-event";

const mockSetSettings = jest.fn();

beforeEach(() => {
  delete window.ResizeObserver;
  window.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
});

afterEach(() => {
  window.ResizeObserver = ResizeObserver;
  jest.restoreAllMocks();
});

describe("PlotlySettings", () => {
  const defaultSettings = {
    plotlyVerticalLine: {
      mode: "off",
      value: "",
      color: "#ff0000",
      width: 2,
      dash: "solid",
    },
  };
  const variableInputValues = { depVar: "2025-10-24T12:00" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function renderWithContext(settings = defaultSettings) {
    return render(
      <VariableInputsContext.Provider value={{ variableInputValues }}>
        <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
          <PlotlySettings settings={settings} setSettings={mockSetSettings} />
        </DataViewerModeContext.Provider>
      </VariableInputsContext.Provider>,
    );
  }

  it("renders vertical line mode radio buttons", () => {
    renderWithContext();
    expect(screen.getByLabelText(/Off/)).toBeInTheDocument();
    expect(screen.getByLabelText(/On/)).toBeInTheDocument();
  });

  it("load with variable value, doesnt resolve", () => {
    const settings = {
      // eslint-disable-next-line
      plotlyVerticalLine: { value: "${dep}", mode: "on" },
    };
    renderWithContext(settings);
  });

  it("switches to 'on' mode and shows inputs", () => {
    renderWithContext();
    fireEvent.click(screen.getByLabelText(/On/));

    const updateFn = mockSetSettings.mock.calls[0][0];
    const prevState = { plotlyVerticalLine: { value: "" } };
    const newState = updateFn(prevState);

    expect(newState).toEqual({
      plotlyVerticalLine: {
        color: "#ff0000",
        dash: "solid",
        mode: "on",
        value: "",
        width: 2,
      },
    });
  });

  it("shows default values and off selected", () => {
    const settings = {};

    renderWithContext(settings);

    expect(screen.getByLabelText(/Off/)).toBeChecked();
    expect(screen.queryByText("Date/Time")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Color/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Width/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("linestyle")).not.toBeInTheDocument();
  });

  it("shows default values and on selected then switch to off", () => {
    const settings = { plotlyVerticalLine: { mode: "on" } };

    renderWithContext(settings);

    expect(screen.getByLabelText(/On/)).toBeChecked();
    expect(screen.getByText("Date/Time")).toBeInTheDocument();
    expect(screen.getByLabelText(/Color/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Width/)).toBeInTheDocument();
    expect(screen.getByLabelText("linestyle")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Off/));

    const updateFn = mockSetSettings.mock.calls[0][0];
    const prevState = { plotlyVerticalLine: { value: "" } };
    const newState = updateFn(prevState);

    expect(newState).toStrictEqual({});
  });

  it("shows datepicker, color, width, dash when mode is 'on'", () => {
    const settings = {
      plotlyVerticalLine: {
        mode: "on",
        value: "2025-10-24T12:00",
        color: "#ff0000",
        width: 2,
        dash: "solid",
      },
    };

    renderWithContext(settings);

    expect(screen.getByText("Date/Time")).toBeInTheDocument();
    expect(screen.getByLabelText(/Color/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Width/)).toBeInTheDocument();
    expect(screen.getByLabelText("linestyle")).toBeInTheDocument();
  });

  it("calls setSettings on color change", async () => {
    const settings = {
      plotlyVerticalLine: { ...defaultSettings.plotlyVerticalLine, mode: "on" },
    };
    renderWithContext(settings);

    const colorPopoverSwatch = screen.getByLabelText(
      "Color color popover square",
    );
    fireEvent.click(colorPopoverSwatch);

    const newColor = screen.getByRole("textbox", { name: "HEX" });
    fireEvent.change(newColor, { target: { value: "#2aff00" } });

    await waitFor(() => {
      expect(mockSetSettings).toHaveBeenCalled();
    });
    const updateFn = mockSetSettings.mock.calls[0][0];
    const prevState = { plotlyVerticalLine: { value: "" } };
    const newState = updateFn(prevState);

    expect(newState).toEqual({
      plotlyVerticalLine: {
        value: "",
        color: "#2aff00",
      },
    });
  });

  it("calls setSettings on width change", () => {
    const settings = {
      plotlyVerticalLine: { ...defaultSettings.plotlyVerticalLine, mode: "on" },
    };
    renderWithContext(settings);

    fireEvent.change(screen.getByLabelText("Vertical Line Width"), {
      target: { value: "5" },
    });

    const updateFn = mockSetSettings.mock.calls[0][0];
    const prevState = { plotlyVerticalLine: { value: "" } };
    const newState = updateFn(prevState);

    expect(newState).toEqual({
      plotlyVerticalLine: {
        value: "",
        width: 5,
      },
    });
  });

  it("defaults width to 1 when given non-numeric value", () => {
    const settings = {
      plotlyVerticalLine: { ...defaultSettings.plotlyVerticalLine, mode: "on" },
    };
    renderWithContext(settings);

    // Simulate the setter being called with a non-numeric string
    // This covers the `parseInt(width) || 1` fallback on line 133
    const widthInput = screen.getByLabelText("Vertical Line Width");
    fireEvent.change(widthInput, { target: { value: "" } });

    // NormalInput won't propagate empty, so call handleVerticalLineWidthChange
    // indirectly by invoking the setter with a value that parseInt can't parse
    // We can test the fallback by checking the update function directly
    // First trigger a valid change then check the updater
    fireEvent.change(widthInput, { target: { value: "0" } });

    const updateFn = mockSetSettings.mock.calls[0][0];
    const prevState = { plotlyVerticalLine: { value: "" } };
    const newState = updateFn(prevState);

    // parseInt("0") is 0 which is falsy, so || 1 kicks in
    expect(newState).toEqual({
      plotlyVerticalLine: {
        value: "",
        width: 1,
      },
    });
  });

  it("rejects invalid width input and does not call setSettings", () => {
    const settings = {
      plotlyVerticalLine: { ...defaultSettings.plotlyVerticalLine, mode: "on" },
    };
    renderWithContext(settings);

    fireEvent.change(screen.getByLabelText("Vertical Line Width"), {
      target: { value: "5aasd" },
    });

    // NormalInput blocks non-numeric input, so setSettings should not be called
    expect(mockSetSettings).not.toHaveBeenCalled();
  });

  it("calls setSettings on dash change", async () => {
    const settings = {
      plotlyVerticalLine: { ...defaultSettings.plotlyVerticalLine, mode: "on" },
    };
    renderWithContext(settings);

    const lineStyleSelect = screen.getByLabelText("linestyle");
    await selectEvent.select(lineStyleSelect, "Dashed");

    const updateFn = mockSetSettings.mock.calls[0][0];
    const prevState = { plotlyVerticalLine: { value: "" } };
    const newState = updateFn(prevState);

    expect(newState).toEqual({
      plotlyVerticalLine: {
        dash: "dash",
        value: "",
      },
    });
  });

  it("calls setSettings on editable change", async () => {
    const settings = {
      plotlyVerticalLine: { ...defaultSettings.plotlyVerticalLine, mode: "on" },
    };
    renderWithContext(settings);

    const editableCheckbox = screen.getByLabelText(/Draggable/);
    fireEvent.click(editableCheckbox);

    const updateFn = mockSetSettings.mock.calls[0][0];
    const prevState = {
      plotlyVerticalLine: {
        value: "",
        color: "#ff0000",
        width: 2,
        dash: "solid",
      },
    };
    const newState = updateFn(prevState);

    expect(newState).toEqual({
      plotlyVerticalLine: {
        value: "",
        color: "#ff0000",
        width: 2,
        dash: "solid",
        editable: true,
      },
    });
  });

  it("calls setSettings on editable change, uncheck", async () => {
    const settings = {
      plotlyVerticalLine: {
        ...defaultSettings.plotlyVerticalLine,
        mode: "on",
        editable: true,
      },
    };
    renderWithContext(settings);

    const editableCheckbox = screen.getByLabelText(/Draggable/);
    fireEvent.click(editableCheckbox);

    const updateFn = mockSetSettings.mock.calls[0][0];
    const prevState = {
      plotlyVerticalLine: {
        value: "",
        color: "#ff0000",
        width: 2,
        dash: "solid",
        editable: true,
      },
    };
    const newState = updateFn(prevState);

    expect(newState).toEqual({
      plotlyVerticalLine: {
        value: "",
        color: "#ff0000",
        width: 2,
        dash: "solid",
      },
    });
  });

  it("calls setSettings on snap to data change", async () => {
    const settings = {
      plotlyVerticalLine: {
        ...defaultSettings.plotlyVerticalLine,
        mode: "on",
        editable: true,
      },
    };
    renderWithContext(settings);

    const snapToDataDropdown = screen.getByLabelText(/snapto/);
    await selectEvent.select(snapToDataDropdown, "Day");

    const updateFn = mockSetSettings.mock.calls[0][0];
    const prevState = {
      plotlyVerticalLine: {
        value: "",
        color: "#ff0000",
        width: 2,
        dash: "solid",
        editable: true,
      },
    };
    const newState = updateFn(prevState);

    expect(newState).toEqual({
      plotlyVerticalLine: {
        value: "",
        color: "#ff0000",
        width: 2,
        dash: "solid",
        editable: true,
        step: "day",
      },
    });
  });

  it("calls setSettings on line value change", async () => {
    const settings = {
      plotlyVerticalLine: { ...defaultSettings.plotlyVerticalLine, mode: "on" },
    };
    renderWithContext(settings);

    const datePickerInput = screen.getByLabelText("Date/Time");
    fireEvent.change(datePickerInput, {
      target: { value: "2025-10-24T12:00" },
    });

    const updateFn = mockSetSettings.mock.calls[0][0];
    const prevState = { plotlyVerticalLine: { value: "" } };
    const newState = updateFn(prevState);

    expect(newState).toEqual({
      plotlyVerticalLine: {
        value: "10/24/2025 12:00 PM",
      },
    });
  });
});
