import { useContext } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import DataSelect from "components/inputs/DataSelect";
import {
  VariableInputsContext,
  DataViewerModeContext,
} from "components/contexts/Contexts";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import MultiInput from "components/inputs/MultiInput";
import InputTable from "components/inputs/InputTable";
import NormalInput from "components/inputs/NormalInput";
import CheckboxInput from "components/inputs/CheckboxInput";
import * as customInputs from "components/inputs/Custom";

const StyledDiv = styled.div`
  padding-bottom: 1rem;
  margin-right: 1rem;
`;

const Input = ({ label, type, onChange, value, valueOptions, inputProps }) => {
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
        onChange={(e) => onChange(e)}
        options={options}
        {...inputProps}
      />
    );
  } else if (type === "checkbox") {
    return (
      <CheckboxInput
        label={label}
        onChange={(e) => onChange(e.target.checked)}
        value={value}
        type={type}
        inputProps={inputProps}
      />
    );
  } else if (type === "radio") {
    return (
      <DataRadioSelect
        label={label}
        aria-label={label + " Input"}
        selectedRadio={value}
        radioOptions={valueOptions}
        onChange={(e) => {
          onChange(e.target.value);
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
          onChange(values);
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
          onChange(values);
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
          onChange(values);
        }}
        values={value}
        {...inputProps}
      />
    );
  } else {
    return (
      <NormalInput
        label={label}
        onChange={(e) => onChange(e.target.value)}
        value={value}
        type={type}
      />
    );
  }
};

const DataInput = ({
  label,
  type,
  value,
  valueOptions,
  onChange,
  inputProps,
}) => {
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
            inputProps={inputProps}
          />
        </StyledDiv>
      )}
    </>
  );
};

DataInput.propTypes = {
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
  inputProps: PropTypes.object, // additional props to pass to the input
};

export default DataInput;
