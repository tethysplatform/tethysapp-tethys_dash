import { render, screen, fireEvent } from "@testing-library/react";
import DashboardLayout from "components/dashboard/DashboardLayout";
import { mockedDashboards } from "__tests__/utilities/constants";
import createLoadedComponent, {
  ContextLayoutPComponent,
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
            <DashboardLayout />
          </LayoutAlertContextProvider>
          <ContextLayoutPComponent />
        </>
      ),
      options: {
        initialDashboard: mockedDashboards.user[0],
        inEditing: true,
      },
    })
  );
  expect(await screen.findByText("Rendered Item")).toBeInTheDocument();

  await sleep(100);

  // eslint-disable-next-line
  const resizeSpan = container.querySelector(".react-resizable-handle");
  expect(resizeSpan).toBeInTheDocument();
  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 100, clientY: 0 });
  fireEvent.mouseUp(resizeSpan);

  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      id: 1,
      name: "editable",
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
      accessGroups: [],
      description: "test_description",
    })
  );
});

test("Dashboard Layout resize and enforce aspect ratio but no aspect ratio", async () => {
  const mockedDashboard = {
    id: 1,
    name: "editable",
    label: "test_label",
    notes: "test_notes",
    editable: true,
    accessGroups: [],
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
  const dashboards = { user: [mockedDashboard], public: [] };

  const { container } = render(
    createLoadedComponent({
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
        inEditing: true,
      },
    })
  );
  expect(await screen.findByText("Rendered Item")).toBeInTheDocument();

  await sleep(100);

  // eslint-disable-next-line
  const resizeSpan = container.querySelector(".react-resizable-handle");
  expect(resizeSpan).toBeInTheDocument();
  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 100, clientY: 0 });
  fireEvent.mouseUp(resizeSpan);

  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      id: 1,
      name: "editable",
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
      accessGroups: [],
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
    accessGroups: [],
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
  const dashboards = { user: [mockedDashboard], public: [] };

  const { container } = render(
    createLoadedComponent({
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
        inEditing: true,
      },
    })
  );

  expect(await screen.findByText("Rendered Item")).toBeInTheDocument();

  await sleep(100);

  // eslint-disable-next-line
  const resizeSpan = container.querySelector(".react-resizable-handle");
  expect(resizeSpan).toBeInTheDocument();
  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 100, clientY: 0 });
  fireEvent.mouseUp(resizeSpan);

  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      id: 1,
      name: "editable",
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
      accessGroups: [],
    })
  );

  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 0, clientY: 100 });
  fireEvent.mouseUp(resizeSpan);

  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      id: 1,
      name: "editable",
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
      accessGroups: [],
    })
  );
});
