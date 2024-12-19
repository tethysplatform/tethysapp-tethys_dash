import PropTypes from "prop-types";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import VariableInput from "components/visualizations/VariableInput";
import {
  mockedAvailableVizArgs,
  mockedCheckboxVariable,
  mockedDropdownVariable,
  mockedNullCheckboxVariable,
  mockedNumberVariable,
  mockedTextVariable,
  mockedDashboards,
} from "__tests__/utilities/constants";

import {
  AppContext,
  LayoutContext,
  DataViewerModeContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import { select } from "react-select-event";
import appAPI from "services/api/app";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function initAndRender(props) {
  const user = userEvent.setup();
  const updateVariableInputValuesWithGridItems = jest.fn();
  const setVariableInputValues = jest.fn();
  const setInDataViewerMode = jest.fn();
  const handleChange = jest.fn();
  const mockGetLayoutContext = jest.fn();
  mockGetLayoutContext.mockReturnValue(mockedDashboards.editable);

  const VariableInputRender = (props) => {
    return (
      <AppContext.Provider
        value={{ visualizationArgs: mockedAvailableVizArgs }}
      >
        <LayoutContext.Provider
          value={{ getLayoutContext: mockGetLayoutContext }}
        >
          <DataViewerModeContext.Provider
            value={{
              inDataViewerMode: props.inDataViewer,
              setInDataViewerMode,
            }}
          >
            <VariableInputsContext.Provider
              value={{
                variableInputValues: props.variableInputValues,
                setVariableInputValues,
                updateVariableInputValuesWithGridItems,
              }}
            >
              <VariableInput args={props.args} onChange={handleChange} />
            </VariableInputsContext.Provider>
          </DataViewerModeContext.Provider>
        </LayoutContext.Provider>
      </AppContext.Provider>
    );
  };

  VariableInputRender.propTypes = {
    args: PropTypes.shape({
      variable_input_type: PropTypes.oneOf([
        "text",
        "number",
        "checkbox",
        "dropdown",
      ]), // This just defines the type of input
      initial_value: PropTypes.string,
      variable_name: PropTypes.string,
      variable_options_source: PropTypes.string, // This is where the name of the source comes in like in the dropdown
    }),
    inDataViewer: PropTypes.bool,
    variableInputValues: PropTypes.array,
    gridItems: PropTypes.object,
  };

  const { rerender } = render(VariableInputRender(props));

  return {
    user,
    VariableInputRender,
    rerender,
    setVariableInputValues,
    updateVariableInputValuesWithGridItems,
    setInDataViewerMode,
    handleChange,
  };
}

it("Creates a Text Input for a Variable Input", async () => {
  const { user, setVariableInputValues, handleChange } = initAndRender({
    args: JSON.parse(mockedTextVariable.args_string),
    gridItems: [mockedTextVariable],
  });

  const variableInput = screen.getByLabelText("Test Variable Input");
  expect(variableInput).toBeInTheDocument();
  await user.type(variableInput, "Hello World");

  expect(variableInput).toHaveValue("Hello World");
  expect(handleChange).toHaveBeenCalledWith("Hello World");

  // Only update the Text Input after clicking the input refresh button
  expect(setVariableInputValues).not.toHaveBeenCalled();

  const refreshButton = screen.getByRole("button");
  expect(refreshButton).toBeInTheDocument();
  await user.click(refreshButton);

  expect(setVariableInputValues).toHaveBeenCalled();

  // Because we used a callback in the setVariableInputValues,
  // We have to dig a bit into the mock to see what values were passed.
  const updater = setVariableInputValues.mock.calls[0][0];
  const result = updater({}); // This is what the existing state would be
  expect(result).toEqual({ "Test Variable": "Hello World" });
});

it("Creates a Number Input for a Variable Input", async () => {
  const { user, setVariableInputValues, handleChange } = initAndRender({
    args: JSON.parse(mockedNumberVariable.args_string),
    gridItems: [mockedNumberVariable],
  });

  const variableInput = screen.getByLabelText("Test Variable Input");
  expect(variableInput).toBeInTheDocument();
  await user.type(variableInput, "9");

  expect(variableInput).toHaveValue(9);
  expect(handleChange).toHaveBeenCalledWith("9"); // Is this expected to be a string?

  // Only update the Text Input after clicking the input refresh button
  expect(setVariableInputValues).not.toHaveBeenCalled();

  const refreshButton = screen.getByRole("button");
  expect(refreshButton).toBeInTheDocument();
  await user.click(refreshButton);

  expect(setVariableInputValues).toHaveBeenCalled();

  // Because we used a callback function in the setVariableInputValues,
  // We have to dig a bit into the mock to see what values were passed.
  const updater = setVariableInputValues.mock.calls[0][0];
  const result = updater({}); // This is what the existing state would be
  expect(result).toEqual({ "Test Variable": 9 });
});

it("Creates a Checkbox Input for a Variable Input", async () => {
  const { user, setVariableInputValues, handleChange } = initAndRender({
    args: JSON.parse(mockedCheckboxVariable.args_string),
    gridItems: [mockedCheckboxVariable],
  });

  const variableInput = screen.getByLabelText("Test Variable Input");
  expect(variableInput).toBeInTheDocument();
  expect(variableInput).toBeChecked();
  await user.click(variableInput);

  expect(variableInput).not.toBeChecked();
  expect(handleChange).toHaveBeenCalledWith(false);

  // The first time the function is called, the initial_value is provided.
  // The second time is what the actually value will be
  expect(setVariableInputValues).toHaveBeenCalledTimes(2);

  sleep(50);

  // Because we used a callback function in the setVariableInputValues,
  // We have to dig a bit into the mock to see what values were passed.
  const updater = setVariableInputValues.mock.calls[1][0];
  const result = updater({}); // This is what the existing state would be
  expect(result).toEqual({ "Test Variable": false });
});

it("Creates a Checkbox Input for a Variable Input with a null value", async () => {
  const { user, setVariableInputValues, handleChange } = initAndRender({
    args: JSON.parse(mockedNullCheckboxVariable.args_string),
    gridItems: [mockedNullCheckboxVariable],
  });

  const variableInput = screen.getByLabelText("Test Variable Input");
  expect(variableInput).toBeInTheDocument();
  expect(variableInput).not.toBeChecked();
  await user.click(variableInput);

  expect(variableInput).toBeChecked();
  expect(handleChange).toHaveBeenCalledWith(true);

  expect(setVariableInputValues).toHaveBeenCalled();

  sleep(50);

  // Because we used a callback function in the setVariableInputValues,
  // We have to dig a bit into the mock to see what values were passed.
  const updater = setVariableInputValues.mock.calls[0][0];
  const result = updater({}); // This is what the existing state would be
  expect(result).toEqual({ "Test Variable": true });
});

it("Creates a Dropdown Input for a Variable Input", async () => {
  appAPI.getVisualizations = () => {
    return Promise.resolve({
      success: true,
      visualizations: mockedAvailableVizArgs,
    });
  };
  const { setVariableInputValues, handleChange } = initAndRender({
    args: JSON.parse(mockedDropdownVariable.args_string),
    gridItems: [mockedDropdownVariable],
  });

  const variableInput = screen.getByLabelText("Test Variable Input");
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

  // The first time the function is called, the initial_value is provided.
  // The second time is what the actually value will be
  expect(setVariableInputValues).toHaveBeenCalledTimes(2);

  // Because we used a callback function in the setVariableInputValues,
  // We have to dig a bit into the mock to see what values were passed.
  const updater = setVariableInputValues.mock.calls[1][0]; // Grab the second call
  const result = updater({}); // This is what the existing state would be
  expect(result).toEqual({ "Test Variable": "CREC1" });
});

describe("When inDataViewerMode", () => {
  // The contextualized value won't be updated so the modal and the dashboard states can be kept separate.
  it("Creates a Text Input for a Variable Input", async () => {
    const { user, setVariableInputValues, handleChange } = initAndRender({
      args: JSON.parse(mockedTextVariable.args_string),
      gridItems: [mockedTextVariable],
      inDataViewer: true,
    });

    const variableInput = screen.getByLabelText("Test Variable Input");
    expect(variableInput).toBeInTheDocument();
    await user.type(variableInput, "Hello World");

    expect(variableInput).toHaveValue("Hello World");
    expect(handleChange).toHaveBeenCalledWith("Hello World");

    // Only update the Text Input after clicking the input refresh button
    expect(setVariableInputValues).not.toHaveBeenCalled();

    const refreshButton = screen.getByRole("button");
    expect(refreshButton).toBeInTheDocument();
    await user.click(refreshButton);

    expect(setVariableInputValues).not.toHaveBeenCalled();
  });

  it("Creates a Number Input for a Variable Input", async () => {
    const { user, setVariableInputValues, handleChange } = initAndRender({
      args: JSON.parse(mockedNumberVariable.args_string),
      gridItems: [mockedNumberVariable],
      inDataViewer: true,
    });

    const variableInput = screen.getByLabelText("Test Variable Input");
    expect(variableInput).toBeInTheDocument();
    await user.type(variableInput, "9");

    expect(variableInput).toHaveValue(9);
    expect(handleChange).toHaveBeenCalledWith("9"); // Is this expected to be a string?

    // Only update the Text Input after clicking the input refresh button
    expect(setVariableInputValues).not.toHaveBeenCalled();

    const refreshButton = screen.getByRole("button");
    expect(refreshButton).toBeInTheDocument();
    await user.click(refreshButton);

    expect(setVariableInputValues).not.toHaveBeenCalled();
  });

  it("Creates a Checkbox Input for a Variable Input", async () => {
    const { user, setVariableInputValues, handleChange } = initAndRender({
      args: JSON.parse(mockedCheckboxVariable.args_string),
      gridItems: [mockedCheckboxVariable],
      inDataViewer: true,
    });

    const variableInput = screen.getByLabelText("Test Variable Input");
    expect(variableInput).toBeInTheDocument();
    expect(variableInput).toBeChecked();
    await user.click(variableInput);

    expect(variableInput).not.toBeChecked();
    expect(handleChange).toHaveBeenCalledWith(false);

    expect(setVariableInputValues).not.toHaveBeenCalled();
  });

  it("Creates a Checkbox Input for a Variable Input with a null value", async () => {
    const { user, setVariableInputValues, handleChange } = initAndRender({
      args: JSON.parse(mockedNullCheckboxVariable.args_string),
      gridItems: [mockedNullCheckboxVariable],
      inDataViewer: true,
    });

    const variableInput = screen.getByLabelText("Test Variable Input");
    expect(variableInput).toBeInTheDocument();
    expect(variableInput).not.toBeChecked();
    await user.click(variableInput);

    expect(variableInput).toBeChecked();
    expect(handleChange).toHaveBeenCalledWith(true);

    expect(setVariableInputValues).not.toHaveBeenCalled();
  });

  it("Creates a Dropdown Input for a Variable Input", async () => {
    appAPI.getVisualizations = () => {
      return Promise.resolve({
        success: true,
        visualizations: mockedAvailableVizArgs,
      });
    };
    const { setVariableInputValues, handleChange } = initAndRender({
      args: JSON.parse(mockedDropdownVariable.args_string),
      gridItems: [mockedDropdownVariable],
      inDataViewer: true,
    });

    const variableInput = screen.getByLabelText("Test Variable Input");
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

    expect(setVariableInputValues).not.toHaveBeenCalled();
  });
});
