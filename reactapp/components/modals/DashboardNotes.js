import Offcanvas from "react-bootstrap/Offcanvas";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import { useState, useContext } from "react";
import { LayoutContext } from "components/contexts/Contexts";
import { useAppTourContext } from "components/contexts/AppTourContext";
import styled from "styled-components";
import PropTypes from "prop-types";
import TextEditor from "components/inputs/TextEditor";
import Text from "components/visualizations/Text";

const StyledOffcanvas = styled(Offcanvas)`
  height: 100vh;
  width: 33%;
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
  height: 90%;
`;
const TextDiv = styled.div`
  border: #dcdcdc solid 1px;
`;

function DashboardNotes({ showCanvas, setShowCanvas }) {
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const { getLayoutContext, saveLayoutContext } = useContext(LayoutContext);
  const { editable, notes } = getLayoutContext();
  const [localNotes, setLocalNotes] = useState(notes);
  const { setAppTourStep, activeAppTour } = useAppTourContext();

  const handleClose = () => {
    setShowCanvas(false);
    if (activeAppTour) {
      setAppTourStep(16);
    }
  };

  function onSave() {
    setSuccessMessage("");
    setErrorMessage("");
    const newProperties = {
      notes: localNotes,
    };
    saveLayoutContext(newProperties).then((response) => {
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

  function onNotesChange({ target: { value } }) {
    setLocalNotes(value);
  }

  return (
    <StyledOffcanvas
      show={showCanvas}
      onHide={handleClose}
      placement={"left"}
      className="dashboard-settings-editor"
    >
      <StyledHeader closeButton>
        <Offcanvas.Title className="ms-auto">Dashboard Notes</Offcanvas.Title>
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
        <StyledButton
          variant="secondary"
          onClick={handleClose}
          className="cancel-dashboard-editor-button"
          aria-label="Cancel Dashboard Editor Button"
        >
          Close
        </StyledButton>
        {editable && (
          <StyledButton
            variant="success"
            onClick={onSave}
            aria-label="Save Dashboard Button"
            className="save-dashboard-button"
          >
            Save changes
          </StyledButton>
        )}
      </StyledFooter>
    </StyledOffcanvas>
  );
}

DashboardNotes.propTypes = {
  showCanvas: PropTypes.bool,
  setShowCanvas: PropTypes.func,
};

export default DashboardNotes;
