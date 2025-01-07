import { useContext, useState } from "react";
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
  includeVariableInputs,
  setShowingSubModal,
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
      includeVariableInputs !== false &&
      label !== "Variable Options Source"
    ) {
      const availableVariableInputs = Object.keys(variableInputValues);
      if (availableVariableInputs.length !== 0) {
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
        aria-label={label + " Input"}
        selectedOption={inputValue}
        onChange={(e) => onChange(e, index)}
        options={options}
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
        setShowingSubModal={setShowingSubModal}
      />
    );
  } else {
    return (
      <>
        <Form.Label>
          <b>{label}:</b>
        </Form.Label>
        <Form.Control
          aria-label={label + " Input"}
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

const DataInput = ({
  objValue,
  onChange,
  index,
  includeVariableInputs,
  setShowingSubModal,
}) => {
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
            includeVariableInputs={includeVariableInputs}
            setShowingSubModal={setShowingSubModal}
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
    PropTypes.array,
  ]),
  valueOptions: PropTypes.array,
  index: PropTypes.number,
};

export default DataInput;
