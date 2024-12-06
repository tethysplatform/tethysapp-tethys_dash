import PropTypes from "prop-types";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { VariableInputValuesContext } from "components/contexts/VariableInputsContext";
import AvailableVisualizationsContextProvider from "components/contexts/AvailableVisualizationsContext";
import { DataViewerModeContext } from "components/contexts/DataViewerModeContext";
import VariableInput from "components/visualizations/VariableInput";
import { mockedCheckboxVariable, mockedNumberVariable, mockedTextVariable } from "__tests__/utilities/constants";
import { LayoutGridItemsContext } from "components/contexts/SelectedDashboardContext";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function initAndRender(props) {
  const user = userEvent.setup();
  const updateVariableInputValuesWithGridItems = jest.fn();
  const setVariableInputValues = jest.fn();
  const setInDataViewerMode = jest.fn();
  const handleChange = jest.fn();
  const setGridItems = jest.fn();

  const VariableInputRender = (props) => {
    return (
      <AvailableVisualizationsContextProvider>
        <LayoutGridItemsContext.Provider
          value={{gridItems: props.gridItems, setGridItems}}
        >
          <DataViewerModeContext.Provider
            value={{ inDataViewer: props.inDataViewer, setInDataViewerMode}}
          >
            <VariableInputValuesContext.Provider
              value={{
                variableInputValues: props.variableInputValues,
                setVariableInputValues,
                updateVariableInputValuesWithGridItems
              }}
            >
              <VariableInput args={props.args} onChange={handleChange} />
            </VariableInputValuesContext.Provider>
          </DataViewerModeContext.Provider>
        </LayoutGridItemsContext.Provider>
      </AvailableVisualizationsContextProvider>
    );
  };

  VariableInputRender.propTypes = {
    args: PropTypes.shape({
      variable_input_type: PropTypes.oneOf(["text", "number", "checkbox", "dropdown"]), // This just defines the type of input
      initial_value: PropTypes.string,
      variable_name: PropTypes.string,
      variable_options_source: PropTypes.string // This is where the name of the source comes in like in the dropdown  
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
    gridItems: [mockedTextVariable]
  });

  const variableInput = screen.getByLabelText("Test Variable Input")
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
  expect(result).toEqual({"Test Variable": "Hello World"});
});

it("Creates a Number Input for a Variable Input", async () => {
  const { user, setVariableInputValues, handleChange } = initAndRender({
    args: JSON.parse(mockedNumberVariable.args_string),
    gridItems: [mockedNumberVariable]
  });

  const variableInput = screen.getByLabelText("Test Variable Input")
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
  expect(result).toEqual({"Test Variable": 9});
});

it("Creates a Checkbox Input for a Variable Input", async () => {
  const { user, setVariableInputValues, handleChange } = initAndRender({
    args: JSON.parse(mockedCheckboxVariable.args_string),
    gridItems: [mockedCheckboxVariable]
  });

  const variableInput = screen.getByLabelText("Test Variable Input")
  expect(variableInput).toBeInTheDocument();
  expect(variableInput).toBeChecked();
  await user.click(variableInput);

  expect(variableInput).not.toBeChecked();
  expect(handleChange).toHaveBeenCalledWith(false);

  expect(setVariableInputValues).toHaveBeenCalled();

  // Because we used a callback function in the setVariableInputValues,
  // We have to dig a bit into the mock to see what values were passed.
  const updater = setVariableInputValues.mock.calls[0][0];
  const result = updater({}); // This is what the existing state would be
  expect(result).toEqual({"Test Variable": false});
});
