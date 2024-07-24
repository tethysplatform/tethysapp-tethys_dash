import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import { useDashboardNotesModalShowContext } from "components/contexts/DashboardNotesModalShowContext";
import {
  useLayoutNotesContext,
  useLayoutContext,
} from "components/contexts/SelectedDashboardContext";
import { useAvailableDashboardContext } from "components/contexts/AvailableDashboardContext";
import { useState, useContext, useEffect } from "react";
import { AppContext } from "components/contexts/AppContext";
import TextEditor from "components/inputs/TextEditor";
import styles from "./DashboardNotes.module.css";
import Alert from "react-bootstrap/Alert";
import appAPI from "services/api/app";
import styled from "styled-components";

const StyledBody = styled(Modal.Body)`
  height: 60vh;
`;

const StyledHeader = styled(Modal.Header)`
  height: 6vh;
`;

const StyledFooter = styled(Modal.Footer)`
  height: 10vh;
`;

const StyledDiv = styled.div`
  height: 56vh;
`;

function DashboardNotesModal() {
  const [showModal, setShowModal] = useDashboardNotesModalShowContext();
  const notes = useLayoutNotesContext()[0];
  const setLayoutContext = useLayoutContext()[0];
  const getLayoutContext = useLayoutContext()[2];
  const [dashboardLayoutConfigs, setDashboardLayoutConfigs] =
    useAvailableDashboardContext();
  const [showSaveMessage, setShowSaveMessage] = useState(false);
  const [showErrorMessage, setShowErrorMessage] = useState(false);
  const [localNotes, setLocalNotes] = useState(notes);
  const { csrf } = useContext(AppContext);

  useEffect(() => {
    setLocalNotes(notes);
  }, [notes]);

  const handleModalClose = () => setShowModal(false);

  function onNotesChange({ target: { value } }) {
    setLocalNotes(value);
    if (showSaveMessage === true) {
      setShowSaveMessage(false);
    }
  }

  function handleSave(event) {
    event.preventDefault();
    setShowSaveMessage(false);
    setShowErrorMessage(false);
    const updatedLayoutContext = getLayoutContext();
    updatedLayoutContext["notes"] = localNotes;
    appAPI.updateDashboard(updatedLayoutContext, csrf).then((response) => {
      if (response["success"]) {
        const name = response["updated_dashboard"]["name"];
        let OGLayouts = Object.assign({}, dashboardLayoutConfigs);
        OGLayouts[name] = response["updated_dashboard"];
        setDashboardLayoutConfigs(OGLayouts);
        setLayoutContext(response["updated_dashboard"]);
        setShowSaveMessage(true);
      } else {
        setShowErrorMessage(true);
      }
    });
  }

  return (
    <>
      <Modal
        dialogClassName={styles.Dialog}
        contentClassName={styles.Content}
        show={showModal}
        onHide={handleModalClose}
      >
        <StyledHeader closeButton>
          <Modal.Title>Notes</Modal.Title>
        </StyledHeader>
        <StyledBody>
          <StyledDiv>
            <TextEditor textValue={localNotes} onChange={onNotesChange} />
          </StyledDiv>
        </StyledBody>
        <StyledFooter>
          {showSaveMessage && (
            <Alert key="success" variant="success">
              Changes have been saved.
            </Alert>
          )}
          {showErrorMessage && (
            <Alert key="failure" variant="danger">
              Failed to save notes. Check server logs for more information.
            </Alert>
          )}
          <Button variant="secondary" onClick={handleModalClose}>
            Close
          </Button>
          <Button variant="success" onClick={handleSave}>
            Save
          </Button>
        </StyledFooter>
      </Modal>
    </>
  );
}

export default DashboardNotesModal;
