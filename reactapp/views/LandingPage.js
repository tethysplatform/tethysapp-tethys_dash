import { useContext, useEffect, useState } from "react";
import Header from "components/layout/Header";
import { AvailableDashboardsContext } from "components/contexts/Contexts";
import CustomPicker from "components/inputs/CustomPicker";
import DashboardCard from "components/landingPage/DashboardCard";
import styled from "styled-components";

const DashboardCardsDiv = styled.div`
  margin-top: 1rem;
`;

const LandingPage = () => {
  const { availableDashboards } = useContext(AvailableDashboardsContext);
  const [userDashboards, setUserDashboards] = useState({});
  const [publicDashboards, setPublicDashboards] = useState({});

  useEffect(() => {
    setUserDashboards(
      Object.fromEntries(
        Object.entries(availableDashboards)
          .filter(([_, dashboardMetadata]) => dashboardMetadata.editable)
          .map(([key, dashboardMetadata]) => [
            key,
            () => <DashboardCard {...dashboardMetadata} />,
          ])
      )
    );
    setPublicDashboards(
      Object.fromEntries(
        Object.entries(availableDashboards)
          .filter(([_, value]) => !value.editable)
          .map(([key, value]) => [
            key,
            () => <DashboardCard dashboardMetadata={value} />,
          ])
      )
    );
  }, [availableDashboards]);

  function onSelect() {}

  return (
    <>
      <Header />
      <DashboardCardsDiv>
        <CustomPicker
          maxColCount={5}
          pickerOptions={userDashboards}
          onSelect={onSelect}
        />
      </DashboardCardsDiv>
    </>
  );
};

export default LandingPage;
