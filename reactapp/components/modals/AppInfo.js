import { useState, useContext } from "react";
import PropTypes from "prop-types";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import styled from "styled-components";
import { useAppTourContext } from "components/contexts/AppTourContext";
import {
  EditingContext,
  LayoutContext,
  AppContext,
} from "components/contexts/Contexts";
import { confirm } from "components/inputs/DeleteConfirmation";

const StyledCheck = styled(Form.Check)`
  width: 100%;
`;

const StyledBody = styled(Modal.Body)`
  text-align: center;
`;

function AppInfoModal({ showModal, setShowModal, view }) {
  const layoutContext = useContext(LayoutContext);
  const editingContext = useContext(EditingContext);
  const { user } = useContext(AppContext);
  const { setActiveAppTour, setAppTourStep } = useAppTourContext();
  const dontShowLandingPageInfoOnStart = localStorage.getItem(
    "dontShowLandingPageInfoOnStart"
  );
  const dontShowDashboardInfoOnStart = localStorage.getItem(
    "dontShowDashboardInfoOnStart"
  );
  const [showingConfirm, setShowingConfirm] = useState(false);
  const [checked, setChecked] = useState(
    view === "dashboard"
      ? (dontShowDashboardInfoOnStart ?? false)
      : (dontShowLandingPageInfoOnStart ?? false)
  );

  const handleClose = () => setShowModal(false);

  const startAppTour = async () => {
    if (view === "dashboard") {
      if (editingContext.isEditing) {
        setShowingConfirm(true);
        if (
          !(await confirm(
            "Starting the app tour will cancel any changes you have made to the current dashboard. Are your sure you want to start the tour?"
          ))
        ) {
          return;
        }
        setShowingConfirm(false);
        editingContext.setIsEditing(false);
      }
      setAppTourStep(17);
      layoutContext.resetGridItems();
    } else {
      setAppTourStep(0);
    }
    setShowModal(false);
    setActiveAppTour(true);
  };

  const handleDontShow = (e) => {
    setChecked(e.target.checked);
    if (view === "dashboard") {
      localStorage.setItem("dontShowDashboardInfoOnStart", e.target.checked);
    } else {
      localStorage.setItem("dontShowLandingPageInfoOnStart", e.target.checked);
    }
  };

  return (
    <>
      <Modal
        show={showModal}
        onHide={handleClose}
        className="appinfo"
        aria-label={"App Info Modal"}
        centered
        style={showingConfirm && { zIndex: 1050 }}
      >
        <Modal.Header closeButton>
          <Modal.Title className="ms-auto">
            {view === "dashboard"
              ? "TethysDash Dashboards"
              : "TethysDash Landing Page"}
          </Modal.Title>
        </Modal.Header>
        <StyledBody>
          {view === "dashboard" ? (
            <>
              TethysDash dashboards provide a customizable dataviewer for a
              variety of user defined data sources. For more information about
              the application and developing visualizations, check the official{" "}
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://tethysdashdocs.readthedocs.io/en/latest/index.html"
              >
                TethysDash documentation
              </a>
              .
            </>
          ) : (
            <>
              Welcome to TethysDash, a customizable data viewer and dashboard
              application. The landing page provides a summary of all available
              dashboards, including publicly available dashboards. For more
              information about the application and developing visualizations,
              check the official{" "}
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://tethysdashdocs.readthedocs.io/en/latest/index.html"
              >
                TethysDash documentation
              </a>
              .
            </>
          )}
          {user?.username && (
            <>
              <br />
              <br />
              If you would like to take a tour of the application, click on the
              button below to begin.
              <br />
              <br />
              <Button onClick={startAppTour} variant="info">
                {view === "dashboard"
                  ? "Start Dashboard Tour"
                  : "Start Landing Page Tour"}
              </Button>
            </>
          )}
        </StyledBody>
        <Modal.Footer>
          <StyledCheck
            onChange={handleDontShow}
            type="checkbox"
            label="Don't show on startup"
            checked={checked}
            aria-label="dontShowOnStartup"
          />
        </Modal.Footer>
      </Modal>
    </>
  );
}

AppInfoModal.propTypes = {
  showModal: PropTypes.bool,
  setShowModal: PropTypes.func,
  view: PropTypes.string,
};

export default AppInfoModal;
