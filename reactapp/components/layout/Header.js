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
  BsFloppy,
  BsPencilSquare,
} from "react-icons/bs";
import { FaPlus } from "react-icons/fa6";
import { CiUndo } from "react-icons/ci";
import { IoArrowBackOutline } from "react-icons/io5";
import {
  LayoutContext,
  EditingContext,
  DisabledEditingMovementContext,
  AppContext,
} from "components/contexts/Contexts";
import TooltipButton from "components/buttons/TooltipButton";
import DashboardEditorCanvas from "components/modals/DashboardEditor";
import AppInfoModal from "components/modals/AppInfo";
import { useAppTourContext } from "components/contexts/AppTourContext";
import { FaExpandArrowsAlt, FaLock, FaUnlock } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import {
  useLayoutSuccessAlertContext,
  useLayoutErrorAlertContext,
} from "components/contexts/LayoutAlertContext";
import html2canvas from "html2canvas";
import Spinner from "react-bootstrap/Spinner";
import "components/buttons/HeaderButton.css";

const StyledSpinner = styled(Spinner)`
  vertical-align: middle;
  margin-right: 0.5rem;
`;

const CustomNavBar = styled(Navbar)`
  min-height: var(--ts-header-height);
`;

const TitleDiv = styled.div`
  justify-content: center;
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
      <Container as="header" fluid className="px-4">
        <TitleDiv>
          <WhiteTitle>Available Dashboards</WhiteTitle>
        </TitleDiv>
        <div>
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
        </div>
      </Container>
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
  const [isSaving, setIsSaving] = useState(false);
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
    setIsSaving(true);

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

    setIsSaving(false);
  }

  return (
    <>
      <CustomNavBar fixed="top" bg="primary" variant="dark" className="shadow">
        <Container as="header" fluid className="px-4">
          <TooltipButton
            onClick={() => {
              navigate("/");
            }}
            tooltipPlacement="bottom"
            tooltipText="Exit Dashboard"
            aria-label={"dashboardExitButton"}
            disabled={isSaving}
          >
            <IoArrowBackOutline size="1.5rem" />
          </TooltipButton>
          {name && <WhiteTitle>{name}</WhiteTitle>}
          <div>
            {editable && (
              <>
                {isEditing ? (
                  <>
                    {isSaving && (
                      <StyledSpinner
                        data-testid="Loading..."
                        animation="border"
                        variant="info"
                      />
                    )}
                    <TooltipButton
                      tooltipPlacement="bottom"
                      tooltipText="Cancel Changes"
                      onClick={onCancel}
                      aria-label="cancelButton"
                      className="cancelChangesButton"
                      disabled={isSaving}
                    >
                      <CiUndo size="1.5rem" strokeWidth={1.5} />
                    </TooltipButton>
                    <TooltipButton
                      onClick={onSave}
                      tooltipPlacement="bottom"
                      tooltipText="Save Changes"
                      aria-label="saveButton"
                      className="saveChangesButton"
                      disabled={isSaving}
                    >
                      <BsFloppy size="1.5rem" />
                    </TooltipButton>
                    <TooltipButton
                      tooltipPlacement="bottom"
                      tooltipText="Add Dashboard Item"
                      onClick={onAddGridItem}
                      aria-label="addGridItemButton"
                      className="addGridItemsButton"
                      disabled={isSaving}
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
                      disabled={isSaving}
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
              tooltipText="Dashboard Settings"
              aria-label="dashboarcSettingsButton"
              disabled={isSaving}
            >
              <BsGear size="1.5rem" />
            </TooltipButton>
          </div>
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
