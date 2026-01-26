import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { act } from "react";
import userEvent from "@testing-library/user-event";
import { addDays, format as formatDate } from "date-fns";
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
  toLocalISO,
  compareFilteredArgs,
} from "components/visualizations/Base";
import createLoadedComponent, {
  InputVariablePComponent,
} from "__tests__/utilities/customRender";
import { Map } from "ol";
import * as utilities from "components/visualizations/utilities";
import { server } from "__tests__/utilities/server";
import { rest } from "msw";

jest.mock("uuid", () => ({
  v4: () => 12345678,
}));

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

it("Initializes a Base Item with an empty div", async () => {
  render(
    createLoadedComponent({
      children: (
        <BaseVisualization
          source={""}
          argsString={"{}"}
          metadataString={"{}"}
          uuid={"12345678"}
          shouldLoad={true}
        />
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
        <BaseVisualization
          source={mockedApiImageBase.source}
          argsString={mockedApiImageBase.args_string}
          metadataString={mockedApiImageBase.metadata_string}
          uuid={"12345678"}
          shouldLoad={true}
        />
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
    step: 1,
    totalSteps: 2,
  });

  const progressMessage2 = await screen.findByText(
    "Progress Bar Testing With Percent...",
  );
  expect(progressMessage2).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toBeInTheDocument();
  expect(screen.getByText("1 / 2 (50%)")).toBeInTheDocument();

  const image = await screen.findByAltText(mockedApiImageBase.source);
  expect(image.src).toBe(
    "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png",
  );
});

it("Creates an Base Item with a Custom Image but does not load", async () => {
  render(
    createLoadedComponent({
      children: (
        <BaseVisualization
          source={mockedCustomImageBase.source}
          argsString={mockedCustomImageBase.args_string}
          metadataString={mockedCustomImageBase.metadata_string}
          shouldLoad={false}
        />
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
        <BaseVisualization
          source={mockedCustomImageBase.source}
          argsString={mockedCustomImageBase.args_string}
          metadataString={mockedCustomImageBase.metadata_string}
          uuid={"12345678"}
          shouldLoad={true}
        />
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
        <BaseVisualization
          source={mockedCustomImageBase.source}
          argsString={mockedCustomImageBase.args_string}
          metadataString={mockedCustomImageBase.metadata_string}
          uuid={"12345678"}
          shouldLoad={true}
        />
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
        <BaseVisualization
          source={mockedCustomImageBase.source}
          argsString={mockedCustomImageBase.args_string}
          metadataString={mockedCustomImageBase.metadata_string}
          uuid={"12345678"}
          shouldLoad={true}
        />
      ),
    }),
  );

  expect(await screen.findByText("missing variable")).toBeInTheDocument();
});

it("Creates an Base Item with a Text Box", async () => {
  render(
    createLoadedComponent({
      children: (
        <BaseVisualization
          source={mockedTextBase.source}
          argsString={mockedTextBase.args_string}
          metadataString={mockedTextBase.metadata_string}
          uuid={"12345678"}
          shouldLoad={true}
        />
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
          <BaseVisualization
            source={mockedMapBase.source}
            argsString={mockedMapBase.args_string}
            metadataString={mockedMapBase.metadata_string}
            uuid={"12345678"}
            shouldLoad={true}
          />
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
          <BaseVisualization
            source={mockedLiveChatBase.source}
            argsString={mockedLiveChatBase.args_string}
            metadataString={mockedLiveChatBase.metadata_string}
            uuid={"12345678"}
            shouldLoad={true}
          />
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
          <BaseVisualization
            source={mockedTextVariable.source}
            argsString={mockedTextVariable.args_string}
            metadataString={mockedTextVariable.metadata_string}
            uuid={"12345678"}
            shouldLoad={true}
          />
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
        <BaseVisualization
          source={apiImageBase.source}
          argsString={apiImageBase.args_string}
          metadataString={apiImageBase.metadata_string}
          uuid={"12345678"}
          shouldLoad={true}
        />
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
        <BaseVisualization
          source={apiImageBase.source}
          argsString={apiImageBase.args_string}
          metadataString={apiImageBase.metadata_string}
          uuid={"12345678"}
          shouldLoad={true}
        />
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
        <BaseVisualization
          source={mockedPlotBase.source}
          argsString={mockedPlotBase.args_string}
          metadataString={mockedPlotBase.metadata_string}
          uuid={"12345678"}
          shouldLoad={true}
        />
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
        <BaseVisualization
          source={mockedTableBase.source}
          argsString={mockedTableBase.args_string}
          metadataString={mockedTableBase.metadata_string}
          uuid={"12345678"}
          shouldLoad={true}
        />
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
        <BaseVisualization
          source={mockedTableBase.source}
          argsString={mockedTableBase.args_string}
          metadataString={mockedTableBase.metadata_string}
          uuid={"12345678"}
          shouldLoad={true}
        />
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
        <BaseVisualization
          source={mockedCardBase.source}
          argsString={mockedCardBase.args_string}
          metadataString={mockedCardBase.metadata_string}
          uuid={"12345678"}
          shouldLoad={true}
        />
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
        <BaseVisualization
          source={mockedUnknownBase.source}
          argsString={mockedUnknownBase.args_string}
          metadataString={mockedUnknownBase.metadata_string}
          uuid={"12345678"}
          shouldLoad={true}
        />
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
        <BaseVisualization
          source={mockedUnknownBase.source}
          argsString={mockedUnknownBase.args_string}
          metadataString={mockedUnknownBase.metadata_string}
          uuid={"12345678"}
          shouldLoad={true}
        />
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
          <BaseVisualization
            source={mockedDashboard.tabs[0].gridItems[0].source}
            argsString={mockedDashboard.tabs[0].gridItems[0].args_string}
            metadataString={
              mockedDashboard.tabs[0].gridItems[0].metadata_string
            }
            uuid={"12345678"}
            shouldLoad={true}
          />
          <BaseVisualization
            source={mockedDashboard.tabs[0].gridItems[1].source}
            argsString={mockedDashboard.tabs[0].gridItems[1].args_string}
            metadataString={
              mockedDashboard.tabs[0].gridItems[1].metadata_string
            }
            uuid={"12345678"}
            shouldLoad={true}
          />
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
  dateHourVariable.args_string = JSON.stringify({
    initial_value: "01/01/2025 12:00 AM",
    variable_name: "Test Variable",
    variable_options_source: "date-hour",
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
          <BaseVisualization
            source={mockedDashboard.tabs[0].gridItems[0].source}
            argsString={mockedDashboard.tabs[0].gridItems[0].args_string}
            metadataString={
              mockedDashboard.tabs[0].gridItems[0].metadata_string
            }
            uuid={"12345678"}
            shouldLoad={true}
          />
          <BaseVisualization
            source={mockedDashboard.tabs[0].gridItems[1].source}
            argsString={mockedDashboard.tabs[0].gridItems[1].args_string}
            metadataString={
              mockedDashboard.tabs[0].gridItems[1].metadata_string
            }
            uuid={"12345678"}
            shouldLoad={true}
          />
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
                args: { plugin_arg: "date-hour" },
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
            plugin_arg: "2025-01-01T00:00:00-06:00",
          },
          requestId: "12345678",
          source: "plugin_source",
        },
        metadataString: '{"refreshRate":0}',
        sourceType: "plotly",
        variableInputValues: {
          "Test Variable": "01/01/2025 12:00 AM",
        },
        vizLoadingIcon: undefined,
      }),
    );
  });

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
            plugin_arg: "2020-01-01T00:00:00-06:00",
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

  expectedDateString = formatDate(
    addDays(mockDate, -1),
    "yyyy-MM-dd'T'HH:mm:ss'-06:00'",
  );
  let expectedVariableDateString = formatDate(
    addDays(mockDate, -1),
    "MM/dd/yyyy h:mm a",
  );
  await waitFor(() => {
    expect(spyGetVisualization).toHaveBeenLastCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line
        argsString: '{"plugin_arg":"${Test Variable}"}',
        dashboardView: true,
        itemData: {
          args: {
            plugin_arg: expectedDateString,
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

  expectedDateString = formatDate(
    addDays(mockDate, -2),
    "yyyy-MM-dd'T'HH:mm:ss'-06:00'",
  );
  expectedVariableDateString = formatDate(
    addDays(mockDate, -2),
    "MM/dd/yyyy h:mm a",
  );
  await waitFor(() => {
    expect(spyGetVisualization).toHaveBeenLastCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line
        argsString: '{"plugin_arg":"${Test Variable}"}',
        dashboardView: true,
        itemData: {
          args: {
            plugin_arg: expectedDateString,
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
    variable_options_source: "date-hour",
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
          <BaseVisualization
            source={mockedDashboard.tabs[0].gridItems[0].source}
            argsString={mockedDashboard.tabs[0].gridItems[0].args_string}
            metadataString={
              mockedDashboard.tabs[0].gridItems[0].metadata_string
            }
            uuid={"12345678"}
            shouldLoad={true}
          />
          <BaseVisualization
            source={mockedDashboard.tabs[0].gridItems[1].source}
            argsString={mockedDashboard.tabs[0].gridItems[1].args_string}
            metadataString={
              mockedDashboard.tabs[0].gridItems[1].metadata_string
            }
            uuid={"12345678"}
            shouldLoad={true}
          />
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
                args: { plugin_arg: "date-hour" },
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

  // check getVisualization call with date
  let expectedDateString = formatDate(
    mockDate,
    "yyyy-MM-dd'T'HH:mm:ss'-06:00'",
  );
  await waitFor(() => {
    expect(spyGetVisualization).toHaveBeenLastCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line
        argsString: '{"plugin_arg":"${Test Variable}"}',
        dashboardView: true,
        itemData: {
          args: {
            plugin_arg: expectedDateString,
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
      }),
    );
  });

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

  expectedDateString = formatDate(
    addDays(mockDate, -1),
    "yyyy-MM-dd'T'HH:mm:ss'-06:00'",
  );
  const expectedVariableDateString = formatDate(
    addDays(mockDate, -1),
    "MM/dd/yyyy h:mm a",
  );
  await waitFor(() => {
    expect(spyGetVisualization).toHaveBeenLastCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line
        argsString: '{"plugin_arg":"${Test Variable}"}',
        dashboardView: true,
        itemData: {
          args: {
            plugin_arg: expectedDateString,
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

  spyGetVisualization.mockRestore();
  // Restore original Date
  global.Date = originalDate;
});

it("Calls addVerticalLine for plotly visualizations with plotlyVerticalLine metadata", async () => {
  const spyAddVerticalLine = jest.spyOn(
    require("components/visualizations/BasePlot"),
    "addVerticalLine",
  );
  const plotlyMeta = {
    plotlyVerticalLine: {
      value: 42,
      color: "#ff0000",
      width: 3,
      dash: "dashdot",
    },
  };
  mockedPlotBase.metadata_string = JSON.stringify(plotlyMeta);

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
        <BaseVisualization
          source={mockedPlotBase.source}
          argsString={mockedPlotBase.args_string}
          metadataString={mockedPlotBase.metadata_string}
          uuid={"12345678"}
          shouldLoad={true}
        />
      ),
      options: {
        visualizations: [
          {
            label: "Visualization Group",
            options: [
              {
                source: "plugin_source",
                value: "plugin_value",
                label: "plugin_label",
                args: { plugin_arg: "text" },
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

  const plot = await screen.findByText("bar chart example");
  expect(plot).toBeInTheDocument();
  expect(spyAddVerticalLine).toHaveBeenCalledWith(expect.anything(), 42, {
    color: "#ff0000",
    width: 3,
    dash: "dashdot",
  });
  spyAddVerticalLine.mockRestore();
});

describe("toLocalISO function", () => {
  it("should format date with correct timezone offset signs - covers line 174", () => {
    // Test the specific logic on line 174: (d.getTimezoneOffset() > 0 ? "-" : "+")

    // Create a base date for testing
    const baseDate = new Date("2025-01-15T12:00:00");

    // Store original getTimezoneOffset method
    const originalGetTimezoneOffset = baseDate.getTimezoneOffset;

    try {
      // Test Case 1: Positive offset (timezone behind UTC) - should use "-"
      // This tests the first part of the ternary: d.getTimezoneOffset() > 0 ? "-"
      baseDate.getTimezoneOffset = jest.fn().mockReturnValue(360); // UTC-6 (360 minutes behind)
      const resultBehindUTC = toLocalISO(baseDate);
      expect(resultBehindUTC).toMatch(/.*-06:00$/); // Should end with -06:00

      // Test Case 2: Negative offset (timezone ahead of UTC) - should use "+"
      // This tests the second part of the ternary: : "+"
      baseDate.getTimezoneOffset = jest.fn().mockReturnValue(-120); // UTC+2 (120 minutes ahead, so negative)
      const resultAheadUTC = toLocalISO(baseDate);
      expect(resultAheadUTC).toMatch(/.*\+02:00$/); // Should end with +02:00

      // Test Case 3: Zero offset (exactly UTC) - should use "+"
      // This tests the edge case where getTimezoneOffset() === 0, so the condition is false
      baseDate.getTimezoneOffset = jest.fn().mockReturnValue(0); // UTC±0
      const resultUTC = toLocalISO(baseDate);
      expect(resultUTC).toMatch(/.*\+00:00$/); // Should end with +00:00

      // Test Case 4: Large positive offset - should use "-"
      baseDate.getTimezoneOffset = jest.fn().mockReturnValue(720); // UTC-12
      const resultLargeBehind = toLocalISO(baseDate);
      expect(resultLargeBehind).toMatch(/.*-12:00$/); // Should end with -12:00

      // Test Case 5: Large negative offset - should use "+"
      baseDate.getTimezoneOffset = jest.fn().mockReturnValue(-720); // UTC+12
      const resultLargeAhead = toLocalISO(baseDate);
      expect(resultLargeAhead).toMatch(/.*\+12:00$/); // Should end with +12:00

      // Verify the complete format structure
      const completeResult = toLocalISO(baseDate);
      expect(completeResult).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
      );
    } finally {
      // Always restore the original method
      baseDate.getTimezoneOffset = originalGetTimezoneOffset;
    }
  });
});

describe("compareFilteredArgs function", () => {
  it("should handle updatedArgs being null or undefined - covers line 215", () => {
    const currentArgs = { a: 1, b: 2, c: 3 };
    const keysToCompare = { a: true, b: true };

    // Test Case 1: updatedArgs is null - line 215 should evaluate to false
    const resultWithNull = compareFilteredArgs(
      currentArgs,
      null,
      keysToCompare,
    );
    expect(resultWithNull).toBe(false); // Different because currentArgs has values but updatedArgs is null

    // Test Case 2: updatedArgs is undefined - line 215 should evaluate to false
    const resultWithUndefined = compareFilteredArgs(
      currentArgs,
      undefined,
      keysToCompare,
    );
    expect(resultWithUndefined).toBe(false); // Different because currentArgs has values but updatedArgs is undefined

    // Test Case 3: updatedArgs is an empty object - line 215 condition passes but keys are undefined
    const resultWithEmptyObject = compareFilteredArgs(
      currentArgs,
      {},
      keysToCompare,
    );
    expect(resultWithEmptyObject).toBe(false); // Different because currentArgs has values but updatedArgs is empty

    // Test Case 4: updatedArgs has some keys but not the ones in keysToCompare
    const updatedArgsWithDifferentKeys = { x: 1, y: 2 };
    const resultWithDifferentKeys = compareFilteredArgs(
      currentArgs,
      updatedArgsWithDifferentKeys,
      keysToCompare,
    );
    expect(resultWithDifferentKeys).toBe(false); // Different because the keys don't match

    // Test Case 5: updatedArgs has the same keys and values - should pass line 215 and succeed
    const updatedArgsMatching = { a: 1, b: 2, z: 99 }; // z is extra but not in keysToCompare
    const resultMatching = compareFilteredArgs(
      currentArgs,
      updatedArgsMatching,
      keysToCompare,
    );
    expect(resultMatching).toBe(true); // Should match because filtered keys a and b have same values

    // Test Case 6: updatedArgs has some matching keys but different values
    const updatedArgsPartialMatch = { a: 1, b: 999 }; // b has different value
    const resultPartialMatch = compareFilteredArgs(
      currentArgs,
      updatedArgsPartialMatch,
      keysToCompare,
    );
    expect(resultPartialMatch).toBe(false); // Should not match because b values are different

    // Test Case 7: updatedArgs has some keys undefined - tests the !== undefined check on line 215
    const updatedArgsWithUndefinedValues = { a: 1, b: undefined, c: 3 };
    const resultWithUndefinedValues = compareFilteredArgs(
      currentArgs,
      updatedArgsWithUndefinedValues,
      keysToCompare,
    );
    expect(resultWithUndefinedValues).toBe(false); // Should not match because b is undefined in updatedArgs but defined in currentArgs
  });

  it("should handle currentArgs being null or undefined", () => {
    const updatedArgs = { a: 1, b: 2 };
    const keysToCompare = { a: true, b: true };

    // Test currentArgs being null
    const resultWithNullCurrent = compareFilteredArgs(
      null,
      updatedArgs,
      keysToCompare,
    );
    expect(resultWithNullCurrent).toBe(false);

    // Test currentArgs being undefined
    const resultWithUndefinedCurrent = compareFilteredArgs(
      undefined,
      updatedArgs,
      keysToCompare,
    );
    expect(resultWithUndefinedCurrent).toBe(false);
  });

  it("should only compare keys that exist in keysToCompare", () => {
    const currentArgs = { a: 1, b: 2, c: 3, d: 4 };
    const updatedArgs = { a: 1, b: 2, c: 999, d: 999 }; // c and d are different but not in keysToCompare
    const keysToCompare = { a: true, b: true }; // Only compare a and b

    const result = compareFilteredArgs(currentArgs, updatedArgs, keysToCompare);
    expect(result).toBe(true); // Should match because only a and b are compared, and they match
  });
});
