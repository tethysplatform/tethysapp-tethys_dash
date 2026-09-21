import userEvent from "@testing-library/user-event";
import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import DashboardItem, {
  handleGridItemExport,
  handleGridItemImport,
  requiredGridItemKeys,
  minMapLayerStructure,
  detectImportFormat,
  validateGridItemBatch,
} from "components/dashboard/DashboardItem";
import DashboardLayoutAlerts from "components/dashboard/DashboardLayoutAlerts";
import { mockedDashboards, userDashboard } from "__tests__/utilities/constants";
import { confirm } from "components/inputs/DeleteConfirmation";
import createLoadedComponent, {
  ContextLayoutPComponent,
  EditingPComponent,
  DataViewerPComponent,
  InputVariablePComponent,
  TabsPComponent,
} from "__tests__/utilities/customRender";
import appAPI from "services/api/app";
import {
  layerConfigImageArcGISRest,
  exampleStyle,
} from "__tests__/utilities/constants";
import * as utils from "components/visualizations/utilities";
import { GridItemContext } from "components/contexts/Contexts";

// eslint-disable-next-line
jest.mock("components/modals/DataViewer/VisualizationPane", () => () => (
  <div>Visualization Pane</div>
));

// eslint-disable-next-line
jest.mock("components/modals/DataViewer/SettingsPane", () => () => (
  <div>Settings Pane</div>
));

jest.mock("components/inputs/DeleteConfirmation", () => {
  return {
    confirm: jest.fn(),
  };
});
const mockedConfirm = jest.mocked(confirm);

jest.mock("uuid", () => ({
  v4: () => "12345678",
}));

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

const exampleGeoJSON = {
  type: "FeatureCollection",
  crs: {
    type: "name",
    properties: {
      name: "EPSG:3857",
    },
  },
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [0, 0],
      },
    },
  ],
};

test("Dashboard Item not editing", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  mockedConfirm.mockResolvedValue(true);

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 0,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <EditingPComponent />
        </>
      ),
      options: {
        initialDashboard: userDashboard,
      },
    }),
  );

  const dashboardGridItem = await screen.findByLabelText("gridItemDiv");
  expect(dashboardGridItem).toBeInTheDocument();
  const styles = window.getComputedStyle(dashboardGridItem);

  expect(styles.getPropertyValue("border")).toBe("");
  expect(styles.getPropertyValue("background-color")).toBe("transparent");
  expect(styles.getPropertyValue("box-shadow")).toBe("none");

  expect(
    screen.queryByLabelText("dashboard-item-dropdown-toggle"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("attribution-info-icon"),
  ).not.toBeInTheDocument();
});

test("Dashboard Item editing, no custom borders/css", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  mockedConfirm.mockResolvedValue(true);

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 0,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <EditingPComponent />
        </>
      ),
      options: {
        initialDashboard: userDashboard,
        inEditing: true,
      },
    }),
  );

  const dashboardGridItem = await screen.findByLabelText("gridItemDiv");
  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
  expect(dashboardGridItem).toBeInTheDocument();

  await waitFor(() => {
    expect(
      window.getComputedStyle(dashboardGridItem).getPropertyValue("border"),
    ).toBe("1px solid #dcdcdc");
  });
  const styles = window.getComputedStyle(dashboardGridItem);
  expect(styles.getPropertyValue("background-color")).toBe("whitesmoke");
  expect(styles.getPropertyValue("box-shadow")).toBe(
    "0 4px 8px rgba(0, 0, 0, 0.1)",
  );

  expect(
    screen.getByLabelText("dashboard-item-dropdown-toggle"),
  ).toBeInTheDocument();
});

test("Dashboard Item editing, custom borders/css", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  gridItem.metadata_string = JSON.stringify({
    border: {
      "border-left": "1px dashed #f03939",
      "border-right": "3px solid rgb(57, 84, 240)",
    },
    backgroundColor: "#a1ff8dfe",
    boxShadow: "4px 0 8px #f03939,-4px 0 8px rgb(57, 84, 240)",
  });
  mockedConfirm.mockResolvedValue(true);

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 0,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <EditingPComponent />
        </>
      ),
      options: {
        initialDashboard: userDashboard,
        inEditing: true,
      },
    }),
  );

  const dashboardGridItem = await screen.findByLabelText("gridItemDiv");
  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
  expect(dashboardGridItem).toBeInTheDocument();

  await waitFor(() => {
    expect(
      window
        .getComputedStyle(dashboardGridItem)
        .getPropertyValue("border-left"),
    ).toBe("1px dashed #f03939");
  });
  const styles = window.getComputedStyle(dashboardGridItem);
  expect(styles.getPropertyValue("border-right")).toBe(
    "3px solid rgb(57, 84, 240)",
  );
  expect(styles.getPropertyValue("border-top")).toBe("");
  expect(styles.getPropertyValue("border-bottom")).toBe("");
  expect(styles.getPropertyValue("border")).toBe("");
  expect(styles.getPropertyValue("background-color")).toBe(
    "rgba(161, 255, 141, 0.996)",
  );
  expect(styles.getPropertyValue("box-shadow")).toBe(
    "4px 0 8px #f03939,-4px 0 8px rgb(57, 84, 240)",
  );

  expect(
    await screen.findByLabelText("dashboard-item-dropdown-toggle"),
  ).toBeInTheDocument();
});

test("Dashboard Item delete grid item", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  mockedConfirm.mockResolvedValue(true);

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 0,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <TabsPComponent />
          <ContextLayoutPComponent />
          <EditingPComponent />
        </>
      ),
      options: {
        initialDashboard: userDashboard,
        inEditing: true,
      },
    }),
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle",
  );
  await userEvent.click(dashboardItemDropdownToggle);

  const deleteGridItemButton = await screen.findByText("Delete");
  await userEvent.click(deleteGridItemButton);

  let expectedDashboard = JSON.parse(JSON.stringify(mockedDashboard));
  expectedDashboard.tabs[0].gridItems = [];

  let { tabs, ...dashboardContextProperties } = expectedDashboard;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );
  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
});

test("Dashboard Item delete grid item cancel", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  mockedConfirm.mockResolvedValue(false);

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 0,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <TabsPComponent />
          <ContextLayoutPComponent />
          <EditingPComponent />
        </>
      ),
      options: {
        initialDashboard: userDashboard,
        inEditing: true,
      },
    }),
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle",
  );
  await userEvent.click(dashboardItemDropdownToggle);

  const deleteGridItemButton = await screen.findByText("Delete");
  await userEvent.click(deleteGridItemButton);

  let expectedDashboard = JSON.parse(JSON.stringify(mockedDashboard));
  expectedDashboard.tabs[0].gridItems = [
    {
      id: 1,
      uuid: "some-uuid-1",
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
  ];
  let { tabs, ...dashboardContextProperties } = expectedDashboard;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );

  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
});

test("Dashboard Item edit item", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 0,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <ContextLayoutPComponent />
          <EditingPComponent />
          <DataViewerPComponent />
        </>
      ),
      options: {
        initialDashboard: mockedDashboard,
        inEditing: true,
      },
    }),
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle",
  );
  await userEvent.click(dashboardItemDropdownToggle);

  const editGridItemButton = await screen.findByText("Edit");
  await userEvent.click(editGridItemButton);
  const dataViewerModal = await screen.findByRole("dialog");
  expect(dataViewerModal).toBeInTheDocument();
  expect(dataViewerModal).toHaveClass("dataviewer");

  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
  expect(await screen.findByTestId("dataviewer-mode")).toHaveTextContent(
    "dataviewer-mode",
  );

  const closeDataViewerModalButton = within(dataViewerModal).getByText("Close");
  fireEvent.click(closeDataViewerModalButton);
  expect(await screen.findByTestId("dataviewer-mode")).toHaveTextContent(
    "not in dataviewer-mode",
  );
});

test("Dashboard Item copy item", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.dashboards[0];
  mockedDashboard.tabs[0].gridItems = [
    {
      id: 1,
      uuid: "some-uuid-1",
      i: "1",
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      source: "",
      args_string: "{}",
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
    {
      id: 3,
      uuid: "some-uuid-3",
      i: "3",
      x: 0,
      y: 0,
      w: 30,
      h: 30,
      source: "",
      args_string: "{}",
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
    {
      id: 2,
      uuid: "some-uuid-2",
      i: "2",
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
  ];

  const gridItem = mockedDashboard.tabs[0].gridItems[2];

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 0,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <TabsPComponent />
          <ContextLayoutPComponent />
          <EditingPComponent />
        </>
      ),
      options: {
        dashboards: updatedMockedDashboards,
        initialDashboard: mockedDashboard,
        inEditing: true,
      },
    }),
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle",
  );
  await userEvent.click(dashboardItemDropdownToggle);

  const createCopyButton = await screen.findByText("Copy");
  await userEvent.click(createCopyButton);

  let expectedDashboard = JSON.parse(JSON.stringify(mockedDashboard));
  expectedDashboard.tabs[0].gridItems = [
    {
      id: 1,
      uuid: "some-uuid-1",
      i: "1",
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      source: "",
      args_string: "{}",
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
    {
      id: 3,
      uuid: "some-uuid-3",
      i: "3",
      x: 0,
      y: 0,
      w: 30,
      h: 30,
      source: "",
      args_string: "{}",
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
    {
      id: 2,
      uuid: "some-uuid-2",
      i: "2",
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
      id: null,
      uuid: "12345678",
      i: "4",
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
  ];

  let { tabs, ...dashboardContextProperties } = expectedDashboard;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );
  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
});

test("Dashboard Item copy item variable input", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.dashboards[0];
  mockedDashboard.tabs[0].gridItems = [
    {
      id: 1,
      uuid: "some-uuid-1",
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Variable Input",
      args_string: JSON.stringify({
        variable_name: "test_var",
        variable_options_source: "checkbox",
        initial_value: true,
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const gridItem = mockedDashboard.tabs[0].gridItems[0];

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 0,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <ContextLayoutPComponent />
          <TabsPComponent />
          <EditingPComponent />
          <InputVariablePComponent />
        </>
      ),
      options: {
        dashboards: updatedMockedDashboards,
        initialDashboard: mockedDashboard,
        inEditing: true,
      },
    }),
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle",
  );
  await userEvent.click(dashboardItemDropdownToggle);

  const createCopyButton = await screen.findByText("Copy");
  await userEvent.click(createCopyButton);

  let expectedDashboard = JSON.parse(JSON.stringify(mockedDashboard));
  expectedDashboard.tabs[0].gridItems = [
    {
      id: 1,
      uuid: "some-uuid-1",
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Variable Input",
      args_string: JSON.stringify({
        variable_name: "test_var",
        variable_options_source: "checkbox",
        initial_value: true,
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
    {
      id: null,
      uuid: "12345678",
      i: "2",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Variable Input",
      args_string: JSON.stringify({
        variable_name: "test_var_1",
        variable_options_source: "checkbox",
        initial_value: true,
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  let { tabs, ...dashboardContextProperties } = expectedDashboard;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );

  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      test_var: true,
      test_var_1: true,
    }),
  );
});

test("Dashboard Item copy item variable input already exists", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.dashboards[0];
  mockedDashboard.tabs[0].gridItems = [
    {
      id: 1,
      uuid: "some-uuid-1",
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Variable Input",
      args_string: JSON.stringify({
        variable_name: "test_var",
        variable_options_source: "checkbox",
        initial_value: true,
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
    {
      id: 2,
      uuid: "some-uuid-2",
      i: "2",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Variable Input",
      args_string: JSON.stringify({
        variable_name: "test_var_1",
        variable_options_source: "checkbox",
        initial_value: true,
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const gridItem = mockedDashboard.tabs[0].gridItems[0];

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 0,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <ContextLayoutPComponent />
          <TabsPComponent />
          <EditingPComponent />
          <InputVariablePComponent />
        </>
      ),
      options: {
        dashboards: updatedMockedDashboards,
        initialDashboard: mockedDashboard,
        inEditing: true,
      },
    }),
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle",
  );
  await userEvent.click(dashboardItemDropdownToggle);

  const createCopyButton = await screen.findByText("Copy");
  await userEvent.click(createCopyButton);

  let expectedDashboard = JSON.parse(JSON.stringify(mockedDashboard));
  expectedDashboard.tabs[0].gridItems = [
    {
      id: 1,
      uuid: "some-uuid-1",
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Variable Input",
      args_string: JSON.stringify({
        variable_name: "test_var",
        variable_options_source: "checkbox",
        initial_value: true,
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
    {
      id: 2,
      uuid: "some-uuid-2",
      i: "2",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Variable Input",
      args_string: JSON.stringify({
        variable_name: "test_var_1",
        variable_options_source: "checkbox",
        initial_value: true,
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
    {
      id: null,
      uuid: "12345678",
      i: "3",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Variable Input",
      args_string: JSON.stringify({
        variable_name: "test_var_2",
        variable_options_source: "checkbox",
        initial_value: true,
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  let { tabs, ...dashboardContextProperties } = expectedDashboard;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );

  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      test_var: true,
      test_var_1: true,
      test_var_2: true,
    }),
  );
});

test("Dashboard Item order options disabled for single grid item", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.dashboards[0];
  mockedDashboard.unrestrictedPlacement = true;
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  gridItem.source = "Custom Image";
  gridItem.args_string = JSON.stringify({
    image_source: "https://www.aquaveo.com/images/aquaveo_logo.svg",
  });

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
          <DashboardItem />
        </GridItemContext.Provider>
      ),
      options: {
        dashboards: updatedMockedDashboards,
        initialDashboard: mockedDashboard,
        inEditing: true,
      },
    }),
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle",
  );
  await userEvent.click(dashboardItemDropdownToggle);

  const orderOption = await screen.findByText("Order");
  expect(orderOption).toBeInTheDocument();
  fireEvent.mouseEnter(orderOption);

  const bringToFrontOption = await screen.findByText("Bring to Front");
  expect(bringToFrontOption).toBeInTheDocument();
  expect(bringToFrontOption).toHaveClass("disabled");

  const bringForwardOption = await screen.findByText("Bring Forward");
  expect(bringForwardOption).toBeInTheDocument();
  expect(bringForwardOption).toHaveClass("disabled");

  const sendToBackOption = await screen.findByText("Send to Back");
  expect(sendToBackOption).toBeInTheDocument();
  expect(sendToBackOption).toHaveClass("disabled");

  const sendBackwardOption = await screen.findByText("Send Backward");
  expect(sendBackwardOption).toBeInTheDocument();
  expect(sendBackwardOption).toHaveClass("disabled");
});

test("Dashboard Item order forward", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.dashboards[0];
  mockedDashboard.unrestrictedPlacement = true;
  const greenGridItem = {
    i: "3",
    x: 1,
    y: 0,
    w: 20,
    h: 20,
    source: "Text",
    args_string: JSON.stringify({
      text: "green",
    }),
    metadata_string: JSON.stringify({
      border: {
        border: "1px solid black",
      },
      backgroundColor: "#71d47bcb",
    }),
  };
  const blueGridItem = {
    i: "4",
    x: 5,
    y: 3,
    w: 20,
    h: 20,
    source: "Text",
    args_string: JSON.stringify({
      text: "blue",
    }),
    metadata_string: JSON.stringify({
      border: {
        border: "1px solid black",
      },
      backgroundColor: "#424cd9",
    }),
  };
  const redGridItem = {
    i: "5",
    x: 12,
    y: 9,
    w: 20,
    h: 20,
    source: "Text",
    args_string: JSON.stringify({
      text: "red",
    }),
    metadata_string: JSON.stringify({
      border: {
        border: "1px solid black",
      },
      backgroundColor: "#d72e56",
    }),
  };
  const yellowGridItem = {
    i: "6",
    x: 12,
    y: 9,
    w: 20,
    h: 20,
    source: "Text",
    args_string: JSON.stringify({
      text: "yellow",
    }),
    metadata_string: JSON.stringify({
      border: {
        border: "1px solid black",
      },
      backgroundColor: "#d72e56",
    }),
  };
  const gridItems = [greenGridItem, blueGridItem, redGridItem, yellowGridItem];
  mockedDashboard.tabs[0].gridItems = gridItems;
  const gridItem = gridItems[1];

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 1,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <TabsPComponent />
          <ContextLayoutPComponent />
        </>
      ),
      options: {
        dashboards: updatedMockedDashboards,
        initialDashboard: mockedDashboard,
        inEditing: true,
      },
    }),
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle",
  );
  await userEvent.click(dashboardItemDropdownToggle);

  let orderOption = await screen.findByText("Order");
  expect(orderOption).toBeInTheDocument();
  fireEvent.mouseEnter(orderOption);

  const bringToFrontOption = await screen.findByText("Bring to Front");
  expect(bringToFrontOption).toBeInTheDocument();
  await userEvent.click(bringToFrontOption);

  let expectedDashboard = JSON.parse(JSON.stringify(mockedDashboard));
  expectedDashboard.tabs[0].gridItems = [
    greenGridItem,
    redGridItem,
    yellowGridItem,
    blueGridItem,
  ];
  let { tabs, ...dashboardContextProperties } = expectedDashboard;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );

  await userEvent.click(dashboardItemDropdownToggle);

  orderOption = await screen.findByText("Order");
  expect(orderOption).toBeInTheDocument();
  fireEvent.mouseEnter(orderOption);

  const bringForwardOption = await screen.findByText("Bring Forward");
  expect(bringForwardOption).toBeInTheDocument();
  await userEvent.click(bringForwardOption);

  expectedDashboard = JSON.parse(JSON.stringify(mockedDashboard));
  expectedDashboard.tabs[0].gridItems = [
    greenGridItem,
    yellowGridItem,
    redGridItem,
    blueGridItem,
  ];
  ({ tabs, ...dashboardContextProperties } = expectedDashboard);
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );
});

test("Dashboard Item order backward", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.dashboards[0];
  mockedDashboard.unrestrictedPlacement = true;
  const greenGridItem = {
    i: "3",
    x: 1,
    y: 0,
    w: 20,
    h: 20,
    source: "Text",
    args_string: JSON.stringify({
      text: "green",
    }),
    metadata_string: JSON.stringify({
      border: {
        border: "1px solid black",
      },
      backgroundColor: "#71d47bcb",
    }),
  };
  const blueGridItem = {
    i: "4",
    x: 5,
    y: 3,
    w: 20,
    h: 20,
    source: "Text",
    args_string: JSON.stringify({
      text: "blue",
    }),
    metadata_string: JSON.stringify({
      border: {
        border: "1px solid black",
      },
      backgroundColor: "#424cd9",
    }),
  };
  const redGridItem = {
    i: "5",
    x: 12,
    y: 9,
    w: 20,
    h: 20,
    source: "Text",
    args_string: JSON.stringify({
      text: "red",
    }),
    metadata_string: JSON.stringify({
      border: {
        border: "1px solid black",
      },
      backgroundColor: "#d72e56",
    }),
  };
  const yellowGridItem = {
    i: "6",
    x: 12,
    y: 9,
    w: 20,
    h: 20,
    source: "Text",
    args_string: JSON.stringify({
      text: "yellow",
    }),
    metadata_string: JSON.stringify({
      border: {
        border: "1px solid black",
      },
      backgroundColor: "#d72e56",
    }),
  };
  const gridItems = [greenGridItem, blueGridItem, redGridItem, yellowGridItem];
  mockedDashboard.tabs[0].gridItems = gridItems;
  const gridItem = gridItems[1];

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 2,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <TabsPComponent />
          <ContextLayoutPComponent />
        </>
      ),
      options: {
        dashboards: updatedMockedDashboards,
        initialDashboard: mockedDashboard,
        inEditing: true,
      },
    }),
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle",
  );
  await userEvent.click(dashboardItemDropdownToggle);

  let orderOption = await screen.findByText("Order");
  expect(orderOption).toBeInTheDocument();
  fireEvent.mouseEnter(orderOption);

  const sendToBackOption = await screen.findByText("Send to Back");
  expect(sendToBackOption).toBeInTheDocument();
  await userEvent.click(sendToBackOption);

  let expectedDashboard = JSON.parse(JSON.stringify(mockedDashboard));
  expectedDashboard.tabs[0].gridItems = [
    redGridItem,
    greenGridItem,
    blueGridItem,
    yellowGridItem,
  ];
  let { tabs, ...dashboardContextProperties } = expectedDashboard;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );

  await userEvent.click(dashboardItemDropdownToggle);

  orderOption = await screen.findByText("Order");
  expect(orderOption).toBeInTheDocument();
  fireEvent.mouseEnter(orderOption);

  const sendBackwardOption = await screen.findByText("Send Backward");
  expect(sendBackwardOption).toBeInTheDocument();
  await userEvent.click(sendBackwardOption);

  expectedDashboard.tabs[0].gridItems = [
    redGridItem,
    blueGridItem,
    greenGridItem,
    yellowGridItem,
  ];
  ({ tabs, ...dashboardContextProperties } = expectedDashboard);
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );
});

test("Dashboard Item export", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.dashboards[0];
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  gridItem.source = "Custom Image";
  gridItem.args_string = JSON.stringify({
    image_source: "https://www.aquaveo.com/images/aquaveo_logo.svg",
  });
  const spyDownloadJSONFile = jest
    .spyOn(utils, "downloadJSONFile")
    .mockImplementation(jest.fn());

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
          <DashboardItem />
        </GridItemContext.Provider>
      ),
      options: {
        dashboards: updatedMockedDashboards,
        initialDashboard: mockedDashboard,
        inEditing: true,
      },
    }),
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle",
  );
  await userEvent.click(dashboardItemDropdownToggle);

  const exportButton = await screen.findByText("Export");
  await userEvent.click(exportButton);

  expect(spyDownloadJSONFile).toHaveBeenCalledWith(
    {
      args_string: {
        image_source: "https://www.aquaveo.com/images/aquaveo_logo.svg",
      },
      h: 20,
      i: "1",
      metadata_string: {
        refreshRate: 0,
      },
      source: "Custom Image",
      w: 20,
      x: 0,
      y: 0,
    },
    "TethysDashGridItem.json",
  );
});

test("Dashboard Item export fail", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.dashboards[0];
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  gridItem.source = "Custom Image";
  gridItem.args_string = JSON.stringify({
    image_source: "https://www.aquaveo.com/images/aquaveo_logo.svg",
  });
  const spyDownloadJSONFile = jest
    .spyOn(utils, "downloadJSONFile")
    .mockImplementation(() => {
      throw new Error("Mocked download error");
    });

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
          <DashboardItem />
          {/* Cell messages surface through the shared layout alerts now, not
              inside the cell, so this has to render to observe them. */}
          <DashboardLayoutAlerts />
        </GridItemContext.Provider>
      ),
      options: {
        dashboards: updatedMockedDashboards,
        initialDashboard: mockedDashboard,
        inEditing: true,
      },
    }),
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle",
  );
  await userEvent.click(dashboardItemDropdownToggle);

  const exportButton = await screen.findByText("Export");
  await userEvent.click(exportButton);

  expect(spyDownloadJSONFile).toHaveBeenCalledWith(
    {
      args_string: {
        image_source: "https://www.aquaveo.com/images/aquaveo_logo.svg",
      },
      h: 20,
      i: "1",
      metadata_string: {
        refreshRate: 0,
      },
      source: "Custom Image",
      w: 20,
      x: 0,
      y: 0,
    },
    "TethysDashGridItem.json",
  );
  expect(
    await screen.findByText("Failed to export grid item."),
  ).toBeInTheDocument();
});

test("Dashboard attribution and show", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  gridItem.source = "plugin_source_checkbox";
  mockedConfirm.mockResolvedValue(true);

  const availableVisualizations = [
    {
      label: "Other",
      options: [
        {
          source: "plugin_source_checkbox",
          value: "plugin_value_checkbox",
          label: "plugin_label_checkbox",
          args: {},
          type: "text",
          tags: [],
          description: "",
          loading_icon: true,
          attribution: "Some Attribution Text",
        },
      ],
    },
  ];

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 0,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <EditingPComponent />
        </>
      ),
      options: {
        initialDashboard: userDashboard,
        visualizations: availableVisualizations,
      },
    }),
  );

  const dashboardGridItem = await screen.findByLabelText("gridItemDiv");
  expect(dashboardGridItem).toBeInTheDocument();

  // The icon wrapper is now a div with aria-label
  const attributionIcon = await screen.findByLabelText("attribution-info-icon");
  expect(attributionIcon).toBeInTheDocument();

  // Tooltip is rendered but hidden initially
  let tooltip = screen.getByLabelText("attribution-tooltip");
  expect(tooltip).not.toBeVisible();

  // Mouse enter the icon's child div (the inline-block wrapper)
  // eslint-disable-next-line testing-library/no-node-access
  const iconHoverDiv = attributionIcon.querySelector("div");
  fireEvent.mouseEnter(iconHoverDiv);
  tooltip = screen.getByLabelText("attribution-tooltip");
  expect(tooltip).toBeVisible();

  // Mouse leave the icon's child div
  fireEvent.mouseLeave(iconHoverDiv);
  tooltip = screen.getByLabelText("attribution-tooltip");
  expect(tooltip).not.toBeVisible();

  // Mouse enter again
  fireEvent.mouseEnter(iconHoverDiv);
  tooltip = screen.getByLabelText("attribution-tooltip");
  expect(tooltip).toBeVisible();

  // Mouse enter the tooltip itself
  fireEvent.mouseEnter(tooltip);
  expect(tooltip).toBeVisible();

  // Mouse leave the tooltip
  fireEvent.mouseLeave(tooltip);
  expect(tooltip).not.toBeVisible();
});

test("Dashboard attribution www link and show", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  gridItem.source = "plugin_source_checkbox";
  mockedConfirm.mockResolvedValue(true);

  const availableVisualizations = [
    {
      label: "Other",
      options: [
        {
          source: "plugin_source_checkbox",
          value: "plugin_value_checkbox",
          label: "plugin_label_checkbox",
          args: {},
          type: "text",
          tags: [],
          description: "",
          loading_icon: true,
          attribution: "Some Attribution Text www.example.com",
        },
      ],
    },
  ];

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 0,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <EditingPComponent />
        </>
      ),
      options: {
        initialDashboard: userDashboard,
        visualizations: availableVisualizations,
      },
    }),
  );

  const dashboardGridItem = await screen.findByLabelText("gridItemDiv");
  expect(dashboardGridItem).toBeInTheDocument();

  const attributionIcon = await screen.findByLabelText("attribution-info-icon");
  expect(attributionIcon).toBeInTheDocument();

  let tooltip = screen.getByLabelText("attribution-tooltip");
  expect(tooltip).not.toBeVisible();

  // eslint-disable-next-line testing-library/no-node-access
  const iconHoverDiv = attributionIcon.querySelector("div");
  fireEvent.mouseEnter(iconHoverDiv);
  tooltip = await screen.findByLabelText("attribution-tooltip");
  expect(tooltip).toBeVisible();

  // Check that the attribution text contains a link with the correct URL and text
  const link = within(tooltip).getByRole("link", {
    name: "www.example.com",
  });
  expect(link).toBeInTheDocument();
  expect(link).toHaveAttribute("href", "http://www.example.com");

  // Optionally, check that the rest of the text is present
  expect(tooltip).toHaveTextContent("Some Attribution Text");
});

test("Dashboard attribution https link and show", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  gridItem.source = "plugin_source_checkbox";
  mockedConfirm.mockResolvedValue(true);

  const availableVisualizations = [
    {
      label: "Other",
      options: [
        {
          source: "plugin_source_checkbox",
          value: "plugin_value_checkbox",
          label: "plugin_label_checkbox",
          args: {},
          type: "text",
          tags: [],
          description: "",
          loading_icon: true,
          attribution: "Some Attribution Text https://example.com",
        },
      ],
    },
  ];

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 0,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <EditingPComponent />
        </>
      ),
      options: {
        initialDashboard: userDashboard,
        visualizations: availableVisualizations,
      },
    }),
  );

  const dashboardGridItem = await screen.findByLabelText("gridItemDiv");
  expect(dashboardGridItem).toBeInTheDocument();

  const attributionIcon = await screen.findByLabelText("attribution-info-icon");
  expect(attributionIcon).toBeInTheDocument();

  let tooltip = screen.getByLabelText("attribution-tooltip");
  expect(tooltip).not.toBeVisible();

  // eslint-disable-next-line testing-library/no-node-access
  const iconHoverDiv = attributionIcon.querySelector("div");
  fireEvent.mouseEnter(iconHoverDiv);
  tooltip = await screen.findByLabelText("attribution-tooltip");
  expect(tooltip).toBeVisible();

  // Check that the attribution text contains a link with the correct URL and text
  const link = within(tooltip).getByRole("link", {
    name: "https://example.com",
  });
  expect(link).toBeInTheDocument();
  expect(link).toHaveAttribute("href", "https://example.com");

  // Optionally, check that the rest of the text is present
  expect(tooltip).toHaveTextContent("Some Attribution Text");
});

test("Dashboard attribution and not show", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  gridItem.metadata_string = JSON.stringify({ attribution: false });
  gridItem.source = "plugin_source_checkbox";
  mockedConfirm.mockResolvedValue(true);

  const availableVisualizations = [
    {
      label: "Other",
      options: [
        {
          source: "plugin_source_checkbox",
          value: "plugin_value_checkbox",
          label: "plugin_label_checkbox",
          args: {},
          type: "text",
          tags: [],
          description: "",
          loading_icon: true,
          attribution: "Some Attribution Text",
        },
      ],
    },
  ];

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 0,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <EditingPComponent />
        </>
      ),
      options: {
        initialDashboard: userDashboard,
        visualizations: availableVisualizations,
      },
    }),
  );

  const dashboardGridItem = await screen.findByLabelText("gridItemDiv");
  expect(dashboardGridItem).toBeInTheDocument();

  expect(
    screen.queryByLabelText("attribution-info-icon"),
  ).not.toBeInTheDocument();
});

test("Dashboard Item fill viewport fills the content area in view mode", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  gridItem.metadata_string = JSON.stringify({ fillViewport: true });

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 0,
              enableFillViewport: true,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <EditingPComponent />
        </>
      ),
      options: {
        initialDashboard: mockedDashboard,
      },
    }),
  );

  const dashboardGridItem = await screen.findByLabelText("gridItemDiv");
  // position:fixed escapes the react-grid-layout-positioned parent so the item
  // spans the content area independent of grid units / screen size.
  await waitFor(() => {
    expect(
      window.getComputedStyle(dashboardGridItem).getPropertyValue("position"),
    ).toBe("fixed");
  });
  const styles = window.getComputedStyle(dashboardGridItem);
  // Spans the full content width; height is derived in pure CSS from the header
  // variable (no screen-size math), so the size is screen-independent.
  expect(styles.getPropertyValue("width")).toBe("100vw");
  expect(styles.getPropertyValue("left")).toBe("0px");
  expect(
    screen.queryByLabelText("fill-viewport-indicator"),
  ).not.toBeInTheDocument();
});

test("Dashboard Item fill viewport does not force a z-index (stacks by grid order)", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  gridItem.metadata_string = JSON.stringify({ fillViewport: true });

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 0,
              enableFillViewport: true,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <EditingPComponent />
        </>
      ),
      options: {
        initialDashboard: mockedDashboard,
      },
    }),
  );

  const dashboardGridItem = await screen.findByLabelText("gridItemDiv");
  // Regression lock: the fill item must stay position:fixed (so it still fills
  // the viewport) but must NOT carry the old fixed z-index:1020. With
  // z-index:auto it paints in DOM/array order, so items ordered after it stay
  // visible on top. The actual paint stacking is verified in-browser (jsdom
  // does no layout/paint); this guards against re-introducing the override.
  await waitFor(() => {
    expect(
      window.getComputedStyle(dashboardGridItem).getPropertyValue("position"),
    ).toBe("fixed");
  });
  // Not just "not 1020" — the fill item must carry no explicit stacking value
  // at all, so it participates in DOM-order painting.
  expect(["", "auto"]).toContain(
    window.getComputedStyle(dashboardGridItem).getPropertyValue("z-index"),
  );
});

test("Dashboard Item fill viewport fills the content area while editing too", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  gridItem.metadata_string = JSON.stringify({ fillViewport: true });

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 0,
              enableFillViewport: true,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <EditingPComponent />
        </>
      ),
      options: {
        initialDashboard: mockedDashboard,
        inEditing: true,
      },
    }),
  );

  const dashboardGridItem = await screen.findByLabelText("gridItemDiv");
  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
  /* Filling applies while editing as well, so the creator sees the result as
     soon as the cell is saved instead of having to leave edit mode. It also
     keeps the item at its final size continuously: when filling was gated on
     view mode, leaving edit mode resized the item and a map's canvas inside it
     was still at grid size when the dashboard thumbnail was captured. */
  await waitFor(() => {
    expect(
      window.getComputedStyle(dashboardGridItem).getPropertyValue("position"),
    ).toBe("fixed");
  });
  // The indicator still labels the setting while editing.
  expect(
    await screen.findByLabelText("fill-viewport-indicator"),
  ).toBeInTheDocument();
});

test("Dashboard Item fill viewport suppressed when not enabled (popup reuse)", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];
  gridItem.metadata_string = JSON.stringify({ fillViewport: true });

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 0,
              enableFillViewport: false,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <EditingPComponent />
        </>
      ),
      options: {
        initialDashboard: mockedDashboard,
      },
    }),
  );

  const dashboardGridItem = await screen.findByLabelText("gridItemDiv");
  // enableFillViewport=false (e.g. the popup modal / editor) must not fill.
  expect(
    window.getComputedStyle(dashboardGridItem).getPropertyValue("position"),
  ).not.toBe("fixed");
});

test("Dashboard Item only the first fill item fills the viewport", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  mockedDashboard.tabs[0].gridItems = [
    {
      id: 1,
      uuid: "some-uuid-1",
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "",
      args_string: "{}",
      metadata_string: JSON.stringify({ fillViewport: true }),
    },
    {
      id: 2,
      uuid: "some-uuid-2",
      i: "2",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "",
      args_string: "{}",
      metadata_string: JSON.stringify({ fillViewport: true }),
    },
  ];
  const gridItem = mockedDashboard.tabs[0].gridItems[1];

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 1,
              enableFillViewport: true,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <EditingPComponent />
        </>
      ),
      options: {
        initialDashboard: mockedDashboard,
      },
    }),
  );

  const dashboardGridItem = await screen.findByLabelText("gridItemDiv");
  // The second fill item falls back to grid sizing — only the first wins.
  expect(
    window.getComputedStyle(dashboardGridItem).getPropertyValue("position"),
  ).not.toBe("fixed");
});

test("Dashboard Item fill viewport skips siblings with unparseable metadata", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  mockedDashboard.tabs[0].gridItems = [
    {
      id: 1,
      uuid: "some-uuid-1",
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "",
      args_string: "{}",
      // Malformed metadata — the first-fill lookup must swallow the parse
      // error and keep scanning rather than throwing.
      metadata_string: "not valid json",
    },
    {
      id: 2,
      uuid: "some-uuid-2",
      i: "2",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "",
      args_string: "{}",
      metadata_string: JSON.stringify({ fillViewport: true }),
    },
  ];
  const gridItem = mockedDashboard.tabs[0].gridItems[1];

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 1,
              enableFillViewport: true,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <EditingPComponent />
        </>
      ),
      options: {
        initialDashboard: mockedDashboard,
      },
    }),
  );

  const dashboardGridItem = await screen.findByLabelText("gridItemDiv");
  // The unparseable first item is skipped; the valid fill item still fills.
  await waitFor(() => {
    expect(
      window.getComputedStyle(dashboardGridItem).getPropertyValue("position"),
    ).toBe("fixed");
  });
});

test("Dashboard Item fill viewport still fills on a multi-tab dashboard", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  mockedDashboard.tabs[0].gridItems[0].metadata_string = JSON.stringify({
    fillViewport: true,
  });
  // A second tab makes the tab bar visible in view mode, exercising the
  // tab-bar-height branch of the fill-height calculation.
  mockedDashboard.tabs.push({ id: 2, name: "Tab 2", gridItems: [] });
  const gridItem = mockedDashboard.tabs[0].gridItems[0];

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 0,
              enableFillViewport: true,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <EditingPComponent />
        </>
      ),
      options: {
        initialDashboard: mockedDashboard,
      },
    }),
  );

  const dashboardGridItem = await screen.findByLabelText("gridItemDiv");
  await waitFor(() => {
    expect(
      window.getComputedStyle(dashboardGridItem).getPropertyValue("position"),
    ).toBe("fixed");
  });
});

test("Dashboard Item fill viewport badge marks non-first items inactive while editing", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  mockedDashboard.tabs[0].gridItems = [
    {
      id: 1,
      uuid: "some-uuid-1",
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "",
      args_string: "{}",
      metadata_string: JSON.stringify({ fillViewport: true }),
    },
    {
      id: 2,
      uuid: "some-uuid-2",
      i: "2",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "",
      args_string: "{}",
      metadata_string: JSON.stringify({ fillViewport: true }),
    },
  ];
  const gridItem = mockedDashboard.tabs[0].gridItems[1];

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 1,
              enableFillViewport: true,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <EditingPComponent />
        </>
      ),
      options: {
        initialDashboard: mockedDashboard,
        inEditing: true,
      },
    }),
  );

  // The second fill item shows the indicator marked inactive — the first wins.
  const indicator = await screen.findByLabelText("fill-viewport-indicator");
  expect(indicator).toHaveTextContent("inactive");
});

test("handleGridItemExport", async () => {
  const gridItem = {
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

  const response = await handleGridItemExport(gridItem);

  expect(response).toStrictEqual({
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "",
    args_string: {},
    metadata_string: {
      refreshRate: 0,
    },
  });
});

test("handleGridItemExport with map and no layers", async () => {
  const gridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "Map",
    args_string: JSON.stringify({ layers: [] }),
    metadata_string: JSON.stringify({
      refreshRate: 0,
    }),
  };

  const response = await handleGridItemExport(gridItem);

  expect(response).toStrictEqual({
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "Map",
    args_string: { layers: [] },
    metadata_string: {
      refreshRate: 0,
    },
  });
});

test("handleGridItemExport with map and geojson layer", async () => {
  const mockDownloadJSON = jest.fn();
  mockDownloadJSON.mockResolvedValueOnce({
    success: true,
    data: exampleStyle,
  });
  mockDownloadJSON.mockResolvedValueOnce({
    success: true,
    data: exampleGeoJSON,
  });
  jest.spyOn(appAPI, "downloadJSON").mockImplementation(mockDownloadJSON);

  const gridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "Map",
    args_string: JSON.stringify({
      layers: [
        {
          configuration: {
            type: "VectorLayer",
            props: {
              name: "GeoJSON Layer",
              source: {
                type: "GeoJSON",
                props: {},
                geojson: "some_file.json",
              },
            },
            style: "some_style_file.json",
          },
        },
      ],
    }),
    metadata_string: JSON.stringify({
      refreshRate: 0,
    }),
  };

  const response = await handleGridItemExport(gridItem);

  expect(response).toStrictEqual({
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "Map",
    args_string: {
      layers: [
        {
          configuration: {
            type: "VectorLayer",
            props: {
              name: "GeoJSON Layer",
              source: {
                type: "GeoJSON",
                props: {},
                geojson: exampleGeoJSON,
              },
            },
            style: exampleStyle,
          },
        },
      ],
    },
    metadata_string: {
      refreshRate: 0,
    },
  });
});

test("handleGridItemExport bad load", async () => {
  const mockDownloadJSON = jest.fn();
  const apiResponse = {
    success: false,
    message: "some error",
  };
  mockDownloadJSON.mockResolvedValueOnce(apiResponse);
  jest.spyOn(appAPI, "downloadJSON").mockImplementation(mockDownloadJSON);

  const gridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "Map",
    args_string: JSON.stringify({
      layers: [
        {
          configuration: {
            type: "VectorLayer",
            props: {
              name: "GeoJSON Layer",
              source: {
                type: "GeoJSON",
                props: {},
                geojson: "some_file.json",
              },
            },
          },
        },
      ],
    }),
    metadata_string: JSON.stringify({
      refreshRate: 0,
    }),
  };

  const response = await handleGridItemExport(gridItem);

  expect(response).toStrictEqual({
    success: false,
    message: "Failed to fetch: some error",
  });
});

test("handleGridItemImport", async () => {
  const gridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "",
    args_string: { test: 1 },
    metadata_string: {
      refreshRate: 0,
    },
  };

  const response = await handleGridItemImport(gridItem, "123456789");

  expect(response).toStrictEqual({
    success: true,
    importedGridItem: {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "",
      args_string: '{"test":1}',
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  });
});

test("handleGridItemImport string", async () => {
  const gridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "",
    args_string: JSON.stringify({ test: 1 }),
    metadata_string: {
      refreshRate: 0,
    },
  };

  const response = await handleGridItemImport(gridItem, "123456789");

  expect(response).toStrictEqual({
    success: true,
    importedGridItem: {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "",
      args_string: '{"test":1}',
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  });
});

test("handleGridItemImport missing keys", async () => {
  const gridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    source: "",
    args_string: {},
    metadata_string: {
      refreshRate: 0,
    },
  };

  const response = await handleGridItemImport(gridItem, "123456789");

  expect(response).toStrictEqual({
    success: false,
    message: `Grid Items must include ${requiredGridItemKeys.join(", ")} keys`,
  });
});

test("handleGridItemImport with map and no layers", async () => {
  const gridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "Map",
    args_string: { layers: [] },
    metadata_string: {
      refreshRate: 0,
    },
  };

  const response = await handleGridItemImport(gridItem, "123456789");

  expect(response).toStrictEqual({
    success: true,
    importedGridItem: {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Map",
      args_string: JSON.stringify({ layers: [] }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  });
});

test("handleGridItemImport with map geojson layer and style", async () => {
  const mockUploadJSON = jest.fn();
  mockUploadJSON.mockResolvedValueOnce({
    success: true,
    filename: "geojson.json",
  });
  mockUploadJSON.mockResolvedValueOnce({
    success: true,
    filename: "style.json",
  });
  jest.spyOn(appAPI, "uploadJSON").mockImplementation(mockUploadJSON);

  const gridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "Map",
    args_string: {
      layers: [
        {
          configuration: {
            type: "VectorLayer",
            props: {
              name: "GeoJSON Layer",
              source: {
                type: "GeoJSON",
                props: {},
                geojson: exampleGeoJSON,
              },
            },
            style: exampleStyle,
          },
        },
      ],
    },
    metadata_string: {
      refreshRate: 0,
    },
  };

  const response = await handleGridItemImport(gridItem, "123456789");

  expect(response).toStrictEqual({
    success: true,
    importedGridItem: {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Map",
      args_string: JSON.stringify({
        layers: [
          {
            configuration: {
              type: "VectorLayer",
              props: {
                name: "GeoJSON Layer",
                source: {
                  type: "GeoJSON",
                  props: {},
                  geojson: "geojson.json",
                },
              },
              style: "style.json",
            },
          },
        ],
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  });
});

test("handleGridItemImport with map geojson layer and no style", async () => {
  const mockUploadJSON = jest.fn();
  mockUploadJSON.mockResolvedValueOnce({
    success: true,
    filename: "geojson.json",
  });
  jest.spyOn(appAPI, "uploadJSON").mockImplementation(mockUploadJSON);

  const gridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "Map",
    args_string: {
      layers: [
        {
          configuration: {
            type: "VectorLayer",
            props: {
              name: "GeoJSON Layer",
              source: {
                type: "GeoJSON",
                props: {},
                geojson: exampleGeoJSON,
              },
            },
          },
        },
      ],
    },
    metadata_string: {
      refreshRate: 0,
    },
  };

  const response = await handleGridItemImport(gridItem, "123456789");

  expect(response).toStrictEqual({
    success: true,
    importedGridItem: {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Map",
      args_string: JSON.stringify({
        layers: [
          {
            configuration: {
              type: "VectorLayer",
              props: {
                name: "GeoJSON Layer",
                source: {
                  type: "GeoJSON",
                  props: {},
                  geojson: "geojson.json",
                },
              },
            },
          },
        ],
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  });
  expect(mockUploadJSON).toHaveBeenCalledTimes(1);
});

test("handleGridItemImport with map geojson layer url", async () => {
  const mockUploadJSON = jest.fn();
  jest.spyOn(appAPI, "uploadJSON").mockImplementation(mockUploadJSON);

  const gridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "Map",
    args_string: {
      layers: [
        {
          configuration: {
            type: "VectorLayer",
            props: {
              name: "GeoJSON Layer",
              source: {
                type: "GeoJSON",
                props: {},
                geojson: "some/url/to/geojson.json",
              },
            },
          },
        },
      ],
    },
    metadata_string: {
      refreshRate: 0,
    },
  };

  const response = await handleGridItemImport(gridItem, "123456789");

  expect(response).toStrictEqual({
    success: true,
    importedGridItem: {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Map",
      args_string: JSON.stringify({
        layers: [
          {
            configuration: {
              type: "VectorLayer",
              props: {
                name: "GeoJSON Layer",
                source: {
                  type: "GeoJSON",
                  props: {},
                  geojson: "some/url/to/geojson.json",
                },
              },
            },
          },
        ],
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  });
  expect(mockUploadJSON).toHaveBeenCalledTimes(0);
});

test("handleGridItemImport with map arcgis layer and no style", async () => {
  const mockUploadJSON = jest.fn();
  jest.spyOn(appAPI, "uploadJSON").mockImplementation(mockUploadJSON);

  const gridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "Map",
    args_string: {
      layers: [layerConfigImageArcGISRest],
    },
    metadata_string: {
      refreshRate: 0,
    },
  };

  const response = await handleGridItemImport(gridItem, "123456789");

  expect(response).toStrictEqual({
    success: true,
    importedGridItem: {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Map",
      args_string: JSON.stringify({
        layers: [layerConfigImageArcGISRest],
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  });
  expect(mockUploadJSON).toHaveBeenCalledTimes(0);
});

test("handleGridItemImport with map geojson layer missing props", async () => {
  const gridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "Map",
    args_string: {
      layers: [
        {
          configuration: {
            props: {
              name: "GeoJSON Layer",
              source: {
                type: "GeoJSON",
                props: {},
                geojson: exampleGeoJSON,
              },
            },
            style: exampleStyle,
          },
        },
      ],
    },
    metadata_string: {
      refreshRate: 0,
    },
  };

  const response = await handleGridItemImport(gridItem, "123456789");

  expect(response).toStrictEqual({
    success: false,
    message: minMapLayerStructure,
  });
});

test("handleGridItemImport bad geojson load", async () => {
  const mockUploadJSON = jest.fn();
  const apiResponse = {
    success: false,
    message: "some error",
  };
  mockUploadJSON.mockResolvedValueOnce(apiResponse);
  jest.spyOn(appAPI, "uploadJSON").mockImplementation(mockUploadJSON);

  const gridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "Map",
    args_string: {
      layers: [
        {
          configuration: {
            type: "VectorLayer",
            props: {
              name: "GeoJSON Layer",
              source: {
                type: "GeoJSON",
                props: {},
                geojson: exampleGeoJSON,
              },
            },
            style: exampleStyle,
          },
        },
      ],
    },
    metadata_string: {
      refreshRate: 0,
    },
  };

  const response = await handleGridItemImport(gridItem, "123456789");

  expect(response).toStrictEqual(apiResponse);
});

test("handleGridItemImport bad style load", async () => {
  const mockUploadJSON = jest.fn();
  mockUploadJSON.mockResolvedValueOnce({
    success: true,
    filename: "geojson.json",
  });
  const apiResponse = {
    success: false,
    message: "some error",
  };
  mockUploadJSON.mockResolvedValueOnce(apiResponse);
  jest.spyOn(appAPI, "uploadJSON").mockImplementation(mockUploadJSON);

  const gridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "Map",
    args_string: {
      layers: [
        {
          configuration: {
            type: "VectorLayer",
            props: {
              name: "GeoJSON Layer",
              source: {
                type: "GeoJSON",
                props: {},
                geojson: exampleGeoJSON,
              },
            },
            style: exampleStyle,
          },
        },
      ],
    },
    metadata_string: {
      refreshRate: 0,
    },
  };

  const response = await handleGridItemImport(gridItem, "123456789");

  expect(response).toStrictEqual(apiResponse);
});

// The identity pass wired into handleGridItemImport. The rules themselves are
// exercised in __tests__/components/dashboard/importIdentity.test.js; what these
// cases pin is that import runs them, on the same object the file rehydration
// walk above it has already touched, and that nothing they cannot interpret
// turns into a failed import. The uuid mock at the top of this file returns one
// constant, so "this id was re-minted" is assertable here but "these two ids
// differ" is not -- that coverage lives in the identity suite.
describe("handleGridItemImport identity normalization", () => {
  const MINTED_UUID = "12345678";

  const pluginLayer = (props = {}) => ({
    configuration: {
      type: "VectorLayer",
      props: {
        name: "Gages",
        pluginSource: { source: "plugin_gages", args: {} },
        source: { type: "GeoJSON", props: {} },
        ...props,
      },
    },
  });

  const staticLayer = (overrides = {}) => ({
    configuration: {
      type: "WebGLTileLayer",
      props: {
        name: "Basemap",
        source: { type: "ImageTile", props: { url: "https://example.com" } },
      },
    },
    ...overrides,
  });

  const mapGridItem = (args) => ({
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "Map",
    args_string: args,
    metadata_string: { refreshRate: 0 },
  });

  const argsOf = (response) =>
    JSON.parse(response.importedGridItem.args_string);

  const popupItemsOf = (response, layerIndex = 0) =>
    argsOf(response).layers[layerIndex].popupConfig.gridItems;

  test("mints a layerId for a plugin-backed layer that arrived without one", async () => {
    const response = await handleGridItemImport(
      mapGridItem({ layers: [pluginLayer()] }),
      "123456789",
    );

    expect(response.success).toBe(true);
    expect(argsOf(response).layers[0].configuration.props.layerId).toBe(
      MINTED_UUID,
    );
  });

  test("re-mints a popup-nested grid item uuid and its plugin layer id", async () => {
    const nested = {
      i: "nested-1",
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      uuid: "uuid-from-the-imported-file",
      source: "Map",
      args_string: JSON.stringify({
        layers: [pluginLayer({ layerId: "layerId-from-the-imported-file" })],
      }),
      metadata_string: "{}",
    };
    const layer = staticLayer({
      popupConfig: { gridItems: [nested] },
    });

    const response = await handleGridItemImport(
      mapGridItem({ layers: [layer] }),
      "123456789",
    );

    expect(response.success).toBe(true);
    const [normalizedNested] = popupItemsOf(response);
    expect(normalizedNested.uuid).not.toBe("uuid-from-the-imported-file");
    expect(normalizedNested.uuid).toBe(MINTED_UUID);
    const nestedArgs = JSON.parse(normalizedNested.args_string);
    expect(nestedArgs.layers[0].configuration.props.layerId).toBe(MINTED_UUID);
  });

  test("strips the view group keys off a popup-nested map", async () => {
    const nested = {
      i: "nested-1",
      uuid: "nested-uuid",
      source: "Map",
      args_string: JSON.stringify({
        map_extent: {
          extent: "1,2,3,4",
          viewGroup: "Basin",
          isGroupInitialExtent: true,
        },
      }),
      metadata_string: "{}",
    };

    const response = await handleGridItemImport(
      mapGridItem({
        layers: [staticLayer({ popupConfig: { gridItems: [nested] } })],
      }),
      "123456789",
    );

    expect(response.success).toBe(true);
    const nestedArgs = JSON.parse(popupItemsOf(response)[0].args_string);
    expect(nestedArgs.map_extent).toStrictEqual({ extent: "1,2,3,4" });
  });

  test("imports a layer whose popupConfig.gridItems is not an array, untouched", async () => {
    // A table-mode popup has no `gridItems` at all, and a hand-authored file can
    // put anything there. Neither may fail the import.
    const args = {
      layers: [staticLayer({ popupConfig: { gridItems: "not-an-array" } })],
    };

    const response = await handleGridItemImport(mapGridItem(args), "123456789");

    expect(response).toStrictEqual({
      success: true,
      importedGridItem: {
        i: "1",
        x: 0,
        y: 0,
        w: 20,
        h: 20,
        source: "Map",
        args_string: JSON.stringify(args),
        metadata_string: JSON.stringify({ refreshRate: 0 }),
      },
    });
  });

  test("imports a popup-nested grid item whose args will not parse", async () => {
    const nested = {
      i: "nested-1",
      uuid: "nested-uuid",
      source: "Map",
      args_string: "{not json at all",
      metadata_string: "{}",
    };

    const response = await handleGridItemImport(
      mapGridItem({
        layers: [staticLayer({ popupConfig: { gridItems: [nested] } })],
      }),
      "123456789",
    );

    // The import succeeds and the subtree it could not read is handed back
    // verbatim; only the uuid, which needs no parsing, is re-minted.
    expect(response.success).toBe(true);
    expect(popupItemsOf(response)[0]).toStrictEqual({
      ...nested,
      uuid: MINTED_UUID,
    });
  });

  test("re-mints the uuid of a popup-nested non-map item and nothing else", async () => {
    const nested = {
      i: "nested-1",
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      uuid: "nested-uuid",
      source: "Custom Text",
      args_string: JSON.stringify({ text: "hello" }),
      metadata_string: JSON.stringify({ refreshRate: 0 }),
    };

    const response = await handleGridItemImport(
      mapGridItem({
        layers: [staticLayer({ popupConfig: { gridItems: [nested] } })],
      }),
      "123456789",
    );

    expect(response.success).toBe(true);
    expect(popupItemsOf(response)[0]).toStrictEqual({
      ...nested,
      uuid: MINTED_UUID,
    });
  });

  test("still rehydrates geojson and style files while minting the layer id", async () => {
    const mockUploadJSON = jest.fn();
    mockUploadJSON.mockResolvedValueOnce({
      success: true,
      filename: "geojson.json",
    });
    mockUploadJSON.mockResolvedValueOnce({
      success: true,
      filename: "style.json",
    });
    jest.spyOn(appAPI, "uploadJSON").mockImplementation(mockUploadJSON);

    const layer = pluginLayer();
    layer.configuration.props.source.geojson = exampleGeoJSON;
    layer.configuration.style = exampleStyle;

    const response = await handleGridItemImport(
      mapGridItem({ layers: [layer] }),
      "123456789",
    );

    expect(response.success).toBe(true);
    const normalizedLayer = argsOf(response).layers[0];
    // Same two uploads, in the same order, with the geojson CRS-checked and the
    // style not -- the identity pass runs beside that walk, not inside it.
    expect(mockUploadJSON).toHaveBeenCalledTimes(2);
    expect(mockUploadJSON.mock.calls[0][0]).toStrictEqual({
      data: JSON.stringify(exampleGeoJSON),
      filename: `${MINTED_UUID}.json`,
      dashboard_uuid: undefined,
    });
    expect(mockUploadJSON.mock.calls[0][1]).toBe("123456789");
    expect(mockUploadJSON.mock.calls[1][0].data).toBe(
      JSON.stringify(exampleStyle),
    );
    expect(normalizedLayer.configuration.props.source.geojson).toBe(
      "geojson.json",
    );
    expect(normalizedLayer.configuration.style).toBe("style.json");
    expect(normalizedLayer.configuration.props.layerId).toBe(MINTED_UUID);
  });
});

describe("detectImportFormat", () => {
  const validGridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "TestSource",
    args_string: "{}",
    metadata_string: "{}",
  };

  test("detects single grid item", () => {
    const result = detectImportFormat(validGridItem);
    expect(result.type).toBe("single");
    expect(result.gridItems).toEqual([validGridItem]);
    expect(result.tabs).toEqual([]);
    expect(result.summary).toBe("1 grid item");
  });

  test("detects array of grid items", () => {
    const items = [
      validGridItem,
      { ...validGridItem, i: "2" },
      { ...validGridItem, i: "3" },
    ];
    const result = detectImportFormat(items);
    expect(result.type).toBe("array");
    expect(result.gridItems).toEqual(items);
    expect(result.tabs).toEqual([]);
    expect(result.summary).toBe("3 grid items to add to current tab");
  });

  test("detects single tab", () => {
    const tab = {
      name: "MyTab",
      gridItems: [validGridItem, { ...validGridItem, i: "2" }],
    };
    const result = detectImportFormat(tab);
    expect(result.type).toBe("tab");
    expect(result.gridItems).toEqual([]);
    expect(result.tabs).toEqual([tab]);
    expect(result.summary).toBe("Tab: MyTab with 2 items");
  });

  test("detects full dashboard export", () => {
    const dashboard = {
      tabs: [
        {
          name: "Tab A",
          gridItems: [validGridItem, { ...validGridItem, i: "2" }],
        },
        { name: "Tab B", gridItems: [validGridItem] },
      ],
    };
    const result = detectImportFormat(dashboard);
    expect(result.type).toBe("dashboard");
    expect(result.gridItems).toEqual([]);
    expect(result.tabs).toEqual(dashboard.tabs);
    expect(result.summary).toBe("2 tabs: Tab A (2 items), Tab B (1 items)");
  });

  test("detects array with exactly 1 item uses singular", () => {
    const result = detectImportFormat([validGridItem]);
    expect(result.type).toBe("array");
    expect(result.summary).toBe("1 grid item to add to current tab");
  });

  test("detects dashboard with unnamed tab and missing gridItems", () => {
    const dashboard = {
      tabs: [{ id: "1" }, { name: "Named", gridItems: [validGridItem] }],
    };
    const result = detectImportFormat(dashboard);
    expect(result.type).toBe("dashboard");
    expect(result.summary).toBe(
      "2 tabs: Unnamed tab (0 items), Named (1 items)",
    );
  });

  test("detects empty array", () => {
    const result = detectImportFormat([]);
    expect(result.type).toBe("array");
    expect(result.gridItems).toEqual([]);
    expect(result.summary).toBe("0 grid items to add to current tab");
  });

  test("detects dashboard with empty tabs array", () => {
    const result = detectImportFormat({ tabs: [] });
    expect(result.type).toBe("dashboard");
    expect(result.tabs).toEqual([]);
    expect(result.summary).toBe("0 tabs: ");
  });

  test("tabs property takes priority over grid item keys", () => {
    const ambiguous = {
      ...validGridItem,
      tabs: [{ name: "Tab A", gridItems: [] }],
    };
    const result = detectImportFormat(ambiguous);
    expect(result.type).toBe("dashboard");
  });

  test("returns null for unrecognized format", () => {
    expect(detectImportFormat({ foo: "bar" })).toBeNull();
    expect(detectImportFormat(null)).toBeNull();
    expect(detectImportFormat("string")).toBeNull();
  });
});

describe("validateGridItemBatch", () => {
  const validGridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "TestSource",
    args_string: "{}",
    metadata_string: "{}",
  };

  test("passes for valid items", () => {
    const result = validateGridItemBatch([
      validGridItem,
      { ...validGridItem, i: "2" },
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("fails when one item is missing a required key", () => {
    const { source, ...invalidItem } = validGridItem;
    const result = validateGridItemBatch([validGridItem, invalidItem]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Item 2");
    expect(result.errors[0]).toContain("source");
  });

  test("reports errors for all invalid items", () => {
    const { source, ...item1 } = validGridItem;
    const { w, h, ...item2 } = validGridItem;
    const result = validateGridItemBatch([item1, item2]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain("Item 1");
    expect(result.errors[1]).toContain("Item 2");
    expect(result.errors[1]).toContain("w");
    expect(result.errors[1]).toContain("h");
  });

  test("passes for empty array", () => {
    const result = validateGridItemBatch([]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// A fill item is position:fixed, and a DOM-to-image library has to reposition it
// to render it, which does not preserve where it sat among its siblings. Items
// meant to stay on top therefore say so with a z-index instead of relying on
// tree order, so a captured thumbnail matches the screen.
test("Dashboard Item context menu lives inside the item, not beside it", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = mockedDashboard.tabs[0].gridItems[0];

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
            enableFillViewport: true,
          }}
        >
          <DashboardItem />
        </GridItemContext.Provider>
      ),
      options: { initialDashboard: mockedDashboard, inEditing: true },
    }),
  );

  const dashboardGridItem = await screen.findByLabelText("gridItemDiv");
  const dropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle",
  );
  /* As a sibling it was positioned against the react-grid-layout wrapper, so it
     stayed at the old grid position when a fill-viewport item moved to cover the
     content area, and it did not follow a cell lifted above a fill item. */
  expect(dashboardGridItem).toContainElement(dropdownToggle);
});

// --- Single-flag enforcement on copy (U7 / AE9) ---------------------------

const makeGroupedMapGridItem = ({ i, mapExtent, layers = [] }) => ({
  id: Number(i),
  uuid: `some-uuid-${i}`,
  i,
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  source: "Map",
  args_string: JSON.stringify({
    baseMap:
      "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer",
    layers,
    layerControl: true,
    map_extent: mapExtent,
  }),
  metadata_string: JSON.stringify({ refreshRate: 0 }),
});

const copyGridItemAndReadTabs = async (mapExtent, layers = []) => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.dashboards[0];
  const gridItem = makeGroupedMapGridItem({ i: "1", mapExtent, layers });
  mockedDashboard.tabs[0].gridItems = [gridItem];

  render(
    createLoadedComponent({
      children: (
        <>
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 0,
            }}
          >
            <DashboardItem />
          </GridItemContext.Provider>
          <TabsPComponent />
        </>
      ),
      options: {
        dashboards: updatedMockedDashboards,
        initialDashboard: mockedDashboard,
        inEditing: true,
      },
    }),
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle",
  );
  await userEvent.click(dashboardItemDropdownToggle);
  const createCopyButton = await screen.findByText("Copy");
  await userEvent.click(createCopyButton);

  await waitFor(() => {
    const { tabs } = JSON.parse(screen.getByTestId("tabs-context").textContent);
    expect(tabs[0].gridItems).toHaveLength(2);
  });

  const { tabs } = JSON.parse(screen.getByTestId("tabs-context").textContent);
  const [original, copy] = tabs[0].gridItems;
  return {
    original: JSON.parse(original.args_string).map_extent,
    copy: JSON.parse(copy.args_string).map_extent,
    originalArgs: JSON.parse(original.args_string),
    copyArgs: JSON.parse(copy.args_string),
    copyGridItem: copy,
  };
};

test("Dashboard Item copy of a flagged map clears the flag on the copy", async () => {
  const { original, copy, copyGridItem } = await copyGridItemAndReadTabs({
    extent: "-10686671.12,4721671.57,4.5",
    viewGroup: "Basin",
    isGroupInitialExtent: true,
  });

  // The copy is a genuinely new grid item...
  expect(copyGridItem.i).toBe("2");
  expect(copyGridItem.id).toBe(null);
  // ...still in the group, but never a second seed for it.
  expect(copy.viewGroup).toBe("Basin");
  expect(copy.isGroupInitialExtent).toBeUndefined();
  // The original keeps the flag.
  expect(original.isGroupInitialExtent).toBe(true);
});

test("Dashboard Item copy of an unflagged grouped map keeps the group name", async () => {
  const { original, copy } = await copyGridItemAndReadTabs({
    extent: "-10686671.12,4721671.57,4.5",
    viewGroup: "Basin",
  });

  expect(copy).toEqual(original);
  expect(copy.viewGroup).toBe("Basin");
  expect(copy.isGroupInitialExtent).toBeUndefined();
});

// --- Identity re-minting on copy (U5) -------------------------------------

// `uuid` is mocked to the constant "12345678" for this whole file, so the
// original's id is deliberately something else: "different from the original"
// is only a real assertion if the two could not have matched by accident.
const ORIGINAL_LAYER_ID = "layerId-from-the-original";

const copiedPluginLayer = (overrides = {}) => ({
  configuration: {
    type: "VectorLayer",
    props: {
      name: "Gages",
      pluginSource: { source: "plugin_gages", args: {} },
      source: { type: "GeoJSON", props: {} },
      layerId: ORIGINAL_LAYER_ID,
    },
  },
  ...overrides,
});

test("Dashboard Item copy of a plugin-backed layer re-mints its layer id", async () => {
  const { originalArgs, copyArgs } = await copyGridItemAndReadTabs(
    { extent: "-10686671.12,4721671.57,4.5" },
    [copiedPluginLayer()],
  );

  // A `layerId` addresses a layer within one grid item, so the copy cannot
  // share the original's: the two maps would then key the same runtime layer.
  expect(originalArgs.layers[0].configuration.props.layerId).toBe(
    ORIGINAL_LAYER_ID,
  );
  expect(copyArgs.layers[0].configuration.props.layerId).not.toBe(
    ORIGINAL_LAYER_ID,
  );
  expect(copyArgs.layers[0].configuration.props.layerId).toBe("12345678");
});

test("Dashboard Item copy re-mints popup-nested grid item uuids", async () => {
  const nestedUUID = "nested-grid-item-uuid";
  const { copyArgs } = await copyGridItemAndReadTabs(
    { extent: "-10686671.12,4721671.57,4.5" },
    [
      copiedPluginLayer({
        popupConfig: {
          gridItems: [
            {
              uuid: nestedUUID,
              i: "1",
              x: 0,
              y: 0,
              w: 20,
              h: 20,
              source: "Custom Image",
              args_string: JSON.stringify({ uri: "https://example.com/a.png" }),
              metadata_string: JSON.stringify({ refreshRate: 0 }),
            },
          ],
        },
      }),
    ],
  );

  // A nested uuid is the request-id key for the visualizations inside that
  // popup, so leaving the copy sharing the original's would cross-deliver
  // progress and loading messages whenever both popups are open. Nothing
  // durable is keyed on it -- popup grid items live inside the parent's
  // args_string and never become rows of their own.
  const copiedLayer = copyArgs.layers[0];
  expect(copiedLayer.popupConfig.gridItems[0].uuid).not.toBe(nestedUUID);
  // ...and the top-level rules still ran on the same layer.
  expect(copiedLayer.configuration.props.layerId).toBe("12345678");
});
