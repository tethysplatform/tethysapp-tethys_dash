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
  left: 0;
  right: 0;
`;

function DashboardLayoutAlerts() {
  const successMessage = useLayoutSuccessAlertContext()[0];
  const showSuccessMessage = useLayoutSuccessAlertContext()[2];
  const errorMessage = useLayoutErrorAlertContext()[0];
  const showErrorMessage = useLayoutErrorAlertContext()[2];
  const warningMessage = useLayoutWarningAlertContext()[0];
  const showWarningMessage = useLayoutWarningAlertContext()[2];

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
