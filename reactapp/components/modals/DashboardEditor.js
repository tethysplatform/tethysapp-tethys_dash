import Offcanvas from "react-bootstrap/Offcanvas";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import { useState, useContext, memo } from "react";
import {
  LayoutContext,
  AvailableDashboardsContext,
  AppContext,
} from "components/contexts/Contexts";
import styled from "styled-components";
import PropTypes from "prop-types";
import TextEditor from "components/inputs/TextEditor";
import NormalInput from "components/inputs/NormalInput";
import Text from "components/visualizations/Text";
import { confirm } from "components/inputs/DeleteConfirmation";
import { useNavigate } from "react-router-dom";
import {
  BsFloppy,
  BsFillTrashFill,
  BsCopy,
  BsPeopleFill,
} from "react-icons/bs";
import PermissionsModal from "components/modals/Permissions";

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
  justify-content: end;
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

function DashboardEditorCanvas({ showCanvas, setShowCanvas }) {
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const {
    id,
    uuid,
    owner,
    publicDashboard,
    name,
    description,
    editable,
    userPermission,
    permissions,
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
  const navigate = useNavigate();
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);

  const unrestrictedPlacementOptions = [
    { label: "On", value: true },
    { label: "Off", value: false },
  ];

  function onUnrestrictedPlacementChange(e) {
    setSelectedUnrestrictedPlacement(e.target.value === "true");
  }

  const handleClose = () => {
    setShowCanvas(false);
  };

  function onSave(e) {
    setSuccessMessage("");
    setErrorMessage("");
    const newProperties = {
      notes: localNotes,
      name: localName,
      description: localDescription,
      unrestrictedPlacement: selectedUnrestrictedPlacement,
    };
    saveLayoutContext(newProperties).then((response) => {
      if (response["success"]) {
        setSuccessMessage("Successfully updated dashboard settings");
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
        navigate(`/dashboard/${response["new_dashboard"].uuid}`);
      } else {
        setErrorMessage(response["message"] ?? "Failed to copy dashboard");
      }
    });
  }

  function onNotesChange(textValue) {
    setLocalNotes(textValue);
  }

  return (
    <>
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
          {userPermission === "admin" ? (
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
          ) : (
            <>
              <b>Name</b>:<br></br>
              <p>{name}</p>
            </>
          )}
          {editable ? (
            <>
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
                label={"Unrestricted Grid Item Placement"}
                selectedRadio={selectedUnrestrictedPlacement}
                radioOptions={unrestrictedPlacementOptions}
                onChange={onUnrestrictedPlacementChange}
              />
              <TextEditorDiv>
                <b>Notes</b>:<br></br>
                <TextEditor textValue={localNotes} onChange={onNotesChange} />
              </TextEditorDiv>
            </>
          ) : (
            <>
              <b>Description</b>:<br></br>
              <p>{description}</p>
              <TextEditorDiv>
                <TextDiv>
                  <Text textValue={localNotes} />
                </TextDiv>
              </TextEditorDiv>
            </>
          )}
        </Offcanvas.Body>
        {user?.username && (
          <StyledFooter>
            <StyledButton
              variant="info"
              onClick={onCopy}
              aria-label="Copy Dashboard Button"
              className="copy-dashboard-button"
              title="Copy Dashboard"
            >
              <BsCopy />
            </StyledButton>
            {userPermission && (
              <StyledButton
                variant="warning"
                onClick={() => setShowPermissionsModal(true)}
                aria-label="Manage Dashboard Permissions Button"
                className="manage-permissions-button"
                title="Manage Dashboard Permissions"
              >
                <BsPeopleFill />
              </StyledButton>
            )}
            {editable && (
              <>
                {userPermission === "admin" && (
                  <StyledButton
                    variant="danger"
                    onClick={onDelete}
                    aria-label="Delete Dashboard Button"
                    className="delete-dashboard-button"
                    title="Delete Dashboard"
                  >
                    <BsFillTrashFill />
                  </StyledButton>
                )}
                <StyledButton
                  variant="success"
                  onClick={onSave}
                  aria-label="Save Dashboard Button"
                  className="save-dashboard-button"
                  title="Save Dashboard"
                >
                  <BsFloppy />
                </StyledButton>
              </>
            )}
          </StyledFooter>
        )}
      </StyledOffcanvas>
      {userPermission && (
        <PermissionsModal
          showModal={showPermissionsModal}
          setShowModal={setShowPermissionsModal}
          uuid={uuid}
          publicDashboard={publicDashboard}
          userPermission={userPermission}
          permissions={permissions}
          id={id}
          owner={owner}
        />
      )}
    </>
  );
}

DashboardEditorCanvas.propTypes = {
  showCanvas: PropTypes.bool,
  setShowCanvas: PropTypes.func,
};

export default memo(DashboardEditorCanvas);
