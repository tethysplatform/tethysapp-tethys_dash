import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import DashboardLayoutAlerts from '../../components/dashboard/DashboardLayoutAlerts';
import React from 'react';
import { useLayoutNameContext } from "components/contexts/SelectedDashboardContext";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import styled from 'styled-components';

const StyledContainer= styled(Container)`
  position: relative;
`;

function DashboardView() {
  const name = useLayoutNameContext()[0];

  return (
    <>
      <div className="h-100 w-100">
        <Container fluid className="h-100">
            <Row className="h-100">
              {name &&
                <StyledContainer fluid className="h-100">
                  <LayoutAlertContextProvider>
                    <DashboardLayoutAlerts />
                    <DashboardLayout />
                  </LayoutAlertContextProvider>
                </StyledContainer>
              }
            </Row>
        </Container>
      </div>
    </>
  );
}

export default DashboardView;