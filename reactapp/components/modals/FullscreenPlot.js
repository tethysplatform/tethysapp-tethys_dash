import Modal from 'react-bootstrap/Modal';
import 'components/modals/wideModal.css'

const FullscreenPlotModal = ({ children, show, handleClose }) => {
    return (
        <>
            <Modal show={show} onHide={handleClose} dialogClassName="wideModalDialog">
                <Modal.Header closeButton>
                </Modal.Header>
                <Modal.Body>
                    {children}
                </Modal.Body>
            </Modal>
        </>
    );
}

export default FullscreenPlotModal;