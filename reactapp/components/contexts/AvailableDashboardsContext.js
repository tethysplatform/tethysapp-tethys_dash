import PropTypes from "prop-types";
import { useContext, createContext, useState, useEffect } from "react";
import appAPI from "services/api/app";
import { useRoutesContext } from "components/contexts/RoutesContext";
import { Route } from "react-router-dom";
import DashboardView from "views/dashboard/Dashboard";
import NotFound from "components/error/NotFound";
import { confirm } from "components/dashboard/DeleteConfirmation";
import { AppContext } from "components/contexts/AppContext";
import { useLayoutContext } from "components/contexts/SelectedDashboardContext";

export const AvailableDashboardsContext = createContext();
const DashboardDropdownContext = createContext();

const AvailableDashboardsContextProvider = ({ children }) => {
  const [availableDashboards, setAvailableDashboards] = useState(null);
  const [dashboardDropdownOptions, setDashboardDropdownOptions] = useState([]);
  const [selectedDashboardDropdownOption, setSelectedDashboardDropdownOption] =
    useState(null);
  const { routes, setRoutes } = useRoutesContext();
  const { csrf } = useContext(AppContext);
  const { setLayoutContext, resetLayoutContext, getLayoutContext } =
    useLayoutContext();

  useEffect(() => {
    appAPI.getDashboards().then((data) => {
      // Setting up dynamic routing
      const updatedRoutes = [...routes];
      updatedRoutes.push(
        <Route
          key={"route-not-found"}
          path="/dashboard/*"
          element={<NotFound />}
        />
      );

      // Setting up dashboard dropdown
      let createOption = {
        value: "Create a New Dashboard",
        label: "Create a New Dashboard",
        color: "lightblue",
      };
      let publicOptions = [];
      let privateOptions = [];
      for (const [name, details] of Object.entries(data)) {
        if (details.editable) {
          privateOptions.push({ value: name, label: details.label });
        } else {
          publicOptions.push({ value: name, label: details.label });
        }
        updatedRoutes.push(
          <Route
            path={"/dashboard/" + name}
            element={<DashboardView initialDashboard={name} />}
            key={"route-" + name}
          />
        );
      }

      setDashboardDropdownOptions([
        createOption,
        { label: "Public", options: publicOptions },
        { label: "User", options: privateOptions },
      ]);
      setAvailableDashboards(data);
      setRoutes(updatedRoutes);
    });
    // eslint-disable-next-line
  }, []);

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
    const originalAccessGroups = originalDashboard["access_groups"];

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

  return (
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
        {children}
      </DashboardDropdownContext.Provider>
    </AvailableDashboardsContext.Provider>
  );
};

AvailableDashboardsContextProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
};

export default AvailableDashboardsContextProvider;

export const useAvailableDashboardsContext = () => {
  return useContext(AvailableDashboardsContext);
};

export const useDashboardDropdownContext = () => {
  return useContext(DashboardDropdownContext);
};
