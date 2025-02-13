import { act } from "react";
import userEvent from "@testing-library/user-event";
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
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <DataViewerModal
          gridItemIndex={[0]}
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
      options: { initialDashboard: mockedDashboards.editable.name },
    })
  );

  expect(await screen.findByText("Select Cell Data")).toBeInTheDocument();
  expect(await screen.findByText("Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Settings")).toBeInTheDocument();

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button"
  );
  fireEvent.click(dataviewerSaveButton);
  expect(
    await screen.findByText("A visualization must be chosen before saving")
  ).toBeInTheDocument();

  const visualizationTypeSelect = screen.getByLabelText("visualizationType");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(visualizationTypeSelect);
  });
  const customImageOption = await screen.findByText("Custom Image");
  fireEvent.click(customImageOption);
  expect(await screen.findByText("Image Source:")).toBeInTheDocument();
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

test("Dashboard Viewer Modal Variable Input", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <DataViewerModal
          gridItemIndex={[0]}
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
      options: { initialDashboard: mockedDashboards.editable.name },
    })
  );

  expect(await screen.findByText("Select Cell Data")).toBeInTheDocument();
  expect(await screen.findByText("Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Settings")).toBeInTheDocument();

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button"
  );
  fireEvent.click(dataviewerSaveButton);
  expect(
    await screen.findByText("A visualization must be chosen before saving")
  ).toBeInTheDocument();

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

  fireEvent.click(dataviewerSaveButton);
  expect(
    await screen.findByText("Initial value must be selected in the dropdown")
  ).toBeInTheDocument();

  const testVariableInput = await screen.findByLabelText("Test Variable Input");
  fireEvent.change(testVariableInput, { target: { value: "Some Value" } });

  fireEvent.click(dataviewerSaveButton);
  expect(mockhandleModalClose).toHaveBeenCalledTimes(1);
  expect(mocksetShowGridItemMessage).toHaveBeenCalledTimes(1);
});

test("Dashboard Viewer Modal Variable Input already exists", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.editable;
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
          gridItemIndex={[0]}
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
        initialDashboard: mockedDashboards.editable.name,
        dashboards: updatedMockedDashboards,
      },
    })
  );

  expect(await screen.findByText("Select Cell Data")).toBeInTheDocument();
  expect(await screen.findByText("Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Settings")).toBeInTheDocument();

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button"
  );
  fireEvent.click(dataviewerSaveButton);
  expect(
    await screen.findByText("A visualization must be chosen before saving")
  ).toBeInTheDocument();

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

  fireEvent.click(dataviewerSaveButton);
  expect(
    await screen.findByText(
      "Test Variable is already in use for a variable name"
    )
  ).toBeInTheDocument();
  fireEvent.change(variableNameInput, { target: { value: "Test Variable 2" } });

  const testVariableInput = await screen.findByLabelText(
    "Test Variable 2 Input"
  );
  fireEvent.change(testVariableInput, { target: { value: "Some Value" } });

  fireEvent.click(dataviewerSaveButton);
  expect(mockhandleModalClose).toHaveBeenCalledTimes(1);
  expect(mocksetShowGridItemMessage).toHaveBeenCalledTimes(1);
});

test("Dashboard Viewer Modal Update Existing Variable Input", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.editable;
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
            gridItemIndex={[1]}
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
        initialDashboard: mockedDashboards.editable.name,
        dashboards: updatedMockedDashboards,
        inDataViewerMode: true,
      },
    })
  );

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Test Variable": "some value",
    })
  );

  const variableNameInput = screen.getByLabelText("Variable Name Input");
  fireEvent.change(variableNameInput, { target: { value: "Test Variable 2" } });

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button"
  );
  fireEvent.click(dataviewerSaveButton);
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Test Variable 2": "some value",
    })
  );
  expect(mockhandleModalClose).toHaveBeenCalledTimes(1);
  expect(mocksetShowGridItemMessage).toHaveBeenCalledTimes(1);
});

test("Dashboard Viewer Modal Switch tabs", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <>
          <DataViewerModal
            gridItemIndex={[1]}
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
        initialDashboard: mockedDashboards.editable.name,
        inDataViewerMode: true,
      },
    })
  );

  expect(await screen.findByText("Select Cell Data")).toBeInTheDocument();
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

test("Dashboard Viewer Modal selected visualization types modal", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <>
          <DataViewerModal
            gridItemIndex={[1]}
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
        initialDashboard: mockedDashboards.editable.name,
        inDataViewerMode: true,
      },
    })
  );

  const visualizationSettingButton = await screen.findByLabelText(
    "visualizationSettingButton"
  );
  expect(visualizationSettingButton).toBeInTheDocument();
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(visualizationSettingButton);
  });

  const dataviewerModal = await screen.findByLabelText("DataViewer Modal");
  expect(dataviewerModal).toBeInTheDocument();
  expect(dataviewerModal).toHaveStyle({ "z-index": 1050 });

  const selectedVisualizationTypeModal = await screen.findByLabelText(
    "Selected Visualization Type Modal"
  );
  expect(selectedVisualizationTypeModal).toBeInTheDocument();

  // eslint-disable-next-line
  await act(async () => {
    await userEvent.keyboard("{Escape}");
  });
  await waitFor(async () => {
    expect(
      screen.queryByLabelText("Selected Visualization Type Modal")
    ).not.toBeInTheDocument();
  });
  expect(dataviewerModal).not.toHaveStyle({ "z-index": 1050 });
});

test("Dashboard Viewer Modal Map False layer control", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <>
          <DataViewerModal
            gridItemIndex={[0]}
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
      options: { initialDashboard: mockedDashboards.editable.name },
    })
  );

  const visualizationTypeSelect = screen.getByLabelText("visualizationType");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(visualizationTypeSelect);
  });
  const customImageOption = await screen.findByText("Map");
  fireEvent.click(customImageOption);

  const visualizationTabContent =
    await screen.findByLabelText("visualizationTab");
  const comboboxes = await within(visualizationTabContent).findAllByRole(
    "combobox"
  );
  const baseMapDropdown = comboboxes[1];
  await selectEvent.openMenu(baseMapDropdown);
  const baseMapOption = screen.getByText("World Light Gray Base");
  expect(baseMapOption).toBeInTheDocument();
  fireEvent.click(baseMapOption);

  const showLayersDropdown = comboboxes[2];
  await selectEvent.openMenu(showLayersDropdown);
  const showLayersOption = screen.getByText("False");
  expect(showLayersOption).toBeInTheDocument();
  fireEvent.click(showLayersOption);

  const dataviewerSaveButton = await screen.findByLabelText(
    "dataviewer-save-button"
  );
  fireEvent.click(dataviewerSaveButton);

  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      name: "editable",
      label: "test_label",
      accessGroups: [],
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
            base_map:
              "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer",
            additional_layers: [],
            show_layer_controls: false,
            initial_view: {
              center: [-10686671.116154263, 4721671.572580108],
              zoom: 4.5,
            },
          }),
          metadata_string: "{}",
        },
      ],
      editable: true,
    })
  );
});
