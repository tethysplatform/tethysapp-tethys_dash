import Modal from "react-bootstrap/Modal";
import PropTypes from "prop-types";

function VisualizationSettingsModal({ showModal, setShowModal }) {
  return (
    <>
      <Modal
        className="newdashboard"
        contentClassName="newdashboard-content"
        show={showModal}
        onHide={() => setShowModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Create a new dashboard</Modal.Title>
        </Modal.Header>
        <Modal.Body>Hello World</Modal.Body>
        <Modal.Footer></Modal.Footer>
      </Modal>
    </>
  );
}

VisualizationSettingsModal.propTypes = {
  showModal: PropTypes.bool,
  setShowModal: PropTypes.func,
};

export default VisualizationSettingsModal;
