import { act } from "react";
import userEvent from "@testing-library/user-event";
import { screen, within, fireEvent, waitFor } from "@testing-library/react";
import DashboardItem from "components/dashboard/DashboardItem";
import { mockedDashboards } from "__tests__/utilities/constants";
import { confirm } from "components/dashboard/DeleteConfirmation";
import renderWithLoaders, {
  ContextLayoutPComponent,
  EditingPComponent,
  DataViewerPComponent,
  InputVariablePComponent,
} from "__tests__/utilities/customRender";

// eslint-disable-next-line
jest.mock("components/modals/DataViewer/VisualizationPane", () => (props) => (
  <>
    <div>Visualization Pane</div>
  </>
));

// eslint-disable-next-line
jest.mock("components/modals/DataViewer/SettingsPane", () => (props) => (
  <>
    <div>Settings Pane</div>
  </>
));

jest.mock("components/dashboard/DeleteConfirmation", () => {
  return {
    confirm: jest.fn(),
  };
});
const mockedConfirm = jest.mocked(confirm);

test("Dashboard Item delete grid item", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  mockedConfirm.mockResolvedValue(true);

  renderWithLoaders({
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
    options: { initialDashboard: mockedDashboards.editable.name },
  });

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  const deleteGridItemButton = await screen.findByText("Delete");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(deleteGridItemButton);
  });

  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      name: "editable",
      label: "test_label",
      accessGroups: [],
      notes: "test_notes",
      gridItems: [],
      editable: true,
    })
  );
  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
});

test("Dashboard Item delete grid item cancel", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  mockedConfirm.mockResolvedValue(false);

  renderWithLoaders({
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
    options: { initialDashboard: mockedDashboards.editable.name },
  });

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  const deleteGridItemButton = await screen.findByText("Delete");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(deleteGridItemButton);
  });

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
          source: "",
          args_string: "{}",
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
      ],
      editable: true,
    })
  );
  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
});

test("Dashboard Item fullscreen but no source", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];

  renderWithLoaders({
    children: (
      <DashboardItem
        gridItemSource={gridItem.source}
        gridItemI={gridItem.i}
        gridItemArgsString={gridItem.args_string}
        gridItemMetadataString={gridItem.metadata_string}
        gridItemIndex={0}
      />
    ),
    options: { initialDashboard: mockedDashboards.editable.name },
  });

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  expect(screen.queryByText("Fullscreen")).not.toBeInTheDocument();
});

test("Dashboard Item fullscreen", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.editable;
  const gridItem = mockedDashboard.gridItems[0];
  gridItem.source = "Custom Image";
  gridItem.args_string = JSON.stringify({
    image_source: "https://www.aquaveo.com/images/aquaveo_logo.svg",
  });

  renderWithLoaders({
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
      dashboards: updatedMockedDashboards,
      initialDashboard: updatedMockedDashboards.editable.name,
    },
  });

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  const fullScreenButton = await screen.findByText("Fullscreen");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(fullScreenButton);
  });
  const fullscreenModal = await screen.findByRole("dialog");
  expect(fullscreenModal).toBeInTheDocument();
  expect(fullscreenModal).toHaveClass("fullscreen");

  const closeFullScreenButton = await screen.findByRole("button", {
    name: "Close",
  });
  // eslint-disable-next-line
  await act(async () => {
    fireEvent.click(closeFullScreenButton);
  });
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

test("Dashboard Item edit item", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];

  renderWithLoaders({
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
      initialDashboard: mockedDashboard.name,
    },
  });

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  const editGridItemButton = await screen.findByText("Edit Visualization");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(editGridItemButton);
  });
  const dataViewerModal = await screen.findByRole("dialog");
  expect(dataViewerModal).toBeInTheDocument();
  expect(dataViewerModal).toHaveClass("dataviewer");

  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
  expect(await screen.findByTestId("dataviewer-mode")).toHaveTextContent(
    "dataviewer-mode"
  );

  const closeDataViewerModalButton = within(dataViewerModal).getByText("Close");
  // eslint-disable-next-line
  await act(async () => {
    fireEvent.click(closeDataViewerModalButton);
  });
  expect(await screen.findByTestId("dataviewer-mode")).toHaveTextContent(
    "not in dataviewer-mode"
  );
});

test("Dashboard Item copy item", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.editable;
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

  renderWithLoaders({
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
      dashboards: updatedMockedDashboards,
      initialDashboard: updatedMockedDashboards.editable.name,
    },
  });

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  const createCopyButton = await screen.findByText("Create Copy");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(createCopyButton);
  });

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
    })
  );
  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
});

test("Dashboard Item copy item variable input", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.editable;
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
        initial_value: { value: true },
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const gridItem = mockedDashboard.gridItems[0];

  renderWithLoaders({
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
      dashboards: updatedMockedDashboards,
      initialDashboard: updatedMockedDashboards.editable.name,
    },
  });

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  const createCopyButton = await screen.findByText("Create Copy");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(createCopyButton);
  });

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
          source: "Variable Input",
          args_string: JSON.stringify({
            variable_name: "test_var",
            variable_options_source: "checkbox",
            initial_value: { value: true },
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
            initial_value: { value: true },
          }),
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
      ],
      editable: true,
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
  const mockedDashboard = updatedMockedDashboards.editable;
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

  renderWithLoaders({
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
      dashboards: updatedMockedDashboards,
      initialDashboard: updatedMockedDashboards.editable.name,
    },
  });

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  const createCopyButton = await screen.findByText("Create Copy");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(createCopyButton);
  });

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
          source: "Variable Input",
          args_string: JSON.stringify({
            variable_name: "test_var",
            variable_options_source: "checkbox",
            initial_value: { value: true },
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
            initial_value: { value: true },
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
            initial_value: { value: true },
          }),
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
      ],
      editable: true,
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

test("Dashboard Item edit size", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.editable;
  const gridItem = mockedDashboard.gridItems[0];
  gridItem.source = "Custom Image";
  gridItem.args_string = JSON.stringify({
    image_source: "https://www.aquaveo.com/images/aquaveo_logo.svg",
  });

  renderWithLoaders({
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
      dashboards: updatedMockedDashboards,
      initialDashboard: updatedMockedDashboards.editable.name,
    },
  });

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  const editSizeButton = await screen.findByText("Edit Size/Location");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(editSizeButton);
  });
  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
});
