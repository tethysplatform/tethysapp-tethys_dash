import PropTypes from "prop-types";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import styled from "styled-components";

const OverflowBody = styled(Modal.Body)`
  overflow-x: auto;
`;

export const Confirmation = ({
  okLabel = "OK",
  cancelLabel = "Cancel",
  title = "Confirmation",
  confirmation,
  show,
  proceed,
  backdrop = true,
  noCancel = false,
  ...props
}) => {
  return (
    <div className="static-modal">
      <Modal
        animation={false}
        show={show}
        onHide={() => proceed(false)}
        backdrop={backdrop}
        keyboard={true}
        {...props}
      >
        <Modal.Header>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <OverflowBody>{confirmation}</OverflowBody>
        <Modal.Footer>
          {!noCancel && (
            <Button onClick={() => proceed(false)}>{cancelLabel}</Button>
          )}
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
  backdrop: PropTypes.oneOf([true, false, "static"]),
  noCancel: PropTypes.bool, // This is for not rendering the cancel button
};
