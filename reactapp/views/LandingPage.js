import { useContext, useMemo, useState } from "react";
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
import { filterDashboards } from "components/landingPage/dashboardSearch";
import styled from "styled-components";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Button from "react-bootstrap/Button";
import FormControl from "react-bootstrap/FormControl";
import InputGroup from "react-bootstrap/InputGroup";
import { BsSearch, BsXLg } from "react-icons/bs";

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

const SearchRow = styled(Row)`
  justify-content: center;
  margin-bottom: 1rem;
`;

const SearchCol = styled(Col)`
  max-width: 32rem;
`;

const ResultSummary = styled.p`
  margin: 0.4rem 0 0 0;
  font-size: 0.85rem;
  color: #6c757d;
  text-align: center;
`;

const NoMatchesDiv = styled.div`
  padding: 2rem 1rem;
  text-align: center;
  color: #6c757d;
`;

const LandingPage = () => {
  const { availableDashboards } = useContext(AvailableDashboardsContext);
  const { user } = useContext(AppContext);
  const [search, setSearch] = useState("");

  const isSearching = search.trim() !== "";
  const visibleDashboards = useMemo(
    () => filterDashboards(availableDashboards, search),
    [availableDashboards, search],
  );

  return (
    <LayoutAlertContextProvider>
      <LandingPageHeader />
      <DashboardLayoutAlerts />
      <StyledContainer fluid className="landing-page">
        {availableDashboards.length > 0 && (
          <SearchRow>
            <SearchCol>
              <InputGroup>
                <FormControl
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Dashboard Search Input"
                  placeholder="Search by name or description"
                />
                {isSearching ? (
                  <Button
                    variant="outline-secondary"
                    aria-label="Clear Dashboard Search"
                    onClick={() => setSearch("")}
                  >
                    <BsXLg />
                  </Button>
                ) : (
                  <InputGroup.Text>
                    <BsSearch />
                  </InputGroup.Text>
                )}
              </InputGroup>
              {isSearching && (
                <ResultSummary role="status">
                  {visibleDashboards.length} of {availableDashboards.length}{" "}
                  dashboards
                </ResultSummary>
              )}
            </SearchCol>
          </SearchRow>
        )}
        <StyledRow>
          {/* Hidden while filtering: it is not a dashboard, so leaving it in a
              filtered set reads as a match. */}
          {user?.username && !isSearching && (
            <StyledCol>
              <NewDashboardCard />
            </StyledCol>
          )}
          {visibleDashboards.map((dashboardMetadata) => (
            <StyledCol key={dashboardMetadata.id}>
              <DashboardCard {...dashboardMetadata} />
            </StyledCol>
          ))}
          {isSearching && visibleDashboards.length === 0 && (
            <NoMatchesDiv key="no-matches">
              No dashboards match &ldquo;{search.trim()}&rdquo;
            </NoMatchesDiv>
          )}
          {!user?.username && availableDashboards.length === 0 && (
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
