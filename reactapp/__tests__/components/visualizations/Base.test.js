import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { act } from "react";
import userEvent from "@testing-library/user-event";
import { addDays } from "date-fns";
import {
  mockedApiImageBase,
  mockedCardBase,
  mockedCardData,
  mockedCustomImageBase,
  mockedPlotBase,
  mockedPlotData,
  mockedTableBase,
  mockedTableData,
  mockedTextBase,
  mockedCustomData,
  mockedTextVariable,
  mockedDateHourVariable,
  mockedUnknownBase,
  userDashboard,
  mockedMapBase,
  mockedLiveChatBase,
} from "__tests__/utilities/constants";
import BaseVisualization, {
  Visualization,
} from "components/visualizations/Base";
import createLoadedComponent, {
  InputVariablePComponent,
} from "__tests__/utilities/customRender";
import { Map } from "ol";
import * as utilities from "components/visualizations/utilities";
import { server } from "__tests__/utilities/server";
import { rest } from "msw";
import {
  GridItemContext,
  AppContext,
  EditingContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import { WebsocketContext } from "components/contexts/WebSocketContext";

jest.mock("components/visualizations/ModuleLoader", () => {
  const MockModuleLoader = () => <div>ModuleLoader Mock</div>;
  MockModuleLoader.displayName = "ModuleLoader"; // Set the display name to resolve the linting warning
  return MockModuleLoader;
});

// Mock date-fns functions to work with our mocked Date
jest.mock("date-fns", () => {
  const originalDateFns = jest.requireActual("date-fns");
  const mockBaseDate = new Date("2025-01-15T12:00:00-06:00");

  return {
    ...originalDateFns,
    addDays: (date, days) => {
      // If date is mockBaseDate, use it directly, otherwise use original logic
      const baseDate = date instanceof Date ? date : mockBaseDate;
      const result = new Date(baseDate);
      result.setDate(result.getDate() + days);
      return result;
    },
    format: (date, formatStr) => {
      const dateToFormat = date instanceof Date ? date : mockBaseDate;

      if (formatStr === "MM/dd/yyyy h:mm a") {
        const month = String(dateToFormat.getMonth() + 1).padStart(2, "0");
        const day = String(dateToFormat.getDate()).padStart(2, "0");
        const year = dateToFormat.getFullYear();
        let hours = dateToFormat.getHours();
        const minutes = String(dateToFormat.getMinutes()).padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
      } else if (formatStr === "yyyy-MM-dd'T'HH:mm:ss'-06:00'") {
        const year = dateToFormat.getFullYear();
        const month = String(dateToFormat.getMonth() + 1).padStart(2, "0");
        const day = String(dateToFormat.getDate()).padStart(2, "0");
        const hours = String(dateToFormat.getHours()).padStart(2, "0");
        const minutes = String(dateToFormat.getMinutes()).padStart(2, "0");
        const seconds = String(dateToFormat.getSeconds()).padStart(2, "0");
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-06:00`;
      }
      return originalDateFns.format(dateToFormat, formatStr);
    },
  };
});

const { ResizeObserver } = window;

beforeEach(() => {
  // Reset the module-level image-viz cache so a cached image result from one
  // test doesn't short-circuit another test that reuses the same source+args
  // to return a different viz type (all the "plugin_source" fixtures share a
  // cache key).
  utilities.clearImageVizCache();
  delete window.ResizeObserver;
  window.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
});

afterEach(() => {
  window.ResizeObserver = ResizeObserver;
  jest.restoreAllMocks();
});

function expectLastGetVisualizationCallDate(spy, expectedDateString) {
  const lastCall = spy.mock.calls.at(-1)[0];
  const actualDate = new Date(lastCall.itemData.args.plugin_arg);
  expect(actualDate.getTime()).toBe(new Date(expectedDateString).getTime());
}

it("Initializes a Base Item with an empty div", async () => {
  render(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider
          value={{
            gridItemSource: "",
            gridItemArgsString: "{}",
            gridItemMetadataString: "{}",
            gridItemUUID: "12345678",
            shouldLoad: true,
          }}
        >
          <BaseVisualization />
        </GridItemContext.Provider>
      ),
    }),
  );

  expect(await screen.findByTestId("Source_Unknown")).toBeInTheDocument();
});

it("Initializes a Base Item with an empty div and updates it with an image and progress message", async () => {
  // Set REDIS_WS_URL so WebSocket logic is used
  process.env.REDIS_WS_URL = "ws://localhost:1234";
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(500),
          ctx.status(200),
          ctx.json({
            success: true,
            data: "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png",
            viz_type: "image",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider
          value={{
            gridItemSource: mockedApiImageBase.source,
            gridItemArgsString: mockedApiImageBase.args_string,
            gridItemMetadataString: mockedApiImageBase.metadata_string,
            gridItemUUID: "12345678",
            shouldLoad: true,
          }}
        >
          <BaseVisualization />
        </GridItemContext.Provider>
      ),
    }),
  );

  await waitFor(() => {
    expect(global.__wsInstances[0]).toBeDefined();
  });
  const wsInstance = global.__wsInstances[0];
  wsInstance.send({
    requestId: "12345678",
    message: "Progress Bar Testing...",
  });

  const progressMessage = await screen.findByText("Progress Bar Testing...");
  expect(progressMessage).toBeInTheDocument();

  wsInstance.send({
    requestId: "12345678",
    message: "Progress Bar Testing With Percent...",
    percentageComplete: 50,
  });

  const progressMessage2 = await screen.findByText(
    "Progress Bar Testing With Percent...",
  );
  expect(progressMessage2).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toBeInTheDocument();
  expect(screen.getByText("50%")).toBeInTheDocument();

  const image = await screen.findByAltText(mockedApiImageBase.source);
  expect(image.src).toBe(
    "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png",
  );
});

it("Creates an Base Item with a Custom Image but does not load", async () => {
  render(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider
          value={{
            gridItemSource: mockedCustomImageBase.source,
            gridItemArgsString: mockedCustomImageBase.args_string,
            gridItemMetadataString: mockedCustomImageBase.metadata_string,
            gridItemUUID: "12345678",
            shouldLoad: false,
          }}
        >
          <BaseVisualization />
        </GridItemContext.Provider>
      ),
    }),
  );

  const spinner = await screen.findByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  expect(screen.queryByAltText("custom_image")).not.toBeInTheDocument();
});

it("Creates an Base Item with a Custom Image", async () => {
  const { rerender } = render(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider
          value={{
            gridItemSource: mockedCustomImageBase.source,
            gridItemArgsString: mockedCustomImageBase.args_string,
            gridItemMetadataString: mockedCustomImageBase.metadata_string,
            gridItemUUID: "12345678",
            shouldLoad: true,
          }}
        >
          <BaseVisualization />
        </GridItemContext.Provider>
      ),
    }),
  );

  const image = await screen.findByAltText("custom_image");
  expect(image.src).toBe("https://www.aquaveo.com/images/aquaveo_logo.svg");

  mockedCustomImageBase.args_string = JSON.stringify({
    // eslint-disable-next-line
    image_source: "${test_variable}",
  });

  rerender(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider
          value={{
            gridItemSource: mockedCustomImageBase.source,
            gridItemArgsString: mockedCustomImageBase.args_string,
            gridItemMetadataString: mockedCustomImageBase.metadata_string,
            gridItemUUID: "12345678",
            shouldLoad: true,
          }}
        >
          <BaseVisualization />
        </GridItemContext.Provider>
      ),
    }),
  );

  expect(
    await screen.findByText("test_variable variable is empty"),
  ).toBeInTheDocument();

  mockedCustomImageBase.metadata_string = JSON.stringify({
    refreshRate: 0,
    customMessaging: { test_variable: "missing variable" },
  });

  rerender(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider
          value={{
            gridItemSource: mockedCustomImageBase.source,
            gridItemArgsString: mockedCustomImageBase.args_string,
            gridItemMetadataString: mockedCustomImageBase.metadata_string,
            gridItemUUID: "12345678",
            shouldLoad: true,
          }}
        >
          <BaseVisualization />
        </GridItemContext.Provider>
      ),
    }),
  );

  expect(await screen.findByText("missing variable")).toBeInTheDocument();
});

it("Creates an Base Item with a Text Box", async () => {
  render(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider
          value={{
            gridItemSource: mockedTextBase.source,
            gridItemArgsString: mockedTextBase.args_string,
            gridItemMetadataString: mockedTextBase.metadata_string,
            gridItemUUID: "12345678",
            shouldLoad: true,
          }}
        >
          <BaseVisualization />
        </GridItemContext.Provider>
      ),
    }),
  );

  const text = await screen.findByText("Custom Text");
  expect(text).toBeInTheDocument();
});

it("Creates an Base Item with a Map", async () => {
  jest.spyOn(Map.prototype, "renderSync").mockImplementation(() => {});

  render(
    createLoadedComponent({
      children: (
        <div>
          <GridItemContext.Provider
            value={{
              gridItemSource: mockedMapBase.source,
              gridItemArgsString: mockedMapBase.args_string,
              gridItemMetadataString: mockedMapBase.metadata_string,
              gridItemUUID: "12345678",
              shouldLoad: true,
            }}
          >
            <BaseVisualization />
          </GridItemContext.Provider>
        </div>
      ),
    }),
  );

  const mapDiv = await screen.findByLabelText("Map Div");
  expect(mapDiv).toBeInTheDocument();
  expect(mapDiv).toHaveStyle("width: 100%");

  expect(await screen.findByLabelText("Map Legend")).toBeInTheDocument();
  expect(
    await screen.findByLabelText("Show Layers Control"),
  ).toBeInTheDocument();
});

it("Creates an Base Item with a Live Chat", async () => {
  const date = Date.now();
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            data: {
              chatHistory: [
                {
                  message: "Hello world!",
                  sessionId: "session-1",
                  sender: "Alice",
                  timestamp: date,
                  messageId: "msg-1",
                  edited: false,
                },
              ],
              requestId: "some-request-id",
            },
            viz_type: "Live Chat",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    createLoadedComponent({
      children: (
        <div>
          <GridItemContext.Provider
            value={{
              gridItemSource: mockedLiveChatBase.source,
              gridItemArgsString: mockedLiveChatBase.args_string,
              gridItemMetadataString: mockedLiveChatBase.metadata_string,
              gridItemUUID: "12345678",
              shouldLoad: true,
            }}
          >
            <BaseVisualization />
          </GridItemContext.Provider>
        </div>
      ),
    }),
  );

  expect(await screen.findByLabelText("Change Username")).toBeInTheDocument();
  expect(await screen.findByText("Hello world!")).toBeInTheDocument();
  expect(await screen.findByText("Alice")).toBeInTheDocument();
});

it("Creates an Base Item with a variable input text box", async () => {
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedTextVariable];
  const user = userEvent.setup();

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: mockedTextVariable.source,
              gridItemArgsString: mockedTextVariable.args_string,
              gridItemMetadataString: mockedTextVariable.metadata_string,
              gridItemUUID: "12345678",
              shouldLoad: true,
            }}
          >
            <BaseVisualization />
          </GridItemContext.Provider>
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { dashboards: [dashboard] } },
    }),
  );

  expect(await screen.findByText("Test Variable")).toBeInTheDocument();

  const variableInput = await screen.findByRole("textbox");
  expect(variableInput).toBeInTheDocument();
  await user.type(variableInput, "Hello World");

  expect(variableInput).toHaveValue("Hello World");
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "" }),
  );

  const refreshButton = screen.getByRole("button");
  expect(refreshButton).toBeInTheDocument();
  await user.click(refreshButton);

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "Hello World" }),
  );
});

it("Creates an Base Item with an image obtained from the api, 1 min refresh rate", async () => {
  jest.useFakeTimers();
  jest.spyOn(utilities, "getVisualization");
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(5),
          ctx.status(200),
          ctx.json({
            success: true,
            data: "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png",
            viz_type: "image",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  const apiImageBase = JSON.parse(JSON.stringify(mockedApiImageBase));
  apiImageBase.metadata_string = JSON.stringify({
    refreshRate: 1,
  });

  render(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider
          value={{
            gridItemSource: apiImageBase.source,
            gridItemArgsString: apiImageBase.args_string,
            gridItemMetadataString: apiImageBase.metadata_string,
            gridItemUUID: "12345678",
            shouldLoad: true,
          }}
        >
          <BaseVisualization />
        </GridItemContext.Provider>
      ),
    }),
  );

  const spinner = await screen.findByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  act(() => {
    jest.runOnlyPendingTimers();
  });

  const image = await screen.findByAltText(mockedApiImageBase.source);
  expect(image.src).toBe(
    "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png",
  );
  expect(utilities.getVisualization).toHaveBeenCalledTimes(2);

  // go past refresh rate so getVisualization is called again
  act(() => {
    jest.advanceTimersByTime(90000);
  });

  expect(image.src).toBe(
    "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png",
  );
  expect(utilities.getVisualization).toHaveBeenCalledTimes(3);

  jest.useRealTimers();
});

it("Creates an Base Item with an image obtained from the api, no refresh when editing", async () => {
  jest.useFakeTimers();
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            data: "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png",
            viz_type: "image",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  const apiImageBase = JSON.parse(JSON.stringify(mockedApiImageBase));
  apiImageBase.metadata_string = JSON.stringify({
    refreshRate: 1,
  });

  render(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider
          value={{
            gridItemSource: apiImageBase.source,
            gridItemArgsString: apiImageBase.args_string,
            gridItemMetadataString: apiImageBase.metadata_string,
            gridItemUUID: "12345678",
            shouldLoad: true,
          }}
        >
          <BaseVisualization />
        </GridItemContext.Provider>
      ),
      options: { inEditing: true },
    }),
  );

  const image = await screen.findByAltText(mockedApiImageBase.source);
  expect(image.src).toBe(
    "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png",
  );

  // for refresh rate of 1 minute, doesnt update after 50 seconds
  act(() => {
    jest.advanceTimersByTime(50000);
  });
  expect(screen.queryByTestId("Loading...")).not.toBeInTheDocument();

  // for refresh rate of 1 minute, updates after 10 more seconds
  act(() => {
    jest.advanceTimersByTime(10000);
  });
  expect(screen.queryByTestId("Loading...")).not.toBeInTheDocument();

  jest.useRealTimers();
});

it("Creates an Base Item with a plot obtained from the api", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(5),
          ctx.status(200),
          ctx.json({
            success: true,
            data: mockedPlotData,
            viz_type: "plotly",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider
          value={{
            gridItemSource: mockedPlotBase.source,
            gridItemArgsString: mockedPlotBase.args_string,
            gridItemMetadataString: mockedPlotBase.metadata_string,
            gridItemUUID: "12345678",
            shouldLoad: true,
          }}
        >
          <BaseVisualization />
        </GridItemContext.Provider>
      ),
    }),
  );

  const spinner = await screen.findByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  const plot = await screen.findByText("bar chart example");
  expect(plot).toBeInTheDocument();
});

it("Creates an Base Item with a custom module obtained from the api", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(5),
          ctx.status(200),
          ctx.json({
            success: true,
            data: mockedCustomData,
            viz_type: "custom",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider
          value={{
            gridItemSource: mockedTableBase.source,
            gridItemArgsString: mockedTableBase.args_string,
            gridItemMetadataString: mockedTableBase.metadata_string,
            gridItemUUID: "12345678",
            shouldLoad: true,
          }}
        >
          <BaseVisualization />
        </GridItemContext.Provider>
      ),
    }),
  );

  const spinner = await screen.findByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  const customModule = await screen.findByText("ModuleLoader Mock");
  expect(customModule).toBeInTheDocument();
});

it("Creates an Base Item with a table obtained from the api", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(5),
          ctx.status(200),
          ctx.json({
            success: true,
            data: mockedTableData,
            viz_type: "table",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider
          value={{
            gridItemSource: mockedTableBase.source,
            gridItemArgsString: mockedTableBase.args_string,
            gridItemMetadataString: mockedTableBase.metadata_string,
            gridItemUUID: "12345678",
            shouldLoad: true,
          }}
        >
          <BaseVisualization />
        </GridItemContext.Provider>
      ),
    }),
  );

  const spinner = await screen.findByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  const table = await screen.findByText("User Information");
  expect(table).toBeInTheDocument();
});

it("Creates an Base Item with a card obtained from the api", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(5),
          ctx.status(200),
          ctx.json({
            success: true,
            data: mockedCardData,
            viz_type: "card",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider
          value={{
            gridItemSource: mockedCardBase.source,
            gridItemArgsString: mockedCardBase.args_string,
            gridItemMetadataString: mockedCardBase.metadata_string,
            gridItemUUID: "12345678",
            shouldLoad: true,
          }}
        >
          <BaseVisualization />
        </GridItemContext.Provider>
      ),
    }),
  );

  const spinner = await screen.findByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  const card = await screen.findByText("Company Statistics");
  expect(card).toBeInTheDocument();
});

it("Gives the user an error message if an unknown viz type is obtained from the api", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(5),
          ctx.status(200),
          ctx.json({
            success: true,
            data: {},
            viz_type: "random_viz_type",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider
          value={{
            gridItemSource: mockedUnknownBase.source,
            gridItemArgsString: mockedUnknownBase.args_string,
            gridItemMetadataString: mockedUnknownBase.metadata_string,
            gridItemUUID: "12345678",
            shouldLoad: true,
          }}
        >
          <BaseVisualization />
        </GridItemContext.Provider>
      ),
      options: {
        visualizations: [
          {
            label: "Visualization Group",
            options: [
              {
                source: "unknown_api",
                value: "plugin_value",
                label: "plugin_label",
                args: { plugin_arg: "text" },
                type: "some type",
                tags: ["test", "plugin"],
                description: "some description",
              },
            ],
          },
        ],
      },
    }),
  );

  const spinner = await screen.findByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  const message = await screen.findByText(
    "random_viz_type visualizations still need to be configured",
  );
  expect(message).toBeInTheDocument();
});

it("Gives the user an error message if the api couldn't retrieve data", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: false,
            data: {},
            viz_type: "",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider
          value={{
            gridItemSource: mockedUnknownBase.source,
            gridItemArgsString: mockedUnknownBase.args_string,
            gridItemMetadataString: mockedUnknownBase.metadata_string,
            gridItemUUID: "12345678",
            shouldLoad: true,
          }}
        >
          <BaseVisualization />
        </GridItemContext.Provider>
      ),
      options: {
        visualizations: [
          {
            label: "Visualization Group",
            options: [
              {
                source: "unknown_api",
                value: "plugin_value",
                label: "plugin_label",
                args: { plugin_arg: "text" },
                type: "some type",
                tags: ["test", "plugin"],
                description: "some description",
              },
            ],
          },
        ],
      },
    }),
  );

  const message = await screen.findByText("Failed to retrieve data");
  expect(message).toBeInTheDocument();
});

it("Base - update text variable input", async () => {
  const user = userEvent.setup();
  const apiImageBase = JSON.parse(JSON.stringify(mockedApiImageBase));
  apiImageBase.args_string = JSON.stringify({
    // eslint-disable-next-line
    url: "${Test Variable}",
  });
  const textVariable = JSON.parse(JSON.stringify(mockedTextVariable));
  textVariable.args_string = JSON.stringify({
    initial_value: "https://www.aquaveo.com/images/aquaveo_logo.svg",
    variable_name: "Test Variable",
    variable_options_source: "text",
  });

  const mockedDashboard = {
    id: 1,
    name: "editable",
    label: "test_label",
    notes: "test_notes",
    editable: true,
    publicDashboard: false,
    tabs: [
      {
        id: "1",
        name: "Tab 1",
        gridItems: [textVariable, apiImageBase],
      },
    ],
  };
  const dashboards = { dashboards: [mockedDashboard] };

  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(5),
          ctx.status(200),
          ctx.json({
            success: true,
            // eslint-disable-next-line
            data: "${Test Variable}",
            viz_type: "image",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: mockedDashboard.tabs[0].gridItems[0].source,
              gridItemArgsString:
                mockedDashboard.tabs[0].gridItems[0].args_string,
              gridItemMetadataString:
                mockedDashboard.tabs[0].gridItems[0].metadata_string,
              gridItemUUID: "12345678",
              shouldLoad: true,
            }}
          >
            <BaseVisualization />
          </GridItemContext.Provider>
          <GridItemContext.Provider
            value={{
              gridItemSource: mockedDashboard.tabs[0].gridItems[1].source,
              gridItemArgsString:
                mockedDashboard.tabs[0].gridItems[1].args_string,
              gridItemMetadataString:
                mockedDashboard.tabs[0].gridItems[1].metadata_string,
              gridItemUUID: "12345678",
              shouldLoad: true,
            }}
          >
            <BaseVisualization />
          </GridItemContext.Provider>
        </>
      ),
      options: { dashboards, initialDashboard: mockedDashboard },
    }),
  );

  let image = await screen.findByAltText(mockedApiImageBase.source);
  await waitFor(async () => {
    expect(image.src).toBe("https://www.aquaveo.com/images/aquaveo_logo.svg");
  });

  const variableInput = await screen.findByLabelText("undefined Input");
  expect(variableInput).toBeInTheDocument();
  fireEvent.change(variableInput, {
    target: {
      value:
        "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png",
    },
  });
  const refreshButton = screen.getByRole("button");
  expect(refreshButton).toBeInTheDocument();
  await user.click(refreshButton);

  const spinner = await screen.findByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  image = await screen.findByAltText(mockedApiImageBase.source);
  expect(image.src).toBe(
    "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png",
  );
});

it("Base - update date variable input", async () => {
  // Mock Date constructor to return a fixed date when called without arguments
  const mockDate = new Date("2025-01-15T12:00:00-06:00");
  const originalDate = global.Date;

  // Mock Date constructor
  global.Date = class extends originalDate {
    constructor(...args) {
      if (args.length === 0) {
        super(mockDate.getTime());
        return;
      }
      super(...args);
    }

    static now = jest.fn(() => mockDate.getTime());
    static UTC = originalDate.UTC;
    static parse = originalDate.parse;
  };

  const spyGetVisualization = jest.spyOn(utilities, "getVisualization");

  const dateDependentGridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "plugin_source",
    args_string: JSON.stringify({
      // eslint-disable-next-line
      plugin_arg: "${Test Variable}",
    }),
    metadata_string: JSON.stringify({
      refreshRate: 0,
    }),
  };
  const dateHourVariable = JSON.parse(JSON.stringify(mockedDateHourVariable));
  const initialDate = "01/01/2025 12:00 AM";
  dateHourVariable.args_string = JSON.stringify({
    initial_value: initialDate,
    variable_name: "Test Variable",
    variable_options_source: "date",
  });

  const mockedDashboard = {
    id: 1,
    name: "editable",
    label: "test_label",
    notes: "test_notes",
    editable: true,
    publicDashboard: false,
    tabs: [
      {
        id: "1",
        name: "Tab 1",
        gridItems: [dateHourVariable, dateDependentGridItem],
      },
    ],
  };
  const dashboards = { dashboards: [mockedDashboard] };

  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(5),
          ctx.status(200),
          ctx.json({
            success: true,
            // eslint-disable-next-line
            data: "${Test Variable}",
            viz_type: "text",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: mockedDashboard.tabs[0].gridItems[0].source,
              gridItemArgsString:
                mockedDashboard.tabs[0].gridItems[0].args_string,
              gridItemMetadataString:
                mockedDashboard.tabs[0].gridItems[0].metadata_string,
              gridItemUUID: "12345678",
              shouldLoad: true,
            }}
          >
            <BaseVisualization />
          </GridItemContext.Provider>
          <GridItemContext.Provider
            value={{
              gridItemSource: mockedDashboard.tabs[0].gridItems[1].source,
              gridItemArgsString:
                mockedDashboard.tabs[0].gridItems[1].args_string,
              gridItemMetadataString:
                mockedDashboard.tabs[0].gridItems[1].metadata_string,
              gridItemUUID: "12345678",
              shouldLoad: true,
            }}
          >
            <BaseVisualization />
          </GridItemContext.Provider>
        </>
      ),
      options: {
        dashboards,
        initialDashboard: mockedDashboard,
        visualizations: [
          {
            label: "Visualization Group",
            options: [
              {
                source: "plugin_source",
                value: "plugin_value",
                label: "plugin_label",
                args: { plugin_arg: "date" },
                type: "plotly",
                tags: ["test", "plugin"],
                description: "some description",
              },
            ],
          },
        ],
      },
    }),
  );

  // check getVisualization call with date
  await waitFor(() => {
    expect(spyGetVisualization).toHaveBeenLastCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line
        argsString: '{"plugin_arg":"${Test Variable}"}',
        dashboardView: true,
        itemData: {
          args: {
            plugin_arg: expect.any(String),
          },
          requestId: "12345678",
          source: "plugin_source",
        },
        metadataString: '{"refreshRate":0}',
        sourceType: "plotly",
        variableInputValues: {
          "Test Variable": initialDate,
        },
        vizLoadingIcon: undefined,
      }),
    );
  });

  expectLastGetVisualizationCallDate(spyGetVisualization, initialDate);

  // update the datepicker textbox to a static date
  const input = await screen.findByRole("textbox");
  await userEvent.click(input);

  let expectedDateString = "01/01/2020";
  fireEvent.change(input, {
    target: { value: expectedDateString },
  });
  const refreshButton = screen.getByLabelText("Refresh variable input");
  expect(refreshButton).toBeInTheDocument();

  // Clear previous calls and get initial call count
  spyGetVisualization.mockClear();

  await userEvent.click(refreshButton);

  await waitFor(() => {
    expect(spyGetVisualization).toHaveBeenLastCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line
        argsString: '{"plugin_arg":"${Test Variable}"}',
        dashboardView: true,
        itemData: {
          args: {
            plugin_arg: expect.any(String),
          },
          requestId: "12345678",
          source: "plugin_source",
        },
        metadataString: '{"refreshRate":0}',
        sourceType: "plotly",
        variableInputValues: {
          "Test Variable": "01/01/2020 12:00 AM",
        },
        vizLoadingIcon: undefined,
      }),
    );
  });
  expectLastGetVisualizationCallDate(spyGetVisualization, expectedDateString);

  // Verify getVisualization was called after first refresh
  let callCountAfterFirstRefresh = spyGetVisualization.mock.calls.length;
  expect(callCountAfterFirstRefresh).toBeGreaterThan(0);

  // update the datepicker textbox to a relative date
  fireEvent.change(input, {
    target: { value: "now-1D" },
  });

  // Clear previous calls and get initial call count
  spyGetVisualization.mockClear();
  await userEvent.click(refreshButton);

  // Verify getVisualization was called after second refresh
  callCountAfterFirstRefresh = spyGetVisualization.mock.calls.length;
  expect(callCountAfterFirstRefresh).toBeGreaterThan(0);

  expectedDateString = addDays(mockDate, -1);
  let expectedVariableDateString = addDays(mockDate, -1);

  await waitFor(() => {
    expect(spyGetVisualization).toHaveBeenLastCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line
        argsString: '{"plugin_arg":"${Test Variable}"}',
        dashboardView: true,
        itemData: {
          args: {
            plugin_arg: expect.any(String),
          },
          requestId: "12345678",
          source: "plugin_source",
        },
        metadataString: '{"refreshRate":0}',
        sourceType: "plotly",
        variableInputValues: {
          "Test Variable": expectedVariableDateString,
        },
        vizLoadingIcon: undefined,
      }),
    );
  });
  expectLastGetVisualizationCallDate(
    spyGetVisualization,
    expectedVariableDateString,
  );

  // Clear calls again to test no additional calls when clicking refresh without value change
  spyGetVisualization.mockClear();

  // Click refresh button again without changing the input value
  await userEvent.click(refreshButton);

  // Wait a bit to ensure any potential async operations complete
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Verify that getVisualization was NOT called again since value didn't change
  expect(spyGetVisualization).not.toHaveBeenCalled();

  // update the datepicker textbox to a new relative date
  fireEvent.change(input, {
    target: { value: "now-2D" },
  });
  await userEvent.click(refreshButton);

  // Verify getVisualization was called after fourth refresh
  callCountAfterFirstRefresh = spyGetVisualization.mock.calls.length;
  expect(callCountAfterFirstRefresh).toBeGreaterThan(0);

  expectedDateString = addDays(mockDate, -2);
  expectedVariableDateString = addDays(mockDate, -2);
  await waitFor(() => {
    expect(spyGetVisualization).toHaveBeenLastCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line
        argsString: '{"plugin_arg":"${Test Variable}"}',
        dashboardView: true,
        itemData: {
          args: {
            plugin_arg: expect.any(String),
          },
          requestId: "12345678",
          source: "plugin_source",
        },
        metadataString: '{"refreshRate":0}',
        sourceType: "plotly",
        variableInputValues: {
          "Test Variable": expectedVariableDateString,
        },
        vizLoadingIcon: undefined,
      }),
    );
  });
  expectLastGetVisualizationCallDate(
    spyGetVisualization,
    expectedVariableDateString,
  );

  spyGetVisualization.mockRestore();
  // Restore original Date
  global.Date = originalDate;
});

it("Base - initial relative date variable input", async () => {
  // Mock Date constructor to return a fixed date when called without arguments
  const mockDate = new Date("2025-01-15T12:00:00-06:00");
  const originalDate = global.Date;

  // Mock Date constructor
  global.Date = class extends originalDate {
    constructor(...args) {
      if (args.length === 0) {
        super(mockDate.getTime());
        return;
      }
      super(...args);
    }

    static now = jest.fn(() => mockDate.getTime());
    static UTC = originalDate.UTC;
    static parse = originalDate.parse;
  };

  const spyGetVisualization = jest.spyOn(utilities, "getVisualization");

  const dateDependentGridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "plugin_source",
    args_string: JSON.stringify({
      // eslint-disable-next-line
      plugin_arg: "${Test Variable}",
    }),
    metadata_string: JSON.stringify({
      refreshRate: 0,
    }),
  };
  const dateHourVariable = JSON.parse(JSON.stringify(mockedDateHourVariable));
  dateHourVariable.args_string = JSON.stringify({
    initial_value: "now",
    variable_name: "Test Variable",
    variable_options_source: "date",
    "variable_options_source.metadata": {
      format: "MM/dd/yyyy h:mm aa",
    },
  });

  const mockedDashboard = {
    id: 1,
    name: "editable",
    label: "test_label",
    notes: "test_notes",
    editable: true,
    publicDashboard: false,
    tabs: [
      {
        id: "1",
        name: "Tab 1",
        gridItems: [dateHourVariable, dateDependentGridItem],
      },
    ],
  };
  const dashboards = { dashboards: [mockedDashboard] };

  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(5),
          ctx.status(200),
          ctx.json({
            success: true,
            // eslint-disable-next-line
            data: "${Test Variable}",
            viz_type: "text",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: mockedDashboard.tabs[0].gridItems[0].source,
              gridItemArgsString:
                mockedDashboard.tabs[0].gridItems[0].args_string,
              gridItemMetadataString:
                mockedDashboard.tabs[0].gridItems[0].metadata_string,
              gridItemUUID: "12345678",
              shouldLoad: true,
            }}
          >
            <BaseVisualization />
          </GridItemContext.Provider>
          <GridItemContext.Provider
            value={{
              gridItemSource: mockedDashboard.tabs[0].gridItems[1].source,
              gridItemArgsString:
                mockedDashboard.tabs[0].gridItems[1].args_string,
              gridItemMetadataString:
                mockedDashboard.tabs[0].gridItems[1].metadata_string,
              gridItemUUID: "12345678",
              shouldLoad: true,
            }}
          >
            <BaseVisualization />
          </GridItemContext.Provider>
        </>
      ),
      options: {
        dashboards,
        initialDashboard: mockedDashboard,
        visualizations: [
          {
            label: "Visualization Group",
            options: [
              {
                source: "plugin_source",
                value: "plugin_value",
                label: "plugin_label",
                args: { plugin_arg: "date" },
                type: "plotly",
                tags: ["test", "plugin"],
                description: "some description",
              },
            ],
          },
        ],
      },
    }),
  );

  const refreshButton = await screen.findByLabelText("Refresh variable input");
  const input = await screen.findByRole("textbox");

  await waitFor(() => {
    expect(spyGetVisualization).toHaveBeenLastCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line
        argsString: '{"plugin_arg":"${Test Variable}"}',
        dashboardView: true,
        itemData: {
          args: {
            plugin_arg: expect.any(String),
          },
          requestId: "12345678",
          source: "plugin_source",
        },
        metadataString: '{"refreshRate":0}',
        sourceType: "plotly",
        variableInputValues: {
          "Test Variable": "now",
        },
        vizLoadingIcon: undefined,
        variableInputDateFormats: {
          "Test Variable": "MM/dd/yyyy h:mm aa",
        },
      }),
    );
  });

  expectLastGetVisualizationCallDate(spyGetVisualization, Date.now());

  // Clear calls again to test no additional calls when clicking refresh without value change
  spyGetVisualization.mockClear();

  // Click refresh button again without changing the input value
  await userEvent.click(refreshButton);

  // Wait a bit to ensure any potential async operations complete
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Verify that getVisualization was NOT called again since value didn't change
  expect(spyGetVisualization).not.toHaveBeenCalled();

  // update the datepicker textbox to a new relative date
  fireEvent.change(input, {
    target: { value: "now-1D" },
  });
  await userEvent.click(refreshButton);

  // Verify getVisualization was called after fourth refresh
  const callCountAfterFirstRefresh = spyGetVisualization.mock.calls.length;
  expect(callCountAfterFirstRefresh).toBeGreaterThan(0);

  const expectedVariableDateString = addDays(mockDate, -1);
  await waitFor(() => {
    expect(spyGetVisualization).toHaveBeenLastCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line
        argsString: '{"plugin_arg":"${Test Variable}"}',
        dashboardView: true,
        itemData: {
          args: {
            plugin_arg: expect.any(String),
          },
          requestId: "12345678",
          source: "plugin_source",
        },
        metadataString: '{"refreshRate":0}',
        sourceType: "plotly",
        variableInputValues: {
          "Test Variable": expectedVariableDateString,
        },
        vizLoadingIcon: undefined,
      }),
    );
  });
  expectLastGetVisualizationCallDate(
    spyGetVisualization,
    expectedVariableDateString,
  );

  spyGetVisualization.mockRestore();
  // Restore original Date
  global.Date = originalDate;
});

it("renders ImageSequence when vizType is imageSequence", () => {
  const urls = [
    "https://example.com/img1.gif",
    "https://example.com/img2.gif",
    "https://example.com/img3.gif",
  ];
  render(
    <Visualization
      vizType="imageSequence"
      vizData={{
        urls,
        activeUrl: urls[1],
        alt: "custom_image",
        imageError: "Failed",
      }}
      vizMetadata={{}}
    />,
  );

  // All images should be rendered in the DOM (preloaded)
  const images = screen.getAllByAltText("custom_image");
  expect(images).toHaveLength(3);
  // The active image should be visible
  const activeImg = images.find(
    (img) => img.src === "https://example.com/img2.gif",
  );
  expect(activeImg).toBeTruthy();
});

describe("featurePending Visualization", () => {
  it("source given", () => {
    render(
      <Visualization
        vizType="featurePending"
        vizData={{
          source: "geoglows_forecast_plot",
          pendingTokens: ["feature.comid", "feature.return_period"],
        }}
        vizMetadata={{}}
      />,
    );

    const tile = screen.getByTestId("feature-pending-tile");
    expect(tile).toBeInTheDocument();
    expect(tile).toHaveTextContent(/awaiting feature selection/i);
    expect(tile).toHaveTextContent(/geoglows_forecast_plot/);
    expect(tile).toHaveTextContent(/feature\.comid/);
    expect(tile).toHaveTextContent(/feature\.return_period/);
  });

  it("source missing", () => {
    render(
      <Visualization
        vizType="featurePending"
        vizData={{ pendingTokens: ["feature.x"] }}
        vizMetadata={{}}
      />,
    );

    const tile = screen.getByTestId("feature-pending-tile");
    expect(tile).toBeInTheDocument();
    expect(tile).toHaveTextContent(/awaiting feature selection/i);
    expect(tile).toHaveTextContent(/feature\.x/);
  });

  it("no pending tokens", () => {
    render(
      <Visualization
        vizType="featurePending"
        vizData={{ source: "some_source", pendingTokens: [] }}
        vizMetadata={{}}
      />,
    );

    const tile = screen.getByTestId("feature-pending-tile");
    expect(tile).toBeInTheDocument();
    expect(tile).toHaveTextContent(/awaiting feature selection/i);
    expect(tile).toHaveTextContent(/some_source/);
  });
});

it("ImageSequence fast-path updates activeUrl without calling getVisualization", async () => {
  const spyGetVisualization = jest.spyOn(utilities, "getVisualization");

  const sliderUrls = [
    "https://example.com/frame1.gif",
    "https://example.com/frame2.gif",
    "https://example.com/frame3.gif",
  ];

  // Mock getVisualization to set imageSequence on first call
  spyGetVisualization.mockImplementation(
    ({ setVizType, setVizData, itemData }) => {
      if (itemData.source === "Custom Image") {
        setVizType("imageSequence");
        setVizData({
          urls: sliderUrls,
          activeUrl: itemData.args.image_source,
          alt: "custom_image",
        });
      }
    },
  );

  const argsString = JSON.stringify({
    // eslint-disable-next-line
    image_source: "${Slider}",
  });
  const metadataString = JSON.stringify({ refreshRate: 0 });

  const baseContexts = (variableInputValues) => (
    <AppContext.Provider value={{ visualizations: [] }}>
      <EditingContext.Provider value={{ isEditing: false }}>
        <WebsocketContext.Provider value={{ getMessageForRequest: () => null }}>
          <VariableInputsContext.Provider
            value={{
              variableInputValues,
              variableInputDateFormats: {},
              variableInputSliderMeta: {
                Slider: { values: sliderUrls },
              },
            }}
          >
            <GridItemContext.Provider
              value={{
                gridItemSource: "Custom Image",
                gridItemArgsString: argsString,
                gridItemMetadataString: metadataString,
                gridItemUUID: "img-seq-uuid",
                shouldLoad: true,
              }}
            >
              <BaseVisualization />
            </GridItemContext.Provider>
          </VariableInputsContext.Provider>
        </WebsocketContext.Provider>
      </EditingContext.Provider>
    </AppContext.Provider>
  );

  // First render with Slider=frame1 → getVisualization sets imageSequence
  const { rerender } = render(
    baseContexts({ Slider: "https://example.com/frame1.gif" }),
  );
  await waitFor(() => {
    expect(spyGetVisualization).toHaveBeenCalledTimes(1);
  });

  spyGetVisualization.mockClear();

  // Rerender with Slider=frame2 (which IS in sliderUrls)
  // The fast-path should update activeUrl directly and NOT call getVisualization
  rerender(baseContexts({ Slider: "https://example.com/frame2.gif" }));

  // Wait for effects to flush, then verify fast-path skipped getVisualization
  await waitFor(() => {
    expect(spyGetVisualization).not.toHaveBeenCalled();
  });

  // The "Loading Images..." text confirms ImageSequence is rendered
  // (images don't fire onLoad in jsdom, so they stay in loading state)
  expect(screen.getByText("Loading Images...")).toBeInTheDocument();

  // Rerender with same Slider value (frame2 again) → newActiveUrl equals
  // vizData.activeUrl, so the setVizData call on line 401 is skipped (branch 399 false)
  rerender(baseContexts({ Slider: "https://example.com/frame2.gif" }));
  await waitFor(() => {
    expect(spyGetVisualization).not.toHaveBeenCalled();
  });

  spyGetVisualization.mockClear();

  // Now rerender with a URL NOT in sliderUrls → fast-path detects mismatch,
  // sets refresh=true, falls through to getVisualization
  rerender(baseContexts({ Slider: "https://example.com/NEW_frame.gif" }));

  await waitFor(() => {
    expect(spyGetVisualization).toHaveBeenCalled();
  });

  spyGetVisualization.mockRestore();
});

it("renders ImageCollection", () => {
  const urls = [
    "https://example.com/img1.gif",
    "https://example.com/img2.gif",
    "https://example.com/img3.gif",
  ];
  render(
    <Visualization
      vizType="imageCollection"
      vizData={{
        urls,
        title: "Example Image Collection",
        columns: 2,
        imageError: "Failed",
      }}
      vizMetadata={{}}
    />,
  );

  expect(screen.getByText("Example Image Collection")).toBeInTheDocument();
  const images = screen.getAllByRole("img");
  expect(images).toHaveLength(3);
});

describe("featurePending placeholder", () => {
  it("renders the placeholder shell when vizType=featurePending", () => {
    render(
      <Visualization
        vizType="featurePending"
        vizData={{
          source: "geoglows_forecast_plot",
          pendingTokens: ["feature.comid", "feature.return_period"],
        }}
        vizMetadata={{}}
      />,
    );

    const tile = screen.getByTestId("feature-pending-tile");
    expect(tile).toBeInTheDocument();
    expect(tile).toHaveTextContent(/awaiting feature selection/i);
    expect(tile).toHaveTextContent(/geoglows_forecast_plot/);
    expect(tile).toHaveTextContent(/feature\.comid/);
    expect(tile).toHaveTextContent(/feature\.return_period/);
  });

  it("renders the placeholder without source-name lead when source is missing", () => {
    render(
      <Visualization
        vizType="featurePending"
        vizData={{ pendingTokens: ["feature.x"] }}
        vizMetadata={{}}
      />,
    );

    const tile = screen.getByTestId("feature-pending-tile");
    expect(tile).toHaveTextContent(/^Awaiting feature selection/);
    expect(tile).toHaveTextContent(/feature\.x/);
  });

  it("BaseVisualization gates the fetch when args contain unresolved feature.* tokens", async () => {
    const spyGetVisualization = jest.spyOn(utilities, "getVisualization");

    // The plotBase fixture targets geoglows_forecast_plot; replace its
    // args_string with an arg referencing a feature.* token. With no
    // FeatureScopedVariableInputs in the surrounding tree, the host
    // substitution preserves the token, the gate fires, and we should
    // see the placeholder instead of an attempted plugin call.
    const plotBase = JSON.parse(JSON.stringify(mockedPlotBase));
    plotBase.args_string = JSON.stringify({
      // eslint-disable-next-line no-template-curly-in-string
      river_id: "${feature.comid}",
    });

    render(
      createLoadedComponent({
        children: (
          <GridItemContext.Provider
            value={{
              gridItemSource: plotBase.source,
              gridItemArgsString: plotBase.args_string,
              gridItemMetadataString: plotBase.metadata_string,
              gridItemUUID: "feature-pending-1",
              shouldLoad: true,
            }}
          >
            <BaseVisualization />
          </GridItemContext.Provider>
        ),
      }),
    );

    // Placeholder mounts.
    const tile = await screen.findByTestId("feature-pending-tile");
    expect(tile).toHaveTextContent(/awaiting feature selection/i);
    expect(tile).toHaveTextContent(/feature\.comid/);

    // Plugin was NOT invoked — the gate skipped it.
    expect(spyGetVisualization).not.toHaveBeenCalled();
    spyGetVisualization.mockRestore();
  });
});
