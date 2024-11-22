import { useEffect, useState } from "react";
import DashboardSelect from "components/inputs/DashboardSelect";
import TooltipButton from "components/buttons/TooltipButton";
import NewDashboardModal from "components/modals/NewDashboard";
import {
  useLayoutContext,
  useLayoutNameContext,
  useLayoutEditableContext,
} from "components/contexts/SelectedDashboardContext";
import {
  useAvailableDashboardsContext,
  useDashboardDropdownContext,
} from "components/contexts/AvailableDashboardsContext";
import {
  BsArrowReturnLeft,
  BsFloppy,
  BsPencilSquare,
  BsPlus,
} from "react-icons/bs";
import { useEditingContext } from "components/contexts/EditingContext";
import { confirm } from "components/dashboard/DeleteConfirmation";
import styled from "styled-components";
import PropTypes from "prop-types";

const StyledDiv = styled.div`
  margin: auto;
`;

function DashboardSelector({ initialDashboard }) {
  const { setLayoutContext, getLayoutContext } = useLayoutContext();
  const { name } = useLayoutNameContext();
  const editableDashboard = useLayoutEditableContext();
  const { availableDashboards } = useAvailableDashboardsContext();
  const {
    dashboardDropdownOptions,
    selectedDashboardDropdownOption,
    setSelectedDashboardDropdownOption,
  } = useDashboardDropdownContext();
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useEditingContext();

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
    } else {
      let selectedDashboard = availableDashboards[e.value];
      setSelectedDashboardDropdownOption({
        value: e.value,
        label: selectedDashboard["label"],
      });
      setLayoutContext(selectedDashboard);
    }
    setIsEditing(false);
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

  return (
    <StyledDiv>
      <DashboardSelect
        options={dashboardDropdownOptions}
        value={selectedDashboardDropdownOption}
        onChange={updateLayout}
      />
      {selectedDashboardDropdownOption && (
        <>
          {editableDashboard && (
            <>
              {isEditing && (
                <>
                  <TooltipButton
                    tooltipPlacement="bottom"
                    tooltipText="Cancel Changes"
                    onClick={onCancel}
                    aria-label={"cancelButton"}
                  >
                    <BsArrowReturnLeft size="1.5rem" />
                  </TooltipButton>
                  <TooltipButton
                    tooltipPlacement="bottom"
                    tooltipText="Save Changes"
                    form="gridUpdate"
                    type="submit"
                    aria-label={"saveButton"}
                  >
                    <BsFloppy size="1.5rem" />
                  </TooltipButton>
                  <TooltipButton
                    tooltipPlacement="bottom"
                    tooltipText="Add Dashboard Item"
                    onClick={onAddGridItem}
                    aria-label={"addGridItemButton"}
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
