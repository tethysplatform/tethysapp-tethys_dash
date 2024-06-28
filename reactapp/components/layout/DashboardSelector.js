import { useEffect, useContext } from "react";
import SelectInput from "components/inputs/SelectInput";
import HeaderButton from "components/buttons/HeaderButton";
import NewDashboardModal from "components/modals/NewDashboard";
import DashboardNotesModal from "components/modals/DashboardNotes";
import {
  useLayoutContext,
  useLayoutNameContext,
} from "components/contexts/SelectedDashboardContext";
import { useAvailableOptionsContext } from "components/contexts/AvailableOptionsContext";
import { useAvailableDashboardContext } from "components/contexts/AvailableDashboardContext";
import { useSelectedOptionContext } from "components/contexts/SelectedOptionContext";
import { useAddDashboardModalShowContext } from "components/contexts/AddDashboardModalShowContext";
import { useDashboardNotesModalShowContext } from "components/contexts/DashboardNotesModalShowContext";
import appAPI from "services/api/app";
import {
  BsArrowReturnLeft,
  BsSave,
  BsPencilSquare,
  BsFileText,
  BsTrash,
} from "react-icons/bs";
import { useEditingContext } from "components/contexts/EditingContext";
import { AppContext } from "components/contexts/AppContext";

function DashboardSelector() {
  const setLayoutContext = useLayoutContext()[0];
  const resetLayoutContext = useLayoutContext()[1];
  const name = useLayoutNameContext()[0];
  const [selectOptions, setSelectOptions] = useAvailableOptionsContext();
  const [dashboardLayoutConfigs, setDashboardLayoutConfigs] =
    useAvailableDashboardContext();
  const [selectedOption, setSelectedOption] = useSelectedOptionContext();
  const [showAddDashboardModal, setShowAddDashboardModal] =
    useAddDashboardModalShowContext();
  const [showNotesModal, setShowNotesModal] =
    useDashboardNotesModalShowContext();
  const [isEditing, setIsEditing] = useEditingContext();
  const { csrf } = useContext(AppContext);

  useEffect(() => {
    appAPI.getDashboards().then((data) => {
      let options = [
        {
          value: "Create a New Dashboard",
          label: "Create a New Dashboard",
          color: "rgb(156, 156, 156, .5)",
        },
      ];
      for (const [name, details] of Object.entries(data)) {
        options.push({ value: name, label: details.label });
      }
      setSelectOptions(options);
      setDashboardLayoutConfigs(data);
    });
    // eslint-disable-next-line
  }, []);

  function updateLayout(e) {
    if (e.value === "Create a New Dashboard") {
      setShowAddDashboardModal(true);
    } else {
      let selectedDashboard = dashboardLayoutConfigs[e.value];
      setSelectedOption({ value: e.value, label: selectedDashboard["label"] });
      setLayoutContext(selectedDashboard);
    }
  }

  async function onDelete(e) {
    const selectedOptionValue = selectedOption["value"];

    if (
      window.confirm(
        "Are your sure you want to delete the " +
          selectedOptionValue +
          " dashboard?",
      )
    ) {
      const newdashboardLayoutConfigs = Object.fromEntries(
        Object.entries(dashboardLayoutConfigs).filter(
          ([key]) => key !== selectedOptionValue,
        ),
      );
      const newSelectOptions = selectOptions.filter(
        (options) => JSON.stringify(options) !== JSON.stringify(selectedOption),
      );
      appAPI
        .deleteDashboard({ name: selectedOptionValue }, csrf)
        .then((response) => {
          setDashboardLayoutConfigs(newdashboardLayoutConfigs);
          setSelectOptions(newSelectOptions);
          setSelectedOption(null);
          resetLayoutContext();
        });
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
      JSON.stringify(dashboardLayoutConfigs[name]),
    );
    setLayoutContext(OGLayoutContext);
    setIsEditing(false);
  }

  return (
    <>
      <SelectInput
        options={selectOptions}
        value={selectedOption}
        onChange={updateLayout}
      ></SelectInput>
      {selectedOption && (
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
                form="rowUpdate"
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
            tooltipText="Open Notes"
            onClick={onNotes}
          >
            <BsFileText size="1.5rem" />
          </HeaderButton>
          <HeaderButton
            tooltipPlacement="bottom"
            tooltipText="Delete Dashboard"
            onClick={onDelete}
          >
            <BsTrash size="1.5rem" />
          </HeaderButton>
        </>
      )}
      {showAddDashboardModal && <NewDashboardModal />}
      {showNotesModal && <DashboardNotesModal />}
    </>
  );
}

export default DashboardSelector;
