import styled from "styled-components";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Navbar from "react-bootstrap/Navbar";
import PropTypes from "prop-types";
import { useContext } from "react";
import { BsX, BsGear } from "react-icons/bs";
import { useLocation } from "react-router-dom";

import HeaderButton from "components/buttons/HeaderButton";
import { AppContext } from "components/contexts/AppContext";
import DashboardSelector from "components/layout/DashboardSelector";
import AddDashboardModalShowContextProvider from "components/contexts/AddDashboardModalShowContext";

const CustomNavBar = styled(Navbar)`
  min-height: var(--ts-header-height);
`;

const Header = ({ initialDashboard }) => {
  const { tethysApp, user } = useContext(AppContext);
  const location = useLocation();

  return (
    <>
      <CustomNavBar fixed="top" bg="primary" variant="dark" className="shadow">
        <Container as="header" fluid className="px-4">
          {(location.pathname.includes("/dashboard") ||
            location.pathname === "/") && (
            <AddDashboardModalShowContextProvider>
              <DashboardSelector initialDashboard={initialDashboard} />
            </AddDashboardModalShowContextProvider>
          )}
          <Form inline="true">
            {user.isStaff && (
              <HeaderButton
                href={tethysApp.settingsUrl}
                tooltipPlacement="bottom"
                tooltipText="Settings"
              >
                <BsGear size="1.5rem" />
              </HeaderButton>
            )}
            <HeaderButton
              href={tethysApp.exitUrl}
              tooltipPlacement="bottom"
              tooltipText="Exit"
            >
              <BsX size="1.5rem" />
            </HeaderButton>
          </Form>
        </Container>
      </CustomNavBar>
    </>
  );
};

Header.propTypes = {
  onNavChange: PropTypes.func,
};

export default Header;
