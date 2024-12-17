import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";
import {
  AvailableDashboardsContext,
  EditingContext,
} from "components/contexts/Contexts";
import { useState, useContext } from "react";
import { useAppTourContext } from "components/contexts/AppTourContext";
import PropTypes from "prop-types";

function NewDashboardModal({ showModal, setShowModal }) {
  const [dashboardName, setDashboardName] = useState("");
  const { addDashboard } = useContext(AvailableDashboardsContext);
  const [errorMessage, setErrorMessage] = useState(null);
  const { setIsEditing } = useContext(EditingContext);
  const { setAppTourStep, activeAppTour } = useAppTourContext();

  const handleModalClose = () => {
    setShowModal(false);
    if (activeAppTour) {
      setAppTourStep(0);
    }
  };

  function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage(null);
    let name = dashboardName.replace(" ", "_").toLowerCase();
    let label = dashboardName;
    const inputData = {
      name: name,
      label: label,
    };
    addDashboard(inputData).then((response) => {
      if (response["success"]) {
        handleModalClose();
        if (activeAppTour) {
          setTimeout(() => {
            setIsEditing(false);
            setAppTourStep(4);
          }, 400);
        } else {
          setIsEditing(true);
        }
      } else {
        setErrorMessage(response["message"]);

        if (activeAppTour) {
          setAppTourStep(3);
        }
      }
    });
  }

  function onNameInput({ target: { value } }) {
    setDashboardName(value);
  }

  return (
    <>
      <Modal
        className="newdashboard"
        contentClassName="newdashboard-content"
        show={showModal}
        onHide={handleModalClose}
        centered
        animation={!activeAppTour}
        keyboard={!activeAppTour}
      >
        <Modal.Header closeButton>
          <Modal.Title>Create a new dashboard</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {errorMessage && (
            <Alert key="danger" variant="danger">
              {errorMessage}
            </Alert>
          )}
          <Form id="dashboardCreation" onSubmit={handleSubmit}>
            <Container fluid className="h-100">
              <Row className="h-100">
                <Form.Group className="mb-3" controlId="formDashboardName">
                  <Form.Label>Dashboard Name</Form.Label>
                  <Form.Control
                    required
                    type="text"
                    placeholder="Enter dashboard name"
                    onChange={onNameInput}
                    value={dashboardName}
                    aria-label={"Dashboard Name Input"}
                  />
                  <Form.Text className="text-muted"></Form.Text>
                </Form.Group>
              </Row>
            </Container>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={handleModalClose}
            aria-label={"Close Modal Button"}
          >
            Close
          </Button>
          <Button
            variant="success"
            type="submit"
            form="dashboardCreation"
            aria-label={"Create Dashboard Button"}
          >
            Create
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

NewDashboardModal.propTypes = {
  showModal: PropTypes.bool,
  setShowModal: PropTypes.func,
};

export default NewDashboardModal;
