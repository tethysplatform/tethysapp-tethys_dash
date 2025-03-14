import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import VariableInput from "components/visualizations/VariableInput";
import {
  mockedDropdownVizArgs,
  mockedCheckboxVariable,
  mockedDropdownVariable,
  mockedNullCheckboxVariable,
  mockedNumberVariable,
  mockedTextVariable,
  mockedDropdownVisualization,
  mockedDashboards,
} from "__tests__/utilities/constants";
import { select } from "react-select-event";
import createLoadedComponent, {
  InputVariablePComponent,
} from "__tests__/utilities/customRender";

// check map visualization tests for coverage of use effect dependent on variableInputValues

it("Creates a Text Input for a Variable Input", async () => {
  const user = userEvent.setup();
  const dashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  dashboard.gridItems = [mockedTextVariable];
  const handleChange = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            args={JSON.parse(mockedTextVariable.args_string)}
            onChange={handleChange}
          />
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { user: [dashboard], public: [] } },
    })
  );

  const variableInput = await screen.findByLabelText("Test Variable Input");
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

it("Creates a Number Input for a Variable Input", async () => {
  const user = userEvent.setup();
  const dashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  dashboard.gridItems = [mockedNumberVariable];
  const handleChange = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            args={JSON.parse(mockedNumberVariable.args_string)}
            onChange={handleChange}
          />
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { user: [dashboard], public: [] } },
    })
  );

  const variableInput = await screen.findByLabelText("Test Variable Input");
  expect(variableInput).toBeInTheDocument();
  await user.type(variableInput, "9");

  expect(variableInput).toHaveValue(9);
  expect(handleChange).toHaveBeenCalledWith("9"); // Is this expected to be a string?

  // Only update the Text Input after clicking the input refresh button
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "0" })
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
  const dashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  dashboard.gridItems = [mockedCheckboxVariable];
  const handleChange = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            args={JSON.parse(mockedCheckboxVariable.args_string)}
            onChange={handleChange}
          />
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { user: [dashboard], public: [] } },
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
  const dashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  dashboard.gridItems = [mockedNullCheckboxVariable];
  const handleChange = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            args={JSON.parse(mockedNullCheckboxVariable.args_string)}
            onChange={handleChange}
          />
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { user: [dashboard], public: [] } },
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
  const dashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  dashboard.gridItems = [mockedDropdownVariable];
  const handleChange = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <>
          <VariableInput
            args={JSON.parse(mockedDropdownVariable.args_string)}
            onChange={handleChange}
          />
          <InputVariablePComponent />
        </>
      ),
      options: {
        dashboards: { user: [dashboard], public: [] },
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

describe("When inDataViewerMode", () => {
  // The contextualized value won't be updated so the modal and the dashboard states can be kept separate.
  it("Creates a Text Input for a Variable Input", async () => {
    const user = userEvent.setup();
    const dashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
    dashboard.gridItems = [mockedTextVariable];
    const handleChange = jest.fn();

    render(
      createLoadedComponent({
        children: (
          <>
            <VariableInput
              args={JSON.parse(mockedTextVariable.args_string)}
              onChange={handleChange}
            />
            <InputVariablePComponent />
          </>
        ),
        options: {
          dashboards: { user: [dashboard], public: [] },
          inDataViewerMode: true,
        },
      })
    );

    const variableInput = await screen.findByLabelText("Test Variable Input");
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
    const dashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
    dashboard.gridItems = [mockedNumberVariable];
    const handleChange = jest.fn();

    render(
      createLoadedComponent({
        children: (
          <>
            <VariableInput
              args={JSON.parse(mockedNumberVariable.args_string)}
              onChange={handleChange}
            />
            <InputVariablePComponent />
          </>
        ),
        options: {
          dashboards: { user: [dashboard], public: [] },
          inDataViewerMode: true,
        },
      })
    );

    const variableInput = await screen.findByLabelText("Test Variable Input");
    expect(variableInput).toBeInTheDocument();
    await user.type(variableInput, "9");

    expect(variableInput).toHaveValue(9);
    expect(handleChange).toHaveBeenCalledWith("9"); // Is this expected to be a string?

    // Only update the Text Input after clicking the input refresh button

    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Test Variable": "0" })
    );

    const refreshButton = screen.getByRole("button");
    expect(refreshButton).toBeInTheDocument();
    await user.click(refreshButton);

    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Test Variable": "0" })
    );
  });

  it("Creates a Checkbox Input for a Variable Input", async () => {
    const user = userEvent.setup();
    const dashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
    dashboard.gridItems = [mockedCheckboxVariable];
    const handleChange = jest.fn();

    render(
      createLoadedComponent({
        children: (
          <>
            <VariableInput
              args={JSON.parse(mockedCheckboxVariable.args_string)}
              onChange={handleChange}
            />
            <InputVariablePComponent />
          </>
        ),
        options: {
          dashboards: { user: [dashboard], public: [] },
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
    const dashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
    dashboard.gridItems = [mockedNullCheckboxVariable];
    const handleChange = jest.fn();

    render(
      createLoadedComponent({
        children: (
          <>
            <VariableInput
              args={JSON.parse(mockedNullCheckboxVariable.args_string)}
              onChange={handleChange}
            />
            <InputVariablePComponent />
          </>
        ),
        options: {
          dashboards: { user: [dashboard], public: [] },
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
        JSON.stringify({ "Test Variable": null })
      );
    });
  });

  it("Creates a Dropdown Input for a Variable Input", async () => {
    const dashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
    dashboard.gridItems = [mockedDropdownVariable];
    const handleChange = jest.fn();

    render(
      createLoadedComponent({
        children: (
          <>
            <VariableInput
              args={JSON.parse(mockedDropdownVariable.args_string)}
              onChange={handleChange}
            />
            <InputVariablePComponent />
          </>
        ),
        options: {
          dashboards: { user: [dashboard], public: [] },
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
