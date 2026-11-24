import { useRef, useState, useContext } from "react";
import userEvent from "@testing-library/user-event";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import VisualizationPane, {
  VisualizationArguments,
} from "components/modals/DataViewer/VisualizationPane";
import {
  mockedDashboards,
  userDashboard,
  mockedTextVariable,
  mockedTextBase,
} from "__tests__/utilities/constants";
import createLoadedComponent from "__tests__/utilities/customRender";
import PropTypes from "prop-types";
import { server } from "__tests__/utilities/server";
import { rest } from "msw";
import {
  AppContext,
  AppTourContext,
  GridItemContext,
  LayoutContext,
} from "components/contexts/Contexts";
import { findVisualizationBySource } from "components/visualizations/utilities";
import { ARGS_SETTLE_MS } from "components/modals/utilities";
import appAPI from "services/api/app";
import MapContextProvider from "components/contexts/MapContext";

// A plugin tile's preview, after its first, waits for the args to hold still
// (ARGS_SETTLE_MS). This makes a change and lets that wait pass on a fake
// clock, so the preview starts before any reply can land, then goes back to
// the real clock for what the test does next. No real preview timer may be
// pending when it starts: the fake clock cannot clear one.
function changeAndLetThePreviewStart(change) {
  jest.useFakeTimers();
  try {
    change();
    act(() => {
      jest.advanceTimersByTime(ARGS_SETTLE_MS);
    });
    // Nothing was left on the fake clock for the real one to drop.
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
}

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
}) => {
  const { visualizations } = useContext(AppContext);
  let initialSelectedVizTypeOption = findVisualizationBySource(
    visualizations,
    source,
  );
  let initialVizArguments = [];
  let initialVizInputsValues = {};
  let initialVariableInputValue = null;
  if (initialSelectedVizTypeOption) {
    const existingArgs = JSON.parse(argsString);
    if (source === "Variable Input") {
      initialVariableInputValue = existingArgs.initial_value;
    }
    for (let arg in initialSelectedVizTypeOption.args) {
      let vizArgType = initialSelectedVizTypeOption.args[arg];
      let existingArg = existingArgs[arg];
      initialVizArguments.push({
        label: arg,
        name: arg,
        type: vizArgType,
        value: existingArg,
      });
    }
    initialVizInputsValues = existingArgs;
  }

  const [selectedVizTypeOption, setSelectVizTypeOption] = useState(
    initialSelectedVizTypeOption,
  );
  const [vizArguments, setVizArguments] = useState(initialVizArguments);
  const [vizInputsValues, setVizInputsValues] = useState(
    initialVizInputsValues,
  );
  const [variableInputValue, setVariableInputValue] = useState(
    initialVariableInputValue,
  );
  const [settings, setSettings] = useState({});
  const visualizationRef = useRef();

  return (
    <>
      <VisualizationPane
        gridItemIndex={gridItemIndex}
        setGridItemMessage={setGridItemMessage}
        selectedVizTypeOption={selectedVizTypeOption}
        setSelectVizTypeOption={setSelectVizTypeOption}
        vizArguments={vizArguments}
        setVizArguments={setVizArguments}
        vizType={vizType}
        setVizType={setVizType}
        setVizData={setVizData}
        setVizMetadata={setVizMetadata}
        vizInputsValues={vizInputsValues}
        setVizInputsValues={setVizInputsValues}
        variableInputValue={variableInputValue}
        setVariableInputValue={setVariableInputValue}
        settings={settings}
        setSettings={setSettings}
        visualizationRef={visualizationRef}
        setShowingSubModal={setShowingSubModal}
        requestId={12345678}
      />
      <p data-testid="viz-input-values">{JSON.stringify(vizInputsValues)}</p>
    </>
  );
};

test("Search Visualization Type Button doesnt do anything in AppTour", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const mockSetVizMetadata = jest.fn();
  const mockSetShowingSubModal = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <AppTourContext.Provider
          value={{
            activeAppTour: true,
          }}
        >
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
        </AppTourContext.Provider>
      ),
      options: {
        inDataViewerMode: true,
      },
    }),
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetVizType).toHaveBeenCalledTimes(0);
  expect(mockSetVizData).toHaveBeenCalledTimes(0);

  const visualizationTypeSelect = await screen.findByLabelText(
    "Search Visualization Type Button",
  );
  await userEvent.click(visualizationTypeSelect);
  expect(screen.queryByText("Default")).not.toBeInTheDocument();
  expect(mockSetShowingSubModal).toHaveBeenCalledTimes(0);
});

test("Visualization Pane Custom Image", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
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
    }),
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetVizType).toHaveBeenCalledTimes(0);
  expect(mockSetVizData).toHaveBeenCalledTimes(0);

  const visualizationTypeSelect = await screen.findByLabelText(
    "Search Visualization Type Button",
  );
  await userEvent.click(visualizationTypeSelect);
  const groupOption = await screen.findByText("Default");
  fireEvent.click(groupOption);

  const visualizationOption = await screen.findByLabelText(
    "Custom Image Visualization Card",
  );
  fireEvent.click(visualizationOption);
  expect(await screen.findByText("Image Source")).toBeInTheDocument();

  expect(mockSetVizMetadata).toHaveBeenLastCalledWith(null);
  expect(mockSetVizType).toHaveBeenLastCalledWith("unknown");
  expect(mockSetVizData).toHaveBeenLastCalledWith({});

  const imageSourceInput = screen.getByLabelText("Image Source Input");
  fireEvent.change(imageSourceInput, { target: { value: "some_png" } });

  expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
    source: "Custom Image",
    args: { image_source: "some_png" },
    requestId: 12345678,
  });
  expect(mockSetGridItemMessage).toHaveBeenLastCalledWith(
    "Cell updated to show Custom Image",
  );
  expect(mockSetVizType).toHaveBeenLastCalledWith("image");
  expect(mockSetVizData).toHaveBeenLastCalledWith({
    source: "some_png",
    alt: "custom_image",
  });
});

test("Visualization Pane Text", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  mockedDashboard.tabs[0].gridItems = [mockedTextBase];
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
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
    }),
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetVizType).toHaveBeenCalledTimes(0);
  expect(mockSetVizData).toHaveBeenCalledTimes(0);

  expect(await screen.findByText("Text")).toBeInTheDocument();

  await waitFor(() => {
    expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
      source: "Text",
      args: {
        text: "Custom Text",
      },
    });
  });
  expect(mockSetGridItemMessage).toHaveBeenLastCalledWith(
    "Cell updated to show Text",
  );
  expect(mockSetVizType).toHaveBeenCalledTimes(0);
  expect(mockSetVizData).toHaveBeenCalledTimes(0);
});

test("Visualization Pane Custom Image through Dropdown", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
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
    }),
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

  expect(mockSetVizMetadata).toHaveBeenLastCalledWith(null);
  expect(mockSetVizType).toHaveBeenLastCalledWith("unknown");
  expect(mockSetVizData).toHaveBeenLastCalledWith({});

  const imageSourceInput = screen.getByLabelText("Image Source Input");
  fireEvent.change(imageSourceInput, { target: { value: "some_png" } });

  expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
    source: "Custom Image",
    args: { image_source: "some_png" },
    requestId: 12345678,
  });
  expect(mockSetGridItemMessage).toHaveBeenLastCalledWith(
    "Cell updated to show Custom Image",
  );
  expect(mockSetVizType).toHaveBeenLastCalledWith("image");
  expect(mockSetVizData).toHaveBeenLastCalledWith({
    source: "some_png",
    alt: "custom_image",
  });
});

test("Visualization Pane Variable Input", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
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
    }),
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetVizType).toHaveBeenCalledTimes(0);
  expect(mockSetVizData).toHaveBeenCalledTimes(0);

  const visualizationTypeSelect = await screen.findByLabelText(
    "Search Visualization Type Button",
  );
  await userEvent.click(visualizationTypeSelect);
  const groupOption = await screen.findByText("Default");
  fireEvent.click(groupOption);

  let visualizationOption = await screen.findByLabelText(
    "Variable Input Visualization Card",
  );
  fireEvent.click(visualizationOption);

  const customImageOption = await screen.findByText("Variable Input");
  fireEvent.click(customImageOption);
  expect(await screen.findByText("Variable Name")).toBeInTheDocument();
  expect(
    await screen.findByText("Variable Options Source"),
  ).toBeInTheDocument();

  const variableNameInput = screen.getByLabelText("Variable Name Input");
  fireEvent.change(variableNameInput, { target: { value: "Test Variable" } });

  const variableOptionsSourceSelect = screen.getByLabelText(
    "Variable Options Source Input",
  );
  await userEvent.click(variableOptionsSourceSelect);
  const textOption = await screen.findByText("text");
  fireEvent.click(textOption);

  expect(mockSetVizType).toHaveBeenLastCalledWith("variableInput");
  expect(mockSetVizData).toHaveBeenLastCalledWith(
    expect.objectContaining({
      initial_value: "",
      metadata: undefined,
      variable_name: "Test Variable",
      variable_options_source: "text",
    }),
  );

  expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
    source: "Variable Input",
    args: {
      initial_value: "",
      variable_name: "Test Variable",
      variable_options_source: "text",
      show_label: true,
    },
  });
  expect(mockSetGridItemMessage).toHaveBeenLastCalledWith(
    "Cell updated to show Variable Input",
  );

  await userEvent.click(variableOptionsSourceSelect);
  const numberOption = await screen.findByText("number");
  fireEvent.click(numberOption);

  expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
    source: "Variable Input",
    args: {
      initial_value: "0",
      variable_name: "Test Variable",
      variable_options_source: "number",
      show_label: true,
    },
  });
  expect(mockSetGridItemMessage).toHaveBeenLastCalledWith(
    "Cell updated to show Variable Input",
  );
  expect(mockSetVizType).toHaveBeenLastCalledWith("variableInput");
  expect(mockSetVizData).toHaveBeenLastCalledWith(
    expect.objectContaining({
      initial_value: "0",
      metadata: undefined,
      variable_name: "Test Variable",
      variable_options_source: "number",
      show_label: true,
    }),
  );

  await userEvent.click(variableOptionsSourceSelect);
  const checkboxOption = await screen.findByText("checkbox");
  fireEvent.click(checkboxOption);

  expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
    source: "Variable Input",
    args: {
      initial_value: null,
      variable_name: "Test Variable",
      variable_options_source: "checkbox",
      show_label: true,
    },
  });
  expect(mockSetGridItemMessage).toHaveBeenLastCalledWith(
    "Cell updated to show Variable Input",
  );
  expect(mockSetVizType).toHaveBeenLastCalledWith("variableInput");
  expect(mockSetVizData).toHaveBeenLastCalledWith(
    expect.objectContaining({
      initial_value: null,
      metadata: undefined,
      variable_name: "Test Variable",
      variable_options_source: "checkbox",
      show_label: true,
    }),
  );

  const comboboxes = await screen.findAllByRole("combobox");
  const showLabelSelect = comboboxes[1];
  await userEvent.click(showLabelSelect);
  visualizationOption = await screen.findByRole("option", { name: "False" });
  fireEvent.click(visualizationOption);

  expect(mockSetVizData).toHaveBeenLastCalledWith(
    expect.objectContaining({
      initial_value: null,
      metadata: undefined,
      variable_name: "Test Variable",
      variable_options_source: "checkbox",
      show_label: false,
    }),
  );
});

test("Visualization Pane Other Type", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const mockSetVizMetadata = jest.fn();
  const mockSetShowingSubModal = jest.fn();
  server.use(
    rest.post(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            data: { text: "some text" },
            viz_type: "some_type",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
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
    }),
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetVizType).toHaveBeenCalledTimes(0);
  expect(mockSetVizData).toHaveBeenCalledTimes(0);

  const visualizationTypeSelect = await screen.findByLabelText(
    "Search Visualization Type Button",
  );
  await userEvent.click(visualizationTypeSelect);
  const groupOption = await screen.findByText("Visualization Group");
  fireEvent.click(groupOption);

  const visualizationOption = await screen.findByLabelText(
    "plugin_label Visualization Card",
  );
  fireEvent.click(visualizationOption);

  const pluginLabelOption = await screen.findByText("plugin_label");
  fireEvent.click(pluginLabelOption);
  expect(await screen.findByText("Plugin Arg")).toBeInTheDocument();

  const pluginArg1Input = screen.getByLabelText("Plugin Arg Input");
  changeAndLetThePreviewStart(() =>
    fireEvent.change(pluginArg1Input, { target: { value: "some value" } }),
  );

  expect(mockSetVizType).toHaveBeenLastCalledWith("loader");
  expect(mockSetVizData).toHaveBeenLastCalledWith({});

  expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
    source: "plugin_source",
    args: {
      plugin_arg: "some value",
    },
    requestId: 12345678,
  });
  expect(mockSetGridItemMessage).toHaveBeenLastCalledWith(
    "Cell updated to show plugin_label",
  );
  expect(mockSetVizType).toHaveBeenLastCalledWith("loader");
  expect(mockSetVizData).toHaveBeenLastCalledWith({});

  await userEvent.click(visualizationTypeSelect);
  const group2Option = await screen.findByText("Visualization Group");
  fireEvent.click(group2Option);

  const visualization2Option = await screen.findByLabelText(
    "plugin_label2 Visualization Card",
  );
  fireEvent.click(visualization2Option);

  const pluginLabel2Option = await screen.findByText("plugin_label2");
  fireEvent.click(pluginLabel2Option);
  expect(await screen.findByText("Plugin Arg")).toBeInTheDocument();

  expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
    source: "plugin_source2",
    args: {
      plugin_arg: "some value",
    },
    requestId: 12345678,
  });
  expect(mockSetGridItemMessage).toHaveBeenLastCalledWith(
    "Cell updated to show plugin_label2",
  );
  expect(mockSetVizType).toHaveBeenCalledWith("vizWarning");
  expect(mockSetVizData).toHaveBeenCalledWith({
    warnings: ["some_type visualizations still need to be configured"],
  });

  await userEvent.click(visualizationTypeSelect);
  const group3Option = await screen.findByText("Visualization Group 2");
  fireEvent.click(group3Option);

  const visualization3Option = await screen.findByLabelText(
    "plugin_label3 Visualization Card",
  );
  fireEvent.click(visualization3Option);

  const pluginLabel3Option = await screen.findByText("plugin_label3");
  fireEvent.click(pluginLabel3Option);
  expect(await screen.findByText("Plugin Arg3")).toBeInTheDocument();

  const pluginArg3Input = screen.getByLabelText("Plugin Arg3 Input");
  changeAndLetThePreviewStart(() =>
    fireEvent.change(pluginArg3Input, { target: { value: "some new value" } }),
  );

  expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
    source: "plugin_source3",
    args: {
      plugin_arg3: "some new value",
    },
    requestId: 12345678,
  });
  expect(mockSetGridItemMessage).toHaveBeenLastCalledWith(
    "Cell updated to show plugin_label3",
  );
  expect(mockSetVizType).toHaveBeenCalledWith("vizWarning");
  expect(mockSetVizData).toHaveBeenCalledWith({
    warnings: ["some_type visualizations still need to be configured"],
  });
});

// Opens the pane on a new tile and picks a plugin taking one text arg, whose
// blank first value is not previewed. Returns the arg's input.
async function pickTextPlugin(setVizData = jest.fn()) {
  const gridItem = JSON.parse(JSON.stringify(userDashboard)).tabs[0]
    .gridItems[0];
  render(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider value={{ gridItemUUID: "edited-tile-uuid" }}>
          <TestingComponent
            source={gridItem.source}
            argsString={gridItem.args_string}
            setGridItemMessage={jest.fn()}
            vizType={"loader"}
            setVizType={jest.fn()}
            setVizData={setVizData}
            setVizMetadata={jest.fn()}
            setShowingSubModal={jest.fn()}
          />
        </GridItemContext.Provider>
      ),
      options: { inDataViewerMode: true },
    }),
  );
  await userEvent.click(
    await screen.findByLabelText("Search Visualization Type Button"),
  );
  fireEvent.click(await screen.findByText("Visualization Group"));
  fireEvent.click(
    await screen.findByLabelText("plugin_label Visualization Card"),
  );
  fireEvent.click(await screen.findByText("plugin_label"));
  return screen.findByLabelText("Plugin Arg Input");
}

// What the plugin answers for a value: a table titled after it.
const tableFor = (value) => ({
  success: true,
  viz_type: "table",
  data: { title: value, data: [] },
});

test("a plugin tile's preview waits for typing to stop, then runs once for the whole value", async () => {
  const spy = jest
    .spyOn(appAPI, "getVisualizationData")
    .mockImplementation(async ({ args }) => tableFor(args.plugin_arg));
  try {
    const input = await pickTextPlugin();

    jest.useFakeTimers();
    try {
      // Keystrokes half the wait apart: none of the gaps is a pause.
      for (const value of ["s", "so", "som", "some"]) {
        fireEvent.change(input, { target: { value } });
        act(() => {
          jest.advanceTimersByTime(ARGS_SETTLE_MS / 2);
        });
        expect(spy).not.toHaveBeenCalled();
      }
      act(() => {
        jest.advanceTimersByTime(ARGS_SETTLE_MS);
      });
    } finally {
      jest.useRealTimers();
    }

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith(
      expect.objectContaining({ args: { plugin_arg: "some" } }),
    );
  } finally {
    spy.mockRestore();
  }
});

test("a preview's reply that a newer preview has replaced shows nothing", async () => {
  let replyForFirst;
  const spy = jest
    .spyOn(appAPI, "getVisualizationData")
    .mockImplementation(({ args }) =>
      args.plugin_arg === "first"
        ? new Promise((resolve) => {
            replyForFirst = () => resolve(tableFor("first"));
          })
        : Promise.resolve(tableFor(args.plugin_arg)),
    );
  const setVizData = jest.fn();
  try {
    const input = await pickTextPlugin(setVizData);

    // The first value's preview is held; the second's answers at once.
    for (const value of ["first", "second"]) {
      changeAndLetThePreviewStart(() =>
        fireEvent.change(input, { target: { value } }),
      );
    }
    await waitFor(() =>
      expect(setVizData).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: "second" }),
      ),
    );
    await act(async () => replyForFirst());

    expect(spy).toHaveBeenCalledTimes(2);
    expect(setVizData).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "first" }),
    );
  } finally {
    spy.mockRestore();
  }
});

test("a preview's reply that lands while newer args wait to settle shows nothing", async () => {
  let replyForFirst;
  const spy = jest
    .spyOn(appAPI, "getVisualizationData")
    .mockImplementation(({ args }) =>
      args.plugin_arg === "first"
        ? new Promise((resolve) => {
            replyForFirst = () => resolve(tableFor("first"));
          })
        : Promise.resolve(tableFor(args.plugin_arg)),
    );
  const setVizData = jest.fn();
  try {
    const input = await pickTextPlugin(setVizData);
    changeAndLetThePreviewStart(() =>
      fireEvent.change(input, { target: { value: "first" } }),
    );

    jest.useFakeTimers();
    try {
      // "second" waits to settle, and "first" answers meanwhile.
      fireEvent.change(input, { target: { value: "second" } });
      await act(async () => {
        replyForFirst();
        await spy.mock.results[0].value;
      });
      expect(setVizData).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: "first" }),
      );
      act(() => {
        jest.advanceTimersByTime(ARGS_SETTLE_MS);
      });
    } finally {
      jest.useRealTimers();
    }
    await waitFor(() =>
      expect(setVizData).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: "second" }),
      ),
    );
  } finally {
    spy.mockRestore();
  }
});

test("a plugin picked from the dropdown previews at once, and its reply shows", async () => {
  const spy = jest
    .spyOn(appAPI, "getVisualizationData")
    .mockImplementation(async ({ source, args }) =>
      tableFor(`${source}: ${args.plugin_arg}`),
    );
  const setVizData = jest.fn();
  try {
    const input = await pickTextPlugin(setVizData);
    changeAndLetThePreviewStart(() =>
      fireEvent.change(input, { target: { value: "some value" } }),
    );
    await waitFor(() =>
      expect(setVizData).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: "plugin_source: some value" }),
      ),
    );

    // The value carries over to a plugin taking the same arg, so picking
    // that plugin previews it at once: picking is no keystroke.
    const [typeDropdown] = await screen.findAllByRole("combobox");
    await userEvent.click(typeDropdown);
    const pick = await screen.findByText("plugin_label2");
    jest.useFakeTimers();
    try {
      fireEvent.click(pick);
      // Within the pick itself, and never again after the wait for typing.
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          source: "plugin_source2",
          args: { plugin_arg: "some value" },
        }),
      );
      act(() => {
        jest.advanceTimersByTime(ARGS_SETTLE_MS);
      });
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
    await waitFor(() =>
      expect(setVizData).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: "plugin_source2: some value" }),
      ),
    );
  } finally {
    spy.mockRestore();
  }
});

test("the preview names the dashboard and the tile being edited", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  const bodies = [];
  server.use(
    rest.post(
      "http://api.test/apps/tethysdash/visualizations/get/",
      async (req, res, ctx) => {
        bodies.push(await req.json());
        return res(
          ctx.status(200),
          ctx.json({ success: true, data: { text: "t" }, viz_type: "text" }),
        );
      },
    ),
  );

  render(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider value={{ gridItemUUID: "edited-tile-uuid" }}>
          <TestingComponent
            source={gridItem.source}
            argsString={gridItem.args_string}
            setGridItemMessage={jest.fn()}
            vizType={"loader"}
            setVizType={jest.fn()}
            setVizData={jest.fn()}
            setVizMetadata={jest.fn()}
            setShowingSubModal={jest.fn()}
          />
        </GridItemContext.Provider>
      ),
      options: { inDataViewerMode: true },
    }),
  );

  await userEvent.click(
    await screen.findByLabelText("Search Visualization Type Button"),
  );
  fireEvent.click(await screen.findByText("Visualization Group"));
  fireEvent.click(
    await screen.findByLabelText("plugin_label Visualization Card"),
  );
  fireEvent.click(await screen.findByText("plugin_label"));
  fireEvent.change(await screen.findByLabelText("Plugin Arg Input"), {
    target: { value: "some value" },
  });

  await waitFor(() => expect(bodies).toHaveLength(1));
  expect(bodies[0]).toEqual({
    dashboard: "user-uuid",
    tile: "edited-tile-uuid",
    source: "plugin_source",
    args: { plugin_arg: "some value" },
    requestId: 12345678,
    // Only an editor previews here, and an editor's request runs as sent.
    allArgs: true,
  });
});

describe("a tile's secret arg", () => {
  const SECRET = "typed-tile-s3cret";
  const secretVisualizations = [
    {
      label: "Secret Group",
      options: [
        {
          source: "secret_plugin",
          value: "secret_value",
          label: "Secret Plugin",
          args: { station: "text", api_key: "secret" },
          type: "text",
          tags: [],
          description: "",
        },
        {
          source: "other_secret_plugin",
          value: "other_secret_value",
          label: "Other Secret Plugin",
          args: { api_key: "secret" },
          type: "text",
          tags: [],
          description: "",
        },
      ],
    },
  ];
  const tilePath = { tile: "edited-tile-uuid", layer: "", arg: "api_key" };
  const argsString = JSON.stringify({ station: "A", api_key: "" });

  const PendingCount = () => {
    const { pendingSecrets } = useContext(LayoutContext);
    return (
      <p data-testid="pending-count">{Object.keys(pendingSecrets).length}</p>
    );
  };

  const showPane = (storedSecrets) => {
    const dashboards = JSON.parse(JSON.stringify(mockedDashboards));
    dashboards.dashboards[0].tabs[0].gridItems = [
      {
        id: 1,
        uuid: "edited-tile-uuid",
        i: "1",
        x: 0,
        y: 0,
        w: 20,
        h: 20,
        source: "secret_plugin",
        args_string: argsString,
        metadata_string: "{}",
      },
    ];
    dashboards.dashboards[0].storedSecrets = storedSecrets;
    const bodies = [];
    server.use(
      rest.post(
        "http://api.test/apps/tethysdash/visualizations/get/",
        async (req, res, ctx) => {
          bodies.push(await req.json());
          return res(
            ctx.status(200),
            ctx.json({ success: true, data: { text: "t" }, viz_type: "text" }),
          );
        },
      ),
    );
    render(
      createLoadedComponent({
        children: (
          <GridItemContext.Provider
            value={{ gridItemUUID: "edited-tile-uuid" }}
          >
            <TestingComponent
              source="secret_plugin"
              argsString={argsString}
              setGridItemMessage={jest.fn()}
              vizType={"loader"}
              setVizType={jest.fn()}
              setVizData={jest.fn()}
              setVizMetadata={jest.fn()}
              setShowingSubModal={jest.fn()}
            />
            <PendingCount />
            <button>Elsewhere</button>
          </GridItemContext.Provider>
        ),
        options: {
          inDataViewerMode: true,
          dashboards,
          visualizations: secretVisualizations,
        },
      }),
    );
    return bodies;
  };

  test("the preview runs with the secret entered before the tile is saved, which the tile's args never hold", async () => {
    const bodies = showPane([]);

    // A missing secret does not hold the preview back: the server answers
    // for it. The preview sends every other arg, and never a blank secret.
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      tile: "edited-tile-uuid",
      source: "secret_plugin",
    });
    expect(bodies[0].args).toEqual({ station: "A" });
    expect(screen.getByPlaceholderText("Enter the secret")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Api Key Input"), SECRET);
    await userEvent.click(screen.getByText("Elsewhere"));

    await waitFor(() =>
      expect(bodies.at(-1).args).toEqual({ station: "A", api_key: SECRET }),
    );
    expect(screen.getByTestId("viz-input-values")).toHaveTextContent(
      JSON.stringify({ station: "A", api_key: "" }),
    );
    expect(document.body.innerHTML).not.toContain(SECRET);
  });

  test("a stored secret shows as set", async () => {
    showPane([tilePath]);

    expect(await screen.findByText("Secret set")).toBeInTheDocument();
    expect(screen.queryByLabelText("Api Key Input")).not.toBeInTheDocument();
  });

  test("switching the plugin shows neither the secret entered for the old one, which is kept until the tile is saved, nor its stored secret", async () => {
    showPane([tilePath]);
    await userEvent.click(await screen.findByLabelText("Replace Api Key"));
    await userEvent.type(screen.getByLabelText("Api Key Input"), SECRET);
    await userEvent.click(screen.getByText("Elsewhere"));
    expect(screen.getByTestId("pending-count")).toHaveTextContent("1");

    const comboboxes = await screen.findAllByRole("combobox");
    await userEvent.click(comboboxes[0]);
    fireEvent.click(await screen.findByText("Other Secret Plugin"));

    // The other plugin has no secret yet: an empty field.
    expect(
      await screen.findByPlaceholderText("Enter the secret"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Secret set")).not.toBeInTheDocument();
    expect(screen.queryByText(/New secret entered/)).not.toBeInTheDocument();
    // Discarded when the tile is saved with the other plugin, so closing the
    // editor without saving loses nothing (see DataViewer).
    expect(screen.getByTestId("pending-count")).toHaveTextContent("1");
  });

  test("a plugin picked through the search, with a secret pending, previews at once with its own args", async () => {
    const bodies = showPane([tilePath]);
    await userEvent.click(await screen.findByLabelText("Replace Api Key"));
    await userEvent.type(screen.getByLabelText("Api Key Input"), SECRET);
    await userEvent.click(screen.getByText("Elsewhere"));
    await waitFor(() =>
      expect(bodies.at(-1)?.args).toEqual({ station: "A", api_key: SECRET }),
    );

    await userEvent.click(
      await screen.findByLabelText("Search Visualization Type Button"),
    );
    fireEvent.click(await screen.findByText("Secret Group"));
    // Clicking a plugin's card picks it.
    const pick = await screen.findByLabelText(
      "Other Secret Plugin Visualization Card",
    );
    const spy = jest.spyOn(appAPI, "getVisualizationData").mockResolvedValue({
      success: true,
      data: { text: "t" },
      viz_type: "text",
    });
    jest.useFakeTimers();
    try {
      fireEvent.click(pick);
      // Within the pick itself, and never with the station the previous
      // plugin took; nor again after the wait for typing.
      expect(spy.mock.calls.map(([request]) => request)).toEqual([
        expect.objectContaining({ source: "other_secret_plugin", args: {} }),
      ]);
      act(() => {
        jest.advanceTimersByTime(ARGS_SETTLE_MS);
      });
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
      spy.mockRestore();
    }
  });
});

test("Visualization Pane Other Type Checkbox", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  mockedDashboard.tabs[0].gridItems.push(mockedTextVariable);
  const mockSetGridItemMessage = jest.fn();
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const mockSetVizMetadata = jest.fn();
  const mockSetShowingSubModal = jest.fn();
  server.use(
    rest.post(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            data: {},
            viz_type: "some_type",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
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
          loading_icon: true,
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
        dashboards: { dashboards: [mockedDashboard] },
      },
    }),
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetVizType).toHaveBeenCalledTimes(0);
  expect(mockSetVizData).toHaveBeenCalledTimes(0);

  const visualizationTypeSelect = await screen.findByLabelText(
    "Search Visualization Type Button",
  );
  await userEvent.click(visualizationTypeSelect);
  const groupOption = await screen.findByText("Other");
  fireEvent.click(groupOption);

  const visualizationOption = await screen.findByLabelText(
    "plugin_label_checkbox Visualization Card",
  );
  fireEvent.click(visualizationOption);

  const pluginLabelOption = await screen.findByText("plugin_label_checkbox");
  fireEvent.click(pluginLabelOption);
  expect(await screen.findByText("Plugin Arg")).toBeInTheDocument();

  const pluginArgSelect = screen.getByLabelText("Plugin Arg Input");
  await userEvent.click(pluginArgSelect);
  const trueOption = await screen.findByRole("option", { name: "True" });
  await userEvent.click(trueOption);

  expect(mockSetVizType).toHaveBeenLastCalledWith("vizWarning");
  expect(mockSetVizData).toHaveBeenLastCalledWith({
    warnings: ["some_type visualizations still need to be configured"],
  });

  expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
    source: "plugin_source_checkbox",
    args: {
      plugin_arg: true,
    },
    requestId: 12345678,
  });
  expect(mockSetGridItemMessage).toHaveBeenLastCalledWith(
    "Cell updated to show plugin_label_checkbox",
  );
  expect(mockSetVizType).toHaveBeenLastCalledWith("vizWarning");
  expect(mockSetVizData).toHaveBeenLastCalledWith({
    warnings: ["some_type visualizations still need to be configured"],
  });
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify({
      plugin_arg: true,
    }),
  );

  await userEvent.click(pluginArgSelect);
  const falseOption = await screen.findByText("False");
  await userEvent.click(falseOption);

  // Previewed once the args have held still.
  await waitFor(() =>
    expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
      source: "plugin_source_checkbox",
      args: {
        plugin_arg: false,
      },
      requestId: 12345678,
    }),
  );
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify({
      plugin_arg: false,
    }),
  );

  await userEvent.click(pluginArgSelect);
  const variableOption = await screen.findByText("Test Variable");
  await userEvent.click(variableOption);

  await waitFor(() =>
    expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
      source: "plugin_source_checkbox",
      args: {
        plugin_arg: "",
      },
      requestId: 12345678,
    }),
  );
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify({
      // eslint-disable-next-line
      plugin_arg: "${Test Variable}",
    }),
  );
  // eslint-disable-next-line
  expect(screen.getByText("${Test Variable}")).toBeInTheDocument();
});

test("Visualization Pane Viz With Empty Args", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  const mockSetGridItemMessage = jest.fn();
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const mockSetVizMetadata = jest.fn();
  const mockSetShowingSubModal = jest.fn();
  server.use(
    rest.post(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            data: { text: "some text" },
            viz_type: "some_type",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );
  const mockedVisualizations = [
    {
      label: "Visualization Group",
      options: [
        {
          source: "plugin_source",
          value: "plugin_value",
          label: "plugin_label",
          args: {},
          type: "some type",
          tags: [],
          description: "",
          loading_icon: true,
        },
      ],
    },
  ];

  const loadedComponent = createLoadedComponent({
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
      visualizations: mockedVisualizations,
    },
  });
  const { rerender } = render(loadedComponent);

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetVizType).toHaveBeenCalledTimes(0);
  expect(mockSetVizData).toHaveBeenCalledTimes(0);

  const visualizationTypeSelect = await screen.findByLabelText(
    "Search Visualization Type Button",
  );
  await userEvent.click(visualizationTypeSelect);
  const groupOption = await screen.findByText("Visualization Group");
  fireEvent.click(groupOption);

  const visualizationOption = await screen.findByLabelText(
    "plugin_label Visualization Card",
  );
  fireEvent.click(visualizationOption);

  const pluginLabelOption = await screen.findByText("plugin_label");
  fireEvent.click(pluginLabelOption);

  expect(mockSetVizType).toHaveBeenLastCalledWith("loader");
  expect(mockSetVizData).toHaveBeenLastCalledWith({});

  expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
    source: "plugin_source",
    args: {},
    requestId: 12345678,
  });
  expect(mockSetVizMetadata).toHaveBeenCalledTimes(2);
  expect(mockSetGridItemMessage).toHaveBeenLastCalledWith(
    "Cell updated to show plugin_label",
  );
  expect(mockSetVizType).toHaveBeenLastCalledWith("loader");
  expect(mockSetVizData).toHaveBeenLastCalledWith({});
  expect(mockSetVizType).toHaveBeenCalledTimes(2);
  expect(mockSetVizData).toHaveBeenCalledTimes(1);

  rerender(loadedComponent);

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(2);
  expect(mockSetGridItemMessage).toHaveBeenCalledTimes(1);
  expect(mockSetVizType).toHaveBeenCalledTimes(2);
  expect(mockSetVizData).toHaveBeenCalledTimes(1);
});

test("Visualization Pane Use Existing Bad Type", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.dashboards[0];
  mockedDashboard.tabs[0].gridItems = [
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
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
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
    }),
  );

  expect(mockSetVizMetadata).toHaveBeenCalledTimes(0);
  expect(mockSetGridItemMessage).toHaveBeenCalledTimes(0);
  expect(mockSetVizType).toHaveBeenCalledTimes(0);
  expect(mockSetVizData).toHaveBeenCalledTimes(0);
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify({}),
  );
});

test("Visualization Pane Use Existing Args Map", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.dashboards[0];
  mockedDashboard.tabs[0].gridItems = [
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
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
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
    }),
  );

  expect(await screen.findByText("Map")).toBeInTheDocument();
  const layerTable = await screen.findByRole("table");
  expect(layerTable.rows.length).toBe(1); // just header
  expect(await screen.findByText("True")).toBeInTheDocument();

  // The saved extent is a bare string, the shape older dashboards have. The
  // extent input rewrites it into the object form once its map is ready --
  // a moment after the rest has loaded -- so that is where this settles.
  // Asserting the bare string passed only when the check happened to land in
  // between.
  await waitFor(async () => {
    expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
      args: {
        layers: [],
        baseMap:
          "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer",
        map_extent: {
          extent: "-13149708.122672563, 5192159.850904623,6.900403428857136",
        },
        layerControl: true,
      },
      source: "Map",
      requestId: 12345678,
    });
  });
  expect(mockSetGridItemMessage).toHaveBeenLastCalledWith(
    "Cell updated to show Map",
  );
  expect(mockSetVizType).toHaveBeenLastCalledWith("map");
  expect(mockSetVizData).toHaveBeenLastCalledWith({
    baseMap:
      "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer",
    layerControl: true,
    layers: [],
    map_extent: {
      extent: "-13149708.122672563, 5192159.850904623,6.900403428857136",
    },
  });
});

test("Visualization Pane Use Existing Args Variable Input", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.dashboards[0];
  mockedDashboard.tabs[0].gridItems = [
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
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
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
    }),
  );

  await waitFor(async () => {
    expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
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

  expect(mockSetGridItemMessage).toHaveBeenLastCalledWith(
    "Cell updated to show Variable Input",
  );
  expect(mockSetVizType).toHaveBeenLastCalledWith("variableInput");
  expect(mockSetVizData.mock.calls[0][0].initial_value).toBe("some value");
  expect(mockSetVizData.mock.calls[0][0].variable_name).toBe("test_var");
  expect(mockSetVizData.mock.calls[0][0].variable_options_source).toBe("text");
});

test("Visualization Pane Use Existing Args Custom Image", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.dashboards[0];
  mockedDashboard.tabs[0].gridItems = [
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
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
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
    }),
  );

  expect(await screen.findByText("Custom Image")).toBeInTheDocument();

  await waitFor(async () => {
    expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
      source: "Custom Image",
      args: {
        image_source: "some_png",
      },
      requestId: 12345678,
    });
  });
  expect(mockSetGridItemMessage).toHaveBeenLastCalledWith(
    "Cell updated to show Custom Image",
  );
  expect(mockSetVizType).toHaveBeenLastCalledWith("image");
  expect(mockSetVizData).toHaveBeenLastCalledWith({
    source: "some_png",
    alt: "custom_image",
  });
});

test("Visualization Pane Use Existing Args Viz with True checkbox", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.dashboards[0];
  mockedDashboard.tabs[0].gridItems = [
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
          loading_icon: true,
        },
      ],
    },
  ];
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
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
    }),
  );

  expect(await screen.findByText("plugin_label")).toBeInTheDocument();
  expect(await screen.findByText("Plugin Arg")).toBeInTheDocument();
  expect(await screen.findByText("True")).toBeInTheDocument();

  await waitFor(async () => {
    expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
      source: "plugin_source",
      args: {
        plugin_arg: true,
      },
      requestId: 12345678,
    });
  });
  expect(mockSetGridItemMessage).toHaveBeenLastCalledWith(
    "Cell updated to show plugin_label",
  );
  expect(mockSetVizType).toHaveBeenCalledWith("loader");
  expect(mockSetVizType).toHaveBeenLastCalledWith("plotly");
  expect(mockSetVizData).toHaveBeenLastCalledWith({});
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify({ plugin_arg: true }),
  );
});

test("Visualization Pane Use Existing Args Viz with False checkbox", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.dashboards[0];
  mockedDashboard.tabs[0].gridItems = [
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
          loading_icon: true,
        },
      ],
    },
  ];
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
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
    }),
  );

  expect(await screen.findByText("plugin_label")).toBeInTheDocument();
  expect(await screen.findByText("Plugin Arg")).toBeInTheDocument();
  expect(await screen.findByText("False")).toBeInTheDocument();

  await waitFor(async () => {
    expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
      source: "plugin_source",
      args: {
        plugin_arg: false,
      },
      requestId: 12345678,
    });
  });
  expect(mockSetGridItemMessage).toHaveBeenLastCalledWith(
    "Cell updated to show plugin_label",
  );
  await waitFor(() => {
    expect(mockSetVizType).toHaveBeenLastCalledWith("plotly");
  });
  expect(mockSetVizData).toHaveBeenLastCalledWith({});
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify({ plugin_arg: false }),
  );
});

test("Visualization Pane Use Existing Subs Args", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.dashboards[0];
  mockedDashboard.tabs[0].gridItems = [
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
          loading_icon: true,
        },
      ],
    },
  ];
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
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
    }),
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
    expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
      source: "plugin_source",
      args: {
        plugin_arg: "arg1",
        "plugin_arg.sub_arg1a": "sub_arg1a",
        "plugin_arg.sub_arg1a.sub_arg1aa": false,
        plugin_arg2: "arg3",
        "plugin_arg2.sub_arg3a": "some value",
      },
      requestId: 12345678,
    });
  });
  expect(mockSetGridItemMessage).toHaveBeenLastCalledWith(
    "Cell updated to show plugin_label",
  );
  expect(mockSetVizType).toHaveBeenLastCalledWith("plotly");
  expect(mockSetVizData).toHaveBeenLastCalledWith({});
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify({
      plugin_arg: "arg1",
      "plugin_arg.sub_arg1a": "sub_arg1a",
      "plugin_arg.sub_arg1a.sub_arg1aa": false,
      plugin_arg2: "arg3",
      "plugin_arg2.sub_arg3a": "some value",
    }),
  );
});

test("Visualization Pane Subs Args", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.dashboards[0];
  mockedDashboard.tabs[0].gridItems = [
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
          loading_icon: true,
        },
      ],
    },
  ];
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
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
    }),
  );

  const visualizationTypeSelect = await screen.findByLabelText(
    "Search Visualization Type Button",
  );
  await userEvent.click(visualizationTypeSelect);
  const groupOption = await screen.findByText("Other");
  fireEvent.click(groupOption);

  const visualizationOption = await screen.findByLabelText(
    "plugin_label Visualization Card",
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
  const trueOption = await screen.findByRole("option", { name: "True" });
  fireEvent.click(trueOption);

  comboboxes = await screen.findAllByRole("combobox");
  const pluginArg2Dropdown = comboboxes[4];
  await userEvent.click(pluginArg2Dropdown);
  const arg3Option = await screen.findByText("Arg 3");
  fireEvent.click(arg3Option);

  const arg3Textbox = await screen.findByRole("textbox");
  fireEvent.change(arg3Textbox, { target: { value: "some new value" } });

  await waitFor(async () => {
    expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
      source: "plugin_source",
      args: {
        plugin_arg: "arg1",
        "plugin_arg.sub_arg1a": "sub_arg1a",
        "plugin_arg.sub_arg1a.sub_arg1aa": true,
        plugin_arg2: "arg3",
        "plugin_arg2.sub_arg3a": "some new value",
      },
      requestId: 12345678,
    });
  });
  expect(mockSetGridItemMessage).toHaveBeenLastCalledWith(
    "Cell updated to show plugin_label",
  );
  // The preview started, and its reply landed: it waited for the args to
  // hold still, so the reply can already be in by the time they are seen.
  expect(mockSetVizType).toHaveBeenCalledWith("loader");
  await waitFor(() =>
    expect(mockSetVizType).toHaveBeenLastCalledWith("plotly"),
  );
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify({
      plugin_arg: "arg1",
      plugin_arg2: "arg3",
      "plugin_arg.sub_arg1a": "sub_arg1a",
      "plugin_arg.sub_arg1a.sub_arg1aa": true,
      "plugin_arg2.sub_arg3a": "some new value",
    }),
  );

  await userEvent.click(subArg1ADropdown);
  const subArg1BOption = await screen.findByText("Sub Arg 1B");
  fireEvent.click(subArg1BOption);

  await waitFor(async () => {
    expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
      source: "plugin_source",
      args: {
        plugin_arg: "arg1",
        "plugin_arg.sub_arg1a": "sub_arg1b",
        "plugin_arg.sub_arg1a.sub_arg1aa": true,
        plugin_arg2: "arg3",
        "plugin_arg2.sub_arg3a": "some new value",
      },
      requestId: 12345678,
    });
  });
  expect(mockSetGridItemMessage).toHaveBeenLastCalledWith(
    "Cell updated to show plugin_label",
  );
  // That preview's reply landed too.
  await waitFor(() =>
    expect(mockSetVizType).toHaveBeenLastCalledWith("plotly"),
  );
  expect(mockSetVizData).toHaveBeenLastCalledWith({
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
    }),
  );

  await userEvent.click(subArg1ADropdown);
  const newSubArg1AOption = await screen.findByText("Sub Arg 1A");
  fireEvent.click(newSubArg1AOption);

  expect(mockSetShowingSubModal).toHaveBeenLastCalledWith(false);
});

test("Visualization Pane Use Existing Args and switch type with same arg", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.dashboards[0];
  mockedDashboard.tabs[0].gridItems = [
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
          loading_icon: true,
        },
        {
          source: "plugin_source2",
          value: "plugin_value2",
          label: "plugin_label2",
          args: { plugin_arg: "text", plugin_arg2: "text" },
          type: "some type",
          tags: [],
          description: "",
          loading_icon: true,
        },
      ],
    },
  ];
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
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
    }),
  );

  expect(await screen.findByText("plugin_label")).toBeInTheDocument();
  expect(await screen.findByText("Plugin Arg")).toBeInTheDocument();
  const pluginArg = screen.getByRole("textbox");
  expect(pluginArg.value).toBe("some text value");

  await waitFor(async () => {
    expect(mockSetVizMetadata).toHaveBeenLastCalledWith({
      source: "plugin_source",
      args: {
        plugin_arg: "some text value",
      },
      requestId: 12345678,
    });
  });
  expect(mockSetGridItemMessage).toHaveBeenLastCalledWith(
    "Cell updated to show plugin_label",
  );
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify({ plugin_arg: "some text value" }),
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

  expect(mockSetVizType).toHaveBeenLastCalledWith("unknown");
  expect(mockSetVizData).toHaveBeenLastCalledWith({});
  expect(await screen.findByTestId("viz-input-values")).toHaveTextContent(
    JSON.stringify({ plugin_arg: "some text value", plugin_arg2: "" }),
  );
});

test("VisualizationArguments", async () => {
  const vizTypeOption = {
    value: "Some Viz",
  };

  const vizArguments = [
    {
      label: "Array Arg",
      name: "array_arg",
      type: [
        {
          label: "Option 1",
          value: "option1",
        },
        {
          label: "Option 2",
          value: "option2",
        },
      ],
      value: "option1",
    },
    {
      label: "Checkbox Arg",
      name: "checkbox_arg",
      type: "checkbox",
      value: true,
    },
    {
      label: "Date Arg",
      name: "date_arg",
      type: "date",
      value: "01/01/2020",
    },
    {
      label: "Text Arg",
      name: "text_arg",
      type: "text",
      value: "some text value",
    },
  ];

  const vizInputsValues = {
    array_arg: "option1",
    checkbox_arg: true,
    date_arg: "01/01/2020",
    text_arg: "some text value",
  };

  const mockVisualizationRef = jest.fn();
  const mockSetShowingModal = jest.fn();
  const mockHandleInputChange = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <VisualizationArguments
          selectedVizTypeOption={vizTypeOption}
          vizArguments={vizArguments}
          vizInputsValues={vizInputsValues}
          handleInputChange={mockHandleInputChange}
          setShowingSubModal={mockSetShowingModal}
          gridItemIndex={0}
          visualizationRef={mockVisualizationRef}
        />
      ),
      options: { inDataViewerMode: true },
    }),
  );

  expect(await screen.findByText("Array Arg")).toBeInTheDocument();
  expect(await screen.findByText("Checkbox Arg")).toBeInTheDocument();
  expect(await screen.findByText("Date Arg")).toBeInTheDocument();
  expect(await screen.findByText("Text Arg")).toBeInTheDocument();

  const dropdowns = await screen.findAllByRole("combobox");
  expect(dropdowns.length).toBe(2); // array and checkbox

  const arrayArgSelect = await screen.findByText("Array Arg");
  expect(
    await screen.findByRole("combobox", { name: "Array Arg Input" }),
  ).toBeInTheDocument();
  expect(arrayArgSelect).toBeInTheDocument();
  expect(screen.getByText("Option 1")).toBeInTheDocument();

  const checkboxArg = await screen.findByText("Checkbox Arg");
  expect(checkboxArg).toBeInTheDocument();
  expect(screen.getByText("True")).toBeInTheDocument();

  const dateArg = await screen.findByLabelText("Date Arg");
  expect(dateArg.value).toBe("01/01/2020");

  const textArg = await screen.findByLabelText("Text Arg Input");
  expect(textArg.value).toBe("some text value");
});

test("VisualizationArguments missing array initial value", async () => {
  const vizTypeOption = {
    value: "Some Viz",
  };

  const vizArguments = [
    {
      label: "Array Arg",
      name: "array_arg",
      type: [
        {
          label: "Option 1",
          value: "option1",
        },
        {
          label: "Option 2",
          value: "option2",
        },
      ],
      value: "option1",
    },
  ];

  const vizInputsValues = {
    array_arg: "option3",
  };

  const mockVisualizationRef = jest.fn();
  const mockSetShowingModal = jest.fn();
  const mockHandleInputChange = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <VisualizationArguments
          selectedVizTypeOption={vizTypeOption}
          vizArguments={vizArguments}
          vizInputsValues={vizInputsValues}
          handleInputChange={mockHandleInputChange}
          setShowingSubModal={mockSetShowingModal}
          gridItemIndex={0}
          visualizationRef={mockVisualizationRef}
        />
      ),
      options: { inDataViewerMode: true },
    }),
  );

  expect(await screen.findByText("Array Arg")).toBeInTheDocument();

  const arrayArgSelect = await screen.findByText("Array Arg");
  expect(
    await screen.findByRole("combobox", { name: "Array Arg Input" }),
  ).toBeInTheDocument();
  expect(arrayArgSelect).toBeInTheDocument();
  expect(screen.getByText("option3")).toBeInTheDocument();
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
