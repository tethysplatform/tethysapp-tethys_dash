import { useRef, useState } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import VisualizationPane from "components/modals/DataViewer/VisualizationPane";
import { mockedDashboards } from "__tests__/utilities/constants";
import createLoadedComponent from "__tests__/utilities/customRender";
import PropTypes from "prop-types";
import { server } from "__tests__/utilities/server";
import { rest } from "msw";
import MapContextProvider from "components/contexts/MapContext";

const TestingComponent = ({
  source,
  argsString,
  setGridItemMessage,
  vizType,
  setVizType,
  setVizData,
  setVizMetadata,
  setShowingSubModal,
  gridItemIndex,
  initialSelectedVizTypeOption,
}) => {
  const [selectedVizTypeOption, setSelectVizTypeOption] = useState(
    initialSelectedVizTypeOption
  );
  const [vizInputsValues, setVizInputsValues] = useState(
    JSON.parse(argsString)
  );
  const [variableInputValue, setVariableInputValue] = useState(null);
  const settingsRef = useRef({});
  const visualizationRef = useRef();

  return (
    <>
      <VisualizationPane
        gridItemIndex={gridItemIndex}
        source={source}
        argsString={argsString}
        setGridItemMessage={setGridItemMessage}
        selectedVizTypeOption={selectedVizTypeOption}
        setSelectVizTypeOption={setSelectVizTypeOption}
        vizType={vizType}
        setVizType={setVizType}
        setVizData={setVizData}
        setVizMetadata={setVizMetadata}
        vizInputsValues={vizInputsValues}
        setVizInputsValues={setVizInputsValues}
        variableInputValue={variableInputValue}
        setVariableInputValue={setVariableInputValue}
        settingsRef={settingsRef}
        visualizationRef={visualizationRef}
        setShowingSubModal={setShowingSubModal}
      />
      <p data-testid="viz-input-values">{JSON.stringify(vizInputsValues)}</p>
    </>
  );
};

test("Visualization Pane Custom Image", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const mockSetVizMetadata = jest.fn();
  const mockSetShowingSubModal = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          gridItemIndex={0}
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          vizType={"loader"}
          setVizType={mockSetVizType}
          setVizData={mockSetVizData}
          setVizMetadata={mockSetVizMetadata}
          setShowingSubModal={mockSetShowingSubModal}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    })
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetVizType).toHaveBeenCalledTimes(0);
  expect(mockSetVizData).toHaveBeenCalledTimes(0);

  const visualizationTypeSelect = await screen.findByLabelText(
    "Search Visualization Type Button"
  );
  await userEvent.click(visualizationTypeSelect);
  const groupOption = await screen.findByText("Default");
  fireEvent.click(groupOption);

  const visualizationOption = await screen.findByLabelText(
    "Custom Image Visualization Card"
  );
  fireEvent.click(visualizationOption);
  expect(await screen.findByText("Image Source")).toBeInTheDocument();

  expect(mockSetVizMetadata).toHaveBeenCalledWith(null);
  expect(mockSetVizType).toHaveBeenCalledWith("unknown");
  expect(mockSetVizData).toHaveBeenCalledWith({});

  const imageSourceInput = screen.getByLabelText("Image Source Input");
  fireEvent.change(imageSourceInput, { target: { value: "some_png" } });

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "Custom Image",
    args: { image_source: "some_png" },
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Custom Image"
  );
  expect(mockSetVizType).toHaveBeenCalledWith("image");
  expect(mockSetVizData).toHaveBeenCalledWith({ source: "some_png" });
});

test("Visualization Pane Custom Image through Dropdown", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const mockSetVizMetadata = jest.fn();
  const mockSetShowingSubModal = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          gridItemIndex={0}
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          vizType={"loader"}
          setVizType={mockSetVizType}
          setVizData={mockSetVizData}
          setVizMetadata={mockSetVizMetadata}
          setShowingSubModal={mockSetShowingSubModal}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    })
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetVizType).toHaveBeenCalledTimes(0);
  expect(mockSetVizData).toHaveBeenCalledTimes(0);

  const comboboxes = await screen.findAllByRole("combobox");
  const visualizationTypeSelect = comboboxes[0];
  await userEvent.click(visualizationTypeSelect);
  const visualizationOption = await screen.findByText("Custom Image");
  fireEvent.click(visualizationOption);
  expect(await screen.findByText("Image Source")).toBeInTheDocument();

  expect(mockSetVizMetadata).toHaveBeenCalledWith(null);
  expect(mockSetVizType).toHaveBeenCalledWith("unknown");
  expect(mockSetVizData).toHaveBeenCalledWith({});

  const imageSourceInput = screen.getByLabelText("Image Source Input");
  fireEvent.change(imageSourceInput, { target: { value: "some_png" } });

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "Custom Image",
    args: { image_source: "some_png" },
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Custom Image"
  );
  expect(mockSetVizType).toHaveBeenCalledWith("image");
  expect(mockSetVizData).toHaveBeenCalledWith({ source: "some_png" });
});

test("Visualization Pane Variable Input", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const mockSetVizMetadata = jest.fn();
  const mockSetShowingSubModal = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          vizType={"loader"}
          setVizType={mockSetVizType}
          setVizData={mockSetVizData}
          setVizMetadata={mockSetVizMetadata}
          setShowingSubModal={mockSetShowingSubModal}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    })
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetVizType).toHaveBeenCalledTimes(0);
  expect(mockSetVizData).toHaveBeenCalledTimes(0);

  const visualizationTypeSelect = await screen.findByLabelText(
    "Search Visualization Type Button"
  );
  await userEvent.click(visualizationTypeSelect);
  const groupOption = await screen.findByText("Default");
  fireEvent.click(groupOption);

  const visualizationOption = await screen.findByLabelText(
    "Variable Input Visualization Card"
  );
  fireEvent.click(visualizationOption);

  const customImageOption = await screen.findByText("Variable Input");
  fireEvent.click(customImageOption);
  expect(await screen.findByText("Variable Name")).toBeInTheDocument();
  expect(
    await screen.findByText("Variable Options Source")
  ).toBeInTheDocument();

  const variableNameInput = screen.getByLabelText("Variable Name Input");
  fireEvent.change(variableNameInput, { target: { value: "Test Variable" } });

  const variableOptionsSourceSelect = screen.getByLabelText(
    "Variable Options Source Input"
  );
  await userEvent.click(variableOptionsSourceSelect);
  const textOption = await screen.findByText("text");
  fireEvent.click(textOption);

  expect(mockSetVizMetadata).toHaveBeenCalledWith(null);
  expect(mockSetVizType).toHaveBeenCalledWith("variableInput");
  expect(mockSetVizData).toHaveBeenCalledWith({});

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "Variable Input",
    args: {
      initial_value: "",
      variable_name: "Test Variable",
      variable_options_source: "text",
    },
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Variable Input"
  );
  expect(mockSetVizType).toHaveBeenCalledWith("variableInput");
  expect(mockSetVizData.mock.calls[1][0].initial_value).toBe("");
  expect(mockSetVizData.mock.calls[1][0].variable_name).toBe("Test Variable");
  expect(mockSetVizData.mock.calls[1][0].variable_options_source).toBe("text");

  await userEvent.click(variableOptionsSourceSelect);
  const numberOption = await screen.findByText("number");
  fireEvent.click(numberOption);

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "Variable Input",
    args: {
      initial_value: "0",
      variable_name: "Test Variable",
      variable_options_source: "number",
    },
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Variable Input"
  );
  expect(mockSetVizType).toHaveBeenCalledWith("variableInput");
  expect(mockSetVizData.mock.calls[2][0].initial_value).toBe("0");
  expect(mockSetVizData.mock.calls[2][0].variable_name).toBe("Test Variable");
  expect(mockSetVizData.mock.calls[2][0].variable_options_source).toBe(
    "number"
  );

  await userEvent.click(variableOptionsSourceSelect);
  const checkboxOption = await screen.findByText("checkbox");
  fireEvent.click(checkboxOption);

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "Variable Input",
    args: {
      initial_value: null,
      variable_name: "Test Variable",
      variable_options_source: "checkbox",
    },
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Variable Input"
  );
  expect(mockSetVizType).toHaveBeenCalledWith("variableInput");
  expect(mockSetVizData.mock.calls[3][0].initial_value).toBe(null);
  expect(mockSetVizData.mock.calls[3][0].variable_name).toBe("Test Variable");
  expect(mockSetVizData.mock.calls[3][0].variable_options_source).toBe(
    "checkbox"
  );
});

test("Visualization Pane Other Type", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const mockSetVizMetadata = jest.fn();
  const mockSetShowingSubModal = jest.fn();
  server.use(
    rest.get("http://api.test/apps/tethysdash/data", (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          success: true,
          data: {},
          viz_type: "some_type",
        }),
        ctx.set("Content-Type", "application/json")
      );
    })
  );

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          vizType={"loader"}
          setVizType={mockSetVizType}
          setVizData={mockSetVizData}
          setVizMetadata={mockSetVizMetadata}
          setShowingSubModal={mockSetShowingSubModal}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    })
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetVizType).toHaveBeenCalledTimes(0);
  expect(mockSetVizData).toHaveBeenCalledTimes(0);

  const visualizationTypeSelect = await screen.findByLabelText(
    "Search Visualization Type Button"
  );
  await userEvent.click(visualizationTypeSelect);
  const groupOption = await screen.findByText("Visualization Group");
  fireEvent.click(groupOption);

  const visualizationOption = await screen.findByLabelText(
    "plugin_label Visualization Card"
  );
  fireEvent.click(visualizationOption);

  const pluginLabelOption = await screen.findByText("plugin_label");
  fireEvent.click(pluginLabelOption);
  expect(await screen.findByText("Plugin Arg")).toBeInTheDocument();

  const pluginArg1Input = screen.getByLabelText("Plugin Arg Input");
  fireEvent.change(pluginArg1Input, { target: { value: "some value" } });

  expect(mockSetVizMetadata).toHaveBeenCalledWith(null);
  expect(mockSetVizType).toHaveBeenCalledWith("loader");
  expect(mockSetVizData).toHaveBeenCalledWith({});

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "plugin_source",
    args: {
      plugin_arg: "some value",
    },
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show plugin_label"
  );
  expect(mockSetVizType).toHaveBeenCalledWith("loader");
  expect(mockSetVizData).toHaveBeenCalledWith({});

  await userEvent.click(visualizationTypeSelect);
  const group2Option = await screen.findByText("Visualization Group");
  fireEvent.click(group2Option);

  const visualization2Option = await screen.findByLabelText(
    "plugin_label2 Visualization Card"
  );
  fireEvent.click(visualization2Option);

  const pluginLabel2Option = await screen.findByText("plugin_label2");
  fireEvent.click(pluginLabel2Option);
  expect(await screen.findByText("Plugin Arg")).toBeInTheDocument();

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "plugin_source2",
    args: {
      plugin_arg: "some value",
    },
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show plugin_label2"
  );
  expect(mockSetVizType).toHaveBeenCalledWith("vizWarning");
  expect(mockSetVizData).toHaveBeenCalledWith({
    warnings: ["some_type visualizations still need to be configured"],
  });

  await userEvent.click(visualizationTypeSelect);
  const group3Option = await screen.findByText("Visualization Group 2");
  fireEvent.click(group3Option);

  const visualization3Option = await screen.findByLabelText(
    "plugin_label3 Visualization Card"
  );
  fireEvent.click(visualization3Option);

  const pluginLabel3Option = await screen.findByText("plugin_label3");
  fireEvent.click(pluginLabel3Option);
  expect(await screen.findByText("Plugin Arg3")).toBeInTheDocument();

  const pluginArg3Input = screen.getByLabelText("Plugin Arg3 Input");
  fireEvent.change(pluginArg3Input, { target: { value: "some new value" } });

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "plugin_source3",
    args: {
      plugin_arg3: "some new value",
    },
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show plugin_label3"
  );
  expect(mockSetVizType).toHaveBeenCalledWith("vizWarning");
  expect(mockSetVizData).toHaveBeenCalledWith({
    warnings: ["some_type visualizations still need to be configured"],
  });
});

test("Visualization Pane Other Type Checkbox", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const mockSetVizMetadata = jest.fn();
  const mockSetShowingSubModal = jest.fn();
  server.use(
    rest.get("http://api.test/apps/tethysdash/data", (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          success: true,
          data: {},
          viz_type: "some_type",
        }),
        ctx.set("Content-Type", "application/json")
      );
    })
  );

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
  ];

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          vizType={"loader"}
          setVizType={mockSetVizType}
          setVizData={mockSetVizData}
          setVizMetadata={mockSetVizMetadata}
          setShowingSubModal={mockSetShowingSubModal}
        />
      ),
      options: {
        inDataViewerMode: true,
        visualizations: availableVisualizations,
      },
    })
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetVizType).toHaveBeenCalledTimes(0);
  expect(mockSetVizData).toHaveBeenCalledTimes(0);

  const visualizationTypeSelect = await screen.findByLabelText(
    "Search Visualization Type Button"
  );
  await userEvent.click(visualizationTypeSelect);
  const groupOption = await screen.findByText("Other");
  fireEvent.click(groupOption);

  const visualizationOption = await screen.findByLabelText(
    "plugin_label_checkbox Visualization Card"
  );
  fireEvent.click(visualizationOption);

  const pluginLabelOption = await screen.findByText("plugin_label_checkbox");
  fireEvent.click(pluginLabelOption);
  expect(await screen.findByText("Plugin Arg")).toBeInTheDocument();

  const pluginArgSelect = screen.getByLabelText("Plugin Arg Input");
  await userEvent.click(pluginArgSelect);
  const trueOption = await screen.findByText("True");
  await userEvent.click(trueOption);

  expect(mockSetVizMetadata).toHaveBeenCalledWith(null);
  expect(mockSetVizType).toHaveBeenCalledWith("vizWarning");
  expect(mockSetVizData).toHaveBeenCalledWith({
    warnings: ["some_type visualizations still need to be configured"],
  });

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "plugin_source_checkbox",
    args: {
      plugin_arg: true,
    },
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show plugin_label_checkbox"
  );
  expect(mockSetVizType).toHaveBeenCalledWith("vizWarning");
  expect(mockSetVizData).toHaveBeenCalledWith({
    warnings: ["some_type visualizations still need to be configured"],
  });
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify({
      plugin_arg: true,
    })
  );

  await userEvent.click(pluginArgSelect);
  const falseOption = await screen.findByText("False");
  await userEvent.click(falseOption);

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "plugin_source_checkbox",
    args: {
      plugin_arg: false,
    },
  });
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify({
      plugin_arg: false,
    })
  );
});

test("Visualization Pane Use Existing Bad Type", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.user[0];
  mockedDashboard.gridItems = [
    {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Some bad type",
      args_string: JSON.stringify({
        image_source: "some_png",
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const mockSetVizMetadata = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          vizType={"loader"}
          setVizType={mockSetVizType}
          setVizData={mockSetVizData}
          setVizMetadata={mockSetVizMetadata}
        />
      ),
      options: {
        inDataViewerMode: true,
        dashboards: updatedMockedDashboards,
      },
    })
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetGridItemMessage).toHaveBeenCalledTimes(0);
  expect(mockSetVizType).toHaveBeenCalledTimes(0);
  expect(mockSetVizData).toHaveBeenCalledTimes(0);
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify({ image_source: "some_png" })
  );
});

test("Visualization Pane Use Existing Args Map", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.user[0];
  mockedDashboard.gridItems = [
    {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Map",
      args_string: JSON.stringify({
        baseMap:
          "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer",
        layers: [],
        layerControl: true,
        map_extent: "-13149708.122672563, 5192159.850904623,6.900403428857136",
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const mockSetVizMetadata = jest.fn();
  const mockSetShowingSubModal = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            layoutContext={mockedDashboard}
            source={gridItem.source}
            argsString={gridItem.args_string}
            setGridItemMessage={mockSetGridItemMessage}
            vizType={"loader"}
            setVizType={mockSetVizType}
            setVizData={mockSetVizData}
            setVizMetadata={mockSetVizMetadata}
            setShowingSubModal={mockSetShowingSubModal}
          />
        </MapContextProvider>
      ),
      options: {
        inDataViewerMode: true,
        dashboards: updatedMockedDashboards,
      },
    })
  );

  expect(await screen.findByText("Map")).toBeInTheDocument();
  const layerTable = await screen.findByRole("table");
  expect(layerTable.rows.length).toBe(1); // just header
  expect(await screen.findByText("True")).toBeInTheDocument();

  await waitFor(async () => {
    expect(mockSetVizMetadata).toHaveBeenCalledWith({
      args: {
        layers: [],
        baseMap:
          "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer",
        map_extent: "-13149708.122672563, 5192159.850904623,6.900403428857136",
        layerControl: true,
      },
      source: "Map",
    });
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Map"
  );
  expect(mockSetVizType).toHaveBeenCalledWith("map");
  expect(mockSetVizData).toHaveBeenCalledWith({
    baseMap:
      "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer",
    layerControl: true,
    layers: [],
    map_extent: "-13149708.122672563, 5192159.850904623,6.900403428857136",
  });
});

test("Visualization Pane Use Existing Args Variable Input", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.user[0];
  mockedDashboard.gridItems = [
    {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Variable Input",
      args_string: JSON.stringify({
        variable_name: "test_var",
        variable_options_source: "text",
        initial_value: "some value",
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const mockSetVizMetadata = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          vizType={"loader"}
          setVizType={mockSetVizType}
          setVizData={mockSetVizData}
          setVizMetadata={mockSetVizMetadata}
        />
      ),
      options: {
        inDataViewerMode: true,
        dashboards: updatedMockedDashboards,
      },
    })
  );

  await waitFor(async () => {
    expect(mockSetVizMetadata).toHaveBeenCalledWith({
      source: "Variable Input",
      args: {
        variable_name: "test_var",
        variable_options_source: "text",
        initial_value: "some value",
      },
    });
  });

  expect(await screen.findByText("Variable Input")).toBeInTheDocument();
  expect(await screen.findByText("text")).toBeInTheDocument();

  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Variable Input"
  );
  expect(mockSetVizType).toHaveBeenCalledWith("variableInput");
  expect(mockSetVizData.mock.calls[0][0].initial_value).toBe("some value");
  expect(mockSetVizData.mock.calls[0][0].variable_name).toBe("test_var");
  expect(mockSetVizData.mock.calls[0][0].variable_options_source).toBe("text");
});

test("Visualization Pane Use Existing Args Custom Image", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.user[0];
  mockedDashboard.gridItems = [
    {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Custom Image",
      args_string: JSON.stringify({
        image_source: "some_png",
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const mockSetVizMetadata = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          vizType={"loader"}
          setVizType={mockSetVizType}
          setVizData={mockSetVizData}
          setVizMetadata={mockSetVizMetadata}
        />
      ),
      options: {
        inDataViewerMode: true,
        dashboards: updatedMockedDashboards,
      },
    })
  );

  expect(await screen.findByText("Custom Image")).toBeInTheDocument();

  await waitFor(async () => {
    expect(mockSetVizMetadata).toHaveBeenCalledWith({
      source: "Custom Image",
      args: {
        image_source: "some_png",
      },
    });
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Custom Image"
  );
  expect(mockSetVizType).toHaveBeenCalledWith("image");
  expect(mockSetVizData).toHaveBeenCalledWith({ source: "some_png" });
});

test("Visualization Pane Use Existing Args Viz with True checkbox", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.user[0];
  mockedDashboard.gridItems = [
    {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "plugin_source",
      args_string: JSON.stringify({
        plugin_arg: true,
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const mockedVisualizations = [
    {
      label: "Other",
      options: [
        {
          source: "plugin_source",
          value: "plugin_value",
          label: "plugin_label",
          args: { plugin_arg: "checkbox" },
          type: "some type",
          tags: [],
          description: "",
        },
      ],
    },
  ];
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const mockSetVizMetadata = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          vizType={"loader"}
          setVizType={mockSetVizType}
          setVizData={mockSetVizData}
          setVizMetadata={mockSetVizMetadata}
        />
      ),
      options: {
        inDataViewerMode: true,
        dashboards: updatedMockedDashboards,
        visualizations: mockedVisualizations,
      },
    })
  );

  expect(await screen.findByText("plugin_label")).toBeInTheDocument();
  expect(await screen.findByText("Plugin Arg")).toBeInTheDocument();
  expect(await screen.findByText("True")).toBeInTheDocument();

  await waitFor(async () => {
    expect(mockSetVizMetadata).toHaveBeenCalledWith({
      source: "plugin_source",
      args: {
        plugin_arg: true,
      },
    });
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show plugin_label"
  );
  expect(mockSetVizType).toHaveBeenCalledWith("plotly");
  expect(mockSetVizData).toHaveBeenCalledWith({});
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify({ plugin_arg: true })
  );
});

test("Visualization Pane Use Existing Args Viz with False checkbox", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.user[0];
  mockedDashboard.gridItems = [
    {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "plugin_source",
      args_string: JSON.stringify({
        plugin_arg: false,
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const mockedVisualizations = [
    {
      label: "Other",
      options: [
        {
          source: "plugin_source",
          value: "plugin_value",
          label: "plugin_label",
          args: { plugin_arg: "checkbox" },
          type: "some type",
          tags: [],
          description: "",
        },
      ],
    },
  ];
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const mockSetVizMetadata = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          vizType={"loader"}
          setVizType={mockSetVizType}
          setVizData={mockSetVizData}
          setVizMetadata={mockSetVizMetadata}
        />
      ),
      options: {
        inDataViewerMode: true,
        dashboards: updatedMockedDashboards,
        visualizations: mockedVisualizations,
      },
    })
  );

  expect(await screen.findByText("plugin_label")).toBeInTheDocument();
  expect(await screen.findByText("Plugin Arg")).toBeInTheDocument();
  expect(await screen.findByText("False")).toBeInTheDocument();

  await waitFor(async () => {
    expect(mockSetVizMetadata).toHaveBeenCalledWith({
      source: "plugin_source",
      args: {
        plugin_arg: false,
      },
    });
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show plugin_label"
  );
  expect(mockSetVizType).toHaveBeenCalledWith("plotly");
  expect(mockSetVizData).toHaveBeenCalledWith({});
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify({ plugin_arg: false })
  );
});

test("Visualization Pane Use Existing Subs Args", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.user[0];
  mockedDashboard.gridItems = [
    {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "plugin_source",
      args_string: JSON.stringify({
        plugin_arg: "arg1",
        "plugin_arg.sub_arg1a": "sub_arg1a",
        "plugin_arg.sub_arg1a.sub_arg1aa": false,
        plugin_arg2: "arg3",
        "plugin_arg2.sub_arg3a": "some value",
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const mockedVisualizations = [
    {
      label: "Other",
      options: [
        {
          source: "plugin_source",
          value: "plugin_value",
          label: "plugin_label",
          args: {
            plugin_arg: [
              {
                value: "arg1",
                label: "Arg 1",
                sub_args: {
                  sub_arg1a: [
                    {
                      value: "sub_arg1a",
                      label: "Sub Arg 1A",
                      sub_args: {
                        sub_arg1aa: "checkbox",
                      },
                    },
                    {
                      value: "sub_arg1b",
                      label: "Sub Arg 1B",
                    },
                  ],
                },
              },
              {
                value: "arg2",
                label: "Arg 2",
              },
            ],
            plugin_arg2: [
              {
                value: "arg3",
                label: "Arg 3",
                sub_args: {
                  sub_arg3a: "text",
                },
              },
            ],
          },
          type: "some type",
          tags: [],
          description: "",
        },
      ],
    },
  ];
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const mockSetVizMetadata = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          vizType={"loader"}
          setVizType={mockSetVizType}
          setVizData={mockSetVizData}
          setVizMetadata={mockSetVizMetadata}
        />
      ),
      options: {
        inDataViewerMode: true,
        dashboards: updatedMockedDashboards,
        visualizations: mockedVisualizations,
      },
    })
  );

  expect(await screen.findByText("plugin_label")).toBeInTheDocument();
  // label and value
  expect(screen.getByText("Plugin Arg")).toBeInTheDocument();
  expect(screen.getByText("Arg 1")).toBeInTheDocument();
  // label and value
  expect(screen.getByText("Sub Arg1a")).toBeInTheDocument();
  expect(screen.getByText("Sub Arg 1A")).toBeInTheDocument();
  // label and value
  expect(screen.getByText("Sub Arg1aa")).toBeInTheDocument();
  expect(screen.getByText("False")).toBeInTheDocument();

  // label and value
  expect(screen.getByText("Plugin Arg2")).toBeInTheDocument();
  expect(screen.getByText("Arg 3")).toBeInTheDocument();
  // label and value
  expect(screen.getByText("Sub Arg3a")).toBeInTheDocument();
  let textbox = screen.getByRole("textbox");
  expect(textbox.value).toBe("some value");

  await waitFor(async () => {
    expect(mockSetVizMetadata).toHaveBeenCalledWith({
      source: "plugin_source",
      args: {
        plugin_arg: "arg1",
        "plugin_arg.sub_arg1a": "sub_arg1a",
        "plugin_arg.sub_arg1a.sub_arg1aa": false,
        plugin_arg2: "arg3",
        "plugin_arg2.sub_arg3a": "some value",
      },
    });
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show plugin_label"
  );
  expect(mockSetVizType).toHaveBeenCalledWith("plotly");
  expect(mockSetVizData).toHaveBeenCalledWith({});
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify({
      plugin_arg: "arg1",
      "plugin_arg.sub_arg1a": "sub_arg1a",
      "plugin_arg.sub_arg1a.sub_arg1aa": false,
      plugin_arg2: "arg3",
      "plugin_arg2.sub_arg3a": "some value",
    })
  );
});

test("Visualization Pane Subs Args", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.user[0];
  mockedDashboard.gridItems = [
    {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "",
      args_string: JSON.stringify({}),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const mockedVisualizations = [
    {
      label: "Other",
      options: [
        {
          source: "plugin_source",
          value: "plugin_value",
          label: "plugin_label",
          args: {
            plugin_arg: [
              {
                value: "arg1",
                label: "Arg 1",
                sub_args: {
                  sub_arg1a: [
                    {
                      value: "sub_arg1a",
                      label: "Sub Arg 1A",
                      sub_args: {
                        sub_arg1aa: "checkbox",
                      },
                    },
                    {
                      value: "sub_arg1b",
                      label: "Sub Arg 1B",
                    },
                  ],
                },
              },
              {
                value: "arg2",
                label: "Arg 2",
              },
            ],
            plugin_arg2: [
              {
                value: "arg3",
                label: "Arg 3",
                sub_args: {
                  sub_arg3a: "text",
                },
              },
            ],
          },
          type: "some type",
          tags: [],
          description: "",
        },
      ],
    },
  ];
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const mockSetVizMetadata = jest.fn();
  const mockSetShowingSubModal = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          vizType={"loader"}
          setVizType={mockSetVizType}
          setVizData={mockSetVizData}
          setVizMetadata={mockSetVizMetadata}
          setShowingSubModal={mockSetShowingSubModal}
        />
      ),
      options: {
        inDataViewerMode: true,
        dashboards: updatedMockedDashboards,
        visualizations: mockedVisualizations,
      },
    })
  );

  const visualizationTypeSelect = await screen.findByLabelText(
    "Search Visualization Type Button"
  );
  await userEvent.click(visualizationTypeSelect);
  const groupOption = await screen.findByText("Other");
  fireEvent.click(groupOption);

  const visualizationOption = await screen.findByLabelText(
    "plugin_label Visualization Card"
  );
  fireEvent.click(visualizationOption);

  expect(await screen.findByText("Plugin Arg")).toBeInTheDocument();
  expect(await screen.findByText("Plugin Arg2")).toBeInTheDocument();

  let comboboxes = await screen.findAllByRole("combobox");
  const pluginArgDropdown = comboboxes[1];
  await userEvent.click(pluginArgDropdown);
  const arg1Option = await screen.findByText("Arg 1");
  fireEvent.click(arg1Option);

  expect(await screen.findByText("Sub Arg1a")).toBeInTheDocument();

  comboboxes = await screen.findAllByRole("combobox");
  const subArg1ADropdown = comboboxes[2];
  await userEvent.click(subArg1ADropdown);
  const subArg1AOption = await screen.findByText("Sub Arg 1A");
  fireEvent.click(subArg1AOption);

  expect(await screen.findByText("Sub Arg1aa")).toBeInTheDocument();

  comboboxes = await screen.findAllByRole("combobox");
  const subArg1AADropdown = comboboxes[3];
  await userEvent.click(subArg1AADropdown);
  const trueOption = await screen.findByText("True");
  fireEvent.click(trueOption);

  comboboxes = await screen.findAllByRole("combobox");
  const pluginArg2Dropdown = comboboxes[4];
  await userEvent.click(pluginArg2Dropdown);
  const arg3Option = await screen.findByText("Arg 3");
  fireEvent.click(arg3Option);

  const arg3Textbox = await screen.findByRole("textbox");
  fireEvent.change(arg3Textbox, { target: { value: "some new value" } });

  await waitFor(async () => {
    expect(mockSetVizMetadata).toHaveBeenCalledWith({
      source: "plugin_source",
      args: {
        plugin_arg: "arg1",
        "plugin_arg.sub_arg1a": "sub_arg1a",
        "plugin_arg.sub_arg1a.sub_arg1aa": true,
        plugin_arg2: "arg3",
        "plugin_arg2.sub_arg3a": "some new value",
      },
    });
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show plugin_label"
  );
  expect(mockSetVizType).toHaveBeenCalledWith("loader");
  expect(mockSetVizData).toHaveBeenCalledWith({});
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify({
      plugin_arg: "arg1",
      plugin_arg2: "arg3",
      "plugin_arg.sub_arg1a": "sub_arg1a",
      "plugin_arg.sub_arg1a.sub_arg1aa": true,
      "plugin_arg2.sub_arg3a": "some new value",
    })
  );

  await userEvent.click(subArg1ADropdown);
  const subArg1BOption = await screen.findByText("Sub Arg 1B");
  fireEvent.click(subArg1BOption);

  await waitFor(async () => {
    expect(mockSetVizMetadata).toHaveBeenCalledWith({
      source: "plugin_source",
      args: {
        plugin_arg: "arg1",
        "plugin_arg.sub_arg1a": "sub_arg1b",
        "plugin_arg.sub_arg1a.sub_arg1aa": true,
        plugin_arg2: "arg3",
        "plugin_arg2.sub_arg3a": "some new value",
      },
    });
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show plugin_label"
  );
  expect(mockSetVizType).toHaveBeenCalledTimes(6);
  expect(mockSetVizType).toHaveBeenCalledWith("plotly");
  expect(mockSetVizData).toHaveBeenCalledWith({
    config: undefined,
    data: undefined,
    layout: undefined,
  });
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify({
      plugin_arg: "arg1",
      plugin_arg2: "arg3",
      "plugin_arg.sub_arg1a": "sub_arg1b",
      "plugin_arg.sub_arg1a.sub_arg1aa": true,
      "plugin_arg2.sub_arg3a": "some new value",
    })
  );

  await userEvent.click(subArg1ADropdown);
  const newSubArg1AOption = await screen.findByText("Sub Arg 1A");
  fireEvent.click(newSubArg1AOption);

  expect(mockSetVizType).toHaveBeenCalledTimes(8);
  expect(mockSetShowingSubModal).toHaveBeenCalledWith(false);
});

test("Visualization Pane Use Existing Args and switch type with same arg", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.user[0];
  mockedDashboard.gridItems = [
    {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "plugin_source",
      args_string: JSON.stringify({
        plugin_arg: "some text value",
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const mockedVisualizations = [
    {
      label: "Other",
      options: [
        {
          source: "plugin_source",
          value: "plugin_value",
          label: "plugin_label",
          args: { plugin_arg: "text" },
          type: "some type",
          tags: [],
          description: "",
        },
        {
          source: "plugin_source2",
          value: "plugin_value2",
          label: "plugin_label2",
          args: { plugin_arg: "text", plugin_arg2: "text" },
          type: "some type",
          tags: [],
          description: "",
        },
      ],
    },
  ];
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const mockSetVizMetadata = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          vizType={"loader"}
          setVizType={mockSetVizType}
          setVizData={mockSetVizData}
          setVizMetadata={mockSetVizMetadata}
        />
      ),
      options: {
        inDataViewerMode: true,
        dashboards: updatedMockedDashboards,
        visualizations: mockedVisualizations,
      },
    })
  );

  expect(await screen.findByText("plugin_label")).toBeInTheDocument();
  expect(await screen.findByText("Plugin Arg")).toBeInTheDocument();
  const pluginArg = screen.getByRole("textbox");
  expect(pluginArg.value).toBe("some text value");

  await waitFor(async () => {
    expect(mockSetVizMetadata).toHaveBeenCalledWith({
      source: "plugin_source",
      args: {
        plugin_arg: "some text value",
      },
    });
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show plugin_label"
  );
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify({ plugin_arg: "some text value" })
  );

  const comboboxes = await screen.findAllByRole("combobox");
  const visualizationTypeSelect = comboboxes[0];
  await userEvent.click(visualizationTypeSelect);
  const visualizationOption = await screen.findByText("plugin_label2");
  fireEvent.click(visualizationOption);

  expect(await screen.findByText("plugin_label2")).toBeInTheDocument();
  expect(await screen.findByText("Plugin Arg")).toBeInTheDocument();
  expect(await screen.findByText("Plugin Arg2")).toBeInTheDocument();
  const pluginArgs = screen.getAllByRole("textbox");
  expect(pluginArgs[0].value).toBe("some text value");
  expect(pluginArgs[1].value).toBe("");

  expect(mockSetVizType).toHaveBeenCalledWith("unknown");
  expect(mockSetVizData).toHaveBeenCalledWith({});
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify({ plugin_arg: "some text value", plugin_arg2: "" })
  );
});

TestingComponent.propTypes = {
  layoutContext: PropTypes.object,
  source: PropTypes.string,
  argsString: PropTypes.string,
  setGridItemMessage: PropTypes.func,
  setViz: PropTypes.func,
  setVizMetadata: PropTypes.func,
  setShowingSubModal: PropTypes.func,
  gridItemIndex: PropTypes.number,
  vizType: PropTypes.string,
  setVizType: PropTypes.func,
  setVizData: PropTypes.func,
  initialSelectedVizTypeOption: PropTypes.object,
};
