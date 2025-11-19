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
  mockedDateHourVariable,
  mockedDateVariable,
} from "__tests__/utilities/constants";
import { select } from "react-select-event";
import createLoadedComponent, {
  InputVariablePComponent,
} from "__tests__/utilities/customRender";
import { getOrdinal } from "__tests__/utilities/constants";
import { format } from "date-fns";

const advanceTimers = async (ms) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

it("Creates a Date Hour Input for a Variable Input", async () => {
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedDateHourVariable];
  const handleChange = jest.fn();
  const varInputArgs = JSON.parse(mockedDateHourVariable.args_string);

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
    })
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
  expect(input.value).toBe(`${format(tomorrow, "MM/dd/yyyy")} 12:00 AM`);
  expect(handleChange).toHaveBeenLastCalledWith(
    `${format(tomorrow, "MM/dd/yyyy")} 12:00 AM`
  );

  fireEvent.change(input, { target: { value: "now" } });
  const expectedDatetimeString = format(today, "MM/dd/yyyy h:mm aa");
  // there is a race condition where this could fail because the minute changed between the click and the change
  expect(handleChange).toHaveBeenLastCalledWith(expectedDatetimeString);
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "" })
  );

  const refreshButton = screen.getByLabelText("Refresh variable input");
  expect(refreshButton).toBeInTheDocument();
  await userEvent.click(refreshButton);

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": expectedDatetimeString })
  );
});

it("Creates a Date Input for a Variable Input", async () => {
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
    })
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
  expect(input.value).toBe(format(tomorrow, "MM/dd/yyyy"));
  expect(handleChange).toHaveBeenLastCalledWith(format(tomorrow, "MM/dd/yyyy"));

  fireEvent.change(input, { target: { value: "now" } });
  const expectedDatetimeString = format(today, "MM/dd/yyyy");
  // there is a race condition where this could fail because the minute changed between the click and the change
  expect(handleChange).toHaveBeenLastCalledWith(expectedDatetimeString);
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "" })
  );

  const refreshButton = screen.getByLabelText("Refresh variable input");
  expect(refreshButton).toBeInTheDocument();
  await userEvent.click(refreshButton);

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": expectedDatetimeString })
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
    })
  );

  expect(await screen.findByText("Test Variable")).toBeInTheDocument();

  const variableInput = await screen.findByRole("textbox");
  expect(variableInput).toBeInTheDocument();
  await user.type(variableInput, "Hello World");

  expect(variableInput).toHaveValue("Hello World");
  expect(handleChange).toHaveBeenCalledWith("Hello World");

  // Only update the Text Input after clicking the input refresh button
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "" })
  );

  const refreshButton = screen.getByRole("button");
  expect(refreshButton).toBeInTheDocument();
  await user.click(refreshButton);

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "Hello World" })
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
    })
  );

  expect(await screen.findByText("Test Variable")).toBeInTheDocument();

  const playBtn = await screen.findByRole("button", { name: /play/i });
  fireEvent.click(playBtn);

  expect(handleChange).toHaveBeenLastCalledWith("50");

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "50" })
  );

  await advanceTimers(1500);

  await waitFor(() => {
    expect(handleChange).toHaveBeenLastCalledWith("51");
  });

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "51" })
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
    })
  );

  expect(await screen.findByTestId("input-variables")).toBeInTheDocument();
  expect(
    await screen.findByTestId("slider-missing-metadata")
  ).toBeInTheDocument();
});

it("renders slider-missing-metadata when no initial value or range", async () => {
  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            variable_name="Test Slider"
            variable_options_source="slider"
            metadata={{}}
            onChange={jest.fn()}
          />
        </>
      ),
    })
  );
  expect(
    await screen.findByTestId("slider-missing-metadata")
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
    })
  );

  expect(await screen.findByTestId("input-variables")).toBeInTheDocument();
  expect(
    await screen.findByTestId("slider-missing-metadata")
  ).toBeInTheDocument();
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
    })
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
    })
  );

  expect(await screen.findByTestId("input-variables")).toBeInTheDocument();
  expect(
    await screen.findByTestId("csvuploader-missing-metadata")
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
    })
  );

  expect(await screen.findByText("Test Variable")).toBeInTheDocument();

  const variableInput = await screen.findByRole("spinbutton");
  expect(variableInput).toBeInTheDocument();
  await user.type(variableInput, "9");

  expect(variableInput).toHaveValue(9);
  expect(handleChange).toHaveBeenCalledWith(9);

  // Only update the Text Input after clicking the input refresh button
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": 0 })
  );

  const refreshButton = screen.getByRole("button");
  expect(refreshButton).toBeInTheDocument();
  await user.click(refreshButton);

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": 9 })
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
    })
  );

  const variableInput = await screen.findByLabelText("Test Variable Input");
  expect(variableInput).toBeInTheDocument();
  expect(variableInput).toBeChecked();
  await user.click(variableInput);

  expect(variableInput).not.toBeChecked();
  expect(handleChange).toHaveBeenCalledWith(false);

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": false })
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
    })
  );

  const variableInput = await screen.findByLabelText("Test Variable Input");
  expect(variableInput).toBeInTheDocument();
  expect(variableInput).not.toBeChecked();

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": false })
  );
  await user.click(variableInput);

  expect(variableInput).toBeChecked();
  expect(handleChange).toHaveBeenCalledWith(true);

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": true })
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
    })
  );

  const variableInput = await screen.findByLabelText("Test Variable Input");
  expect(variableInput).toBeInTheDocument();
  await select(
    variableInput,
    "CREC1 - SMITH RIVER - JEDEDIAH SMITH SP NEAR CRESCENT CITY"
  );

  expect(
    screen.getByText(
      "CREC1 - SMITH RIVER - JEDEDIAH SMITH SP NEAR CRESCENT CITY"
    )
  ).toBeInTheDocument();
  expect(handleChange).toHaveBeenCalledWith({
    label: "CREC1 - SMITH RIVER - JEDEDIAH SMITH SP NEAR CRESCENT CITY",
    value: "CREC1",
  });

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "CREC1" })
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
    })
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
    JSON.stringify({ "Test Variable": "value 1" })
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
    })
  );

  const proceedWithoutSigningInButton = await screen.findByText(
    "Proceed Without Signing in"
  );
  await userEvent.click(proceedWithoutSigningInButton);

  const variableInput = await screen.findByLabelText("Test Variable Input");
  await select(
    variableInput,
    "CREC1 - SMITH RIVER - JEDEDIAH SMITH SP NEAR CRESCENT CITY"
  );

  expect(
    screen.getByText(
      "CREC1 - SMITH RIVER - JEDEDIAH SMITH SP NEAR CRESCENT CITY"
    )
  ).toBeInTheDocument();
  expect(handleChange).toHaveBeenCalledWith({
    label: "CREC1 - SMITH RIVER - JEDEDIAH SMITH SP NEAR CRESCENT CITY",
    value: "CREC1",
  });

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "CREC1" })
  );
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
      })
    );

    expect(await screen.findByText("Test Variable")).toBeInTheDocument();

    const variableInput = await screen.findByRole("textbox");
    expect(variableInput).toBeInTheDocument();
    await user.type(variableInput, "Hello World");

    expect(variableInput).toHaveValue("Hello World");
    expect(handleChange).toHaveBeenCalledWith("Hello World");

    // Only update the Text Input after clicking the input refresh button
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Test Variable": "" })
    );

    const refreshButton = screen.getByRole("button");
    expect(refreshButton).toBeInTheDocument();
    await user.click(refreshButton);

    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Test Variable": "" })
    );
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
      })
    );

    expect(await screen.findByText("Test Variable")).toBeInTheDocument();

    const variableInput = await screen.findByRole("spinbutton");
    expect(variableInput).toBeInTheDocument();
    await user.type(variableInput, "9");

    expect(variableInput).toHaveValue(9);
    expect(handleChange).toHaveBeenCalledWith(9);

    // Only update the Text Input after clicking the input refresh button

    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Test Variable": 0 })
    );

    const refreshButton = screen.getByRole("button");
    expect(refreshButton).toBeInTheDocument();
    await user.click(refreshButton);

    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Test Variable": 0 })
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
      })
    );

    const variableInput = await screen.findByLabelText("Test Variable Input");
    expect(variableInput).toBeInTheDocument();
    expect(variableInput).toBeChecked();

    await waitFor(async () => {
      expect(await screen.findByTestId("input-variables")).toHaveTextContent(
        JSON.stringify({ "Test Variable": true })
      );
    });
    await user.click(variableInput);

    expect(variableInput).not.toBeChecked();
    expect(handleChange).toHaveBeenCalledWith(false);

    await waitFor(async () => {
      expect(await screen.findByTestId("input-variables")).toHaveTextContent(
        JSON.stringify({ "Test Variable": true })
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
      })
    );

    const variableInput = await screen.findByLabelText("Test Variable Input");
    expect(variableInput).toBeInTheDocument();
    expect(variableInput).not.toBeChecked();

    const inputVariables = await screen.findByTestId("input-variables");
    expect(inputVariables).toHaveTextContent(
      JSON.stringify({ "Test Variable": false })
    );
    await user.click(variableInput);

    expect(variableInput).toBeChecked();
    expect(handleChange).toHaveBeenCalledWith(true);

    await waitFor(async () => {
      expect(inputVariables).toHaveTextContent(
        JSON.stringify({ "Test Variable": false })
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
      })
    );

    const variableInput = await screen.findByLabelText("Test Variable Input");
    expect(variableInput).toBeInTheDocument();

    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Test Variable": "CREC1" })
    );

    await select(variableInput, "FTDC1 - SMITH RIVER - DOCTOR FINE BRIDGE");

    expect(
      screen.getByText("FTDC1 - SMITH RIVER - DOCTOR FINE BRIDGE")
    ).toBeInTheDocument();
    expect(handleChange).toHaveBeenCalledWith({
      label: "FTDC1 - SMITH RIVER - DOCTOR FINE BRIDGE",
      value: "FTDC1",
    });
  });
});
