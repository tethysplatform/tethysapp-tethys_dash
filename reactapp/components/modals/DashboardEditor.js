import Offcanvas from "react-bootstrap/Offcanvas";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import DataInput from "components/inputs/DataInput";
import { useContext, useState, useEffect } from "react";
import styled from "styled-components";

const StyledOffcanvas = styled(Offcanvas)`
  height: 100vh;
  width: 25%;
`;

function DashboardEditorCanvas({ showCanvas, setShowCanvas }) {
  const handleClose = () => setShowCanvas(false);
  const [selectedSharingStatus, setSelectedSharingStatus] = useState(false);
  const [refreshRate, setRefreshRate] = useState(false);

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

  return (
    <StyledOffcanvas show={showCanvas} onHide={handleClose} placement={"left"}>
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Edit Dashboard</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        <DataRadioSelect
          label={"Sharing Status"}
          selectedRadio={selectedSharingStatus}
          radioOptions={sharingStatusOptions}
          onChange={onSharingChange}
        />
        <DataInput
          objValue={{
            label: "Refresh Rate (Minutes)",
            type: "number",
            value: refreshRate,
          }}
          onChange={onRefreshRateChange}
        />
      </Offcanvas.Body>
    </StyledOffcanvas>
  );
}

export default DashboardEditorCanvas;
