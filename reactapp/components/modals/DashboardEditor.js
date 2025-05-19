import Offcanvas from "react-bootstrap/Offcanvas";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import { useState, useEffect, useContext } from "react";
import {
  LayoutContext,
  AvailableDashboardsContext,
  AppContext,
} from "components/contexts/Contexts";
import { useAppTourContext } from "components/contexts/AppTourContext";
import styled from "styled-components";
import { getPublicUrl } from "services/utilities";
import TooltipButton from "components/buttons/TooltipButton";
import PropTypes from "prop-types";
import TextEditor from "components/inputs/TextEditor";
import NormalInput from "components/inputs/NormalInput";
import Text from "components/visualizations/Text";
import { confirm } from "components/inputs/DeleteConfirmation";
import { BsClipboard } from "react-icons/bs";
import { useNavigate } from "react-router-dom";

const StyledOffcanvas = styled(Offcanvas)`
  height: 100vh;
  width: 33% !important;
`;
const StyledHeader = styled(Offcanvas.Header)`
  border-bottom: 1px solid #ccc;
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
  height: 40%;
`;
const TextDiv = styled.div`
  border: #dcdcdc solid 1px;
`;

const PaddedDiv = styled.div`
  margin-bottom: 1rem;
`;

const WideTextArea = styled.textarea`
  width: 100%;
`;

const WideLabel = styled.label`
  width: 100%;
`;

const FlexDiv = styled.div`
  display: flex;
  width: 100%;
`;

const ButtonDiv = styled.div`
  margin-bottom: 1rem;
`;

const UrlDiv = styled.div`
  flex: 1;
  margin-right: 1rem;
`;

function DashboardEditorCanvas({ showCanvas, setShowCanvas }) {
  const [selectedSharingStatus, setSelectedSharingStatus] = useState("private");
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [copyClipboardSuccess, setCopyClipboardSuccess] = useState(null);
  const {
    id,
    name,
    description,
    editable,
    accessGroups,
    unrestrictedPlacement,
    notes,
    saveLayoutContext,
  } = useContext(LayoutContext);
  const [selectedUnrestrictedPlacement, setSelectedUnrestrictedPlacement] =
    useState(unrestrictedPlacement);
  const { deleteDashboard, copyDashboard } = useContext(
    AvailableDashboardsContext
  );
  const { user } = useContext(AppContext);
  const [localNotes, setLocalNotes] = useState(notes);
  const [localName, setLocalName] = useState(name);
  const [localDescription, setLocalDescription] = useState(description);
  const { setAppTourStep, activeAppTour } = useAppTourContext();
  const navigate = useNavigate();

  const sharingStatusOptions = [
    { label: "Public", value: "public" },
    { label: "Private", value: "private" },
  ];

  const unrestrictedPlacementOptions = [
    { label: "On", value: true },
    { label: "Off", value: false },
  ];

  useEffect(() => {
    if (accessGroups.includes("public")) {
      setSelectedSharingStatus("public");
    } else {
      setSelectedSharingStatus("private");
    }
    // eslint-disable-next-line
  }, [accessGroups]);

  function onSharingChange(e) {
    setSelectedSharingStatus(e.target.value);
  }

  function onUnrestrictedPlacementChange(e) {
    setSelectedUnrestrictedPlacement(e.target.value === "true");
  }

  const handleCopyURLClick = async () => {
    const dashboardPublicUrl = getPublicUrl(name);
    try {
      await window.navigator.clipboard.writeText(dashboardPublicUrl);
      setCopyClipboardSuccess(true);
    } catch (err) {
      setCopyClipboardSuccess(false);
    }
  };

  const handleClose = () => {
    setShowCanvas(false);
    if (activeAppTour) {
      setAppTourStep(33);
    }
  };

  function onSave(e) {
    setSuccessMessage("");
    setErrorMessage("");
    const newProperties = {
      accessGroups: selectedSharingStatus === "public" ? ["public"] : [],
      notes: localNotes,
      name: localName,
      description: localDescription,
      unrestrictedPlacement: selectedUnrestrictedPlacement,
    };
    saveLayoutContext(newProperties).then((response) => {
      if (response["success"]) {
        setSuccessMessage("Successfully updated dashboard settings");
        if (name !== localName) {
          navigate("/dashboard/user/" + localName);
        }
      } else {
        setErrorMessage(
          response["message"] ??
            "Failed to update dashboard settings. Check server logs."
        );
      }
    });
  }

  async function onDelete(e) {
    setSuccessMessage("");
    setErrorMessage("");
    if (
      await confirm(
        "Are you sure you want to delete the " + name + " dashboard?"
      )
    ) {
      deleteDashboard(id).then((response) => {
        if (response["success"]) {
          navigate("/");
        } else {
          setErrorMessage(response["message"] ?? "Failed to delete dashboard");
        }
      });
    }
  }

  function onCopy() {
    setErrorMessage("");
    copyDashboard(id, name).then((response) => {
      if (response["success"]) {
        navigate(`/dashboard/user/${response["new_dashboard"].name}`);
      } else {
        setErrorMessage(response["message"] ?? "Failed to copy dashboard");
      }
    });
  }

  function onNotesChange(textValue) {
    setLocalNotes(textValue);
  }

  return (
    <StyledOffcanvas
      show={showCanvas}
      onHide={handleClose}
      placement={"end"}
      className="dashboard-settings-editor"
    >
      <StyledHeader closeButton>
        <Offcanvas.Title className="ms-auto">
          Dashboard Settings
        </Offcanvas.Title>
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
            <PaddedDiv>
              <NormalInput
                label={"Name"}
                type={"text"}
                value={localName}
                onChange={(e) => {
                  setLocalName(e.target.value);
                }}
              />
            </PaddedDiv>
            <PaddedDiv>
              <WideLabel>
                <b>Description</b>:
                <div>
                  <WideTextArea
                    value={localDescription}
                    rows={4}
                    onChange={(e) => setLocalDescription(e.target.value)}
                    aria-label="Description Input"
                  />
                </div>
              </WideLabel>
            </PaddedDiv>
            <DataRadioSelect
              label={"Sharing Status"}
              selectedRadio={selectedSharingStatus}
              radioOptions={sharingStatusOptions}
              onChange={onSharingChange}
            />
            <DataRadioSelect
              label={"Unrestricted Grid Item Placement"}
              selectedRadio={selectedUnrestrictedPlacement}
              radioOptions={unrestrictedPlacementOptions}
              onChange={onUnrestrictedPlacementChange}
            />
          </>
        ) : (
          <>
            <b>Name</b>:<br></br>
            <p>{name}</p>
            <b>Description</b>:<br></br>
            <p>{description}</p>
          </>
        )}
        {selectedSharingStatus === "public" && (
          <>
            <label>
              <b>Public URL</b>:
            </label>
            <FlexDiv>
              <ButtonDiv>
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
                  aria-label={"Copy Clipboard Button"}
                  style={{ display: "flex" }}
                >
                  <BsClipboard />
                </TooltipButton>
              </ButtonDiv>
              <UrlDiv>{getPublicUrl(name)}</UrlDiv>
            </FlexDiv>
          </>
        )}
        <TextEditorDiv>
          <b>Notes</b>:<br></br>
          {editable ? (
            <TextEditor textValue={localNotes} onChange={onNotesChange} />
          ) : (
            <TextDiv>
              <Text textValue={localNotes} />
            </TextDiv>
          )}
        </TextEditorDiv>
      </Offcanvas.Body>
      {user?.username && (
        <StyledFooter>
          <StyledButton
            variant="secondary"
            onClick={handleClose}
            className="cancel-dashboard-editor-button"
            aria-label="Cancel Dashboard Editor Button"
          >
            Close
          </StyledButton>
          <StyledButton
            variant="info"
            onClick={onCopy}
            aria-label="Copy Dashboard Button"
            className="copy-dashboard-button"
          >
            Copy dashboard
          </StyledButton>
          {editable && (
            <>
              <StyledButton
                variant="danger"
                onClick={onDelete}
                aria-label="Delete Dashboard Button"
                className="delete-dashboard-button"
              >
                Delete dashboard
              </StyledButton>
              <StyledButton
                variant="success"
                onClick={onSave}
                aria-label="Save Dashboard Button"
                className="save-dashboard-button"
              >
                Save changes
              </StyledButton>
            </>
          )}
        </StyledFooter>
      )}
    </StyledOffcanvas>
  );
}

DashboardEditorCanvas.propTypes = {
  showCanvas: PropTypes.bool,
  setShowCanvas: PropTypes.func,
};

export default DashboardEditorCanvas;
