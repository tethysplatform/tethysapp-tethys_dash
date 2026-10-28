import PropTypes from "prop-types";
import Loader from "components/loader/AppLoader";
import { screen, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useContext, useState } from "react";
import appAPI from "services/api/app";
import {
  AppContext,
  AvailableDashboardsContext,
  PermissionGroupContext,
} from "components/contexts/Contexts";
import { mockedDashboards, userDashboard } from "__tests__/utilities/constants";
import { server } from "__tests__/utilities/server";
import { rest } from "msw";
import { baseMapLayers } from "components/visualizations/utilities";
import ErrorBoundary from "components/error/ErrorBoundary";
import { nonDropDownVariableInputTypes } from "components/visualizations/utilities";
import { ModalPriorityProvider } from "components/contexts/ModalPriorityContext";

jest.mock("uuid", () => ({
  v4: () => "12345678",
}));

const TestingComponent = () => {
  const {
    tethysApp,
    user,
    csrf,
    routes,
    visualizations,
    visualizationArgs,
    mapLayerTemplates,
    dynamicMapLayers,
  } = useContext(AppContext);
  const { permissionGroups } = useContext(PermissionGroupContext);
  const { availableDashboards } = useContext(AvailableDashboardsContext);

  return (
    <>
      <p data-testid="tethysApp">{JSON.stringify(tethysApp)}</p>
      <p data-testid="user">{JSON.stringify(user)}</p>
      <p data-testid="csrf">{csrf}</p>
      <p data-testid="routes">
        {JSON.stringify(routes.map((route) => route.key))}
      </p>
      <p data-testid="visualizations">{JSON.stringify(visualizations)}</p>
      <p data-testid="mapLayerTemplates">{JSON.stringify(mapLayerTemplates)}</p>
      <p data-testid="dynamicMapLayers">{JSON.stringify(dynamicMapLayers)}</p>
      <p data-testid="visualizationArgs">{JSON.stringify(visualizationArgs)}</p>
      <p data-testid="availableDashboards">
        {JSON.stringify(availableDashboards)}
      </p>
      <p data-testid="permissionGroups">{JSON.stringify(permissionGroups)}</p>
    </>
  );
};

test("AppLoader", async () => {
  const availableVisualizations = [
    {
      label: "Other",
      options: [
        {
          source: "plugin_source_checkbox",
          value: "plugin_value_checkbox",
          label: "plugin_label_checkbox",
          args: { plugin_arg: "checkbox" },
          type: "some type",
          tags: [],
          description: "",
        },
      ],
    },
    {
      label: "Map Layers",
      options: [
        {
          source: "plugin_source_map_layer",
          value: "plugin_source_map_layer",
          label: "plugin_source_map_layer",
          args: {},
          type: "map_layer",
          tags: [],
          description: "",
        },
      ],
    },
  ];

  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/list/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            visualizations: availableVisualizations,
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    <ModalPriorityProvider>
      <Loader>
        <TestingComponent />
      </Loader>
    </ModalPriorityProvider>,
  );

  expect(await screen.findByTestId("tethysApp")).toHaveTextContent(
    JSON.stringify({
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
      customSettings: {
        support_email: "env_support@tethys.org",
        support_github: "https://github.com/tethysplatform/tethysdash",
      },
    }),
  );

  expect(await screen.findByTestId("user")).toHaveTextContent(
    JSON.stringify({
      username: "admin",
      firstName: "John",
      lastName: "Smith",
      email: "jsmith@tethys.org",
      isAuthenticated: true,
      isStaff: true,
    }),
  );

  expect(await screen.findByTestId("csrf")).toHaveTextContent(
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy",
  );

  expect(await screen.findByTestId("routes")).toHaveTextContent(
    JSON.stringify([
      "route-home",
      "dashboard-not-found",
      "route-user-uuid",
      "route-public-uuid",
    ]),
  );

  expect(await screen.findByTestId("visualizations")).toHaveTextContent(
    JSON.stringify([
      {
        label: "Other",
        options: [
          {
            source: "plugin_source_checkbox",
            value: "plugin_value_checkbox",
            label: "plugin_label_checkbox",
            args: { plugin_arg: "checkbox" },
            type: "some type",
            tags: [],
            description: "",
          },
        ],
      },
      {
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
              show_label: "checkbox",
              variable_options_source: [
                ...nonDropDownVariableInputTypes,
                {
                  label: "Existing Visualization Inputs",
                  options: [
                    {
                      label: "Base Map Layers",
                      value: "Base Map Layers",
                      argOptions: baseMapLayers,
                    },
                    {
                      label: "Other: plugin_label_checkbox - Plugin Arg",
                      value: "Other: plugin_label_checkbox - Plugin Arg",
                      argOptions: "checkbox",
                    },
                  ],
                },
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
      },
    ]),
  );

  expect(await screen.findByTestId("mapLayerTemplates")).toHaveTextContent(
    JSON.stringify([
      {
        source: "plugin_source_map_layer",
        value: "plugin_source_map_layer",
        label: "plugin_source_map_layer",
        args: {},
        type: "map_layer",
        tags: [],
        description: "",
      },
    ]),
  );

  expect(await screen.findByTestId("visualizationArgs")).toHaveTextContent(
    JSON.stringify([
      {
        label: "Base Map Layers",
        value: "Base Map Layers",
        argOptions: baseMapLayers,
      },
      {
        label: "Other: plugin_label_checkbox - Plugin Arg",
        value: "Other: plugin_label_checkbox - Plugin Arg",
        argOptions: "checkbox",
      },
    ]),
  );

  expect(await screen.findByTestId("availableDashboards")).toHaveTextContent(
    JSON.stringify(mockedDashboards.dashboards),
  );

  expect(await screen.findByTestId("permissionGroups")).toHaveTextContent(
    JSON.stringify(mockedDashboards.permission_groups),
  );
});

test("AppLoader, load session error", async () => {
  server.use(
    rest.get("http://api.test/api/session/", (req, res, ctx) => {
      return res(
        ctx.status(500),
        ctx.json({ error: "Internal Server Error" }),
        ctx.set("Content-Type", "application/json"),
      );
    }),
  );

  render(
    <ErrorBoundary>
      <ModalPriorityProvider>
        <Loader>
          <TestingComponent />
        </Loader>
      </ModalPriorityProvider>
    </ErrorBoundary>,
  );

  expect(
    await screen.findByText("AxiosError: Request failed with status code 500"),
  ).toBeInTheDocument();
});

test("AppLoader, load visualization error", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/list/",
      (req, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({ error: "Internal Server Error" }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    <ErrorBoundary>
      <ModalPriorityProvider>
        <Loader>
          <TestingComponent />
        </Loader>
      </ModalPriorityProvider>
    </ErrorBoundary>,
  );

  expect(
    await screen.findByText("AxiosError: Request failed with status code 500"),
  ).toBeInTheDocument();
});

test("AppLoader, support info from dashboards.support_info", async () => {
  // Mock dashboards with support_info override
  const dashboardsWithSupportInfo = {
    dashboards: [userDashboard],
    permission_groups: [],
    support_info: {
      support_email: "override@tethys.org",
      support_github: "https://github.com/override/tethysdash",
    },
  };

  const availableVisualizations = [
    {
      label: "Other",
      options: [
        {
          source: "plugin_source_checkbox",
          value: "plugin_value_checkbox",
          label: "plugin_label_checkbox",
          args: { plugin_arg: "checkbox" },
          type: "some type",
          tags: [],
          description: "",
        },
      ],
    },
    {
      label: "Map Layers",
      options: [
        {
          source: "plugin_source_map_layer",
          value: "plugin_source_map_layer",
          label: "plugin_source_map_layer",
          args: {},
          type: "map_layer",
          tags: [],
          description: "",
        },
      ],
    },
  ];

  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/list/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            visualizations: availableVisualizations,
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/list/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json(dashboardsWithSupportInfo),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  // Render and check support info override
  render(
    <ModalPriorityProvider>
      <Loader>
        <TestingComponent />
      </Loader>
    </ModalPriorityProvider>,
  );

  expect(await screen.findByTestId("tethysApp")).toHaveTextContent(
    JSON.stringify({
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
      customSettings: {
        support_email: "override@tethys.org",
        support_github: "https://github.com/override/tethysdash",
      },
    }),
  );
});

test("AppLoader carries each dynamic map layer plugin's source type, defaulting to GeoJSON", async () => {
  const rasterPlugin = {
    source: "echo_runtime_raster",
    value: "Echo Runtime Raster",
    label: "Echo Runtime Raster",
    args: { mode: "text" },
    type: "map_layer",
    tags: [],
    description: "",
    dynamic_map_layer: true,
    dynamic_map_layer_source: "GeoTIFF",
  };
  // An older backend sends no dynamic_map_layer_source at all.
  const undeclaredPlugin = {
    source: "custom_layer_test",
    value: "Stream Gauges (Dynamic)",
    label: "Stream Gauges (Dynamic)",
    args: {},
    type: "map_layer",
    tags: [],
    description: "",
    dynamic_map_layer: true,
  };
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/list/",
      (req, res, ctx) =>
        res(
          ctx.status(200),
          ctx.json({
            visualizations: [
              {
                label: "Map Layers",
                options: [rasterPlugin, undeclaredPlugin],
              },
            ],
          }),
          ctx.set("Content-Type", "application/json"),
        ),
    ),
  );

  render(
    <ModalPriorityProvider>
      <Loader>
        <TestingComponent />
      </Loader>
    </ModalPriorityProvider>,
  );

  const dynamicMapLayers = JSON.parse(
    (await screen.findByTestId("dynamicMapLayers")).textContent,
  );
  expect(dynamicMapLayers).toEqual([
    {
      label: "Dynamic Map Layers",
      options: [
        rasterPlugin,
        { ...undeclaredPlugin, dynamic_map_layer_source: "GeoJSON" },
      ],
    },
  ]);
});

// importDashboard creates the dashboard first, uploads its layer files under the
// uuid the server minted, then saves its tabs; a failure after the create takes
// the new dashboard back down.
describe("importDashboard", () => {
  const csrf =
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy";
  const created = { id: 77, uuid: "minted-uuid", name: "Imported" };

  // A map whose layer style is inline, so importing it uploads one file.
  const mapItem = (extra = {}) => ({
    i: "1",
    x: 0,
    y: 0,
    w: 10,
    h: 10,
    source: "Map",
    args_string: {
      layers: [
        {
          configuration: {
            type: "VectorLayer",
            props: {
              name: "layer",
              source: { type: "GeoJSON", geojson: "existing.json" },
            },
            style: { "fill-color": "red" },
          },
        },
      ],
    },
    metadata_string: {},
    ...extra,
  });

  const ImportingComponent = ({ file }) => {
    const { availableDashboards, importDashboard } = useContext(
      AvailableDashboardsContext,
    );
    const [result, setResult] = useState(null);
    return (
      <>
        <button
          onClick={async () =>
            setResult(await importDashboard(JSON.parse(JSON.stringify(file))))
          }
        >
          import
        </button>
        <p data-testid="importResult">{JSON.stringify(result)}</p>
        <p data-testid="dashboardNames">
          {JSON.stringify(availableDashboards.map((d) => d.name))}
        </p>
      </>
    );
  };

  ImportingComponent.propTypes = { file: PropTypes.object.isRequired };

  let addDashboard, uploadJSON, updateDashboard, deleteDashboard;
  beforeEach(() => {
    addDashboard = jest
      .spyOn(appAPI, "addDashboard")
      .mockResolvedValue({ success: true, new_dashboard: created });
    uploadJSON = jest
      .spyOn(appAPI, "uploadJSON")
      .mockResolvedValue({ success: true, filename: "12345678.json" });
    updateDashboard = jest
      .spyOn(appAPI, "updateDashboard")
      .mockResolvedValue({ success: true, updated_dashboard: created });
    deleteDashboard = jest
      .spyOn(appAPI, "deleteDashboard")
      .mockResolvedValue({ success: true });
  });
  afterEach(() => jest.restoreAllMocks());

  const runImport = async (file) => {
    render(
      <ModalPriorityProvider>
        <Loader>
          <ImportingComponent file={file} />
        </Loader>
      </ModalPriorityProvider>,
    );
    await userEvent.click(await screen.findByText("import"));
    await waitFor(() =>
      expect(screen.getByTestId("importResult").textContent).not.toBe("null"),
    );
    return {
      result: JSON.parse(screen.getByTestId("importResult").textContent),
      names: JSON.parse(screen.getByTestId("dashboardNames").textContent),
    };
  };

  const listedNames = mockedDashboards.dashboards.map((d) => d.name);

  test("creates the dashboard, uploads under its uuid, then saves the items", async () => {
    const { result, names } = await runImport({
      name: "Imported",
      description: "described",
      uuid: "uuid-from-the-file",
      gridItems: [mapItem({ id: 5, uuid: "exported-uuid" })],
    });

    // Metadata only: no uuid, no grid items, no tabs.
    expect(addDashboard).toHaveBeenCalledWith(
      { name: "Imported", description: "described" },
      csrf,
    );
    expect(addDashboard.mock.calls[0][0]).not.toHaveProperty("uuid");
    expect(uploadJSON).toHaveBeenCalledTimes(1);
    expect(uploadJSON.mock.calls[0][0].dashboard_uuid).toBe("minted-uuid");
    expect(addDashboard.mock.invocationCallOrder[0]).toBeLessThan(
      uploadJSON.mock.invocationCallOrder[0],
    );

    const { id, tabs } = updateDashboard.mock.calls[0][0];
    expect(id).toBe(77);
    expect(tabs).toHaveLength(1);
    expect(tabs[0].name).toBe("Main");
    expect(tabs[0].gridItems).toHaveLength(1);
    expect(tabs[0].gridItems[0]).not.toHaveProperty("id");
    expect(tabs[0].gridItems[0].uuid).toBe("12345678");
    expect(
      JSON.parse(tabs[0].gridItems[0].args_string).layers[0].configuration
        .style,
    ).toBe("12345678.json");

    expect(deleteDashboard).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, new_dashboard: created });
    expect(names).toEqual([...listedNames, "Imported"]);
  });

  test("sends every tab without its id and names an unnamed one", async () => {
    await runImport({
      name: "Imported",
      gridItems: [mapItem()],
      tabs: [
        { id: 3, name: "First", gridItems: [mapItem({ id: 9 })] },
        { id: 4, gridItems: [] },
      ],
    });

    const { tabs } = updateDashboard.mock.calls[0][0];
    expect(tabs.map((tab) => tab.name)).toEqual(["First", "Tab 2"]);
    tabs.forEach((tab) => expect(tab).not.toHaveProperty("id"));
    expect(tabs[0].gridItems).toHaveLength(1);
    expect(tabs[0].gridItems[0]).not.toHaveProperty("id");
    expect(tabs[1].gridItems).toEqual([]);
    // A file with tabs saves only their items; its loose item is not saved.
    expect(tabs.flatMap((tab) => tab.gridItems)).toHaveLength(1);
  });

  test("carries the file's metadata to the create", async () => {
    await runImport({
      name: "Imported",
      description: "described",
      notes: "noted",
      public: true,
      unrestrictedPlacement: false,
      uuid: "uuid-from-the-file",
      gridItems: [mapItem()],
    });

    expect(addDashboard.mock.calls[0][0]).toStrictEqual({
      name: "Imported",
      description: "described",
      notes: "noted",
      public: true,
      unrestrictedPlacement: false,
    });
  });

  test("keeps an exported public dashboard private", async () => {
    await runImport({ name: "Imported", publicDashboard: true });

    expect(addDashboard.mock.calls[0][0].public).toBeUndefined();
  });

  test("an empty file creates the dashboard and saves nothing more", async () => {
    const { result, names } = await runImport({ name: "Imported" });

    expect(updateDashboard).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(names).toEqual([...listedNames, "Imported"]);
  });

  test("an upload failure removes the new dashboard", async () => {
    uploadJSON.mockResolvedValue({ success: false, message: "upload failed" });

    const { result, names } = await runImport({
      name: "Imported",
      gridItems: [mapItem()],
    });

    expect(result).toEqual({ success: false, message: "upload failed" });
    expect(deleteDashboard).toHaveBeenCalledWith({ id: 77 }, csrf);
    expect(updateDashboard).not.toHaveBeenCalled();
    expect(names).toEqual(listedNames);
  });

  test("a save failure removes the new dashboard", async () => {
    updateDashboard.mockResolvedValue({
      success: false,
      message: "save failed",
    });

    const { result, names } = await runImport({
      name: "Imported",
      gridItems: [mapItem()],
    });

    expect(result).toEqual({ success: false, message: "save failed" });
    expect(deleteDashboard).toHaveBeenCalledWith({ id: 77 }, csrf);
    expect(names).toEqual(listedNames);
  });

  test("a thrown error removes the new dashboard", async () => {
    updateDashboard.mockRejectedValue(new Error("network down"));

    const { result, names } = await runImport({
      name: "Imported",
      gridItems: [mapItem()],
    });

    expect(result).toEqual({
      success: false,
      message: "Import failed: network down",
    });
    expect(deleteDashboard).toHaveBeenCalledWith({ id: 77 }, csrf);
    expect(names).toEqual(listedNames);
  });

  test.each([
    [
      "is refused",
      "save failed",
      "save failed.",
      () => deleteDashboard.mockResolvedValue({ success: false }),
    ],
    [
      "throws",
      "Save failed.",
      "Save failed.",
      () => deleteDashboard.mockRejectedValue(new Error("down")),
    ],
  ])(
    "a removal that %s leaves the dashboard listed and says it may be incomplete",
    async (_, saveMessage, reason, failRemoval) => {
      updateDashboard.mockResolvedValue({
        success: false,
        message: saveMessage,
      });
      failRemoval();

      const { result, names } = await runImport({
        name: "Imported",
        gridItems: [mapItem()],
      });

      expect(result).toEqual({
        success: false,
        message: `${reason} The dashboard "Imported" was still created, but it may be missing some or all of its contents, and it could not be removed automatically. Delete it from your dashboard list, then import the file again.`,
      });
      expect(names).toEqual([...listedNames, "Imported"]);
    },
  );

  test("a create failure uploads nothing and removes nothing", async () => {
    addDashboard.mockResolvedValue({ success: false, message: "add failed" });

    const { result, names } = await runImport({
      name: "Imported",
      gridItems: [mapItem()],
    });

    expect(result).toEqual({ success: false, message: "add failed" });
    expect(uploadJSON).not.toHaveBeenCalled();
    expect(deleteDashboard).not.toHaveBeenCalled();
    expect(names).toEqual(listedNames);
  });

  test("a file without a name creates nothing", async () => {
    const { result } = await runImport({ gridItems: [mapItem()] });

    expect(result).toEqual({
      success: false,
      message: "Dashboards must include a name",
    });
    expect(addDashboard).not.toHaveBeenCalled();
  });
});
