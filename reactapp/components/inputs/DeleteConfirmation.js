import PropTypes from "prop-types";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import { confirmable, createConfirmation } from "react-confirm";
import styled from "styled-components";

const OverflowBody = styled(Modal.Body)`
  overflow-x: auto;
`;

const Confirmation = ({
  okLabel = "OK",
  cancelLabel = "Cancel",
  title = "Confirmation",
  confirmation,
  show,
  proceed,
}) => {
  return (
    <div className="static-modal">
      <Modal
        animation={false}
        show={show}
        onHide={() => proceed(false)}
        backdrop={true}
        keyboard={true}
      >
        <Modal.Header>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <OverflowBody>{confirmation}</OverflowBody>
        <Modal.Footer>
          <Button onClick={() => proceed(false)}>{cancelLabel}</Button>
          <Button
            className="button-l"
            variant="primary"
            onClick={() => proceed(true)}
          >
            {okLabel}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

Confirmation.propTypes = {
  okLabel: PropTypes.string,
  cancelLabel: PropTypes.string,
  title: PropTypes.string,
  confirmation: PropTypes.string,
  show: PropTypes.bool,
  proceed: PropTypes.func, // called when ok button is clicked.
  enableEscape: PropTypes.bool,
};

export function confirm(
  confirmation,
  proceedLabel = "OK",
  cancelLabel = "Cancel",
  options = {}
) {
  return createConfirmation(confirmable(Confirmation))({
    confirmation,
    proceedLabel,
    cancelLabel,
    ...options,
  });
}
