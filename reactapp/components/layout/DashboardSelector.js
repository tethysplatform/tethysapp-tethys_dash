import { useEffect, useState, useContext } from "react";
import DashboardSelect from "components/inputs/DashboardSelect";
import TooltipButton from "components/buttons/TooltipButton";
import NewDashboardModal from "components/modals/NewDashboard";
import {
  LayoutContext,
  AvailableDashboardsContext,
  DashboardDropdownContext,
  EditingContext,
} from "components/contexts/Contexts";
import {
  BsArrowReturnLeft,
  BsFloppy,
  BsPencilSquare,
  BsPlus,
} from "react-icons/bs";
import { confirm } from "components/dashboard/DeleteConfirmation";
import styled from "styled-components";
import { useAppTourContext } from "components/contexts/AppTourContext";
import PropTypes from "prop-types";

const StyledDiv = styled.div`
  margin: auto;
`;

function DashboardSelector({ initialDashboard }) {
  const { setLayoutContext, getLayoutContext } = useContext(LayoutContext);
  const { name, editable } = getLayoutContext();
  const { availableDashboards } = useContext(AvailableDashboardsContext);
  const {
    dashboardDropdownOptions,
    selectedDashboardDropdownOption,
    setSelectedDashboardDropdownOption,
  } = useContext(DashboardDropdownContext);
  const [showModal, setShowModal] = useState(false);
  const { isEditing, setIsEditing } = useContext(EditingContext);
  const { setAppTourStep, activeAppTour } = useAppTourContext();
  const [menuIsOpen, setMenuIsOpen] = useState(false);
  const userDashboardDropdownOptions = dashboardDropdownOptions.filter(
    (dashboardDropdownOption) => dashboardDropdownOption.label !== "Public"
  );

  useEffect(() => {
    if (
      availableDashboards &&
      initialDashboard &&
      !selectedDashboardDropdownOption
    ) {
      let selectedDashboard = availableDashboards[initialDashboard];
      setSelectedDashboardDropdownOption({
        value: initialDashboard,
        label: selectedDashboard["label"],
      });
      setLayoutContext(selectedDashboard);
    }
    // eslint-disable-next-line
  }, [availableDashboards]);

  function changeDashboard(e) {
    if (e.value === "Create a New Dashboard") {
      setShowModal(true);
      if (activeAppTour) {
        setAppTourStep(2);
      }
    } else {
      let selectedDashboard = availableDashboards[e.value];
      setSelectedDashboardDropdownOption({
        value: e.value,
        label: selectedDashboard["label"],
      });
      setLayoutContext(selectedDashboard);
      if (activeAppTour) {
        setTimeout(() => {
          setAppTourStep(4);
        }, 400);
      }
    }
    setIsEditing(false);
    setMenuIsOpen(false);
  }

  async function updateLayout(e) {
    if (isEditing) {
      if (
        await confirm(
          "Changing dashboards will cancel any changes you have made. Are your sure you want to change dashboards?"
        )
      ) {
        changeDashboard(e);
      }
    } else {
      changeDashboard(e);
    }
  }

  function onEdit(e) {
    setIsEditing(true);
    if (activeAppTour) {
      setTimeout(() => {
        setAppTourStep((previousStep) => previousStep + 1);
      }, 400);
    }
  }

  function onCancel(e) {
    const OGLayoutContext = JSON.parse(
      JSON.stringify(availableDashboards[name])
    );
    setLayoutContext(OGLayoutContext);
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

  const handleMenuOpen = () => {
    setMenuIsOpen(true);
    setAppTourStep((previousStep) => previousStep + 1);
  };

  const handleMenuClose = (e) => {
    if (!activeAppTour) {
      setMenuIsOpen(false);
    }
  };

  function emptyFunction() {}

  return (
    <StyledDiv className={"wizard-step-1"}>
      <DashboardSelect
        options={
          activeAppTour
            ? userDashboardDropdownOptions
            : dashboardDropdownOptions
        }
        value={selectedDashboardDropdownOption}
        onChange={updateLayout}
        menuIsOpen={menuIsOpen}
        onMenuOpen={handleMenuOpen}
        onMenuClose={handleMenuClose}
        classNamePrefix="wizard-step-2"
      />
      {selectedDashboardDropdownOption && (
        <>
          {editable && (
            <>
              {isEditing && (
                <>
                  <TooltipButton
                    tooltipPlacement="bottom"
                    tooltipText="Cancel Changes"
                    onClick={activeAppTour ? emptyFunction : onCancel}
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
                    <BsFloppy size="1.5rem" />
                  </TooltipButton>
                  <TooltipButton
                    tooltipPlacement="bottom"
                    tooltipText="Add Dashboard Item"
                    onClick={activeAppTour ? emptyFunction : onAddGridItem}
                    aria-label="addGridItemButton"
                    className="addGridItemsButton"
                  >
                    <BsPlus size="1.5rem" />
                  </TooltipButton>
                </>
              )}
              {!isEditing && (
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
        </>
      )}
      {showModal && (
        <NewDashboardModal showModal={showModal} setShowModal={setShowModal} />
      )}
    </StyledDiv>
  );
}

DashboardSelector.propTypes = {
  initialDashboard: PropTypes.string,
};

export default DashboardSelector;
