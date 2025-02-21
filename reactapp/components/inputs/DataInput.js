import { useContext } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import Form from "react-bootstrap/Form";
import DataSelect from "components/inputs/DataSelect";
import {
  VariableInputsContext,
  DataViewerModeContext,
} from "components/contexts/Contexts";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import MultiInput from "components/inputs/MultiInput";
import InputTable from "components/inputs/InputTable";
import NormalInput from "components/inputs/NormalInput";
import * as customInputs from "components/inputs/Custom";

const StyledDiv = styled.div`
  padding-bottom: 1rem;
  margin-right: 1rem;
`;

const InlineLabel = styled.label`
  display: inline;
`;

const InlineFormCheck = styled(Form.Check)`
  display: inline;
`;

const Input = ({
  label,
  type,
  onChange,
  value,
  index,
  valueOptions,
  inputProps,
}) => {
  const { variableInputValues } = useContext(VariableInputsContext);
  const { inDataViewerMode } = useContext(DataViewerModeContext);

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
    if (
      inDataViewerMode &&
      inputProps?.includeVariableInputs !== false &&
      label !== "Variable Options Source"
    ) {
      const availableVariableInputs = Object.keys(variableInputValues);
      if (availableVariableInputs.length !== 0) {
        options.push({
          label: "Variable Inputs",
          options: availableVariableInputs.map((availableVariableInput) => ({
            label: availableVariableInput,
            value: "${" + availableVariableInput + "}",
          })),
        });
      }
    }

    return (
      <DataSelect
        label={label}
        aria-label={label + " Input"}
        selectedOption={inputValue}
        onChange={(e) => onChange(e, index)}
        options={options}
        {...inputProps}
      />
    );
  } else if (type === "checkbox") {
    return (
      <div>
        <InlineLabel>
          <b>{label}: </b>
        </InlineLabel>
        <InlineFormCheck
          aria-label={label + " Input"}
          type={type}
          id={label.replace(" ", "_")}
          checked={value}
          onChange={(e) => onChange(e.target.checked, index)}
          {...inputProps}
        />
      </div>
    );
  } else if (type === "radio") {
    return (
      <DataRadioSelect
        label={label}
        aria-label={label + " Input"}
        selectedRadio={value}
        radioOptions={valueOptions}
        onChange={(e) => {
          onChange(e.target.value, index);
        }}
        {...inputProps}
      />
    );
  } else if (type === "multiinput") {
    return (
      <MultiInput
        label={label}
        aria-label={label + " Input"}
        onChange={(values) => {
          onChange(values, index);
        }}
        values={value}
        {...inputProps}
      />
    );
  } else if (type === "inputtable") {
    return (
      <InputTable
        label={label}
        aria-label={label + " Input"}
        onChange={(values) => {
          onChange(values, index);
        }}
        values={value}
        {...inputProps}
      />
    );
  } else if (typeof type === "string" && type.includes("custom-")) {
    const customInput = type.replace("custom-", "");
    const CustomComponent = customInputs[customInput];
    return (
      <CustomComponent
        label={label}
        aria-label={label + " Input"}
        onChange={(values) => {
          onChange(values, index);
        }}
        values={value}
        {...inputProps}
      />
    );
  } else {
    return (
      <NormalInput
        label={label}
        onChange={(e) => onChange(e.target.value, index)}
        value={value}
        type={type}
      />
    );
  }
};

const DataInput = ({ objValue, onChange, index, inputProps }) => {
  const { label, type, value, valueOptions } = objValue;

  return (
    <>
      {type && (
        <StyledDiv>
          <Input
            label={label}
            type={type}
            onChange={onChange}
            value={value}
            valueOptions={valueOptions}
            index={index}
            inputProps={inputProps}
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
  inputProps: PropTypes.object, // additional props to pass to the input
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
    PropTypes.array,
  ]),
  valueOptions: PropTypes.array,
  index: PropTypes.number,
  inputProps: PropTypes.object, // additional props to pass to the input
};

export default DataInput;
