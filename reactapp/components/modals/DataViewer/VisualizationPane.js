import {
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
  useMemo,
  memo,
} from "react";
import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import styled from "styled-components";
import DataInput from "components/inputs/DataInput";
import {
  getVisualization,
  findSelectOptionByValue,
  pendingSecretArgs,
  secretArgNames,
  SECRET_ARG_TYPE,
} from "components/visualizations/utilities";
import {
  AppContext,
  GridItemContext,
  LayoutContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import {
  ARGS_SETTLE_MS,
  argsAsSaved,
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

export const VisualizationArguments = ({
  selectedVizTypeOption,
  vizArguments,
  vizInputsValues,
  handleInputChange,
  setShowingSubModal,
  gridItemIndex,
  visualizationRef,
  secretPlace,
}) => {
  const renderInput = useCallback(
    (obj, key) => {
      let vizArgType = obj.type;
      let value = vizInputsValues?.[key] ?? getInitialInputValue(vizArgType);
      if (vizArgType === "checkbox") {
        vizArgType = [
          { label: "True", value: true },
          { label: "False", value: false },
        ];
      }

      if (Array.isArray(vizArgType) && typeof value !== "object") {
        const selectionValue = findSelectOptionByValue(vizArgType, value);
        if (selectionValue) {
          value = selectionValue;
        }
      }

      const optional = selectedVizTypeOption?.optional_args?.includes(key);
      return (
        <DataInput
          key={key}
          label={`${spaceAndCapitalize(obj.label)}${optional ? " (optional)" : ""}`}
          type={vizArgType}
          value={value}
          onChange={handleInputChange(key)}
          inputProps={{
            gridItemIndex,
            setShowingSubModal,
            visualizationRef,
            // Only the layer list needs a sibling argument: a Linked Extents
            // layer reads the map's group name off its extent setting.
            ...(vizArgType === "custom-AddMapLayer" && {
              mapExtent: vizInputsValues?.map_extent,
            }),
            // A secret names where it is kept: the tile, or the dynamic layer
            // within it, its plugin, and the arg.
            ...(vizArgType === SECRET_ARG_TYPE && {
              secretPlace: { ...secretPlace, arg: key },
            }),
          }}
        />
      );
    },
    [
      selectedVizTypeOption,
      vizInputsValues,
      handleInputChange,
      gridItemIndex,
      setShowingSubModal,
      visualizationRef,
      secretPlace,
    ],
  );

  const renderArgs = useCallback(
    (obj, parentKey = "") => {
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
            selectedValue.sub_args,
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
    },
    [vizInputsValues, renderInput],
  );

  if (!selectedVizTypeOption || selectedVizTypeOption.value === "Text") {
    return null;
  }

  const VizArgs = vizArguments.flatMap((arg) => renderArgs(arg));
  return VizArgs;
};

const MemoizedVisualizationArguments = memo(
  VisualizationArguments,
  valuesEqual,
);

function VisualizationPane({
  gridItemIndex,
  setGridItemMessage,
  selectedVizTypeOption,
  setSelectVizTypeOption,
  vizArguments,
  setVizArguments,
  setVizType,
  setVizData,
  setVizMetadata,
  vizInputsValues,
  setVizInputsValues,
  variableInputValue,
  setVariableInputValue,
  settings,
  setSettings,
  visualizationRef,
  setShowingSubModal,
  requestId,
}) {
  const [showVisualizationSelectorModal, setShowVisualizationSelectorModal] =
    useState(false);
  const { visualizations } = useContext(AppContext);
  const { variableInputValues, variableInputDateFormats } = useContext(
    VariableInputsContext,
  );
  // The dashboard and the tile being edited, which the preview names. An
  // editor's preview runs the args as typed, saved or not.
  const { uuid: dashboardUUID, pendingSecrets } = useContext(LayoutContext);
  const { gridItemUUID } = useContext(GridItemContext) ?? {};
  // Where this tile's secrets are kept, for its plugin as picked here.
  const secretSource = selectedVizTypeOption?.source;
  const secretPlace = useMemo(
    () => ({ tile: gridItemUUID, layer: "", source: secretSource }),
    [gridItemUUID, secretSource],
  );
  // The secrets entered here and not saved, which the preview runs with. Kept
  // as text too, so the preview reruns only when this tile's own change.
  const previewSecretArgs = pendingSecretArgs(pendingSecrets, secretPlace);
  const previewSecretKey = JSON.stringify(previewSecretArgs);
  const { activeAppTour } = useAppTourContext();
  const currentSelectedVizTypeOption = useRef(selectedVizTypeOption);
  // Ref to track if we've already previewed for this source with empty args
  const loadedEmptyArgsForSource = useRef({});

  const defaultVisualizationOptions = visualizations.find((obj) => {
    return obj.label === "Default";
  });
  const customImageOption = defaultVisualizationOptions.options.find((obj) => {
    return obj.value === "Custom Image";
  });
  // A plugin tile's preview runs the plugin on the server. A built-in tile's
  // does not wait: Text, Variable Input and Map preview in the browser, and
  // Custom Image loads its url as it is typed, as it always has.
  const isPluginTile =
    !!selectedVizTypeOption &&
    !defaultVisualizationOptions.options.some(
      (option) => option.source === selectedVizTypeOption.source,
    );
  // Whether the tile has had its first preview since the editor opened or
  // its plugin changed: that one runs at once, later ones once the args hold
  // still.
  const previewedRef = useRef(false);
  // Previews are numbered, as the map's dynamic layers number their requests
  // (runtimeLayerFetcher's claimGeneration): a reply shows only while its
  // preview is the newest, so a slow one cannot land over a newer one.
  const previewGenerationRef = useRef(0);
  // The args object a picked plugin's reset replaces (the effect on
  // selectedVizTypeOption), which the preview may still see once.
  const argsResetRef = useRef(null);
  // The timer below runs the latest checkAllInputs, not the one of the render
  // that set it.
  const checkAllInputsRef = useRef();
  useEffect(() => {
    checkAllInputsRef.current = checkAllInputs;
  });

  useEffect(() => {
    if (
      selectedVizTypeOption &&
      !valuesEqual(currentSelectedVizTypeOption.current, selectedVizTypeOption)
    ) {
      visualizationRef.current = null;
      setSettings({});
      // Reset the loadedEmptyArgsForSource ref when visualization type changes
      loadedEmptyArgsForSource.current = {};
      previewedRef.current = false;
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
      argsResetRef.current = vizInputsValues;
      setVizInputsValues(updatedVizInputsValues);
      setVizArguments(updatedVizArguments);
      setVizType("unknown");
      setVizData({});
      setVizMetadata(null);
      // Secrets entered for the plugin the tile had are for that plugin
      // only, and not shown for this one. They are kept until the tile is
      // saved with another plugin (see DataViewer), so closing without saving
      // loses none.
      currentSelectedVizTypeOption.current = selectedVizTypeOption;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVizTypeOption]);

  // The preview reruns when its args change. A plugin tile's runs on the
  // server, and a typed arg changes at every keystroke, so after its first
  // preview it waits for the args to hold still for ARGS_SETTLE_MS.
  useEffect(() => {
    // Whatever preview is still on its way is for other values now.
    previewGenerationRef.current += 1;
    // A plugin just picked has its args reset by the effect above. A run
    // that still sees the args the reset replaces, the previous plugin's
    // after a secret change or the dropdown's own first copy, is not this
    // plugin's preview, nor its first. Any other args, the reset's or later
    // ones, preview.
    if (argsResetRef.current) {
      if (vizInputsValues === argsResetRef.current) return undefined;
      argsResetRef.current = null;
    }
    const wait = previewedRef.current && isPluginTile;
    previewedRef.current = true;
    if (!wait) {
      checkAllInputs();
      return undefined;
    }
    const timer = setTimeout(() => checkAllInputsRef.current(), ARGS_SETTLE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vizInputsValues, settings.customMessaging, previewSecretKey]);

  function onDataTypeChange(e) {
    visualizationRef.current = null;
    setSettings({});
    previewedRef.current = false;
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

  const handleInputChange = useCallback(
    (newValue, key) => {
      setVizInputsValues((prev) => {
        return { ...prev, [key]: newValue?.value ?? newValue };
      });
    },
    [setVizInputsValues],
  );

  const createInputChangeHandler = useCallback(
    (key) => (newValue) => handleInputChange(newValue, key),
    [handleInputChange],
  );

  function checkAllInputs() {
    if (selectedVizTypeOption) {
      // slider's initial value comes from the preview, so don't gate on it
      const skipInitialValueCheck = ["slider", "csv-uploader"].includes(
        vizInputsValues.variable_options_source,
      );
      // A secret arg is always blank here; its value is entered apart from
      // the args, and the server answers for one that is missing. An optional
      // arg may be left blank: its plugin gets None for it.
      const secretArgs = secretArgNames(selectedVizTypeOption.args);
      const optionalArgs = selectedVizTypeOption.optional_args ?? [];
      const inputsToCheck = Object.entries(vizInputsValues)
        .filter(
          ([key]) =>
            !(skipInitialValueCheck && key === "initial_value") &&
            !secretArgs.includes(key) &&
            !optionalArgs.includes(key),
        )
        .map(([, value]) => value);
      const allFilled = inputsToCheck.every(
        (value) => !["", null].includes(value),
      );
      const isEmptyArgs =
        Object.keys(vizInputsValues).length === 0 ||
        Object.values(vizInputsValues).every((v) => v === undefined);
      const source = selectedVizTypeOption["source"];
      const alreadyLoadedEmptyArgs = loadedEmptyArgsForSource.current[source];
      if (allFilled) {
        if (isEmptyArgs && !alreadyLoadedEmptyArgs) {
          loadedEmptyArgsForSource.current[source] = true;
        }
        // Pass the current request id to previewVisualization
        previewVisualization();
      } else {
        setVizType("unknown");
        setVizData({});
        setVizMetadata(null);
      }
    }
  }

  async function previewVisualization() {
    const itemData = {
      source: selectedVizTypeOption["source"],
      args: argsAsSaved(vizInputsValues),
    };
    // The args as the dashboard will read them back, before anything below
    // fills them in, for the preview to check and resolve exactly as a tile does.
    const savedArgsString = JSON.stringify(itemData.args);
    const sourceType = selectedVizTypeOption.type;
    const sourceArgs = selectedVizTypeOption?.args;

    setVizMetadata(itemData);
    setGridItemMessage(
      "Cell updated to show " + selectedVizTypeOption["label"],
    );
    if (selectedVizTypeOption.value === "Text") {
      return;
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
        show_label: itemData.args.show_label,
        variable_options_source: itemData.args.variable_options_source,
        metadata: itemData.args["variable_options_source.metadata"],
        onChange: (e) => setVariableInputValue(e),
      });
    } else {
      const updatedGridItemArgs = updateObjectWithVariableInputs({
        args: itemData.args,
        variableInputs: variableInputValues,
        variableInputDateFormats,
      });
      itemData.args = updatedGridItemArgs;
      itemData.requestId = requestId;
      const generation = ++previewGenerationRef.current;
      const isCurrent = () => previewGenerationRef.current === generation;
      await getVisualization({
        // A reply that a newer preview has replaced shows nothing.
        setVizType: (value) => isCurrent() && setVizType(value),
        setVizData: (value) => isCurrent() && setVizData(value),
        sourceType,
        sourceArgs,
        itemData,
        dashboardUUID,
        tileUUID: gridItemUUID,
        argsString: savedArgsString,
        metadataString: JSON.stringify(settings),
        variableInputValues,
        vizLoadingIcon: true,
        variableInputDateFormats,
        secretArgs: previewSecretArgs,
        // A preview runs the tile as configured here, saved or not: only a
        // caller who may edit the dashboard opens this editor.
        allArgs: true,
        optionalArgs: selectedVizTypeOption?.optional_args ?? [],
      });
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
            creatable={false}
          />
        </DropdownDiv>
      </FlexDiv>
      <MemoizedVisualizationArguments
        selectedVizTypeOption={selectedVizTypeOption}
        vizArguments={vizArguments}
        vizInputsValues={vizInputsValues}
        handleInputChange={createInputChangeHandler}
        setShowingSubModal={setShowingSubModal}
        gridItemIndex={gridItemIndex}
        visualizationRef={visualizationRef}
        secretPlace={secretPlace}
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
  // Where the args' secrets are kept: the tile's uuid, the dynamic layer's
  // layerId ("" for the tile's own args) and the plugin source.
  secretPlace: PropTypes.shape({
    tile: PropTypes.string,
    layer: PropTypes.string,
    source: PropTypes.string,
  }),
};

VisualizationPane.propTypes = {
  gridItemIndex: PropTypes.number,
  setGridItemMessage: PropTypes.func,
  selectedVizTypeOption: PropTypes.object,
  setSelectVizTypeOption: PropTypes.func,
  vizArguments: PropTypes.arrayOf(PropTypes.object),
  setVizArguments: PropTypes.func,
  setVizType: PropTypes.func,
  setVizData: PropTypes.func,
  setVizMetadata: PropTypes.func,
  vizInputsValues: PropTypes.object,
  setVizInputsValues: PropTypes.func,
  variableInputValue: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  setVariableInputValue: PropTypes.func,
  settings: PropTypes.object,
  setSettings: PropTypes.func,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
  setShowingSubModal: PropTypes.func,
  requestId: PropTypes.string,
};

export default memo(VisualizationPane);
