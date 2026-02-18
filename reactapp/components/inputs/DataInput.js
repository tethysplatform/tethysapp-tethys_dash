import { useContext, memo } from "react";
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
import DatePicker from "components/inputs/DatePicker";
import DateFormat from "components/inputs/DateFormat";
import DateRange from "components/inputs/DateRange";
import { parseDate } from "components/inputs/dateUtils";
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
    }

    if (typeof value !== "object") {
      inputValue = { value: value, label: value };
    } else {
      inputValue = value;
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
        onChange={onChange}
        value={value}
        type={type}
        inputProps={inputProps}
      />
    );
  } else if (type === "date-format") {
    return (
      <DateFormat
        onChange={(newValue) => onChange({ format: newValue })}
        value={value?.format}
      />
    );
  } else if (typeof type === "string" && type.includes("date")) {
    if (typeof value === "string" && type === "date-range") {
      value = {};
    }

    // fix the example to not show in visualization pan
    return (
      <>
        {type === "date-range" ? (
          <DateRange values={value} onChange={onChange} metadata={inputProps} />
        ) : (
          <DatePicker
            label={label}
            onChange={onChange}
            value={value}
            dateFormat={inputProps?.format}
          />
        )}
        {inDataViewerMode && (
          <div style={{ marginTop: "1rem" }}>
            <label>
              <b>Example Date Output</b>:
            </label>{" "}
            <span>
              {parseDate(value?.startDate || value, inputProps?.format, true)}
            </span>
          </div>
        )}
      </>
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
        onChange={onChange}
        values={value}
        {...inputProps}
      />
    );
  } else if (type === "inputtable") {
    return (
      <InputTable
        label={label}
        aria-label={label + " Input"}
        onChange={onChange}
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
        onChange={onChange}
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

const MemoizedInput = memo(Input);

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
          <MemoizedInput
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

export default memo(DataInput);
