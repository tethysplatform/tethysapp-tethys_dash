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
import {
  parseDateMath,
  dateFormat,
  dateHourFormat,
} from "components/inputs/DatePicker";
import { format } from "date-fns";

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
`;

const VariableInput = ({
  variable_name,
  initial_value,
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
    VariableInputsContext
  );

  // Initialize updatedMetadata when metadata or variableInputValues change
  useEffect(() => {
    if (metadata) {
      const newUpdatedMetadata = updateObjectWithVariableInputs(
        { ...metadata },
        variableInputValues
      );
      setUpdatedMetadata(newUpdatedMetadata);
    }
  }, [metadata, variableInputValues]);

  const updateVariableInputs = useCallback(
    (new_value) => {
      if (new_value || new_value === false || new_value === 0) {
        if (["date", "date-hour"].includes(variable_options_source)) {
          const parsedDate = parseDateMath({ value: new_value });
          if (parsedDate) {
            new_value =
              variable_options_source === "date"
                ? format(parsedDate, dateFormat)
                : format(parsedDate, dateHourFormat);
          }
        }
        setVariableInputValues((prevVariableInputValues) => ({
          ...prevVariableInputValues,
          [variable_name]: new_value,
        }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [variable_name, setVariableInputValues]
  );

  useEffect(() => {
    if (variable_options_source) {
      let initialVariableValue = initial_value;
      let variableValue = initialVariableValue;

      // Sets the type to the variable_options_source if not a dropdown
      if (
        nonDropDownVariableInputTypes.some(
          (type) =>
            (typeof type === "string" && type === variable_options_source) ||
            (typeof type === "object" && type.value === variable_options_source)
        ) ||
        Array.isArray(variable_options_source)
      ) {
        setType(variable_options_source);
      } else {
        var selectedArg = visualizationArgs.find((obj) => {
          return obj.label === variable_options_source;
        });
        setType(selectedArg.argOptions);
        initialVariableValue = findSelectOptionByValue(
          selectedArg.argOptions,
          initialVariableValue
        );
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
      setLabel(variable_name);

      if (!inDataViewerMode) {
        updateVariableInputs(variableValue);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variable_name, initial_value, variable_options_source]);

  useEffect(() => {
    let newValue = variableInputValues[variable_name];
    if (Array.isArray(type)) {
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
        type === "csv-uploader"
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
    ]
  );

  function handleInputRefresh() {
    if (!inDataViewerMode) {
      updateVariableInputs(value);
    }
  }

  if (Array.isArray(type) || type === "checkbox") {
    return (
      <StyledDiv>
        <DataInput
          label={label}
          type={type}
          value={value}
          onChange={handleInputChange}
        />
      </StyledDiv>
    );
  } else if (type === "slider") {
    // initialValue or initialRange must be present, rest are required
    const alwaysRequiredKeys = ["step", "min", "max", "dataType"];
    const hasInitialValue = updatedMetadata?.initialValue != null;
    const hasInitialRange = updatedMetadata?.initialRange != null;
    const missingKeys = [];
    if (!updatedMetadata) {
      missingKeys.push(...alwaysRequiredKeys, "initialValue or initialRange");
    } else {
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
          label={label}
          step={updatedMetadata.step}
          min={updatedMetadata.min}
          max={updatedMetadata.max}
          initialValue={updatedMetadata.initialValue}
          initialRange={updatedMetadata.initialRange}
          rangeMode={updatedMetadata.rangeMode}
          outputFormat={updatedMetadata.outputFormat}
          dataType={updatedMetadata.dataType}
          dateTimeDelta={updatedMetadata?.dateTimeDelta}
          onChange={handleInputChange}
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
        <label>
          <b>{label}</b>:
        </label>
        <CSVUploader headers={metadata.headers} onChange={handleInputChange} />
      </StyledDiv>
    );
  } else {
    return (
      <StyledDiv>
        <label>
          <b>{label}</b>:
        </label>
        <FlexDiv>
          <InputDiv>
            <DataInput type={type} value={value} onChange={handleInputChange} />
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
  ]),
  variable_name: PropTypes.string,
  variable_options_source: PropTypes.string, // This is where the name of the source comes in like in the dropdown
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
      PropTypes.oneOfType([PropTypes.number, PropTypes.string])
    ), // For slider metadata
    rangeMode: PropTypes.string, // For slider metadata
    outputFormat: PropTypes.string, // For slider metadata
    dateTimeDelta: PropTypes.string, // For slider metadata
    headers: PropTypes.arrayOf(PropTypes.string), // For CSVUploader metadata
  }),
};

export default memo(VariableInput);
