import PropTypes from "prop-types";
import styled from "styled-components";
import Form from "react-bootstrap/Form";
import DataSelect from "components/inputs/DataSelect";
import { useLayoutGridItemsContext } from "components/contexts/SelectedDashboardContext";
import { useInDataViewerModeContext } from "components/contexts/DataViewerModeContext";

const StyledDiv = styled.div`
  padding-bottom: 1rem;
  margin-right: 1rem;
`;

const Input = ({ label, type, onChange, value, index }) => {
  const gridItems = useLayoutGridItemsContext()[0];
  const inDataViewerMode = useInDataViewerModeContext();

  function getAvailableVariableInputs() {
    const availableVariableInputs = [];
    const variableInputs = gridItems.filter(
      (item) => item.source === "Variable Input"
    );
    if (variableInputs) {
      for (let variableInput of variableInputs) {
        const variableInputInfo = JSON.parse(variableInput.args_string);
        availableVariableInputs.push(variableInputInfo.variable_name);
      }
    }

    return availableVariableInputs;
  }

  if (Array.isArray(type)) {
    let options = [];
    let inputValue;
    for (const option of type) {
      if (typeof option === "object") {
        options.push(option);
      } else {
        options.push({ value: option, label: option });
      }
      if (typeof value !== "object") {
        inputValue = { value: value, label: value };
      } else {
        inputValue = value;
      }
    }

    if (inDataViewerMode && label !== "Variable Options Source") {
      const availableVariableInputs = getAvailableVariableInputs(type);
      if (availableVariableInputs) {
        options.push({
          label: "Variable Inputs",
          options: availableVariableInputs.map((availableVariableInput) => ({
            label: availableVariableInput,
            value: "Variable Input:" + availableVariableInput,
          })),
        });
      }
    }

    return (
      <DataSelect
        label={label}
        selectedOption={inputValue}
        onChange={(e) => onChange(e, index)}
        options={options}
      />
    );
  } else if (type === "checkbox") {
    return (
      <>
        <Form.Check
          type={type}
          id={label.replace(" ", "_")}
          label={label}
          checked={value}
          onChange={(e) => onChange(e.target.checked, index)}
        />
      </>
    );
  } else {
    return (
      <>
        <Form.Label>
          <b>{label}:</b>
        </Form.Label>
        <Form.Control
          required
          type={type}
          onChange={(e) => onChange(e.target.value, index)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // prevents submitting form on enter
            }
          }}
          value={value}
        />
      </>
    );
  }
};

const DataInput = ({ objValue, onChange, index }) => {
  const { label, type, value } = objValue;
  const inDataViewerMode = useInDataViewerModeContext();

  return (
    <>
      {type && (
        <StyledDiv>
          <Input
            label={label}
            type={type}
            onChange={onChange}
            value={value}
            index={index}
            inDataViewerMode={inDataViewerMode}
          />
        </StyledDiv>
      )}
    </>
  );
};

DataInput.propTypes = {
  objValue: PropTypes.object,
  onChange: PropTypes.func,
  index: PropTypes.number,
};

Input.propTypes = {
  label: PropTypes.string,
  type: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
  onChange: PropTypes.func,
  value: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string,
    PropTypes.bool,
    PropTypes.object,
  ]),
  index: PropTypes.number,
  dataviewer: PropTypes.bool,
};

export default DataInput;
