import { useCallback, useEffect, useState, useContext } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import DataInput from "components/inputs/DataInput";
import {
  AppContext,
  VariableInputsContext,
  DataViewerModeContext,
} from "components/contexts/Contexts";
import {
  nonDropDownVariableInputTypes,
  findSelectOptionByValue,
} from "components/visualizations/utilities";
import TooltipButton from "components/buttons/TooltipButton";
import { BsArrowClockwise } from "react-icons/bs";

const StyledDiv = styled.div`
  padding: 1rem;
  width: 100%;
`;
const InLineInputDiv = styled.div`
  display: inline-block;
  width: calc(100% - 3em);
`;
const InLineButtonDiv = styled.div`
  display: inline-block;
`;

const VariableInput = ({ args, onChange }) => {
  const [value, setValue] = useState("");
  const [type, setType] = useState(null);
  const [label, setLabel] = useState(null);
  const { visualizationArgs } = useContext(AppContext);
  const { inDataViewerMode } = useContext(DataViewerModeContext);
  const { variableInputValues, setVariableInputValues } = useContext(
    VariableInputsContext
  );

  const updateVariableInputs = useCallback(
    (new_value) => {
      if (new_value || new_value === false) {
        setVariableInputValues((prevVariableInputValues) => ({
          ...prevVariableInputValues,
          [args.variable_name]: new_value,
        }));
      }
    },
    [args.variable_name, setVariableInputValues]
  );

  useEffect(() => {
    let initialVariableValue = args.initial_value;
    let variableValue = initialVariableValue;

    // Sets the type to the variable_options_source if not a dropdown
    if (nonDropDownVariableInputTypes.includes(args.variable_options_source)) {
      setType(args.variable_options_source);
    } else {
      var selectedArg = visualizationArgs.find((obj) => {
        return obj.label === args.variable_options_source;
      });
      setType(selectedArg.argOptions);
      initialVariableValue = findSelectOptionByValue(
        selectedArg.argOptions,
        initialVariableValue
      );
    }

    if (args.variable_options_source === "number") {
      // If the variable_options_source is a number, it parses the int value from initial_value
      initialVariableValue = parseInt(args.initial_value);
      variableValue = initialVariableValue;
    } else if (
      args.variable_options_source === "checkbox" &&
      args.initial_value === null
    ) {
      // This sets to false because null isn't a valid value for a checkbox
      // But I've never been able to get this to fire.
      initialVariableValue = false;
      variableValue = initialVariableValue;
    }
    setValue(initialVariableValue);
    setLabel(args.variable_name);

    if (!inDataViewerMode) {
      updateVariableInputs(variableValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args]);

  useEffect(() => {
    let newValue = variableInputValues[args.variable_name];
    if (Array.isArray(type)) {
      newValue = findSelectOptionByValue(type, newValue);
    }
    if (newValue && value !== newValue) {
      setValue(newValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variableInputValues]);

  function handleInputChange(e) {
    if (args.variable_options_source === "number") {
      setValue(parseInt(e));
    } else {
      setValue(e);
    }
    onChange(e);

    if (Array.isArray(type) || type === "checkbox") {
      if (!inDataViewerMode) {
        updateVariableInputs(e.value || e);
      }
    }
  }

  function handleInputRefresh() {
    if (!inDataViewerMode) {
      updateVariableInputs(value);
    }
  }

  if (Array.isArray(type) || type === "checkbox") {
    return (
      <StyledDiv>
        <DataInput
          objValue={{ label, type, value }}
          onChange={handleInputChange}
        />
      </StyledDiv>
    );
  } else {
    return (
      <StyledDiv>
        <InLineInputDiv>
          <DataInput
            objValue={{ label, type, value }}
            onChange={handleInputChange}
          />
        </InLineInputDiv>
        <InLineButtonDiv>
          <TooltipButton
            onClick={handleInputRefresh}
            tooltipPlacement={"right"}
            tooltipText={"Refresh variable input"}
            variant={"warning"}
          >
            <BsArrowClockwise />
          </TooltipButton>
        </InLineButtonDiv>
      </StyledDiv>
    );
  }
};

VariableInput.propTypes = {
  args: PropTypes.shape({
    variable_input_type: PropTypes.oneOf([
      "text",
      "number",
      "checkbox",
      "dropdown",
    ]), // This just defines the type of input
    initial_value: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    variable_name: PropTypes.string,
    variable_options_source: PropTypes.string, // This is where the name of the source comes in like in the dropdown
  }),
  onChange: PropTypes.func,
};

export default VariableInput;
