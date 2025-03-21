import { useState, useEffect, useContext } from "react";
import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import styled from "styled-components";
import Image from "components/visualizations/Image";
import DataInput from "components/inputs/DataInput";
import TextEditor from "components/inputs/TextEditor";
import MapVisualization from "components/visualizations/Map";
import { setVisualization } from "components/visualizations/utilities";
import {
  AppContext,
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
import { CiFilter } from "react-icons/ci";
import SelectedVisualizationTypesModal from "components/modals/SelectedVisualizationTypes";
import { useAppTourContext } from "components/contexts/AppTourContext";
import "components/modals/wideModal.css";

const StyledDiv = styled.div`
  padding-bottom: 1rem;
`;

const DropdownDiv = styled.div`
  flex: 1;
  margin-right: 1rem;
`;

const ButtonDiv = styled.div`
  margin-bottom: 1rem;
`;

const FlexDiv = styled.div`
  display: flex;
  width: 100%;
`;

const VisualizationArguments = ({
  selectedVizTypeOption,
  vizInputsValues,
  handleInputChange,
  setShowingSubModal,
  gridItemIndex,
}) => {
  if (!selectedVizTypeOption || selectedVizTypeOption["value"] === "Text") {
    return null;
  }

  const VizArgs = [];
  vizInputsValues.forEach((obj, index) => {
    VizArgs.push(
      <DataInput
        key={index}
        objValue={obj}
        onChange={handleInputChange}
        index={index}
        inputProps={{ gridItemIndex, setShowingSubModal }}
      />
    );
  });

  return VizArgs;
};

function VisualizationPane({
  gridItemIndex,
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
  setShowingSubModal,
}) {
  const [deselectedVisualizations, setDeselectedVisualizations] = useState(
    localStorage.getItem("deselected_visualizations")?.split(",") || []
  );
  const [vizOptions, setVizOptions] = useState([]);
  const [selectedGroupName, setSelectedGroupName] = useState(null);
  const [
    showVisualizationTypeSettingsModal,
    setShowVisualizationTypeSettingsModal,
  ] = useState(false);
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
    localStorage.setItem("deselected_visualizations", deselectedVisualizations);
    let vizTypeOptions = JSON.parse(JSON.stringify(visualizations));
    for (let vizOptionGroup of vizTypeOptions) {
      vizOptionGroup.options = vizOptionGroup.options.filter(function (item) {
        return !deselectedVisualizations.includes(item.label);
      });
    }
    setVizOptions(vizTypeOptions);

    if (source) {
      for (let vizOptionGroup of visualizations) {
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
              let vizArgType = vizOptionGroupOption.args[arg];
              let existingArg = existingArgs[arg];
              if (vizArgType === "checkbox") {
                vizArgType = [
                  { label: "True", value: true },
                  { label: "False", value: false },
                ];
                existingArg = existingArg
                  ? { label: "True", value: true }
                  : { label: "False", value: false };
              }

              const userInputsValue = {
                label: spaceAndCapitalize(arg),
                name: arg,
                type: vizArgType,
                value: existingArg,
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
  }, [deselectedVisualizations]);

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
      args: JSON.parse(argsString), // initialize with initial values for some vizualization like Map where additional args are used that dont have options
    };

    // Loop through each visualization input and overwrite initial values
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
          itemData.args.initial_value = "0";
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
      if (selectedVizTypeOption["value"] === "Map") {
        setViz(
          <MapVisualization
            visualizationRef={visualizationRef}
            baseMap={updatedGridItemArgs["base_map"]}
            layers={updatedGridItemArgs["additional_layers"]}
            layerControl={updatedGridItemArgs["show_layer_controls"]}
            viewConfig={updatedGridItemArgs["initial_view"]}
          />
        );
      } else {
        itemData.args = updatedGridItemArgs;
        setVisualization(setViz, itemData, visualizationRef);
      }
    }
  }

  return (
    <>
      <label>
        <b>Visualization Type</b>:
      </label>
      <FlexDiv>
        <ButtonDiv>
          <TooltipButton
            tooltipPlacement="bottom"
            tooltipText="Visualization Settings"
            aria-label={"visualizationSettingButton"}
            onClick={
              activeAppTour
                ? () => {}
                : () => {
                    setShowVisualizationTypeSettingsModal(true);
                    setShowingSubModal(true);
                  }
            }
            className={"filterButton"}
            style={{ height: "100%" }}
          >
            <CiFilter size="1.5rem" />
          </TooltipButton>
        </ButtonDiv>
        <DropdownDiv>
          <DataSelect
            selectedOption={selectedVizTypeOption}
            onChange={onDataTypeChange}
            options={activeAppTour ? [customImageOption] : vizOptions}
            aria-label={"visualizationType"}
            className={"visualizationTypeDropdown"}
          />
        </DropdownDiv>
      </FlexDiv>
      <VisualizationArguments
        selectedVizTypeOption={selectedVizTypeOption}
        vizInputsValues={vizInputsValues}
        handleInputChange={handleInputChange}
        setShowingSubModal={setShowingSubModal}
        gridItemIndex={gridItemIndex}
      />
      {showVisualizationTypeSettingsModal && (
        <SelectedVisualizationTypesModal
          showModal={showVisualizationTypeSettingsModal}
          handleModalClose={() => {
            setShowVisualizationTypeSettingsModal(false);
            setShowingSubModal(false);
          }}
          deselectedVisualizations={deselectedVisualizations}
          setDeselectedVisualizations={setDeselectedVisualizations}
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

VisualizationArguments.propTypes = {
  selectedVizTypeOption: PropTypes.object,
  vizInputsValues: PropTypes.array,
  handleInputChange: PropTypes.func,
  setShowingSubModal: PropTypes.func,
  gridItemIndex: PropTypes.number,
};

VisualizationPane.propTypes = {
  gridItemIndex: PropTypes.number,
  source: PropTypes.string,
  argsString: PropTypes.string,
  setGridItemMessage: PropTypes.func,
  selectedVizTypeOption: PropTypes.object,
  setSelectVizTypeOption: PropTypes.func,
  setViz: PropTypes.func,
  setVizMetadata: PropTypes.func,
  vizInputsValues: PropTypes.array,
  setVizInputsValues: PropTypes.func,
  variableInputValue: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  setVariableInputValue: PropTypes.func,
  settingsRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
  setShowingSubModal: PropTypes.func,
};

export default VisualizationPane;
