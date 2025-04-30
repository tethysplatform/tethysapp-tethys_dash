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
import { CiFilter } from "react-icons/ci";
import VisualizationSelector from "components/modals/DataViewer/VisualizationSelector";
import { useAppTourContext } from "components/contexts/AppTourContext";
import { Button } from "react-bootstrap";
import "components/modals/wideModal.css";
import appAPI from "services/api/app";

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

const TitleDiv = styled.div`
  text-align: center;
  margin-top: 0.5rem;
`;

const CenteredDiv = styled.div`
  align-items: center;
  justify-content: center;
  display: flex;
`;

const VisualizationArguments = ({
  selectedVizTypeOption,
  vizArguments,
  vizInputsValues,
  handleInputChange,
  setShowingSubModal,
  gridItemIndex,
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
        inputProps={{ gridItemIndex, setShowingSubModal }}
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
  const [loadingArgs, setLoadingArgs] = useState(false);
  const [vizOptions, setVizOptions] = useState([]);
  const [vizArguments, setVizArguments] = useState([]);
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
  const currentSelectedVizTypeOption = useRef(selectedVizTypeOption);

  const loadVizArgs = async ({ onLoad }) => {
    const apiResponse = await appAPI.getVisualizationArgs({
      vizSource: selectedVizTypeOption.source,
    });
    if (apiResponse.success) {
      let updatedVizArguments = [];
      const updatedVizInputsValues = {};

      for (let arg in apiResponse.args) {
        if (onLoad) {
          const existingArgs = JSON.parse(argsString);
          if (source === "Variable Input") {
            setVariableInputValue(existingArgs.initial_value);
          }

          let vizArgType = apiResponse.args[arg];
          let existingArg = existingArgs[arg];
          updatedVizArguments.push({
            label: arg,
            name: arg,
            type: vizArgType,
            value: existingArg,
          });
        } else {
          let existing = vizArguments.filter((obj) => {
            if (obj.name !== arg) {
              return false;
            }
            return valuesEqual(obj.type, apiResponse.args[arg]);
          });

          let inputValue;
          if (existing.length) {
            inputValue = vizInputsValues[arg];
          } else {
            inputValue = getInitialInputValue(apiResponse.args[arg]);
          }

          updatedVizArguments.push({
            label: arg,
            name: arg,
            type: apiResponse.args[arg],
            value: inputValue,
          });
          updatedVizInputsValues[arg] = inputValue;
        }
      }
      setVizInputsValues(updatedVizInputsValues);
      setVizArguments(updatedVizArguments);
      setVizType("unknown");
      setVizData({});
      setVizMetadata(null);
      setLoadingArgs(false);
    }
  };

  useEffect(() => {
    if (selectedVizTypeOption) {
      loadVizArgs({ onLoad: true });
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    checkAllInputs();
    // eslint-disable-next-line
  }, [vizInputsValues]);

  useEffect(() => {
    if (currentSelectedVizTypeOption.current !== selectedVizTypeOption) {
      setLoadingArgs(true);
      visualizationRef.current = null;
      settingsRef.current = {};

      loadVizArgs();

      // const [visualizationGroup, visualizationLabel] = splitFirstHyphen(
      //   selectedVizTypeOption
      // );
      // setSelectVizTypeOption(e);

      // let updatedVizArguments = [];
      // const updatedVizInputsValues = {};
      // for (let arg in e.args) {
      //   let existing = vizArguments.filter((obj) => {
      //     if (obj.name !== arg) {
      //       return false;
      //     }
      //     return valuesEqual(obj.type, e.args[arg]);
      //   });

      //   let inputValue;
      //   if (existing.length) {
      //     inputValue = vizInputsValues[arg];
      //   } else {
      //     inputValue = getInitialInputValue(e.args[arg]);
      //   }

      //   updatedVizArguments.push({
      //     label: arg,
      //     name: arg,
      //     type: e.args[arg],
      //     value: inputValue,
      //   });
      //   updatedVizInputsValues[arg] = inputValue;
      // }
      // setVizInputsValues(updatedVizInputsValues);
      // setVizArguments(updatedVizArguments);
      // setVizType("loader");
      // setVizData({});
      // setVizMetadata(null);
      currentSelectedVizTypeOption.current = selectedVizTypeOption;
    }
    // eslint-disable-next-line
  }, [selectedVizTypeOption]);

  const handleInputChange = (newValue, key) => {
    setVizInputsValues((prev) => {
      const updated = { ...prev, [key]: newValue.value ?? newValue };

      // Helper to recursively collect valid nested keys from sub_args
      const collectValidKeys = (subArgs, baseKey) => {
        let validKeys = [];
        for (const [subName] of Object.entries(subArgs)) {
          const fullKey = `${baseKey}.${subName}`;
          validKeys.push(fullKey);
        }
        return validKeys;
      };

      // Clean up all nested keys that start with this key and are no longer valid
      const prefix = `${key}.`;

      // Get all valid nested keys based on the new value
      const validKeys = newValue?.sub_args
        ? collectValidKeys(newValue.sub_args, key)
        : [];
      if (validKeys.length > 0) {
        validKeys.forEach((key) => {
          updated[key] = updated[key] ?? null;
        });
      }

      // Remove invalid nested keys
      for (const existingKey in updated) {
        if (
          existingKey.startsWith(prefix) &&
          !validKeys.includes(existingKey)
        ) {
          delete updated[existingKey];
        }
      }

      return updated;
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
    const initialArgs = JSON.parse(argsString);

    const args =
      selectedVizTypeOption.source === "Map" && "viewConfig" in initialArgs
        ? { ...vizInputsValues, viewConfig: initialArgs.viewConfig }
        : vizInputsValues;

    const itemData = {
      source: selectedVizTypeOption["source"],
      args: Object.fromEntries(
        Object.entries(args).map(([key, val]) => [key, val.value ?? val])
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
        JSON.stringify(itemData.args),
        variableInputValues
      );
      if (selectedVizTypeOption.value === "Map") {
        setVizType("map");
        setVizData({
          viewConfig: updatedGridItemArgs.viewConfig,
          layers: updatedGridItemArgs.layers,
          baseMap: updatedGridItemArgs.baseMap,
          layerControl: updatedGridItemArgs.layerControl,
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

  return (
    <>
      <CenteredDiv>
        <Button
          variant="info"
          onClick={
            activeAppTour
              ? () => {}
              : () => {
                  setShowVisualizationTypeSettingsModal(true);
                  setShowingSubModal(true);
                }
          }
        >
          Select Visualization Type
        </Button>
      </CenteredDiv>
      <TitleDiv>
        <h3>{selectedVizTypeOption?.label}</h3>
      </TitleDiv>

      {loadingArgs ? (
        <div>Loading Args</div>
      ) : (
        <VisualizationArguments
          selectedVizTypeOption={selectedVizTypeOption}
          vizArguments={vizArguments}
          vizInputsValues={vizInputsValues}
          handleInputChange={handleInputChange}
          setShowingSubModal={setShowingSubModal}
          gridItemIndex={gridItemIndex}
        />
      )}

      {showVisualizationTypeSettingsModal && (
        <VisualizationSelector
          showModal={showVisualizationTypeSettingsModal}
          handleModalClose={() => {
            setShowVisualizationTypeSettingsModal(false);
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
