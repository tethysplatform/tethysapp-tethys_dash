import { useState, useEffect, useContext } from "react";
import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import styled from "styled-components";
import Image from "components/visualizations/Image";
import DataInput from "components/inputs/DataInput";
import TextEditor from "components/inputs/TextEditor";
import { setVisualization } from "components/visualizations/utilities";
import {
  AppContext,
  UserSettingsContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import {
  getInitialInputValue,
  spaceAndCapitalize,
  valuesEqual,
} from "components/modals/utilities";
import { updateGridItemArgsWithVariableInputs } from "components/visualizations/utilities";
import VariableInput from "components/visualizations/VariableInput";
import TooltipButton from "components/buttons/TooltipButton";
import { BsGear } from "react-icons/bs";
import SelectedVisualizationTypesModal from "components/modals/SelectedVisualizationTypes";
import { useAppTourContext } from "components/contexts/AppTourContext";
import "components/modals/wideModal.css";

const StyledDiv = styled.div`
  height: 90%;
`;

const InLineInputDiv = styled.div`
  display: inline-block;
  width: calc(100% - 3.5em);
`;
const InLineButtonDiv = styled.div`
  display: inline-block;
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
  showVisualizationTypeSettings,
  setShowVisualizationTypeSettings,
}) {
  const { updatedUserSettings } = useContext(UserSettingsContext);
  const [vizOptions, setVizOptions] = useState([]);
  const [selectedGroupName, setSelectedGroupName] = useState(null);
  const { visualizations } = useContext(AppContext);
  const { variableInputValues } = useContext(VariableInputsContext);
  const { activeAppTour } = useAppTourContext();
  const otherVisualizationOptions = visualizations.find((obj) => {
    return obj.label === "Other";
  });
  const customImageOption = otherVisualizationOptions.options.find((obj) => {
    return obj.value === "Custom Image";
  });

  useEffect(() => {
    let vizTypeOptions = JSON.parse(JSON.stringify(visualizations));
    for (let vizOptionGroup of vizTypeOptions) {
      vizOptionGroup.options = vizOptionGroup.options.filter(function (item) {
        return !updatedUserSettings.deselected_visualizations.includes(
          item.label
        );
      });
    }
    setVizOptions(vizTypeOptions);

    if (source) {
      for (let vizOptionGroup of vizTypeOptions) {
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
              if (vizOptionGroupOption.args[arg] === "checkbox") {
                vizOptionGroupOption.args[arg] = [
                  { label: "True", value: true },
                  { label: "False", value: false },
                ];
              }

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
  }, [updatedUserSettings]);

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
      <InLineButtonDiv>
        <TooltipButton
          tooltipPlacement="bottom"
          tooltipText="Visualization Settings"
          aria-label={"visualizationSettingButton"}
          onClick={() => setShowVisualizationTypeSettings(true)}
        >
          <BsGear size="1.5rem" />
        </TooltipButton>
      </InLineButtonDiv>
      <InLineInputDiv>
        <DataSelect
          label="Visualization Type"
          selectedOption={selectedVizTypeOption}
          onChange={onDataTypeChange}
          options={activeAppTour ? [customImageOption] : vizOptions}
          aria-label={"visualizationType"}
          className={"visualizationTypeDropdown"}
        />
      </InLineInputDiv>
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
      {showVisualizationTypeSettings && (
        <SelectedVisualizationTypesModal
          showModal={showVisualizationTypeSettings}
          setShowModal={setShowVisualizationTypeSettings}
        />
      )}
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
  showVisualizationTypeSettings: PropTypes.bool,
  setShowVisualizationTypeSettings: PropTypes.func,
};

export default VisualizationPane;
