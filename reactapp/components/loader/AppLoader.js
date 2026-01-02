import PropTypes from "prop-types";
import { useState, useEffect, memo, useCallback, useMemo } from "react";
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
  PermissionGroupContext,
} from "components/contexts/Contexts";
import { Route } from "react-router-dom";
import NotFound from "components/error/NotFound";
import DashboardView from "views/Dashboard";
import LandingPage from "views/LandingPage";
import AppTourContextProvider from "components/contexts/AppTourContext";
import {
  handleGridItemExport,
  handleGridItemImport,
} from "components/dashboard/DashboardItem";
import IdleTimerManager from "components/loader/IdleTimerManager";
import WebsocketProvider from "components/contexts/WebSocketContext";
import { v4 as uuidv4 } from "uuid";

const APP_ID = process.env.TETHYS_APP_ID;
const LOADER_DELAY = process.env.TETHYS_LOADER_DELAY;
const contactUsEmail = process.env.TETHYSDASH_SUPPORT_EMAIL;
const contactUsGitHub = process.env.TETHYSDASH_SUPPORT_GITHUB;

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
  for (const dashboard of dashboards) {
    dashboardRoutes.push(
      <Route
        path={`/dashboard/${dashboard.uuid}`}
        element={<DashboardView {...dashboard} />}
        key={`route-${dashboard.uuid}`}
      />
    );
  }
  const allRoutes = [...baseRoutes, ...dashboardRoutes];

  return allRoutes;
}

function Loader({ children }) {
  const [error, setError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [appContext, setAppContext] = useState(null);
  const [availableDashboards, setAvailableDashboards] = useState([]);
  const [permissionGroups, setPermissionGroups] = useState([]);

  const handleError = (error) => {
    setTimeout(() => {
      setError(error);
    }, LOADER_DELAY);
  };

  useEffect(() => {
    if (availableDashboards.length > 0) {
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
      let userAppPermissions = [];

      try {
        tethysSession = await tethysAPI.getSession();
      } catch (error) {
        if (error.response.status !== 401) {
          handleError(error);
          return;
        }
      }

      try {
        if (tethysSession) {
          [
            tethysApp,
            user,
            csrf,
            dashboards,
            visualizations,
            userAppPermissions,
          ] = await Promise.all([
            tethysAPI.getAppData(APP_ID),
            tethysAPI.getUserData(),
            tethysAPI.getCSRF(),
            appAPI.listDashboards(),
            appAPI.listVisualizations(),
            appAPI.getUserAppPermissions(),
          ]);
        } else {
          [tethysApp, dashboards, visualizations] = await Promise.all([
            tethysAPI.getAppData(APP_ID),
            appAPI.listDashboards(),
            appAPI.listVisualizations(),
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
          {
            source: "Live Chat",
            value: "Live Chat",
            label: "Live Chat",
            type: "liveChat",
            args: {},
            tags: ["chat", "default"],
            description:
              "A live chart box that allows users to send and receive messages with other users.",
          },
        ],
      });

      tethysApp.customSettings = {
        support_email: contactUsEmail,
        support_github: contactUsGitHub,
        ...(dashboards.support_info || {}),
      };

      setAppContext({
        tethysApp,
        user,
        csrf,
        routes: setupRoutes(dashboards.dashboards),
        visualizations: allVisualizations,
        mapLayerTemplates,
        visualizationArgs,
        userAppPermissions: userAppPermissions.permissions,
      });
      setPermissionGroups(dashboards.permission_groups);
      setAvailableDashboards(dashboards.dashboards);

      // Allow for minimum delay to display loader
      setTimeout(() => {
        setIsLoaded(true);
      }, LOADER_DELAY);
    };

    loadAppData();

    // eslint-disable-next-line
  }, []);

  const copyDashboard = useCallback(
    async (id, name) => {
      // let the user input a new name
      const apiResponse = await appAPI.copyDashboard(
        { id, newName: `${name} - Copy` },
        appContext.csrf
      );
      if (apiResponse.success) {
        const newDashboard = apiResponse.new_dashboard;
        setAvailableDashboards([...availableDashboards, newDashboard]);
      }
      return apiResponse;
    },
    [appContext, availableDashboards]
  );

  const addDashboard = useCallback(
    async (dashboardContext) => {
      const apiResponse = await appAPI.addDashboard(
        dashboardContext,
        appContext.csrf
      );
      if (apiResponse.success) {
        const newDashboard = apiResponse.new_dashboard;
        setAvailableDashboards([...availableDashboards, newDashboard]);
      }
      return apiResponse;
    },
    [appContext, availableDashboards]
  );

  const deleteDashboard = useCallback(
    async (id) => {
      const apiResponse = await appAPI.deleteDashboard({ id }, appContext.csrf);
      if (apiResponse["success"]) {
        setAvailableDashboards(availableDashboards.filter((d) => d.id !== id));
      }
      return apiResponse;
    },
    [appContext, availableDashboards]
  );

  const importDashboard = useCallback(
    async (dashboardContext) => {
      if (!("name" in dashboardContext)) {
        return { success: false, message: "Dashboards must include a name" };
      }
      dashboardContext.uuid = uuidv4();

      if (dashboardContext.gridItems && dashboardContext.gridItems.length > 0) {
        const updatedGridItems = [];
        for (let gridItem of dashboardContext.gridItems) {
          const { success, message, importedGridItem } =
            await handleGridItemImport(
              gridItem,
              appContext.csrf,
              dashboardContext.uuid
            );
          if (success) {
            updatedGridItems.push(importedGridItem);
          } else {
            return { success, message };
          }
        }
        dashboardContext.gridItems = updatedGridItems;
      }

      if (dashboardContext.tabs && dashboardContext.tabs.length > 0) {
        const updatedTabs = [];
        for (let tab of dashboardContext.tabs) {
          const updatedGridItems = [];
          for (let gridItem of tab.gridItems) {
            const { success, message, importedGridItem } =
              await handleGridItemImport(
                gridItem,
                appContext.csrf,
                dashboardContext.uuid
              );
            if (success) {
              updatedGridItems.push(importedGridItem);
            } else {
              return { success, message };
            }
          }
          updatedTabs.push({ ...tab, gridItems: updatedGridItems });
        }
        dashboardContext.tabs = updatedTabs;
      }

      const apiResponse = await addDashboard(dashboardContext);
      return apiResponse;
    },
    [appContext, addDashboard]
  );

  const exportDashboard = useCallback(
    async (id) => {
      const apiResponse = await appAPI.getDashboard({ id });
      if (apiResponse.success) {
        const { id, tabs, uuid, ...dashboardProperties } =
          apiResponse.dashboard;

        const exportedTabs = [];
        for (const tab of tabs) {
          const updatedGridItems = [];
          for (const gridItem of tab.gridItems) {
            const exportedGridItem = await handleGridItemExport(gridItem, uuid);
            updatedGridItems.push(exportedGridItem);
          }
          exportedTabs.push({ ...tab, gridItems: updatedGridItems });
        }

        const exportedDashboard = {
          ...dashboardProperties,
          tabs: exportedTabs,
        };

        try {
          downloadJSONFile(exportedDashboard, `${exportedDashboard.name}.json`);
        } catch (err) {
          return { success: false };
        }
      }

      return apiResponse;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appContext]
  );

  const updateDashboard = useCallback(
    async ({ id, newProperties }) => {
      const apiResponse = await appAPI.updateDashboard(
        { ...newProperties, id },
        appContext.csrf
      );
      if (apiResponse.success) {
        const updatedDashboard = apiResponse.updated_dashboard;
        setAvailableDashboards(
          availableDashboards.map((d) =>
            d.id === updatedDashboard.id ? updatedDashboard : d
          )
        );
      }
      return apiResponse;
    },
    [appContext, availableDashboards]
  );

  const updatePermissionGroup = useCallback(
    async (updatedPermissionGroup) => {
      const apiResponse = await appAPI.updatePermissionGroup(
        updatedPermissionGroup,
        appContext.csrf
      );
      if (apiResponse.success) {
        const responsePermissionGroup = apiResponse.updated_permission_group;
        setPermissionGroups((existingPermissionGroups) => {
          if (updatedPermissionGroup.id) {
            return existingPermissionGroups.map((g) =>
              g.id === responsePermissionGroup.id ? responsePermissionGroup : g
            );
          } else {
            return [...existingPermissionGroups, responsePermissionGroup];
          }
        });
      }
      return apiResponse;
    },
    [appContext]
  );

  const deletePermissionGroup = useCallback(
    async (id) => {
      const apiResponse = await appAPI.deletePermissionGroup(
        { id },
        appContext.csrf
      );
      if (apiResponse.success) {
        setPermissionGroups((existingPermissionGroups) =>
          existingPermissionGroups.filter((g) => g.id !== id)
        );
      }
      return apiResponse;
    },
    [appContext]
  );

  // Always call hooks in the same order
  const appContextValue = useMemo(() => appContext, [appContext]);
  const permissionGroupContextValue = useMemo(
    () => ({
      permissionGroups,
      updatePermissionGroup,
      deletePermissionGroup,
    }),
    [permissionGroups, updatePermissionGroup, deletePermissionGroup]
  );
  const availableDashboardsContextValue = useMemo(
    () => ({
      availableDashboards,
      setAvailableDashboards,
      addDashboard,
      deleteDashboard,
      copyDashboard,
      updateDashboard,
      exportDashboard,
      importDashboard,
    }),
    [
      availableDashboards,
      addDashboard,
      deleteDashboard,
      copyDashboard,
      updateDashboard,
      exportDashboard,
      importDashboard,
      setAvailableDashboards,
    ]
  );

  if (error) {
    // Throw error so it will be caught by the ErrorBoundary
    throw error;
  }
  if (!isLoaded) {
    return <LoadingAnimation text="Loading TethysDash..." />;
  }
  return (
    <>
      <AppContext.Provider value={appContextValue}>
        <PermissionGroupContext.Provider value={permissionGroupContextValue}>
          <AvailableDashboardsContext.Provider
            value={availableDashboardsContextValue}
          >
            <AppTourContextProvider>
              <WebsocketProvider>
                {children}
                <IdleTimerManager />
              </WebsocketProvider>
            </AppTourContextProvider>
          </AvailableDashboardsContext.Provider>
        </PermissionGroupContext.Provider>
      </AppContext.Provider>
    </>
  );
}

Loader.propTypes = {
  children: PropTypes.node,
};

export default memo(Loader);
