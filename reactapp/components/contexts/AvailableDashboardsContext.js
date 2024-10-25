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

const AvailableDashboardsContext = createContext();
const DashboardDropwdownContext = createContext();

const AvailableDashboardsContextProvider = ({ children }) => {
  const [availableDashboards, setAvailableDashboards] = useState(null);
  const [dashboardDropdownOptions, setDashboardDropdownOptions] = useState([]);
  const [selectedDashboardDropdownOption, setSelectedDashboardDropdownOption] =
    useState(null);
  const [routes, setRoutes] = useRoutesContext();
  const { csrf } = useContext(AppContext);
  const [setLayoutContext, resetLayoutContext, getLayoutContext] =
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

  async function addDashboard(dashboardName) {
    let response = { success: false };

    let name = dashboardName.replace(" ", "_").toLowerCase();
    let label = dashboardName;
    if (dashboardName in availableDashboards) {
      response["message"] =
        "Dashboard with the name " + dashboardName + " already exists.";
      return response;
    }

    const inputData = {
      name: name,
      label: label,
      notes: "",
    };
    const apiResponse = await appAPI.addDashboard(inputData, csrf);
    if (apiResponse["success"]) {
      let OGLayouts = Object.assign({}, availableDashboards);
      OGLayouts[name] = apiResponse["new_dashboard"];
      setAvailableDashboards(OGLayouts);
      const userOptions = dashboardDropdownOptions.find(
        ({ label }) => label === "User"
      );
      const userOptionsIndex = dashboardDropdownOptions.indexOf(userOptions);
      userOptions["options"].push({ value: name, label: label });
      const updatedSelectOptions = dashboardDropdownOptions.toSpliced(
        userOptionsIndex,
        1,
        userOptions
      );
      setDashboardDropdownOptions(updatedSelectOptions);
      setLayoutContext(apiResponse["new_dashboard"]);
      setSelectedDashboardDropdownOption({ value: name, label: label });
      response["success"] = true;
    } else {
      response["message"] = "Failed to add dashboard. Check server logs.";
    }
    return response;
  }

  async function deleteDashboard() {
    const selectedOptionValue = selectedDashboardDropdownOption["value"];

    if (
      await confirm(
        "Are your sure you want to delete the " +
          selectedOptionValue +
          " dashboard?"
      )
    ) {
      const newavailableDashboards = Object.fromEntries(
        Object.entries(availableDashboards).filter(
          ([key]) => key !== selectedOptionValue
        )
      );
      const userOptions = dashboardDropdownOptions.find(
        ({ label }) => label === "User"
      );
      const userOptionsIndex = dashboardDropdownOptions.indexOf(userOptions);
      const deletedOptionIndex = userOptions["options"].findIndex(
        (x) => x.value === selectedOptionValue
      );
      const updatedUserOptions = userOptions["options"].toSpliced(
        deletedOptionIndex,
        1
      );
      const updatedSelectOptions = dashboardDropdownOptions.toSpliced(
        userOptionsIndex,
        1,
        { label: "User", options: updatedUserOptions }
      );
      const apiResponse = await appAPI.deleteDashboard(
        { name: selectedOptionValue },
        csrf
      );
      if (apiResponse["success"]) {
        setAvailableDashboards(newavailableDashboards);
        setDashboardDropdownOptions(updatedSelectOptions);
        setSelectedDashboardDropdownOption(null);
        resetLayoutContext();
      }
      return apiResponse["success"];
    }
  }

  async function updateDashboard(updatedProperties) {
    const updatedLayoutContext = {
      ...getLayoutContext(),
      ...updatedProperties,
    };
    const response = await appAPI.updateDashboard(updatedLayoutContext, csrf);
    if (response["success"]) {
      const name = response["updated_dashboard"]["name"];
      let OGLayouts = Object.assign({}, availableDashboards);
      OGLayouts[name] = response["updated_dashboard"];
      setAvailableDashboards(OGLayouts);
      setLayoutContext(response["updated_dashboard"]);
    }
    return response["success"];
  }

  return (
    <AvailableDashboardsContext.Provider
      value={[
        availableDashboards,
        setAvailableDashboards,
        addDashboard,
        deleteDashboard,
        updateDashboard,
      ]}
    >
      <DashboardDropwdownContext.Provider
        value={[
          dashboardDropdownOptions,
          selectedDashboardDropdownOption,
          setSelectedDashboardDropdownOption,
        ]}
      >
        {children}
      </DashboardDropwdownContext.Provider>
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

export const useDashboardDropwdownContext = () => {
  return useContext(DashboardDropwdownContext);
};
