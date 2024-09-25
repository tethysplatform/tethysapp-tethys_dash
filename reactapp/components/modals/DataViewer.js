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
  grid_item_id,
  showModal,
  handleModalClose,
  setUpdateCellMessage,
  setShowUpdateCellMessage,
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
            value: "Text",
            label: "Text",
          },
        ],
      });
      setVizOptions(options);
    });
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
    if (
      selectedVizTypeOption !== null &&
      selectedVizTypeOption["value"] !== "Text"
    ) {
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
        const grid_item_index = updated_grid_items.findIndex(
          (gridItem) => gridItem.i === grid_item_id
        );
        updated_grid_items[grid_item_index].source = vizMetdata.source;
        updated_grid_items[grid_item_index].args_string = JSON.stringify(
          vizMetdata.args
        );

        const layout = getLayoutContext();
        layout["gridItems"] = updated_grid_items;
        setLayoutContext(layout);
        setShowUpdateCellMessage(true);
        handleModalClose();
      } else {
        console.log("warn users that all arguments need to be filled out");
      }
    } else {
      console.log("warn users that option need to be filled out");
    }
  }

  function previewVisualization() {
    if (selectedVizTypeOption["value"] === "Custom Image") {
      const image_source = vizInputsValues[0].value;
      if (image_source !== "") {
        setViz(<Image source={image_source} />);
        setVizMetadata({
          source: "Custom Image",
          args: { uri: image_source },
        });
        setUpdateCellMessage(
          "Cell updated to show a custom image at " + image_source
        );
      }
    } else {
      const itemData = {
        source: selectedVizTypeOption["source"],
        args: {},
      };
      vizInputsValues.forEach((arg) => {
        itemData["args"][arg.name] = arg.value.value || arg.value;
      });
      setVizMetadata(itemData);
      setUpdateCellMessage(
        "Cell updated to show " +
          selectedGroupName +
          " " +
          selectedVizTypeOption["label"]
      );
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
                  {selectedVizTypeOption && (
                    <>
                      {selectedVizTypeOption["value"] === "Text" && (
                        <CustomTextOptions
                          setVizMetadata={setVizMetadata}
                          setUpdateCellMessage={setUpdateCellMessage}
                        />
                      )}
                    </>
                  )}
                  {viz}
                </Col>
              </StyledRow>
            </StyledContainer>
          </Form>
        </Modal.Body>
        <Modal.Footer>
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

function CustomTextOptions({ setVizMetadata, setUpdateCellMessage }) {
  const [textValue, setTextValue] = useState("");

  function onChange(e) {
    setTextValue(e.target.value);
    const itemData = {
      source: "Text",
      args: {
        text: e.target.value,
      },
    };
    setVizMetadata(itemData);
    setUpdateCellMessage("Cell updated to show custom text");
  }

  return (
    <StyledDiv>
      <TextEditor textValue={textValue} onChange={onChange} />
    </StyledDiv>
  );
}

CustomTextOptions.propTypes = {
  setVizMetadata: PropTypes.func,
  setUpdateCellMessage: PropTypes.func,
};

DataViewerModal.propTypes = {
  grid_item_id: PropTypes.string,
  setUpdateCellMessage: PropTypes.func,
  setShowUpdateCellMessage: PropTypes.func,
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
};

export default DataViewerModal;
