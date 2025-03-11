import { useContext, useEffect, useState } from "react";
import { LandingPageHeader } from "components/layout/Header";
import { AvailableDashboardsContext } from "components/contexts/Contexts";
import DashboardCard, {
  NewDashboardCard,
} from "components/landingPage/DashboardCard";
import styled from "styled-components";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

const StyledContainer = styled(Container)`
  margin-top: 1rem;
  overflow-x: hidden;
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
  const [userDashboards, setUserDashboards] = useState([]);
  const [publicDashboards, setPublicDashboards] = useState([]);

  useEffect(() => {
    setUserDashboards(availableDashboards.user);
    setPublicDashboards(availableDashboards.public);
  }, [availableDashboards]);

  return (
    <>
      <LandingPageHeader />
      <StyledContainer fluid className="landing-page">
        <StyledRow>
          <StyledCol>
            <NewDashboardCard />
          </StyledCol>
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
        </StyledRow>
      </StyledContainer>
    </>
  );
};

export default LandingPage;
