import { render, screen, fireEvent } from "@testing-library/react";
import DashboardLayout from "components/dashboard/DashboardLayout";
import { userDashboard } from "__tests__/utilities/constants";
import createLoadedComponent, {
  ContextLayoutPComponent,
  TabsPComponent,
} from "__tests__/utilities/customRender";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// eslint-disable-next-line
jest.mock("components/dashboard/DashboardItem", () => (props) => (
  <p>Rendered Item</p>
));

test("Dashboard Layout resize and update layout", async () => {
  const { container } = render(
    createLoadedComponent({
      children: (
        <>
          <LayoutAlertContextProvider>
            <DashboardLayout
              tabId={userDashboard.tabs[0].id}
              gridItems={userDashboard.tabs[0].gridItems}
            />
          </LayoutAlertContextProvider>
          <TabsPComponent />
          <ContextLayoutPComponent />
        </>
      ),
      options: {
        initialDashboard: userDashboard,
        inEditing: true,
      },
    }),
  );
  expect(await screen.findByText("Rendered Item")).toBeInTheDocument();

  await sleep(100);

  // eslint-disable-next-line
  const resizeSpan = container.querySelector(".react-resizable-handle");
  expect(resizeSpan).toBeInTheDocument();
  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 100, clientY: 0 });
  fireEvent.mouseUp(resizeSpan);

  const expectedDashboard = JSON.parse(JSON.stringify(userDashboard));
  expectedDashboard.tabs[0].gridItems = [
    {
      args_string: "{}",
      h: 20,
      i: "1",
      source: "",
      metadata_string: '{"refreshRate":0}',
      w: 28,
      x: 0,
      y: 0,
      id: 1,
      uuid: "some-uuid-1",
    },
  ];
  let { tabs, ...dashboardContextProperties } = expectedDashboard;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );
});

test("Dashboard Layout resize and enforce aspect ratio but no aspect ratio", async () => {
  const mockedDashboard = {
    id: 1,
    name: "editable",
    label: "test_label",
    notes: "test_notes",
    publicDashboard: false,
    permissions: [{ username: "admin", permission: "admin" }],
    userPermission: "admin",
    unrestrictedPlacement: false,
    tabs: [
      {
        id: 1,
        name: "Tab 1",
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
      },
    ],
  };
  const dashboards = { dashboards: [mockedDashboard] };

  const { container } = render(
    createLoadedComponent({
      children: (
        <>
          <LayoutAlertContextProvider>
            <DashboardLayout
              tabId={mockedDashboard.tabs[0].id}
              gridItems={mockedDashboard.tabs[0].gridItems}
            />
          </LayoutAlertContextProvider>
          <TabsPComponent />
          <ContextLayoutPComponent />
        </>
      ),
      options: {
        dashboards: dashboards,
        inEditing: true,
      },
    }),
  );
  expect(await screen.findByText("Rendered Item")).toBeInTheDocument();

  await sleep(100);

  // eslint-disable-next-line
  const resizeSpan = container.querySelector(".react-resizable-handle");
  expect(resizeSpan).toBeInTheDocument();
  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 100, clientY: 0 });
  fireEvent.mouseUp(resizeSpan);

  const expectedDashboard = {
    id: 1,
    name: "editable",
    publicDashboard: false,
    permissions: [{ username: "admin", permission: "admin" }],
    userPermission: "admin",
    unrestrictedPlacement: false,
    notes: "test_notes",
    tabs: [
      {
        id: 1,
        name: "Tab 1",
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
      },
    ],
    editable: true,
  };

  let { tabs, ...dashboardContextProperties } = expectedDashboard;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );
});

test("Dashboard Layout resize and enforce aspect ratio", async () => {
  const mockedDashboard = {
    id: 1,
    name: "editable",
    label: "test_label",
    notes: "test_notes",
    publicDashboard: false,
    permissions: [{ username: "admin", permission: "admin" }],
    userPermission: "admin",
    unrestrictedPlacement: false,
    tabs: [
      {
        id: 1,
        name: "Tab 1",
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
      },
    ],
  };
  const dashboards = { dashboards: [mockedDashboard] };

  const { container } = render(
    createLoadedComponent({
      children: (
        <>
          <LayoutAlertContextProvider>
            <DashboardLayout
              tabId={mockedDashboard.tabs[0].id}
              gridItems={mockedDashboard.tabs[0].gridItems}
            />
          </LayoutAlertContextProvider>
          <TabsPComponent />
          <ContextLayoutPComponent />
        </>
      ),
      options: {
        dashboards: dashboards,
        inEditing: true,
      },
    }),
  );

  expect(await screen.findByText("Rendered Item")).toBeInTheDocument();

  await sleep(100);

  // eslint-disable-next-line
  const resizeSpan = container.querySelector(".react-resizable-handle");
  expect(resizeSpan).toBeInTheDocument();
  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 100, clientY: 0 });
  fireEvent.mouseUp(resizeSpan);

  let expectedDashboard = {
    id: 1,
    name: "editable",
    publicDashboard: false,
    permissions: [{ username: "admin", permission: "admin" }],
    userPermission: "admin",
    unrestrictedPlacement: false,
    notes: "test_notes",
    tabs: [
      {
        id: 1,
        name: "Tab 1",
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
      },
    ],
    editable: true,
  };

  let { tabs, ...dashboardContextProperties } = expectedDashboard;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );

  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 0, clientY: 100 });
  fireEvent.mouseUp(resizeSpan);

  expectedDashboard = {
    id: 1,
    name: "editable",
    publicDashboard: false,
    permissions: [{ username: "admin", permission: "admin" }],
    userPermission: "admin",
    unrestrictedPlacement: false,
    notes: "test_notes",
    tabs: [
      {
        id: 1,
        name: "Tab 1",
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
      },
    ],
    editable: true,
  };

  ({ tabs, ...dashboardContextProperties } = expectedDashboard);
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );
});
