import { screen, fireEvent } from "@testing-library/react";
import DashboardLayout from "components/dashboard/DashboardLayout";
import DashboardLayoutAlerts from "components/dashboard/DashboardLayoutAlerts";
import {
  mockedDashboards,
  updatedDashboard,
} from "__tests__/utilities/constants";
import renderWithLoaders, {
  ContextLayoutPComponent,
  EditingPComponent,
} from "__tests__/utilities/customRender";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import appAPI from "services/api/app";

// eslint-disable-next-line
jest.mock("components/dashboard/DashboardItem", () => (props) => (
  <>
    <button data-testid="test-submit" type="submit" form="gridUpdate" />
    <br></br>
    <br></br>
  </>
));

test("Dashboard Layout resize and update layout", async () => {
  const { container } = renderWithLoaders({
    children: (
      <>
        <LayoutAlertContextProvider>
          <DashboardLayout />
        </LayoutAlertContextProvider>
        <ContextLayoutPComponent />
      </>
    ),
    options: {
      initialDashboard: mockedDashboards.editable.name,
      inEditing: true,
    },
  });

  // eslint-disable-next-line
  const resizeSpan = container.querySelector(".react-resizable-handle");
  expect(resizeSpan).toBeInTheDocument();
  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 100, clientY: 0 });
  fireEvent.mouseUp(resizeSpan);

  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      name: "editable",
      label: "test_label",
      access_groups: [],
      notes: "test_notes",
      gridItems: [
        {
          args_string: "{}",
          h: 20,
          i: "1",
          source: "",
          metadata_string: JSON.stringify({ refreshRate: 0 }),
          w: 28,
          x: 0,
          y: 0,
        },
      ],
      editable: true,
    })
  );
});

test("Dashboard Layout submit changes not editing", async () => {
  const mockUpdateDashboard = jest.fn();

  appAPI.updateDashboard = mockUpdateDashboard;

  renderWithLoaders({
    children: (
      <>
        <LayoutAlertContextProvider>
          <DashboardLayout />
        </LayoutAlertContextProvider>
      </>
    ),
    options: {
      initialDashboard: mockedDashboards.editable.name,
    },
  });

  const submitButton = screen.getByTestId("test-submit");
  fireEvent.click(submitButton);

  expect(mockUpdateDashboard).not.toHaveBeenCalled();
});

test("Dashboard Layout submit changes success", async () => {
  const newUpdatedDashboard = updatedDashboard;
  newUpdatedDashboard.label = "test_label";
  const mockUpdateDashboard = jest.fn();
  mockUpdateDashboard.mockResolvedValue({
    success: true,
    updated_dashboard: newUpdatedDashboard,
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  renderWithLoaders({
    children: (
      <>
        <LayoutAlertContextProvider>
          <DashboardLayoutAlerts />
          <DashboardLayout />
        </LayoutAlertContextProvider>
        <EditingPComponent />
      </>
    ),
    options: {
      initialDashboard: mockedDashboards.editable.name,
      inEditing: true,
    },
  });

  const submitButton = screen.getByTestId("test-submit");
  fireEvent.click(submitButton);

  expect(
    await screen.findByText("Change have been saved.")
  ).toBeInTheDocument();
  expect(await screen.findByTestId("editing")).toHaveTextContent("not editing");
});

test("Dashboard Layout submit changes fail", async () => {
  const mockUpdateDashboard = jest.fn();
  mockUpdateDashboard.mockResolvedValue({
    success: false,
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  renderWithLoaders({
    children: (
      <>
        <LayoutAlertContextProvider>
          <DashboardLayoutAlerts />
          <DashboardLayout />
        </LayoutAlertContextProvider>
        <EditingPComponent />
      </>
    ),
    options: {
      initialDashboard: mockedDashboards.editable.name,
      inEditing: true,
    },
  });

  const submitButton = screen.getByTestId("test-submit");
  fireEvent.click(submitButton);

  expect(
    await screen.findByText(
      "Failed to save changes. Check server logs for more information."
    )
  ).toBeInTheDocument();
  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
});

test("Dashboard Layout resize and enforce aspect ratio but no aspect ratio", async () => {
  const mockedDashboard = {
    id: 1,
    name: "editable",
    label: "test_label",
    notes: "test_notes",
    editable: true,
    access_groups: [],
    gridItems: [
      {
        i: "1",
        x: 0,
        y: 0,
        w: 20,
        h: 20,
        source: "",
        args_string: "{}",
        metadata_string: JSON.stringify({ enforceAspectRatio: true }),
      },
    ],
  };
  const dashboards = { editable: mockedDashboard };

  const { container } = renderWithLoaders({
    children: (
      <>
        <LayoutAlertContextProvider>
          <DashboardLayout />
        </LayoutAlertContextProvider>
        <ContextLayoutPComponent />
      </>
    ),
    options: {
      dashboards: dashboards,
      initialDashboard: mockedDashboards.editable.name,
      inEditing: true,
    },
  });

  // eslint-disable-next-line
  const resizeSpan = container.querySelector(".react-resizable-handle");
  expect(resizeSpan).toBeInTheDocument();
  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 100, clientY: 0 });
  fireEvent.mouseUp(resizeSpan);

  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      name: "editable",
      label: "test_label",
      access_groups: [],
      notes: "test_notes",
      gridItems: [
        {
          args_string: "{}",
          h: 20,
          i: "1",
          source: "",
          metadata_string: JSON.stringify({ enforceAspectRatio: true }),
          w: 28,
          x: 0,
          y: 0,
        },
      ],
      editable: true,
    })
  );
});

test("Dashboard Layout resize and enforce aspect ratio", async () => {
  const mockedDashboard = {
    id: 1,
    name: "editable",
    label: "test_label",
    notes: "test_notes",
    editable: true,
    access_groups: [],
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
          enforceAspectRatio: true,
          aspectRatio: 2,
        }),
      },
    ],
  };
  const dashboards = { editable: mockedDashboard };

  const { container } = renderWithLoaders({
    children: (
      <>
        <LayoutAlertContextProvider>
          <DashboardLayout />
        </LayoutAlertContextProvider>
        <ContextLayoutPComponent />
      </>
    ),
    options: {
      dashboards: dashboards,
      initialDashboard: mockedDashboards.editable.name,
      inEditing: true,
    },
  });

  // eslint-disable-next-line
  const resizeSpan = container.querySelector(".react-resizable-handle");
  expect(resizeSpan).toBeInTheDocument();
  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 100, clientY: 0 });
  fireEvent.mouseUp(resizeSpan);

  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      name: "editable",
      label: "test_label",
      access_groups: [],
      notes: "test_notes",
      gridItems: [
        {
          args_string: "{}",
          h: 14,
          i: "1",
          source: "",
          metadata_string: JSON.stringify({
            enforceAspectRatio: true,
            aspectRatio: 2,
          }),
          w: 28,
          x: 0,
          y: 0,
        },
      ],
      editable: true,
    })
  );

  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 0, clientY: 100 });
  fireEvent.mouseUp(resizeSpan);

  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      name: "editable",
      label: "test_label",
      access_groups: [],
      notes: "test_notes",
      gridItems: [
        {
          args_string: "{}",
          h: 24,
          i: "1",
          source: "",
          metadata_string: JSON.stringify({
            enforceAspectRatio: true,
            aspectRatio: 2,
          }),
          w: 48,
          x: 0,
          y: 0,
        },
      ],
      editable: true,
    })
  );
});
