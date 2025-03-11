import PropTypes from "prop-types";
import { useState, useEffect } from "react";
import Form from "react-bootstrap/Form";
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
import AppTourContextProvider from "components/contexts/AppTourContext";
import { Confirmation, confirm } from "components/inputs/DeleteConfirmation";
import { getTethysPortalHost } from "services/utilities";

const APP_ID = process.env.TETHYS_APP_ID;
const LOADER_DELAY = process.env.TETHYS_LOADER_DELAY;

function setupRoutes(dashboards) {
  const PATH_HOME = "/";
  const baseRoutes = [
    <Route path={PATH_HOME} element={<LandingPage />} key="route-home" />,
    <Route
      key={"dashboard-not-found"}
      path="/dashboard/*"
      element={<NotFound />}
    />,
  ];

  const dashboardRoutes = [];
  for (const dashboardMetadata of dashboards.user) {
    dashboardRoutes.push(
      <Route
        path={`/dashboard/user/${dashboardMetadata.name}`}
        element={
          <DashboardView
            editable={true}
            {...dashboardMetadata}
          />
        }
        key={`route-user-${dashboardMetadata.name}`}
      />
    );

    if (dashboardMetadata.accessGroups.includes("public")) {
      dashboardRoutes.push(
        <Route
          path={`/dashboard/public/${dashboardMetadata.name}`}
          element={
            <DashboardView
              editable={false}
              {...dashboardMetadata}
            />
          }
          key={`route-public-${dashboardMetadata.name}`}
        />
      );
    }
  }

  for (const dashboardMetadata of dashboards.public) {
    dashboardRoutes.push(
      <Route
        path={`/dashboard/public/${dashboardMetadata.name}`}
        element={
          <DashboardView
            editable={false}
            {...dashboardMetadata}
          />
        }
        key={`route-public-${dashboardMetadata.name}`}
      />
    );
  }
  const allRoutes = [...baseRoutes, ...dashboardRoutes];

  return allRoutes;
}


function Loader({ children }) {
  const dontShowPublicLoginOnStart = localStorage.getItem("dontShowPublicLoginOnStart");
  const [error, setError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [redirectPublicUser, setRedirectPublicUser] = useState(false);
  const [showRedirectPublicUserModal, setShowRedirectPublicUserModal] = useState(false);
  const [checked, setChecked] = useState(false);
  const [appContext, setAppContext] = useState(null);
  const [availableDashboards, setAvailableDashboards] = useState(null);
  const TETHYS_PORTAL_HOST = getTethysPortalHost();

  const handlePublicUser = (confirmation) => {
    if (!confirmation) {
      window.location.assign(
        `${TETHYS_PORTAL_HOST}/accounts/login?next=${window.location.pathname}`,
      );
      return
    }
    setRedirectPublicUser(false);
    setShowRedirectPublicUserModal(false)
  };

  const handleDontShow = (e) => {
    setChecked(e.target.checked);
    localStorage.setItem("dontShowPublicLoginOnStart", e.target.checked);
  };

  const handleError = (error) => {
    if (error.response.status === 401) {
      setRedirectPublicUser(true);
      if (dontShowPublicLoginOnStart === "false" || !dontShowPublicLoginOnStart) {
        setShowRedirectPublicUserModal(true)
      }
      setTimeout(() => {
        setIsLoaded(true);
      }, LOADER_DELAY);
    } else {
      setTimeout(() => {
        setError(error);
      }, LOADER_DELAY);
    }
  };


  useEffect(() => {
    if (availableDashboards) {
      setAppContext((existingAppContext) => ({
        ...existingAppContext,
        routes: setupRoutes(availableDashboards),
      }));
    }
    // eslint-disable-next-line
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
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (redirectPublicUser) {
      Promise.all([
        tethysAPI.getAppData(APP_ID),
        appAPI.getDashboards(),
        appAPI.getVisualizations(),
      ])
      .then(([tethysApp, dashboards, visualizations]) => {
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
          user: {
            username: "public",
            firstName: "",
            lastName: "",
            email: "",
            isAuthenticated: true,
            isStaff: false
          },
          csrf: null,
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
      .catch((err) => {
        setTimeout(() => {
          setError(err); // Use 'err' instead of 'error'
        }, LOADER_DELAY);
      });
    }
  }, [isLoaded, redirectPublicUser]);

  function getUniqueDashboardName(name) {
    const existingNames = availableDashboards.user.map((obj) => obj.name);
    let newName = `${name} - Copy`;
    let count = 2;

    while (existingNames.includes(newName)) {
      newName = `${name} - Copy (${count})`;
      count++;
    }

    return newName;
  }

  function removeDashboardById({ id, replacementDashboard }) {
    // Reconstruct the object while replacing the matching dashboard
    const newUserDashboards = [];
    for (const dashboard of availableDashboards.user) {
      if (dashboard.id === id) {
        if (replacementDashboard) {
          newUserDashboards.push(replacementDashboard); // Replace with new object
        }
      } else {
        newUserDashboards.push(dashboard); // Keep existing
      }
    }

    return newUserDashboards;
  }

  async function copyDashboard(id, name) {
    const newName = getUniqueDashboardName(name);

    const apiResponse = await appAPI.copyDashboard(
      { id, newName },
      appContext.csrf
    );
    if (apiResponse.success) {
      const newDashboard = apiResponse["new_dashboard"];
      let newAvailableDashboards = JSON.parse(
        JSON.stringify(availableDashboards)
      );
      newAvailableDashboards["user"].push(newDashboard);
      setAvailableDashboards(newAvailableDashboards);
    }
    return apiResponse;
  }

  async function addDashboard(dashboardContext) {
    const apiResponse = await appAPI.addDashboard(
      dashboardContext,
      appContext.csrf
    );
    if (apiResponse.success) {
      const newDashboard = apiResponse["new_dashboard"];
      let newAvailableDashboards = JSON.parse(
        JSON.stringify(availableDashboards)
      );
      newAvailableDashboards["user"].unshift(newDashboard);
      setAvailableDashboards(newAvailableDashboards);
    }
    return apiResponse;
  }

  async function deleteDashboard(id) {
    const apiResponse = await appAPI.deleteDashboard({ id }, appContext.csrf);
    if (apiResponse["success"]) {
      const userDashboards = removeDashboardById({ id });
      setAvailableDashboards({ ...availableDashboards, user: userDashboards });
    }
    return apiResponse;
  }

  async function updateDashboard({ id, newProperties }) {
    const apiResponse = await appAPI.updateDashboard(
      { ...newProperties, id },
      appContext.csrf
    );
    if (apiResponse.success) {
      const updatedDashboard = apiResponse["updated_dashboard"];
      const userDashboards = removeDashboardById({
        id,
        replacementDashboard: updatedDashboard,
      });

      setAvailableDashboards({ ...availableDashboards, user: userDashboards });
    }
    return apiResponse;
  }

  if (error) {
    // Throw error so it will be caught by the ErrorBoundary
    throw error;
  } else if (!isLoaded) {
    return <LoadingAnimation />;
  } else if (showRedirectPublicUserModal) {
    return (
      <Confirmation
        show={showRedirectPublicUserModal}
        okLabel="Proceed Without Signing in"
        cancelLabel="Sign in"
        title="Public User Login"
        confirmation={
          <>
            <div>
              You are not signed in. Sign in to create and update dashboards.
            </div>
            <div style={{ marginTop: ".75rem" }}>
              If you'd like to continue, you will only have access to public dashboards
            </div>
            <Form.Check
              onChange={handleDontShow}
              type="checkbox"
              label="Don't show on startup"
              checked={checked}
              aria-label="dont-show-public-user-on-startup"
              style={{ marginTop: ".75rem" }}
            />
          </>
        }
        proceed={handlePublicUser}
        backdrop={"static"}
      />
    );
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
              updateDashboard,
            }}
          >
            <AppTourContextProvider>{children}</AppTourContextProvider>
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
