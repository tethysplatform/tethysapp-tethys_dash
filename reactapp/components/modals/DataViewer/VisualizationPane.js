import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import styled from "styled-components";
import Image from "components/visualizations/Image";
import DataInput from "components/inputs/DataInput";
import TextEditor from "components/inputs/TextEditor";
import { setVisualization } from "components/visualizations/utilities";
import { useAvailableVisualizationsContext } from "components/contexts/AvailableVisualizationsContext";
import { useVariableInputValuesContext } from "components/contexts/VariableInputsContext";
import {
  getInitialInputValue,
  spaceAndCapitalize,
  valuesEqual,
} from "components/modals/utilities";
import { updateGridItemArgsWithVariableInputs } from "components/visualizations/utilities";
import VariableInput from "components/visualizations/VariableInput";
import { nonDropDownVariableInputTypes } from "components/visualizations/utilities";
import "components/modals/wideModal.css";

const StyledDiv = styled.div`
  height: 90%;
`;

function VisualizationPane({
  source,
  argsString,
  setGridItemMessage,
  selectedVizTypeOption,
  setSelectVizTypeOption,
  setViz,
  setVizMetadata,
  vizInputsValues,
  setVizInputsValues,
  variableInputValue,
  setVariableInputValue,
  settingsRef,
  visualizationRef,
}) {
  const [vizOptions, setVizOptions] = useState([]);
  const [selectedGroupName, setSelectedGroupName] = useState(null);
  const { availableVisualizations, availableVizArgs } =
    useAvailableVisualizationsContext();
  const { variableInputValues } = useVariableInputValuesContext();

  useEffect(() => {
    let vizOptions = [...availableVisualizations];
    vizOptions.push({
      label: "Other",
      options: [
        {
          source: "Custom Image",
          value: "Custom Image",
          label: "Custom Image",
          args: { image_source: "text" },
        },
        {
          source: "Text",
          value: "Text",
          label: "Text",
          args: { text: "text" },
        },
        {
          source: "Variable Input",
          value: "Variable Input",
          label: "Variable Input",
          args: {
            variable_name: "text",
            variable_options_source: [
              ...nonDropDownVariableInputTypes,
              ...[
                {
                  label: "Existing Visualization Inputs",
                  options: availableVizArgs,
                },
              ],
            ],
          },
        },
      ],
    });

    setVizOptions(vizOptions);
    if (source) {
      for (let vizOptionGroup of vizOptions) {
        for (let vizOptionGroupOption of vizOptionGroup.options) {
          if (vizOptionGroupOption.source === source) {
            setSelectedGroupName(vizOptionGroup.label);
            setSelectVizTypeOption(vizOptionGroupOption);
            let userInputsValues = [];
            const existingArgs = JSON.parse(argsString);
            if (source === "Variable Input") {
              setVariableInputValue(existingArgs.initial_value);
            }

            for (let arg in vizOptionGroupOption.args) {
              const userInputsValue = {
                label: spaceAndCapitalize(arg),
                name: arg,
                type: vizOptionGroupOption.args[arg],
                value: existingArgs[arg],
              };
              userInputsValues.push(userInputsValue);
            }
            setVizInputsValues(userInputsValues);
            break;
          }
        }
      }
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    checkAllInputs();
    // eslint-disable-next-line
  }, [vizInputsValues]);

  function handleInputChange(new_value, index) {
    const values = [...vizInputsValues];
    values[index].value = new_value;
    setVizInputsValues(values);
  }

  function onDataTypeChange(e) {
    visualizationRef.current = null;
    settingsRef.current = {};
    for (let p of vizOptions) {
      for (let i of p.options) {
        if (i === e) {
          setSelectedGroupName(p.label);
          break;
        }
      }
    }
    setSelectVizTypeOption(e);

    let userInputsValues = [];
    for (let arg in e.args) {
      let existing = vizInputsValues.filter((obj) => {
        if (obj.name !== arg) {
          return false;
        }
        return valuesEqual(obj.type, e.args[arg]);
      });

      if (e.args[arg] === "checkbox") {
        e.args[arg] = [
          { label: "True", value: true },
          { label: "False", value: false },
        ];
      }
      let inputValue;
      if (existing.length) {
        inputValue = existing[0].value;
      } else {
        inputValue = getInitialInputValue(e.args[arg]);
      }

      userInputsValues.push({
        label: spaceAndCapitalize(arg),
        name: arg,
        type: e.args[arg],
        value: inputValue,
      });
    }
    setVizInputsValues(userInputsValues);
    setViz(null);
    setVizMetadata(null);
  }

  function checkAllInputs() {
    if (selectedVizTypeOption !== null) {
      let inputValues = vizInputsValues.map((value) => value.value);
      if (
        inputValues.every((value) => !["", null].includes(value)) ||
        (selectedVizTypeOption["value"] === "Text" && inputValues[0] === "")
      ) {
        previewVisualization();
      }
    }
  }

  function previewVisualization() {
    const itemData = {
      source: selectedVizTypeOption["source"],
      args: {},
    };
    vizInputsValues.forEach((arg) => {
      if (typeof arg.value.value !== "undefined") {
        itemData["args"][arg.name] = arg.value.value;
      } else {
        itemData["args"][arg.name] = arg.value;
      }
    });
    setVizMetadata(itemData);
    setGridItemMessage(
      "Cell updated to show " +
        selectedGroupName +
        " " +
        selectedVizTypeOption["label"]
    );
    if (selectedVizTypeOption["value"] === "Custom Image") {
      setViz(
        <Image
          source={vizInputsValues[0].value}
          visualizationRef={visualizationRef}
        />
      );
    } else if (selectedVizTypeOption["value"] === "Text") {
      setViz(
        <CustomTextOptions
          objValue={vizInputsValues[0]}
          onChange={handleInputChange}
          index={0}
        />
      );
    } else if (selectedVizTypeOption["value"] === "Variable Input") {
      itemData.args.initial_value = variableInputValue;
      if (itemData.args.initial_value === null) {
        if (itemData.args.variable_options_source === "text") {
          itemData.args.initial_value = "";
        } else if (itemData.args.variable_options_source === "number") {
          itemData.args.initial_value = 0;
        }
      }
      setViz(
        <VariableInput
          args={itemData.args}
          onChange={(e) => setVariableInputValue(e)}
        />
      );
    } else {
      const updatedGridItemArgs = updateGridItemArgsWithVariableInputs(
        JSON.stringify(itemData.args),
        variableInputValues
      );
      itemData.args = updatedGridItemArgs;
      setVisualization(setViz, itemData, visualizationRef);
    }
  }

  return (
    <>
      <DataSelect
        label="Visualization Type"
        selectedOption={selectedVizTypeOption}
        onChange={onDataTypeChange}
        options={vizOptions}
        aria-label={"visualizationType"}
      />
      {selectedVizTypeOption &&
        selectedVizTypeOption["value"] !== "Text" &&
        vizInputsValues.map((obj, index) => (
          <DataInput
            key={index}
            objValue={obj}
            onChange={handleInputChange}
            index={index}
          />
        ))}
    </>
  );
}

export function CustomTextOptions({ objValue, onChange, index }) {
  const textValue = objValue.value;

  return (
    <StyledDiv>
      <TextEditor
        textValue={textValue}
        onChange={(e) => onChange(e.target.value, index)}
      />
    </StyledDiv>
  );
}

CustomTextOptions.propTypes = {
  objValue: PropTypes.object,
  onChange: PropTypes.func,
  index: PropTypes.number,
};

VisualizationPane.propTypes = {
  source: PropTypes.string,
  argsString: PropTypes.string,
  setGridItemMessage: PropTypes.func,
  selectedVizTypeOption: PropTypes.object,
  setSelectVizTypeOption: PropTypes.func,
  setViz: PropTypes.func,
  setVizMetadata: PropTypes.func,
  vizInputsValues: PropTypes.array,
  setVizInputsValues: PropTypes.func,
  variableInputValue: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  setVariableInputValue: PropTypes.func,
  settingsRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

export default VisualizationPane;
