import {
  useLayoutSuccessAlertContext,
  useLayoutErrorAlertContext,
  useLayoutWarningAlertContext,
} from "components/contexts/LayoutAlertContext";
import styled from "styled-components";
import Alert from "react-bootstrap/Alert";

const StyledAbsDiv = styled.div`
  position: absolute;
  z-index: 1000;
  left: 1rem;
  right: 1rem;
`;

function DashboardLayoutAlerts() {
  const { successMessage, showSuccessMessage } = useLayoutSuccessAlertContext();
  const { errorMessage, showErrorMessage } = useLayoutErrorAlertContext();
  const { warningMessage, showWarningMessage } = useLayoutWarningAlertContext();

  return (
    <StyledAbsDiv>
      {showErrorMessage && (
        <Alert key="failure" variant="danger" dismissible={true}>
          {errorMessage}
        </Alert>
      )}
      {showSuccessMessage && (
        <Alert key="success" variant="success" dismissible={true}>
          {successMessage}
        </Alert>
      )}
      {showWarningMessage && (
        <Alert key="warning" variant="warning" dismissible={true}>
          {warningMessage}
        </Alert>
      )}
    </StyledAbsDiv>
  );
}

export default DashboardLayoutAlerts;
