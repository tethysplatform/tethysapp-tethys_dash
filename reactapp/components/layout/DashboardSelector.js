import { useEffect, useContext } from "react";
import DashboardSelect from "components/inputs/DashboardSelect";
import HeaderButton from "components/buttons/HeaderButton";
import NewDashboardModal from "components/modals/NewDashboard";
import DashboardNotesModal from "components/modals/DashboardNotes";
import {
  useLayoutContext,
  useLayoutNameContext,
  useLayoutEditableContext,
} from "components/contexts/SelectedDashboardContext";
import { useAvailableOptionsContext } from "components/contexts/AvailableOptionsContext";
import { useAvailableDashboardContext } from "components/contexts/AvailableDashboardContext";
import { useSelectedOptionContext } from "components/contexts/SelectedOptionContext";
import { useAddDashboardModalShowContext } from "components/contexts/AddDashboardModalShowContext";
import { useDashboardNotesModalShowContext } from "components/contexts/DashboardNotesModalShowContext";
import {
  BsArrowReturnLeft,
  BsSave,
  BsPencilSquare,
  BsFileText,
  BsPlus,
} from "react-icons/bs";
import { useEditingContext } from "components/contexts/EditingContext";
import { AppContext } from "components/contexts/AppContext";
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
  const [selectOptions, setSelectOptions] = useAvailableOptionsContext();
  const dashboardLayoutConfigs = useAvailableDashboardContext()[0];
  const [selectedOption, setSelectedOption] = useSelectedOptionContext();
  const [showAddDashboardModal, setShowAddDashboardModal] =
    useAddDashboardModalShowContext();
  const [showNotesModal, setShowNotesModal] =
    useDashboardNotesModalShowContext();
  const [isEditing, setIsEditing] = useEditingContext();
  const { csrf } = useContext(AppContext);

  useEffect(() => {
    if (dashboardLayoutConfigs) {
      let createOption = {
        value: "Create a New Dashboard",
        label: "Create a New Dashboard",
        color: "lightblue",
      };
      let publicOptions = [];
      let privateOptions = [];
      for (const [name, details] of Object.entries(dashboardLayoutConfigs)) {
        if (details.editable) {
          privateOptions.push({ value: name, label: details.label });
        } else {
          publicOptions.push({ value: name, label: details.label });
        }
      }
      setSelectOptions([
        createOption,
        { label: "Public", options: publicOptions },
        { label: "User", options: privateOptions },
      ]);

      if (initialDashboard) {
        let selectedDashboard = dashboardLayoutConfigs[initialDashboard];
        setSelectedOption({
          value: initialDashboard,
          label: selectedDashboard["label"],
        });
        setLayoutContext(selectedDashboard);
      }
    }
    // eslint-disable-next-line
  }, [dashboardLayoutConfigs]);

  function changeDashboard(e) {
    if (e.value === "Create a New Dashboard") {
      setShowAddDashboardModal(true);
    } else {
      let selectedDashboard = dashboardLayoutConfigs[e.value];
      setSelectedOption({ value: e.value, label: selectedDashboard["label"] });
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

  function onNotes(e) {
    setShowNotesModal(true);
  }

  function onCancel(e) {
    const OGLayoutContext = JSON.parse(
      JSON.stringify(dashboardLayoutConfigs[name])
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
      refresh_rate: 0,
    };
    layout["gridItems"] = [...layout["gridItems"], newGridItem];
    setLayoutContext(layout);
    setIsEditing(true);
  }

  return (
    <StyledDiv>
      <DashboardSelect
        options={selectOptions}
        value={selectedOption}
        onChange={updateLayout}
      ></DashboardSelect>
      {selectedOption && (
        <>
          <HeaderButton
            tooltipPlacement="bottom"
            tooltipText="Open Notes"
            onClick={onNotes}
          >
            <BsFileText size="1.5rem" />
          </HeaderButton>
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
                    <BsSave size="1.5rem" />
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
              <HeaderButton
                tooltipPlacement="bottom"
                tooltipText="Add Dashboard Item"
                onClick={onAddGridItem}
              >
                <BsPlus size="1.5rem" />
              </HeaderButton>
            </>
          )}
        </>
      )}
      {showAddDashboardModal && <NewDashboardModal />}
      {showNotesModal && <DashboardNotesModal />}
    </StyledDiv>
  );
}

DashboardSelector.propTypes = {
  initialDashboard: PropTypes.string,
};

export default DashboardSelector;
