import { render, screen, act } from "@testing-library/react";
import DashboardLayout from "components/dashboard/DashboardLayout";
import { userDashboard } from "__tests__/utilities/constants";
import createLoadedComponent from "__tests__/utilities/customRender";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";

// WidthProvider imports resize-observer-polyfill directly; stub it to a no-op.
jest.mock("resize-observer-polyfill", () => ({
  __esModule: true,
  default: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
}));

// The main dashboard uses the non-responsive grid (default export). Spy on it
// to capture the rowHeight prop.
let staticGridProps;
jest.mock("react-grid-layout", () => {
  const React = jest.requireActual("react");
  // CJS export: requireActual returns the RGL component itself, not `.default`.
  const actual = jest.requireActual("react-grid-layout");
  function DefaultSpy(props) {
    staticGridProps = props;
    return React.createElement(actual, props);
  }
  return {
    __esModule: true,
    default: DefaultSpy,
    Responsive: actual.Responsive,
    WidthProvider: actual.WidthProvider,
    utils: actual.utils,
    calculateUtils: actual.calculateUtils,
  };
});

// eslint-disable-next-line
jest.mock("components/dashboard/DashboardItem", () => (props) => (
  <p>Rendered Item</p>
));

beforeEach(() => {
  staticGridProps = undefined;
});

function renderMainDashboard() {
  return render(
    createLoadedComponent({
      children: (
        <LayoutAlertContextProvider>
          <DashboardLayout
            tabId={userDashboard.tabs[0].id}
            gridItems={userDashboard.tabs[0].gridItems}
          />
        </LayoutAlertContextProvider>
      ),
      options: { initialDashboard: userDashboard, inEditing: true },
    }),
  );
}

async function setViewport(width, height) {
  await act(async () => {
    window.innerWidth = width;
    window.innerHeight = height;
    window.dispatchEvent(new Event("resize"));
  });
}

// Regression: height proportions are screen-independent only if rowHeight tracks
// the content-area height. It used to be window.innerWidth / 100, independent of
// height entirely.
test("grid rowHeight scales with the content-area height", async () => {
  renderMainDashboard();
  expect(await screen.findByText("Rendered Item")).toBeInTheDocument();

  // Large heights so the fixed header offset is negligible and the ratio of
  // row heights approaches the ratio of viewport heights.
  await setViewport(1600, 2000);
  const rowHeightShort = staticGridProps.rowHeight;

  await setViewport(1600, 4000);
  const rowHeightTall = staticGridProps.rowHeight;

  expect(rowHeightShort).toBeGreaterThan(0);
  expect(rowHeightTall).toBeGreaterThan(rowHeightShort);
  expect(rowHeightTall / rowHeightShort).toBeGreaterThan(1.9);
  expect(rowHeightTall / rowHeightShort).toBeLessThan(2.1);
});

// Width alone must not move rowHeight, or height proportions shift between
// screens of differing width.
test("grid rowHeight is unchanged when only the width changes", async () => {
  renderMainDashboard();
  expect(await screen.findByText("Rendered Item")).toBeInTheDocument();

  await setViewport(1000, 900);
  const rowHeightNarrow = staticGridProps.rowHeight;

  await setViewport(2000, 900);
  const rowHeightWide = staticGridProps.rowHeight;

  expect(rowHeightNarrow).toBeGreaterThan(0);
  expect(rowHeightWide).toBeCloseTo(rowHeightNarrow);
});
