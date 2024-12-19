import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  mockedApiImageBase,
  mockedCardBase,
  mockedCardData,
  mockedCustomImageBase,
  mockedMapBase,
  mockedMapData,
  mockedPlotBase,
  mockedPlotData,
  mockedTableBase,
  mockedTableData,
  mockedTextBase,
  mockedTextVariable,
  mockedUnknownBase,
  mockedDashboards,
} from "__tests__/utilities/constants";
import BaseVisualization from "components/visualizations/Base";
import appAPI from "services/api/app";
import renderWithLoaders, {
  InputVariablePComponent,
} from "__tests__/utilities/customRender";

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

it("Initializes a Base Item with an empty div", () => {
  renderWithLoaders({
    children: (
      <BaseVisualization
        source={""}
        argsString={"{}"}
        metadataString={"{}"}
        showFullscreen={false}
        hideFullscreen={jest.fn()}
      />
    ),
  });

  expect(screen.getByTestId("Source_Unknown")).toBeInTheDocument();
});

it("Initializes a Base Item with an empty div and updates it with an image", async () => {
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: true,
      data: "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png",
      viz_type: "image",
    });
  };

  renderWithLoaders({
    children: (
      <BaseVisualization
        source={mockedApiImageBase.source}
        argsString={mockedApiImageBase.args_string}
        metadataString={mockedApiImageBase.metadata_string}
        showFullscreen={false}
        hideFullscreen={jest.fn()}
      />
    ),
  });

  const spinner = screen.getByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  const image = await screen.findByAltText(mockedApiImageBase.source);
  expect(image.src).toBe(
    "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png"
  );
});

it("Creates an Base Item with a Custom Image", async () => {
  renderWithLoaders({
    children: (
      <BaseVisualization
        source={mockedCustomImageBase.source}
        argsString={mockedCustomImageBase.args_string}
        metadataString={mockedCustomImageBase.metadata_string}
        showFullscreen={false}
        hideFullscreen={jest.fn()}
      />
    ),
  });

  const image = await screen.findByAltText("custom_image");
  expect(image.src).toBe("https://www.aquaveo.com/images/aquaveo_logo.svg");
});

it("Creates an Base Item with a Text Box", async () => {
  renderWithLoaders({
    children: (
      <BaseVisualization
        source={mockedTextBase.source}
        argsString={mockedTextBase.args_string}
        metadataString={mockedTextBase.metadata_string}
        showFullscreen={false}
        hideFullscreen={jest.fn()}
      />
    ),
  });

  const text = await screen.findByText("Custom Text");
  expect(text).toBeInTheDocument();
});

it("Creates an Base Item with a variable input text box", async () => {
  const dashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  dashboard.gridItems = [mockedTextVariable];
  const user = userEvent.setup();

  renderWithLoaders({
    children: (
      <>
        <BaseVisualization
          source={mockedTextVariable.source}
          argsString={mockedTextVariable.args_string}
          metadataString={mockedTextVariable.metadata_string}
          showFullscreen={false}
          hideFullscreen={jest.fn()}
        />
        <InputVariablePComponent />
      </>
    ),
    options: { dashboards: [dashboard] },
  });

  const variableInput = screen.getByLabelText("Test Variable Input");
  expect(variableInput).toBeInTheDocument();
  await user.type(variableInput, "Hello World");

  expect(variableInput).toHaveValue("Hello World");
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({})
  );

  const refreshButton = screen.getByRole("button");
  expect(refreshButton).toBeInTheDocument();
  await user.click(refreshButton);

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "Hello World" })
  );
});

it("Creates an Base Item with an image obtained from the api", async () => {
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: true,
      data: "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png",
      viz_type: "image",
    });
  };

  renderWithLoaders({
    children: (
      <BaseVisualization
        source={mockedApiImageBase.source}
        argsString={mockedApiImageBase.args_string}
        metadataString={mockedApiImageBase.metadata_string}
        showFullscreen={false}
        hideFullscreen={jest.fn()}
      />
    ),
  });

  const spinner = screen.getByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  const image = await screen.findByAltText(mockedApiImageBase.source);
  expect(image.src).toBe(
    "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png"
  );
});

it("Creates an Base Item with a plot obtained from the api", async () => {
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: true,
      data: mockedPlotData,
      viz_type: "plotly",
    });
  };

  renderWithLoaders({
    children: (
      <BaseVisualization
        source={mockedPlotBase.source}
        argsString={mockedPlotBase.args_string}
        metadataString={mockedPlotBase.metadata_string}
        showFullscreen={false}
        hideFullscreen={jest.fn()}
      />
    ),
  });

  const spinner = screen.getByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  const plot = await screen.findByText("bar chart example");
  expect(plot).toBeInTheDocument();
});

it("Creates an Base Item with a table obtained from the api", async () => {
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: true,
      data: mockedTableData,
      viz_type: "table",
    });
  };

  renderWithLoaders({
    children: (
      <BaseVisualization
        source={mockedTableBase.source}
        argsString={mockedTableBase.args_string}
        metadataString={mockedTableBase.metadata_string}
        showFullscreen={false}
        hideFullscreen={jest.fn()}
      />
    ),
  });

  const spinner = screen.getByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  const table = await screen.findByText("User Information");
  expect(table).toBeInTheDocument();
});

it("Creates an Base Item with a card obtained from the api", async () => {
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: true,
      data: mockedCardData,
      viz_type: "card",
    });
  };

  renderWithLoaders({
    children: (
      <BaseVisualization
        source={mockedCardBase.source}
        argsString={mockedCardBase.args_string}
        metadataString={mockedCardBase.metadata_string}
        showFullscreen={false}
        hideFullscreen={jest.fn()}
      />
    ),
  });

  const spinner = screen.getByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  const card = await screen.findByText("Company Statistics");
  expect(card).toBeInTheDocument();
});

it("Creates an Base Item with a map obtained from the api", async () => {
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: true,
      data: mockedMapData,
      viz_type: "map",
    });
  };

  renderWithLoaders({
    children: (
      <BaseVisualization
        source={mockedMapBase.source}
        argsString={mockedMapBase.args_string}
        metadataString={mockedMapBase.metadata_string}
        showFullscreen={false}
        hideFullscreen={jest.fn()}
      />
    ),
  });

  const spinner = screen.getByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  expect(await screen.findByTestId("backlayer-map")).toBeInTheDocument();
});

it("Gives the user an error message if an unknown viz type is obtained from the api", async () => {
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: true,
      data: {},
      viz_type: "random_viz_type",
    });
  };

  renderWithLoaders({
    children: (
      <BaseVisualization
        source={mockedUnknownBase.source}
        argsString={mockedUnknownBase.args_string}
        metadataString={mockedUnknownBase.metadata_string}
        showFullscreen={false}
        hideFullscreen={jest.fn()}
      />
    ),
  });

  const spinner = screen.getByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  const message = await screen.findByText(
    "random_viz_type visualizations still need to be configured"
  );
  expect(message).toBeInTheDocument();
});

it("Gives the user an error message if the api couldn't retrieve data", async () => {
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: false,
      data: {},
      viz_type: "",
    });
  };

  renderWithLoaders({
    children: (
      <BaseVisualization
        source={mockedUnknownBase.source}
        argsString={mockedUnknownBase.args_string}
        metadataString={mockedUnknownBase.metadata_string}
        showFullscreen={false}
        hideFullscreen={jest.fn()}
      />
    ),
  });

  const spinner = screen.getByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  const message = await screen.findByText("Failed to retrieve data");
  expect(message).toBeInTheDocument();
});
