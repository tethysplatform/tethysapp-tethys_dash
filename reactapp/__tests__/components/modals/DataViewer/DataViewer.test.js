import userEvent from "@testing-library/user-event";
import { act } from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import DataViewerModal from "components/modals/DataViewer/DataViewer";
import { mockedDashboards } from "__tests__/utilities/constants";
import createLoadedComponent, {
  InputVariablePComponent,
  ContextLayoutPComponent,
} from "__tests__/utilities/customRender";
import selectEvent from "react-select-event";

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

test("Dashboard Viewer Modal Custom Image", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  const gridItem = mockedDashboard.gridItems[0];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
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
      ),
      options: { initialDashboard: mockedDashboards.user[0] },
    })
  );

  expect(await screen.findByText("Edit Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Settings")).toBeInTheDocument();

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button"
  );
  fireEvent.click(dataviewerSaveButton);
  expect(
    await screen.findByText("A visualization must be chosen before saving")
  ).toBeInTheDocument();

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
  const imageSourceInput = screen.getByLabelText("Image Source Input");

  fireEvent.click(dataviewerSaveButton);
  expect(
    await screen.findByText("All arguments must be filled out before saving")
  ).toBeInTheDocument();

  fireEvent.change(imageSourceInput, { target: { value: "some_png" } });
  fireEvent.click(dataviewerSaveButton);

  expect(mockhandleModalClose).toHaveBeenCalledTimes(1);
  expect(mocksetShowGridItemMessage).toHaveBeenCalledTimes(1);
});

test("Dashboard Viewer Modal Text", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  const gridItem = mockedDashboard.gridItems[0];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
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
      ),
      options: { initialDashboard: mockedDashboards.user[0] },
    })
  );

  expect(await screen.findByText("Edit Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Settings")).toBeInTheDocument();

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button"
  );
  fireEvent.click(dataviewerSaveButton);
  expect(
    await screen.findByText("A visualization must be chosen before saving")
  ).toBeInTheDocument();

  const visualizationTypeSelect = await screen.findByLabelText(
    "Search Visualization Type Button"
  );
  await userEvent.click(visualizationTypeSelect);
  const groupOption = await screen.findByText("Default");
  fireEvent.click(groupOption);

  const visualizationOption = await screen.findByLabelText(
    "Text Visualization Card"
  );
  fireEvent.click(visualizationOption);

  const textEditor = await screen.findByLabelText("textEditor");
  expect(textEditor).toBeInTheDocument();

  fireEvent.click(dataviewerSaveButton);
  expect(
    await screen.findByText("All arguments must be filled out before saving")
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

  expect(mockhandleModalClose).toHaveBeenCalledTimes(1);
  expect(mocksetShowGridItemMessage).toHaveBeenCalledTimes(1);
});

test("Dashboard Viewer Modal Variable Input", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  const gridItem = mockedDashboard.gridItems[0];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
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
      ),
      options: { initialDashboard: mockedDashboards.user[0] },
    })
  );

  expect(await screen.findByText("Edit Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Settings")).toBeInTheDocument();

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button"
  );
  fireEvent.click(dataviewerSaveButton);
  expect(
    await screen.findByText("A visualization must be chosen before saving")
  ).toBeInTheDocument();

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

  fireEvent.click(dataviewerSaveButton);
  expect(
    await screen.findByText("Initial value must be selected in the dropdown")
  ).toBeInTheDocument();

  const testVariableInput = await screen.findByLabelText("undefined Input");
  fireEvent.change(testVariableInput, { target: { value: "Some Value" } });

  fireEvent.click(dataviewerSaveButton);
  expect(mockhandleModalClose).toHaveBeenCalledTimes(1);
  expect(mocksetShowGridItemMessage).toHaveBeenCalledTimes(1);
});

test("Dashboard Viewer Modal Variable Input already exists", async () => {
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
  const gridItem = mockedDashboard.gridItems[0];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
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
      ),
      options: {
        initialDashboard: mockedDashboard,
        dashboards: updatedMockedDashboards,
      },
    })
  );

  expect(await screen.findByText("Edit Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Settings")).toBeInTheDocument();

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button"
  );
  fireEvent.click(dataviewerSaveButton);
  expect(
    await screen.findByText("A visualization must be chosen before saving")
  ).toBeInTheDocument();

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

  fireEvent.click(dataviewerSaveButton);
  expect(
    await screen.findByText(
      "Test Variable is already in use for a variable name"
    )
  ).toBeInTheDocument();
  fireEvent.change(variableNameInput, { target: { value: "Test Variable 2" } });

  const testVariableInput = await screen.findByLabelText("undefined Input");
  fireEvent.change(testVariableInput, { target: { value: "Some Value" } });
  expect(testVariableInput.value).toBe("Some Value");

  fireEvent.click(dataviewerSaveButton);
  expect(mockhandleModalClose).toHaveBeenCalledTimes(1);
  expect(mocksetShowGridItemMessage).toHaveBeenCalledTimes(1);
});

test("Dashboard Viewer Modal Update Existing Variable Input", async () => {
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
        some_arg2: "${Test Variable}",
        some_arg3: "some value",
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const gridItem = mockedDashboard.gridItems[1];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <>
          <DataViewerModal
            gridItemIndex={1}
            source={gridItem.source}
            argsString={gridItem.args_string}
            metadataString={gridItem.metadata_string}
            gridItemI={gridItem.i}
            showModal={true}
            handleModalClose={mockhandleModalClose}
            setGridItemMessage={mocksetGridItemMessage}
            setShowGridItemMessage={mocksetShowGridItemMessage}
          />
          <InputVariablePComponent />
        </>
      ),
      options: {
        initialDashboard: mockedDashboard,
        dashboards: updatedMockedDashboards,
        inDataViewerMode: true,
      },
    })
  );

  await waitFor(async () => {
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({
        "Test Variable": "some value",
      })
    );
  });

  const variableNameInput = await screen.findByLabelText("Variable Name Input");
  fireEvent.change(variableNameInput, { target: { value: "Test Variable 2" } });

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button"
  );
  fireEvent.click(dataviewerSaveButton);
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Test Variable": "some value",
      "Test Variable 2": "some value",
    })
  );
  expect(mockhandleModalClose).toHaveBeenCalledTimes(1);
  expect(mocksetShowGridItemMessage).toHaveBeenCalledTimes(1);
});

test("Dashboard Viewer Modal Switch tabs", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  const gridItem = mockedDashboard.gridItems[0];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <>
          <DataViewerModal
            gridItemIndex={1}
            source={gridItem.source}
            argsString={gridItem.args_string}
            metadataString={gridItem.metadata_string}
            gridItemI={gridItem.i}
            showModal={true}
            handleModalClose={mockhandleModalClose}
            setGridItemMessage={mocksetGridItemMessage}
            setShowGridItemMessage={mocksetShowGridItemMessage}
          />
          <InputVariablePComponent />
        </>
      ),
      options: {
        initialDashboard: mockedDashboards.user[0],
        inDataViewerMode: true,
      },
    })
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
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  const gridItem = mockedDashboard.gridItems[0];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <>
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
          <ContextLayoutPComponent />
        </>
      ),
      options: { initialDashboard: mockedDashboards.user[0] },
    })
  );

  const visualizationTypeSelect = await screen.findByLabelText(
    "Search Visualization Type Button"
  );
  await userEvent.click(visualizationTypeSelect);
  const groupOption = await screen.findByText("Default");
  fireEvent.click(groupOption);

  const visualizationOption = await screen.findByLabelText(
    "Map Visualization Card"
  );
  fireEvent.click(visualizationOption);

  const visualizationTabContent =
    await screen.findByLabelText("visualizationTab");
  const comboboxes = await within(visualizationTabContent).findAllByRole(
    "combobox"
  );
  const baseMapDropdown = comboboxes[1];
  await selectEvent.openMenu(baseMapDropdown);
  const baseMapOption = await screen.findByText("World Light Gray Base");
  expect(baseMapOption).toBeInTheDocument();
  fireEvent.click(baseMapOption);

  const showLayersDropdown = comboboxes[2];
  await selectEvent.openMenu(showLayersDropdown);
  const showLayersOption = await screen.findAllByText("False");
  expect(showLayersOption[1]).toBeInTheDocument();
  fireEvent.click(showLayersOption[1]);

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button"
  );
  fireEvent.click(dataviewerSaveButton);

  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      id: 1,
      name: "editable",
      notes: "test_notes",
      gridItems: [
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
            layerControl: false,
            layers: [],
            map_extent: { extent: "-10686671.12,4721671.57,4.5" },
            mapDrawing: {},
          }),
          metadata_string: "{}",
        },
      ],
      accessGroups: [],
      description: "test_description",
    })
  );
});

test("Dashboard Viewer Modal Text Options", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  const gridItem = mockedDashboard.gridItems[0];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <>
          <DataViewerModal
            gridItemIndex={1}
            source={gridItem.source}
            argsString={gridItem.args_string}
            metadataString={gridItem.metadata_string}
            gridItemI={gridItem.i}
            showModal={true}
            handleModalClose={mockhandleModalClose}
            setGridItemMessage={mocksetGridItemMessage}
            setShowGridItemMessage={mocksetShowGridItemMessage}
          />
          <InputVariablePComponent />
        </>
      ),
      options: {
        initialDashboard: mockedDashboards.user[0],
        inDataViewerMode: true,
      },
    })
  );

  const visualizationTypeSelect = await screen.findByLabelText(
    "Search Visualization Type Button"
  );
  await userEvent.click(visualizationTypeSelect);
  const groupOption = await screen.findByText("Default");
  fireEvent.click(groupOption);

  const visualizationOption = await screen.findByLabelText(
    "Text Visualization Card"
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
