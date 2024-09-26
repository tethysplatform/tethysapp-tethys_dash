import PropTypes from "prop-types";
import styled from "styled-components";
import Alert from "react-bootstrap/Alert";
import { useEffect } from "react";

const StyledAlert = styled(Alert)`
  position: absolute;
  z-index: 1081;
  left: 0;
`;

const CustomAlert = ({ alertType, showAlert, setShowAlert, alertMessage }) => {
  useEffect(() => {
    if (showAlert === true) {
      window.setTimeout(() => {
        setShowAlert(false);
      }, 5000);
    }
    // eslint-disable-next-line
  }, [showAlert]);

  return (
    <StyledAlert
      variant={alertType}
      dismissible={true}
      show={showAlert}
      onClose={() => setShowAlert(false)}
    >
      {alertMessage}
    </StyledAlert>
  );
};

CustomAlert.propTypes = {
  alertType: PropTypes.string,
  showAlert: PropTypes.bool,
  setShowAlert: PropTypes.func,
  alertMessage: PropTypes.string,
};

export default CustomAlert;
