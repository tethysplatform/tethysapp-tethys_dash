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
import { findVisualizationBySource } from "components/visualizations/utilities";
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

function DataViewerModal({
  gridItemIndex,
  source,
  argsString,
  metadataString,
  showModal,
  handleModalClose,
  setGridItemMessage,
  setShowGridItemMessage,
}) {
  const { visualizations } = useContext(AppContext);
  const { getActiveTab, updateTab } = useContext(TabContext);
  // --- Initialization logic for visualization states ---
  let initialSelectedVizTypeOption = findVisualizationBySource(
    visualizations,
    source
  );
  let initialVizArguments = [];
  let initialVizInputsValues = {};
  let initialVariableInputValue = null;
  if (initialSelectedVizTypeOption) {
    const existingArgs = JSON.parse(argsString);
    if (source === "Variable Input") {
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
    initialSelectedVizTypeOption
  );
  const [vizArguments, setVizArguments] = useState(initialVizArguments);
  const [vizInputsValues, setVizInputsValues] = useState(
    initialVizInputsValues
  );
  const [variableInputValue, setVariableInputValue] = useState(
    initialVariableInputValue
  );
  const [vizMetdata, setVizMetadata] = useState(null);
  const [vizType, setVizType] = useState("unknown");
  const [vizData, setVizData] = useState({});
  const [alertMessage, setAlertMessage] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const { variableInputValues, setVariableInputValues } = useContext(
    VariableInputsContext
  );
  const [showingSubModal, setShowingSubModal] = useState(false);
  const { setAppTourStep, activeAppTour } = useAppTourContext();
  const { getMessageForRequest } = useContext(WebsocketContext);

  const gridMetadata = JSON.parse(metadataString);
  const visualizationRef = useRef();
  const [settings, setSettings] = useState(gridMetadata);
  const [tabKey, setTabKey] = useState("visualization");
  const requestId = useRef(uuidv4());

  function saveChanges(e) {
    e.preventDefault();
    e.stopPropagation();
    setShowAlert(false);
    if (selectedVizTypeOption !== null) {
      if (selectedVizTypeOption.source === "Variable Input") {
        var variableInputName = vizInputsValues.variable_name;
        var variableInputSource = vizInputsValues.variable_options_source;

        if (
          variableInputName in variableInputValues &&
          JSON.parse(argsString).variable_name !== variableInputName
        ) {
          setAlertMessage(
            variableInputName + " is already in use for a variable name"
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
        } else {
          vizInputsValues.initial_value = variableInputValue;
        }
      }

      if (
        Object.values(vizInputsValues).every(
          (value) => ![null, ""].includes(value)
        ) // TODO for csv-uploader, it's ok if data is empty
      ) {
        const { gridItems, id: activeTabId } = getActiveTab();
        let updatedGridItems = JSON.parse(JSON.stringify(gridItems));
        updatedGridItems[gridItemIndex].source = vizMetdata.source;

        updatedGridItems[gridItemIndex].args_string = JSON.stringify(
          Object.fromEntries(
            Object.entries(vizInputsValues).map(([key, val]) => [
              key,
              val.value ?? val,
            ])
          )
        );

        updatedGridItems[gridItemIndex].metadata_string =
          JSON.stringify(settings);

        if (selectedVizTypeOption.source === "Variable Input") {
          updatedGridItems = updateVariableInputs(
            vizInputsValues,
            updatedGridItems
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

  function updateVariableInputs(vizArgs, updatedGridItems) {
    const existingVariableName = JSON.parse(argsString).variable_name;
    if (
      existingVariableName &&
      existingVariableName !== vizArgs.variable_name
    ) {
      for (const gridItem of updatedGridItems) {
        if (gridItem.source !== "Variable Input") {
          const args = JSON.parse(gridItem.args_string);
          for (const arg in args) {
            const value = args[arg];
            if (typeof value !== "string") {
              continue;
            }

            if (value === "${" + existingVariableName + "}") {
              const newValue = "${" + vizArgs.variable_name + "}";
              args[arg] = newValue;
            }
          }
          gridItem.args_string = JSON.stringify(args);
        }
      }
    }
    variableInputValues[vizArgs.variable_name] =
      variableInputValue.value ?? variableInputValue;
    setVariableInputValues(variableInputValues);

    return updatedGridItems;
  }

  function closeAndSetAppTour() {
    handleModalClose();
    setAppTourStep(23);
  }

  function emptyFunction() {}

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
                        metadataString={metadataString}
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
            onClick={activeAppTour ? emptyFunction : saveChanges}
          >
            Save
          </Button>
        </Modal.Footer>
      </Modal>
    </MapContextProvider>
  );
}

DataViewerModal.propTypes = {
  gridItemIndex: PropTypes.number,
  source: PropTypes.string,
  argsString: PropTypes.string,
  metadataString: PropTypes.string,
  setGridItemMessage: PropTypes.func,
  setShowGridItemMessage: PropTypes.func,
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
};

export default DataViewerModal;
