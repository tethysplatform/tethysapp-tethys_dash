import { useEffect, useState, useContext } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import DataInput from "components/inputs/DataInput";
import { AppContext } from "components/contexts/AppContext";
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
  const { visualizationArgs } = useContext(AppContext);
  const { inDataViewerMode } = useDataViewerModeContext();
  const { variableInputValues, setVariableInputValues } =
    useVariableInputValuesContext();

  useEffect(() => {
    setValue(null);
    setLabel(args.variable_name);
    if (nonDropDownVariableInputTypes.includes(args.variable_options_source)) {
      setType(args.variable_options_source);
    } else {
      var selectedArg = visualizationArgs.find((obj) => {
        return obj.label === args.variable_options_source;
      });
      setType(selectedArg.argOptions);
    }

    if (args.variable_options_source === "number") {
      setValue(parseInt(args.initial_value));
    } else if (
      args.variable_options_source === "checkbox" &&
      args.initial_value === null
    ) {
      setValue(false);
      onChange(false);
    } else {
      setValue(args.initial_value);
    }

    if (!inDataViewerMode) {
      updateVariableInputs(args.initial_value.value || args.initial_value);
    }
    // eslint-disable-next-line
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

  function updateVariableInputs(new_value) {
    if (new_value || new_value === false) {
      const updatedVariableInputValues = { ...variableInputValues };
      updatedVariableInputValues[args.variable_name] = new_value;
      setVariableInputValues(updatedVariableInputValues);
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
  args: PropTypes.object,
  onChange: PropTypes.func,
};

export default VariableInput;
