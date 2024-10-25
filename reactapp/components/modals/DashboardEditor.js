import Offcanvas from "react-bootstrap/Offcanvas";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import { useState, useEffect } from "react";
import {
  useLayoutContext,
  useLayoutNameContext,
} from "components/contexts/SelectedDashboardContext";
import styled from "styled-components";
import { getTethysPortalHost } from "services/utilities";
import ClipboardCopyButton from "components/buttons/ClipboardCopy";
import { useAvailableDashboardsContext } from "components/contexts/AvailableDashboardsContext";
import PropTypes from "prop-types";

const APP_ROOT_URL = process.env.TETHYS_APP_ROOT_URL;

const StyledOffcanvas = styled(Offcanvas)`
  height: 100vh;
  width: 25%;
`;
const StyledDiv = styled.div`
  display: inline-block;
`;
const StyledMarginDiv = styled.div`
  display: inline-block;
  margin-right: 1rem;
`;
const StyledFooter = styled.footer`
  display: flex;
  justify-content: space-between;
  padding: 15px;
  border-top: 1px solid #ccc;
`;

function DashboardEditorCanvas({ showCanvas, setShowCanvas }) {
  const handleClose = () => setShowCanvas(false);
  const [selectedSharingStatus, setSelectedSharingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [copyClipboardSuccess, setCopyClipboardSuccess] = useState(null);
  const getLayoutContext = useLayoutContext()[2];
  const name = useLayoutNameContext()[0];
  const [deleteDashboard, updateDashboard] =
    useAvailableDashboardsContext().slice(3, 5);
  const dashboardPublicUrl =
    getTethysPortalHost() + APP_ROOT_URL + "dashboard/" + name;

  const sharingStatusOptions = [
    { label: "Public", value: "public" },
    { label: "Private", value: "private" },
  ];

  useEffect(() => {
    const updatedLayoutContext = getLayoutContext();
    if (updatedLayoutContext["access_groups"].includes("public")) {
      setSelectedSharingStatus("public");
    } else {
      setSelectedSharingStatus("private");
    }
    // eslint-disable-next-line
  }, []);

  function onSharingChange(e) {
    setSelectedSharingStatus(e.target.value);
  }

  const handleCopyClick = async () => {
    try {
      await window.navigator.clipboard.writeText(dashboardPublicUrl);
      setCopyClipboardSuccess(true);
    } catch (err) {
      setCopyClipboardSuccess(false);
    }
  };

  function handleSubmit(event) {
    event.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");
    const newProperties = {
      access_groups: selectedSharingStatus === "public" ? ["public"] : [],
    };
    updateDashboard(newProperties).then((success) => {
      if (success) {
        setSuccessMessage("Successfully updated dashboard settings");
      } else {
        setErrorMessage(
          "Failed to update dashboard settings. Check server logs."
        );
      }
    });
  }

  async function onDelete(e) {
    deleteDashboard();
    handleClose();
  }

  return (
    <StyledOffcanvas show={showCanvas} onHide={handleClose} placement={"left"}>
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Edit Dashboard</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        {errorMessage && (
          <Alert key="danger" variant="danger" dismissible={true}>
            {errorMessage}
          </Alert>
        )}
        {successMessage && (
          <Alert key="success" variant="success" dismissible={true}>
            {successMessage}
          </Alert>
        )}
        <DataRadioSelect
          label={"Sharing Status"}
          selectedRadio={selectedSharingStatus}
          radioOptions={sharingStatusOptions}
          onChange={onSharingChange}
        />
        {selectedSharingStatus === "public" && (
          <>
            <StyledMarginDiv>
              <b>Public URL:</b>
              <br></br>
              <p>{dashboardPublicUrl}</p>
            </StyledMarginDiv>
            <StyledDiv>
              <ClipboardCopyButton
                success={copyClipboardSuccess}
                onClick={handleCopyClick}
              />
            </StyledDiv>
          </>
        )}
      </Offcanvas.Body>
      <StyledFooter>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
        <Button variant="danger" onClick={onDelete}>
          Delete dashboard
        </Button>
        <Button variant="success" onClick={handleSubmit}>
          Save changes
        </Button>
      </StyledFooter>
    </StyledOffcanvas>
  );
}

DashboardEditorCanvas.propTypes = {
  showCanvas: PropTypes.bool,
  setShowCanvas: PropTypes.func,
};

export default DashboardEditorCanvas;
