import { useRef, useState } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import VisualizationPane, {
  CustomTextOptions,
} from "components/modals/DataViewer/VisualizationPane";
import { mockedDashboards } from "__tests__/utilities/constants";
import Image from "components/visualizations/Image";
import appAPI from "services/api/app";
import createLoadedComponent from "__tests__/utilities/customRender";
import PropTypes from "prop-types";

const TestingComponent = ({
  source,
  argsString,
  setGridItemMessage,
  setViz,
  setVizMetadata,
  setShowingSubModal,
  gridItemIndex,
}) => {
  const [selectedVizTypeOption, setSelectVizTypeOption] = useState(null);
  const [vizInputsValues, setVizInputsValues] = useState([]);
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
        setViz={setViz}
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
  const mockSetViz = jest.fn();
  const mockSetVizMetadata = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          gridItemIndex={0}
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          setViz={mockSetViz}
          setVizMetadata={mockSetVizMetadata}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    })
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetViz).toHaveBeenCalledTimes(0);

  const visualizationTypeSelect =
    await screen.findByLabelText("visualizationType");
  await userEvent.click(visualizationTypeSelect);
  const customImageOption = await screen.findByText("Custom Image");
  fireEvent.click(customImageOption);
  expect(await screen.findByText("Image Source")).toBeInTheDocument();

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
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetViz = jest.fn();
  const mockSetVizMetadata = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          setViz={mockSetViz}
          setVizMetadata={mockSetVizMetadata}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    })
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetViz).toHaveBeenCalledTimes(0);

  const visualizationTypeSelect =
    await screen.findByLabelText("visualizationType");
  await userEvent.click(visualizationTypeSelect);
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
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetViz = jest.fn();
  const mockSetVizMetadata = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          setViz={mockSetViz}
          setVizMetadata={mockSetVizMetadata}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    })
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetViz).toHaveBeenCalledTimes(0);

  const visualizationTypeSelect =
    await screen.findByLabelText("visualizationType");
  await userEvent.click(visualizationTypeSelect);

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
    "Cell updated to show Other Variable Input"
  );
  expect(mockSetViz.mock.calls[2][0].type.name).toBe("VariableInput");
  expect(mockSetViz.mock.calls[2][0].props.args).toStrictEqual({
    initial_value: "0",
    variable_name: "Test Variable",
    variable_options_source: "number",
  });

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
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
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
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          setViz={mockSetViz}
          setVizMetadata={mockSetVizMetadata}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    })
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetViz).toHaveBeenCalledTimes(0);

  const visualizationTypeSelect =
    await screen.findByLabelText("visualizationType");
  await userEvent.click(visualizationTypeSelect);

  const pluginLabelOption = await screen.findByText("plugin_label");
  fireEvent.click(pluginLabelOption);
  expect(await screen.findByText("Plugin Arg")).toBeInTheDocument();

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

  await userEvent.click(visualizationTypeSelect);

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
    "Cell updated to show Visualization Group plugin_label2"
  );
  expect(mockSetViz).toHaveBeenCalled();

  await userEvent.click(visualizationTypeSelect);

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
    "Cell updated to show Visualization Group 2 plugin_label3"
  );
  expect(mockSetViz).toHaveBeenCalled();
});

test("Visualization Pane Other Type Checkbox", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
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
      label: "Other",
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
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          setViz={mockSetViz}
          setVizMetadata={mockSetVizMetadata}
        />
      ),
      options: {
        inDataViewerMode: true,
        visualizations: availableVisualizations,
      },
    })
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetViz).toHaveBeenCalledTimes(0);

  const visualizationTypeSelect =
    await screen.findByLabelText("visualizationType");
  await userEvent.click(visualizationTypeSelect);

  const pluginLabelOption = await screen.findByText("plugin_label_checkbox");
  fireEvent.click(pluginLabelOption);
  expect(await screen.findByText("Plugin Arg")).toBeInTheDocument();

  const pluginArgSelect = screen.getByLabelText("Plugin Arg Input");
  await userEvent.click(pluginArgSelect);
  const trueOption = await screen.findByText("True");
  await userEvent.click(trueOption);

  expect(mockSetVizMetadata).toHaveBeenCalledWith(null);
  expect(mockSetViz).toHaveBeenCalledWith(null);

  expect(mockSetVizMetadata).toHaveBeenCalledWith({
    source: "plugin_source_checkbox",
    args: {
      plugin_arg: true,
    },
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Other plugin_label_checkbox"
  );
  expect(mockSetViz).toHaveBeenCalled();
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
  const mockSetViz = jest.fn();
  const mockSetVizMetadata = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          setViz={mockSetViz}
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
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Other Variable Input"
  );
  expect(mockSetViz).toHaveBeenCalled();
  expect(mockSetViz.mock.calls[0][0].props.args).toStrictEqual({
    initial_value: "some value",
    variable_name: "test_var",
    variable_options_source: "text",
  });
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
  const mockSetViz = jest.fn();
  const mockSetVizMetadata = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          setViz={mockSetViz}
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
      source: "Custom Image",
      args: {
        image_source: "some_png",
      },
    });
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Other Custom Image"
  );
  expect(mockSetViz).toHaveBeenCalled();
  expect(mockSetViz).toHaveBeenCalledWith(
    <Image source={"some_png"} visualizationRef={{ current: undefined }} />
  );
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
        },
      ],
    },
  ];
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetViz = jest.fn();
  const mockSetVizMetadata = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          setViz={mockSetViz}
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

  await waitFor(async () => {
    expect(mockSetVizMetadata).toHaveBeenCalledWith({
      source: "plugin_source",
      args: {
        plugin_arg: true,
      },
    });
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Other plugin_label"
  );
  expect(mockSetViz).toHaveBeenCalled();
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify([
      {
        label: "Plugin Arg",
        name: "plugin_arg",
        type: [
          { label: "True", value: true },
          { label: "False", value: false },
        ],
        value: { label: "True", value: true },
      },
    ])
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
        },
      ],
    },
  ];
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetViz = jest.fn();
  const mockSetVizMetadata = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
          source={gridItem.source}
          argsString={gridItem.args_string}
          setGridItemMessage={mockSetGridItemMessage}
          setViz={mockSetViz}
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

  await waitFor(async () => {
    expect(mockSetVizMetadata).toHaveBeenCalledWith({
      source: "plugin_source",
      args: {
        plugin_arg: false,
      },
    });
  });
  expect(mockSetGridItemMessage).toHaveBeenCalledWith(
    "Cell updated to show Other plugin_label"
  );
  expect(mockSetViz).toHaveBeenCalled();
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify([
      {
        label: "Plugin Arg",
        name: "plugin_arg",
        type: [
          { label: "True", value: true },
          { label: "False", value: false },
        ],
        value: { label: "False", value: false },
      },
    ])
  );
});

test("CustomTextOptions", async () => {
  function onChange(new_value, index) {}
  render(
    <CustomTextOptions
      index={0}
      objValue={{
        label: "Text",
        name: "Text",
        type: "Text",
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
  setShowingSubModal: PropTypes.func,
  gridItemIndex: PropTypes.number,
};
