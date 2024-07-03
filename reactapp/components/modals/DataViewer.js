import { useState } from "react";
import PropTypes from "prop-types";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import DataSelect from "components/inputs/DataSelect";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Image from "components/visualizations/Image";
import ImageDataViewerOptions from "components/modals/DataViewerComponents/ImageDataViewerOptions";
import PlotDataViewerOptions from "components/modals/DataViewerComponents/PlotDataViewerOptions";
import { useLayoutRowDataContext } from "components/contexts/SelectedDashboardContext";
import { useColInfoContext } from "components/dashboard/DashboardCol";
import { useRowInfoContext } from "components/dashboard/DashboardRow";
import styled from "styled-components";
import "components/modals/wideModal.css";

const StyledDiv = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
`;

const StyledH2 = styled.h2``;

function DataViewerModal({ showModal, handleModalClose }) {
  const [selectedDataTypeOption, setSelectDataTypeOption] = useState(null);
  const [imageSource, setImageSource] = useState("");
  const [imageWarning, setImageWarning] = useState(false);
  const [rowData, setRowData] = useLayoutRowDataContext();
  const rowNumber = useRowInfoContext()[0];
  const colNumber = useColInfoContext()[0];

  function onDataTypeChange(e) {
    setSelectDataTypeOption(e);
  }

  function handleSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    if (selectedDataTypeOption) {
      if (selectedDataTypeOption["value"] === "Image") {
        const updatedRowData = JSON.parse(JSON.stringify(rowData));
        const rowColumns = updatedRowData[rowNumber]["columns"];
        rowColumns[colNumber]["type"] = "Image";
        rowColumns[colNumber]["metadata"] = { uri: imageSource };
        setRowData(updatedRowData);
        handleModalClose();
      }
    }
  }

  function onImageError() {
    setImageWarning(true);
  }

  const ImageDataViewer = () => {
    return (
      <>
        {imageWarning ? (
          <StyledDiv>
            <StyledH2>Plot does not exist</StyledH2>
          </StyledDiv>
        ) : (
          <>
            {imageSource && (
              <Image source={imageSource} onError={onImageError} />
            )}
          </>
        )}
      </>
    );
  };

  const dataOptions = [
    { value: "Plot", label: "Plot" },
    { value: "Image", label: "Image" },
  ];

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
            <Container>
              <Row>
                <Col className={"justify-content-center h-100 col-3"}>
                  <DataSelect
                    label="Visualization Type"
                    selectedDataTypeOption={selectedDataTypeOption}
                    onChange={onDataTypeChange}
                    options={dataOptions}
                  />
                  {selectedDataTypeOption && (
                    <>
                      {selectedDataTypeOption["value"] === "Plot" && (
                        <PlotDataViewerOptions
                          setImageSource={setImageSource}
                          setImageWarning={setImageWarning}
                        />
                      )}
                      {selectedDataTypeOption["value"] === "Image" && (
                        <ImageDataViewerOptions
                          imageSource={imageSource}
                          setImageSource={setImageSource}
                        />
                      )}
                    </>
                  )}
                </Col>
                <Col>
                  {selectedDataTypeOption && (
                    <>{imageSource && <ImageDataViewer />}</>
                  )}
                </Col>
              </Row>
            </Container>
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

DataViewerModal.propTypes = {
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
  handleSubmit: PropTypes.func,
};

export default DataViewerModal;
