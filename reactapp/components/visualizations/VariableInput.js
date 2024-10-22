import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import DataInput from "components/inputs/DataInput";
import { useAvailableVisualizationsContext } from "components/contexts/AvailableVisualizationsContext";
import { useVariableInputValuesContext } from "components/contexts/VariableInputsContext";
import { nonDropDownVariableInputTypes } from "components/visualizations/utilities";

const StyledDiv = styled.div`
  padding: 1rem;
  width: 100%;
`;

const VariableInput = ({ args, onChange, dataviewer }) => {
  const [value, setValue] = useState("");
  const [type, setType] = useState(null);
  const [label, setLabel] = useState(null);
  const availableVizArgs = useAvailableVisualizationsContext()[1];
  const [variableInputValues, setVariableInputValues] =
    useVariableInputValuesContext();

  useEffect(() => {
    setValue(null);
    setLabel(args.variable_name);
    if (nonDropDownVariableInputTypes.includes(args.variable_options_source)) {
      setType(args.variable_options_source);
    } else {
      var selectedArg = availableVizArgs.find((obj) => {
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

    if (!dataviewer) {
      updateVariableInputs(args.initial_value.value);
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
      if (!dataviewer) {
        if (typeof e.value !== "undefined") {
          updateVariableInputs(e.value);
        } else {
          updateVariableInputs(e);
        }
      }
    }
  }

  function handleInputEnter() {
    if (!dataviewer) {
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

  return (
    <StyledDiv>
      <DataInput
        objValue={{ label, type, value }}
        onChange={handleInputChange}
        onEnter={handleInputEnter}
      />
    </StyledDiv>
  );
};

VariableInput.propTypes = {
  args: PropTypes.object,
  onChange: PropTypes.func,
  dataviewer: PropTypes.bool,
};

export default VariableInput;
