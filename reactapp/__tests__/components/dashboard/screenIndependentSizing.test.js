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

// Enforced aspect ratios are in pixels, but columns and rows are no longer the
// same size, so the resize handler must convert the ratio into grid units.
test("enforced aspect ratio holds in pixels when cells are not square", async () => {
  const gridItems = [
    {
      ...userDashboard.tabs[0].gridItems[0],
      metadata_string: JSON.stringify({
        enforceAspectRatio: true,
        aspectRatio: 2,
      }),
    },
  ];
  render(
    createLoadedComponent({
      children: (
        <LayoutAlertContextProvider>
          <DashboardLayout
            tabId={userDashboard.tabs[0].id}
            gridItems={gridItems}
          />
        </LayoutAlertContextProvider>
      ),
      options: { initialDashboard: userDashboard, inEditing: true },
    }),
  );
  expect(await screen.findByText("Rendered Item")).toBeInTheDocument();
  await setViewport(1920, 1000);

  const gridWidth = 1920;
  const colWidth = gridWidth / 100;
  const { rowHeight, onResize } = staticGridProps;
  expect(rowHeight).not.toBeCloseTo(colWidth);
  const node = { closest: () => ({ clientWidth: gridWidth }) };
  const i = gridItems[0].uuid ?? gridItems[0].i;

  // Width-led drag: height follows.
  const widthLed = { i, w: 40, h: 20 };
  const widthPlaceholder = { ...widthLed };
  onResize([], { i, w: 30, h: 20 }, widthLed, widthPlaceholder, null, node);
  expect(widthLed.h).toBe(Math.round((40 * colWidth) / 2 / rowHeight));
  expect(widthPlaceholder.h).toBe(widthLed.h);
  expect((widthLed.w * colWidth) / (widthLed.h * rowHeight)).toBeCloseTo(2, 0);

  // Height-led drag: width follows.
  const heightLed = { i, w: 30, h: 30 };
  const heightPlaceholder = { ...heightLed };
  onResize([], { i, w: 30, h: 20 }, heightLed, heightPlaceholder, null, node);
  expect(heightLed.w).toBe(Math.round((30 * rowHeight * 2) / colWidth));
  expect(heightPlaceholder.w).toBe(heightLed.w);
  expect((heightLed.w * colWidth) / (heightLed.h * rowHeight)).toBeCloseTo(
    2,
    0,
  );
});

// The header and tab bar heights come from their CSS variables when the page
// defines them, and the tab bar only counts when there is more than one tab.
test("grid rowHeight subtracts the header and tab bar heights from CSS", async () => {
  const root = document.documentElement;
  root.style.setProperty("--ts-header-height", "100px");
  root.style.setProperty("--ts-tab-bar-height", "50px");
  try {
    const twoTabDashboard = {
      ...userDashboard,
      tabs: [userDashboard.tabs[0], { id: 2, name: "Tab 2", gridItems: [] }],
    };
    render(
      createLoadedComponent({
        children: (
          <LayoutAlertContextProvider>
            <DashboardLayout
              tabId={twoTabDashboard.tabs[0].id}
              gridItems={twoTabDashboard.tabs[0].gridItems}
            />
          </LayoutAlertContextProvider>
        ),
        options: { initialDashboard: twoTabDashboard, inEditing: true },
      }),
    );
    expect(await screen.findByText("Rendered Item")).toBeInTheDocument();

    await setViewport(1600, 1000);
    expect(staticGridProps.rowHeight).toBeCloseTo((1000 - 100 - 50) / 56);
  } finally {
    root.style.removeProperty("--ts-header-height");
    root.style.removeProperty("--ts-tab-bar-height");
  }
});
