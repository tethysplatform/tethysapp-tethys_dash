import styled from "styled-components";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Navbar from "react-bootstrap/Navbar";
import PropTypes from "prop-types";
import { useContext, useState } from "react";
import { BsX, BsGear, BsList } from "react-icons/bs";
import { useLocation } from "react-router-dom";

import TooltipButton from "components/buttons/TooltipButton";
import { AppContext } from "components/contexts/AppContext";
import DashboardSelector from "components/layout/DashboardSelector";
import DashboardEditorCanvas from "components/modals/DashboardEditor";
import { useLayoutNameContext } from "components/contexts/SelectedDashboardContext";
import "components/buttons/HeaderButton.css";

const CustomNavBar = styled(Navbar)`
  min-height: var(--ts-header-height);
`;

const Header = ({ initialDashboard }) => {
  const { tethysApp, user } = useContext(AppContext);
  const location = useLocation();
  const [showEditCanvas, setShowEditCanvas] = useState(false);
  const showNav = () => setShowEditCanvas(true);
  const { name } = useLayoutNameContext();

  return (
    <>
      <CustomNavBar
        fixed="top"
        bg="primary"
        variant="dark"
        className="header shadow"
      >
        <Container as="header" fluid className="px-4">
          {dashBoardName && (
            <TooltipButton
              onClick={showNav}
              tooltipPlacement="bottom"
              tooltipText="Dashboard Settings"
            >
              <BsList size="1.5rem" />
            </TooltipButton>
          )}
          {(location.pathname.includes("/dashboard") ||
            location.pathname === "/") && (
            <DashboardSelector initialDashboard={initialDashboard} />
          )}
          <Form inline="true">
            {user.isStaff && (
              <TooltipButton
                href={tethysApp.settingsUrl}
                tooltipPlacement="bottom"
                tooltipText="App Settings"
              >
                <BsGear size="1.5rem" />
              </TooltipButton>
            )}
            <TooltipButton
              href={tethysApp.exitUrl}
              tooltipPlacement="bottom"
              tooltipText="Exit"
              aria-label={"appExitButton"}
            >
              <BsX size="1.5rem" />
            </TooltipButton>
          </Form>
        </Container>
      </CustomNavBar>
      {showEditCanvas && (
        <DashboardEditorCanvas
          showCanvas={showEditCanvas}
          setShowCanvas={setShowEditCanvas}
        />
      )}
    </>
  );
};

Header.propTypes = {
  initialDashboard: PropTypes.string,
};

export default Header;
