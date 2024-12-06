import { act, useEffect, useRef, useState } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent } from "@testing-library/react";
import VisualizationPane, {
  CustomTextOptions,
} from "components/modals/DataViewer/VisualizationPane";
import {
  mockedDashboards,
  mockedVisualizationsWithDefaults,
} from "__tests__/utilities/constants";
import SelectedDashboardContextProvider, {
  useLayoutContext,
} from "components/contexts/SelectedDashboardContext";
import { AppContext } from "components/contexts/AppContext";
import VariableInputsContextProvider from "components/contexts/VariableInputsContext";
import DataViewerModeContextProvider from "components/contexts/DataViewerModeContext";
import Image from "components/visualizations/Image";
import appAPI from "services/api/app";
import PropTypes from "prop-types";

const TestingComponent = ({
  layoutContext,
  source,
  argsString,
  setGridItemMessage,
  setViz,
  setVizMetadata,
}) => {
  const [selectedVizTypeOption, setSelectVizTypeOption] = useState(null);
  const [vizInputsValues, setVizInputsValues] = useState([]);
  const [variableInputValue, setVariableInputValue] = useState(null);
  const { setLayoutContext } = useLayoutContext();
  const settingsRef = useRef({});
  const visualizationRef = useRef();

  useEffect(() => {
    setLayoutContext(layoutContext);
    // eslint-disable-next-line
  }, []);

  return (
    <>
      <VisualizationPane
        source={source}
        argsString={argsString}
        setGridItemMessage={setGridItemMessage}
        selectedVizTypeOption={selectedVizTypeOption}
        setSelectVizTypeOption={setSelectVizTypeOption}
        setViz={setViz}
        setVizMetadata={setVizMetadata}
        vizInputsValues={vizInputsValues}
        setVizInputsValues={setVizInputsValues}
        variableInputValue={variableInputValue}
        setVariableInputValue={setVariableInputValue}
        settingsRef={settingsRef}
        visualizationRef={visualizationRef}
      />
    </>
  );
};

test("Visualization Pane Custom Image", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetViz = jest.fn();
  const mockSetVizMetadata = jest.fn();

  render(
    <AppContext.Provider
      value={{
        visualizations: mockedVisualizationsWithDefaults,
      }}
    >
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <DataViewerModeContextProvider>
            <TestingComponent
              layoutContext={mockedDashboard}
              source={gridItem.source}
              argsString={gridItem.args_string}
              setGridItemMessage={mockSetGridItemMessage}
              setViz={mockSetViz}
              setVizMetadata={mockSetVizMetadata}
            />
          </DataViewerModeContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetViz).toHaveBeenCalledTimes(0);

  const visualizationTypeSelect = screen.getByLabelText("visualizationType");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(visualizationTypeSelect);
  });
  const customImageOption = await screen.findByText("Custom Image");
  fireEvent.click(customImageOption);
  expect(await screen.findByText("Image Source:")).toBeInTheDocument();

  expect(mockSetVizMetadata).toHaveBeenCalledWith(null);
  expect(mockSetViz).toHaveBeenCalledWith(null);

  const imageSourceInput = screen.getByLabelText("Image Source Input");
  fireEvent.change(imageSourceInput, { target: { value: "some_png" } });

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "Custom Image",
    args: { image_source: "some_png" },
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Other Custom Image"
  );
  expect(mockSetViz).toHaveBeenCalledWith(
    <Image source={"some_png"} visualizationRef={{ current: null }} />
  );
});

test("Visualization Pane Text", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetViz = jest.fn();
  const mockSetVizMetadata = jest.fn();

  render(
    <AppContext.Provider
      value={{
        visualizations: mockedVisualizationsWithDefaults,
      }}
    >
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <DataViewerModeContextProvider>
            <TestingComponent
              layoutContext={mockedDashboard}
              source={gridItem.source}
              argsString={gridItem.args_string}
              setGridItemMessage={mockSetGridItemMessage}
              setViz={mockSetViz}
              setVizMetadata={mockSetVizMetadata}
            />
          </DataViewerModeContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetViz).toHaveBeenCalledTimes(0);

  const visualizationTypeSelect = screen.getByLabelText("visualizationType");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(visualizationTypeSelect);
  });
  const texteOption = await screen.findByText("Text");
  fireEvent.click(texteOption);

  expect(mockSetVizMetadata).toHaveBeenCalledWith(null);
  expect(mockSetViz).toHaveBeenCalledWith(null);

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "Text",
    args: { text: "" },
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Other Text"
  );

  expect(mockSetViz.mock.calls[1][0].type.name).toBe("CustomTextOptions");
  expect(mockSetViz.mock.calls[1][0].props.index).toBe(0);
  expect(mockSetViz.mock.calls[1][0].props.objValue).toStrictEqual({
    label: "Text",
    name: "text",
    type: "text",
    value: "",
  });
});

test("Visualization Pane Variable Input", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetViz = jest.fn();
  const mockSetVizMetadata = jest.fn();

  render(
    <AppContext.Provider
      value={{
        visualizations: mockedVisualizationsWithDefaults,
      }}
    >
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <DataViewerModeContextProvider>
            <TestingComponent
              layoutContext={mockedDashboard}
              source={gridItem.source}
              argsString={gridItem.args_string}
              setGridItemMessage={mockSetGridItemMessage}
              setViz={mockSetViz}
              setVizMetadata={mockSetVizMetadata}
            />
          </DataViewerModeContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetViz).toHaveBeenCalledTimes(0);

  const visualizationTypeSelect = screen.getByLabelText("visualizationType");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(visualizationTypeSelect);
  });

  const customImageOption = await screen.findByText("Variable Input");
  fireEvent.click(customImageOption);
  expect(await screen.findByText("Variable Name:")).toBeInTheDocument();
  expect(
    await screen.findByText("Variable Options Source:")
  ).toBeInTheDocument();

  const variableNameInput = screen.getByLabelText("Variable Name Input");
  fireEvent.change(variableNameInput, { target: { value: "Test Variable" } });

  const variableOptionsSourceSelect = screen.getByLabelText(
    "Variable Options Source Input"
  );
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(variableOptionsSourceSelect);
  });
  const textOption = await screen.findByText("text");
  fireEvent.click(textOption);

  expect(mockSetVizMetadata).toHaveBeenCalledWith(null);
  expect(mockSetViz).toHaveBeenCalledWith(null);

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "Variable Input",
    args: {
      initial_value: "",
      variable_name: "Test Variable",
      variable_options_source: "text",
    },
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Other Variable Input"
  );
  expect(mockSetViz.mock.calls[1][0].type.name).toBe("VariableInput");
  expect(mockSetViz.mock.calls[1][0].props.args).toStrictEqual({
    initial_value: "",
    variable_name: "Test Variable",
    variable_options_source: "text",
  });

  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(variableOptionsSourceSelect);
  });
  const numberOption = await screen.findByText("number");
  fireEvent.click(numberOption);

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "Variable Input",
    args: {
      initial_value: 0,
      variable_name: "Test Variable",
      variable_options_source: "number",
    },
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Other Variable Input"
  );
  expect(mockSetViz.mock.calls[2][0].type.name).toBe("VariableInput");
  expect(mockSetViz.mock.calls[2][0].props.args).toStrictEqual({
    initial_value: 0,
    variable_name: "Test Variable",
    variable_options_source: "number",
  });

  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(variableOptionsSourceSelect);
  });
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
    "Cell updated to show Other Variable Input"
  );
  expect(mockSetViz.mock.calls[3][0].type.name).toBe("VariableInput");
  expect(mockSetViz.mock.calls[3][0].props.args).toStrictEqual({
    initial_value: null,
    variable_name: "Test Variable",
    variable_options_source: "checkbox",
  });
});

test("Visualization Pane Other Type", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetViz = jest.fn();
  const mockSetVizMetadata = jest.fn();
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: true,
      viz_type: "some_type",
    });
  };

  render(
    <AppContext.Provider
      value={{
        visualizations: mockedVisualizationsWithDefaults,
      }}
    >
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <DataViewerModeContextProvider>
            <TestingComponent
              layoutContext={mockedDashboard}
              source={gridItem.source}
              argsString={gridItem.args_string}
              setGridItemMessage={mockSetGridItemMessage}
              setViz={mockSetViz}
              setVizMetadata={mockSetVizMetadata}
            />
          </DataViewerModeContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetViz).toHaveBeenCalledTimes(0);

  const visualizationTypeSelect = screen.getByLabelText("visualizationType");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(visualizationTypeSelect);
  });

  const pluginLabelOption = await screen.findByText("plugin_label");
  fireEvent.click(pluginLabelOption);
  expect(await screen.findByText("Plugin Arg:")).toBeInTheDocument();

  const pluginArg1Input = screen.getByLabelText("Plugin Arg Input");
  fireEvent.change(pluginArg1Input, { target: { value: "some value" } });

  expect(mockSetVizMetadata).toHaveBeenCalledWith(null);
  expect(mockSetViz).toHaveBeenCalledWith(null);

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "plugin_source",
    args: {
      plugin_arg: "some value",
    },
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Visualization Group plugin_label"
  );
  expect(mockSetViz).toHaveBeenCalled();
  expect(mockSetViz.mock.calls[1][0].props).toStrictEqual({
    animation: "border",
    "data-testid": "Loading...",
    variant: "info",
  });

  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(visualizationTypeSelect);
  });

  const pluginLabel2Option = await screen.findByText("plugin_label2");
  fireEvent.click(pluginLabel2Option);
  expect(await screen.findByText("Plugin Arg:")).toBeInTheDocument();

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "plugin_source2",
    args: {
      plugin_arg: "some value",
    },
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Visualization Group plugin_label2"
  );
  expect(mockSetViz).toHaveBeenCalled();
  expect(mockSetViz.mock.calls[1][0].props).toStrictEqual({
    animation: "border",
    "data-testid": "Loading...",
    variant: "info",
  });

  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(visualizationTypeSelect);
  });

  const pluginLabel3Option = await screen.findByText("plugin_label3");
  fireEvent.click(pluginLabel3Option);
  expect(await screen.findByText("Plugin Arg3:")).toBeInTheDocument();

  const pluginArg3Input = screen.getByLabelText("Plugin Arg3 Input");
  fireEvent.change(pluginArg3Input, { target: { value: "some new value" } });

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "plugin_source3",
    args: {
      plugin_arg3: "some new value",
    },
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Visualization Group 2 plugin_label3"
  );
  expect(mockSetViz).toHaveBeenCalled();
  expect(mockSetViz.mock.calls[1][0].props).toStrictEqual({
    animation: "border",
    "data-testid": "Loading...",
    variant: "info",
  });
});

test("Visualization Pane Other Type Checkbox", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetViz = jest.fn();
  const mockSetVizMetadata = jest.fn();
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: true,
      viz_type: "some_type",
    });
  };
  const availableVisualizations = [
    {
      label: "Visualization Group",
      options: [
        {
          source: "plugin_source_checkbox",
          value: "plugin_value_checkbox",
          label: "plugin_label_checkbox",
          args: { plugin_arg: "checkbox" },
        },
      ],
    },
  ];

  render(
    <AppContext.Provider
      value={{
        visualizations: availableVisualizations,
      }}
    >
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <DataViewerModeContextProvider>
            <TestingComponent
              layoutContext={mockedDashboard}
              source={gridItem.source}
              argsString={gridItem.args_string}
              setGridItemMessage={mockSetGridItemMessage}
              setViz={mockSetViz}
              setVizMetadata={mockSetVizMetadata}
            />
          </DataViewerModeContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetViz).toHaveBeenCalledTimes(0);

  const visualizationTypeSelect = screen.getByLabelText("visualizationType");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(visualizationTypeSelect);
  });

  const pluginLabelOption = await screen.findByText("plugin_label_checkbox");
  fireEvent.click(pluginLabelOption);
  expect(await screen.findByText("Plugin Arg:")).toBeInTheDocument();

  const pluginArgSelect = screen.getByLabelText("Plugin Arg Input");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(pluginArgSelect);
  });
  const trueOption = await screen.findByText("True");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(trueOption);
  });

  expect(mockSetVizMetadata).toHaveBeenCalledWith(null);
  expect(mockSetViz).toHaveBeenCalledWith(null);

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "plugin_source_checkbox",
    args: {
      plugin_arg: true,
    },
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Visualization Group plugin_label_checkbox"
  );
  expect(mockSetViz).toHaveBeenCalled();
  expect(mockSetViz.mock.calls[1][0].props).toStrictEqual({
    animation: "border",
    "data-testid": "Loading...",
    variant: "info",
  });
});

test("Visualization Pane Use Existing Args Variable Input", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
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
        initial_value: { value: "some value" },
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetViz = jest.fn();
  const mockSetVizMetadata = jest.fn();

  render(
    <AppContext.Provider
      value={{
        visualizations: mockedVisualizationsWithDefaults,
      }}
    >
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <DataViewerModeContextProvider>
            <TestingComponent
              layoutContext={mockedDashboard}
              source={gridItem.source}
              argsString={gridItem.args_string}
              setGridItemMessage={mockSetGridItemMessage}
              setViz={mockSetViz}
              setVizMetadata={mockSetVizMetadata}
            />
          </DataViewerModeContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "Variable Input",
    args: {
      variable_name: "test_var",
      variable_options_source: "text",
      initial_value: { value: "some value" },
    },
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Other Variable Input"
  );
  expect(mockSetViz).toHaveBeenCalled();
  expect(mockSetViz.mock.calls[0][0].props.args).toStrictEqual({
    initial_value: {
      value: "some value",
    },
    variable_name: "test_var",
    variable_options_source: "text",
  });
});

test("Visualization Pane Use Existing Args Custom Image", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
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
  const mockSetViz = jest.fn();
  const mockSetVizMetadata = jest.fn();

  render(
    <AppContext.Provider
      value={{
        visualizations: mockedVisualizationsWithDefaults,
      }}
    >
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <DataViewerModeContextProvider>
            <TestingComponent
              layoutContext={mockedDashboard}
              source={gridItem.source}
              argsString={gridItem.args_string}
              setGridItemMessage={mockSetGridItemMessage}
              setViz={mockSetViz}
              setVizMetadata={mockSetVizMetadata}
            />
          </DataViewerModeContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "Custom Image",
    args: {
      image_source: "some_png",
    },
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Other Custom Image"
  );
  expect(mockSetViz).toHaveBeenCalled();
  expect(mockSetViz).toHaveBeenCalledWith(
    <Image source={"some_png"} visualizationRef={{ current: undefined }} />
  );
});

test("Visualization Pane Use Existing Args Viz with checkbox", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
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
      label: "Visualization Group",
      options: [
        {
          source: "plugin_source",
          value: "plugin_value",
          label: "plugin_label",
          args: { plugin_arg: "checkbox" },
        },
      ],
    },
  ];
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetViz = jest.fn();
  const mockSetVizMetadata = jest.fn();

  render(
    <AppContext.Provider
      value={{
        visualizations: mockedVisualizations,
      }}
    >
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <DataViewerModeContextProvider>
            <TestingComponent
              layoutContext={mockedDashboard}
              source={gridItem.source}
              argsString={gridItem.args_string}
              setGridItemMessage={mockSetGridItemMessage}
              setViz={mockSetViz}
              setVizMetadata={mockSetVizMetadata}
            />
          </DataViewerModeContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "plugin_source",
    args: {
      plugin_arg: true,
    },
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Visualization Group plugin_label"
  );
  expect(mockSetViz).toHaveBeenCalled();
  expect(mockSetViz.mock.calls[0][0].props).toStrictEqual({
    animation: "border",
    "data-testid": "Loading...",
    variant: "info",
  });
});

test("CustomTextOptions", async () => {
  function onChange(new_value, index) {}
  render(
    <CustomTextOptions
      index={0}
      objValue={{
        label: "Text",
        name: "text",
        type: "text",
        value: "Here is some text",
      }}
      onChange={onChange}
    />
  );

  expect(await screen.findByText("Here is some text")).toBeInTheDocument();
  const textArea = await screen.findByLabelText("textEditor");
  await userEvent.click(textArea);
  await userEvent.keyboard(" and some more text.");
  expect(
    await screen.findByText("Here is some text and some more text.")
  ).toBeInTheDocument();
});

TestingComponent.propTypes = {
  layoutContext: PropTypes.object,
  source: PropTypes.string,
  argsString: PropTypes.string,
  setGridItemMessage: PropTypes.func,
  setViz: PropTypes.func,
  setVizMetadata: PropTypes.func,
};
