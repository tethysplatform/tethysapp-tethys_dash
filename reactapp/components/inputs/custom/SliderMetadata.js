import { useState, useEffect, useContext, memo } from "react";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import PropTypes from "prop-types";
import styled from "styled-components";
import NormalInput from "components/inputs/NormalInput";
import DataSelect from "components/inputs/DataSelect";
import DatePicker from "components/inputs/DatePicker";
import DateFormat from "components/inputs/DateFormat";
import DropdownMetadata from "components/inputs/custom/DropdownMetadata";
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

const SpeedOptionWrapper = styled.div`
  margin-bottom: 1rem;
`;

const SpeedOptionContainer = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
`;

const defaultSpeedOptions = [
  { label: "Extra Slow", value: 2000 },
  { label: "Slow", value: 1000 },
  { label: "Medium", value: 500 },
  { label: "Fast", value: 250 },
  { label: "Extra Fast", value: 100 },
];

const SliderMetadata = ({ onChange, values }) => {
  const [min, setMin] = useState(values?.min ?? null);
  const [max, setMax] = useState(values?.max ?? null);
  const [step, setStep] = useState(values?.step ?? null);
  const [outputFormat, setOutputFormat] = useState(values?.outputFormat ?? "");
  const [rangeMode, setRangeMode] = useState(values?.rangeMode ?? false);
  const [initialValue, setInitialValue] = useState(
    values?.initialValue ?? null,
  );
  const [initialRange, setInitialRange] = useState(
    values?.initialRange ?? [null, null],
  );
  const [dataType, setDataType] = useState(
    values?.dataType
      ? { value: values.dataType, label: values.dataType }
      : null,
  );
  const [dateTimeDelta, setDateTimeDelta] = useState(
    values?.dateTimeDelta
      ? { value: values.dateTimeDelta, label: values.dateTimeDelta }
      : { value: "Days", label: "Days" },
  );
  const [alignSteps, setAlignSteps] = useState(values?.alignSteps ?? false);
  const [alignOffset, setAlignOffset] = useState(values?.alignOffset ?? 0);
  const [speedOptions, setSpeedOptions] = useState(
    values?.speedOptions || defaultSpeedOptions.map((opt) => opt.value),
  );
  const [arrayChoices, setArrayChoices] = useState(
    Array.isArray(values?.values)
      ? values.values.map((v, i) => ({
          label: Array.isArray(values?.labels) ? (values.labels[i] ?? v) : v,
          value: v,
        }))
      : [],
  );
  const { variableInputValues } = useContext(VariableInputsContext);

  const possibleValues =
    min != null && max != null && step != null && dataType
      ? calculateSliderValues(
          updateObjectWithVariableInputs({
            args: {
              min,
              max,
              step,
              unit: dateTimeDelta?.value,
              dataType: dataType?.value,
              alignSteps,
              alignOffset,
            },
            variableInputs: variableInputValues,
          }),
        )
      : [];

  useEffect(() => {
    if (dataType?.value === "Array") {
      // Array mode: require non-empty choices
      if (arrayChoices.length === 0) {
        onChange(null);
        return;
      }
      onChange({
        dataType: "Array",
        values: arrayChoices.map((c) => c.value),
        labels: arrayChoices.map((c) => c.label),
        speedOptions,
      });
      return;
    }

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
        speedOptions,
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
        if (alignSteps) {
          onChangeValues.alignSteps = alignSteps;
          onChangeValues.alignOffset = alignOffset;
        }
      }
      onChange(onChangeValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    speedOptions,
    arrayChoices,
    alignSteps,
    alignOffset,
  ]);

  const handleSpeedOptionsChange = (e) => {
    const { value, checked } = e.target;
    setSpeedOptions((prev) => {
      let updated;
      if (checked) {
        updated = [...prev, Number(value)];
      } else {
        updated = prev.filter((v) => v !== Number(value));
      }
      // Sort from most to least
      return updated.sort((a, b) => b - a);
    });
  };

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
  const isArrayType = dataType?.value === "Array";
  const dateTimeDeltaOptions = Object.keys(timeDeltas).map((key) => ({
    value: key,
    label: key,
  }));

  return (
    <>
      <SpeedOptionWrapper>
        <label>
          <b>Speed Options</b>:
        </label>
        <SpeedOptionContainer>
          {defaultSpeedOptions.map((opt) => (
            <label
              key={opt.value}
              style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
            >
              <input
                type="checkbox"
                value={opt.value}
                checked={speedOptions.includes(opt.value)}
                onChange={handleSpeedOptionsChange}
              />
              {opt.label} ({opt.value / 1000}s)
            </label>
          ))}
        </SpeedOptionContainer>
      </SpeedOptionWrapper>
      {!isArrayType && (
        <DataRadioSelect
          label="Slider Mode"
          radioOptions={[
            { value: false, label: "Single Value" },
            { value: true, label: "Range" },
          ]}
          selectedRadio={rangeMode}
          onChange={setRangeMode}
        />
      )}
      <DataSelect
        label="Data Type"
        aria-label="Data Type Input"
        selectedOption={dataType}
        onChange={onDataTypeChange}
        options={[
          { value: "Number", label: "Number" },
          { value: "Date", label: "Date" },
          { value: "Array", label: "Array" },
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
            onChange={onMinChange}
            divProps={{ style: { marginTop: "1rem" } }}
          />
          <DatePicker
            label="Maximum"
            value={max}
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
          <div style={{ marginTop: "1rem" }}>
            <label
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <input
                type="checkbox"
                checked={alignSteps}
                onChange={(e) => setAlignSteps(e.target.checked)}
                aria-label="Align steps to time boundaries"
              />
              <b>Align steps to time boundaries</b>
            </label>
          </div>
          {alignSteps && (
            <NormalInput
              label={`Offset (${dateTimeDelta.value})`}
              value={alignOffset}
              type="number"
              onChange={(e) => setAlignOffset(Number(e.target.value))}
              divProps={{ style: { marginTop: "0.5rem" } }}
            />
          )}
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
          <DateFormat
            value={outputFormat}
            onChange={setOutputFormat}
            divProps={{ style: { marginTop: "1rem" } }}
          />
        </>
      )}
      {isArrayType && (
        <div style={{ marginTop: "1rem" }}>
          <DropdownMetadata
            onChange={(meta) => setArrayChoices(meta.choices)}
            values={{ choices: arrayChoices }}
          />
        </div>
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
      PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    ),
    rangeMode: PropTypes.bool,
    outputFormat: PropTypes.string,
    dateTimeDelta: PropTypes.string, // For slider metadata
    alignSteps: PropTypes.bool,
    alignOffset: PropTypes.number,
    speedOptions: PropTypes.arrayOf(PropTypes.number),
    values: PropTypes.arrayOf(PropTypes.string),
    labels: PropTypes.arrayOf(PropTypes.string),
  }),
};

export default memo(SliderMetadata);
