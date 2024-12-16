import styled from "styled-components";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Navbar from "react-bootstrap/Navbar";
import PropTypes from "prop-types";
import { useContext, useState } from "react";
import { BsX, BsGear, BsList, BsInfo } from "react-icons/bs";
import { useLocation } from "react-router-dom";

import TooltipButton from "components/buttons/TooltipButton";
import { AppContext } from "components/contexts/Contexts";
import DashboardSelector from "components/layout/DashboardSelector";
import DashboardEditorCanvas from "components/modals/DashboardEditor";
import AppInfoModal from "components/modals/AppInfo";
import { LayoutContext } from "components/contexts/Contexts";
import { useAppTourContext } from "components/contexts/AppTourContext";
import "components/buttons/HeaderButton.css";

const CustomNavBar = styled(Navbar)`
  min-height: var(--ts-header-height);
`;

const Header = ({ initialDashboard }) => {
  const { tethysApp, user } = useContext(AppContext);
  const location = useLocation();
  const [showEditCanvas, setShowEditCanvas] = useState(false);
  const dontShowInfoOnStart = localStorage.getItem("dontShowInfoOnStart");
  const [showInfoModal, setShowInfoModal] = useState(
    dontShowInfoOnStart !== "true"
  );
  const { setAppTourStep, activeAppTour } = useAppTourContext();

  const showNav = () => {
    setShowEditCanvas(true);
    if (activeAppTour) {
      setTimeout(() => {
        setAppTourStep(24);
      }, 400);
    }
  };
  const { getLayoutContext } = useContext(LayoutContext);
  const { name } = getLayoutContext();

  return (
    <>
      <CustomNavBar
        fixed="top"
        bg="primary"
        variant="dark"
        className="header shadow"
      >
        <Container as="header" fluid className="px-4">
          {name && (
            <TooltipButton
              onClick={showNav}
              tooltipPlacement="bottom"
              tooltipText="Dashboard Settings"
              aria-label="dashboardSettingButton"
              className="dashboardSettingButton"
            >
              <BsList size="1.5rem" />
            </TooltipButton>
          )}
          {(location.pathname.includes("/dashboard") ||
            location.pathname === "/") && (
            <DashboardSelector initialDashboard={initialDashboard} />
          )}
          <Form inline="true">
            <TooltipButton
              onClick={() => setShowInfoModal(true)}
              tooltipPlacement="bottom"
              tooltipText="App Info"
              aria-label={"appInfoButton"}
            >
              <BsInfo size="1.5rem" />
            </TooltipButton>
            {user.isStaff && (
              <TooltipButton
                href={tethysApp.settingsUrl}
                tooltipPlacement="bottom"
                tooltipText="App Settings"
                aria-label={"appSettingButton"}
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
      {showInfoModal && (
        <AppInfoModal
          showModal={showInfoModal}
          setShowModal={setShowInfoModal}
        />
      )}
    </>
  );
};

Header.propTypes = {
  initialDashboard: PropTypes.string,
};

export default Header;
