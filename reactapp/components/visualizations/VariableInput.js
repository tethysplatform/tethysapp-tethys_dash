import { useCallback, useEffect, useState, useContext, memo } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import DataInput from "components/inputs/DataInput";
import {
  AppContext,
  VariableInputsContext,
  DataViewerModeContext,
} from "components/contexts/Contexts";
import {
  nonDropDownVariableInputTypes,
  findSelectOptionByValue,
  updateObjectWithVariableInputs,
} from "components/visualizations/utilities";
import TooltipButton from "components/buttons/TooltipButton";
import { BsArrowClockwise } from "react-icons/bs";
import Slider from "components/inputs/Slider";
import CSVUploader from "components/inputs/CSVUploader";
import { valuesEqual } from "components/modals/utilities";
import { parseDate } from "components/inputs/dateUtils";
import DataSelect from "components/inputs/DataSelect";

const StyledDiv = styled.div`
  padding: 1rem;
  width: 100%;
`;

const InputDiv = styled.div`
  flex: 1;
`;

const ButtonDiv = styled.div`
  margin-bottom: 1rem;
`;

const FlexDiv = styled.div`
  display: flex;
  width: 100%;
  align-items: flex-end;
`;

const VariableInput = ({
  variable_name,
  initial_value,
  show_label = true,
  variable_options_source,
  metadata,
  onChange,
}) => {
  const [value, setValue] = useState("");
  const [type, setType] = useState(null);
  const [label, setLabel] = useState(null);
  const [updatedMetadata, setUpdatedMetadata] = useState(metadata);
  const { visualizationArgs } = useContext(AppContext);
  const { inDataViewerMode } = useContext(DataViewerModeContext);
  const { variableInputValues, setVariableInputValues } = useContext(
    VariableInputsContext,
  );

  // Initialize updatedMetadata when metadata or variableInputValues change
  useEffect(() => {
    if (metadata) {
      const newUpdatedMetadata = updateObjectWithVariableInputs({
        args: { ...metadata },
        variableInputs: variableInputValues,
      });
      setUpdatedMetadata(newUpdatedMetadata);
    }
  }, [metadata, variableInputValues]);

  const updateVariableInputs = useCallback(
    (new_value) => {
      if (new_value || new_value === false || new_value === 0) {
        setVariableInputValues((prevVariableInputValues) => {
          let newVariableValues = { [variable_name]: new_value };
          if (typeof new_value === "object") {
            newVariableValues = { ...newVariableValues, ...new_value };
          }
          return {
            ...prevVariableInputValues,
            ...newVariableValues,
          };
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [variable_name, setVariableInputValues],
  );

  useEffect(() => {
    setLabel(variable_name);
    if (variable_options_source) {
      let initialVariableValue = initial_value;
      let variableValue = initialVariableValue;

      // Sets the type to the variable_options_source if not a dropdown
      if (
        nonDropDownVariableInputTypes.some(
          (type) =>
            (typeof type === "string" && type === variable_options_source) ||
            (typeof type === "object" &&
              type.value === variable_options_source),
        ) ||
        Array.isArray(variable_options_source)
      ) {
        setType(variable_options_source);
      } else {
        const selectedArg = visualizationArgs.find((obj) => {
          return obj.label === variable_options_source;
        });
        if (selectedArg) {
          setType(selectedArg.argOptions);
          initialVariableValue = findSelectOptionByValue(
            selectedArg.argOptions,
            initialVariableValue,
          );
        } else {
          setType([]);
        }
      }

      if (variable_options_source === "number") {
        // If the variable_options_source is a number, it parses the int value from initial_value
        initialVariableValue = parseInt(initial_value);
        variableValue = initialVariableValue;
      } else if (
        variable_options_source === "checkbox" &&
        initial_value === null
      ) {
        // This sets to false because null isn't a valid value for a checkbox
        // But I've never been able to get this to fire.
        initialVariableValue = false;
        variableValue = initialVariableValue;
      }
      setValue(initialVariableValue);

      if (!inDataViewerMode) {
        updateVariableInputs(variableValue);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variable_name, initial_value, variable_options_source]);

  useEffect(() => {
    let newValue = variableInputValues[variable_name];
    if (Array.isArray(type) && type.length > 0) {
      newValue = findSelectOptionByValue(type, newValue);
    }
    if (newValue && value !== newValue) {
      setValue(newValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variableInputValues]);

  const handleInputChange = useCallback(
    (e) => {
      let inputValue = e;
      if (variable_options_source === "number") {
        inputValue = parseInt(e);
      }
      setValue(inputValue);
      onChange(inputValue);

      if (
        Array.isArray(type) ||
        type === "checkbox" ||
        type === "slider" ||
        type === "csv-uploader" ||
        type === "dropdown"
      ) {
        if (!inDataViewerMode) {
          updateVariableInputs(e.value ?? e);
        }
      }
    },
    [
      variable_options_source,
      onChange,
      type,
      inDataViewerMode,
      updateVariableInputs,
    ],
  );

  function handleInputRefresh() {
    if (!inDataViewerMode) {
      updateVariableInputs(value);
    }
  }

  function displayDateOuput() {
    const parsedDate = parseDate(
      value?.startDate || value,
      updatedMetadata?.format,
      true,
    );
    if (!parsedDate) {
      return "Invalid date format";
    }
    return parsedDate;
  }

  if (Array.isArray(type) || type === "checkbox") {
    return (
      <StyledDiv>
        <DataInput
          label={show_label ? label : ""}
          type={type}
          value={value}
          onChange={handleInputChange}
        />
      </StyledDiv>
    );
  } else if (type === "slider") {
    const isArrayMode = updatedMetadata?.dataType === "Array";
    const missingKeys = [];

    if (!updatedMetadata) {
      missingKeys.push("dataType");
    } else if (isArrayMode) {
      // Array mode requires a values array
      if (!Array.isArray(updatedMetadata.values)) missingKeys.push("values");
    } else {
      // Number/Date mode: original validation
      const alwaysRequiredKeys = ["step", "min", "max", "dataType"];
      const hasInitialValue = updatedMetadata?.initialValue != null;
      const hasInitialRange = updatedMetadata?.initialRange != null;
      alwaysRequiredKeys.forEach((key) => {
        if (updatedMetadata[key] == null) missingKeys.push(key);
      });
      if (!hasInitialValue && !hasInitialRange) {
        missingKeys.push("initialValue or initialRange");
      }
    }
    if (missingKeys.length > 0) {
      return <div data-testid="slider-missing-metadata" />;
    }

    return (
      <StyledDiv>
        <Slider
          variable_name={variable_name}
          label={show_label ? label : ""}
          step={updatedMetadata.step}
          min={updatedMetadata.min}
          max={updatedMetadata.max}
          initialValue={updatedMetadata.initialValue}
          initialRange={updatedMetadata.initialRange}
          rangeMode={isArrayMode ? false : updatedMetadata.rangeMode}
          outputFormat={updatedMetadata.outputFormat}
          dataType={updatedMetadata.dataType}
          dateTimeDelta={updatedMetadata?.dateTimeDelta}
          values={updatedMetadata.values}
          labels={updatedMetadata.labels}
          speeds={
            Array.isArray(updatedMetadata?.speedOptions)
              ? updatedMetadata.speedOptions.map((v) => {
                  // Map value to label
                  if (v === 2000) return { label: "Extra Slow", value: 2000 };
                  if (v === 1000) return { label: "Slow", value: 1000 };
                  if (v === 500) return { label: "Medium", value: 500 };
                  if (v === 250) return { label: "Fast", value: 250 };
                  if (v === 100) return { label: "Extra Fast", value: 100 };
                  return { label: `${v}ms`, value: v };
                })
              : undefined
          }
          onChange={handleInputChange}
        />
      </StyledDiv>
    );
  } else if (type === "dropdown") {
    return (
      <StyledDiv>
        <DataSelect
          label={show_label ? label : ""}
          selectedOption={findSelectOptionByValue(
            updatedMetadata?.choices || [],
            value,
          )}
          onChange={(option) => handleInputChange(option?.value)}
          options={updatedMetadata?.choices || []}
          creatable={true}
        />
      </StyledDiv>
    );
  } else if (type === "csv-uploader") {
    const requiredKeys = ["headers"];
    const missingKeys = requiredKeys.filter((key) => metadata?.[key] == null);

    if (!metadata || missingKeys.length > 0) {
      return (
        <div data-testid="csvuploader-missing-metadata">
          Missing required metadata: {missingKeys}
        </div>
      );
    }
    return (
      <StyledDiv>
        {show_label && (
          <label>
            <b>{label}</b>:
          </label>
        )}
        <CSVUploader headers={metadata.headers} onChange={handleInputChange} />
      </StyledDiv>
    );
  } else {
    return (
      <StyledDiv>
        {type !== "date-range" && show_label && (
          <label>
            <b>{label}</b>:
          </label>
        )}
        <FlexDiv>
          <InputDiv>
            <DataInput
              type={type}
              value={value}
              onChange={handleInputChange}
              inputProps={updatedMetadata}
            />
            {inDataViewerMode && type && type.includes("date") && (
              <div style={{ marginTop: "1rem" }}>
                <label>
                  <b>Example Date Output</b>:
                </label>{" "}
                <span aria-label="Example Date Output Span">
                  {displayDateOuput()}
                </span>
              </div>
            )}
          </InputDiv>
          <ButtonDiv>
            <TooltipButton
              onClick={handleInputRefresh}
              tooltipPlacement={"left"}
              tooltipText={"Refresh variable input"}
              variant={"warning"}
              style={{ height: "100%" }}
              aria-label={"Refresh variable input"}
            >
              <BsArrowClockwise />
            </TooltipButton>
          </ButtonDiv>
        </FlexDiv>
      </StyledDiv>
    );
  }
};

VariableInput.propTypes = {
  initial_value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.bool,
    PropTypes.number,
    PropTypes.object,
    PropTypes.array,
  ]),
  show_label: PropTypes.bool,
  variable_name: PropTypes.string,
  variable_options_source: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(
      PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.shape({ label: PropTypes.string, value: PropTypes.any }),
      ]),
    ),
  ]), // This is where the name of the source comes in like in the dropdown
  onChange: PropTypes.func,
  metadata: PropTypes.shape({
    min: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string,
      PropTypes.instanceOf(Date),
    ]), // For slider metadata
    max: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string,
      PropTypes.instanceOf(Date),
    ]), // For slider metadata
    step: PropTypes.number, // For slider metadata
    dataType: PropTypes.string, // For slider metadata
    initialValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), // For slider metadata
    initialRange: PropTypes.arrayOf(
      PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    ), // For slider metadata
    rangeMode: PropTypes.bool, // For slider metadata
    outputFormat: PropTypes.string, // For slider metadata
    dateTimeDelta: PropTypes.string, // For slider metadata
    headers: PropTypes.arrayOf(PropTypes.string), // For CSVUploader metadata
  }),
};

// Custom comparison that ignores context changes that don't affect VariableInput
const arePropsEqual = (prevProps, nextProps) => {
  // Only check the props that actually affect VariableInput rendering
  const relevantKeys = [
    "variable_name",
    "show_label",
    "initial_value",
    "variable_options_source",
    "metadata",
  ];
  return relevantKeys.every((key) =>
    valuesEqual(prevProps[key], nextProps[key]),
  );
};

export default memo(VariableInput, arePropsEqual);
