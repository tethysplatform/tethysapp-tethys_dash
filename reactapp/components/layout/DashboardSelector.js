import { useEffect } from "react";
import DashboardSelect from "components/inputs/DashboardSelect";
import HeaderButton from "components/buttons/HeaderButton";
import NewDashboardModal from "components/modals/NewDashboard";
import {
  useLayoutContext,
  useLayoutNameContext,
  useLayoutEditableContext,
} from "components/contexts/SelectedDashboardContext";
import {
  useAvailableDashboardsContext,
  useDashboardDropwdownContext,
} from "components/contexts/AvailableDashboardsContext";
import { useAddDashboardModalShowContext } from "components/contexts/AddDashboardModalShowContext";
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
  const setLayoutContext = useLayoutContext()[0];
  const getLayoutContext = useLayoutContext()[2];
  const name = useLayoutNameContext()[0];
  const editableDashboard = useLayoutEditableContext();
  const availableDashboards = useAvailableDashboardsContext()[0];
  const [
    dashboardDropdownOptions,
    selectedDashboardDropdownOption,
    setSelectedDashboardDropdownOption,
  ] = useDashboardDropwdownContext();
  const [showAddDashboardModal, setShowAddDashboardModal] =
    useAddDashboardModalShowContext();
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
      setShowAddDashboardModal(true);
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
      ></DashboardSelect>
      {selectedDashboardDropdownOption && (
        <>
          {editableDashboard && (
            <>
              {isEditing && (
                <>
                  <HeaderButton
                    tooltipPlacement="bottom"
                    tooltipText="Cancel Changes"
                    onClick={onCancel}
                  >
                    <BsArrowReturnLeft size="1.5rem" />
                  </HeaderButton>
                  <HeaderButton
                    tooltipPlacement="bottom"
                    tooltipText="Save Changes"
                    form="gridUpdate"
                    type="submit"
                  >
                    <BsFloppy size="1.5rem" />
                  </HeaderButton>
                  <HeaderButton
                    tooltipPlacement="bottom"
                    tooltipText="Add Dashboard Item"
                    onClick={onAddGridItem}
                  >
                    <BsPlus size="1.5rem" />
                  </HeaderButton>
                </>
              )}
              {!isEditing && (
                <HeaderButton
                  tooltipPlacement="bottom"
                  tooltipText="Edit Dashboard"
                  onClick={onEdit}
                >
                  <BsPencilSquare size="1.5rem" />
                </HeaderButton>
              )}
            </>
          )}
        </>
      )}
      {showAddDashboardModal && <NewDashboardModal />}
    </StyledDiv>
  );
}

DashboardSelector.propTypes = {
  initialDashboard: PropTypes.string,
};

export default DashboardSelector;
