import { useState, useRef } from "react";
import PropTypes from "prop-types";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import styled from "styled-components";
import TextEditor from "components/inputs/TextEditor";
import { useLayoutGridItemsContext } from "components/contexts/SelectedDashboardContext";
import { useLayoutContext } from "components/contexts/SelectedDashboardContext";
import { useVariableInputValuesContext } from "components/contexts/VariableInputsContext";
import CustomAlert from "components/dashboard/CustomAlert";
import VisualizationPane from "components/modals/DataViewer/VisualizationPane";
import SettingsPane from "components/modals/DataViewer/SettingsPane";
import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";
import "components/modals/wideModal.css";

const StyledDiv = styled.div`
  height: 90%;
`;

const StyledContainer = styled(Container)`
  height: 35vw;
`;

const StyledRow = styled(Row)`
  height: 100%;
`;

const StyledCol = styled(Col)`
  border-right: black solid 1px;
  overflow: auto;
`;

function DataViewerModal({
  grid_item_index,
  source,
  argsString,
  metadataString,
  showModal,
  handleModalClose,
  setGridItemMessage,
  setShowGridItemMessage,
}) {
  const [selectedVizTypeOption, setSelectVizTypeOption] = useState(null);
  const [viz, setViz] = useState(null);
  const [vizInputsValues, setVizInputsValues] = useState([]);
  const [variableInputValue, setVariableInputValue] = useState(null);
  const [vizMetdata, setVizMetadata] = useState(null);
  const gridItems = useLayoutGridItemsContext()[0];
  const setLayoutContext = useLayoutContext()[0];
  const getLayoutContext = useLayoutContext()[2];
  const [alertMessage, setAlertMessage] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const variableInputValues = useVariableInputValuesContext()[0];
  const setVariableInputValues = useVariableInputValuesContext()[1];

  const gridMetadata = JSON.parse(metadataString);
  const visualizationRef = useRef({});
  const settingsRef = useRef(gridMetadata);
  const [tabKey, setTabKey] = useState("visualization");

  function handleSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    if (selectedVizTypeOption !== null) {
      let inputValues = vizInputsValues.map((value) => value.value);

      if (selectedVizTypeOption.source === "Variable Input") {
        var variableInputName = vizInputsValues.find((obj) => {
          return obj.name === "variable_name";
        }).value;
        var variableInputSource = vizInputsValues.find((obj) => {
          return obj.name === "variable_options_source";
        }).value;

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
          vizInputsValues.push({
            label: "Initial Value",
            name: "initial_value",
            value: variableInputValue,
          });
        }
      }

      if (inputValues.every((value) => value !== null)) {
        let updatedGridItems = structuredClone(gridItems);
        updatedGridItems[grid_item_index].source = vizMetdata.source;

        let vizArgs = {};
        for (const vizArg of vizInputsValues) {
          vizArgs[vizArg.name] = vizArg.value.value || vizArg.value;
        }
        updatedGridItems[grid_item_index].args_string = JSON.stringify(vizArgs);

        updatedGridItems[grid_item_index].metadata_string = JSON.stringify(
          settingsRef.current
        );

        if (selectedVizTypeOption.source === "Variable Input") {
          updatedGridItems = updateVariableInputs(vizArgs, updatedGridItems);
        }

        const layout = getLayoutContext();
        layout["gridItems"] = updatedGridItems;
        setLayoutContext(layout);
        setShowGridItemMessage(true);
        handleModalClose();
      } else {
        setAlertMessage("All arguments must be filled out before saving");
        setShowAlert(true);
      }
    } else {
      setAlertMessage("All visualization must be chosen before saving");
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

            if (value === "Variable Input:" + existingVariableName) {
              const newValue = "Variable Input:" + vizArgs.variable_name;
              args[arg] = newValue;
            }
          }
          gridItem.args_string = JSON.stringify(args);
        }
      }
    }
    variableInputValues[vizArgs.variable_name] =
      variableInputValue.value || variableInputValue;
    setVariableInputValues(variableInputValues);

    return updatedGridItems;
  }

  return (
    <>
      <Modal
        show={showModal}
        onHide={handleModalClose}
        dialogClassName="semiWideModalDialog"
      >
        <Modal.Header closeButton>
          <Modal.Title>Select Cell Data</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form id="dataSelect" onSubmit={handleSubmit}>
            <StyledContainer>
              <StyledRow>
                <StyledCol className={"justify-content-center h-100 col-3"}>
                  <Tabs
                    activeKey={tabKey}
                    onSelect={(k) => setTabKey(k)}
                    id="visualization-tabs"
                    className="mb-3"
                  >
                    <Tab eventKey="visualization" title="Visualization">
                      <VisualizationPane
                        source={source}
                        argsString={argsString}
                        setGridItemMessage={setGridItemMessage}
                        selectedVizTypeOption={selectedVizTypeOption}
                        setSelectVizTypeOption={setSelectVizTypeOption}
                        setViz={setViz}
                        setVizMetadata={setVizMetadata}
                        vizInputsValues={vizInputsValues}
                        setVizInputsValues={setVizInputsValues}
                        variableInputValue={variableInputValue}
                        setVariableInputValue={setVariableInputValue}
                        visualizationRef={visualizationRef}
                      />
                    </Tab>
                    <Tab eventKey="settings" title="Settings">
                      <SettingsPane
                        settingsRef={settingsRef}
                        visualizationRef={visualizationRef}
                      />
                    </Tab>
                  </Tabs>
                </StyledCol>
                <Col className={"justify-content-center h-100 col-9"}>
                  {viz}
                </Col>
              </StyledRow>
            </StyledContainer>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <CustomAlert
            alertType={"warning"}
            showAlert={showAlert}
            setShowAlert={setShowAlert}
            alertMessage={alertMessage}
          />
          <Button variant="secondary" onClick={handleModalClose}>
            Close
          </Button>
          <Button variant="success" type="submit" form="dataSelect">
            Save
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

function CustomTextOptions({ objValue, onChange, index }) {
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

DataViewerModal.propTypes = {
  grid_item_index: PropTypes.number,
  source: PropTypes.string,
  argsString: PropTypes.string,
  metadataString: PropTypes.object,
  setGridItemMessage: PropTypes.func,
  setShowGridItemMessage: PropTypes.func,
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
};

export default DataViewerModal;
