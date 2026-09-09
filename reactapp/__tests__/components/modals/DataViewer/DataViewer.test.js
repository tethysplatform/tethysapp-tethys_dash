import Proptypes from "prop-types";
import userEvent from "@testing-library/user-event";
import { act, useEffect, useContext } from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import DataViewerModal, {
  clearGridItemGroupInitialExtent,
  clearGroupInitialExtent,
  enforceSingleGroupInitialExtent,
  getAllVariableInputNames,
  updateVariableInputs,
} from "components/modals/DataViewer/DataViewer";
import {
  mockedDashboards,
  userDashboard,
  mockedDateRangeVariable,
} from "__tests__/utilities/constants";
import createLoadedComponent, {
  InputVariablePComponent,
} from "__tests__/utilities/customRender";
import selectEvent from "react-select-event";
import {
  GridItemContext,
  TabContext,
  AppTourContext,
} from "components/contexts/Contexts";

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

const TestingComponent = ({
  gridItem,
  gridItemIndex = 0,
  mockHandleModalClose,
  mockSetGridItemMessage,
  mockSetShowGridItemMessage,
  onTabUpdate,
}) => {
  const { tabs } = useContext(TabContext);

  useEffect(() => {
    onTabUpdate(tabs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs]);

  return (
    <GridItemContext.Provider
      value={{
        gridItemSource: gridItem.source,
        gridItemI: gridItem.i,
        gridItemMetadataString: gridItem.metadata_string,
        gridItemArgsString: gridItem.args_string,
        gridItemIndex,
      }}
    >
      <DataViewerModal
        showModal={true}
        handleModalClose={mockHandleModalClose}
        setGridItemMessage={mockSetGridItemMessage}
        setShowGridItemMessage={mockSetShowGridItemMessage}
      />
    </GridItemContext.Provider>
  );
};

test("Dashboard Viewer Modal Custom Image", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  const mockHandleModalClose = jest.fn();
  const mockSetGridItemMessage = jest.fn();
  const mockSetShowGridItemMessage = jest.fn();
  const mockUpdateTab = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          gridItem={gridItem}
          mockHandleModalClose={mockHandleModalClose}
          mockSetGridItemMessage={mockSetGridItemMessage}
          mockSetShowGridItemMessage={mockSetShowGridItemMessage}
          onTabUpdate={mockUpdateTab}
        />
      ),
      options: { initialDashboard: userDashboard },
    }),
  );

  expect(await screen.findByText("Edit Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Settings")).toBeInTheDocument();

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button",
  );
  fireEvent.click(dataviewerSaveButton);
  expect(
    await screen.findByText("A visualization must be chosen before saving"),
  ).toBeInTheDocument();

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
  const imageSourceInput = screen.getByLabelText("Image Source Input");

  fireEvent.click(dataviewerSaveButton);
  expect(
    await screen.findByText("All arguments must be filled out before saving"),
  ).toBeInTheDocument();

  fireEvent.change(imageSourceInput, { target: { value: "some_png" } });
  fireEvent.click(dataviewerSaveButton);

  expect(mockUpdateTab).toHaveBeenLastCalledWith([
    {
      gridItems: [
        {
          id: 1,
          i: "1",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          uuid: "some-uuid-1",
          source: "Custom Image",
          args_string: JSON.stringify({
            image_source: "some_png",
          }),
          metadata_string: JSON.stringify({}),
        },
      ],
      id: 1,
      name: "Tab 1",
    },
  ]);

  expect(mockHandleModalClose).toHaveBeenCalledTimes(1);
  expect(mockSetShowGridItemMessage).toHaveBeenCalledTimes(1);
});

test("Dashboard Viewer Modal Text", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  const mockHandleModalClose = jest.fn();
  const mockSetGridItemMessage = jest.fn();
  const mockSetShowGridItemMessage = jest.fn();
  const mockUpdateTab = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          gridItem={gridItem}
          mockHandleModalClose={mockHandleModalClose}
          mockSetGridItemMessage={mockSetGridItemMessage}
          mockSetShowGridItemMessage={mockSetShowGridItemMessage}
          onTabUpdate={mockUpdateTab}
        />
      ),
      options: { initialDashboard: userDashboard },
    }),
  );

  expect(await screen.findByText("Edit Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Settings")).toBeInTheDocument();

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button",
  );
  fireEvent.click(dataviewerSaveButton);
  expect(
    await screen.findByText("A visualization must be chosen before saving"),
  ).toBeInTheDocument();

  const visualizationTypeSelect = await screen.findByLabelText(
    "Search Visualization Type Button",
  );
  await userEvent.click(visualizationTypeSelect);
  const groupOption = await screen.findByText("Default");
  fireEvent.click(groupOption);

  const visualizationOption = await screen.findByLabelText(
    "Text Visualization Card",
  );
  fireEvent.click(visualizationOption);

  const textEditor = await screen.findByLabelText("textEditor");
  expect(textEditor).toBeInTheDocument();

  fireEvent.click(dataviewerSaveButton);
  expect(
    await screen.findByText("All arguments must be filled out before saving"),
  ).toBeInTheDocument();

  // eslint-disable-next-line
  await act(() => {
    fireEvent.input(textEditor, {
      target: {
        innerHTML: "<p>Hello world!</p>",
      },
    });
  });
  expect(await screen.findByText("Hello world!")).toBeInTheDocument();

  fireEvent.click(dataviewerSaveButton);

  expect(mockUpdateTab).toHaveBeenLastCalledWith([
    {
      gridItems: [
        {
          id: 1,
          i: "1",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          uuid: "some-uuid-1",
          source: "Text",
          args_string: JSON.stringify({
            text: "<p>Hello world!</p>",
          }),
          metadata_string: JSON.stringify({}),
        },
      ],
      id: 1,
      name: "Tab 1",
    },
  ]);
  expect(mockHandleModalClose).toHaveBeenCalledTimes(1);
  expect(mockSetShowGridItemMessage).toHaveBeenCalledTimes(1);
});

test("Dashboard Viewer Modal Existing Text", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  mockedDashboard.tabs[0].gridItems = [
    {
      i: "2",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Text",
      args_string: JSON.stringify({
        text: "Some text",
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider
          value={{
            gridItemSource: gridItem.source,
            gridItemI: gridItem.i,
            gridItemMetadataString: gridItem.metadata_string,
            gridItemArgsString: gridItem.args_string,
            gridItemIndex: 0,
          }}
        >
          <DataViewerModal
            gridItemIndex={0}
            source={gridItem.source}
            argsString={gridItem.args_string}
            metadataString={gridItem.metadata_string}
            gridItemI={gridItem.i}
            showModal={true}
            handleModalClose={mockhandleModalClose}
            setGridItemMessage={mocksetGridItemMessage}
            setShowGridItemMessage={mocksetShowGridItemMessage}
          />
        </GridItemContext.Provider>
      ),
      options: { initialDashboard: userDashboard },
    }),
  );

  expect(await screen.findByText("Edit Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Settings")).toBeInTheDocument();

  expect(await screen.findByText("Some text")).toBeInTheDocument();
});

test("Dashboard Viewer Modal Variable Input", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  const mockHandleModalClose = jest.fn();
  const mockSetGridItemMessage = jest.fn();
  const mockSetShowGridItemMessage = jest.fn();
  const mockUpdateTab = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          gridItem={gridItem}
          mockHandleModalClose={mockHandleModalClose}
          mockSetGridItemMessage={mockSetGridItemMessage}
          mockSetShowGridItemMessage={mockSetShowGridItemMessage}
          onTabUpdate={mockUpdateTab}
        />
      ),
      options: { initialDashboard: userDashboard },
    }),
  );

  expect(await screen.findByText("Edit Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Settings")).toBeInTheDocument();

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button",
  );
  fireEvent.click(dataviewerSaveButton);
  expect(
    await screen.findByText("A visualization must be chosen before saving"),
  ).toBeInTheDocument();

  const visualizationTypeSelect = await screen.findByLabelText(
    "Search Visualization Type Button",
  );
  await userEvent.click(visualizationTypeSelect);
  const groupOption = await screen.findByText("Default");
  fireEvent.click(groupOption);

  const visualizationOption = await screen.findByLabelText(
    "Variable Input Visualization Card",
  );
  fireEvent.click(visualizationOption);

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

  fireEvent.click(dataviewerSaveButton);
  expect(
    await screen.findByText("Initial value must be selected in the dropdown"),
  ).toBeInTheDocument();

  const testVariableInput = await screen.findByLabelText("undefined Input");
  fireEvent.change(testVariableInput, { target: { value: "Some Value" } });

  fireEvent.click(dataviewerSaveButton);
  expect(mockUpdateTab).toHaveBeenLastCalledWith([
    {
      gridItems: [
        {
          id: 1,
          i: "1",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          uuid: "some-uuid-1",
          source: "Variable Input",
          args_string: JSON.stringify({
            variable_name: "Test Variable",
            show_label: true,
            variable_options_source: "text",
            initial_value: "Some Value",
          }),
          metadata_string: JSON.stringify({}),
        },
      ],
      id: 1,
      name: "Tab 1",
    },
  ]);
  expect(mockHandleModalClose).toHaveBeenCalledTimes(1);
  expect(mockSetShowGridItemMessage).toHaveBeenCalledTimes(1);
});

test("Dashboard Viewer Modal Variable Input already exists", async () => {
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
      args_string: "{}",
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
    {
      i: "2",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Variable Input",
      args_string: JSON.stringify({
        variable_name: "Test Variable",
        variable_options_source: "text",
        initial_value: "some value",
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  const mockHandleModalClose = jest.fn();
  const mockSetGridItemMessage = jest.fn();
  const mockSetShowGridItemMessage = jest.fn();
  const mockUpdateTab = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          gridItem={gridItem}
          mockHandleModalClose={mockHandleModalClose}
          mockSetGridItemMessage={mockSetGridItemMessage}
          mockSetShowGridItemMessage={mockSetShowGridItemMessage}
          onTabUpdate={mockUpdateTab}
        />
      ),
      options: {
        initialDashboard: mockedDashboard,
        dashboards: updatedMockedDashboards,
      },
    }),
  );

  expect(await screen.findByText("Edit Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Settings")).toBeInTheDocument();

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button",
  );
  fireEvent.click(dataviewerSaveButton);
  expect(
    await screen.findByText("A visualization must be chosen before saving"),
  ).toBeInTheDocument();

  const visualizationTypeSelect = await screen.findByLabelText(
    "Search Visualization Type Button",
  );
  await userEvent.click(visualizationTypeSelect);
  const groupOption = await screen.findByText("Default");
  fireEvent.click(groupOption);

  const visualizationOption = await screen.findByLabelText(
    "Variable Input Visualization Card",
  );
  fireEvent.click(visualizationOption);

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

  fireEvent.click(dataviewerSaveButton);
  expect(
    await screen.findByText(
      "Test Variable is already in use for a variable name",
    ),
  ).toBeInTheDocument();
  fireEvent.change(variableNameInput, { target: { value: "Test Variable 2" } });

  const testVariableInput = await screen.findByLabelText("undefined Input");
  fireEvent.change(testVariableInput, { target: { value: "Some Value" } });
  expect(testVariableInput.value).toBe("Some Value");

  fireEvent.click(dataviewerSaveButton);
  expect(mockUpdateTab).toHaveBeenLastCalledWith([
    {
      gridItems: [
        {
          i: "1",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "Variable Input",
          args_string: JSON.stringify({
            variable_name: "Test Variable 2",
            show_label: true,
            variable_options_source: "text",
            initial_value: "Some Value",
          }),
          metadata_string: JSON.stringify({}),
        },
        {
          i: "2",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "Variable Input",
          args_string: JSON.stringify({
            variable_name: "Test Variable",
            variable_options_source: "text",
            initial_value: "some value",
          }),
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
      ],
      id: 1,
      name: "Tab 1",
    },
  ]);
  expect(mockHandleModalClose).toHaveBeenCalledTimes(1);
  expect(mockSetShowGridItemMessage).toHaveBeenCalledTimes(1);
});

test("Dashboard Viewer Modal Update Existing Variable Input", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.dashboards[0];
  const gridItem1 = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "",
    args_string: "{}",
    metadata_string: JSON.stringify({
      refreshRate: 0,
    }),
  };
  const gridItem2 = {
    i: "2",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "Variable Input",
    args_string: JSON.stringify({
      variable_name: "Test Variable",
      variable_options_source: "text",
      initial_value: "some value",
    }),
    metadata_string: JSON.stringify({
      refreshRate: 0,
    }),
  };
  const gridItem3 = {
    i: "3",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "",
    args_string: JSON.stringify({
      some_arg: true,
      // eslint-disable-next-line
      some_arg2: "${Test Variable}",
      some_arg3: "some value",
    }),
    metadata_string: JSON.stringify({
      refreshRate: 0,
    }),
  };
  mockedDashboard.tabs[0].gridItems = [gridItem1, gridItem2, gridItem3];
  const gridItem = mockedDashboard.tabs[0].gridItems[1];
  const mockHandleModalClose = jest.fn();
  const mockSetGridItemMessage = jest.fn();
  const mockSetShowGridItemMessage = jest.fn();
  const mockUpdateTab = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <>
          <TestingComponent
            gridItem={gridItem}
            gridItemIndex={1}
            mockHandleModalClose={mockHandleModalClose}
            mockSetGridItemMessage={mockSetGridItemMessage}
            mockSetShowGridItemMessage={mockSetShowGridItemMessage}
            onTabUpdate={mockUpdateTab}
          />
          <InputVariablePComponent />
        </>
      ),
      options: {
        initialDashboard: mockedDashboard,
        dashboards: updatedMockedDashboards,
        inDataViewerMode: true,
      },
    }),
  );

  await waitFor(async () => {
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({
        "Test Variable": "some value",
      }),
    );
  });

  const variableNameInput = await screen.findByLabelText("Variable Name Input");
  fireEvent.change(variableNameInput, { target: { value: "Test Variable 2" } });

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button",
  );
  fireEvent.click(dataviewerSaveButton);
  expect(mockUpdateTab).toHaveBeenLastCalledWith([
    {
      gridItems: [
        gridItem1,
        {
          args_string: JSON.stringify({
            variable_name: "Test Variable 2",
            variable_options_source: "text",
            initial_value: "some value",
          }),
          h: 20,
          i: "2",
          metadata_string: '{"refreshRate":0}',
          source: "Variable Input",
          w: 20,
          x: 0,
          y: 0,
        },
        {
          i: "3",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "",
          args_string: JSON.stringify({
            some_arg: true,
            // eslint-disable-next-line
            some_arg2: "${Test Variable 2}",
            some_arg3: "some value",
          }),
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
      ],
      id: 1,
      name: "Tab 1",
    },
  ]);
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Test Variable 2": "some value",
    }),
  );
  expect(mockHandleModalClose).toHaveBeenCalledTimes(1);
  expect(mockSetShowGridItemMessage).toHaveBeenCalledTimes(1);
});

test("Dashboard Viewer Modal Switch tabs", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider
          value={{
            gridItemSource: gridItem.source,
            gridItemI: gridItem.i,
            gridItemMetadataString: gridItem.metadata_string,
            gridItemArgsString: gridItem.args_string,
            gridItemIndex: 1,
          }}
        >
          <DataViewerModal
            showModal={true}
            handleModalClose={mockhandleModalClose}
            setGridItemMessage={mocksetGridItemMessage}
            setShowGridItemMessage={mocksetShowGridItemMessage}
          />
        </GridItemContext.Provider>
      ),
      options: {
        initialDashboard: userDashboard,
        inDataViewerMode: true,
      },
    }),
  );

  expect(await screen.findByText("Edit Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Settings")).toBeInTheDocument();

  const visualizationTab = await screen.findByLabelText("visualizationTab");
  const settingsTab = await screen.findByLabelText("settingsTab");

  expect(visualizationTab).toHaveClass("active");
  expect(settingsTab).not.toHaveClass("active");
  fireEvent.click(await screen.findByText("Settings"));
  expect(settingsTab).toHaveClass("active");
  expect(visualizationTab).not.toHaveClass("active");
});

test("Dashboard Viewer Modal Map False layer control", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  const mockHandleModalClose = jest.fn();
  const mockSetGridItemMessage = jest.fn();
  const mockSetShowGridItemMessage = jest.fn();
  const mockUpdateTab = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <>
          <TestingComponent
            gridItem={gridItem}
            mockHandleModalClose={mockHandleModalClose}
            mockSetGridItemMessage={mockSetGridItemMessage}
            mockSetShowGridItemMessage={mockSetShowGridItemMessage}
            onTabUpdate={mockUpdateTab}
          />
        </>
      ),
      options: { initialDashboard: userDashboard },
    }),
  );

  const visualizationTypeSelect = await screen.findByLabelText(
    "Search Visualization Type Button",
  );
  await userEvent.click(visualizationTypeSelect);
  const groupOption = await screen.findByText("Default");
  fireEvent.click(groupOption);

  const visualizationOption = await screen.findByLabelText(
    "Map Visualization Card",
  );
  fireEvent.click(visualizationOption);

  const visualizationTabContent =
    await screen.findByLabelText("visualizationTab");
  const comboboxes = await within(visualizationTabContent).findAllByRole(
    "combobox",
  );
  const baseMapDropdown = comboboxes[1];
  await selectEvent.openMenu(baseMapDropdown);
  const baseMapOption = await screen.findByRole("option", {
    name: "World Light Gray Base",
  });
  expect(baseMapOption).toBeInTheDocument();
  fireEvent.click(baseMapOption);

  const showLayersDropdown = comboboxes[2];
  await selectEvent.openMenu(showLayersDropdown);
  const showLayersFalseOption = await screen.findByRole("option", {
    name: "False",
  });
  expect(showLayersFalseOption).toBeInTheDocument();
  fireEvent.click(showLayersFalseOption);

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button",
  );
  fireEvent.click(dataviewerSaveButton);
  expect(mockUpdateTab).toHaveBeenLastCalledWith([
    {
      gridItems: [
        {
          args_string: JSON.stringify({
            baseMap:
              "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer",
            layerControl: false,
            layers: [],
            map_extent: { extent: "-10686671.12,4721671.57,4.5" },
            mapDrawing: {},
          }),
          h: 20,
          i: "1",
          id: 1,
          metadata_string: "{}",
          source: "Map",
          uuid: "some-uuid-1",
          w: 20,
          x: 0,
          y: 0,
        },
      ],
      id: 1,
      name: "Tab 1",
    },
  ]);
});

test("Dashboard Viewer Modal Text Options", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider
          value={{
            gridItemSource: gridItem.source,
            gridItemI: gridItem.i,
            gridItemMetadataString: gridItem.metadata_string,
            gridItemArgsString: gridItem.args_string,
            gridItemIndex: 1,
          }}
        >
          <DataViewerModal
            showModal={true}
            handleModalClose={mockhandleModalClose}
            setGridItemMessage={mocksetGridItemMessage}
            setShowGridItemMessage={mocksetShowGridItemMessage}
          />
        </GridItemContext.Provider>
      ),
      options: {
        initialDashboard: userDashboard,
        inDataViewerMode: true,
      },
    }),
  );

  const visualizationTypeSelect = await screen.findByLabelText(
    "Search Visualization Type Button",
  );
  await userEvent.click(visualizationTypeSelect);
  const groupOption = await screen.findByText("Default");
  fireEvent.click(groupOption);

  const visualizationOption = await screen.findByLabelText(
    "Text Visualization Card",
  );
  fireEvent.click(visualizationOption);

  const textEditor = await screen.findByLabelText("textEditor");
  // eslint-disable-next-line
  await act(() => {
    fireEvent.input(textEditor, {
      target: {
        innerHTML: "<p>Hello world!</p>",
      },
    });
  });
  expect(await screen.findByText("Hello world!")).toBeInTheDocument();
});

test("Dashboard Viewer multi variable date range", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  mockedDashboard.tabs[0].gridItems[0] = mockedDateRangeVariable;
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  const mockHandleModalClose = jest.fn();
  const mockSetGridItemMessage = jest.fn();
  const mockSetShowGridItemMessage = jest.fn();
  const mockUpdateTab = jest.fn();

  const LoadedComponent = createLoadedComponent({
    children: (
      <>
        <TestingComponent
          gridItem={gridItem}
          mockHandleModalClose={mockHandleModalClose}
          mockSetGridItemMessage={mockSetGridItemMessage}
          mockSetShowGridItemMessage={mockSetShowGridItemMessage}
          onTabUpdate={mockUpdateTab}
        />
        <InputVariablePComponent />
      </>
    ),
    options: { initialDashboard: mockedDashboard },
  });

  const { rerender } = render(LoadedComponent);

  expect(await screen.findByText("Edit Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Settings")).toBeInTheDocument();

  const startDateVariableInput = await screen.findByLabelText(
    "Start Date Variable Name Input",
  );
  const endDateVariableInput = await screen.findByLabelText(
    "End Date Variable Name Input",
  );
  expect(startDateVariableInput.value).toBe("Start Date");
  expect(endDateVariableInput.value).toBe("End Date");

  rerender(LoadedComponent);

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button",
  );
  fireEvent.click(dataviewerSaveButton);
  expect(mockUpdateTab).toHaveBeenCalledWith([
    {
      gridItems: [mockedDateRangeVariable],
      id: 1,
      name: "Tab 1",
    },
  ]);

  await waitFor(async () => {
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({
        "Test Variable": {
          "Start Date": "01/14/2026T00:00",
          "End Date": "01/16/2026T00:00",
        },
        "Start Date": "01/14/2026T00:00",
        "End Date": "01/16/2026T00:00",
      }),
    );
  });
});

test("Dashboard Viewer multi variable date range fails if duplicated variable names", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  mockedDashboard.tabs[0].gridItems[0] = mockedDateRangeVariable;
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  gridItem.args_string = JSON.stringify({
    variable_name: "Test Variable",
    variable_options_source: "date-range",
    "variable_options_source.metadata": {
      format: "MM/dd/yyyy'T 'HH:mm",
      startDateVariable: "Start Date",
      endDateVariable: "Start Date",
    },
    initial_value: {
      "Start Date": "01/14/2026 12:00 AM",
      "End Date": "01/16/2026 12:00 AM",
    },
  });
  const mockHandleModalClose = jest.fn();
  const mockSetGridItemMessage = jest.fn();
  const mockSetShowGridItemMessage = jest.fn();
  const mockUpdateTab = jest.fn();

  const LoadedComponent = createLoadedComponent({
    children: (
      <>
        <TestingComponent
          gridItem={gridItem}
          mockHandleModalClose={mockHandleModalClose}
          mockSetGridItemMessage={mockSetGridItemMessage}
          mockSetShowGridItemMessage={mockSetShowGridItemMessage}
          onTabUpdate={mockUpdateTab}
        />
        <InputVariablePComponent />
      </>
    ),
    options: { initialDashboard: mockedDashboard },
  });

  render(LoadedComponent);

  expect(await screen.findByText("Edit Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Settings")).toBeInTheDocument();

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button",
  );
  fireEvent.click(dataviewerSaveButton);

  expect(
    await screen.findByText("Duplicate variable name(s) found: Start Date"),
  ).toBeInTheDocument();
});

test("Dashboard Viewer Modal Save in AppTour doesnt do anything", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  const mockHandleModalClose = jest.fn();
  const mockSetGridItemMessage = jest.fn();
  const mockSetShowGridItemMessage = jest.fn();
  const mockUpdateTab = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <AppTourContext.Provider
          value={{
            activeAppTour: true,
          }}
        >
          <TestingComponent
            gridItem={gridItem}
            mockHandleModalClose={mockHandleModalClose}
            mockSetGridItemMessage={mockSetGridItemMessage}
            mockSetShowGridItemMessage={mockSetShowGridItemMessage}
            onTabUpdate={mockUpdateTab}
          />
        </AppTourContext.Provider>
      ),
      options: { initialDashboard: mockedDashboard, inAppTour: true },
    }),
  );

  expect(await screen.findByText("Edit Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Settings")).toBeInTheDocument();
  expect(mockUpdateTab).toHaveBeenCalledTimes(1); // useEffect for testing component

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button",
  );
  fireEvent.click(dataviewerSaveButton);

  expect(mockUpdateTab).toHaveBeenCalledTimes(1);
  expect(mockHandleModalClose).toHaveBeenCalledTimes(0);
  expect(mockSetShowGridItemMessage).toHaveBeenCalledTimes(0);
});

describe("getAllVariableInputNames", () => {
  test("should return variable inputs from args", () => {
    const args = {
      variable_name: "Test Variable",
      variable_options_source: "text",
      initial_value: "Some Value",
    };
    const result = getAllVariableInputNames(args);
    expect(result).toEqual({
      default: "Test Variable",
    });
  });

  test("should return variable inputs from date-range args", () => {
    const args = {
      variable_name: "Date Range Variable",
      variable_options_source: "date-range",
      "variable_options_source.metadata": {
        format: "MM/dd/yyyy'T 'HH:mm",
        startDateVariable: "Start Dats",
        endDateVariable: "End Date",
      },
      initial_value: {
        "Start Dats": "01/06/2026 12:00 AM",
        "End Date": "01/24/2026 12:00 AM",
      },
    };
    const result = getAllVariableInputNames(args);
    expect(result).toEqual({
      default: "Date Range Variable",
      startDateVariable: "Start Dats",
      endDateVariable: "End Date",
    });
  });

  test("should return empty object for non-variable input args", () => {
    const args = {
      text: "Some text",
      font_size: 12,
    };
    const result = getAllVariableInputNames(args);
    expect(result).toEqual({});
  });
});

describe("updateVariableInputs", () => {
  test("should update variable inputs in args", () => {
    const oldArgs = {
      variable_name: "Date Range Variable",
      variable_options_source: "date-range",
      "variable_options_source.metadata": {
        format: "MM/dd/yyyy'T 'HH:mm",
        startDateVariable: "Start Dats",
        endDateVariable: "End Date",
      },
      initial_value: {
        "Start Dats": "02/06/2026 12:00 AM",
        "End Date": "01/24/2026 12:00 AM",
      },
    };

    const newArgs = {
      variable_name: "Date Range",
      variable_options_source: "date-range",
      "variable_options_source.metadata": {
        format: "MM/dd/yyyy'T 'HH:mm",
        startDateVariable: "Start Date",
        endDateVariable: "End Date",
      },
      initial_value: {
        "Start Date": "01/06/2026 12:00 AM",
        "End Date": "01/24/2026 12:00 AM",
      },
    };

    const gridItems = [
      {
        args_string: JSON.stringify(newArgs),
        h: 5,
        i: "1",
        source: "Variable Input",
        metadata_string: "{}",
        w: 32,
        x: 48,
        y: 1,
        id: 1125,
        uuid: "a4e09050-11ab-402d-b0b7-5c4d353c0296",
      },
      {
        // eslint-disable-next-line
        args_string: '{"text": "<p>${Date Range Variable}</p>"}',
        h: 20,
        i: "2",
        source: "Text",
        metadata_string: "{}",
        w: 20,
        x: 50,
        y: 9,
        id: 1145,
        uuid: "6526184d-e7a8-41d4-be3c-a728fad2fbed",
      },
      {
        // eslint-disable-next-line
        args_string: '{"text": "<p>${Start Dats}</p>"}',
        h: 40,
        i: "3",
        source: "Text",
        metadata_string: "{}",
        w: 46,
        x: 0,
        y: 0,
        id: 1130,
        uuid: "05edafb9-c2a7-4743-a73b-840d8704f096",
      },
    ];

    const variableInputValues = {
      "some other variable": "some unchanged value",
      "Start Dats": "01/06/2026 12:00 AM",
      "End Date": "01/24/2026 12:00 AM",
    };
    const mockSetVariableInputValue = jest.fn();

    const result = updateVariableInputs(
      oldArgs,
      newArgs,
      gridItems,
      variableInputValues,
      mockSetVariableInputValue,
    );

    expect(mockSetVariableInputValue).toHaveBeenCalledWith({
      "some other variable": "some unchanged value",
      "Date Range": {
        "End Date": "01/24/2026 12:00 AM",
        "Start Date": "01/06/2026 12:00 AM",
      },
      "End Date": "01/24/2026 12:00 AM",
      "Start Date": "01/06/2026 12:00 AM",
    });
    expect(result).toEqual([
      {
        args_string: JSON.stringify(newArgs),
        h: 5,
        i: "1",
        id: 1125,
        metadata_string: "{}",
        source: "Variable Input",
        uuid: "a4e09050-11ab-402d-b0b7-5c4d353c0296",
        w: 32,
        x: 48,
        y: 1,
      },
      {
        // eslint-disable-next-line
        args_string: '{"text":"<p>${Date Range}</p>"}',
        h: 20,
        i: "2",
        id: 1145,
        metadata_string: "{}",
        source: "Text",
        uuid: "6526184d-e7a8-41d4-be3c-a728fad2fbed",
        w: 20,
        x: 50,
        y: 9,
      },
      {
        // eslint-disable-next-line
        args_string: '{"text":"<p>${Start Date}</p>"}',
        h: 40,
        i: "3",
        id: 1130,
        metadata_string: "{}",
        source: "Text",
        uuid: "05edafb9-c2a7-4743-a73b-840d8704f096",
        w: 46,
        x: 0,
        y: 0,
      },
    ]);
  });
});

TestingComponent.propTypes = {
  gridItem: Proptypes.object.isRequired,
  gridItemIndex: Proptypes.number,
  mockHandleModalClose: Proptypes.func.isRequired,
  mockSetGridItemMessage: Proptypes.func.isRequired,
  mockSetShowGridItemMessage: Proptypes.func.isRequired,
  onTabUpdate: Proptypes.func.isRequired,
};

// --- Single-flag enforcement (U7) -----------------------------------------

const makeMapGridItem = ({ i, mapExtent, source = "Map" }) => ({
  id: Number(i),
  uuid: `some-uuid-${i}`,
  i,
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  source,
  args_string: JSON.stringify({
    baseMap:
      "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer",
    layers: [],
    layerControl: true,
    map_extent: mapExtent,
  }),
  metadata_string: JSON.stringify({ refreshRate: 0 }),
});

const makeVariableGridItem = ({ i, variableName, value }) => ({
  id: Number(i),
  uuid: `some-uuid-${i}`,
  i,
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  source: "Variable Input",
  args_string: JSON.stringify({
    initial_value: value,
    variable_name: variableName,
    variable_options_source: "text",
  }),
  metadata_string: JSON.stringify({ refreshRate: 0 }),
});

const mapExtentOf = (gridItem) => JSON.parse(gridItem.args_string).map_extent;

const findGridItem = (tabs, i) => {
  for (const tab of tabs) {
    const found = tab.gridItems.find((gridItem) => gridItem.i === i);
    if (found) return found;
  }
  return undefined;
};

const flaggedExtent = (group) => ({
  extent: "-10686671.12,4721671.57,4.5",
  viewGroup: group,
  isGroupInitialExtent: true,
});

test("enforceSingleGroupInitialExtent clears the flag on a same-tab group member", () => {
  const saved = makeMapGridItem({ i: "1", mapExtent: flaggedExtent("Basin") });
  const sibling = makeMapGridItem({
    i: "2",
    mapExtent: flaggedExtent("Basin"),
  });
  const tabs = [{ id: 1, name: "Tab 1", gridItems: [saved, sibling] }];

  const result = enforceSingleGroupInitialExtent(tabs, "Basin", saved);

  expect(mapExtentOf(findGridItem(result, "1"))).toEqual(
    flaggedExtent("Basin"),
  );
  expect(mapExtentOf(findGridItem(result, "2"))).toEqual({
    extent: "-10686671.12,4721671.57,4.5",
    viewGroup: "Basin",
  });
});

test("enforceSingleGroupInitialExtent clears the flag on a group member on another tab", () => {
  const saved = makeMapGridItem({ i: "1", mapExtent: flaggedExtent("Basin") });
  const crossTab = makeMapGridItem({
    i: "2",
    mapExtent: flaggedExtent("Basin"),
  });
  const tabs = [
    { id: 1, name: "Tab 1", gridItems: [saved] },
    { id: 2, name: "Tab 2", gridItems: [crossTab] },
  ];

  const result = enforceSingleGroupInitialExtent(tabs, "Basin", saved);

  expect(mapExtentOf(findGridItem(result, "1"))).toEqual(
    flaggedExtent("Basin"),
  );
  expect(
    mapExtentOf(findGridItem(result, "2")).isGroupInitialExtent,
  ).toBeUndefined();
  expect(mapExtentOf(findGridItem(result, "2")).viewGroup).toBe("Basin");
});

test("enforceSingleGroupInitialExtent leaves a map in a different group alone", () => {
  const saved = makeMapGridItem({ i: "1", mapExtent: flaggedExtent("Basin") });
  const otherGroup = makeMapGridItem({
    i: "2",
    mapExtent: flaggedExtent("Other"),
  });
  const pluginMap = makeMapGridItem({
    i: "3",
    mapExtent: flaggedExtent("Basin"),
    source: "plugin_source",
  });
  const tabs = [
    { id: 1, name: "Tab 1", gridItems: [saved, otherGroup, pluginMap] },
  ];

  const result = enforceSingleGroupInitialExtent(tabs, "Basin", saved);

  expect(mapExtentOf(findGridItem(result, "2"))).toEqual(
    flaggedExtent("Other"),
  );
  // A plugin-supplied map never seeds a group, so it is not rewritten either.
  expect(findGridItem(result, "3")).toBe(pluginMap);
});

test("enforceSingleGroupInitialExtent touches nothing when the saved map has no group", () => {
  const saved = makeMapGridItem({
    i: "1",
    mapExtent: { extent: "-10686671.12,4721671.57,4.5" },
  });
  const flagged = makeMapGridItem({
    i: "2",
    mapExtent: flaggedExtent("Basin"),
  });
  const tabs = [{ id: 1, name: "Tab 1", gridItems: [saved, flagged] }];

  expect(enforceSingleGroupInitialExtent(tabs, undefined, saved)).toBe(tabs);
  expect(enforceSingleGroupInitialExtent(tabs, "   ", saved)).toBe(tabs);
});

test("clearGroupInitialExtent preserves every legacy map extent shape", () => {
  // A bare string cannot carry a flag.
  expect(clearGroupInitialExtent("1,2,3")).toBe("1,2,3");
  expect(clearGroupInitialExtent(null)).toBe(null);

  // An unflagged object is handed back by identity.
  const unflagged = { extent: "1,2,3", viewGroup: "Basin" };
  expect(clearGroupInitialExtent(unflagged)).toBe(unflagged);

  // The flat shape the editor emits.
  expect(
    clearGroupInitialExtent({
      extent: "1,2,3",
      variable: "Extent",
      viewGroup: "Basin",
      isGroupInitialExtent: true,
    }),
  ).toEqual({ extent: "1,2,3", variable: "Extent", viewGroup: "Basin" });

  // The doubly nested legacy shape.
  expect(
    clearGroupInitialExtent({
      extent: {
        extent: "1,2,3",
        viewGroup: "Basin",
        isGroupInitialExtent: true,
      },
    }),
  ).toEqual({ extent: { extent: "1,2,3", viewGroup: "Basin" } });
});

test("clearGridItemGroupInitialExtent leaves unparseable and non-map grid items alone", () => {
  const broken = { source: "Map", args_string: "{not json" };
  expect(clearGridItemGroupInitialExtent(broken)).toBe(broken);

  const notAMap = {
    source: "plugin_source",
    args_string: JSON.stringify({ map_extent: flaggedExtent("Basin") }),
  };
  expect(clearGridItemGroupInitialExtent(notAMap)).toBe(notAMap);
});

test("Dashboard Viewer save clears duplicate group initial extents across every tab", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  mockedDashboard.tabs = [
    {
      id: 1,
      name: "Tab 1",
      gridItems: [
        makeMapGridItem({ i: "1", mapExtent: flaggedExtent("Basin") }),
        makeMapGridItem({ i: "2", mapExtent: flaggedExtent("Basin") }),
        makeMapGridItem({ i: "3", mapExtent: flaggedExtent("Other") }),
        makeVariableGridItem({
          i: "4",
          variableName: "Tab One Variable",
          value: "one",
        }),
      ],
    },
    {
      id: 2,
      name: "Tab 2",
      gridItems: [
        makeMapGridItem({ i: "5", mapExtent: flaggedExtent("Basin") }),
        makeVariableGridItem({
          i: "6",
          variableName: "Tab Two Variable",
          value: "two",
        }),
      ],
    },
  ];
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  const mockUpdateTab = jest.fn();
  const mockSetShowGridItemMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <>
          <TestingComponent
            gridItem={gridItem}
            gridItemIndex={0}
            mockHandleModalClose={jest.fn()}
            mockSetGridItemMessage={jest.fn()}
            mockSetShowGridItemMessage={mockSetShowGridItemMessage}
            onTabUpdate={mockUpdateTab}
          />
          <InputVariablePComponent />
        </>
      ),
      options: { initialDashboard: mockedDashboard },
    }),
  );

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button",
  );
  fireEvent.click(dataviewerSaveButton);

  await waitFor(() => {
    expect(mockSetShowGridItemMessage).toHaveBeenCalledWith(true);
  });

  const savedTabs = mockUpdateTab.mock.calls.at(-1)[0];
  // The saved map keeps its flag.
  expect(mapExtentOf(findGridItem(savedTabs, "1")).isGroupInitialExtent).toBe(
    true,
  );
  // A same-tab member of the same group gives its flag up...
  expect(
    mapExtentOf(findGridItem(savedTabs, "2")).isGroupInitialExtent,
  ).toBeUndefined();
  expect(mapExtentOf(findGridItem(savedTabs, "2")).viewGroup).toBe("Basin");
  // ...and so does a member on another tab.
  expect(
    mapExtentOf(findGridItem(savedTabs, "5")).isGroupInitialExtent,
  ).toBeUndefined();
  expect(mapExtentOf(findGridItem(savedTabs, "5")).viewGroup).toBe("Basin");
  // A map in a different group is untouched.
  expect(mapExtentOf(findGridItem(savedTabs, "3")).isGroupInitialExtent).toBe(
    true,
  );

  // Regression guard for the whole-tab-set write: rebuilding the variable
  // input values from only the active tab would blank "Tab Two Variable".
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Tab One Variable": "one",
      "Tab Two Variable": "two",
    }),
  );
});

test("Dashboard Viewer save of an ungrouped map touches no other grid item", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  mockedDashboard.tabs = [
    {
      id: 1,
      name: "Tab 1",
      gridItems: [
        makeMapGridItem({
          i: "1",
          mapExtent: { extent: "-10686671.12,4721671.57,4.5" },
        }),
        makeMapGridItem({ i: "2", mapExtent: flaggedExtent("Basin") }),
      ],
    },
    {
      id: 2,
      name: "Tab 2",
      gridItems: [
        makeMapGridItem({ i: "3", mapExtent: flaggedExtent("Basin") }),
      ],
    },
  ];
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  const mockUpdateTab = jest.fn();
  const mockSetShowGridItemMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          gridItem={gridItem}
          gridItemIndex={0}
          mockHandleModalClose={jest.fn()}
          mockSetGridItemMessage={jest.fn()}
          mockSetShowGridItemMessage={mockSetShowGridItemMessage}
          onTabUpdate={mockUpdateTab}
        />
      ),
      options: { initialDashboard: mockedDashboard },
    }),
  );

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button",
  );
  fireEvent.click(dataviewerSaveButton);

  await waitFor(() => {
    expect(mockSetShowGridItemMessage).toHaveBeenCalledWith(true);
  });

  const savedTabs = mockUpdateTab.mock.calls.at(-1)[0];
  // The map saved has no group, so nothing else on any tab is rewritten --
  // the other two keep their flags even though they share a group.
  expect(findGridItem(savedTabs, "2").args_string).toBe(
    mockedDashboard.tabs[0].gridItems[1].args_string,
  );
  expect(findGridItem(savedTabs, "3").args_string).toBe(
    mockedDashboard.tabs[1].gridItems[0].args_string,
  );
});
