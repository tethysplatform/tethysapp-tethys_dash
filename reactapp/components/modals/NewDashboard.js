import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";
import { useAddDashboardModalShowContext } from "components/contexts/AddDashboardModalShowContext";
import { useAvailableDashboardsContext } from "components/contexts/AvailableDashboardsContext";
import { useEditingContext } from "components/contexts/EditingContext";
import { useState } from "react";

function NewDashboardModal() {
  const [dashboardName, setDashboardName] = useState("");

  const [showModal, setShowModal] = useAddDashboardModalShowContext();
  const addDashboard = useAvailableDashboardsContext()[2];
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const setIsEditing = useEditingContext()[1];
  const setShowSaveMessage = useState(false)[1];

  const handleModalClose = () => setShowModal(false);

  function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setHasError(false);
    let name = dashboardName.replace(" ", "_").toLowerCase();
    let label = dashboardName;
    const inputData = {
      name: name,
      label: label,
    };
    addDashboard(inputData).then((response) => {
      if (response["success"]) {
        setShowModal(false);
        setShowSaveMessage(true);
        setIsEditing(true);
      } else {
        setErrorMessage(response["message"]);
        setHasError(true);
      }
    });
  }

  function onNameInput({ target: { value } }) {
    setDashboardName(value);
  }

  return (
    <>
      <Modal show={showModal} onHide={handleModalClose}>
        <Modal.Header closeButton>
          <Modal.Title>Create a new dashboard</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {hasError && (
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
                  />
                  <Form.Text className="text-muted"></Form.Text>
                </Form.Group>
              </Row>
            </Container>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleModalClose}>
            Close
          </Button>
          <Button variant="success" type="submit" form="dashboardCreation">
            Create
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default NewDashboardModal;
