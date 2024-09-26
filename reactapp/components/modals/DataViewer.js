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
import appAPI from "services/api/app";
import DataInput from "components/inputs/DataInput";
import TextEditor from "components/inputs/TextEditor";
import { setVisualization } from "components/visualizations/utilities";
import { useLayoutGridItemsContext } from "components/contexts/SelectedDashboardContext";
import { useLayoutContext } from "components/contexts/SelectedDashboardContext";
import CustomAlert from "components/dashboard/CustomAlert";
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

function DataViewerModal({
  grid_item_index,
  source,
  args_string,
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
  const [vizMetdata, setVizMetadata] = useState(null);
  const gridItems = useLayoutGridItemsContext()[0];
  const setLayoutContext = useLayoutContext()[0];
  const getLayoutContext = useLayoutContext()[2];
  const [alertMessage, setAlertMessage] = useState("");
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    appAPI.getVisualizations().then((data) => {
      let options = data.visualizations;
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
            args: { text: "" },
          },
        ],
      });
      setVizOptions(options);
      if (source) {
        for (let p of options) {
          for (let i of p.options) {
            if (i.source === source) {
              setSelectedGroupName(p.label);
              setSelectVizTypeOption(i);
              let userInputsValues = [];
              const existingArgs = JSON.parse(args_string);
              for (let arg in i.args) {
                userInputsValues.push({
                  label: spaceAndCapitalize(arg),
                  name: arg,
                  type: i.args[arg],
                  value: existingArgs[arg],
                });
              }
              setVizInputsValues(userInputsValues);
              break;
            }
          }
        }
      }
    });
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    checkAllInputs();
    // eslint-disable-next-line
  }, [vizInputsValues]);

  function spaceAndCapitalize(string) {
    let capitalized_words = [];
    let separated_string = string.split("_");
    for (let substring of separated_string) {
      capitalized_words.push(
        substring.charAt(0).toUpperCase() + substring.slice(1)
      );
    }

    return capitalized_words.join(" ");
  }

  function handleInputChange(new_value, index) {
    const values = [...vizInputsValues];
    values[index].value = new_value;
    setVizInputsValues(values);
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
        return arraysEqual(obj.type, e.args[arg]);
      });

      let inputValue;
      if (existing.length) {
        inputValue = existing[0].value;
      } else if (e.args[arg] === "text") {
        inputValue = "";
      } else if (e.args[arg] === "checkbox") {
        inputValue = false;
      } else {
        inputValue = null;
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
      if (inputValues.every((value) => value !== null)) {
        previewVisualization();
      }
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    if (selectedVizTypeOption !== null) {
      let inputValues = vizInputsValues.map((value) => value.value);
      if (inputValues.every((value) => value !== null)) {
        const updated_grid_items = [...gridItems];
        updated_grid_items[grid_item_index].source = vizMetdata.source;
        updated_grid_items[grid_item_index].args_string = JSON.stringify(
          vizMetdata.args
        );

        const layout = getLayoutContext();
        layout["gridItems"] = updated_grid_items;
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

  function previewVisualization() {
    const itemData = {
      source: selectedVizTypeOption["source"],
      args: {},
    };
    vizInputsValues.forEach((arg) => {
      itemData["args"][arg.name] = arg.value.value || arg.value;
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
    } else if (selectedVizTypeOption["value"] !== "Text") {
      setVisualization(setViz, itemData);
    }
  }

  const objectsEqual = (o1, o2) =>
    typeof o1 === "object" && Object.keys(o1).length > 0
      ? Object.keys(o1).length === Object.keys(o2).length &&
        Object.keys(o1).every((p) => objectsEqual(o1[p], o2[p]))
      : o1 === o2;

  const arraysEqual = (a1, a2) =>
    a1.length === a2.length && a1.every((o, idx) => objectsEqual(o, a2[idx]));

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
                <Col className={"justify-content-center h-100 col-3"}>
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
                      />
                    ))}
                </Col>
                <Col className={"justify-content-center h-100"}>
                  {selectedVizTypeOption &&
                    selectedVizTypeOption["value"] === "Text" && (
                      <CustomTextOptions
                        objValue={vizInputsValues[0]}
                        onChange={handleInputChange}
                        index={0}
                      />
                    )}
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
  args_string: PropTypes.string,
  setGridItemMessage: PropTypes.func,
  setShowGridItemMessage: PropTypes.func,
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
};

export default DataViewerModal;
