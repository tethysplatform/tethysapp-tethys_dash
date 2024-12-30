import PropTypes from "prop-types";
import Modal from "react-bootstrap/Modal";
import styled from "styled-components";
import "components/modals/wideModal.css";

const StyledModal = styled(Modal)`
  height: 95vh;
`;

const StyledModalHeader = styled(Modal.Header)`
  height: 5%;
`;

const StyledModalBody = styled(Modal.Body)`
  height: 95%;
`;

const FullscreenPlotModal = ({ children, showModal, handleModalClose }) => {
  return (
    <>
      <StyledModal
        show={showModal}
        onHide={handleModalClose}
        className="fullscreen"
        dialogClassName="wideModalDialog"
      >
        <StyledModalHeader closeButton></StyledModalHeader>
        <StyledModalBody>{children}</StyledModalBody>
      </StyledModal>
    </>
  );
};

FullscreenPlotModal.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
    PropTypes.object,
  ]),
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
};

export default FullscreenPlotModal;
