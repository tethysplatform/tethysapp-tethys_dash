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
import {
  LayoutContext,
  EditingContext,
  DisabledEditingMovementContext,
} from "components/contexts/Contexts";
import TooltipButton from "components/buttons/TooltipButton";
import { AppContext } from "components/contexts/Contexts";
import DashboardEditorCanvas from "components/modals/DashboardEditor";
import AppInfoModal from "components/modals/AppInfo";
import { useAppTourContext } from "components/contexts/AppTourContext";
import { FaExpandArrowsAlt, FaLock, FaUnlock } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
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

const Header = ({ dashboardView }) => {
  const { tethysApp, user } = useContext(AppContext);
  const [showEditCanvas, setShowEditCanvas] = useState(false);
  const dontShowInfoOnStart = localStorage.getItem("dontShowInfoOnStart");
  const [showInfoModal, setShowInfoModal] = useState(
    dontShowInfoOnStart !== "true"
  );
  const { getLayoutContext, setLayoutContext, resetLayoutContext } =
    useContext(LayoutContext);
  const { label, editable } = getLayoutContext();
  const { isEditing, setIsEditing } = useContext(EditingContext);
  const { disabledEditingMovement, setDisabledEditingMovement } = useContext(
    DisabledEditingMovementContext
  );
  const { setAppTourStep, activeAppTour } = useAppTourContext();
  const navigate = useNavigate();

  const showNav = () => {
    setShowEditCanvas(true);
    if (activeAppTour) {
      setTimeout(() => {
        setAppTourStep(24);
      }, 400);
    }
  };

  function onCancel(e) {
    resetLayoutContext();
    setIsEditing(false);
  }

  function onAddGridItem(e) {
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

  function onEdit(e) {
    setIsEditing(true);
    if (activeAppTour) {
      setTimeout(() => {
        setAppTourStep((previousStep) => previousStep + 1);
      }, 400);
    }
  }

  return (
    <>
      <CustomNavBar fixed="top" bg="primary" variant="dark" className="shadow">
        <CustomContainer as="header" fluid className="px-4">
          {label && <WhiteTitle>{label}</WhiteTitle>}
          <Form inline="true">
            {label ? (
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
                          tooltipPlacement="bottom"
                          tooltipText="Save Changes"
                          form="gridUpdate"
                          type="submit"
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
                  tooltipText="Dashboard Settings"
                  aria-label="dashboardSettingButton"
                >
                  <BsGear size="1.5rem" />
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
            ) : (
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
            )}
          </Form>
        </CustomContainer>
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
