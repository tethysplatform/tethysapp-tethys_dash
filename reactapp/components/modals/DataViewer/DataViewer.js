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
  const { getActiveTab, updateTab } = useContext(TabContext);
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
            !["checkbox", "csv-uploader"].includes(variableInputSource)
          ) {
            setAlertMessage("Initial value must be selected in the dropdown");
            setShowAlert(true);
            return;
          }
        }
        vizInputsValues.initial_value = variableInputValue;
      }

      if (
        Object.values(vizInputsValues).every(
          (value) => ![null, ""].includes(value),
        ) // TODO for csv-uploader, it's ok if data is empty
      ) {
        const { gridItems, id: activeTabId } = getActiveTab();
        let updatedGridItems = JSON.parse(JSON.stringify(gridItems));
        updatedGridItems[gridItemIndex].source = vizMetadata.source;

        updatedGridItems[gridItemIndex].args_string = JSON.stringify(
          Object.fromEntries(
            Object.entries(vizInputsValues).map(([key, val]) => [
              key,
              val.value ?? val,
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

        updateTab(activeTabId, { gridItems: updatedGridItems });
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
