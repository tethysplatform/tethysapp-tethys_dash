import PropTypes from "prop-types";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";

/**
 * Stub for the popup layout sub-editor. The real implementation lands in
 * Unit 7 (`feat/configurable-map-popup-modal`). Unit 6 ships this stub so the
 * "Edit popup layout" entry-point in `PopupConfigPane` has something to mount;
 * the contracted prop API below is what Unit 7 will replace it with.
 *
 * Contracted API (do not break in Unit 7):
 *   show: boolean
 *   onClose: () => void
 *   popupConfig: { mode, size, anchor, titleTemplate, gridItems, id? } | null
 *   onSave: (nextGridItems: Array) => void
 *   popupId: number | null
 *   gridItemId: number
 *   layerName: string
 */
const PopupLayoutEditor = ({ show, onClose }) => {
  return (
    <Modal
      show={show}
      onHide={onClose}
      style={{ zIndex: 1050 }}
      aria-label="Popup Layout Editor Modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>Edit Popup Layout</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          The popup layout editor will be available soon. This entry point is
          wired but the editor itself ships in a follow-up unit.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={onClose}
          aria-label="Close Popup Layout Editor"
        >
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

PopupLayoutEditor.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  popupConfig: PropTypes.shape({
    id: PropTypes.number,
    mode: PropTypes.string,
    size: PropTypes.object,
    anchor: PropTypes.object,
    titleTemplate: PropTypes.string,
    gridItems: PropTypes.array,
  }),
  onSave: PropTypes.func,
  popupId: PropTypes.number,
  gridItemId: PropTypes.number,
  layerName: PropTypes.string,
};

export default PopupLayoutEditor;
