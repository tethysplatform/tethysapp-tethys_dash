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
import { AppContext } from "components/contexts/Contexts";
import { Route } from "react-router-dom";
import NotFound from "components/error/NotFound";
import DashboardView from "views/dashboard/Dashboard";

const APP_ID = process.env.TETHYS_APP_ID;
const LOADER_DELAY = process.env.TETHYS_LOADER_DELAY;

function Loader({ children }) {
  const [error, setError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [appContext, setAppContext] = useState(null);

  const handleError = (error) => {
    // Delay setting the error to avoid flashing the loading animation
    setTimeout(() => {
      setError(error);
    }, LOADER_DELAY);
  };

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
                  args: { base_map: baseMapLayers },
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

            const PATH_HOME = "/",
              PATH_DASHBOARD = "/dashboard";
            const routes = [
              <Route
                path={PATH_HOME}
                element={<DashboardView />}
                key="route-home"
              />,
              <Route
                path={PATH_DASHBOARD}
                element={<DashboardView />}
                key="route-dashboard"
              />,
            ];

            for (const name of Object.keys(dashboards)) {
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

            // Update app context
            setAppContext({
              tethysApp,
              user,
              csrf,
              routes,
              dashboards,
              visualizations: allVisualizations,
              visualizationArgs,
            });

            // Allow for minimum delay to display loader
            setTimeout(() => {
              setIsLoaded(true);
            }, LOADER_DELAY);
          })
          .catch(handleError);
      })
      .catch(handleError);
  }, []);

  if (error) {
    // Throw error so it will be caught by the ErrorBoundary
    throw error;
  } else if (!isLoaded) {
    return <LoadingAnimation />;
  } else {
    return (
      <>
        <AppContext.Provider value={appContext}>{children}</AppContext.Provider>
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
