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
} from "components/dashboard/DashboardItem";
import { mockedDashboards } from "__tests__/utilities/constants";
import { confirm } from "components/inputs/DeleteConfirmation";
import createLoadedComponent, {
  ContextLayoutPComponent,
  EditingPComponent,
  DataViewerPComponent,
  InputVariablePComponent,
} from "__tests__/utilities/customRender";
import appAPI from "services/api/app";
import {
  layerConfigImageArcGISRest,
  exampleStyle,
} from "__tests__/utilities/constants";
import * as utils from "components/visualizations/utilities";

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
  v4: () => 12345678,
}));

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
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  const gridItem = mockedDashboard.gridItems[0];
  mockedConfirm.mockResolvedValue(true);

  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardItem
            gridItemSource={gridItem.source}
            gridItemI={gridItem.i}
            gridItemArgsString={gridItem.args_string}
            gridItemMetadataString={gridItem.metadata_string}
            gridItemIndex={0}
          />
          <EditingPComponent />
        </>
      ),
      options: {
        editableDashboard: true,
        initialDashboard: mockedDashboards.user[0],
      },
    })
  );

  const dashboardGridItem = await screen.findByLabelText("gridItemDiv");
  expect(dashboardGridItem).toBeInTheDocument();
  const styles = window.getComputedStyle(dashboardGridItem);

  expect(styles.getPropertyValue("border")).toBe("");
  expect(styles.getPropertyValue("background-color")).toBe("transparent");
  expect(styles.getPropertyValue("box-shadow")).toBe("none");

  expect(
    screen.queryByLabelText("dashboard-item-dropdown-toggle")
  ).not.toBeInTheDocument();
});

test("Dashboard Item editing, no custom borders/css", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  const gridItem = mockedDashboard.gridItems[0];
  mockedConfirm.mockResolvedValue(true);

  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardItem
            gridItemSource={gridItem.source}
            gridItemI={gridItem.i}
            gridItemArgsString={gridItem.args_string}
            gridItemMetadataString={gridItem.metadata_string}
            gridItemIndex={0}
          />
          <EditingPComponent />
        </>
      ),
      options: {
        editableDashboard: true,
        initialDashboard: mockedDashboards.user[0],
        inEditing: true,
      },
    })
  );

  const dashboardGridItem = await screen.findByLabelText("gridItemDiv");
  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
  expect(dashboardGridItem).toBeInTheDocument();

  await waitFor(() => {
    expect(
      window.getComputedStyle(dashboardGridItem).getPropertyValue("border")
    ).toBe("1px solid #dcdcdc");
  });
  const styles = window.getComputedStyle(dashboardGridItem);
  expect(styles.getPropertyValue("background-color")).toBe("whitesmoke");
  expect(styles.getPropertyValue("box-shadow")).toBe(
    "0 4px 8px rgba(0,0,0,0.1)"
  );

  expect(
    screen.getByLabelText("dashboard-item-dropdown-toggle")
  ).toBeInTheDocument();
});

test("Dashboard Item editing, custom borders/css", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  const gridItem = mockedDashboard.gridItems[0];
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
          <DashboardItem
            gridItemSource={gridItem.source}
            gridItemI={gridItem.i}
            gridItemArgsString={gridItem.args_string}
            gridItemMetadataString={gridItem.metadata_string}
            gridItemIndex={0}
          />
          <EditingPComponent />
        </>
      ),
      options: {
        editableDashboard: true,
        initialDashboard: mockedDashboards.user[0],
        inEditing: true,
      },
    })
  );

  const dashboardGridItem = await screen.findByLabelText("gridItemDiv");
  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
  expect(dashboardGridItem).toBeInTheDocument();

  await waitFor(() => {
    expect(
      window.getComputedStyle(dashboardGridItem).getPropertyValue("border-left")
    ).toBe("1px dashed #f03939");
  });
  const styles = window.getComputedStyle(dashboardGridItem);
  expect(styles.getPropertyValue("border-right")).toBe(
    "3px solid rgb(57,84,240)"
  );
  expect(styles.getPropertyValue("border-top")).toBe("");
  expect(styles.getPropertyValue("border-bottom")).toBe("");
  expect(styles.getPropertyValue("border")).toBe("");
  expect(styles.getPropertyValue("background-color")).toBe(
    "rgba(161, 255, 141, 0.996)"
  );
  expect(styles.getPropertyValue("box-shadow")).toBe(
    "4px 0 8px #f03939,-4px 0 8px rgb(57,84,240)"
  );

  expect(
    await screen.findByLabelText("dashboard-item-dropdown-toggle")
  ).toBeInTheDocument();
});

test("Dashboard Item delete grid item", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  const gridItem = mockedDashboard.gridItems[0];
  mockedConfirm.mockResolvedValue(true);

  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardItem
            gridItemSource={gridItem.source}
            gridItemI={gridItem.i}
            gridItemArgsString={gridItem.args_string}
            gridItemMetadataString={gridItem.metadata_string}
            gridItemIndex={0}
          />
          <ContextLayoutPComponent />
          <EditingPComponent />
        </>
      ),
      options: {
        editableDashboard: true,
        initialDashboard: mockedDashboards.user[0],
        inEditing: true,
      },
    })
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(dashboardItemDropdownToggle);

  const deleteGridItemButton = await screen.findByText("Delete");
  await userEvent.click(deleteGridItemButton);

  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      id: 1,
      name: "editable",
      notes: "test_notes",
      gridItems: [],
      editable: true,
      accessGroups: [],
      description: "test_description",
    })
  );
  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
});

test("Dashboard Item delete grid item cancel", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  const gridItem = mockedDashboard.gridItems[0];
  mockedConfirm.mockResolvedValue(false);

  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardItem
            gridItemSource={gridItem.source}
            gridItemI={gridItem.i}
            gridItemArgsString={gridItem.args_string}
            gridItemMetadataString={gridItem.metadata_string}
            gridItemIndex={0}
          />
          <ContextLayoutPComponent />
          <EditingPComponent />
        </>
      ),
      options: {
        editableDashboard: true,
        initialDashboard: mockedDashboards.user[0],
        inEditing: true,
      },
    })
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(dashboardItemDropdownToggle);

  const deleteGridItemButton = await screen.findByText("Delete");
  await userEvent.click(deleteGridItemButton);

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
          source: "",
          args_string: "{}",
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
      ],
      editable: true,
      accessGroups: [],
      description: "test_description",
    })
  );
  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
});

test("Dashboard Item edit item", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  const gridItem = mockedDashboard.gridItems[0];

  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardItem
            gridItemSource={gridItem.source}
            gridItemI={gridItem.i}
            gridItemArgsString={gridItem.args_string}
            gridItemMetadataString={gridItem.metadata_string}
            gridItemIndex={0}
          />
          <ContextLayoutPComponent />
          <EditingPComponent />
          <DataViewerPComponent />
        </>
      ),
      options: {
        editableDashboard: true,
        initialDashboard: mockedDashboard,
        inEditing: true,
      },
    })
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(dashboardItemDropdownToggle);

  const editGridItemButton = await screen.findByText("Edit");
  await userEvent.click(editGridItemButton);
  const dataViewerModal = await screen.findByRole("dialog");
  expect(dataViewerModal).toBeInTheDocument();
  expect(dataViewerModal).toHaveClass("dataviewer");

  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
  expect(await screen.findByTestId("dataviewer-mode")).toHaveTextContent(
    "dataviewer-mode"
  );

  const closeDataViewerModalButton = within(dataViewerModal).getByText("Close");
  fireEvent.click(closeDataViewerModalButton);
  expect(await screen.findByTestId("dataviewer-mode")).toHaveTextContent(
    "not in dataviewer-mode"
  );
});

test("Dashboard Item copy item", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.user[0];
  mockedDashboard.gridItems = [
    {
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

  const gridItem = mockedDashboard.gridItems[2];

  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardItem
            gridItemSource={gridItem.source}
            gridItemI={gridItem.i}
            gridItemArgsString={gridItem.args_string}
            gridItemMetadataString={gridItem.metadata_string}
            gridItemIndex={2}
          />
          <ContextLayoutPComponent />
          <EditingPComponent />
        </>
      ),
      options: {
        editableDashboard: true,
        dashboards: updatedMockedDashboards,
        initialDashboard: mockedDashboard,
        inEditing: true,
      },
    })
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(dashboardItemDropdownToggle);

  const createCopyButton = await screen.findByText("Copy");
  await userEvent.click(createCopyButton);

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
          w: 10,
          h: 10,
          source: "",
          args_string: "{}",
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
        {
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
      ],
      editable: true,
      accessGroups: [],
      description: "test_description",
    })
  );
  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
});

test("Dashboard Item copy item variable input", async () => {
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
        variable_options_source: "checkbox",
        initial_value: true,
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const gridItem = mockedDashboard.gridItems[0];

  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardItem
            gridItemSource={gridItem.source}
            gridItemI={gridItem.i}
            gridItemArgsString={gridItem.args_string}
            gridItemMetadataString={gridItem.metadata_string}
            gridItemIndex={2}
          />
          <ContextLayoutPComponent />
          <EditingPComponent />
          <InputVariablePComponent />
        </>
      ),
      options: {
        editableDashboard: true,
        dashboards: updatedMockedDashboards,
        initialDashboard: mockedDashboard,
        inEditing: true,
      },
    })
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(dashboardItemDropdownToggle);

  const createCopyButton = await screen.findByText("Copy");
  await userEvent.click(createCopyButton);

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
      ],
      editable: true,
      accessGroups: [],
      description: "test_description",
    })
  );
  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      test_var: true,
      test_var_1: true,
    })
  );
});

test("Dashboard Item copy item variable input already exists", async () => {
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
        variable_options_source: "checkbox",
        initial_value: true,
      }),
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
        variable_name: "test_var_1",
        variable_options_source: "checkbox",
        initial_value: true,
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const gridItem = mockedDashboard.gridItems[0];

  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardItem
            gridItemSource={gridItem.source}
            gridItemI={gridItem.i}
            gridItemArgsString={gridItem.args_string}
            gridItemMetadataString={gridItem.metadata_string}
            gridItemIndex={0}
          />
          <ContextLayoutPComponent />
          <EditingPComponent />
          <InputVariablePComponent />
        </>
      ),
      options: {
        editableDashboard: true,
        dashboards: updatedMockedDashboards,
        initialDashboard: mockedDashboard,
        inEditing: true,
      },
    })
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(dashboardItemDropdownToggle);

  const createCopyButton = await screen.findByText("Copy");
  await userEvent.click(createCopyButton);

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
      ],
      editable: true,
      accessGroups: [],
      description: "test_description",
    })
  );
  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      test_var: true,
      test_var_1: true,
      test_var_2: true,
    })
  );
});

test("Dashboard Item order options disabled for single grid item", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.user[0];
  mockedDashboard.unrestrictedPlacement = true;
  const gridItem = mockedDashboard.gridItems[0];
  gridItem.source = "Custom Image";
  gridItem.args_string = JSON.stringify({
    image_source: "https://www.aquaveo.com/images/aquaveo_logo.svg",
  });

  render(
    createLoadedComponent({
      children: (
        <DashboardItem
          gridItemSource={gridItem.source}
          gridItemI={gridItem.i}
          gridItemArgsString={gridItem.args_string}
          gridItemMetadataString={gridItem.metadata_string}
          gridItemIndex={0}
        />
      ),
      options: {
        editableDashboard: true,
        dashboards: updatedMockedDashboards,
        initialDashboard: mockedDashboard,
        inEditing: true,
      },
    })
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
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
  const mockedDashboard = updatedMockedDashboards.user[0];
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
  mockedDashboard.gridItems = gridItems;
  const gridItem = gridItems[1];

  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardItem
            gridItemSource={gridItem.source}
            gridItemI={gridItem.i}
            gridItemArgsString={gridItem.args_string}
            gridItemMetadataString={gridItem.metadata_string}
            gridItemIndex={1}
          />

          <ContextLayoutPComponent />
        </>
      ),
      options: {
        editableDashboard: true,
        dashboards: updatedMockedDashboards,
        initialDashboard: mockedDashboard,
        inEditing: true,
      },
    })
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(dashboardItemDropdownToggle);

  let orderOption = await screen.findByText("Order");
  expect(orderOption).toBeInTheDocument();
  fireEvent.mouseEnter(orderOption);

  const bringToFrontOption = await screen.findByText("Bring to Front");
  expect(bringToFrontOption).toBeInTheDocument();
  await userEvent.click(bringToFrontOption);

  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      id: 1,
      name: "editable",
      notes: "test_notes",
      gridItems: [greenGridItem, redGridItem, yellowGridItem, blueGridItem],
      editable: true,
      accessGroups: [],
      description: "test_description",
    })
  );

  await userEvent.click(dashboardItemDropdownToggle);

  orderOption = await screen.findByText("Order");
  expect(orderOption).toBeInTheDocument();
  fireEvent.mouseEnter(orderOption);

  const bringForwardOption = await screen.findByText("Bring Forward");
  expect(bringForwardOption).toBeInTheDocument();
  await userEvent.click(bringForwardOption);

  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      id: 1,
      name: "editable",
      notes: "test_notes",
      gridItems: [greenGridItem, yellowGridItem, redGridItem, blueGridItem],
      editable: true,
      accessGroups: [],
      description: "test_description",
    })
  );
});

test("Dashboard Item order backward", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.user[0];
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
  mockedDashboard.gridItems = gridItems;
  const gridItem = gridItems[1];

  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardItem
            gridItemSource={gridItem.source}
            gridItemI={gridItem.i}
            gridItemArgsString={gridItem.args_string}
            gridItemMetadataString={gridItem.metadata_string}
            gridItemIndex={2}
          />

          <ContextLayoutPComponent />
        </>
      ),
      options: {
        editableDashboard: true,
        dashboards: updatedMockedDashboards,
        initialDashboard: mockedDashboard,
        inEditing: true,
      },
    })
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(dashboardItemDropdownToggle);

  let orderOption = await screen.findByText("Order");
  expect(orderOption).toBeInTheDocument();
  fireEvent.mouseEnter(orderOption);

  const sendToBackOption = await screen.findByText("Send to Back");
  expect(sendToBackOption).toBeInTheDocument();
  await userEvent.click(sendToBackOption);

  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      id: 1,
      name: "editable",
      notes: "test_notes",
      gridItems: [redGridItem, greenGridItem, blueGridItem, yellowGridItem],
      editable: true,
      accessGroups: [],
      description: "test_description",
    })
  );

  await userEvent.click(dashboardItemDropdownToggle);

  orderOption = await screen.findByText("Order");
  expect(orderOption).toBeInTheDocument();
  fireEvent.mouseEnter(orderOption);

  const sendBackwardOption = await screen.findByText("Send Backward");
  expect(sendBackwardOption).toBeInTheDocument();
  await userEvent.click(sendBackwardOption);

  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      id: 1,
      name: "editable",
      notes: "test_notes",
      gridItems: [redGridItem, blueGridItem, greenGridItem, yellowGridItem],
      editable: true,
      accessGroups: [],
      description: "test_description",
    })
  );
});

test("Dashboard Item export", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.user[0];
  const gridItem = mockedDashboard.gridItems[0];
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
        <DashboardItem
          gridItemSource={gridItem.source}
          gridItemI={gridItem.i}
          gridItemArgsString={gridItem.args_string}
          gridItemMetadataString={gridItem.metadata_string}
          gridItemIndex={0}
        />
      ),
      options: {
        editableDashboard: true,
        dashboards: updatedMockedDashboards,
        initialDashboard: mockedDashboard,
        inEditing: true,
      },
    })
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
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
    "TethysDashGridItem.json"
  );
});

test("Dashboard Item export fail", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.user[0];
  const gridItem = mockedDashboard.gridItems[0];
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
        <DashboardItem
          gridItemSource={gridItem.source}
          gridItemI={gridItem.i}
          gridItemArgsString={gridItem.args_string}
          gridItemMetadataString={gridItem.metadata_string}
          gridItemIndex={0}
        />
      ),
      options: {
        editableDashboard: true,
        dashboards: updatedMockedDashboards,
        initialDashboard: mockedDashboard,
        inEditing: true,
      },
    })
  );

  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
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
    "TethysDashGridItem.json"
  );
  expect(
    await screen.findByText("Failed to export grid item.")
  ).toBeInTheDocument();
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
  appAPI.downloadJSON = mockDownloadJSON;
  mockDownloadJSON.mockResolvedValueOnce({
    success: true,
    data: exampleStyle,
  });
  mockDownloadJSON.mockResolvedValueOnce({
    success: true,
    data: exampleGeoJSON,
  });

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
  appAPI.downloadJSON = mockDownloadJSON;
  const apiResponse = {
    success: false,
    message: "some error",
  };
  mockDownloadJSON.mockResolvedValueOnce(apiResponse);

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

  expect(response).toStrictEqual(apiResponse);
});

test("handleGridItemImport", async () => {
  const gridItem = {
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
      args_string: "{}",
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
  appAPI.uploadJSON = mockUploadJSON;
  mockUploadJSON.mockResolvedValueOnce({
    success: true,
    filename: "geojson.json",
  });
  mockUploadJSON.mockResolvedValueOnce({
    success: true,
    filename: "style.json",
  });

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
  appAPI.uploadJSON = mockUploadJSON;
  mockUploadJSON.mockResolvedValueOnce({
    success: true,
    filename: "geojson.json",
  });

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

test("handleGridItemImport with map arcgis layer and no style", async () => {
  const mockUploadJSON = jest.fn();
  appAPI.uploadJSON = mockUploadJSON;

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
  appAPI.uploadJSON = mockUploadJSON;
  const apiResponse = {
    success: false,
    message: "some error",
  };
  mockUploadJSON.mockResolvedValueOnce(apiResponse);

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
  appAPI.uploadJSON = mockUploadJSON;
  mockUploadJSON.mockResolvedValueOnce({
    success: true,
    filename: "geojson.json",
  });
  const apiResponse = {
    success: false,
    message: "some error",
  };
  mockUploadJSON.mockResolvedValueOnce(apiResponse);

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
