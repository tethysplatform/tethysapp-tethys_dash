import PropTypes from "prop-types";
import { useState, useEffect } from "react";
import { spaceAndCapitalize } from "components/modals/utilities";
import {
  nonDropDownVariableInputTypes,
  baseMapLayers,
} from "components/visualizations/utilities";
import tethysAPI from "services/api/tethys";
import appAPI from "services/api/app";
import LoadingAnimation from "components/loader/LoadingAnimation";
import {
  AppContext,
  AvailableDashboardsContext,
} from "components/contexts/Contexts";
import { Route } from "react-router-dom";
import NotFound from "components/error/NotFound";
import DashboardView from "views/Dashboard";
import LandingPage from "views/LandingPage";
import { confirm } from "components/dashboard/DeleteConfirmation";

const APP_ID = process.env.TETHYS_APP_ID;
const LOADER_DELAY = process.env.TETHYS_LOADER_DELAY;

function Loader({ children }) {
  const [error, setError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [appContext, setAppContext] = useState(null);
  const [availableDashboards, setAvailableDashboards] = useState(null);

  const handleError = (error) => {
    // Delay setting the error to avoid flashing the loading animation
    setTimeout(() => {
      setError(error);
    }, LOADER_DELAY);
  };

  const PATH_HOME = "/";
  const baseRoutes = [
    <Route path={PATH_HOME} element={<LandingPage />} key="route-home" />,
    <Route
      key={"dashboard-not-found"}
      path="/dashboard/*"
      element={<NotFound />}
    />,
  ];

  useEffect(() => {
    if (availableDashboards) {
      setAppContext((existingAppContext) => ({
        ...existingAppContext,
        routes: setupRoutes(availableDashboards),
      }));
    }
  }, [availableDashboards]);

  useEffect(() => {
    // Get the session first
    tethysAPI
      .getSession()
      .then(() => {
        // Then load all other app data
        Promise.all([
          tethysAPI.getAppData(APP_ID),
          tethysAPI.getUserData(),
          tethysAPI.getCSRF(),
          appAPI.getDashboards(),
          appAPI.getVisualizations(),
        ])
          .then(([tethysApp, user, csrf, dashboards, visualizations]) => {
            const allVisualizations = visualizations.visualizations;
            const visualizationArgs = [
              {
                label: "Base Map Layers",
                value: "Base Map Layers",
                argOptions: baseMapLayers,
              },
            ];

            for (let optionGroup of allVisualizations) {
              for (let option of optionGroup.options) {
                let args = option.args;
                for (let arg in args) {
                  visualizationArgs.push({
                    label:
                      optionGroup.label +
                      ": " +
                      option.label +
                      " - " +
                      spaceAndCapitalize(arg),
                    value:
                      optionGroup.label +
                      ": " +
                      option.label +
                      " - " +
                      spaceAndCapitalize(arg),
                    argOptions: args[arg],
                  });
                }
              }
            }

            allVisualizations.push({
              label: "Other",
              options: [
                {
                  source: "Map",
                  value: "Map",
                  label: "Map",
                  args: {
                    base_map: baseMapLayers,
                    additional_layers: "custom-AddMapLayer",
                    show_layer_controls: "checkbox",
                  },
                },
                {
                  source: "Custom Image",
                  value: "Custom Image",
                  label: "Custom Image",
                  args: { image_source: "text" },
                },
                {
                  source: "Text",
                  value: "Text",
                  label: "Text",
                  args: { text: "text" },
                },
                {
                  source: "Variable Input",
                  value: "Variable Input",
                  label: "Variable Input",
                  args: {
                    variable_name: "text",
                    variable_options_source: [
                      ...nonDropDownVariableInputTypes,
                      ...[
                        {
                          label: "Existing Visualization Inputs",
                          options: visualizationArgs,
                        },
                      ],
                    ],
                  },
                },
              ],
            });

            // Update app context
            setAppContext({
              tethysApp,
              user,
              csrf,
              routes: setupRoutes(dashboards),
              visualizations: allVisualizations,
              visualizationArgs,
            });
            setAvailableDashboards(dashboards);

            // Allow for minimum delay to display loader
            setTimeout(() => {
              setIsLoaded(true);
            }, LOADER_DELAY);
          })
          .catch(handleError);
      })
      .catch(handleError);
  }, []);

  function setupRoutes(dashboards) {
    const dashboardRoutes = [];
    for (const [name, metadata] of Object.entries(dashboards.user)) {
      dashboardRoutes.push(
        <Route
          path={`/dashboard/user/${name}`}
          element={<DashboardView {...metadata} />}
          key={`route-user-${name}`}
        />
      );
    }

    for (const [name, metadata] of Object.entries(dashboards.public)) {
      dashboardRoutes.push(
        <Route
          path={`/dashboard/public/${name}`}
          element={<DashboardView {...metadata} />}
          key={`route-public-${name}`}
        />
      );
    }
    const allRoutes = [...baseRoutes, ...dashboardRoutes];

    return allRoutes;
  }

  function getUniqueName(name) {
    let newName = `${name} - Copy`;
    let count = 2;

    while (newName in availableDashboards.user) {
      newName = `${name} - Copy (${count})`;
      count++;
    }

    return newName;
  }

  async function copyDashboard(name) {
    const newName = getUniqueName(name);
    const copiedDashboard = { ...availableDashboards["user"][name] };
    copiedDashboard.name = newName;

    return await addDashboard(copiedDashboard);
  }

  async function addDashboard(dashboardContext) {
    const apiResponse = await appAPI.addDashboard(
      dashboardContext,
      appContext.csrf
    );
    if (apiResponse.success) {
      const newDashboard = apiResponse["new_dashboard"];
      let newAvailableDashboards = Object.assign({}, availableDashboards);
      newAvailableDashboards["user"][newDashboard.name] = newDashboard;
      setAvailableDashboards(newAvailableDashboards);
    }
    return apiResponse;
  }

  async function deleteDashboard(name) {
    const apiResponse = await appAPI.deleteDashboard({ name }, appContext.csrf);
    if (apiResponse["success"]) {
      let newAvailableDashboards = Object.assign({}, availableDashboards);
      newAvailableDashboards["user"] = Object.fromEntries(
        Object.entries(availableDashboards.user).filter(([key]) => key !== name)
      );
      setAvailableDashboards(newAvailableDashboards);
    }
    return apiResponse;
  }

  if (error) {
    // Throw error so it will be caught by the ErrorBoundary
    throw error;
  } else if (!isLoaded) {
    return <LoadingAnimation />;
  } else {
    return (
      <>
        <AppContext.Provider value={appContext}>
          <AvailableDashboardsContext.Provider
            value={{
              availableDashboards,
              setAvailableDashboards,
              addDashboard,
              deleteDashboard,
              copyDashboard,
            }}
          >
            {children}
          </AvailableDashboardsContext.Provider>
        </AppContext.Provider>
      </>
    );
  }
}

Loader.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.element),
    PropTypes.element,
    PropTypes.object,
  ]),
};

export default Loader;
