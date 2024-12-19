import PropTypes from "prop-types";
import { useContext, useEffect } from "react";
import { render } from "@testing-library/react";
import { Route } from "react-router-dom";
import {
  mockedDashboards,
  mockedVisualizationsWithDefaults,
  mockedVisualizationArgs,
  mockedUserSetting,
} from "__tests__/utilities/constants";
import NotFound from "components/error/NotFound";
import DashboardView from "views/dashboard/Dashboard";
import PostLoader from "components/loader/PostLoader";
import {
  AppContext,
  LayoutContext,
  DashboardDropdownContext,
  AvailableDashboardsContext,
  EditingContext,
  DataViewerModeContext,
  VariableInputsContext,
} from "components/contexts/Contexts";

const TestingComponent = ({ children, options = {} }) => {
  const { setLayoutContext } = useContext(LayoutContext);
  const { setIsEditing } = useContext(EditingContext);
  const { setInDataViewerMode } = useContext(DataViewerModeContext);
  const { setSelectedDashboardDropdownOption } = useContext(
    DashboardDropdownContext
  );
  const { availableDashboards } = useContext(AvailableDashboardsContext);

  useEffect(() => {
    if (options.initialDashboard) {
      let selectedDashboard = availableDashboards[options.initialDashboard];
      setSelectedDashboardDropdownOption({
        value: selectedDashboard.value,
        label: selectedDashboard.label,
      });
      setLayoutContext(selectedDashboard);
    }

    if (options.inEditing) {
      setIsEditing(true);
    }

    if (options.inDataViewerMode) {
      setInDataViewerMode(true);
    }
    // eslint-disable-next-line
  }, []);

  return <>{children}</>;
};

const renderWithLoaders = ({ children, options = {} }) => {
  const tethysApp = {
    title: "TethysDash",
    description: "",
    tags: "",
    package: "tethysdash",
    urlNamespace: "tethysdash",
    color: "",
    icon: "/static/tethysdash/images/tethys_dash.png",
    exitUrl: "/apps/",
    rootUrl: "/apps/tethysdash/",
    settingsUrl: "/admin/tethys_apps/tethysapp/999/change/",
  };

  const user = { isAuthenticated: true, isStaff: true };

  const csrf = "Token";

  const PATH_HOME = "/",
    PATH_DASHBOARD = "/dashboard";
  const routes = [
    <Route path={PATH_HOME} element={<DashboardView />} key="route-home" />,
    <Route
      path={PATH_DASHBOARD}
      element={<DashboardView />}
      key="route-dashboard"
    />,
  ];

  for (const name of Object.keys(mockedDashboards)) {
    routes.push(
      <Route
        key={"dashboard-not-found"}
        path="/dashboard/*"
        element={<NotFound />}
      />,
      <Route
        path={"/dashboard/" + name}
        element={<DashboardView initialDashboard={name} />}
        key={"route-" + name}
      />
    );
  }

  return render(
    <AppContext.Provider
      value={{
        tethysApp: options.tethysApp ? options.tethysApp : tethysApp,
        user: options.user ? options.user : user,
        csrf: options.csrf ? options.csrf : csrf,
        routes: options.routes ? options.routes : routes,
        dashboards: options.dashboards ? options.dashboards : mockedDashboards,
        visualizations: options.visualizations
          ? options.visualizations
          : mockedVisualizationsWithDefaults,
        visualizationArgs: options.visualizationArgs
          ? options.visualizationArgs
          : mockedVisualizationArgs,
        userSettings: options.userSettings
          ? options.userSettings
          : mockedUserSetting,
      }}
    >
      <PostLoader>
        <TestingComponent options={options}>{children}</TestingComponent>
      </PostLoader>
    </AppContext.Provider>
  );
};

export const ContextLayoutPComponent = () => {
  const { getLayoutContext } = useContext(LayoutContext);

  return (
    <p data-testid="layout-context">{JSON.stringify(getLayoutContext())}</p>
  );
};

export const EditingPComponent = () => {
  const { isEditing } = useContext(EditingContext);

  return <p data-testid="editing">{isEditing ? "editing" : "not editing"}</p>;
};

export const DataViewerPComponent = () => {
  const { inDataViewerMode } = useContext(DataViewerModeContext);

  return (
    <p data-testid="dataviewer-mode">
      {inDataViewerMode ? "dataviewer-mode" : "not in dataviewer-mode"}
    </p>
  );
};

export const InputVariablePComponent = () => {
  const { variableInputValues } = useContext(VariableInputsContext);

  return (
    <p data-testid="input-variables">{JSON.stringify(variableInputValues)}</p>
  );
};

renderWithLoaders.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.element),
    PropTypes.element,
  ]),
  options: PropTypes.object,
};

TestingComponent.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.element),
    PropTypes.element,
  ]),
  options: PropTypes.object,
};

export default renderWithLoaders;
