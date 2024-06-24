import { useLayoutSuccessAlertContext, useLayoutErrorAlertContext, useLayoutWarningAlertContext } from 'components/contexts/LayoutAlertContext';
import styled from 'styled-components';
import Alert from 'react-bootstrap/Alert';

const StyledAbsDiv= styled.div`
    position: absolute;
    z-index: 1000;
    left: 0;
    right: 0;
`;

function DashboardLayoutAlerts() {
    const [ successMessage, setSuccessMessage, showSuccessMessage, setShowSuccessMessage ] = useLayoutSuccessAlertContext();
    const [ errorMessage, setErrorMessage, showErrorMessage, setShowErrorMessage ] = useLayoutErrorAlertContext();
    const [ warningMessage, setWarningMessage, showWarningMessage, setShowWarningMessage ] = useLayoutWarningAlertContext();

    return (
        <StyledAbsDiv>
            {showErrorMessage &&
                <Alert key="failure" variant="danger" dismissible={true}>
                    {errorMessage}
                </Alert>
            }
            {showSuccessMessage &&
                <Alert key="success" variant="success" dismissible={true}>
                    {successMessage}
                </Alert>
            }
            {showWarningMessage &&
                <Alert key="success" variant="warning" dismissible={true}>
                    {warningMessage}
                </Alert>
            }
        </StyledAbsDiv>
    );
}



export default DashboardLayoutAlerts;