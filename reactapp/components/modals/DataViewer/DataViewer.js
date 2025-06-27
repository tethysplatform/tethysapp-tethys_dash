import { useState, useRef, useContext } from "react";
import PropTypes from "prop-types";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import styled from "styled-components";
import {
  LayoutContext,
  VariableInputsContext,
  AppContext,
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

function findBySource(data, targetSource) {
  for (const group of data) {
    for (const option of group.options) {
      if (option.source === targetSource) {
        return option;
      }
    }
  }
  return null;
}

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
  const [selectedVizTypeOption, setSelectVizTypeOption] = useState(
    findBySource(visualizations, source)
  );
  const [vizType, setVizType] = useState("unknown");
  const [vizData, setVizData] = useState({});
  const [vizInputsValues, setVizInputsValues] = useState({});
  const [variableInputValue, setVariableInputValue] = useState(null);
  const [vizMetdata, setVizMetadata] = useState(null);
  const { updateGridItems, gridItems } = useContext(LayoutContext);
  const [alertMessage, setAlertMessage] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const { variableInputValues, setVariableInputValues } = useContext(
    VariableInputsContext
  );
  const [showingSubModal, setShowingSubModal] = useState(false);
  const { setAppTourStep, activeAppTour } = useAppTourContext();

  const gridMetadata = JSON.parse(metadataString);
  const visualizationRef = useRef();
  const settingsRef = useRef(gridMetadata);
  const [tabKey, setTabKey] = useState("visualization");

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
        } else if (!variableInputValue && variableInputSource !== "checkbox") {
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
        )
      ) {
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

        updatedGridItems[gridItemIndex].metadata_string = JSON.stringify(
          settingsRef.current
        );

        if (selectedVizTypeOption.source === "Variable Input") {
          updatedGridItems = updateVariableInputs(
            vizInputsValues,
            updatedGridItems
          );
        }

        updateGridItems(updatedGridItems);
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
                        source={source}
                        argsString={argsString}
                        metadataString={metadataString}
                        setGridItemMessage={setGridItemMessage}
                        selectedVizTypeOption={selectedVizTypeOption}
                        setSelectVizTypeOption={setSelectVizTypeOption}
                        vizType={vizType}
                        setVizType={setVizType}
                        setVizData={setVizData}
                        setVizMetadata={setVizMetadata}
                        vizInputsValues={vizInputsValues}
                        setVizInputsValues={setVizInputsValues}
                        variableInputValue={variableInputValue}
                        setVariableInputValue={setVariableInputValue}
                        settingsRef={settingsRef}
                        visualizationRef={visualizationRef}
                        setShowingSubModal={setShowingSubModal}
                      />
                    </Tab>
                    <Tab
                      eventKey="settings"
                      title="Settings"
                      aria-label="settingsTab"
                      className="settingsTab"
                    >
                      <SettingsPane
                        settingsRef={settingsRef}
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
