import styled from "styled-components";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Navbar from "react-bootstrap/Navbar";
import PropTypes from "prop-types";
import { useContext, useState } from "react";
import {
  BsX,
  BsGear,
  BsList,
  BsInfo,
  BsArrowReturnLeft,
  BsFloppyFill,
  BsPencilSquare,
} from "react-icons/bs";
import { FaPlus } from "react-icons/fa6";
import { LuNotepadText } from "react-icons/lu";
import {
  LayoutContext,
  EditingContext,
  DisabledEditingMovementContext,
  AppContext,
} from "components/contexts/Contexts";
import TooltipButton from "components/buttons/TooltipButton";
import DashboardNotes from "components/modals/DashboardNotes";
import AppInfoModal from "components/modals/AppInfo";
import { useAppTourContext } from "components/contexts/AppTourContext";
import { FaExpandArrowsAlt, FaLock, FaUnlock } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import {
  useLayoutSuccessAlertContext,
  useLayoutErrorAlertContext,
} from "components/contexts/LayoutAlertContext";
import html2canvas from "html2canvas";
import "components/buttons/HeaderButton.css";

const CustomNavBar = styled(Navbar)`
  min-height: var(--ts-header-height);
  justify-content: flex-end;
`;

const CustomContainer = styled(Container)`
  justify-content: flex-end;
`;

const WhiteTitle = styled.h1`
  position: absolute;
  left: 50%;
  top: 0;
  transform: translateX(-50%);
  white-space: nowrap;
  color: white;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
`;

function LockedIcon({ locked }) {
  return (
    <div
      style={{ position: "relative", display: "flex" }}
      className="items-center justify-center"
    >
      {locked ? <FaLock size="1.5rem" /> : <FaUnlock size="1.5rem" />}
      <FaExpandArrowsAlt
        size=".75rem"
        color="black"
        style={{
          position: "absolute",
          right: 0,
          left: 0,
          bottom: 0,
          width: "100%",
        }}
      />
    </div>
  );
}

export const LandingPageHeader = () => {
  const { tethysApp, user } = useContext(AppContext);

  return (
    <CustomNavBar fixed="top" bg="primary" variant="dark" className="shadow">
      <CustomContainer as="header" fluid className="px-4">
        <WhiteTitle>Available Dashboards</WhiteTitle>
        <Form inline="true">
          <>
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
              tooltipText="Exit TethysDash"
              aria-label={"appExitButton"}
            >
              <BsX size="1.5rem" />
            </TooltipButton>
          </>
        </Form>
      </CustomContainer>
    </CustomNavBar>
  );
};

export const DashboardHeader = () => {
  const [showEditCanvas, setShowEditCanvas] = useState(false);
  const dontShowInfoOnStart = localStorage.getItem("dontShowInfoOnStart");
  const [showInfoModal, setShowInfoModal] = useState(
    dontShowInfoOnStart !== "true"
  );
  const {
    getLayoutContext,
    setLayoutContext,
    resetLayoutContext,
    saveLayoutContext,
  } = useContext(LayoutContext);
  const { name, editable } = getLayoutContext();
  const { isEditing, setIsEditing } = useContext(EditingContext);
  const { disabledEditingMovement, setDisabledEditingMovement } = useContext(
    DisabledEditingMovementContext
  );
  const { setAppTourStep, activeAppTour } = useAppTourContext();
  const { setSuccessMessage, setShowSuccessMessage } =
    useLayoutSuccessAlertContext();
  const { setErrorMessage, setShowErrorMessage } = useLayoutErrorAlertContext();
  const navigate = useNavigate();

  const showNav = () => {
    setShowEditCanvas(true);
    if (activeAppTour) {
      setTimeout(() => {
        setAppTourStep(24);
      }, 400);
    }
  };

  function onCancel() {
    setTimeout(() => {
      resetLayoutContext();
      setIsEditing(false);
    }, 100); // This ensures that the old overlay doesn't show after the new buttons appear
  }

  function onAddGridItem() {
    const layout = getLayoutContext();
    let maxGridItemI = layout["gridItems"].reduce((acc, value) => {
      return (acc = acc > parseInt(value.i) ? acc : parseInt(value.i));
    }, 0);
    const newGridItem = {
      i: `${parseInt(maxGridItemI) + 1}`,
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "",
      args_string: "{}",
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    };
    layout["gridItems"] = [...layout["gridItems"], newGridItem];
    setLayoutContext(layout);
  }

  function onEdit() {
    setTimeout(() => {
      setIsEditing(true);
    }, 100); // This ensures that the old overlay doesn't show after the new buttons appear
    if (activeAppTour) {
      setTimeout(() => {
        setAppTourStep((previousStep) => previousStep + 1);
      }, 400);
    }
  }

  async function captureScreenshot() {
    const element = document.querySelector(".react-grid-layout");
    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Create a screenshot of the visible area within the window
    const canvas = await html2canvas(element, {
      x: rect.left,
      y: rect.top,
      width: Math.min(rect.width, viewportWidth), // Capture only the visible width
      height: Math.min(rect.height, viewportHeight), // Capture only the visible height
      scale: window.devicePixelRatio, // Ensure high resolution on high-DPI screens
      useCORS: true, // Attempts to bypass CORS issues
    });
    return canvas.toDataURL("image/png");
  }

  async function onSave() {
    setShowSuccessMessage(false);
    setShowErrorMessage(false);

    if (isEditing) {
      const image = await captureScreenshot();
      const { gridItems } = getLayoutContext();
      saveLayoutContext({ gridItems, image }).then((response) => {
        if (response.success) {
          setSuccessMessage("Change have been saved.");
          setShowSuccessMessage(true);
          setIsEditing(false);
        } else {
          setErrorMessage(
            "Failed to save changes. Check server logs for more information."
          );
          setShowErrorMessage(true);
        }
      });
    }
  }

  return (
    <>
      <CustomNavBar fixed="top" bg="primary" variant="dark" className="shadow">
        <CustomContainer as="header" fluid className="px-4">
          {name && <WhiteTitle>{name}</WhiteTitle>}
          <Form inline="true">
            <>
              {editable && (
                <>
                  {isEditing ? (
                    <>
                      <TooltipButton
                        tooltipPlacement="bottom"
                        tooltipText="Cancel Changes"
                        onClick={onCancel}
                        aria-label="cancelButton"
                        className="cancelChangesButton"
                      >
                        <BsArrowReturnLeft size="1.5rem" />
                      </TooltipButton>
                      <TooltipButton
                        onClick={onSave}
                        tooltipPlacement="bottom"
                        tooltipText="Save Changes"
                        aria-label="saveButton"
                        className="saveChangesButton"
                      >
                        <BsFloppyFill size="1.5rem" />
                      </TooltipButton>
                      <TooltipButton
                        tooltipPlacement="bottom"
                        tooltipText="Add Dashboard Item"
                        onClick={onAddGridItem}
                        aria-label="addGridItemButton"
                        className="addGridItemsButton"
                      >
                        <FaPlus size="1.5rem" />
                      </TooltipButton>
                      <TooltipButton
                        tooltipPlacement="bottom"
                        tooltipText={
                          disabledEditingMovement
                            ? "Unlock Movement"
                            : "Lock Movement"
                        }
                        onClick={() =>
                          setDisabledEditingMovement(!disabledEditingMovement)
                        }
                        aria-label="Disable Movement Button"
                        className="lockUnlocKMovementButton"
                      >
                        <LockedIcon locked={disabledEditingMovement} />
                      </TooltipButton>
                    </>
                  ) : (
                    <TooltipButton
                      tooltipPlacement="bottom"
                      tooltipText="Edit Dashboard"
                      onClick={onEdit}
                      aria-label={"editButton"}
                      className={"editDashboardButton"}
                    >
                      <BsPencilSquare size="1.5rem" />
                    </TooltipButton>
                  )}
                </>
              )}
              <TooltipButton
                onClick={showNav}
                tooltipPlacement="bottom"
                tooltipText="Dashboard Notes"
                aria-label="dashboarcNotesButton"
              >
                <LuNotepadText size="1.5rem" />
              </TooltipButton>
              <TooltipButton
                onClick={() => {
                  navigate("/");
                }}
                tooltipPlacement="bottom"
                tooltipText="Exit Dashboard"
                aria-label={"dashboardExitButton"}
              >
                <BsX size="1.5rem" />
              </TooltipButton>
            </>
          </Form>
        </CustomContainer>
      </CustomNavBar>
      {showEditCanvas && (
        <DashboardNotes
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
