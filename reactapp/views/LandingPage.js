import { useContext, useEffect, useState } from "react";
import { LandingPageHeader } from "components/layout/Header";
import { AvailableDashboardsContext } from "components/contexts/Contexts";
import DashboardCard, {
  NewDashboardCard,
} from "components/landingPage/DashboardCard";
import styled from "styled-components";
import { Card, Button } from "react-bootstrap";
import { BsChevronDown, BsChevronUp } from "react-icons/bs";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

const DashboardCardDiv = styled(Card)`
  border-radius: 0;
`;

const CollapsibleSection = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <DashboardCardDiv>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span>{title}</span>
        <Button
          variant="link"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
        >
          {isOpen ? <BsChevronUp /> : <BsChevronDown />}
        </Button>
      </Card.Header>
      {isOpen && <Card.Body>{children}</Card.Body>}
    </DashboardCardDiv>
  );
};

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
      <CollapsibleSection title="My Dashboards">
        <Container fluid>
          <Row>
            <Col>
              <NewDashboardCard />
            </Col>
            {userDashboards.map((dashboardMetadata) => (
              <Col key={dashboardMetadata.id}>
                <DashboardCard editable={true} {...dashboardMetadata} />
              </Col>
            ))}
          </Row>
        </Container>
      </CollapsibleSection>
      <CollapsibleSection title="Public Dashboards">
        <Container fluid>
          <Row>
            {publicDashboards.map((dashboardMetadata) => (
              <Col key={dashboardMetadata.id}>
                <DashboardCard editable={false} {...dashboardMetadata} />
              </Col>
            ))}
          </Row>
        </Container>
      </CollapsibleSection>
    </>
  );
};

export default LandingPage;
