import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";
import { useAvailableDashboardsContext } from "components/contexts/AvailableDashboardsContext";
import { useEditingContext } from "components/contexts/EditingContext";
import { useState } from "react";
import PropTypes from "prop-types";

function NewDashboardModal({ showModal, setShowModal }) {
  const [dashboardName, setDashboardName] = useState("");
  const { addDashboard } = useAvailableDashboardsContext();
  const [errorMessage, setErrorMessage] = useState(null);
  const { setIsEditing } = useEditingContext();

  const handleModalClose = () => {
    setShowModal(false);
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
        setIsEditing(true);
      } else {
        setErrorMessage(response["message"]);
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
        show={showModal}
        onHide={handleModalClose}
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
