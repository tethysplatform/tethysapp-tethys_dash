import { useContext, useEffect, useState } from "react";
import { LandingPageHeader } from "components/layout/Header";
import {
  AppContext,
  AvailableDashboardsContext,
} from "components/contexts/Contexts";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import DashboardLayoutAlerts from "components/dashboard/DashboardLayoutAlerts";
import DashboardCard, {
  NewDashboardCard,
  NoDashboardCard,
} from "components/landingPage/DashboardCard";
import styled from "styled-components";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

const StyledContainer = styled(Container)`
  margin-top: 1rem;
`;

const StyledRow = styled(Row)`
  justify-content: center;
`;

const StyledCol = styled(Col)`
  flex: 0;
  width: auto;
`;

const LandingPage = () => {
  const { availableDashboards } = useContext(AvailableDashboardsContext);
  const { user } = useContext(AppContext);
  const [userDashboards, setUserDashboards] = useState([]);
  const [publicDashboards, setPublicDashboards] = useState([]);

  useEffect(() => {
    setUserDashboards(availableDashboards.user);
    setPublicDashboards(availableDashboards.public);
  }, [availableDashboards]);

  return (
    <LayoutAlertContextProvider>
      <LandingPageHeader />
      <DashboardLayoutAlerts />
      <StyledContainer fluid className="landing-page">
        <StyledRow>
          {user?.username && (
            <StyledCol>
              <NewDashboardCard />
            </StyledCol>
          )}
          {userDashboards.map((dashboardMetadata) => (
            <StyledCol key={dashboardMetadata.id}>
              <DashboardCard editable={true} {...dashboardMetadata} />
            </StyledCol>
          ))}
          {publicDashboards.map((dashboardMetadata) => (
            <StyledCol key={dashboardMetadata.id}>
              <DashboardCard editable={false} {...dashboardMetadata} />
            </StyledCol>
          ))}
          {!user?.username && publicDashboards.length === 0 && (
            <StyledCol key="no-content">
              <NoDashboardCard />
            </StyledCol>
          )}
        </StyledRow>
      </StyledContainer>
    </LayoutAlertContextProvider>
  );
};

export default LandingPage;
