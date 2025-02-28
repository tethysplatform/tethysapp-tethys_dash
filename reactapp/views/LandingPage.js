import { useContext, useEffect, useState } from "react";
import { LandingPageHeader } from "components/layout/Header";
import { AvailableDashboardsContext } from "components/contexts/Contexts";
import CustomPicker from "components/inputs/CustomPicker";
import DashboardCard, {
  NewDashboardCard,
} from "components/landingPage/DashboardCard";
import styled from "styled-components";
import { Card, Button } from "react-bootstrap";
import { BsChevronDown, BsChevronUp } from "react-icons/bs";

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
  const [userDashboards, setUserDashboards] = useState({});
  const [publicDashboards, setPublicDashboards] = useState({});

  useEffect(() => {
    const availableUserDashboards = {
      user_clicked_new_dashboard: () => <NewDashboardCard />,
    };
    for (const userDashboard in availableDashboards.user) {
      availableUserDashboards[userDashboard] = () => (
        <DashboardCard
          editable={true}
          {...availableDashboards.user[userDashboard]}
        />
      );
    }
    setUserDashboards(availableUserDashboards);

    setPublicDashboards(
      Object.fromEntries(
        Object.entries(availableDashboards.public).map(
          ([key, dashboardMetadata]) => [
            key,
            () => <DashboardCard editable={false} {...dashboardMetadata} />,
          ]
        )
      )
    );
  }, [availableDashboards]);

  return (
    <>
      <LandingPageHeader />
      <CollapsibleSection title="User Dashboards">
        <CustomPicker
          maxColCount={5}
          pickerOptions={userDashboards}
          onSelect={() => {}}
        />
      </CollapsibleSection>
      <CollapsibleSection title="Public Dashboards">
        <CustomPicker
          maxColCount={5}
          pickerOptions={publicDashboards}
          onSelect={() => {}}
        />
      </CollapsibleSection>
    </>
  );
};

export default LandingPage;
