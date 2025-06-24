import PropTypes from "prop-types";
import { useState, useEffect } from "react";
import Form from "react-bootstrap/Form";
import { spaceAndCapitalize } from "components/modals/utilities";
import {
  nonDropDownVariableInputTypes,
  baseMapLayers,
  downloadJSONFile,
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
import { Confirmation } from "components/inputs/DeleteConfirmation";
import { getTethysPortalHost } from "services/utilities";
import {
  handleGridItemExport,
  handleGridItemImport,
} from "components/dashboard/DashboardItem";

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
        element={<DashboardView editable={true} {...dashboardMetadata} />}
        key={`route-user-${dashboardMetadata.name}`}
      />
    );

    if (dashboardMetadata.accessGroups.includes("public")) {
      dashboardRoutes.push(
        <Route
          path={`/dashboard/public/${dashboardMetadata.name}`}
          element={<DashboardView editable={false} {...dashboardMetadata} />}
          key={`route-public-${dashboardMetadata.name}`}
        />
      );
    }
  }

  for (const dashboardMetadata of dashboards.public) {
    dashboardRoutes.push(
      <Route
        path={`/dashboard/public/${dashboardMetadata.name}`}
        element={<DashboardView editable={false} {...dashboardMetadata} />}
        key={`route-public-${dashboardMetadata.name}`}
      />
    );
  }
  const allRoutes = [...baseRoutes, ...dashboardRoutes];

  return allRoutes;
}

function Loader({ children }) {
  const dontShowPublicLoginOnStart = localStorage.getItem(
    "dontShowPublicLoginOnStart"
  );
  const [error, setError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showRedirectPublicUserModal, setShowRedirectPublicUserModal] =
    useState(false);
  const [checked, setChecked] = useState(false);
  const [appContext, setAppContext] = useState(null);
  const [availableDashboards, setAvailableDashboards] = useState(null);
  const TETHYS_PORTAL_HOST = getTethysPortalHost();

  const handlePublicUser = (confirmation) => {
    if (!confirmation) {
      window.location.assign(
        `${TETHYS_PORTAL_HOST}/accounts/login?next=${window.location.pathname}`
      );
      return;
    }
    setShowRedirectPublicUserModal(false);
  };

  const handleDontShow = (e) => {
    setChecked(e.target.checked);
    localStorage.setItem("dontShowPublicLoginOnStart", e.target.checked);
  };

  const handleError = (error) => {
    setTimeout(() => {
      setError(error);
    }, LOADER_DELAY);
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
    const loadAppData = async () => {
      let tethysSession;
      let user = {
        username: null,
        firstName: null,
        lastName: null,
        email: null,
        isAuthenticated: true,
        isStaff: false,
      };
      let csrf = null;
      let tethysApp;
      let dashboards;
      let visualizations;
      let allVisualizations = [];
      let mapLayerTemplates = [];
      let visualizationArgs = [];

      try {
        tethysSession = await tethysAPI.getSession();
      } catch (error) {
        if (error.response.status === 401) {
          if (
            dontShowPublicLoginOnStart === "false" ||
            !dontShowPublicLoginOnStart
          ) {
            setShowRedirectPublicUserModal(true);
          }
        } else {
          handleError(error);
          return;
        }
      }

      try {
        if (tethysSession) {
          [tethysApp, user, csrf, dashboards, visualizations] =
            await Promise.all([
              tethysAPI.getAppData(APP_ID),
              tethysAPI.getUserData(),
              tethysAPI.getCSRF(),
              appAPI.getDashboards(),
              appAPI.getVisualizations(),
            ]);
        } else {
          [tethysApp, dashboards, visualizations] = await Promise.all([
            tethysAPI.getAppData(APP_ID),
            appAPI.getDashboards(),
            appAPI.getVisualizations(),
          ]);
        }
      } catch (error) {
        handleError(error);
        return;
      }

      for (const visualizationGroup of visualizations.visualizations) {
        const nonMapLayerItems = visualizationGroup.options.filter(
          (opt) => opt.type !== "map_layer"
        );
        const mapLayerItems = visualizationGroup.options.filter(
          (opt) => opt.type === "map_layer"
        );

        // Collect map_layer items into flat array
        mapLayerTemplates.push(...mapLayerItems);

        // If non-map_layer items exist, preserve the group
        if (nonMapLayerItems.length > 0) {
          allVisualizations.push({
            label: visualizationGroup.label,
            options: nonMapLayerItems,
          });
        }
      }

      visualizationArgs = [
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
        label: "Default",
        options: [
          {
            source: "Map",
            value: "Map",
            label: "Map",
            type: "map",
            args: {
              baseMap: baseMapLayers,
              layerControl: "checkbox",
              layers: "custom-AddMapLayer",
              map_extent: "custom-MapExtent",
              mapDrawing: "custom-MapDrawing",
            },
            tags: ["map", "default"],
            description:
              "A configurable map that allows users to add a basemap and custom layers from a variety of sources.",
          },
          {
            source: "Custom Image",
            value: "Custom Image",
            label: "Custom Image",
            type: "image",
            args: { image_source: "text" },
            tags: ["image", "default", "custom"],
            description:
              "Any publicly available image using the corresponding URL.",
          },
          {
            source: "Text",
            value: "Text",
            label: "Text",
            type: "text",
            args: { text: "text" },
            tags: ["text", "default"],
            description: "A block of formattable text.",
          },
          {
            source: "Variable Input",
            value: "Variable Input",
            label: "Variable Input",
            type: "variableInput",
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
            tags: ["variable", "default", "dynamic"],
            description:
              "An input that acts as a dashboard variable. This variable can be referenced in other visualizations to allow for dynamic updating.",
          },
        ],
      });

      setAppContext({
        tethysApp,
        user,
        csrf,
        routes: setupRoutes(dashboards),
        visualizations: allVisualizations,
        mapLayerTemplates,
        visualizationArgs,
      });
      setAvailableDashboards(dashboards);

      // Allow for minimum delay to display loader
      setTimeout(() => {
        setIsLoaded(true);
      }, LOADER_DELAY);
    };

    loadAppData();

    // eslint-disable-next-line
  }, []);

  function getUniqueDashboardName(name) {
    const existingNames = availableDashboards.user.map((obj) => obj.name);
    if (!existingNames.includes(name)) {
      return name;
    }

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

  async function importDashboard(dashboardContext) {
    if (!("name" in dashboardContext)) {
      return { success: false, message: "Dashboards must include a name" };
    }
    const newName = getUniqueDashboardName(dashboardContext.name);
    dashboardContext.name = newName;

    if (dashboardContext.gridItems && dashboardContext.gridItems.length > 0) {
      const updatedGridItems = [];
      for (let gridItem of dashboardContext.gridItems) {
        const { success, message, importedGridItem } =
          await handleGridItemImport(gridItem, appContext.csrf);
        if (success) {
          updatedGridItems.push(importedGridItem);
        } else {
          return { success, message };
        }
      }
      dashboardContext.gridItems = updatedGridItems;
    }

    const apiResponse = await addDashboard(dashboardContext);
    return apiResponse;
  }

  async function exportDashboard(id) {
    const apiResponse = await appAPI.getDashboard({ id });
    if (apiResponse.success) {
      const { id, gridItems, uuid, ...dashboardProperties } =
        apiResponse.dashboard;

      const updatedGridItems = [];
      for (const gridItem of gridItems) {
        const exportedGridItem = await handleGridItemExport(gridItem);
        updatedGridItems.push(exportedGridItem);
      }

      const exportedDashboard = {
        ...dashboardProperties,
        gridItems: updatedGridItems,
      };

      try {
        downloadJSONFile(exportedDashboard, `${exportedDashboard.name}.json`);
      } catch (err) {
        return { success: false };
      }
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
              If you'd like to continue, you will only have access to public
              dashboards
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
              exportDashboard,
              importDashboard,
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
  children: PropTypes.arrayOf(PropTypes.object),
};

export default Loader;
