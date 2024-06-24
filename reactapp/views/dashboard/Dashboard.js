import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import DashboardLayoutAlerts from '../../components/dashboard/DashboardLayoutAlerts';
import DashboardMetadata from '../../components/dashboard/DashboardMetadata';
import React from 'react';
import EditingContextProvider from "components/contexts/EditingContext";
import DashboardNotesModalShowContextProvider from "components/contexts/DashboardNotesModalShowContext";
import { useSelectedDashboardContext } from "components/contexts/SelectedDashboardContext";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import styled from 'styled-components';

const StyledContainer= styled(Container)`
  position: relative;
`;

function DashboardView() {
  const dashboardContext = useSelectedDashboardContext()[0];

  return (
    <>
      <div className="h-100 w-100">
        <Container fluid className="h-100">
          <EditingContextProvider>
            <Row className="h-100">
              <Col className="col-2 h-100">
                <Row style={{"height": "95%"}}>
                  {dashboardContext && 
                    <DashboardNotesModalShowContextProvider>
                        <DashboardMetadata />
                    </DashboardNotesModalShowContextProvider>
                  }
                </Row>
              </Col>
              <Col className="col-10 h-100" style={{"overflowY": "auto"}}>
                {dashboardContext &&
                  <StyledContainer fluid className="h-100">
                    <LayoutAlertContextProvider>
                      <DashboardLayoutAlerts />
                      <DashboardLayout />
                    </LayoutAlertContextProvider>
                  </StyledContainer>
                }
              </Col>
            </Row>
          </EditingContextProvider>
        </Container>
      </div>
    </>
  );
}

export default DashboardView;