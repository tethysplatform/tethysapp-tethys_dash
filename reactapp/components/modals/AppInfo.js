import { useState, useContext } from "react";
import PropTypes from "prop-types";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import styled from "styled-components";
import { useAppTourContext } from "components/contexts/AppTourContext";
import { EditingContext, LayoutContext } from "components/contexts/Contexts";
import { confirm } from "components/dashboard/DeleteConfirmation";

const StyledCheck = styled(Form.Check)`
  width: 100%;
`;

const StyledBody = styled(Modal.Body)`
  text-align: center;
`;

function AppInfoModal({ showModal, setShowModal }) {
  const { resetLayoutContext } = useContext(LayoutContext);
  const { setActiveAppTour, setAppTourStep } = useAppTourContext();
  const dontShowInfoOnStart = localStorage.getItem("dontShowInfoOnStart");
  const [checked, setChecked] = useState(
    dontShowInfoOnStart === null ? false : dontShowInfoOnStart === "true"
  );
  const [showingConfirm, setShowingConfirm] = useState(false);
  const { isEditing, setIsEditing } = useContext(EditingContext);
  const handleClose = () => setShowModal(false);

  const startAppTour = async () => {
    if (isEditing) {
      setShowingConfirm(true);
      if (
        !(await confirm(
          "Starting the app tour will cancel any changes you have made to the current dashboard. Are your sure you want to start the tour?"
        ))
      ) {
        return;
      }
      setShowingConfirm(false);
    }
    resetLayoutContext();
    setIsEditing(false);
    setShowModal(false);
    setAppTourStep(0);
    setActiveAppTour(true);
  };

  const handleDontShow = (e) => {
    setChecked(e.target.checked);
    localStorage.setItem("dontShowInfoOnStart", e.target.checked);
  };

  return (
    <>
      <Modal
        show={showModal}
        onHide={handleClose}
        className="appinfo"
        aria-label={"App Info Modal"}
        centered
        style={showingConfirm && { zIndex: 1050 }}
      >
        <Modal.Header closeButton>
          <Modal.Title className="ms-auto">Welcome to TethysDash</Modal.Title>
        </Modal.Header>
        <StyledBody>
          Welcome to TethysDash, a customizable data viewer and dashboard
          application. For more information about the application and developing
          visualizations, check the official{" "}
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://tethysdashdocs.readthedocs.io/en/latest/index.html"
          >
            TethysDash documentation
          </a>
          .
          <br />
          <br />
          If you would like to take a tour of the application, click on the
          button below to begin.
          <br />
          <br />
          <Button onClick={startAppTour} variant="info">
            Start App Tour
          </Button>
        </StyledBody>
        <Modal.Footer>
          <StyledCheck
            onChange={handleDontShow}
            type="checkbox"
            label="Don't show on startup"
            checked={checked}
            aria-label="dontShowOnStartup"
          />
        </Modal.Footer>
      </Modal>
    </>
  );
}

AppInfoModal.propTypes = {
  showModal: PropTypes.bool,
  setShowModal: PropTypes.func,
};

export default AppInfoModal;
