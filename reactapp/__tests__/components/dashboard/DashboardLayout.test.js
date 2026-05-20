import { render, screen, fireEvent, act } from "@testing-library/react";
import DashboardLayout from "components/dashboard/DashboardLayout";
import { userDashboard } from "__tests__/utilities/constants";
import createLoadedComponent, {
  ContextLayoutPComponent,
  TabsPComponent,
} from "__tests__/utilities/customRender";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";

// react-grid-layout's WidthProvider imports resize-observer-polyfill directly,
// so overriding global.ResizeObserver has no effect. Mock the module to capture
// the latest observer callback, letting tests drive the reported width.
let lastResizeObserverCb;
jest.mock("resize-observer-polyfill", () => ({
  __esModule: true,
  default: class {
    constructor(cb) {
      lastResizeObserverCb = cb;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  },
}));

// Spy on Responsive's props so tests can invoke onResizeStop/onDragStop
// directly. Needed to exercise the defense-in-depth early-return in
// updateLayout — DOM resize gestures are blocked by react-resizable when
// isResizable=false, so the inner check is unreachable from events alone.
let lastResponsiveProps;
jest.mock("react-grid-layout", () => {
  const React = jest.requireActual("react");
  const actual = jest.requireActual("react-grid-layout");
  function ResponsiveSpy(props) {
    lastResponsiveProps = props;
    return React.createElement(actual.Responsive, props);
  }
  return {
    __esModule: true,
    default: actual,
    Responsive: ResponsiveSpy,
    WidthProvider: actual.WidthProvider,
    utils: actual.utils,
    calculateUtils: actual.calculateUtils,
  };
});

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

test("Dashboard Responsive Layout", async () => {
  const { container } = render(
    createLoadedComponent({
      children: (
        <>
          <LayoutAlertContextProvider>
            <DashboardLayout
              tabId={userDashboard.tabs[0].id}
              gridItems={userDashboard.tabs[0].gridItems}
              responsive
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

  // Force WidthProvider into the xxs breakpoint (< 480px). Below md, the
  // grid disables drag/resize so user edits cannot round-trip into the
  // persisted lg layout.
  const layoutContextBefore = screen.getByTestId("layout-context").textContent;
  await act(async () => {
    lastResizeObserverCb([{ contentRect: { width: 400 } }]);
  });

  // The same gesture that mutated state above should now be a no-op.
  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 100, clientY: 0 });
  fireEvent.mouseUp(resizeSpan);
  await sleep(100);

  expect(screen.getByTestId("layout-context").textContent).toBe(
    layoutContextBefore,
  );
});

test("Dashboard Responsive Layout updateLayout short-circuits below md", async () => {
  // Covers DashboardLayout.js:117 — the defense-in-depth early return in
  // updateLayout. DOM-driven resize gestures are blocked by react-resizable
  // when isResizable=false, so this branch can only be reached by invoking
  // onResizeStop directly (as if a stale gesture slipped past per-item gating).
  render(
    createLoadedComponent({
      children: (
        <>
          <LayoutAlertContextProvider>
            <DashboardLayout
              tabId={userDashboard.tabs[0].id}
              gridItems={userDashboard.tabs[0].gridItems}
              responsive
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

  // Drop below md so isWideBreakpoint=false.
  await act(async () => {
    lastResizeObserverCb([{ contentRect: { width: 400 } }]);
  });

  // Bypass the per-item gating by invoking onResizeStop directly with a
  // mutated layout. The early return at line 117 must drop this update.
  const layoutContextBefore = screen.getByTestId("layout-context").textContent;
  await act(async () => {
    lastResponsiveProps.onResizeStop([{ i: "1", x: 0, y: 0, w: 50, h: 50 }]);
  });

  expect(screen.getByTestId("layout-context").textContent).toBe(
    layoutContextBefore,
  );
});

test("Dashboard Responsive Layout with allowOverlap", async () => {
  // Two tiles whose footprints overlap. With allowOverlap=false, RGL would
  // push or compact tile "2" when tile "1" is resized into it. With
  // allowOverlap=true, both tiles keep their original x/y.
  const overlappingDashboard = {
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
            id: 1,
            uuid: "some-uuid-1",
            i: "1",
            x: 0,
            y: 0,
            w: 20,
            h: 20,
            source: "",
            args_string: "{}",
            metadata_string: JSON.stringify({ refreshRate: 0 }),
          },
          {
            id: 2,
            uuid: "some-uuid-2",
            i: "2",
            x: 10,
            y: 5,
            w: 20,
            h: 20,
            source: "",
            args_string: "{}",
            metadata_string: JSON.stringify({ refreshRate: 0 }),
          },
        ],
      },
    ],
  };

  const { container } = render(
    createLoadedComponent({
      children: (
        <>
          <LayoutAlertContextProvider>
            <DashboardLayout
              tabId={overlappingDashboard.tabs[0].id}
              gridItems={overlappingDashboard.tabs[0].gridItems}
              responsive
              allowOverlap
            />
          </LayoutAlertContextProvider>
          <TabsPComponent />
          <ContextLayoutPComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [overlappingDashboard] },
        inEditing: true,
      },
    }),
  );
  expect((await screen.findAllByText("Rendered Item")).length).toBe(2);

  await sleep(100);

  // Resize tile "1" — its handle is the first .react-resizable-handle in DOM order.
  // eslint-disable-next-line
  const resizeSpan = container.querySelector(".react-resizable-handle");
  expect(resizeSpan).toBeInTheDocument();
  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 100, clientY: 0 });
  fireEvent.mouseUp(resizeSpan);

  // Tile "1" widens to w=28; tile "2" stays at its original x=10, y=5
  // because allowOverlap=true prevents push/compact.
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
            metadata_string: JSON.stringify({ refreshRate: 0 }),
            w: 28,
            x: 0,
            y: 0,
            id: 1,
            uuid: "some-uuid-1",
          },
          {
            args_string: "{}",
            h: 20,
            i: "2",
            source: "",
            metadata_string: JSON.stringify({ refreshRate: 0 }),
            w: 20,
            x: 10,
            y: 5,
            id: 2,
            uuid: "some-uuid-2",
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

  // Responsive behavior still applies: at xxs, edits are gated off.
  const layoutContextBefore = screen.getByTestId("layout-context").textContent;
  await act(async () => {
    lastResizeObserverCb([{ contentRect: { width: 400 } }]);
  });

  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 100, clientY: 0 });
  fireEvent.mouseUp(resizeSpan);
  await sleep(100);

  expect(screen.getByTestId("layout-context").textContent).toBe(
    layoutContextBefore,
  );
});
