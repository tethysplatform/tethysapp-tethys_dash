import { useState } from "react";
import PropTypes from "prop-types";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import DataSelect from "components/inputs/DataSelect";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import CustomImageOptions from "components/modals/DataViewerComponents/CustomImageOptions";
import { useLayoutRowDataContext } from "components/contexts/SelectedDashboardContext";
import { useColInfoContext } from "components/dashboard/DashboardCol";
import { useRowInfoContext } from "components/dashboard/DashboardRow";
import styled from "styled-components";
import { AllDataOptions } from "components/modals/utilities";
import CNRFCPlotOptions from "components/modals/DataViewerComponents/CNRFC/PlotOptions";
import USACEPlotOptions from "components/modals/DataViewerComponents/USACE/PlotOptions";
import CW3EPlotOptions from "components/modals/DataViewerComponents/CW3E/PlotOptions";
import CustomTextOptions from "components/modals/DataViewerComponents/CustomTextOptions";
import "components/modals/wideModal.css";

const StyledContainer = styled(Container)`
  height: 35vw;
`;

const StyledRow = styled(Row)`
  height: 100%;
`;

function DataViewerModal({
  showModal,
  handleModalClose,
  setUpdateCellMessage,
  setShowUpdateCellMessage,
}) {
  const [selectedVizTypeOption, setSelectVizTypeOption] = useState(null);
  const [selectedGroupName, setSelectedGroupName] = useState(null);
  const [viz, setViz] = useState(null);
  const [vizMetdata, setVizMetadata] = useState(null);
  const [rowData, setRowData] = useLayoutRowDataContext();
  const rowNumber = useRowInfoContext()[0];
  const colNumber = useColInfoContext()[0];

  function onDataTypeChange(e) {
    for (let p of AllDataOptions) {
      for (let i of p.options) {
        if (i === e) {
          setSelectedGroupName(p.label);
          break;
        }
      }
    }
    setSelectVizTypeOption(e);
    setViz(null);
    setVizMetadata(null);
  }

  function handleSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    if (selectedVizTypeOption) {
      const updatedRowData = JSON.parse(JSON.stringify(rowData));
      const rowColumns = updatedRowData[rowNumber]["columns"];
      rowColumns[colNumber]["type"] = vizMetdata["type"];
      rowColumns[colNumber]["metadata"] = vizMetdata["metadata"];
      setRowData(updatedRowData);
      handleModalClose();
    }
    setShowUpdateCellMessage(true);
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
                <Col className={"justify-content-center h-100 col-3"}>
                  <DataSelect
                    label="Visualization Type"
                    selectedOption={selectedVizTypeOption}
                    onChange={onDataTypeChange}
                    options={AllDataOptions}
                  />
                  {selectedVizTypeOption && (
                    <>
                      {selectedGroupName === "CNRFC" && (
                        <CNRFCPlotOptions
                          selectedVizTypeOption={selectedVizTypeOption}
                          setViz={setViz}
                          setVizMetadata={setVizMetadata}
                          setUpdateCellMessage={setUpdateCellMessage}
                        />
                      )}
                      {selectedGroupName === "USACE" && (
                        <USACEPlotOptions
                          selectedVizTypeOption={selectedVizTypeOption}
                          setViz={setViz}
                          setVizMetadata={setVizMetadata}
                          setUpdateCellMessage={setUpdateCellMessage}
                        />
                      )}
                      {selectedGroupName === "CW3E" && (
                        <CW3EPlotOptions
                          selectedVizTypeOption={selectedVizTypeOption}
                          setViz={setViz}
                          setVizMetadata={setVizMetadata}
                          setUpdateCellMessage={setUpdateCellMessage}
                        />
                      )}
                      {selectedVizTypeOption["value"] === "Custom Image" && (
                        <CustomImageOptions
                          setViz={setViz}
                          setVizMetadata={setVizMetadata}
                          setUpdateCellMessage={setUpdateCellMessage}
                        />
                      )}
                    </>
                  )}
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

DataViewerModal.propTypes = {
  setUpdateCellMessage: PropTypes.func,
  setShowUpdateCellMessage: PropTypes.func,
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
};

export default DataViewerModal;
