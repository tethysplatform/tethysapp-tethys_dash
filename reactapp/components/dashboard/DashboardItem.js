import PropTypes from "prop-types";
import styled from "styled-components";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Form from "react-bootstrap/Form";
import { memo, useState, useEffect } from "react";
import { useEditingContext } from "components/contexts/EditingContext";
import { useRowInfoContext } from "components/dashboard/DashboardRow";
import { useLayoutRowDataContext } from "components/contexts/SelectedDashboardContext";
import { useLayoutWarningAlertContext } from "components/contexts/LayoutAlertContext";
import { useColInfoContext } from "components/dashboard/DashboardCol";
import DataViewerModal from "components/modals/DataViewer";
import DashboardItemButton from "components/buttons/DashboardItemButton";
import DashboardItemArrows from "components/buttons/DashboardItemArrows";
import BaseVisualization from "components/visualizations/BaseVisualization";
import Alert from "react-bootstrap/Alert";
import "components/dashboard/noArrowDropdown.css";

const StyledAlert = styled(Alert)`
  position: absolute;
  z-index: 1081;
`;

const StyledFormGroup = styled(Form.Group)`
  width: auto;
  margin: auto;
  display: inline-block;
  padding: 0 1rem;
`;

const StyledContainer = styled(Container)`
  position: relative;
  padding: 0;
`;

const StyledButtonDiv = styled.div`
  position: absolute;
  z-index: 1;
  margin: 0.5rem;
`;

const StyledCenterDiv = styled.div`
  width: auto;
  margin: auto;
  display: block;
`;

const StyledAbsDiv = styled.div`
  position: absolute;
  width: auto;
  padding: 0;
  left: ${(props) =>
    props.$x === "left" ? "0" : props.$x === "middle" && "50%"};
  right: ${(props) => props.$x === "right" && "0"};
  bottom: ${(props) =>
    props.$y === "bottom" ? "0" : props.$y === "middle" && "50%"};
  top: ${(props) => props.$y === "top" && "0"};
  margin-bottom: ${(props) => props.$y === "bottom" && ".5rem"};
  margin-top: ${(props) => props.$y === "top" && ".5rem"};
  margin-left: ${(props) => props.$x === "left" && ".5rem"};
  margin-right: ${(props) => props.$x === "right" && ".5rem"};
`;

function UpdateMessage({ showUpdateMessage, updateMessage }) {
  if (showUpdateMessage) {
    return (
      <StyledAlert key="success" variant="success" dismissible={true}>
        {updateMessage}
      </StyledAlert>
    );
  } else {
    return null;
  }
}

const DashboardItem = ({ type, metadata }) => {
  const isEditing = useEditingContext()[0];
  const [rowNumber, rowID, height, setHeight] = useRowInfoContext();
  const [colNumber, colID, width, setWidth] = useColInfoContext();
  const setWarningMessage = useLayoutWarningAlertContext()[1];
  const setShowWarningMessage = useLayoutWarningAlertContext()[3];
  const itemData = { type: type, metadata: metadata };
  const [rowData, setRowData] = useLayoutRowDataContext();
  const [maxWidth, setMaxWidth] = useState(
    (12 - (rowData[rowNumber]["columns"].length - 1)).toString()
  );
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showDataViewerModal, setShowDataViewerModal] = useState(false);
  const [updateMessage, setUpdateCellMessage] = useState(false);
  const [showUpdateMessage, setShowUpdateCellMessage] = useState(false);

  useEffect(() => {
    setMaxWidth((12 - (rowData[rowNumber]["columns"].length - 1)).toString());
  }, [rowData, rowNumber]);

  useEffect(() => {
    if (showUpdateMessage === true) {
      window.setTimeout(() => {
        setShowUpdateCellMessage(false);
      }, 5000);
    }
  }, [showUpdateMessage]);

  function onRowHeightInput({ target: { value } }) {
    const updatedRowData = JSON.parse(JSON.stringify(rowData));
    const rowInfo = updatedRowData[rowNumber];
    rowInfo["height"] = parseInt(value);
    setHeight(parseInt(value));
    setRowData(updatedRowData);
  }

  function onColWidthInput({ target: { value } }) {
    setWarningMessage("");
    setShowWarningMessage(false);
    const updatedRowData = JSON.parse(JSON.stringify(rowData));
    const updatedRowColumns = updatedRowData[rowNumber]["columns"];
    updatedRowColumns[colNumber]["width"] = parseInt(value);

    if (updatedRowColumns.length === 2) {
      const otherIndex = colNumber === 0 ? 1 : 0;
      updatedRowColumns[otherIndex]["width"] = 12 - value;
    }

    const totalRowWidths = updatedRowColumns.reduce(
      (partialSum, a) => partialSum + a.width,
      0
    );
    if (totalRowWidths > 12) {
      setWarningMessage("Total cell widths in the row cannot exceed 12.");
      setShowWarningMessage(true);
    } else {
      setWidth(parseInt(value));
      setRowData(updatedRowData);
    }
  }

  function deleteCell(e) {
    const rowColumns = rowData[rowNumber]["columns"];
    if (rowColumns.length === 1) {
      const updatedRowData = JSON.parse(JSON.stringify(rowData));
      updatedRowData.splice(rowNumber, 1);
      updateOrder(updatedRowData);
      setRowData(updatedRowData);
    } else {
      const updatedRowColumns = JSON.parse(JSON.stringify(rowColumns));
      const deletedColWidth = updatedRowColumns[colNumber]["width"];
      updatedRowColumns.splice(colNumber, 1);
      updateOrder(updatedRowColumns);

      const smallestWidthCol = Object.keys(updatedRowColumns).reduce((a, b) =>
        updatedRowColumns[a]["width"] < updatedRowColumns[b]["width"] ? a : b
      );
      updatedRowColumns[smallestWidthCol]["width"] += deletedColWidth;
      const updatedRowData = JSON.parse(JSON.stringify(rowData));
      updatedRowData[rowNumber]["columns"] = updatedRowColumns;
      setRowData(updatedRowData);
    }
  }

  function updateOrder(arr) {
    for (let i = 0; i < arr.length; i++) {
      arr[i]["order"] = i;
    }
  }

  function onFullscreen() {
    setShowFullscreen(true);
  }

  function hideFullscreen() {
    setShowFullscreen(false);
  }

  function onEdit() {
    setShowDataViewerModal(true);
  }

  function hideDataViewerModal() {
    setShowDataViewerModal(false);
  }

  return (
    <>
      <StyledContainer fluid className="h-100">
        <UpdateMessage
          showUpdateMessage={showUpdateMessage}
          updateMessage={updateMessage}
        />
        <StyledButtonDiv>
          {!["", "Text"].includes(type) && (
            <DashboardItemButton
              tooltipText="Fullscreen"
              type="fullscreen"
              hidden={isEditing}
              onClick={onFullscreen}
            />
          )}
          <DashboardItemButton
            tooltipText="Edit Content"
            type="edit"
            hidden={!isEditing}
            onClick={onEdit}
          />
          <DashboardItemButton
            tooltipText="Delete Cell"
            type="delete"
            hidden={!isEditing}
            onClick={deleteCell}
          />
        </StyledButtonDiv>
        <Row style={{ height: "100%" }} hidden={isEditing}>
          {!isEditing && type !== "" && (
            <BaseVisualization
              rowHeight={height}
              colWidth={width}
              itemData={itemData}
              showFullscreen={showFullscreen}
              hideFullscreen={hideFullscreen}
            />
          )}
        </Row>
        <Row className="h-100" hidden={!isEditing}>
          <StyledCenterDiv>
            <StyledFormGroup className="mb-1">
              <Form.Label>Row Height</Form.Label>
              <Form.Control
                required
                type="number"
                min="5"
                max="100"
                onChange={onRowHeightInput}
                value={height}
                data-inputtype="height"
                data-newrow={colNumber === 0 ? true : false}
                data-rowid={rowID}
                data-colid={colID}
              />
            </StyledFormGroup>
            <StyledFormGroup className="mb-1">
              <Form.Label>Column Width</Form.Label>
              <Form.Control
                required
                type="number"
                min="1"
                max={maxWidth}
                onChange={onColWidthInput}
                value={width}
                data-inputtype="width"
                data-type={type}
                data-metadata={JSON.stringify(metadata)}
                data-rowid={rowID}
                data-colid={colID}
              />
            </StyledFormGroup>
          </StyledCenterDiv>
          <StyledAbsDiv $x="middle" $y="top">
            <DashboardItemArrows
              arrowDirection="up"
              tooltipPlacement="left"
              tooltipText={
                rowNumber === 0 ? "Add Row Above" : "Add/Move Row Above"
              }
            />
          </StyledAbsDiv>
          <StyledAbsDiv $x="left" $y="middle">
            <DashboardItemArrows
              arrowDirection="left"
              tooltipPlacement="right"
              tooltipText={
                colNumber === 0 ? "Add Row on Left" : "Add/Move Column on Left"
              }
            />
          </StyledAbsDiv>
          <StyledAbsDiv $x="middle" $y="bottom">
            <DashboardItemArrows
              arrowDirection="down"
              tooltipPlacement="left"
              tooltipText={
                rowNumber === rowData.length - 1
                  ? "Add Row Below"
                  : "Add/Move Row Below"
              }
            />
          </StyledAbsDiv>
          <StyledAbsDiv $x="right" $y="middle">
            <DashboardItemArrows
              arrowDirection="right"
              tooltipPlacement="left"
              tooltipText={
                colNumber === rowData[rowNumber]["columns"].length - 1
                  ? "Add Row on Right"
                  : "Add/Move Column on Right"
              }
            />
          </StyledAbsDiv>
        </Row>
      </StyledContainer>
      {showDataViewerModal && (
        <DataViewerModal
          showModal={showDataViewerModal}
          handleModalClose={hideDataViewerModal}
          setUpdateCellMessage={setUpdateCellMessage}
          setShowUpdateCellMessage={setShowUpdateCellMessage}
        />
      )}
    </>
  );
};

DashboardItem.propTypes = {
  type: PropTypes.string,
  metadata: PropTypes.object,
};

export default memo(DashboardItem);
