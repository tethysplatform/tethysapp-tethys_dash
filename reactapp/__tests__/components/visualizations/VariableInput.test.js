import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import VariableInput from "components/visualizations/VariableInput";
import {
  mockedCheckboxVariable,
  mockedDropdownVariable,
  mockedNullCheckboxVariable,
  mockedNumberVariable,
  mockedTextVariable,
  mockedDropdownVisualization,
  userDashboard,
  mockedSliderVariable,
  mockedCSVUploaderVariable,
  mockedDateVariable,
  mockedDateRangeVariable,
  mockedCustomDropdownVariable,
} from "__tests__/utilities/constants";
import { select } from "react-select-event";
import createLoadedComponent, {
  InputVariablePComponent,
  VariableInputDateFormatsPComponent,
} from "__tests__/utilities/customRender";
import { getOrdinal } from "__tests__/utilities/constants";
import { format } from "date-fns";
import { dateHourFormat } from "components/inputs/dateUtils";
import {
  AppContext,
  DataViewerModeContext,
  GridItemContext,
  VariableInputsContext,
} from "components/contexts/Contexts";

const advanceTimers = async (ms) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

it("Creates a Date Input for a Variable Input", async () => {
  const frozenNow = new Date("2026-03-30T19:23:57.966Z");
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedDateVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedDateVariable.args_string);

  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            variable_name={varInputArgs.variable_name}
            initial_value={varInputArgs.initial_value}
            variable_options_source={varInputArgs.variable_options_source}
            onChange={handleChange}
          />
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { dashboards: [dashboard] } },
    }),
  );

  expect(await screen.findByText("Test Variable")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  expect(input.value).toBe("");

  const calendarButton = screen.getByLabelText("Calendar Icon");
  await userEvent.click(calendarButton);

  const datePicker = await screen.findByRole("dialog");
  expect(datePicker).toBeInTheDocument();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const weekday = tomorrow.toLocaleDateString("en-US", { weekday: "long" });
  const month = tomorrow.toLocaleDateString("en-US", { month: "long" });
  const day = tomorrow.getDate();
  const ordinal = getOrdinal(day);
  const year = tomorrow.getFullYear();

  const formatted = `Choose ${weekday}, ${month} ${day}${ordinal}, ${year}`;
  const tomorrowCalendarItem = screen.getByLabelText(formatted);

  await userEvent.click(tomorrowCalendarItem);
  expect(input.value).toBe(format(tomorrow, "MM/dd/yyyy '12:00 AM'"));
  const expectedDateTime = tomorrow;
  expectedDateTime.setHours(0, 0, 0, 0);
  expect(handleChange).toHaveBeenLastCalledWith(expectedDateTime);

  jest.useFakeTimers();
  try {
    jest.setSystemTime(frozenNow);
    fireEvent.change(input, { target: { value: "now" } });
  } finally {
    jest.useRealTimers();
  }
  expect(handleChange).toHaveBeenLastCalledWith(frozenNow);
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "" }),
  );

  const refreshButton = screen.getByLabelText("Refresh variable input");
  expect(refreshButton).toBeInTheDocument();
  await userEvent.click(refreshButton);

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": frozenNow }),
  );
});

it("Creates a Date Range Input for a Variable Input", async () => {
  const frozenNow = new Date("2026-03-30T19:23:57.966Z");
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedDateRangeVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedDateRangeVariable.args_string);

  const { rerender } = render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            variable_name={varInputArgs.variable_name}
            initial_value={varInputArgs.initial_value}
            variable_options_source={varInputArgs.variable_options_source}
            metadata={varInputArgs["variable_options_source.metadata"]}
            onChange={handleChange}
          />
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { dashboards: [dashboard] } },
    }),
  );

  expect(await screen.findByText("Start Date")).toBeInTheDocument();
  expect(await screen.findByText("End Date")).toBeInTheDocument();

  const inputs = screen.getAllByRole("textbox");
  expect(inputs[0].value).toBe("01/14/2026T00:00");
  expect(inputs[1].value).toBe("01/16/2026T00:00");

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Test Variable": {
        "Start Date": "01/14/2026T00:00",
        "End Date": "01/16/2026T00:00",
      },
      "Start Date": "01/14/2026T00:00",
      "End Date": "01/16/2026T00:00",
    }),
  );

  jest.useFakeTimers();
  jest.setSystemTime(frozenNow);
  fireEvent.change(inputs[0], { target: { value: "now" } });
  const today = new Date();
  jest.useRealTimers();

  const refreshButton = screen.getByLabelText("Refresh variable input");
  expect(refreshButton).toBeInTheDocument();
  await userEvent.click(refreshButton);

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Test Variable": {
        "Start Date": today,
        "End Date": "01/16/2026T00:00",
      },
      "Start Date": today,
      "End Date": "01/16/2026T00:00",
    }),
  );

  varInputArgs["variable_options_source.metadata"] = {
    format: "MM/dd/yyyy'T'HH",
    startDateVariable: "Start Date",
    endDateVariable: "End Date",
  };
  rerender(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            variable_name={varInputArgs.variable_name}
            initial_value={varInputArgs.initial_value}
            variable_options_source={varInputArgs.variable_options_source}
            metadata={varInputArgs["variable_options_source.metadata"]}
            onChange={handleChange}
          />
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { dashboards: [dashboard] } },
    }),
  );

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Test Variable": {
        "Start Date": today,
        "End Date": "01/16/2026T00:00",
      },
      "Start Date": today,
      "End Date": "01/16/2026T00:00",
    }),
  );
});

it("passes a typed 'latest' sentinel through a Date Variable Input", async () => {
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedDateVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedDateVariable.args_string);

  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            variable_name={varInputArgs.variable_name}
            initial_value={varInputArgs.initial_value}
            variable_options_source={varInputArgs.variable_options_source}
            onChange={handleChange}
          />
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { dashboards: [dashboard] } },
    }),
  );

  expect(await screen.findByText("Test Variable")).toBeInTheDocument();

  // Typing the sentinel into the date field emits the literal string verbatim.
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "latest" } });

  expect(handleChange).toHaveBeenLastCalledWith("latest");

  const refreshButton = screen.getByLabelText("Refresh variable input");
  await userEvent.click(refreshButton);

  // The literal sentinel survives substitution into the shared variable input.
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "latest" }),
  );
});

it("Creates a Custom Dropdown Input for a Variable Input", async () => {
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedCustomDropdownVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedCustomDropdownVariable.args_string);

  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            variable_name={varInputArgs.variable_name}
            initial_value={varInputArgs.initial_value}
            variable_options_source={varInputArgs.variable_options_source}
            onChange={handleChange}
            metadata={varInputArgs["variable_options_source.metadata"]}
          />
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { dashboards: [dashboard] } },
    }),
  );

  expect(await screen.findByText("Test Variable")).toBeInTheDocument();

  const variableInput = await screen.findByRole("combobox");
  expect(variableInput).toBeInTheDocument();
  await select(variableInput, "Option 1");

  expect(screen.getByText("Option 1")).toBeInTheDocument();
  expect(handleChange).toHaveBeenCalledWith("option_1");

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "option_1" }),
  );
});

it("Creates a Custom Dropdown Input for a Variable Input, no choices", async () => {
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedCustomDropdownVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedCustomDropdownVariable.args_string);
  varInputArgs["variable_options_source.metadata"] = {};

  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            variable_name={varInputArgs.variable_name}
            initial_value={varInputArgs.initial_value}
            variable_options_source={varInputArgs.variable_options_source}
            onChange={handleChange}
            metadata={varInputArgs["variable_options_source.metadata"]}
          />
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { dashboards: [dashboard] } },
    }),
  );

  expect(await screen.findByText("Test Variable")).toBeInTheDocument();

  const variableInput = await screen.findByRole("combobox");
  expect(variableInput).toBeInTheDocument();

  await userEvent.click(variableInput);
  expect(await screen.findByText("No options")).toBeInTheDocument();
});

it("Creates a Custom Dropdown Input for a Variable Input, no label", async () => {
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedCustomDropdownVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedCustomDropdownVariable.args_string);

  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            variable_name={varInputArgs.variable_name}
            initial_value={varInputArgs.initial_value}
            variable_options_source={varInputArgs.variable_options_source}
            onChange={handleChange}
            metadata={varInputArgs["variable_options_source.metadata"]}
            show_label={false}
          />
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { dashboards: [dashboard] } },
    }),
  );

  expect(screen.queryByText("Test Variable")).not.toBeInTheDocument();

  const variableInput = await screen.findByRole("combobox");
  expect(variableInput).toBeInTheDocument();
  await select(variableInput, "Option 1");

  expect(screen.getByText("Option 1")).toBeInTheDocument();
  expect(handleChange).toHaveBeenCalledWith("option_1");

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "option_1" }),
  );
});

it("Creates a Text Input for a Variable Input", async () => {
  const user = userEvent.setup();
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedTextVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedTextVariable.args_string);

  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            variable_name={varInputArgs.variable_name}
            initial_value={varInputArgs.initial_value}
            variable_options_source={varInputArgs.variable_options_source}
            onChange={handleChange}
          />
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { dashboards: [dashboard] } },
    }),
  );

  expect(await screen.findByText("Test Variable")).toBeInTheDocument();

  const variableInput = await screen.findByRole("textbox");
  expect(variableInput).toBeInTheDocument();
  await user.type(variableInput, "Hello World");

  expect(variableInput).toHaveValue("Hello World");
  expect(handleChange).toHaveBeenCalledWith("Hello World");

  // Only update the Text Input after clicking the input refresh button
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "" }),
  );

  const refreshButton = screen.getByRole("button");
  expect(refreshButton).toBeInTheDocument();
  await user.click(refreshButton);

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "Hello World" }),
  );
});

it("Creates a Slider Input for a Variable Input", async () => {
  jest.useFakeTimers();

  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedSliderVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedSliderVariable.args_string);

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{ gridItemArgsString: varInputArgs.args_string }}
          >
            <VariableInput
              variable_name={varInputArgs.variable_name}
              initial_value={varInputArgs.initial_value}
              variable_options_source={varInputArgs.variable_options_source}
              metadata={varInputArgs["variable_options_source.metadata"]}
              onChange={handleChange}
            />
          </GridItemContext.Provider>
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { dashboards: [dashboard] } },
    }),
  );

  expect(await screen.findByText("Test Variable")).toBeInTheDocument();

  const playBtn = await screen.findByRole("button", { name: /play/i });
  fireEvent.click(playBtn);

  expect(handleChange).toHaveBeenLastCalledWith("50");

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "50" }),
  );

  await advanceTimers(1500);

  await waitFor(() => {
    expect(handleChange).toHaveBeenLastCalledWith("51");
  });

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "51" }),
  );

  jest.useRealTimers();
});

it("Creates a Slider Input for a Variable Input Without Label", async () => {
  jest.useFakeTimers();

  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedSliderVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedSliderVariable.args_string);

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{ gridItemArgsString: varInputArgs.args_string }}
          >
            <VariableInput
              variable_name={varInputArgs.variable_name}
              show_label={false}
              initial_value={varInputArgs.initial_value}
              variable_options_source={varInputArgs.variable_options_source}
              metadata={varInputArgs["variable_options_source.metadata"]}
              onChange={handleChange}
            />
          </GridItemContext.Provider>
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { dashboards: [dashboard] } },
    }),
  );
  const playBtn = await screen.findByRole("button", { name: /play/i });

  expect(screen.queryByText("Test Variable")).not.toBeInTheDocument();

  fireEvent.click(playBtn);

  expect(handleChange).toHaveBeenLastCalledWith("50");

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "50" }),
  );

  await advanceTimers(1500);

  await waitFor(() => {
    expect(handleChange).toHaveBeenLastCalledWith("51");
  });

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "51" }),
  );

  jest.useRealTimers();
});

it("Creates a Slider Input for a Variable Input, missing metadata", async () => {
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedSliderVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedSliderVariable.args_string);

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{ gridItemArgsString: varInputArgs.args_string }}
          >
            <VariableInput
              variable_name={varInputArgs.variable_name}
              initial_value={varInputArgs.initial_value}
              variable_options_source={varInputArgs.variable_options_source}
              onChange={handleChange}
            />
          </GridItemContext.Provider>
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { dashboards: [dashboard] } },
    }),
  );

  expect(await screen.findByTestId("input-variables")).toBeInTheDocument();
  expect(
    await screen.findByTestId("slider-missing-metadata"),
  ).toBeInTheDocument();
});

it("renders slider-missing-metadata when Array mode has no values array", async () => {
  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{ gridItemArgsString: JSON.stringify({}) }}
          >
            <VariableInput
              variable_name="Array Slider"
              variable_options_source="slider"
              metadata={{ dataType: "Array" }}
              onChange={jest.fn()}
            />
          </GridItemContext.Provider>
        </>
      ),
    }),
  );
  expect(
    await screen.findByTestId("slider-missing-metadata"),
  ).toBeInTheDocument();
});

it("renders slider-missing-metadata when Array mode values is not an array", async () => {
  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{ gridItemArgsString: JSON.stringify({}) }}
          >
            <VariableInput
              variable_name="Array Slider"
              variable_options_source="slider"
              metadata={{ dataType: "Array", values: "not-an-array" }}
              onChange={jest.fn()}
            />
          </GridItemContext.Provider>
        </>
      ),
    }),
  );
  expect(
    await screen.findByTestId("slider-missing-metadata"),
  ).toBeInTheDocument();
});

it("renders Array mode slider when metadata has valid values array", async () => {
  const handleChange = jest.fn();
  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{ gridItemArgsString: JSON.stringify({}) }}
          >
            <VariableInput
              variable_name="Array Slider"
              variable_options_source="slider"
              metadata={{
                dataType: "Array",
                values: ["url1", "url2", "url3"],
                labels: ["Frame 1", "Frame 2", "Frame 3"],
                speedOptions: [500, 250],
              }}
              onChange={handleChange}
            />
          </GridItemContext.Provider>
        </>
      ),
    }),
  );

  // Should render a working slider, not the missing-metadata div
  expect(
    screen.queryByTestId("slider-missing-metadata"),
  ).not.toBeInTheDocument();
  // Slider should be present with min/max labels from the labels array
  expect(await screen.findByLabelText("Min Value")).toHaveTextContent(
    "Frame 1",
  );
  expect(screen.getByLabelText("Max Value")).toHaveTextContent("Frame 3");
});

it("renders slider-missing-metadata when no initial value or range", async () => {
  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{ gridItemArgsString: JSON.stringify({}) }}
          >
            <VariableInput
              variable_name="Test Slider"
              variable_options_source="slider"
              metadata={{}}
              onChange={jest.fn()}
            />
          </GridItemContext.Provider>
        </>
      ),
    }),
  );
  expect(
    await screen.findByTestId("slider-missing-metadata"),
  ).toBeInTheDocument();
});

it("Creates a Slider Input for a Variable Input, missing metadata key", async () => {
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedSliderVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedSliderVariable.args_string);
  delete varInputArgs["variable_options_source.metadata"].step;

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{ gridItemArgsString: varInputArgs.args_string }}
          >
            <VariableInput
              variable_name={varInputArgs.variable_name}
              initial_value={varInputArgs.initial_value}
              variable_options_source={varInputArgs.variable_options_source}
              metadata={varInputArgs["variable_options_source.metadata"]}
              onChange={handleChange}
            />
          </GridItemContext.Provider>
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { dashboards: [dashboard] } },
    }),
  );

  expect(await screen.findByTestId("input-variables")).toBeInTheDocument();
  expect(
    await screen.findByTestId("slider-missing-metadata"),
  ).toBeInTheDocument();
});

it("Create a Slider Input with speedOptions", async () => {
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedSliderVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedSliderVariable.args_string);
  varInputArgs["variable_options_source.metadata"].speedOptions = [
    5000, 2000, 1000, 500, 250, 100,
  ];

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{ gridItemArgsString: varInputArgs.args_string }}
          >
            <VariableInput
              variable_name={varInputArgs.variable_name}
              initial_value={varInputArgs.initial_value}
              variable_options_source={varInputArgs.variable_options_source}
              metadata={varInputArgs["variable_options_source.metadata"]}
              onChange={handleChange}
            />
          </GridItemContext.Provider>
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { dashboards: [dashboard] } },
    }),
  );

  expect(await screen.findByTestId("input-variables")).toBeInTheDocument();
  expect(await screen.findByText("Test Variable")).toBeInTheDocument();
  const playBtn = await screen.findByRole("button", { name: /play/i });
  expect(playBtn).toBeInTheDocument();

  let select = screen.getByLabelText(/speed select/i);
  expect(select).toBeInTheDocument();
  // eslint-disable-next-line testing-library/no-node-access
  expect(select.children.length).toBe(6);
  // eslint-disable-next-line testing-library/no-node-access
  expect(select.children[0].textContent).toBe("5000ms");
  // eslint-disable-next-line testing-library/no-node-access
  expect(select.children[1].textContent).toBe("Extra Slow");
  // eslint-disable-next-line testing-library/no-node-access
  expect(select.children[2].textContent).toBe("Slow");
  // eslint-disable-next-line testing-library/no-node-access
  expect(select.children[3].textContent).toBe("Medium");
  // eslint-disable-next-line testing-library/no-node-access
  expect(select.children[4].textContent).toBe("Fast");
  // eslint-disable-next-line testing-library/no-node-access
  expect(select.children[5].textContent).toBe("Extra Fast");
  expect(screen.getByText("5000ms").selected).toBe(true);
});

it("Creates a CSV Uploader for a Variable Input", async () => {
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedCSVUploaderVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedCSVUploaderVariable.args_string);

  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            variable_name={varInputArgs.variable_name}
            initial_value={varInputArgs.initial_value}
            variable_options_source={varInputArgs.variable_options_source}
            metadata={varInputArgs["variable_options_source.metadata"]}
            onChange={handleChange}
          />
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { dashboards: [dashboard] } },
    }),
  );

  expect(await screen.findByText("Test Variable")).toBeInTheDocument();
  const toggleButton = screen.getByRole("button");
  expect(toggleButton).toHaveClass("btn-primary");
  expect(screen.getByText(/Toggle Table/i)).toBeInTheDocument();
  expect(screen.getByTestId("file-input")).toBeInTheDocument();
  expect(screen.getByRole("table")).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "A" })).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "B" })).toBeInTheDocument();
});

it("Creates a CSV Uploader for a Variable Input, missing metadata key", async () => {
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedCSVUploaderVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedCSVUploaderVariable.args_string);

  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            variable_name={varInputArgs.variable_name}
            initial_value={varInputArgs.initial_value}
            variable_options_source={varInputArgs.variable_options_source}
            metadata={{}}
            onChange={handleChange}
          />
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { dashboards: [dashboard] } },
    }),
  );

  expect(await screen.findByTestId("input-variables")).toBeInTheDocument();
  expect(
    await screen.findByTestId("csvuploader-missing-metadata"),
  ).toBeInTheDocument();
});

it("Creates a Number Input for a Variable Input", async () => {
  const user = userEvent.setup();
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedNumberVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedNumberVariable.args_string);

  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            variable_name={varInputArgs.variable_name}
            initial_value={varInputArgs.initial_value}
            variable_options_source={varInputArgs.variable_options_source}
            onChange={handleChange}
          />
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { dashboards: [dashboard] } },
    }),
  );

  expect(await screen.findByText("Test Variable")).toBeInTheDocument();

  const variableInput = await screen.findByRole("textbox");
  expect(variableInput).toBeInTheDocument();
  await user.clear(variableInput);
  await user.type(variableInput, "9");

  expect(variableInput).toHaveValue("9");
  expect(handleChange).toHaveBeenCalledWith(9);

  // Only update the Text Input after clicking the input refresh button
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": 0 }),
  );

  const refreshButton = screen.getByRole("button");
  expect(refreshButton).toBeInTheDocument();
  await user.click(refreshButton);

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": 9 }),
  );
});

it("Creates a Checkbox Input for a Variable Input", async () => {
  const user = userEvent.setup();
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedCheckboxVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedCheckboxVariable.args_string);

  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            variable_name={varInputArgs.variable_name}
            initial_value={varInputArgs.initial_value}
            variable_options_source={varInputArgs.variable_options_source}
            onChange={handleChange}
          />
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { dashboards: [dashboard] } },
    }),
  );

  const variableInput = await screen.findByLabelText("Test Variable Input");
  expect(variableInput).toBeInTheDocument();
  expect(variableInput).toBeChecked();
  await user.click(variableInput);

  expect(variableInput).not.toBeChecked();
  expect(handleChange).toHaveBeenCalledWith(false);

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": false }),
  );
});

it("Creates a Checkbox Input for a Variable Input with a null value", async () => {
  const user = userEvent.setup();
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedNullCheckboxVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedNullCheckboxVariable.args_string);

  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            variable_name={varInputArgs.variable_name}
            initial_value={varInputArgs.initial_value}
            variable_options_source={varInputArgs.variable_options_source}
            onChange={handleChange}
          />
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { dashboards: [dashboard] } },
    }),
  );

  const variableInput = await screen.findByLabelText("Test Variable Input");
  expect(variableInput).toBeInTheDocument();
  expect(variableInput).not.toBeChecked();

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": false }),
  );
  await user.click(variableInput);

  expect(variableInput).toBeChecked();
  expect(handleChange).toHaveBeenCalledWith(true);

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": true }),
  );
});

it("Creates a Dropdown Input for a Variable Input", async () => {
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedDropdownVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedDropdownVariable.args_string);

  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            variable_name={varInputArgs.variable_name}
            initial_value={varInputArgs.initial_value}
            variable_options_source={varInputArgs.variable_options_source}
            onChange={handleChange}
          />
          <InputVariablePComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [dashboard] },
        visualizations: mockedDropdownVisualization,
      },
    }),
  );

  const variableInput = await screen.findByLabelText("Test Variable Input");
  expect(variableInput).toBeInTheDocument();
  await select(
    variableInput,
    "CREC1 - SMITH RIVER - JEDEDIAH SMITH SP NEAR CRESCENT CITY",
  );

  expect(
    screen.getByText(
      "CREC1 - SMITH RIVER - JEDEDIAH SMITH SP NEAR CRESCENT CITY",
    ),
  ).toBeInTheDocument();
  expect(handleChange).toHaveBeenCalledWith({
    label: "CREC1 - SMITH RIVER - JEDEDIAH SMITH SP NEAR CRESCENT CITY",
    value: "CREC1",
  });

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "CREC1" }),
  );
});

it("Creates a Dropdown Input for a Variable Input Without Label", async () => {
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedDropdownVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedDropdownVariable.args_string);

  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            variable_name={varInputArgs.variable_name}
            show_label={false}
            initial_value={varInputArgs.initial_value}
            variable_options_source={varInputArgs.variable_options_source}
            onChange={handleChange}
          />
          <InputVariablePComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [dashboard] },
        visualizations: mockedDropdownVisualization,
      },
    }),
  );

  const variableInput = await screen.findByRole("combobox");
  expect(variableInput).toBeInTheDocument();
  await select(
    variableInput,
    "CREC1 - SMITH RIVER - JEDEDIAH SMITH SP NEAR CRESCENT CITY",
  );

  expect(
    screen.getByText(
      "CREC1 - SMITH RIVER - JEDEDIAH SMITH SP NEAR CRESCENT CITY",
    ),
  ).toBeInTheDocument();
  expect(handleChange).toHaveBeenCalledWith({
    label: "CREC1 - SMITH RIVER - JEDEDIAH SMITH SP NEAR CRESCENT CITY",
    value: "CREC1",
  });

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "CREC1" }),
  );
});

it("Creates a Dropdown Input for a Variable Input from invalid source", async () => {
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedDropdownVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedDropdownVariable.args_string);

  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            variable_name={varInputArgs.variable_name}
            initial_value={varInputArgs.initial_value}
            variable_options_source={varInputArgs.variable_options_source}
            onChange={handleChange}
          />
          <InputVariablePComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [dashboard] },
      },
    }),
  );

  const variableInput = await screen.findByLabelText("Test Variable Input");
  expect(variableInput).toBeInTheDocument();

  expect(screen.getByText("CREC1")).toBeInTheDocument();

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "CREC1" }),
  );
});

it("Creates a Dropdown Input for a Variable Input from array", async () => {
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "Variable Input",
    args_string: JSON.stringify({
      initial_value: "value 1",
      variable_name: "Test Variable",
      variable_options_source: [
        { label: "label 1", value: "value 1" },
        { label: "label 2", value: "value 2" },
      ],
    }),
    metadata_string: JSON.stringify({
      refreshRate: 0,
    }),
  };
  dashboard.tabs[0].gridItems = [gridItem];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(gridItem.args_string);

  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            variable_name={varInputArgs.variable_name}
            initial_value={varInputArgs.initial_value}
            variable_options_source={varInputArgs.variable_options_source}
            onChange={handleChange}
          />
          <InputVariablePComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [dashboard] },
      },
    }),
  );

  const variableInput = await screen.findByLabelText("Test Variable Input");
  expect(variableInput).toBeInTheDocument();
  await select(variableInput, "label 1");

  expect(screen.getByText("label 1")).toBeInTheDocument();
  expect(handleChange).toHaveBeenCalledWith({
    label: "label 1",
    value: "value 1",
  });

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "value 1" }),
  );
});

it("Creates a Dropdown Input for a Variable Input, not signed in", async () => {
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedDropdownVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedDropdownVariable.args_string);

  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            variable_name={varInputArgs.variable_name}
            initial_value={varInputArgs.initial_value}
            variable_options_source={varInputArgs.variable_options_source}
            onChange={handleChange}
          />
          <InputVariablePComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [dashboard] },
        visualizations: mockedDropdownVisualization,
        user: { username: null, isAuthenticated: true, isStaff: false },
      },
    }),
  );

  const proceedWithoutSigningInButton = await screen.findByText(
    "Proceed Without Signing in",
  );
  await userEvent.click(proceedWithoutSigningInButton);

  const variableInput = await screen.findByLabelText("Test Variable Input");
  await select(
    variableInput,
    "CREC1 - SMITH RIVER - JEDEDIAH SMITH SP NEAR CRESCENT CITY",
  );

  expect(
    screen.getByText(
      "CREC1 - SMITH RIVER - JEDEDIAH SMITH SP NEAR CRESCENT CITY",
    ),
  ).toBeInTheDocument();
  expect(handleChange).toHaveBeenCalledWith({
    label: "CREC1 - SMITH RIVER - JEDEDIAH SMITH SP NEAR CRESCENT CITY",
    value: "CREC1",
  });

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "CREC1" }),
  );
});

describe("Date format self-registration", () => {
  // Regression: popup-internal Variable Inputs are never seen by
  // DashboardLoader's boot-time scan (which only walks tab.gridItems),
  // so they have to self-register their date format under
  // variableInputDateFormats[variable_name] on mount. Without that
  // registration, the date-resolution pass in updateObjectWithVariableInputs
  // can't parse a slider's outputFormat value and the resulting arg
  // arrives at the backend as null.

  it("registers a date-type Variable Input's metadata.format on mount", async () => {
    const dashboard = JSON.parse(JSON.stringify(userDashboard));
    dashboard.tabs[0].gridItems = [];

    render(
      createLoadedComponent({
        children: (
          <>
            <VariableInput
              variable_name="My Date"
              initial_value=""
              variable_options_source="date"
              metadata={{ format: "MM/dd/yyyy'T'HH:mm" }}
              onChange={() => {}}
            />
            <VariableInputDateFormatsPComponent />
          </>
        ),
        options: { dashboards: { dashboards: [dashboard] } },
      }),
    );

    await waitFor(() => {
      const formats = JSON.parse(
        screen.getByTestId("variable-input-date-formats").textContent,
      );
      expect(formats["My Date"]).toBe("MM/dd/yyyy'T'HH:mm");
    });
  });

  it("registers a Date-typed slider's metadata.outputFormat on mount", async () => {
    const dashboard = JSON.parse(JSON.stringify(userDashboard));
    dashboard.tabs[0].gridItems = [];

    render(
      createLoadedComponent({
        children: (
          <>
            <GridItemContext.Provider value={{ gridItemArgsString: "{}" }}>
              <VariableInput
                variable_name="Date"
                initial_value="12/08/2025T00:29"
                variable_options_source="slider"
                metadata={{
                  dataType: "Date",
                  rangeMode: false,
                  min: "now-6M",
                  max: "now",
                  initialValue: "12/08/2025T00:29",
                  step: 1,
                  outputFormat: "MM/dd/yyyy'T'HH:mm",
                  dateTimeDelta: "Hours",
                }}
                onChange={() => {}}
              />
            </GridItemContext.Provider>
            <VariableInputDateFormatsPComponent />
          </>
        ),
        options: { dashboards: { dashboards: [dashboard] } },
      }),
    );

    await waitFor(() => {
      const formats = JSON.parse(
        screen.getByTestId("variable-input-date-formats").textContent,
      );
      expect(formats["Date"]).toBe("MM/dd/yyyy'T'HH:mm");
    });
  });

  it("no-ops when the context does not expose setVariableInputDateFormats", async () => {
    // Covers the `!setVariableInputDateFormats` branch of the early-return
    // guard. Render directly under a bare VariableInputsContext.Provider
    // that omits the setter (e.g., a legacy callsite or test harness).
    // The Variable Input must mount without crashing — the effect simply
    // returns without trying to register.
    const probe = jest.fn();
    expect(() =>
      render(
        <AppContext.Provider value={{ visualizationArgs: [] }}>
          <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
            <VariableInputsContext.Provider
              value={{
                variableInputValues: {},
                setVariableInputValues: probe,
                // setVariableInputDateFormats deliberately omitted.
                variableInputDateFormats: {},
                variableInputSliderMeta: {},
                setVariableInputSliderMeta: () => {},
              }}
            >
              <VariableInput
                variable_name="Maybe Date"
                initial_value=""
                variable_options_source="date"
                metadata={{ format: "MM/dd/yyyy" }}
                onChange={() => {}}
              />
            </VariableInputsContext.Provider>
          </DataViewerModeContext.Provider>
        </AppContext.Provider>,
      ),
    ).not.toThrow();
  });

  it("no-ops when variable_name is empty", async () => {
    // Covers the `!variable_name` branch of the early-return guard.
    // Without a name, there's no key to register under, so the effect
    // must short-circuit instead of writing `undefined` into the map.
    const setVariableInputDateFormats = jest.fn();
    render(
      <AppContext.Provider value={{ visualizationArgs: [] }}>
        <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
          <VariableInputsContext.Provider
            value={{
              variableInputValues: {},
              setVariableInputValues: () => {},
              variableInputDateFormats: {},
              setVariableInputDateFormats,
              variableInputSliderMeta: {},
              setVariableInputSliderMeta: () => {},
            }}
          >
            <VariableInput
              variable_name=""
              initial_value=""
              variable_options_source="date"
              metadata={{ format: "MM/dd/yyyy" }}
              onChange={() => {}}
            />
          </VariableInputsContext.Provider>
        </DataViewerModeContext.Provider>
      </AppContext.Provider>,
    );

    await waitFor(() => {
      // No registration occurred.
      expect(setVariableInputDateFormats).not.toHaveBeenCalled();
    });
  });

  it("no-ops when a Date-typed slider is missing outputFormat", async () => {
    // Covers the `metadata?.outputFormat || null` fallback at the slider
    // branch of the format-resolution block — when a slider with
    // dataType "Date" lacks an outputFormat, the resolved format is null
    // and no entry is registered (the subsequent `if (!dateFormat)` bail
    // fires).
    const setVariableInputDateFormats = jest.fn();
    render(
      <AppContext.Provider value={{ visualizationArgs: [] }}>
        <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
          <VariableInputsContext.Provider
            value={{
              variableInputValues: {},
              setVariableInputValues: () => {},
              variableInputDateFormats: {},
              setVariableInputDateFormats,
              variableInputSliderMeta: {},
              setVariableInputSliderMeta: () => {},
            }}
          >
            <GridItemContext.Provider value={{ gridItemArgsString: "{}" }}>
              <VariableInput
                variable_name="No Format Date"
                initial_value=""
                variable_options_source="slider"
                metadata={{
                  dataType: "Date",
                  min: "2026-01-01T00:00:00",
                  max: "2026-01-05T00:00:00",
                  step: 1,
                  initialValue: "2026-01-01T00:00:00",
                  dateTimeDelta: "Days",
                  // outputFormat deliberately omitted.
                }}
                onChange={() => {}}
              />
            </GridItemContext.Provider>
          </VariableInputsContext.Provider>
        </DataViewerModeContext.Provider>
      </AppContext.Provider>,
    );

    await waitFor(() => {
      // No registration occurred — dateFormat resolved to null.
      expect(setVariableInputDateFormats).not.toHaveBeenCalled();
    });
  });

  it("does NOT register a format for a non-date Variable Input", async () => {
    const dashboard = JSON.parse(JSON.stringify(userDashboard));
    dashboard.tabs[0].gridItems = [];

    render(
      createLoadedComponent({
        children: (
          <>
            <VariableInput
              variable_name="Plain Text"
              initial_value=""
              variable_options_source="text"
              onChange={() => {}}
            />
            <VariableInputDateFormatsPComponent />
          </>
        ),
        options: { dashboards: { dashboards: [dashboard] } },
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("variable-input-date-formats"),
      ).toBeInTheDocument();
    });
    const formats = JSON.parse(
      screen.getByTestId("variable-input-date-formats").textContent,
    );
    expect(formats["Plain Text"]).toBeUndefined();
  });
});

describe("When inDataViewerMode", () => {
  // The contextualized value won't be updated so the modal and the dashboard states can be kept separate.
  it("Creates a Text Input for a Variable Input", async () => {
    const user = userEvent.setup();
    const dashboard = JSON.parse(JSON.stringify(userDashboard));
    dashboard.tabs[0].gridItems = [mockedTextVariable];
    const handleChange = jest.fn();
    const varInputArgs = JSON.parse(mockedTextVariable.args_string);

    render(
      createLoadedComponent({
        children: (
          <>
            <VariableInput
              variable_name={varInputArgs.variable_name}
              initial_value={varInputArgs.initial_value}
              variable_options_source={varInputArgs.variable_options_source}
              onChange={handleChange}
            />
            <InputVariablePComponent />
          </>
        ),
        options: {
          dashboards: { dashboards: [dashboard] },
          inDataViewerMode: true,
        },
      }),
    );

    expect(await screen.findByText("Test Variable")).toBeInTheDocument();

    const variableInput = await screen.findByRole("textbox");
    expect(variableInput).toBeInTheDocument();
    await user.type(variableInput, "Hello World");

    expect(variableInput).toHaveValue("Hello World");
    expect(handleChange).toHaveBeenCalledWith("Hello World");

    // Only update the Text Input after clicking the input refresh button
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Test Variable": "" }),
    );

    const refreshButton = screen.getByRole("button");
    expect(refreshButton).toBeInTheDocument();
    await user.click(refreshButton);

    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Test Variable": "" }),
    );
  });

  it("shows the Latest preset label in the date Example Output", async () => {
    const dashboard = JSON.parse(JSON.stringify(userDashboard));
    dashboard.tabs[0].gridItems = [mockedDateVariable];
    const handleChange = jest.fn();
    const varInputArgs = JSON.parse(mockedDateVariable.args_string);

    render(
      createLoadedComponent({
        children: (
          <VariableInput
            variable_name={varInputArgs.variable_name}
            initial_value="latest"
            variable_options_source={varInputArgs.variable_options_source}
            onChange={handleChange}
          />
        ),
        options: {
          dashboards: { dashboards: [dashboard] },
          inDataViewerMode: true,
        },
      }),
    );

    // The preset sentinel renders as its human label, not "Invalid date format".
    const preview = await screen.findByLabelText("Example Date Output Span");
    expect(preview).toHaveTextContent("Latest");
  });

  it("Creates a Number Input for a Variable Input", async () => {
    const user = userEvent.setup();
    const dashboard = JSON.parse(JSON.stringify(userDashboard));
    dashboard.tabs[0].gridItems = [mockedNumberVariable];
    const handleChange = jest.fn();
    const varInputArgs = JSON.parse(mockedNumberVariable.args_string);

    render(
      createLoadedComponent({
        children: (
          <>
            <VariableInput
              variable_name={varInputArgs.variable_name}
              initial_value={varInputArgs.initial_value}
              variable_options_source={varInputArgs.variable_options_source}
              onChange={handleChange}
            />
            <InputVariablePComponent />
          </>
        ),
        options: {
          dashboards: { dashboards: [dashboard] },
          inDataViewerMode: true,
        },
      }),
    );

    expect(await screen.findByText("Test Variable")).toBeInTheDocument();

    const variableInput = await screen.findByRole("textbox");
    expect(variableInput).toBeInTheDocument();
    await user.clear(variableInput);
    await user.type(variableInput, "9");

    expect(variableInput).toHaveValue("9");
    expect(handleChange).toHaveBeenCalledWith(9);

    // Only update the Text Input after clicking the input refresh button

    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Test Variable": 0 }),
    );

    const refreshButton = screen.getByRole("button");
    expect(refreshButton).toBeInTheDocument();
    await user.click(refreshButton);

    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Test Variable": 0 }),
    );
  });

  it("Creates a Checkbox Input for a Variable Input", async () => {
    const user = userEvent.setup();
    const dashboard = JSON.parse(JSON.stringify(userDashboard));
    dashboard.tabs[0].gridItems = [mockedCheckboxVariable];
    const handleChange = jest.fn();
    const varInputArgs = JSON.parse(mockedCheckboxVariable.args_string);

    render(
      createLoadedComponent({
        children: (
          <>
            <VariableInput
              variable_name={varInputArgs.variable_name}
              initial_value={varInputArgs.initial_value}
              variable_options_source={varInputArgs.variable_options_source}
              onChange={handleChange}
            />
            <InputVariablePComponent />
          </>
        ),
        options: {
          dashboards: { dashboards: [dashboard] },
          inDataViewerMode: true,
        },
      }),
    );

    const variableInput = await screen.findByLabelText("Test Variable Input");
    expect(variableInput).toBeInTheDocument();
    expect(variableInput).toBeChecked();

    await waitFor(async () => {
      expect(await screen.findByTestId("input-variables")).toHaveTextContent(
        JSON.stringify({ "Test Variable": true }),
      );
    });
    await user.click(variableInput);

    expect(variableInput).not.toBeChecked();
    expect(handleChange).toHaveBeenCalledWith(false);

    await waitFor(async () => {
      expect(await screen.findByTestId("input-variables")).toHaveTextContent(
        JSON.stringify({ "Test Variable": true }),
      );
    });
  });

  it("Creates a Checkbox Input for a Variable Input with a null value", async () => {
    const user = userEvent.setup();
    const dashboard = JSON.parse(JSON.stringify(userDashboard));
    dashboard.tabs[0].gridItems = [mockedNullCheckboxVariable];
    const handleChange = jest.fn();
    const varInputArgs = JSON.parse(mockedNullCheckboxVariable.args_string);

    render(
      createLoadedComponent({
        children: (
          <>
            <VariableInput
              variable_name={varInputArgs.variable_name}
              initial_value={varInputArgs.initial_value}
              variable_options_source={varInputArgs.variable_options_source}
              onChange={handleChange}
            />
            <InputVariablePComponent />
          </>
        ),
        options: {
          dashboards: { dashboards: [dashboard] },
          inDataViewerMode: true,
        },
      }),
    );

    const variableInput = await screen.findByLabelText("Test Variable Input");
    expect(variableInput).toBeInTheDocument();
    expect(variableInput).not.toBeChecked();

    const inputVariables = await screen.findByTestId("input-variables");
    expect(inputVariables).toHaveTextContent(
      JSON.stringify({ "Test Variable": false }),
    );
    await user.click(variableInput);

    expect(variableInput).toBeChecked();
    expect(handleChange).toHaveBeenCalledWith(true);

    await waitFor(async () => {
      expect(inputVariables).toHaveTextContent(
        JSON.stringify({ "Test Variable": false }),
      );
    });
  });

  it("Creates a Dropdown Input for a Variable Input", async () => {
    const dashboard = JSON.parse(JSON.stringify(userDashboard));
    dashboard.tabs[0].gridItems = [mockedDropdownVariable];
    const handleChange = jest.fn();
    const varInputArgs = JSON.parse(mockedDropdownVariable.args_string);

    render(
      createLoadedComponent({
        children: (
          <>
            <VariableInput
              variable_name={varInputArgs.variable_name}
              initial_value={varInputArgs.initial_value}
              variable_options_source={varInputArgs.variable_options_source}
              onChange={handleChange}
            />
            <InputVariablePComponent />
          </>
        ),
        options: {
          dashboards: { dashboards: [dashboard] },
          inDataViewerMode: true,
          visualizations: mockedDropdownVisualization,
        },
      }),
    );

    const variableInput = await screen.findByLabelText("Test Variable Input");
    expect(variableInput).toBeInTheDocument();

    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Test Variable": "CREC1" }),
    );

    await select(variableInput, "FTDC1 - SMITH RIVER - DOCTOR FINE BRIDGE");

    expect(
      screen.getByText("FTDC1 - SMITH RIVER - DOCTOR FINE BRIDGE"),
    ).toBeInTheDocument();
    expect(handleChange).toHaveBeenCalledWith({
      label: "FTDC1 - SMITH RIVER - DOCTOR FINE BRIDGE",
      value: "FTDC1",
    });
  });

  it("Create a date picker input for a Variable Input", async () => {
    const frozenNow = new Date("2026-03-30T19:23:57.966Z");
    const dashboard = JSON.parse(JSON.stringify(userDashboard));
    dashboard.tabs[0].gridItems = [mockedDateVariable];
    const handleChange = jest.fn();
    const varInputArgs = JSON.parse(mockedDateVariable.args_string);

    render(
      createLoadedComponent({
        children: (
          <>
            <VariableInput
              variable_name={varInputArgs.variable_name}
              initial_value={varInputArgs.initial_value}
              variable_options_source={varInputArgs.variable_options_source}
              onChange={handleChange}
            />
            <InputVariablePComponent />
          </>
        ),
        options: {
          dashboards: { dashboards: [dashboard] },
          inDataViewerMode: true,
        },
      }),
    );

    expect(await screen.findByText("Test Variable")).toBeInTheDocument();

    const input = screen.getByRole("textbox");
    expect(input.value).toBe("");

    const calendarButton = screen.getByLabelText("Calendar Icon");
    await userEvent.click(calendarButton);

    const datePicker = await screen.findByRole("dialog");
    expect(datePicker).toBeInTheDocument();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const weekday = tomorrow.toLocaleDateString("en-US", { weekday: "long" });
    const month = tomorrow.toLocaleDateString("en-US", { month: "long" });
    const day = tomorrow.getDate();
    const ordinal = getOrdinal(day);
    const year = tomorrow.getFullYear();

    const formatted = `Choose ${weekday}, ${month} ${day}${ordinal}, ${year}`;
    const tomorrowCalendarItem = screen.getByLabelText(formatted);

    await userEvent.click(tomorrowCalendarItem);
    expect(input.value).toBe(format(tomorrow, "MM/dd/yyyy '12:00 AM'"));
    tomorrow.setHours(0, 0, 0, 0);
    expect(handleChange).toHaveBeenLastCalledWith(tomorrow);

    expect(screen.getByText("Example Date Output")).toBeInTheDocument();
    const dateOutput = screen.getByLabelText("Example Date Output Span");
    expect(dateOutput).toHaveTextContent(
      format(tomorrow, "MM/dd/yyyy '12:00 AM'"),
    );

    jest.useFakeTimers();
    try {
      jest.setSystemTime(frozenNow);
      fireEvent.change(input, { target: { value: "now" } });
    } finally {
      jest.useRealTimers();
    }
    expect(handleChange).toHaveBeenLastCalledWith("now");

    expect(screen.getByText("Example Date Output")).toBeInTheDocument();
    expect(dateOutput).toHaveTextContent(format(frozenNow, dateHourFormat));

    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Test Variable": "" }),
    );

    const refreshButton = screen.getByLabelText("Refresh variable input");
    expect(refreshButton).toBeInTheDocument();
    await userEvent.click(refreshButton);

    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Test Variable": "" }),
    );
  });

  it("Create a date picker input; bad format", async () => {
    const dashboard = JSON.parse(JSON.stringify(userDashboard));
    dashboard.tabs[0].gridItems = [mockedDateVariable];
    const handleChange = jest.fn();
    const varInputArgs = JSON.parse(mockedDateVariable.args_string);

    render(
      createLoadedComponent({
        children: (
          <>
            <VariableInput
              variable_name={varInputArgs.variable_name}
              initial_value={varInputArgs.initial_value}
              variable_options_source={varInputArgs.variable_options_source}
              onChange={handleChange}
              metadata={{ format: "bad format" }}
            />
            <InputVariablePComponent />
          </>
        ),
        options: {
          dashboards: { dashboards: [dashboard] },
          inDataViewerMode: true,
        },
      }),
    );

    expect(await screen.findByText("Test Variable")).toBeInTheDocument();
    const dateOutput = screen.getByLabelText("Example Date Output Span");
    expect(dateOutput).toHaveTextContent("Invalid date format");
    expect(screen.getByText("Example Date Output")).toBeInTheDocument();
  });
});

it("Handles null variable_options_source gracefully", async () => {
  const handleChange = jest.fn();
  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            variable_name="Null Source Variable"
            initial_value={null}
            variable_options_source={null}
            onChange={handleChange}
          />
          <InputVariablePComponent />
        </>
      ),
    }),
  );
  // Should render a text input with label
  expect(await screen.findByText("Null Source Variable")).toBeInTheDocument();

  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Refresh variable input")).toBeInTheDocument();
});
