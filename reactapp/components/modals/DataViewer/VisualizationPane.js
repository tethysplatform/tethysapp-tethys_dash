import { useState, useEffect, useContext, useRef } from "react";
import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import styled from "styled-components";
import DataInput from "components/inputs/DataInput";
import {
  getVisualization,
  findSelectOptionByValue,
} from "components/visualizations/utilities";
import {
  AppContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import {
  getInitialInputValue,
  spaceAndCapitalize,
  valuesEqual,
} from "components/modals/utilities";
import { updateObjectWithVariableInputs } from "components/visualizations/utilities";
import TooltipButton from "components/buttons/TooltipButton";
import { BsSearch } from "react-icons/bs";
import VisualizationSelector from "components/modals/DataViewer/VisualizationSelector";
import { useAppTourContext } from "components/contexts/AppTourContext";
import "components/modals/wideModal.css";

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
  vizArguments,
  vizInputsValues,
  handleInputChange,
  setShowingSubModal,
  gridItemIndex,
  visualizationRef,
}) => {
  if (!selectedVizTypeOption || selectedVizTypeOption.value === "Text") {
    return null;
  }

  const renderInput = (obj, key) => {
    let vizArgType = obj.type;
    let value = vizInputsValues?.[key] ?? getInitialInputValue(vizArgType);
    if (vizArgType === "checkbox") {
      vizArgType = [
        { label: "True", value: true },
        { label: "False", value: false },
      ];
      value = value
        ? { label: "True", value: true }
        : { label: "False", value: false };
    }

    if (Array.isArray(vizArgType) && typeof value !== "object") {
      const selectionValue = findSelectOptionByValue(vizArgType, value);
      if (selectionValue) {
        value = selectionValue;
      }
    }

    return (
      <DataInput
        key={key}
        label={spaceAndCapitalize(obj.label)}
        type={vizArgType}
        value={value}
        onChange={(newValue) => handleInputChange(newValue, key)}
        inputProps={{ gridItemIndex, setShowingSubModal, visualizationRef }}
      />
    );
  };

  const renderArgs = (obj, parentKey = "") => {
    const inputs = [];
    const baseKey = parentKey ? `${parentKey}.${obj.name}` : obj.name;

    // Main input
    inputs.push(renderInput(obj, baseKey));

    // If this input has options (i.e., dropdown), check for sub_args
    if (Array.isArray(obj.type)) {
      let selectedValue = vizInputsValues?.[baseKey];
      if (typeof selectedValue !== "object") {
        selectedValue = findSelectOptionByValue(obj.type, selectedValue);
      }

      if (selectedValue?.sub_args) {
        for (const [subName, subOptions] of Object.entries(
          selectedValue.sub_args
        )) {
          const subArgObj = {
            name: subName,
            label: subName,
            type: subOptions,
          };
          inputs.push(...renderArgs(subArgObj, baseKey)); // recursive call
        }
      }
    }

    return inputs;
  };

  const VizArgs = vizArguments.flatMap((arg) => renderArgs(arg));

  return VizArgs;
};

function VisualizationPane({
  gridItemIndex,
  source,
  argsString,
  setGridItemMessage,
  selectedVizTypeOption,
  setSelectVizTypeOption,
  vizType,
  setVizType,
  setVizData,
  setVizMetadata,
  vizInputsValues,
  setVizInputsValues,
  variableInputValue,
  setVariableInputValue,
  settingsRef,
  visualizationRef,
  setShowingSubModal,
}) {
  const [vizArguments, setVizArguments] = useState([]);
  const [showVisualizationSelectorModal, setShowVisualizationSelectorModal] =
    useState(false);
  const { visualizations } = useContext(AppContext);
  const { variableInputValues } = useContext(VariableInputsContext);
  const { activeAppTour } = useAppTourContext();
  const currentSelectedVizTypeOption = useRef(selectedVizTypeOption);

  const defaultVisualizationOptions = visualizations.find((obj) => {
    return obj.label === "Default";
  });
  const customImageOption = defaultVisualizationOptions.options.find((obj) => {
    return obj.value === "Custom Image";
  });

  useEffect(() => {
    if (source) {
      let selectedVizOptionGroupOption = null;
      for (let vizOptionGroup of visualizations) {
        for (let vizOptionGroupOption of vizOptionGroup.options) {
          if (vizOptionGroupOption.source === source) {
            selectedVizOptionGroupOption = vizOptionGroupOption;
            break;
          }
        }
      }

      if (selectedVizOptionGroupOption) {
        setSelectVizTypeOption(selectedVizOptionGroupOption);

        let updatedVizArguments = [];

        const existingArgs = JSON.parse(argsString);
        if (source === "Variable Input") {
          setVariableInputValue(existingArgs.initial_value);
        }

        for (let arg in selectedVizOptionGroupOption.args) {
          let vizArgType = selectedVizOptionGroupOption.args[arg];
          let existingArg = existingArgs[arg];
          updatedVizArguments.push({
            label: arg,
            name: arg,
            type: vizArgType,
            value: existingArg,
          });
        }
        setVizArguments(updatedVizArguments);
        setVizInputsValues(existingArgs);
        currentSelectedVizTypeOption.current = selectedVizOptionGroupOption;
      }
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (
      selectedVizTypeOption &&
      !valuesEqual(currentSelectedVizTypeOption.current, selectedVizTypeOption)
    ) {
      visualizationRef.current = null;
      settingsRef.current = {};

      let updatedVizArguments = [];
      const updatedVizInputsValues = {};
      for (let arg in selectedVizTypeOption.args) {
        let existing = vizArguments.filter((obj) => {
          if (obj.name !== arg) {
            return false;
          }
          return valuesEqual(obj.type, selectedVizTypeOption.args[arg]);
        });

        let inputValue;
        if (existing.length) {
          inputValue = vizInputsValues[arg];
        } else {
          inputValue = getInitialInputValue(selectedVizTypeOption.args[arg]);
        }

        updatedVizArguments.push({
          label: arg,
          name: arg,
          type: selectedVizTypeOption.args[arg],
          value: inputValue,
        });
        updatedVizInputsValues[arg] = inputValue;
      }
      setVizInputsValues(updatedVizInputsValues);
      setVizArguments(updatedVizArguments);
      setVizType("unknown");
      setVizData({});
      setVizMetadata(null);
      currentSelectedVizTypeOption.current = selectedVizTypeOption;
    }
    // eslint-disable-next-line
  }, [selectedVizTypeOption]);

  useEffect(() => {
    checkAllInputs();
    // eslint-disable-next-line
  }, [vizInputsValues]);

  function onDataTypeChange(e) {
    visualizationRef.current = null;
    settingsRef.current = {};
    setSelectVizTypeOption(e);

    let updatedVizArguments = [];
    const updatedVizInputsValues = {};
    for (let arg in e.args) {
      let existing = vizArguments.filter((obj) => {
        if (obj.name !== arg) {
          return false;
        }
        return valuesEqual(obj.type, e.args[arg]);
      });

      let inputValue;
      if (existing.length) {
        inputValue = vizInputsValues[arg];
      } else {
        inputValue = getInitialInputValue(e.args[arg]);
      }

      updatedVizArguments.push({
        label: arg,
        name: arg,
        type: e.args[arg],
        value: inputValue,
      });
      updatedVizInputsValues[arg] = inputValue;
    }
    setVizInputsValues(updatedVizInputsValues);
    setVizArguments(updatedVizArguments);
    setVizType("unknown");
    setVizData({});
    setVizMetadata(null);
  }

  const handleInputChange = (newValue, key) => {
    setVizInputsValues((prev) => {
      return { ...prev, [key]: newValue.value ?? newValue };
    });
  };

  function checkAllInputs() {
    if (selectedVizTypeOption !== null) {
      if (
        Object.values(vizInputsValues).every(
          (value) => !["", null].includes(value)
        )
      ) {
        previewVisualization();
      }
    }
  }

  async function previewVisualization() {
    if (selectedVizTypeOption) {
      const itemData = {
        source: selectedVizTypeOption["source"],
        args: Object.fromEntries(
          Object.entries(vizInputsValues).map(([key, val]) => [
            key,
            val.value ?? val,
          ])
        ),
      };
      const sourceType = selectedVizTypeOption.type;

      setVizMetadata(itemData);
      setGridItemMessage(
        "Cell updated to show " + selectedVizTypeOption["label"]
      );
      if (selectedVizTypeOption.value === "Text") {
        return;
      } else if (selectedVizTypeOption.value === "Custom Image") {
        setVizType("image");
        setVizData({
          source: vizInputsValues.image_source,
        });
      } else if (selectedVizTypeOption.value === "Variable Input") {
        itemData.args.initial_value = variableInputValue;
        if (itemData.args.initial_value === null) {
          if (itemData.args.variable_options_source === "text") {
            itemData.args.initial_value = "";
          } else if (itemData.args.variable_options_source === "number") {
            itemData.args.initial_value = "0";
          }
        }
        setVizType("variableInput");
        setVizData({
          variable_name: itemData.args.variable_name,
          initial_value: itemData.args.initial_value,
          variable_options_source: itemData.args.variable_options_source,
          onChange: (e) => setVariableInputValue(e),
        });
      } else {
        const updatedGridItemArgs = updateObjectWithVariableInputs(
          itemData.args,
          variableInputValues
        );
        if (selectedVizTypeOption.value === "Map") {
          setVizType("map");
          setVizData({
            map_extent: updatedGridItemArgs.map_extent,
            layers: updatedGridItemArgs.layers,
            baseMap: updatedGridItemArgs.baseMap,
            layerControl: updatedGridItemArgs.layerControl,
            mapDrawing: updatedGridItemArgs.mapDrawing,
          });
        } else {
          itemData.args = updatedGridItemArgs;
          await getVisualization({
            setVizType,
            setVizData,
            sourceType,
            itemData,
            metadataString: JSON.stringify(settingsRef.current),
            argsString: vizInputsValues,
            variableInputValues,
          });
        }
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
            tooltipText="Search Visualizations"
            aria-label={"Search Visualization Type Button"}
            onClick={
              activeAppTour
                ? () => {}
                : () => {
                    setShowVisualizationSelectorModal(true);
                    setShowingSubModal(true);
                  }
            }
            style={{ height: "100%" }}
          >
            <BsSearch />
          </TooltipButton>
        </ButtonDiv>
        <DropdownDiv>
          <DataSelect
            selectedOption={selectedVizTypeOption}
            onChange={onDataTypeChange}
            options={activeAppTour ? [customImageOption] : visualizations}
            aria-label={"visualizationType"}
            className={"visualizationTypeDropdown"}
          />
        </DropdownDiv>
      </FlexDiv>
      <VisualizationArguments
        selectedVizTypeOption={selectedVizTypeOption}
        vizArguments={vizArguments}
        vizInputsValues={vizInputsValues}
        handleInputChange={handleInputChange}
        setShowingSubModal={setShowingSubModal}
        gridItemIndex={gridItemIndex}
        visualizationRef={visualizationRef}
      />

      {showVisualizationSelectorModal && (
        <VisualizationSelector
          showModal={showVisualizationSelectorModal}
          handleModalClose={() => {
            setShowVisualizationSelectorModal(false);
            setShowingSubModal(false);
          }}
          setSelectVizTypeOption={setSelectVizTypeOption}
        />
      )}
    </>
  );
}

VisualizationArguments.propTypes = {
  selectedVizTypeOption: PropTypes.object,
  vizArguments: PropTypes.arrayOf(PropTypes.object),
  vizInputsValues: PropTypes.object,
  handleInputChange: PropTypes.func,
  setShowingSubModal: PropTypes.func,
  gridItemIndex: PropTypes.number,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

VisualizationPane.propTypes = {
  gridItemIndex: PropTypes.number,
  source: PropTypes.string,
  argsString: PropTypes.string,
  setGridItemMessage: PropTypes.func,
  selectedVizTypeOption: PropTypes.object,
  setSelectVizTypeOption: PropTypes.func,
  vizType: PropTypes.string,
  setVizType: PropTypes.func,
  setVizData: PropTypes.func,
  setVizMetadata: PropTypes.func,
  vizInputsValues: PropTypes.object,
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
