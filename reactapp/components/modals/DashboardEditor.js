import Offcanvas from "react-bootstrap/Offcanvas";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import DataInput from "components/inputs/DataInput";
import {
  useLayoutEditableContext,
  useLayoutNotesContext,
} from "components/contexts/SelectedDashboardContext";
import { useContext, useState, useEffect } from "react";
import Button from "react-bootstrap/Button";
import styled from "styled-components";
import TextEditor from "components/inputs/TextEditor";
import "components/modals/DashboardEditor.css";

const StyledOffcanvas = styled(Offcanvas)`
  height: 100vh;
  width: 25%;
`;

const StyledDiv = styled.div`
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  display: flex;
  justify-content: space-between;
`;

const StyledButton = styled(Button)`
  margin: 0 1rem;
`;

function DashboardEditorCanvas({ showCanvas, setShowCanvas }) {
  const handleClose = () => setShowCanvas(false);
  const [selectedSharingStatus, setSelectedSharingStatus] = useState(false);
  const [refreshRate, setRefreshRate] = useState(false);
  const notes = useLayoutNotesContext()[0];
  const [localNotes, setLocalNotes] = useState(notes);
  const editable = useLayoutEditableContext();

  useEffect(() => {
    setLocalNotes(notes);
  }, [notes]);

  const sharingStatusOptions = [
    { label: "Public", value: "public" },
    { label: "Private", value: "private" },
  ];

  function onSharingChange(e) {
    setSelectedSharingStatus(e.target.value);
  }

  function onRefreshRateChange(e) {
    setRefreshRate(e);
  }

  function onNotesChange({ target: { value } }) {
    setLocalNotes(value);
    if (showSaveMessage === true) {
      setShowSaveMessage(false);
    }
  }

  return (
    <StyledOffcanvas show={showCanvas} onHide={handleClose} placement={"left"}>
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Dashboard Settings</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        {editable ? (
          <>
            <DataRadioSelect
              label={"Sharing Status"}
              selectedRadio={selectedSharingStatus}
              radioOptions={sharingStatusOptions}
              onChange={onSharingChange}
            />
            <b>Refresh Rate (Minutes):</b>
            <DataInput
              objValue={{
                type: "number",
                value: refreshRate,
              }}
              onChange={onRefreshRateChange}
            />
            <b>Notes:</b>
            <TextEditor textValue={localNotes} onChange={onNotesChange} />
          </>
        ) : (
          <>
            <b>Notes:</b>
            {localNotes}
          </>
        )}
        <StyledDiv>
          <StyledButton variant="danger">Delete Dashboard</StyledButton>
          <StyledButton variant="success">Save Dashboard</StyledButton>
        </StyledDiv>
      </Offcanvas.Body>
    </StyledOffcanvas>
  );
}

export default DashboardEditorCanvas;
