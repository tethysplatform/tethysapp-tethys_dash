import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import DataInput from "components/inputs/DataInput";
import { useAvailableVisualizationsContext } from "components/contexts/AvailableVisualizationsContext";
import { useDataViewerModeContext } from "components/contexts/DataViewerModeContext";
import { useVariableInputValuesContext } from "components/contexts/VariableInputsContext";
import { nonDropDownVariableInputTypes } from "components/visualizations/utilities";
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
  const { availableVizArgs } = useAvailableVisualizationsContext();
  const { inDataViewerMode } = useInDataViewerModeContext();
  const {
    variableInputValues,
    setVariableInputValues
  } = useVariableInputValuesContext();

  useEffect(() => {
    // When any of the args are updated, the variable is changed to null
    // The label is set to the variable_name,
    setValue(null);
    setLabel(args.variable_name);

    // Sets the type to the variable_options_source if not a dropdown
    if (nonDropDownVariableInputTypes.includes(args.variable_options_source)) {
      setType(args.variable_options_source);
    } else {
      // If it is a dropdown, it searches for the matching dropdown options in availableVizArgs
      var selectedArg = availableVizArgs.find((obj) => {
        return obj.label === args.variable_options_source;
      });
      setType(selectedArg.argOptions);
    }

    if (args.variable_options_source === "number") {
      // If the variable_options_source is a number, it parses the int value from initial_value
      setValue(parseInt(args.initial_value));
    } else if (
      args.variable_options_source === "checkbox" &&
      args.initial_value === null
    ) {
      // This sets to false because null isn't a valid value for a checkbox
      // But I've never been able to get this to fire.
      setValue(false);
      onChange(false);
    } else {
      setValue(args.initial_value);
    }

    if (!inDataViewerMode) {
      // This prevents the Edit Visualization Modal's variable input selector from
      // changing the Dashboard variable input selector.
      updateVariableInputs(args.initial_value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args]);

  function handleInputChange(e) {
    if (args.variable_options_source === "number") {
      setValue(parseInt(e));
    } else {
      setValue(e);
    }
    onChange(e);

    if (Array.isArray(type) || type === "checkbox") {
      if (!inDataViewerMode) {
        if (typeof e.value !== "undefined") {
          updateVariableInputs(e.value);
        } else {
          updateVariableInputs(e);
        }
      }
    }
  }

  function handleInputRefresh() {
    if (!inDataViewerMode) {
      updateVariableInputs(value.value || value);
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
    variable_input_type: PropTypes.oneOf(["text", "number", "checkbox", "dropdown"]), // This just defines the type of input
    initial_value: PropTypes.string,
    variable_name: PropTypes.string,
    variable_options_source: PropTypes.string // This is where the name of the source comes in like in the dropdown
  }),
  onChange: PropTypes.func,
};

export default VariableInput;
