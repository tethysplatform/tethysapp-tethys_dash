import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import { useDashboardNotesModalShowContext } from "components/contexts/DashboardNotesModalShowContext";
import {
  useLayoutNotesContext,
  useLayoutContext,
} from "components/contexts/SelectedDashboardContext";
import { useAvailableDashboardContext } from "components/contexts/AvailableDashboardContext";
import { useState, useContext } from "react";
import { AppContext } from "components/contexts/AppContext";
import styled from "styled-components";
import { EditTextarea } from "react-edit-text";
import styles from "./notestyles.module.css";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";
import appAPI from "services/api/app";

const StyledTextArea = styled(EditTextarea)`
  border: solid 1px black;
  height: 30rem !important;
  overflow-y: auto !important;
`;

function DashboardNotesModal() {
  const [showModal, setShowModal] = useDashboardNotesModalShowContext();
  const [notes, setNotes] = useLayoutNotesContext();
  const setLayoutContext = useLayoutContext()[0];
  const getLayoutContext = useLayoutContext()[2];
  const [dashboardLayoutConfigs, setDashboardLayoutConfigs] =
    useAvailableDashboardContext();
  const [isEditing, setIsEditing] = useState(false);
  const [showSaveMessage, setShowSaveMessage] = useState(false);
  const [showErrorMessage, setShowErrorMessage] = useState(false);
  const { csrf } = useContext(AppContext);

  const handleModalClose = () => setShowModal(false);

  function onEditMode() {
    setIsEditing(true);
  }

  function onSave() {
    setIsEditing(false);
  }

  function onNotesChange({ target: { value } }) {
    setNotes(value);
    setShowSaveMessage(false);
  }

  function handleSubmit(event) {
    event.preventDefault();
    setShowSaveMessage(false);
    setShowErrorMessage(false);
    const updatedLayoutContext = getLayoutContext();
    updatedLayoutContext["notes"] = notes;
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
        dialogClassName={styles.leftDialog}
        show={showModal}
        onHide={handleModalClose}
      >
        <Modal.Header closeButton>
          <Modal.Title>Notes</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form id="dashboardNotes" onSubmit={handleSubmit}>
            <StyledTextArea
              value={notes}
              onChange={onNotesChange}
              onEditMode={onEditMode}
              onSave={onSave}
              rows={10}
              style={{ width: "100%" }}
            />
          </Form>
        </Modal.Body>
        <Modal.Footer>
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
          {!isEditing && (
            <Button variant="success" type="submit" form="dashboardNotes">
              Save
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default DashboardNotesModal;
