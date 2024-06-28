import PropTypes from 'prop-types'
import Modal from 'react-bootstrap/Modal';
import 'components/modals/wideModal.css'

const FullscreenPlotModal = ({ children, showModal, handleModalClose }) => {
    return (
        <>
            <Modal show={showModal} onHide={handleModalClose} dialogClassName="wideModalDialog">
                <Modal.Header closeButton>
                </Modal.Header>
                <Modal.Body>
                    {children}
                </Modal.Body>
            </Modal>
        </>
    );
}

FullscreenPlotModal.propTypes = {
    children: PropTypes.oneOfType([
        PropTypes.arrayOf(PropTypes.node),
        PropTypes.node
    ]),
    showModal: PropTypes.bool,
    handleModalClose: PropTypes.func
}

export default FullscreenPlotModal;