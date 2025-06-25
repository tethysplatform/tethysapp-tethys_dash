import Loader from "components/loader/AppLoader";
import { screen, render } from "@testing-library/react";
import { useContext } from "react";
import {
  AppContext,
  AvailableDashboardsContext,
} from "components/contexts/Contexts";
import { mockedDashboards } from "__tests__/utilities/constants";
import { server } from "__tests__/utilities/server";
import { rest } from "msw";
import { baseMapLayers } from "components/visualizations/utilities";
import ErrorBoundary from "components/error/ErrorBoundary";
import userEvent from "@testing-library/user-event";

const TestingComponent = () => {
  const {
    tethysApp,
    user,
    csrf,
    routes,
    visualizations,
    visualizationArgs,
    mapLayerTemplates,
  } = useContext(AppContext);
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
      <p data-testid="visualizationArgs">{JSON.stringify(visualizationArgs)}</p>
      <p data-testid="availableDashboards">
        {JSON.stringify(availableDashboards)}
      </p>
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
      "http://api.test/apps/tethysdash/visualizations/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            visualizations: availableVisualizations,
          }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    <Loader>
      <TestingComponent />
    </Loader>
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
    })
  );

  expect(await screen.findByTestId("user")).toHaveTextContent(
    JSON.stringify({
      username: "jsmith",
      firstName: "John",
      lastName: "Smith",
      email: "jsmith@tethys.org",
      isAuthenticated: true,
      isStaff: true,
    })
  );

  expect(await screen.findByTestId("csrf")).toHaveTextContent(
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );

  expect(await screen.findByTestId("routes")).toHaveTextContent(
    JSON.stringify([
      "route-home",
      "dashboard-not-found",
      "route-user-editable",
      "route-public-noneditable",
    ])
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
              variable_options_source: [
                "text",
                "number",
                "checkbox",
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
        ],
      },
    ])
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
    ])
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
    ])
  );

  expect(await screen.findByTestId("availableDashboards")).toHaveTextContent(
    JSON.stringify(mockedDashboards)
  );
});

test("AppLoader, public session and continue", async () => {
  server.use(
    rest.get("http://api.test/api/session/", (req, res, ctx) => {
      return res(
        ctx.status(401),
        ctx.json({ error: "Internal Server Error" }),
        ctx.set("Content-Type", "application/json")
      );
    })
  );
  server.use(
    rest.get("http://api.test/apps/tethysdash/dashboards/", (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({ user: [], public: mockedDashboards.public }),
        ctx.set("Content-Type", "application/json")
      );
    })
  );

  delete window.location; // Remove existing location object
  window.location = { assign: jest.fn() }; // Mock location.assign

  render(
    <Loader>
      <TestingComponent />
    </Loader>
  );

  expect(
    await screen.findByText(
      "You are not signed in. Sign in to create and update dashboards."
    )
  ).toBeInTheDocument();

  expect(
    await screen.findByText(
      "If you'd like to continue, you will only have access to public dashboards"
    )
  ).toBeInTheDocument();

  const continueButton = screen.getAllByRole("button")[1];
  await userEvent.click(continueButton);

  expect(window.location.assign).toHaveBeenCalledTimes(0);

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
    })
  );

  expect(await screen.findByTestId("user")).toHaveTextContent(
    JSON.stringify({
      username: null,
      firstName: null,
      lastName: null,
      email: null,
      isAuthenticated: true,
      isStaff: false,
    })
  );

  expect(await screen.findByTestId("csrf")).toHaveTextContent("");

  expect(await screen.findByTestId("routes")).toHaveTextContent(
    JSON.stringify([
      "route-home",
      "dashboard-not-found",
      "route-public-noneditable",
    ])
  );

  expect(await screen.findByTestId("visualizations")).toHaveTextContent([]);

  expect(await screen.findByTestId("visualizationArgs")).toHaveTextContent([]);

  expect(await screen.findByTestId("availableDashboards")).toHaveTextContent(
    JSON.stringify({ user: [], public: mockedDashboards.public })
  );
});

test("AppLoader, public session and sign in", async () => {
  server.use(
    rest.get("http://api.test/api/session/", (req, res, ctx) => {
      return res(
        ctx.status(401),
        ctx.json({ error: "Internal Server Error" }),
        ctx.set("Content-Type", "application/json")
      );
    })
  );
  const localStorageMock = (function () {
    let store = {};

    return {
      getItem(key) {
        return store[key] || null;
      },

      setItem(key, value) {
        store[key] = value.toString();
      },

      removeItem(key) {
        delete store[key];
      },

      clear() {
        store = {};
      },
    };
  })();

  Object.defineProperty(window, "localStorage", { value: localStorageMock });

  delete window.location; // Remove existing location object
  window.location = { assign: jest.fn() }; // Mock location.assign

  render(
    <Loader>
      <TestingComponent />
    </Loader>
  );

  expect(
    await screen.findByText(
      "You are not signed in. Sign in to create and update dashboards."
    )
  ).toBeInTheDocument();

  expect(
    await screen.findByText(
      "If you'd like to continue, you will only have access to public dashboards"
    )
  ).toBeInTheDocument();

  expect(localStorage.getItem("dontShowPublicLoginOnStart")).toEqual(null);
  const dontShowOnStartupInput = screen.getByLabelText(
    "dont-show-public-user-on-startup"
  );
  await userEvent.click(dontShowOnStartupInput);
  expect(dontShowOnStartupInput).toBeChecked();
  expect(localStorage.getItem("dontShowPublicLoginOnStart")).toEqual("true");

  const signInButton = screen.getAllByRole("button")[0];
  await userEvent.click(signInButton);

  expect(window.location.assign).toHaveBeenCalledWith(
    "http://api.test/accounts/login?next=undefined"
  );
  localStorage.clear();
});

test("AppLoader, public session and no sign in prompt", async () => {
  server.use(
    rest.get("http://api.test/api/session/", (req, res, ctx) => {
      return res(
        ctx.status(401),
        ctx.json({ error: "Internal Server Error" }),
        ctx.set("Content-Type", "application/json")
      );
    })
  );
  const localStorageMock = (function () {
    let store = { dontShowPublicLoginOnStart: true };

    return {
      getItem(key) {
        return store[key] || null;
      },

      setItem(key, value) {
        store[key] = value.toString();
      },

      removeItem(key) {
        delete store[key];
      },

      clear() {
        store = {};
      },
    };
  })();

  Object.defineProperty(window, "localStorage", { value: localStorageMock });

  render(
    <Loader>
      <TestingComponent />
    </Loader>
  );

  expect(
    screen.queryByText(
      "You are not signed in. Sign in to create and update dashboards."
    )
  ).not.toBeInTheDocument();
  localStorage.clear();
});

test("AppLoader, load session error", async () => {
  server.use(
    rest.get("http://api.test/api/session/", (req, res, ctx) => {
      return res(
        ctx.status(500),
        ctx.json({ error: "Internal Server Error" }),
        ctx.set("Content-Type", "application/json")
      );
    })
  );

  render(
    <ErrorBoundary>
      <Loader>
        <TestingComponent />
      </Loader>
    </ErrorBoundary>
  );

  expect(
    await screen.findByText("AxiosError: Request failed with status code 500")
  ).toBeInTheDocument();
});

test("AppLoader, load visualization error", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/",
      (req, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({ error: "Internal Server Error" }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    <ErrorBoundary>
      <Loader>
        <TestingComponent />
      </Loader>
    </ErrorBoundary>
  );

  expect(
    await screen.findByText("AxiosError: Request failed with status code 500")
  ).toBeInTheDocument();
});
