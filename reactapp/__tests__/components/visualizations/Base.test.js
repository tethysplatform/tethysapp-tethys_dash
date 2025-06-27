import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { act } from "react";
import userEvent from "@testing-library/user-event";
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
  mockedUnknownBase,
  mockedDashboards,
  mockedMapBase,
} from "__tests__/utilities/constants";
import BaseVisualization from "components/visualizations/Base";
import createLoadedComponent, {
  InputVariablePComponent,
} from "__tests__/utilities/customRender";
import { Map } from "ol";
import * as utilities from "components/visualizations/utilities";
import { server } from "__tests__/utilities/server";
import { rest } from "msw";

jest.mock("components/visualizations/ModuleLoader", () => {
  const MockModuleLoader = () => <div>ModuleLoader Mock</div>;
  MockModuleLoader.displayName = "ModuleLoader"; // Set the display name to resolve the linting warning
  return MockModuleLoader;
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
        />
      ),
    })
  );

  expect(await screen.findByTestId("Source_Unknown")).toBeInTheDocument();
});

it("Initializes a Base Item with an empty div and updates it with an image", async () => {
  server.use(
    rest.get("http://api.test/apps/tethysdash/data", (req, res, ctx) => {
      return res(
        ctx.delay(5),
        ctx.status(200),
        ctx.json({
          success: true,
          data: "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png",
          viz_type: "image",
        }),
        ctx.set("Content-Type", "application/json")
      );
    })
  );

  render(
    createLoadedComponent({
      children: (
        <BaseVisualization
          source={mockedApiImageBase.source}
          argsString={mockedApiImageBase.args_string}
          metadataString={mockedApiImageBase.metadata_string}
        />
      ),
    })
  );

  const spinner = await screen.findByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  const image = await screen.findByAltText(mockedApiImageBase.source);
  expect(image.src).toBe(
    "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png"
  );
});

it("Creates an Base Item with a Custom Image", async () => {
  render(
    createLoadedComponent({
      children: (
        <BaseVisualization
          source={mockedCustomImageBase.source}
          argsString={mockedCustomImageBase.args_string}
          metadataString={mockedCustomImageBase.metadata_string}
        />
      ),
    })
  );

  const image = await screen.findByAltText("custom_image");
  expect(image.src).toBe("https://www.aquaveo.com/images/aquaveo_logo.svg");
});

it("Creates an Base Item with a Text Box", async () => {
  render(
    createLoadedComponent({
      children: (
        <BaseVisualization
          source={mockedTextBase.source}
          argsString={mockedTextBase.args_string}
          metadataString={mockedTextBase.metadata_string}
        />
      ),
    })
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
          />
        </div>
      ),
    })
  );

  const mapDiv = await screen.findByLabelText("Map Div");
  expect(mapDiv).toBeInTheDocument();
  expect(mapDiv).toHaveStyle("width: 100%");

  expect(await screen.findByLabelText("Map Legend")).toBeInTheDocument();
  expect(
    await screen.findByLabelText("Show Layers Control")
  ).toBeInTheDocument();
});

it("Creates an Base Item with a variable input text box", async () => {
  const dashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  dashboard.gridItems = [mockedTextVariable];
  const user = userEvent.setup();

  render(
    createLoadedComponent({
      children: (
        <>
          <BaseVisualization
            source={mockedTextVariable.source}
            argsString={mockedTextVariable.args_string}
            metadataString={mockedTextVariable.metadata_string}
          />
          <InputVariablePComponent />
        </>
      ),
      options: { dashboards: { user: [dashboard], public: [] } },
    })
  );

  expect(await screen.findByText("Test Variable")).toBeInTheDocument();

  const variableInput = await screen.findByRole("textbox");
  expect(variableInput).toBeInTheDocument();
  await user.type(variableInput, "Hello World");

  expect(variableInput).toHaveValue("Hello World");
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "" })
  );

  const refreshButton = screen.getByRole("button");
  expect(refreshButton).toBeInTheDocument();
  await user.click(refreshButton);

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "Hello World" })
  );
});

it("Creates an Base Item with an image obtained from the api, 1 min refresh rate", async () => {
  jest.useFakeTimers();
  jest.spyOn(utilities, "getVisualization");
  server.use(
    rest.get("http://api.test/apps/tethysdash/data", (req, res, ctx) => {
      return res(
        ctx.delay(5),
        ctx.status(200),
        ctx.json({
          success: true,
          data: "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png",
          viz_type: "image",
        }),
        ctx.set("Content-Type", "application/json")
      );
    })
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
        />
      ),
    })
  );

  const spinner = await screen.findByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  act(() => {
    jest.runOnlyPendingTimers();
  });

  const image = await screen.findByAltText(mockedApiImageBase.source);
  expect(image.src).toBe(
    "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png"
  );
  expect(utilities.getVisualization).toHaveBeenCalledTimes(2);

  // go past refresh rate so getVisualization is called again
  act(() => {
    jest.advanceTimersByTime(90000);
  });

  expect(image.src).toBe(
    "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png"
  );
  expect(utilities.getVisualization).toHaveBeenCalledTimes(3);

  jest.useRealTimers();
});

it("Creates an Base Item with an image obtained from the api, no refresh when editing", async () => {
  jest.useFakeTimers();
  server.use(
    rest.get("http://api.test/apps/tethysdash/data", (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          success: true,
          data: "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png",
          viz_type: "image",
        }),
        ctx.set("Content-Type", "application/json")
      );
    })
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
        />
      ),
      options: { inEditing: true },
    })
  );

  const image = await screen.findByAltText(mockedApiImageBase.source);
  expect(image.src).toBe(
    "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png"
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
    rest.get("http://api.test/apps/tethysdash/data", (req, res, ctx) => {
      return res(
        ctx.delay(5),
        ctx.status(200),
        ctx.json({
          success: true,
          data: mockedPlotData,
          viz_type: "plotly",
        }),
        ctx.set("Content-Type", "application/json")
      );
    })
  );

  render(
    createLoadedComponent({
      children: (
        <BaseVisualization
          source={mockedPlotBase.source}
          argsString={mockedPlotBase.args_string}
          metadataString={mockedPlotBase.metadata_string}
        />
      ),
    })
  );

  const spinner = await screen.findByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  const plot = await screen.findByText("bar chart example");
  expect(plot).toBeInTheDocument();
});

it("Creates an Base Item with a custom module obtained from the api", async () => {
  server.use(
    rest.get("http://api.test/apps/tethysdash/data", (req, res, ctx) => {
      return res(
        ctx.delay(5),
        ctx.status(200),
        ctx.json({
          success: true,
          data: mockedCustomData,
          viz_type: "custom",
        }),
        ctx.set("Content-Type", "application/json")
      );
    })
  );

  render(
    createLoadedComponent({
      children: (
        <BaseVisualization
          source={mockedTableBase.source}
          argsString={mockedTableBase.args_string}
          metadataString={mockedTableBase.metadata_string}
        />
      ),
    })
  );

  const spinner = await screen.findByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  const customModule = await screen.findByText("ModuleLoader Mock");
  expect(customModule).toBeInTheDocument();
});

it("Creates an Base Item with a table obtained from the api", async () => {
  server.use(
    rest.get("http://api.test/apps/tethysdash/data", (req, res, ctx) => {
      return res(
        ctx.delay(5),
        ctx.status(200),
        ctx.json({
          success: true,
          data: mockedTableData,
          viz_type: "table",
        }),
        ctx.set("Content-Type", "application/json")
      );
    })
  );

  render(
    createLoadedComponent({
      children: (
        <BaseVisualization
          source={mockedTableBase.source}
          argsString={mockedTableBase.args_string}
          metadataString={mockedTableBase.metadata_string}
        />
      ),
    })
  );

  const spinner = await screen.findByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  const table = await screen.findByText("User Information");
  expect(table).toBeInTheDocument();
});

it("Creates an Base Item with a card obtained from the api", async () => {
  server.use(
    rest.get("http://api.test/apps/tethysdash/data", (req, res, ctx) => {
      return res(
        ctx.delay(5),
        ctx.status(200),
        ctx.json({
          success: true,
          data: mockedCardData,
          viz_type: "card",
        }),
        ctx.set("Content-Type", "application/json")
      );
    })
  );

  render(
    createLoadedComponent({
      children: (
        <BaseVisualization
          source={mockedCardBase.source}
          argsString={mockedCardBase.args_string}
          metadataString={mockedCardBase.metadata_string}
        />
      ),
    })
  );

  const spinner = await screen.findByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  const card = await screen.findByText("Company Statistics");
  expect(card).toBeInTheDocument();
});

it("Gives the user an error message if an unknown viz type is obtained from the api", async () => {
  server.use(
    rest.get("http://api.test/apps/tethysdash/data", (req, res, ctx) => {
      return res(
        ctx.delay(5),
        ctx.status(200),
        ctx.json({
          success: true,
          data: {},
          viz_type: "random_viz_type",
        }),
        ctx.set("Content-Type", "application/json")
      );
    })
  );

  render(
    createLoadedComponent({
      children: (
        <BaseVisualization
          source={mockedUnknownBase.source}
          argsString={mockedUnknownBase.args_string}
          metadataString={mockedUnknownBase.metadata_string}
        />
      ),
    })
  );

  const spinner = await screen.findByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  const message = await screen.findByText(
    "random_viz_type visualizations still need to be configured"
  );
  expect(message).toBeInTheDocument();
});

it("Gives the user an error message if the api couldn't retrieve data", async () => {
  server.use(
    rest.get("http://api.test/apps/tethysdash/data", (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          success: false,
          data: {},
          viz_type: "",
        }),
        ctx.set("Content-Type", "application/json")
      );
    })
  );

  render(
    createLoadedComponent({
      children: (
        <BaseVisualization
          source={mockedUnknownBase.source}
          argsString={mockedUnknownBase.args_string}
          metadataString={mockedUnknownBase.metadata_string}
        />
      ),
    })
  );

  const message = await screen.findByText("Failed to retrieve data");
  expect(message).toBeInTheDocument();
});

it("Base - update variable input", async () => {
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
    variable_options_source: "text", // TODO Change this to be an empty string or null
    variable_input_type: "text",
  });

  const mockedDashboard = {
    id: 1,
    name: "editable",
    label: "test_label",
    notes: "test_notes",
    editable: true,
    accessGroups: [],
    gridItems: [textVariable, apiImageBase],
  };
  const dashboards = { user: [mockedDashboard], public: [] };

  server.use(
    rest.get("http://api.test/apps/tethysdash/data", (req, res, ctx) => {
      return res(
        ctx.delay(5),
        ctx.status(200),
        ctx.json({
          success: true,
          // eslint-disable-next-line
          data: "${Test Variable}",
          viz_type: "image",
        }),
        ctx.set("Content-Type", "application/json")
      );
    })
  );

  render(
    createLoadedComponent({
      children: (
        <>
          <BaseVisualization
            source={mockedDashboard.gridItems[0].source}
            argsString={mockedDashboard.gridItems[0].args_string}
            metadataString={mockedDashboard.gridItems[0].metadata_string}
          />
          <BaseVisualization
            source={mockedDashboard.gridItems[1].source}
            argsString={mockedDashboard.gridItems[1].args_string}
            metadataString={mockedDashboard.gridItems[1].metadata_string}
          />
        </>
      ),
      options: { dashboards, initialDashboard: mockedDashboard },
    })
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
    "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png"
  );
});
