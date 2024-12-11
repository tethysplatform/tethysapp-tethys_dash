import { useState } from "react";
import PropTypes from "prop-types";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import styled from "styled-components";
import { useAppTourContext } from "components/contexts/AppTourContext";

const StyledCheck = styled(Form.Check)`
  width: 100%;
`;

const StyledBody = styled(Modal.Body)`
  text-align: center;
`;

function AppInfoModal({ showModal, setShowModal }) {
  const { setActiveAppTour, setAppTourStep } = useAppTourContext();
  const dontShowInfoOnStart = localStorage.getItem("dontShowInfoOnStart");
  const [checked, setChecked] = useState(
    dontShowInfoOnStart === null ? false : dontShowInfoOnStart === "true"
  );
  const handleClose = () => setShowModal(false);

  const startAppTour = () => {
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
          />
        </Modal.Footer>
      </Modal>
    </>
  );
}

AppInfoModal.propTypes = {
  gridItemIndex: PropTypes.number,
  source: PropTypes.string,
  argsString: PropTypes.string,
  metadataString: PropTypes.string,
  setGridItemMessage: PropTypes.func,
  setShowGridItemMessage: PropTypes.func,
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
};

export default AppInfoModal;
