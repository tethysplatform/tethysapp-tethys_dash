import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import DataSelect from "components/inputs/DataSelect";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import styled from "styled-components";
import Image from "components/visualizations/Image";
import DataInput from "components/inputs/DataInput";
import TextEditor from "components/inputs/TextEditor";
import { setVisualization } from "components/visualizations/utilities";
import { useLayoutGridItemsContext } from "components/contexts/SelectedDashboardContext";
import { useLayoutContext } from "components/contexts/SelectedDashboardContext";
import { useAvailableVisualizationsContext } from "components/contexts/AvailableVisualizationsContext";
import { useVariableInputValuesContext } from "components/contexts/VariableInputsContext";
import {
  getInitialInputValue,
  spaceAndCapitalize,
  valuesEqual,
} from "components/modals/utilities";
import { updateGridItemArgsWithVariableInputs } from "components/visualizations/utilities";
import CustomAlert from "components/dashboard/CustomAlert";
import VariableInput from "components/visualizations/VariableInput";
import { nonDropDownVariableInputTypes } from "components/visualizations/utilities";
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
`;

function DataViewerModal({
  grid_item_index,
  source,
  argsString,
  refreshRate,
  showModal,
  handleModalClose,
  setGridItemMessage,
  setShowGridItemMessage,
}) {
  const [selectedVizTypeOption, setSelectVizTypeOption] = useState(null);
  const [selectedGroupName, setSelectedGroupName] = useState(null);
  const [viz, setViz] = useState(null);
  const [vizOptions, setVizOptions] = useState([]);
  const [vizInputsValues, setVizInputsValues] = useState([]);
  const [variableInputValue, setVariableInputValue] = useState(null);
  const [vizMetdata, setVizMetadata] = useState(null);
  const gridItems = useLayoutGridItemsContext()[0];
  const setLayoutContext = useLayoutContext()[0];
  const getLayoutContext = useLayoutContext()[2];
  const availableVisualizations = useAvailableVisualizationsContext()[0];
  const availableVizArgs = useAvailableVisualizationsContext()[1];
  const [alertMessage, setAlertMessage] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const variableInputValues = useVariableInputValuesContext()[0];
  const setVariableInputValues = useVariableInputValuesContext()[1];
  const [dashboardRefreshRate, setDashboardRefreshRate] = useState(0);

  useEffect(() => {
    let options = [...availableVisualizations];
    options.push({
      label: "Other",
      options: [
        {
          source: "Custom Image",
          value: "Custom Image",
          label: "Custom Image",
          args: { image_source: "text" },
        },
        {
          source: "Text",
          value: "Text",
          label: "Text",
          args: { text: "text" },
        },
        {
          source: "Variable Input",
          value: "Variable Input",
          label: "Variable Input",
          args: {
            variable_name: "text",
            variable_options_source: [
              ...nonDropDownVariableInputTypes,
              ...[
                {
                  label: "Existing Visualization Inputs",
                  options: availableVizArgs,
                },
              ],
            ],
          },
        },
      ],
    });
    setDashboardRefreshRate(refreshRate);

    setVizOptions(options);
    if (source) {
      for (let p of options) {
        for (let i of p.options) {
          if (i.source === source) {
            setSelectedGroupName(p.label);
            setSelectVizTypeOption(i);
            let userInputsValues = [];
            const existingArgs = JSON.parse(argsString);
            if (source === "Variable Input") {
              setVariableInputValue(existingArgs.initial_value);
            }

            for (let arg in i.args) {
              if (i.args[arg]) {
                const userInputsValue = {
                  label: spaceAndCapitalize(arg),
                  name: arg,
                  type: i.args[arg],
                  value: existingArgs[arg],
                };
                userInputsValues.push(userInputsValue);
              }
            }
            setVizInputsValues(userInputsValues);
            break;
          }
        }
      }
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    checkAllInputs();
    // eslint-disable-next-line
  }, [vizInputsValues]);

  function handleInputChange(new_value, index) {
    const values = [...vizInputsValues];
    values[index].value = new_value;
    setVizInputsValues(values);
  }

  function handleVariableInputChange(e) {
    setVariableInputValue(e);
  }

  function onDataTypeChange(e) {
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
        updatedGridItems[grid_item_index].refresh_rate = dashboardRefreshRate;

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
      if (vizInputsValues[0].value) {
        setViz(<Image source={vizInputsValues[0].value} />);
      }
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
      setViz(
        <VariableInput
          args={itemData.args}
          onChange={handleVariableInputChange}
          dataviewer={true}
        />
      );
    } else {
      const updatedGridItemArgs = updateGridItemArgsWithVariableInputs(
        JSON.stringify(itemData.args),
        variableInputValues
      );
      itemData.args = updatedGridItemArgs;
      setVisualization(setViz, itemData);
    }
  }

  function onRefreshRateChange(e) {
    setDashboardRefreshRate(parseInt(e));
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
                  <DataInput
                    objValue={{
                      label: "Refresh Rate (Minutes)",
                      type: "number",
                      value: dashboardRefreshRate,
                    }}
                    onChange={onRefreshRateChange}
                    index={0}
                  />
                  <DataSelect
                    label="Visualization Type"
                    selectedOption={selectedVizTypeOption}
                    onChange={onDataTypeChange}
                    options={vizOptions}
                  />
                  {selectedVizTypeOption &&
                    selectedVizTypeOption["value"] !== "Text" &&
                    vizInputsValues.map((obj, index) => (
                      <DataInput
                        key={index}
                        objValue={obj}
                        onChange={handleInputChange}
                        index={index}
                        dataviewer={true}
                      />
                    ))}
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
  refreshRate: PropTypes.number,
  setGridItemMessage: PropTypes.func,
  setShowGridItemMessage: PropTypes.func,
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
};

export default DataViewerModal;
