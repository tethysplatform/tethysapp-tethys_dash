import { useState, useEffect, useRef } from "react";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import PropTypes from "prop-types";
import styled from "styled-components";
import NormalInput from "components/inputs/NormalInput";
import DataSelect from "components/inputs/DataSelect";
import DatePicker from "components/inputs/DatePicker";

export const SliderMetadata = ({ onChange, values, visualizationRef }) => {
  const [min, setMin] = useState(values.min ?? null);
  const [max, setMax] = useState(values.max ?? null);
  const [step, setStep] = useState(values.step ?? null);
  const [initialValue, setInitialValue] = useState(values.initialValue ?? null);
  const [dataType, setDataType] = useState(
    values.dataType ? { value: values.dataType, label: values.dataType } : null
  );

  useEffect(() => {
    if (
      min != null &&
      max != null &&
      initialValue != null &&
      step != null &&
      dataType
    ) {
      onChange({ min, max, step, dataType, initialValue });
    }
  }, [min, max, step, initialValue, dataType?.value]);

  const onDataTypeChange = (selected) => {
    setDataType(selected);
    setMin(null);
    setMax(null);
    setStep(null);
    setInitialValue(null);
  };

  const onMinChange = (e) => {
    let newValue;
    if (isNumber) {
      newValue = Number(e.target.value);
    } else if (isDate) {
      newValue = e;
    }
    setMin(newValue);
  };

  const onMaxChange = (e) => {
    let newValue;
    if (isNumber) {
      newValue = Number(e.target.value);
    } else if (isDate) {
      newValue = e;
    }
    setMax(newValue);
  };

  const onStepChange = (e) => {
    const newValue = Number(e.target.value);
    setStep(newValue);
  };

  const onInitialValueChange = (e) => {
    let newValue;
    if (isNumber) {
      newValue = Number(e.target.value);
    } else if (isDate) {
      newValue = e;
    }
    setInitialValue(newValue);
  };

  const isNumber = dataType?.value === "Number";
  const isDate = dataType?.value === "Date";

  return (
    <>
      <DataSelect
        label="Data Type"
        selectedOption={dataType}
        onChange={onDataTypeChange}
        options={[
          { value: "Number", label: "Number" },
          { value: "Date", label: "Date" },
          { value: "Date (Hour)", label: "Date (Hour)" },
          { value: "Custom", label: "Custom" },
        ]}
      />
      {dataType && (
        <>
          {isNumber && (
            <>
              <NormalInput
                label="Minimum"
                value={min}
                type="number"
                onChange={onMinChange}
              />
              <NormalInput
                label="Maximum"
                value={max}
                type="number"
                onChange={onMaxChange}
              />
            </>
          )}
          {isDate && (
            <>
              <DatePicker
                label="Minimum"
                value={min}
                type="date"
                onChange={onMinChange}
              />
              <DatePicker
                label="Maximum"
                value={max}
                type="date"
                onChange={onMaxChange}
              />
            </>
          )}
          <NormalInput
            label="Initial Value"
            value={initialValue}
            type="number"
            onChange={onInitialValueChange}
          />
          <NormalInput
            label="Step"
            value={step}
            type="number"
            onChange={onStepChange}
          />
        </>
      )}
    </>
  );
};

SliderMetadata.propTypes = {
  onChange: PropTypes.func.isRequired,
  values: PropTypes.shape({
    min: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string,
      PropTypes.instanceOf(Date),
    ]),
    max: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string,
      PropTypes.instanceOf(Date),
    ]),
    step: PropTypes.number,
    dataType: PropTypes.string,
  }),
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};
