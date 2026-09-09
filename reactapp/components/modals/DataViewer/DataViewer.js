import { useState, useRef, useContext } from "react";
import PropTypes from "prop-types";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import styled from "styled-components";
import {
  VariableInputsContext,
  AppContext,
  TabContext,
  GridItemContext,
} from "components/contexts/Contexts";
import { useAppTourContext } from "components/contexts/AppTourContext";
import CustomAlert from "components/dashboard/CustomAlert";
import VisualizationPane from "components/modals/DataViewer/VisualizationPane";
import SettingsPane from "components/modals/DataViewer/SettingsPane";
import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";
import TextEditor from "components/inputs/TextEditor";
import { Visualization } from "components/visualizations/Base";
import MapContextProvider from "components/contexts/MapContext";
import {
  findVisualizationBySource,
  updateObjectWithVariableInputs,
} from "components/visualizations/utilities";
import {
  BUILT_IN_MAP_SOURCE,
  normalizeViewGroupName,
  readViewGroupSettings,
} from "components/map/viewGroup";
import { v4 as uuidv4 } from "uuid";
import { WebsocketContext } from "components/contexts/WebSocketContext";
import "components/modals/wideModal.css";
import "components/modals/DataViewer/DataViewer.css";

const StyledTabContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const PaddedBottomDiv = styled.div`
  padding-bottom: 1rem;
`;

const StyledContainer = styled(Container)`
  height: 75vh;
  max-width: 100%;
`;

const StyledRow = styled(Row)`
  height: 100%;
`;

const StyledCol = styled(Col)`
  border-right: black solid 1px;
`;

const StyledVizCol = styled(Col)`
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  overflow-y: auto;
`;

export function getAllVariableInputNames(args) {
  let variableInputs = {};
  variableInputs.default = args.variable_name;

  const variableMetadata = args["variable_options_source.metadata"];
  if (variableMetadata) {
    const metadataVariables = Object.entries(variableMetadata).filter(
      ([key, _]) => key.toLowerCase().includes("variable"),
    );
    for (const [key, value] of metadataVariables) {
      variableInputs[key] = value;
    }
  }

  return variableInputs;
}

export function updateVariableInputs(
  oldArgs,
  newArgs,
  updatedGridItems,
  variableInputValues,
  setVariableInputValues,
) {
  const oldVariableInputNames = getAllVariableInputNames(oldArgs);
  const newVariableInputNames = getAllVariableInputNames(newArgs);

  // Update all grid items that reference any changed variable name
  for (const gridItem of updatedGridItems) {
    if (gridItem.source !== "Variable Input") {
      const args = JSON.parse(gridItem.args_string);
      let updated = false;
      for (const arg in args) {
        const value = args[arg];
        if (typeof value !== "string") continue;
        for (const [varKey, varName] of Object.entries(oldVariableInputNames)) {
          if (value.includes("${" + varName + "}")) {
            args[arg] = args[arg].replace(
              "${" + varName + "}",
              "${" + newVariableInputNames[varKey] + "}",
            );
            updated = true;
          }
        }
      }
      if (updated) {
        gridItem.args_string = JSON.stringify(args);
      }
    }
  }

  // Update variableInputValues with all new variable
  let oldVariableInputValues = {};
  oldVariableInputValues[oldArgs.variable_name] = oldArgs.initial_value;
  if (typeof oldArgs.initial_value === "object") {
    oldVariableInputValues = {
      ...oldVariableInputValues,
      ...oldArgs.initial_value,
    };
  }
  for (const varName in oldVariableInputValues) {
    delete variableInputValues[varName];
  }

  let newVariableInputValues = {
    [newArgs.variable_name]: newArgs.initial_value,
  };
  if (typeof newArgs.initial_value === "object") {
    newVariableInputValues = {
      ...newVariableInputValues,
      ...newArgs.initial_value,
    };
  }
  for (const varName in newVariableInputValues) {
    variableInputValues[varName] = newVariableInputValues[varName];
  }
  setVariableInputValues(variableInputValues);

  return updatedGridItems;
}

/**
 * Strip the "this map supplies its group's initial extent" flag out of a
 * stored `map_extent` value, whichever of its historical shapes it arrived in
 * (bare string, `{extent}`, `{extent, variable}`, or the doubly nested
 * `{extent: {extent, ...}}` form).
 *
 * Returns the value it was given when there was no flag to clear, so callers
 * can compare by identity to tell whether anything changed.
 *
 * @param {*} mapExtent the stored map extent value
 * @returns {*} the value with the flag removed, or the original reference
 */
export function clearGroupInitialExtent(mapExtent) {
  if (!mapExtent || typeof mapExtent !== "object" || Array.isArray(mapExtent)) {
    return mapExtent;
  }

  const nested =
    mapExtent.extent &&
    typeof mapExtent.extent === "object" &&
    !Array.isArray(mapExtent.extent)
      ? mapExtent.extent
      : null;
  const outerFlagged = "isGroupInitialExtent" in mapExtent;
  const nestedFlagged = nested !== null && "isGroupInitialExtent" in nested;
  if (!outerFlagged && !nestedFlagged) return mapExtent;

  const cleared = { ...mapExtent };
  delete cleared.isGroupInitialExtent;
  if (nestedFlagged) {
    const clearedNested = { ...nested };
    delete clearedNested.isGroupInitialExtent;
    cleared.extent = clearedNested;
  }
  return cleared;
}

/**
 * Clear the group initial-extent flag on one grid item.
 *
 * Only the built-in Map carries a stored extent to flag; a plugin map's extent
 * does not exist until the plugin has run, so it is left alone. A grid item
 * whose args do not parse is left alone too rather than being rewritten.
 *
 * @param {object} gridItem the grid item to clear
 * @returns {object} a new grid item with the flag cleared, or the original
 *   reference when there was nothing to clear
 */
export function clearGridItemGroupInitialExtent(gridItem) {
  if (!gridItem || gridItem.source !== BUILT_IN_MAP_SOURCE) return gridItem;

  let args;
  try {
    args = JSON.parse(gridItem.args_string);
  } catch {
    return gridItem;
  }
  if (!args || typeof args !== "object") return gridItem;

  const mapExtent = clearGroupInitialExtent(args.map_extent);
  if (mapExtent === args.map_extent) return gridItem;

  return {
    ...gridItem,
    args_string: JSON.stringify({ ...args, map_extent: mapExtent }),
  };
}

/**
 * Enforce R28 across the whole dashboard: at most one member of a view group
 * may be flagged as the group's initial extent.
 *
 * The just-saved grid item is the winner, so every other member of the same
 * group -- on any tab, since a group spans tabs -- has its flag cleared. Only
 * the flag is touched; the losing members stay in the group.
 *
 * @param {Array<object>} tabs the complete tab list, already carrying the save
 * @param {string} groupName the saved map's view group name
 * @param {object} savedGridItem the grid item being saved, matched by identity
 * @returns {Array<object>} the tab list, with untouched tabs kept by reference
 */
export function enforceSingleGroupInitialExtent(
  tabs,
  groupName,
  savedGridItem,
) {
  const normalizedGroup = normalizeViewGroupName(groupName);
  if (!normalizedGroup || !Array.isArray(tabs)) return tabs;

  return tabs.map((tab) => {
    const gridItems = Array.isArray(tab?.gridItems) ? tab.gridItems : [];
    let tabChanged = false;

    const updatedGridItems = gridItems.map((gridItem) => {
      if (gridItem === savedGridItem) return gridItem;
      if (!gridItem || gridItem.source !== BUILT_IN_MAP_SOURCE) return gridItem;

      let args;
      try {
        args = JSON.parse(gridItem.args_string);
      } catch {
        return gridItem;
      }
      const settings = readViewGroupSettings(args?.map_extent);
      if (settings.viewGroup !== normalizedGroup || !settings.isInitialExtent) {
        return gridItem;
      }

      const cleared = clearGridItemGroupInitialExtent(gridItem);
      if (cleared !== gridItem) tabChanged = true;
      return cleared;
    });

    return tabChanged ? { ...tab, gridItems: updatedGridItems } : tab;
  });
}

function DataViewerModal({
  showModal,
  handleModalClose,
  setGridItemMessage,
  setShowGridItemMessage,
}) {
  const {
    gridItemSource,
    gridItemArgsString,
    gridItemMetadataString,
    gridItemIndex,
  } = useContext(GridItemContext);
  const { visualizations } = useContext(AppContext);
  const { tabs, getActiveTab, updateTab, updateTabs } = useContext(TabContext);
  // --- Initialization logic for visualization states ---
  let initialSelectedVizTypeOption = findVisualizationBySource(
    visualizations,
    gridItemSource,
  );
  let initialVizArguments = [];
  let initialVizInputsValues = {};
  let initialVariableInputValue = null;
  if (initialSelectedVizTypeOption) {
    const existingArgs = JSON.parse(gridItemArgsString);
    if (gridItemSource === "Variable Input") {
      initialVariableInputValue = existingArgs.initial_value;
    }
    for (let arg in initialSelectedVizTypeOption.args) {
      let vizArgType = initialSelectedVizTypeOption.args[arg];
      let existingArg = existingArgs[arg];
      initialVizArguments.push({
        label: arg,
        name: arg,
        type: vizArgType,
        value: existingArg,
      });
    }
    initialVizInputsValues = existingArgs;
  }

  const [selectedVizTypeOption, setSelectVizTypeOption] = useState(
    initialSelectedVizTypeOption,
  );
  const [vizArguments, setVizArguments] = useState(initialVizArguments);
  const [vizInputsValues, setVizInputsValues] = useState(
    initialVizInputsValues,
  );
  const [variableInputValue, setVariableInputValue, variableInputDateFormats] =
    useState(initialVariableInputValue);
  const [vizMetadata, setVizMetadata] = useState(null);
  const [vizType, setVizType] = useState("unknown");
  const [vizData, setVizData] = useState({});
  const [alertMessage, setAlertMessage] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const { variableInputValues, setVariableInputValues } = useContext(
    VariableInputsContext,
  );
  const [showingSubModal, setShowingSubModal] = useState(false);
  const { setAppTourStep, activeAppTour } = useAppTourContext();
  const { getMessageForRequest } = useContext(WebsocketContext);

  const gridMetadata = JSON.parse(gridItemMetadataString);
  const visualizationRef = useRef();
  const [settings, setSettings] = useState(gridMetadata);
  const [tabKey, setTabKey] = useState("visualization");
  const requestId = useRef(uuidv4());

  function saveChanges(e) {
    e.preventDefault();
    e.stopPropagation();
    setShowAlert(false);
    if (selectedVizTypeOption !== null) {
      let newVariableInputNames = {};
      let oldVariableInputNames = {};
      if (selectedVizTypeOption.source === "Variable Input") {
        newVariableInputNames = Object.values(
          getAllVariableInputNames(vizInputsValues),
        );
        oldVariableInputNames = Object.values(
          getAllVariableInputNames(JSON.parse(gridItemArgsString)),
        );

        // Check for duplicate variable names in newVariableInputNames
        const nameCounts = {};
        for (const name of newVariableInputNames) {
          nameCounts[name] = (nameCounts[name] || 0) + 1;
        }
        const duplicates = Object.entries(nameCounts)
          .filter(([_, count]) => count > 1)
          .map(([name, _]) => name);
        if (duplicates.length > 0) {
          setAlertMessage(
            `Duplicate variable name(s) found: ${duplicates.join(", ")}`,
          );
          setShowAlert(true);
          return;
        }

        const variableInputSource = vizInputsValues.variable_options_source;

        for (const variableInputName of newVariableInputNames) {
          if (
            variableInputName in variableInputValues &&
            !oldVariableInputNames.includes(variableInputName)
          ) {
            setAlertMessage(
              variableInputName + " is already in use for a variable name",
            );
            setShowAlert(true);
            return;
          } else if (
            variableInputValue == null &&
            !["checkbox", "csv-uploader", "slider"].includes(
              variableInputSource,
            )
          ) {
            setAlertMessage("Initial value must be selected in the dropdown");
            setShowAlert(true);
            return;
          }
        }
        vizInputsValues.initial_value = variableInputValue;
      }

      const skipInitialValueCheck = ["slider", "csv-uploader"].includes(
        vizInputsValues.variable_options_source,
      );
      const valuesToValidate = skipInitialValueCheck
        ? Object.entries(vizInputsValues)
            .filter(([key]) => key !== "initial_value")
            .map(([, value]) => value)
        : Object.values(vizInputsValues);
      if (valuesToValidate.every((value) => ![null, ""].includes(value))) {
        const { gridItems, id: activeTabId } = getActiveTab();
        let updatedGridItems = JSON.parse(JSON.stringify(gridItems));
        updatedGridItems[gridItemIndex].source =
          vizMetadata?.source ?? selectedVizTypeOption.source;

        updatedGridItems[gridItemIndex].args_string = JSON.stringify(
          Object.fromEntries(
            Object.entries(vizInputsValues).map(([key, val]) => [
              key,
              val?.value ?? val,
            ]),
          ),
        );

        updatedGridItems[gridItemIndex].metadata_string =
          JSON.stringify(settings);

        if (selectedVizTypeOption.source === "Variable Input") {
          updatedGridItems = updateVariableInputs(
            JSON.parse(gridItemArgsString),
            JSON.parse(updatedGridItems[gridItemIndex].args_string),
            updatedGridItems,
            variableInputValues,
            setVariableInputValues,
          );
        }

        // R28: a view group may only carry one initial-extent flag. The map
        // just saved is the winner, so any other member of the same group --
        // on this tab or any other -- gives its flag up. The whole tab list is
        // committed in one write because `updateTab` rebuilds the dashboard's
        // variable input values from only the tabs it is handed, so naming a
        // second tab would blank every variable input defined elsewhere.
        const savedGridItem = updatedGridItems[gridItemIndex];
        const savedGroup =
          savedGridItem.source === BUILT_IN_MAP_SOURCE
            ? readViewGroupSettings(
                JSON.parse(savedGridItem.args_string).map_extent,
              )
            : null;

        if (savedGroup?.viewGroup && savedGroup.isInitialExtent) {
          const nextTabs = tabs.map((tab) =>
            tab.id === activeTabId
              ? { ...tab, gridItems: updatedGridItems }
              : tab,
          );
          updateTabs(
            enforceSingleGroupInitialExtent(
              nextTabs,
              savedGroup.viewGroup,
              savedGridItem,
            ),
          );
        } else {
          updateTab(activeTabId, { gridItems: updatedGridItems });
        }
        setShowGridItemMessage(true);
        handleModalClose();
      } else {
        setAlertMessage("All arguments must be filled out before saving");
        setShowAlert(true);
      }
    } else {
      setAlertMessage("A visualization must be chosen before saving");
      setShowAlert(true);
    }
  }

  function closeAndSetAppTour() {
    handleModalClose();
    setAppTourStep(23);
  }

  return (
    <MapContextProvider>
      <Modal
        show={showModal}
        onHide={activeAppTour ? closeAndSetAppTour : handleModalClose}
        className="dataviewer"
        dialogClassName="semiWideModalDialog"
        style={showingSubModal && { zIndex: 1050 }}
        aria-label={"DataViewer Modal"}
      >
        <Modal.Header closeButton>
          <Modal.Title className="no-caret">Edit Visualization</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <StyledContainer>
            <StyledRow>
              <StyledCol
                className={
                  "justify-content-center h-100 col-4 dataviewer-inputs"
                }
              >
                <StyledTabContainer>
                  <Tabs
                    activeKey={tabKey}
                    onSelect={(k) => setTabKey(k)}
                    id="visualization-tabs"
                    className="mb-3"
                  >
                    <Tab
                      eventKey="visualization"
                      title="Visualization"
                      aria-label="visualizationTab"
                      className="visualizationTab"
                    >
                      <VisualizationPane
                        gridItemIndex={gridItemIndex}
                        setGridItemMessage={setGridItemMessage}
                        selectedVizTypeOption={selectedVizTypeOption}
                        setSelectVizTypeOption={setSelectVizTypeOption}
                        vizArguments={vizArguments}
                        setVizArguments={setVizArguments}
                        vizType={vizType}
                        setVizType={setVizType}
                        setVizData={setVizData}
                        setVizMetadata={setVizMetadata}
                        vizInputsValues={vizInputsValues}
                        setVizInputsValues={setVizInputsValues}
                        variableInputValue={variableInputValue}
                        setVariableInputValue={setVariableInputValue}
                        settings={settings}
                        setSettings={setSettings}
                        visualizationRef={visualizationRef}
                        setShowingSubModal={setShowingSubModal}
                        requestId={requestId.current}
                      />
                    </Tab>
                    <Tab
                      eventKey="settings"
                      title="Settings"
                      aria-label="settingsTab"
                      className="settingsTab"
                    >
                      <SettingsPane
                        settings={settings}
                        setSettings={setSettings}
                        vizType={vizType}
                        visualizationRef={visualizationRef}
                        vizInputsValues={vizInputsValues}
                      />
                    </Tab>
                  </Tabs>
                </StyledTabContainer>
              </StyledCol>
              <StyledVizCol className={"justify-content-center h-100 col-8"}>
                {selectedVizTypeOption?.value === "Text" ? (
                  <PaddedBottomDiv>
                    <TextEditor
                      textValue={vizInputsValues.text}
                      onChange={(htmlText) =>
                        setVizInputsValues({ text: htmlText })
                      }
                    />
                  </PaddedBottomDiv>
                ) : (
                  <Visualization
                    vizRef={visualizationRef}
                    vizType={vizType}
                    vizData={vizData}
                    dataviewerViz={true}
                    vizMetadata={updateObjectWithVariableInputs({
                      args: settings,
                      variableInputs: variableInputValues,
                      variableInputDateFormats,
                    })}
                    progressMessage={getMessageForRequest(requestId.current)}
                  />
                )}
              </StyledVizCol>
            </StyledRow>
          </StyledContainer>
        </Modal.Body>
        <Modal.Footer>
          <CustomAlert
            alertType={"warning"}
            showAlert={showAlert}
            setShowAlert={setShowAlert}
            alertMessage={alertMessage}
          />
          <Button
            variant="secondary"
            onClick={activeAppTour ? closeAndSetAppTour : handleModalClose}
            aria-label="dataviewer-close-button"
            className="dataviewer-close-button"
          >
            Close
          </Button>
          <Button
            variant="success"
            className="dataviewer-save-button"
            aria-label="dataviewer-save-button"
            onClick={activeAppTour ? () => {} : saveChanges}
          >
            Save
          </Button>
        </Modal.Footer>
      </Modal>
    </MapContextProvider>
  );
}

DataViewerModal.propTypes = {
  setGridItemMessage: PropTypes.func,
  setShowGridItemMessage: PropTypes.func,
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
};

export default DataViewerModal;
