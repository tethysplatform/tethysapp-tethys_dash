import { useState, useEffect, useRef, memo } from "react";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import PropTypes from "prop-types";
import styled from "styled-components";
import NormalInput from "components/inputs/NormalInput";
import DataSelect from "components/inputs/DataSelect";
import DatePicker from "components/inputs/DatePicker";
import { timeDeltas } from "components/inputs/Slider";

const FlexDiv = styled.div`
  display: flex;
  width: 100%;
  margin-top: 1rem;
`;

const TimeDeltaDiv = styled.div`
  flex: 1;
  margin-left: 1rem;
  position: relative;
`;

const SliderMetadata = ({ onChange, values, visualizationRef }) => {
  const [min, setMin] = useState(values?.min ?? null);
  const [max, setMax] = useState(values?.max ?? null);
  const [step, setStep] = useState(values?.step ?? null);
  const [outputFormat, setOutputFormat] = useState(values?.outputFormat ?? "");
  const [initialValue, setInitialValue] = useState(
    values?.initialValue ?? null
  );
  const [dataType, setDataType] = useState(
    values?.dataType ? { value: values.dataType, label: values.dataType } : null
  );
  const [dateTimeDelta, setDateTimeDelta] = useState(
    values?.dateTimeDelta
      ? { value: values.dateTimeDelta, label: values.dateTimeDelta }
      : { value: "Days", label: "Days" }
  );

  useEffect(() => {
    if (
      min != null &&
      max != null &&
      initialValue != null &&
      step != null &&
      outputFormat !== "" &&
      dataType
    ) {
      let onChangeValues = {
        min,
        max,
        step,
        dataType: dataType.value,
        initialValue,
        outputFormat,
      };
      if (dataType.value === "Date") {
        onChangeValues.dateTimeDelta = dateTimeDelta.value;
      }
      onChange(onChangeValues);
    }
  }, [
    min,
    max,
    step,
    initialValue,
    outputFormat,
    dataType?.value,
    dateTimeDelta.value,
  ]);

  const onDataTypeChange = (selected) => {
    setDataType(selected);
    setMin(null);
    setMax(null);
    setStep(null);
    setInitialValue(null);
    setOutputFormat("");
    onChange(null);
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

  const onOutputFormatChange = (e) => {
    const newValue = e.target.value;
    setOutputFormat(newValue);
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

  const onDataTimeDeltaChange = (selected) => {
    setDateTimeDelta(selected);
  };

  const isNumber = dataType?.value === "Number";
  const isDate = dataType?.value === "Date";
  const dateTimeDeltaOptions = Object.keys(timeDeltas).map((key) => ({
    value: key,
    label: key,
  }));

  return (
    <>
      <DataSelect
        label="Data Type"
        selectedOption={dataType}
        onChange={onDataTypeChange}
        options={[
          { value: "Number", label: "Number" },
          { value: "Date", label: "Date" },
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
                divProps={{ style: { "margin-top": "1rem" } }}
              />
              <NormalInput
                label="Maximum"
                value={max}
                type="number"
                onChange={onMaxChange}
                divProps={{ style: { "margin-top": "1rem" } }}
              />
              <NormalInput
                label="Initial Value"
                value={initialValue}
                type="number"
                onChange={onInitialValueChange}
                divProps={{ style: { "margin-top": "1rem" } }}
              />
              <NormalInput
                label="Step"
                value={step}
                type="number"
                onChange={onStepChange}
                divProps={{ style: { "margin-top": "1rem" } }}
              />
              <NormalInput
                label="Output Format"
                value={outputFormat}
                type="text"
                onChange={onOutputFormatChange}
                placeholder="e.g., {{n}}, {{n:3}}, {{n}}Forecast"
                divProps={{ style: { "margin-top": "1rem" } }}
              />
            </>
          )}
          {isDate && (
            <>
              <DatePicker
                label="Minimum"
                value={min}
                type="date-hour"
                onChange={onMinChange}
                divProps={{ style: { "margin-top": "1rem" } }}
              />
              <DatePicker
                label="Maximum"
                value={max}
                type="date-hour"
                onChange={onMaxChange}
                divProps={{ style: { "margin-top": "1rem" } }}
              />
              <DatePicker
                label="Initial Value"
                value={initialValue}
                type="date-hour"
                onChange={onInitialValueChange}
                divProps={{ style: { "margin-top": "1rem" } }}
              />
              <FlexDiv>
                <NormalInput
                  label="Step"
                  value={step}
                  type="number"
                  onChange={onStepChange}
                />
                <TimeDeltaDiv>
                  <DataSelect
                    selectedOption={dateTimeDelta}
                    onChange={onDataTimeDeltaChange}
                    options={dateTimeDeltaOptions}
                    divProps={{
                      style: {
                        "margin-bottom": 0,
                        bottom: 0,
                        position: "absolute",
                      },
                    }}
                  />
                </TimeDeltaDiv>
              </FlexDiv>
              <NormalInput
                label="Output Format"
                value={outputFormat}
                type="text"
                onChange={onOutputFormatChange}
                placeholder="date-fns format tokens; e.g., MM/dd/yyyy, MM/dd/yyyy'T'HH:mm"
                divProps={{ style: { "margin-top": "1rem" } }}
              />
            </>
          )}
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

export default memo(SliderMetadata);
