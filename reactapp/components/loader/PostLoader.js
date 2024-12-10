import PropTypes from "prop-types";
import { useState, useEffect, useContext } from "react";
import LoadingAnimation from "components/loader/LoadingAnimation";
import appAPI from "services/api/app";
import {
  AppContext,
  UserSettingsContext,
  VariableInputsContext,
  LayoutContext,
  AvailableDashboardsContext,
  DashboardDropdownContext,
  EditingContext,
  DataViewerModeContext,
} from "components/contexts/Contexts";
import { confirm } from "components/dashboard/DeleteConfirmation";

const PostLoader = ({ children }) => {
  const { csrf, userSettings, dashboards } = useContext(AppContext);

  const [isLoaded, setIsLoaded] = useState(false);
  const [updatedUserSettings, setUpdatedUserSettings] = useState(userSettings);
  const [variableInputValues, setVariableInputValues] = useState({});
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [accessGroups, setAccessGroups] = useState([]);
  const [editable, setEditable] = useState(false);
  const [notes, setNotes] = useState("");
  const [gridItems, setGridItems] = useState([]);
  const [availableDashboards, setAvailableDashboards] = useState(null);
  const [dashboardDropdownOptions, setDashboardDropdownOptions] = useState([]);
  const [selectedDashboardDropdownOption, setSelectedDashboardDropdownOption] =
    useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [inDataViewerMode, setInDataViewerMode] = useState(false);

  useEffect(() => {
    // Setting up dashboard dropdown
    let createOption = {
      value: "Create a New Dashboard",
      label: "Create a New Dashboard",
      color: "lightblue",
    };
    let publicOptions = [];
    let privateOptions = [];
    for (const [name, details] of Object.entries(dashboards)) {
      if (details.editable) {
        privateOptions.push({ value: name, label: details.label });
      } else {
        publicOptions.push({ value: name, label: details.label });
      }
    }

    setDashboardDropdownOptions([
      createOption,
      { label: "Public", options: publicOptions },
      { label: "User", options: privateOptions },
    ]);
    setAvailableDashboards(dashboards);
    setIsLoaded(true);
    // eslint-disable-next-line
  }, []);

  async function updateUserSettings(updatedProperties) {
    const newUserSettings = {
      ...updatedUserSettings,
      ...updatedProperties,
    };
    const apiResponse = await appAPI.updateUserSettings(newUserSettings, csrf);
    if (apiResponse["success"]) {
      setUpdatedUserSettings(newUserSettings);
    }
    return apiResponse;
  }

  function updateVariableInputValuesWithGridItems(gridItems) {
    const updatedVariableInputValues = {};
    for (let gridItem of gridItems) {
      const args = JSON.parse(gridItem.args_string);

      if (gridItem.source === "Variable Input") {
        if (args.variable_name in variableInputValues) {
          // Keep current selected value for dependent visualizations
          updatedVariableInputValues[args.variable_name] =
            variableInputValues[args.variable_name];
        } else {
          updatedVariableInputValues[args.variable_name] =
            args.initial_value.value || args.initial_value;
        }
      }
    }
    setVariableInputValues(updatedVariableInputValues);
  }

  function resetLayoutContext() {
    setName("");
    setLabel("");
    setAccessGroups([]);
    setNotes("");
    setGridItems([]);
    setEditable(false);
    updateVariableInputValuesWithGridItems([]);
  }

  function setLayoutContext(dashboardContext) {
    setName(dashboardContext["name"]);
    setLabel(dashboardContext["label"]);
    setAccessGroups(dashboardContext["accessGroups"]);
    setNotes(dashboardContext["notes"]);
    setGridItems(dashboardContext["gridItems"]);
    setEditable(dashboardContext["editable"]);
    updateVariableInputValuesWithGridItems(dashboardContext["gridItems"]);
  }

  function getLayoutContext() {
    return {
      name: name,
      label: label,
      accessGroups: accessGroups,
      notes: notes,
      gridItems: gridItems,
      editable: editable,
    };
  }

  function addOptionFromDashboardDropdownOptions(
    options,
    optionName,
    optionLabel
  ) {
    const userOptions = options.find(({ label }) => label === "User");
    const userOptionsIndex = options.indexOf(userOptions);
    userOptions["options"].push({ value: optionName, label: optionLabel });
    return options.toSpliced(userOptionsIndex, 1, userOptions);
  }

  async function copyCurrentDashboard() {
    const originalDashboard = getLayoutContext();
    const dashboardName = originalDashboard["name"] + "_copy";
    const dashboardLabel = originalDashboard["label"] + " Copy";

    const newDashboardData = {
      name: dashboardName,
      label: dashboardLabel,
    };
    const copiedLayoutContext = {
      ...originalDashboard,
      ...newDashboardData,
    };
    const apiResponse = await addDashboard(copiedLayoutContext);
    return apiResponse;
  }

  async function addDashboard(dashboardContext) {
    const apiResponse = await appAPI.addDashboard(dashboardContext, csrf);
    if (apiResponse.success) {
      const newDashboard = apiResponse["new_dashboard"];
      let OGLayouts = Object.assign({}, availableDashboards);
      OGLayouts[newDashboard.name] = newDashboard;
      setAvailableDashboards(OGLayouts);
      const updatedSelectOptions = addOptionFromDashboardDropdownOptions(
        dashboardDropdownOptions,
        newDashboard.name,
        newDashboard.label
      );
      setDashboardDropdownOptions(updatedSelectOptions);
      setLayoutContext(newDashboard);
      setSelectedDashboardDropdownOption({
        value: newDashboard.name,
        label: newDashboard.label,
      });
    }
    return apiResponse;
  }

  function deleteOptionFromDashboardDropdownOptions(options, optionName) {
    const userOptions = options.find(({ label }) => label === "User");
    const userOptionsIndex = options.indexOf(userOptions);
    const deletedOptionIndex = userOptions["options"].findIndex(
      (x) => x.value === optionName
    );
    const updatedUserOptions = userOptions["options"].toSpliced(
      deletedOptionIndex,
      1
    );
    return options.toSpliced(userOptionsIndex, 1, {
      label: "User",
      options: updatedUserOptions,
    });
  }

  async function deleteDashboard() {
    const selectedOptionValue = selectedDashboardDropdownOption["value"];

    if (
      await confirm(
        "Are you sure you want to delete the " +
          selectedOptionValue +
          " dashboard?"
      )
    ) {
      const apiResponse = await appAPI.deleteDashboard(
        { name: selectedOptionValue },
        csrf
      );
      if (apiResponse["success"]) {
        const newavailableDashboards = Object.fromEntries(
          Object.entries(availableDashboards).filter(
            ([key]) => key !== selectedOptionValue
          )
        );
        const updatedSelectOptions = deleteOptionFromDashboardDropdownOptions(
          dashboardDropdownOptions,
          selectedOptionValue
        );
        setAvailableDashboards(newavailableDashboards);
        setDashboardDropdownOptions(updatedSelectOptions);
        setSelectedDashboardDropdownOption(null);
        resetLayoutContext();
      }
      return apiResponse;
    } else {
      return {
        confirmExit: true,
      };
    }
  }

  async function updateDashboard(updatedProperties) {
    const originalDashboard = getLayoutContext();
    const originalName = originalDashboard["name"];
    const originalLabel = originalDashboard["label"];
    const originalAccessGroups = originalDashboard["accessGroups"];

    updatedProperties["originalName"] = originalName;
    updatedProperties["originalLabel"] = originalLabel;
    updatedProperties["originalAccessGroups"] = originalAccessGroups;
    const updatedLayoutContext = {
      ...originalDashboard,
      ...updatedProperties,
    };
    const apiResponse = await appAPI.updateDashboard(
      updatedLayoutContext,
      csrf
    );
    if (apiResponse["success"]) {
      let newavailableDashboards = Object.assign({}, availableDashboards);
      delete newavailableDashboards[originalName];

      const updatedDashboard = apiResponse["updated_dashboard"];
      const name = updatedDashboard["name"];
      const label = updatedDashboard["label"];
      newavailableDashboards[name] = updatedDashboard;
      if (originalName !== name || originalLabel !== label) {
        let updatedSelectOptions = deleteOptionFromDashboardDropdownOptions(
          dashboardDropdownOptions,
          originalName
        );
        updatedSelectOptions = addOptionFromDashboardDropdownOptions(
          updatedSelectOptions,
          name,
          label
        );
        setDashboardDropdownOptions(updatedSelectOptions);
      }
      setSelectedDashboardDropdownOption({ value: name, label: label });
      setAvailableDashboards(newavailableDashboards);
      setLayoutContext(apiResponse["updated_dashboard"]);
    }
    return apiResponse;
  }

  if (!isLoaded) {
    return <LoadingAnimation />;
  } else {
    return (
      <>
        <UserSettingsContext.Provider
          value={{ updatedUserSettings, updateUserSettings }}
        >
          <VariableInputsContext.Provider
            value={{
              variableInputValues,
              setVariableInputValues,
              updateVariableInputValuesWithGridItems,
            }}
          >
            <LayoutContext.Provider
              value={{ setLayoutContext, resetLayoutContext, getLayoutContext }}
            >
              <AvailableDashboardsContext.Provider
                value={{
                  availableDashboards,
                  setAvailableDashboards,
                  addDashboard,
                  deleteDashboard,
                  updateDashboard,
                  copyCurrentDashboard,
                }}
              >
                <DashboardDropdownContext.Provider
                  value={{
                    dashboardDropdownOptions,
                    selectedDashboardDropdownOption,
                    setSelectedDashboardDropdownOption,
                  }}
                >
                  <EditingContext.Provider value={{ isEditing, setIsEditing }}>
                    <DataViewerModeContext.Provider
                      value={{
                        inDataViewerMode,
                        setInDataViewerMode,
                      }}
                    >
                      {children}
                    </DataViewerModeContext.Provider>
                  </EditingContext.Provider>
                </DashboardDropdownContext.Provider>
              </AvailableDashboardsContext.Provider>
            </LayoutContext.Provider>
          </VariableInputsContext.Provider>
        </UserSettingsContext.Provider>
      </>
    );
  }
};

PostLoader.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.element),
    PropTypes.element,
  ]),
};

export default PostLoader;
