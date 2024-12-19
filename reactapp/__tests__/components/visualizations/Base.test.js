import PropTypes from "prop-types";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  mockedApiImageBase,
  mockedAvailableVizArgs,
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
} from "__tests__/utilities/constants";
import Base from "components/visualizations/Base";
import appAPI from "services/api/app";
import { EditingContext } from "components/contexts/EditingContext";
import { VariableInputValuesContext } from "components/contexts/VariableInputsContext";
import { AvailableVisualizationsContext } from "components/contexts/AvailableVisualizationsContext";
import { DataViewerModeContext } from "components/contexts/DataViewerModeContext";
import { LayoutGridItemsContext } from "components/contexts/SelectedDashboardContext";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function initAndRender(props) {
  const user = userEvent.setup();
  const hideFullscreen = jest.fn();
  const setVariableInputValues = jest.fn();
  const setInDataViewerMode = jest.fn();
  const setGridItems = jest.fn();
  const updateVariableInputValuesWithGridItems = jest.fn();
  const setIsEditing = jest.fn();

  const BaseRender = (props) => {
    return (
      <AvailableVisualizationsContext.Provider
        value={{ availableVizArgs: mockedAvailableVizArgs }}
      >
        <LayoutGridItemsContext.Provider
          value={{ gridItems: props.gridItems, setGridItems }}
        >
          <DataViewerModeContext.Provider
            value={{
              inDataViewerMode: props.inDataViewer,
              setInDataViewerMode,
            }}
          >
            <VariableInputValuesContext.Provider
              value={{
                variableInputValues: props.variableInputValues,
                setVariableInputValues,
                updateVariableInputValuesWithGridItems,
              }}
            >
              <EditingContext.Provider
                value={{ isEditing: props.isEditing, setIsEditing }}
              >
                <Base
                  source={props.source}
                  argsString={props.argsString}
                  metadataString={props.metadataString}
                  showFullscreen={props.showFullscreen}
                  hideFullscreen={hideFullscreen}
                />
              </EditingContext.Provider>
            </VariableInputValuesContext.Provider>
          </DataViewerModeContext.Provider>
        </LayoutGridItemsContext.Provider>
      </AvailableVisualizationsContext.Provider>
    );
  };

  BaseRender.propTypes = {
    source: PropTypes.string,
    argsString: PropTypes.string,
    metadataString: PropTypes.string,
    showFullscreen: PropTypes.bool,
    hideFullscreen: PropTypes.func,
    variableInputValues: PropTypes.array,
    isEditing: PropTypes.bool,
    inDataViewer: PropTypes.bool,
    gridItems: PropTypes.object,
  };

  const { rerender } = render(BaseRender(props));

  return {
    user,
    BaseRender,
    rerender,
    setVariableInputValues,
    updateVariableInputValuesWithGridItems,
    setIsEditing,
    hideFullscreen,
  };
}

it("Initializes a Base Item with an empty div", () => {
  initAndRender({
    source: "",
    argsString: "{}",
    metadataString: "{}",
    showFullscreen: false,
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

  const { rerender, BaseRender } = initAndRender({
    source: "",
    argsString: "{}",
    metadataString: "{}",
    showFullscreen: false,
  });

  expect(screen.getByTestId("Source_Unknown")).toBeInTheDocument();

  const gridItem = mockedApiImageBase;
  rerender(
    BaseRender({
      source: gridItem.source,
      argsString: gridItem.args_string,
      metadataString: gridItem.metadata_string,
      showFullscreen: false,
    })
  );

  const spinner = screen.getByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  await sleep(100);
  const image = screen.getByAltText(gridItem.source);
  expect(image.src).toBe(
    "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png"
  );
});

it("Creates an Base Item with a Custom Image", async () => {
  const gridItem = mockedCustomImageBase;
  initAndRender({
    source: gridItem.source,
    argsString: gridItem.args_string,
    metadataString: gridItem.metadata_string,
    showFullscreen: false,
  });

  const image = screen.getByAltText("custom_image");
  expect(image.src).toBe("https://www.aquaveo.com/images/aquaveo_logo.svg");
});

it("Creates an Base Item with a Text Box", async () => {
  const gridItem = mockedTextBase;
  initAndRender({
    source: gridItem.source,
    argsString: gridItem.args_string,
    metadataString: gridItem.metadata_string,
    showFullscreen: false,
  });

  const text = screen.getByText("Custom Text");
  expect(text).toBeInTheDocument();
});

it("Creates an Base Item with a variable input text box", async () => {
  const gridItem = mockedTextVariable;
  const { user, setVariableInputValues } = initAndRender({
    source: gridItem.source,
    argsString: gridItem.args_string,
    metadataString: gridItem.metadata_string,
    showFullscreen: false,
    gridItems: [mockedTextVariable],
  });

  const variableInput = screen.getByLabelText("Test Variable Input");
  expect(variableInput).toBeInTheDocument();
  await user.type(variableInput, "Hello World");

  expect(variableInput).toHaveValue("Hello World");

  // Only update the Text Input after clicking the input refresh button
  expect(setVariableInputValues).not.toHaveBeenCalled();

  const refreshButton = screen.getByRole("button");
  expect(refreshButton).toBeInTheDocument();
  await user.click(refreshButton);

  expect(setVariableInputValues).toHaveBeenCalled();

  // Because we used a callback in the setVariableInputValues,
  // We have to dig a bit into the mock to see what values were passed.
  const updater = setVariableInputValues.mock.calls[0][0];
  const result = updater({}); // This is what the existing state would be
  expect(result).toEqual({ "Test Variable": "Hello World" });
});

it("Creates an Base Item with an image obtained from the api", async () => {
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: true,
      data: "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png",
      viz_type: "image",
    });
  };

  const gridItem = mockedApiImageBase;
  initAndRender({
    source: gridItem.source,
    argsString: gridItem.args_string,
    metadataString: gridItem.metadata_string,
    showFullscreen: false,
  });

  const spinner = screen.getByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  await sleep(100);
  const image = screen.getByAltText(gridItem.source);
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

  const gridItem = mockedPlotBase;
  initAndRender({
    source: gridItem.source,
    argsString: gridItem.args_string,
    metadataString: gridItem.metadata_string,
    showFullscreen: false,
  });

  const spinner = screen.getByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  await sleep(100);
  const plot = screen.getByText("bar chart example");
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

  const gridItem = mockedTableBase;
  initAndRender({
    source: gridItem.source,
    argsString: gridItem.args_string,
    metadataString: gridItem.metadata_string,
    showFullscreen: false,
  });

  const spinner = screen.getByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  await sleep(100);
  const table = screen.getByText("User Information");
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

  const gridItem = mockedCardBase;
  initAndRender({
    source: gridItem.source,
    argsString: gridItem.args_string,
    metadataString: gridItem.metadata_string,
    showFullscreen: false,
  });

  const spinner = screen.getByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  await sleep(100);
  const card = screen.getByText("Company Statistics");
  expect(card).toBeInTheDocument();
});

// Waiting on Gio to pass through props with the backlayer npm package https://github.com/Aquaveo/backlayer/tree/main
it("Creates an Base Item with a map obtained from the api", async () => {
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: true,
      data: mockedMapData,
      viz_type: "map",
    });
  };

  const gridItem = mockedMapBase;
  initAndRender({
    source: gridItem.source,
    argsString: gridItem.args_string,
    metadataString: gridItem.metadata_string,
    showFullscreen: false,
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

  const gridItem = mockedUnknownBase;
  initAndRender({
    source: gridItem.source,
    argsString: gridItem.args_string,
    metadataString: gridItem.metadata_string,
    showFullscreen: false,
  });

  const spinner = screen.getByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  await sleep(100);
  const message = screen.getByText(
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

  const gridItem = mockedUnknownBase;
  initAndRender({
    source: gridItem.source,
    argsString: gridItem.args_string,
    metadataString: gridItem.metadata_string,
    showFullscreen: false,
  });

  const spinner = screen.getByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  await sleep(100);
  const message = screen.getByText("Failed to retrieve data");
  expect(message).toBeInTheDocument();
});
