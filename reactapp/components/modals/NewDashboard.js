import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Alert from "react-bootstrap/Alert";
import { AvailableDashboardsContext } from "components/contexts/Contexts";
import { useAppTourContext } from "components/contexts/AppTourContext";
import { useState, useContext } from "react";
import TextArea from "components/inputs/TextArea";
import NormalInput from "components/inputs/NormalInput";
import PropTypes from "prop-types";
import styled from "styled-components";

const PaddedDiv = styled.div`
  padding-bottom: 1rem;
`;

function NewDashboardModal({ showModal, setShowModal }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { addDashboard } = useContext(AvailableDashboardsContext);
  const { setAppTourStep, activeAppTour } = useAppTourContext();
  const [errorMessage, setErrorMessage] = useState(null);

  const handleModalClose = () => {
    setShowModal(false);
  };

  function createNewDashboard(event) {
    event.preventDefault();
    setErrorMessage(null);

    if (!name || !description) {
      setErrorMessage(
        "All inputs must be filled out for creating a dashboard."
      );
      return;
    }

    const inputData = {
      name,
      description,
    };
    addDashboard(inputData).then((response) => {
      if (response["success"]) {
        handleModalClose();
        if (activeAppTour) {
          setAppTourStep((previousStep) => previousStep + 1);
        }
      } else {
        setErrorMessage(response["message"]);
      }
    });
  }

  function onNameInput(value) {
    setName(value);
  }

  function onDescriptionInput(value) {
    setDescription(value);
  }

  return (
    <>
      <Modal
        className="newdashboard"
        contentClassName="newdashboard-content"
        show={showModal}
        onHide={handleModalClose}
        centered
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
          <PaddedDiv>
            <NormalInput
              label={"Name"}
              onChange={(e) => onNameInput(e.target.value)}
              value={name}
              type={"text"}
            />
          </PaddedDiv>
          <TextArea
            label={"Description"}
            value={description}
            onChange={(e) => onDescriptionInput(e.target.value)}
          />
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
            onClick={createNewDashboard}
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
