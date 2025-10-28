// No need to import React for test file
import { render, fireEvent, screen } from "@testing-library/react";
import PlotlySettings from "components/modals/DataViewer/PlotlySettings";
import {
  VariableInputsContext,
  DataViewerModeContext,
} from "components/contexts/Contexts";

const mockSetSettings = jest.fn();
const mockAddVerticalLine = jest.fn();

jest.mock("components/visualizations/BasePlot", () => ({
  addVerticalLine: (...args) => mockAddVerticalLine(...args),
}));

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
  const visualizationRef = { current: {} };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function renderWithContext(settings = defaultSettings) {
    return render(
      <VariableInputsContext.Provider value={{ variableInputValues }}>
        <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
          <PlotlySettings
            settings={settings}
            setSettings={mockSetSettings}
            visualizationRef={visualizationRef}
          />
        </DataViewerModeContext.Provider>
      </VariableInputsContext.Provider>
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

    expect(mockAddVerticalLine).toHaveBeenCalledTimes(0);
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
    expect(screen.queryByLabelText(/Line Style/)).not.toBeInTheDocument();
  });

  it("shows default values and on selected then switch to off", () => {
    const settings = { plotlyVerticalLine: { mode: "on" } };

    renderWithContext(settings);

    expect(screen.getByLabelText(/On/)).toBeChecked();
    expect(screen.getByText("Date/Time")).toBeInTheDocument();
    expect(screen.getByLabelText(/Color/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Width/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Line Style/)).toBeInTheDocument();

    expect(mockAddVerticalLine).toHaveBeenCalledTimes(0);

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
    expect(screen.getByLabelText(/Line Style/)).toBeInTheDocument();

    expect(mockAddVerticalLine).toHaveBeenCalledWith(
      visualizationRef,
      "2025-10-24T12:00",
      {
        color: defaultSettings.plotlyVerticalLine.color,
        width: defaultSettings.plotlyVerticalLine.width,
        dash: defaultSettings.plotlyVerticalLine.dash,
      }
    );
  });

  it("calls setSettings on color change", () => {
    const settings = {
      plotlyVerticalLine: { ...defaultSettings.plotlyVerticalLine, mode: "on" },
    };
    renderWithContext(settings);

    fireEvent.change(screen.getByLabelText(/Color/), {
      target: { value: "#00ff00" },
    });

    const updateFn = mockSetSettings.mock.calls[0][0];
    const prevState = { plotlyVerticalLine: { value: "" } };
    const newState = updateFn(prevState);

    expect(newState).toEqual({
      plotlyVerticalLine: {
        value: "",
        color: "#00ff00",
      },
    });
  });

  it("calls setSettings on width change", () => {
    const settings = {
      plotlyVerticalLine: { ...defaultSettings.plotlyVerticalLine, mode: "on" },
    };
    renderWithContext(settings);

    fireEvent.change(screen.getByRole("spinbutton"), {
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

  it("calls setSettings on width change, bad value and default to 1", () => {
    const settings = {
      plotlyVerticalLine: { ...defaultSettings.plotlyVerticalLine, mode: "on" },
    };
    renderWithContext(settings);

    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "5aasd" },
    });

    const updateFn = mockSetSettings.mock.calls[0][0];
    const prevState = { plotlyVerticalLine: { value: "" } };
    const newState = updateFn(prevState);

    expect(newState).toEqual({
      plotlyVerticalLine: {
        value: "",
        width: 1,
      },
    });
  });

  it("calls setSettings on dash change", () => {
    const settings = {
      plotlyVerticalLine: { ...defaultSettings.plotlyVerticalLine, mode: "on" },
    };
    renderWithContext(settings);

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "dash" },
    });

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

  it("calls setSettings and addVerticalLine on value change", () => {
    const settings = {
      plotlyVerticalLine: { ...defaultSettings.plotlyVerticalLine, mode: "on" },
    };
    renderWithContext(settings);

    fireEvent.change(screen.getByRole("textbox"), {
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

    expect(mockAddVerticalLine).toHaveBeenCalledWith(
      visualizationRef,
      "10/24/2025 12:00 PM",
      {
        color: defaultSettings.plotlyVerticalLine.color,
        width: defaultSettings.plotlyVerticalLine.width,
        dash: defaultSettings.plotlyVerticalLine.dash,
      }
    );
  });

  it("calls setSettings and addVerticalLine on variable value change", () => {
    const settings = {
      plotlyVerticalLine: { ...defaultSettings.plotlyVerticalLine, mode: "on" },
    };
    renderWithContext(settings);

    fireEvent.change(screen.getByRole("textbox"), {
      // eslint-disable-next-line
      target: { value: "${depVar}" },
    });

    const updateFn = mockSetSettings.mock.calls[0][0];
    const prevState = { plotlyVerticalLine: { value: "" } };
    const newState = updateFn(prevState);
    expect(newState).toEqual({
      plotlyVerticalLine: {
        // eslint-disable-next-line
        value: "${depVar}",
      },
    });

    expect(mockAddVerticalLine).toHaveBeenCalledWith(
      visualizationRef,
      variableInputValues["depVar"],
      {
        color: defaultSettings.plotlyVerticalLine.color,
        width: defaultSettings.plotlyVerticalLine.width,
        dash: defaultSettings.plotlyVerticalLine.dash,
      }
    );
  });

  it("calls setSettings and addVerticalLine on variable value change, doesnt resolve", () => {
    const settings = {
      plotlyVerticalLine: { ...defaultSettings.plotlyVerticalLine, mode: "on" },
    };
    renderWithContext(settings);

    fireEvent.change(screen.getByRole("textbox"), {
      // eslint-disable-next-line
      target: { value: "${dep}" },
    });

    const updateFn = mockSetSettings.mock.calls[0][0];
    const prevState = { plotlyVerticalLine: { value: "" } };
    const newState = updateFn(prevState);
    expect(newState).toEqual({
      plotlyVerticalLine: {
        // eslint-disable-next-line
        value: "${dep}",
      },
    });

    expect(mockAddVerticalLine).toHaveBeenCalledTimes(0);
  });

  it("resolves variable value and calls addVerticalLine", () => {
    const settings = {
      plotlyVerticalLine: {
        ...defaultSettings.plotlyVerticalLine,
        mode: "on",
        // eslint-disable-next-line
        value: "${depVar}",
      },
    };
    renderWithContext(settings);

    expect(mockAddVerticalLine).toHaveBeenCalledWith(
      visualizationRef,
      variableInputValues["depVar"],
      {
        color: defaultSettings.plotlyVerticalLine.color,
        width: defaultSettings.plotlyVerticalLine.width,
        dash: defaultSettings.plotlyVerticalLine.dash,
      }
    );
  });
});
