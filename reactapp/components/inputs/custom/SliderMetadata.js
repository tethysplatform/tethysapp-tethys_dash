import { useState, useEffect, useContext, memo } from "react";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import PropTypes from "prop-types";
import styled from "styled-components";
import NormalInput from "components/inputs/NormalInput";
import DataSelect from "components/inputs/DataSelect";
import DatePicker from "components/inputs/DatePicker";
import { timeDeltas, calculateSliderValues } from "components/inputs/Slider";
import { VariableInputsContext } from "components/contexts/Contexts";
import { updateObjectWithVariableInputs } from "components/visualizations/utilities";

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

const SliderMetadata = ({ onChange, values }) => {
  const [min, setMin] = useState(values?.min ?? null);
  const [max, setMax] = useState(values?.max ?? null);
  const [step, setStep] = useState(values?.step ?? null);
  const [outputFormat, setOutputFormat] = useState(values?.outputFormat ?? "");
  const [rangeMode, setRangeMode] = useState(values?.rangeMode ?? false);
  const [initialValue, setInitialValue] = useState(
    values?.initialValue ?? null
  );
  const [initialRange, setInitialRange] = useState(
    values?.initialRange ?? [null, null]
  );
  const [dataType, setDataType] = useState(
    values?.dataType ? { value: values.dataType, label: values.dataType } : null
  );
  const [dateTimeDelta, setDateTimeDelta] = useState(
    values?.dateTimeDelta
      ? { value: values.dateTimeDelta, label: values.dateTimeDelta }
      : { value: "Days", label: "Days" }
  );
  const { variableInputValues } = useContext(VariableInputsContext);

  const possibleValues =
    min != null && max != null && step != null && dataType
      ? calculateSliderValues(
          updateObjectWithVariableInputs(
            {
              min,
              max,
              step,
              unit: dateTimeDelta?.value,
              dataType: dataType?.value,
            },
            variableInputValues
          )
        )
      : [];

  useEffect(() => {
    if (
      min != null &&
      max != null &&
      step != null &&
      outputFormat !== "" &&
      dataType
    ) {
      let onChangeValues = {
        min,
        max,
        step,
        dataType: dataType.value,
        outputFormat,
        rangeMode,
      };
      if (rangeMode) {
        if (initialRange[0] == null || initialRange[1] == null) {
          onChange(null);
          return;
        }
        onChangeValues.initialRange = initialRange;
      } else {
        if (initialValue == null) {
          onChange(null);
          return;
        }
        onChangeValues.initialValue = initialValue;
      }
      if (dataType.value === "Date") {
        onChangeValues.dateTimeDelta = dateTimeDelta.value;
      }
      onChange(onChangeValues);
    }
    // eslint-disable-next-line
  }, [
    min,
    max,
    step,
    initialValue,
    initialRange,
    rangeMode,
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
    } else {
      newValue = e;
    }
    setMin(newValue);
  };

  const onMaxChange = (e) => {
    let newValue;
    if (isNumber) {
      newValue = Number(e.target.value);
    } else {
      newValue = e;
    }
    setMax(newValue);
  };

  const isNumber = dataType?.value === "Number";
  const isDate = dataType?.value === "Date";
  const dateTimeDeltaOptions = Object.keys(timeDeltas).map((key) => ({
    value: key,
    label: key,
  }));

  return (
    <>
      <DataRadioSelect
        label="Slider Mode"
        radioOptions={[
          { value: false, label: "Single Value" },
          { value: true, label: "Range" },
        ]}
        selectedRadio={rangeMode}
        onChange={(e) => setRangeMode(e.target.value === "true")}
      />
      <DataSelect
        label="Data Type"
        aria-label="Data Type Input"
        selectedOption={dataType}
        onChange={onDataTypeChange}
        options={[
          { value: "Number", label: "Number" },
          { value: "Date", label: "Date" },
        ]}
      />

      {isNumber && (
        <>
          <NormalInput
            label="Minimum"
            value={min}
            type="number"
            onChange={onMinChange}
            divProps={{ style: { marginTop: "1rem" } }}
          />
          <NormalInput
            label="Maximum"
            value={max}
            type="number"
            onChange={onMaxChange}
            divProps={{ style: { marginTop: "1rem" } }}
          />
          <NormalInput
            label="Step"
            value={step}
            type="number"
            onChange={(e) => setStep(Number(e.target.value))}
            divProps={{ style: { marginTop: "1rem" } }}
          />
          {rangeMode ? (
            <>
              <DataSelect
                label="Range Start"
                aria-label="Range Start"
                selectedOption={
                  initialRange[0] != null
                    ? { value: initialRange[0], label: initialRange[0] }
                    : null
                }
                onChange={(selected) =>
                  setInitialRange([selected.value, initialRange[1]])
                }
                options={possibleValues.map((v) => ({ value: v, label: v }))}
                divProps={{ style: { marginTop: "1rem" } }}
              />
              <DataSelect
                label="Range End"
                aria-label="Range End"
                selectedOption={
                  initialRange[1] != null
                    ? { value: initialRange[1], label: initialRange[1] }
                    : null
                }
                onChange={(selected) =>
                  setInitialRange([initialRange[0], selected.value])
                }
                options={possibleValues.map((v) => ({ value: v, label: v }))}
                divProps={{ style: { marginTop: "1rem" } }}
              />
            </>
          ) : (
            <DataSelect
              label="Initial Value"
              aria-label="Initial Value"
              selectedOption={
                initialValue != null
                  ? { value: initialValue, label: initialValue }
                  : null
              }
              onChange={(selected) => setInitialValue(selected.value)}
              options={possibleValues.map((v) => ({ value: v, label: v }))}
              divProps={{ style: { marginTop: "1rem" } }}
            />
          )}
          <NormalInput
            label="Output Format"
            value={outputFormat}
            type="text"
            onChange={(e) => setOutputFormat(e.target.value)}
            placeholder="e.g., {{n}}, {{n:3}}, {{n}}Forecast"
            divProps={{ style: { marginTop: "1rem" } }}
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
            divProps={{ style: { marginTop: "1rem" } }}
          />
          <DatePicker
            label="Maximum"
            value={max}
            type="date-hour"
            onChange={onMaxChange}
            divProps={{ style: { marginTop: "1rem" } }}
          />
          <FlexDiv>
            <NormalInput
              label="Step"
              value={step}
              type="number"
              onChange={(e) => setStep(Number(e.target.value))}
            />
            <TimeDeltaDiv>
              <DataSelect
                aria-label="Time Delta Input"
                selectedOption={dateTimeDelta}
                onChange={setDateTimeDelta}
                options={dateTimeDeltaOptions}
                divProps={{
                  style: {
                    marginBottom: 0,
                    bottom: 0,
                    position: "absolute",
                  },
                }}
              />
            </TimeDeltaDiv>
          </FlexDiv>
          {rangeMode ? (
            <>
              <DataSelect
                label="Range Start"
                aria-label="Range Start"
                selectedOption={
                  initialRange[0] != null
                    ? { value: initialRange[0], label: initialRange[0] }
                    : null
                }
                onChange={(selected) =>
                  setInitialRange([selected.value, initialRange[1]])
                }
                options={possibleValues.map((v) => ({ value: v, label: v }))}
                divProps={{ style: { marginTop: "1rem" } }}
              />
              <DataSelect
                label="Range End"
                aria-label="Range End"
                selectedOption={
                  initialRange[1] != null
                    ? { value: initialRange[1], label: initialRange[1] }
                    : null
                }
                onChange={(selected) =>
                  setInitialRange([initialRange[0], selected.value])
                }
                options={possibleValues.map((v) => ({ value: v, label: v }))}
                divProps={{ style: { marginTop: "1rem" } }}
              />
            </>
          ) : (
            <DataSelect
              label="Initial Value"
              aria-label="Initial Value"
              selectedOption={
                initialValue != null
                  ? { value: initialValue, label: initialValue }
                  : null
              }
              onChange={(selected) => setInitialValue(selected.value)}
              options={possibleValues.map((v) => ({ value: v, label: v }))}
              divProps={{ style: { marginTop: "1rem" } }}
            />
          )}
          <NormalInput
            label="Output Format"
            value={outputFormat}
            type="text"
            onChange={(e) => setOutputFormat(e.target.value)}
            placeholder="date-fns format tokens; e.g., MM/dd/yyyy, MM/dd/yyyy'T'HH:mm"
            divProps={{ style: { marginTop: "1rem" } }}
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
    initialValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    initialRange: PropTypes.arrayOf(
      PropTypes.oneOfType([PropTypes.number, PropTypes.string])
    ),
    rangeMode: PropTypes.bool,
    outputFormat: PropTypes.string,
    dateTimeDelta: PropTypes.string, // For slider metadata
  }),
};

export default memo(SliderMetadata);
