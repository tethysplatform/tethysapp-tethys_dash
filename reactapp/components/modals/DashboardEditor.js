import Offcanvas from "react-bootstrap/Offcanvas";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import { useState, useEffect } from "react";
import {
  useLayoutContext,
  useLayoutNameContext,
  useLayoutLabelContext,
  useLayoutNotesContext,
  useLayoutEditableContext,
} from "components/contexts/SelectedDashboardContext";
import styled from "styled-components";
import { getTethysPortalHost } from "services/utilities";
import TooltipButton from "components/buttons/TooltipButton";
import { useAvailableDashboardsContext } from "components/contexts/AvailableDashboardsContext";
import PropTypes from "prop-types";
import TextEditor from "components/inputs/TextEditor";
import { useEditingContext } from "components/contexts/EditingContext";
import DataInput from "components/inputs/DataInput";
import Text from "components/visualizations/Text";
import { confirm } from "components/dashboard/DeleteConfirmation";
import { BsClipboard } from "react-icons/bs";

const APP_ROOT_URL = process.env.TETHYS_APP_ROOT_URL;

const StyledOffcanvas = styled(Offcanvas)`
  height: 100vh;
  width: 33%;
`;
const StyledDiv = styled.div`
  display: inline-block;
`;
const StyledMarginDiv = styled.div`
  display: inline-block;
  margin-right: 1rem;
`;
const StyledHeader = styled(Offcanvas.Header)`
  padding: 15px;
  border-bottom: 1px solid #ccc;
`;
const StyledTitle = styled(Offcanvas.Title)`
  margin: auto;
`;
const StyledButton = styled(Button)`
  margin: 0.25rem;
`;
const StyledFooter = styled.footer`
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  padding: 15px;
  border-top: 1px solid #ccc;
`;
const TextEditorDiv = styled.div`
  height: 60%;
`;
const TextDiv = styled.div`
  border: #dcdcdc solid 1px;
`;

function DashboardEditorCanvas({ showCanvas, setShowCanvas }) {
  const handleClose = () => setShowCanvas(false);
  const [selectedSharingStatus, setSelectedSharingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [copyClipboardSuccess, setCopyClipboardSuccess] = useState(null);
  const getLayoutContext = useLayoutContext()[2];
  const name = useLayoutNameContext()[0];
  const label = useLayoutLabelContext()[0];
  const {
    deleteDashboard,
    updateDashboard,
    copyCurrentDashboard
  } = useAvailableDashboardsContext();
  const notes = useLayoutNotesContext()[0];
  const editable = useLayoutEditableContext();
  const [localNotes, setLocalNotes] = useState(notes);
  const [localName, setLocalName] = useState(name);
  const [localLabel, setLocalLabel] = useState(label);
  const dashboardPublicUrl =
    getTethysPortalHost() + APP_ROOT_URL + "dashboard/" + name;
  const setIsEditing = useEditingContext()[1];

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

  const handleCopyURLClick = async () => {
    try {
      await window.navigator.clipboard.writeText(dashboardPublicUrl);
      setCopyClipboardSuccess(true);
    } catch (err) {
      setCopyClipboardSuccess(false);
    }
  };

  function onSave(e) {
    setSuccessMessage("");
    setErrorMessage("");
    const newProperties = {
      access_groups: selectedSharingStatus === "public" ? ["public"] : [],
      notes: localNotes,
      name: localName,
      label: localLabel,
    };
    updateDashboard(newProperties).then((response) => {
      if (response["success"]) {
        setSuccessMessage("Successfully updated dashboard settings");
      } else {
        if ("message" in response) {
          setErrorMessage(response["message"]);
        } else {
          setErrorMessage(
            "Failed to update dashboard settings. Check server logs."
          );
        }
      }
    });
  }

  async function onDelete(e) {
    setSuccessMessage("");
    setErrorMessage("");
    deleteDashboard().then((response) => {
      if (response["success"]) {
        setIsEditing(false);
        handleClose();
      } else {
        if (!response["confirmExit"]) {
          setErrorMessage("Failed to delete dashboard. Check server logs.");
        }
      }
    });
  }

  async function onCopy(e) {
    setSuccessMessage("");
    setErrorMessage("");
    if (
      await confirm(
        "Are your sure you want to copy the " + name + " dashboard?"
      )
    ) {
      copyCurrentDashboard().then((response) => {
        if (response["success"]) {
          const newDashboard = response["new_dashboard"];
          setLocalName(newDashboard.name);
          setLocalLabel(newDashboard.label);
          setSuccessMessage("Successfully copied dashboard");
        } else {
          if ("message" in response) {
            setErrorMessage(response["message"]);
          } else {
            setErrorMessage("Failed to copy dashboard. Check server logs.");
          }
        }
      });
    }
  }

  function onNotesChange({ target: { value } }) {
    setLocalNotes(value);
  }

  return (
    <StyledOffcanvas show={showCanvas} onHide={handleClose} placement={"left"}>
      <StyledHeader closeButton>
        <StyledTitle>Dashboard Settings</StyledTitle>
      </StyledHeader>
      <Offcanvas.Body>
        {errorMessage && (
          <Alert
            key="danger"
            variant="danger"
            onClose={() => setErrorMessage("")}
            dismissible={true}
          >
            {errorMessage}
          </Alert>
        )}
        {successMessage && (
          <Alert
            key="success"
            variant="success"
            onClose={() => setSuccessMessage("")}
            dismissible={true}
          >
            {successMessage}
          </Alert>
        )}
        {editable ? (
          <>
            <DataInput
              objValue={{ label: "Name", type: "text", value: localName }}
              onChange={(e) => {
                setLocalName(e);
              }}
            />
            <DataInput
              objValue={{ label: "Label", type: "text", value: localLabel }}
              onChange={(e) => {
                setLocalLabel(e);
              }}
            />
            <DataRadioSelect
              label={"Sharing Status"}
              selectedRadio={selectedSharingStatus}
              radioOptions={sharingStatusOptions}
              onChange={onSharingChange}
            />
          </>
        ) : (
          <>
            <b>Name:</b>
            <br></br>
            <p>{name}</p>
            <b>Label:</b>
            <br></br>
            <p>{label}</p>
          </>
        )}
        {selectedSharingStatus === "public" && (
          <>
            <StyledMarginDiv>
              <b>Public URL:</b>
              <br></br>
              <p>{dashboardPublicUrl}</p>
            </StyledMarginDiv>
            <StyledDiv>
              <TooltipButton
                tooltipPlacement={"right"}
                tooltipText={
                  copyClipboardSuccess === null
                    ? "Copy to clipboard"
                    : copyClipboardSuccess
                      ? "Copied"
                      : "Failed to Copy"
                }
                variant={"warning"}
                onClick={handleCopyURLClick}
              >
                <BsClipboard />
              </TooltipButton>
            </StyledDiv>
          </>
        )}
        <TextEditorDiv>
          <b>Notes:</b>
          <br></br>
          {editable ? (
            <TextEditor textValue={localNotes} onChange={onNotesChange} />
          ) : (
            <TextDiv>
              <Text textValue={localNotes} />
            </TextDiv>
          )}
        </TextEditorDiv>
      </Offcanvas.Body>
      <StyledFooter>
        <StyledButton variant="secondary" onClick={handleClose}>
          Close
        </StyledButton>
        <StyledButton variant="info" onClick={onCopy}>
          Copy dashboard
        </StyledButton>
        {editable && (
          <>
            <StyledButton variant="danger" onClick={onDelete}>
              Delete dashboard
            </StyledButton>
            <StyledButton variant="success" onClick={onSave}>
              Save changes
            </StyledButton>
          </>
        )}
      </StyledFooter>
    </StyledOffcanvas>
  );
}

DashboardEditorCanvas.propTypes = {
  showCanvas: PropTypes.bool,
  setShowCanvas: PropTypes.func,
};

export default DashboardEditorCanvas;
