/**
 * Pins the per-tile error-boundary contract added to DashboardItem.js:
 *
 *   1. When BaseVisualization throws during render, the failing tile shows
 *      the TileErrorFallback in place of the viz — the rest of the tile's
 *      chrome (CustomAlert, outer StyledContainer, attribution bar) is
 *      unaffected.
 *   2. Sibling tiles in the same dashboard keep rendering normally.
 *
 * Kept separate from the main DashboardItem.test.js suite to isolate the
 * BaseVisualization mock (the existing suite renders it through).
 */

import { render, screen } from "@testing-library/react";
import { userDashboard } from "__tests__/utilities/constants";
import createLoadedComponent from "__tests__/utilities/customRender";
import { GridItemContext } from "components/contexts/Contexts";

// Mock BaseVisualization so we can force one instance to throw while a
// sibling renders normally. The mock keys on gridItemI from context, which
// is the same identifier the error-boundary wraps around.
jest.mock("components/visualizations/Base", () => {
  const { useContext } = require("react");
  const { GridItemContext } = require("components/contexts/Contexts");
  return function MockedBaseVisualization() {
    const { gridItemI } = useContext(GridItemContext);
    if (gridItemI === "boom") {
      throw new Error("simulated viz crash");
    }
    return <div data-testid={`viz-${gridItemI}`}>Viz rendered {gridItemI}</div>;
  };
});

// Modals and confirms are orthogonal — mock them out to keep the test narrow.
jest.mock("components/modals/DataViewer/VisualizationPane", () => () => null);
jest.mock("components/modals/DataViewer/SettingsPane", () => () => null);
jest.mock("components/inputs/DeleteConfirmation", () => ({ confirm: jest.fn() }));

// React logs caught errors via console.error. Silence for this suite so the
// expected crash doesn't spam output.
let errorSpy;
beforeEach(() => {
  delete window.ResizeObserver;
  window.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  jest.clearAllMocks();
});

// Defer require() so the jest.mock above applies before import.
const loadDashboardItem = () =>
  require("components/dashboard/DashboardItem").default;

function mountItem(gridItemI) {
  const DashboardItem = loadDashboardItem();
  const gridItem = userDashboard.tabs[0].gridItems[0];
  return (
    <GridItemContext.Provider
      value={{
        gridItemSource: gridItem.source,
        gridItemI,
        gridItemMetadataString: gridItem.metadata_string,
        gridItemArgsString: gridItem.args_string,
        gridItemIndex: 0,
      }}
    >
      <DashboardItem />
    </GridItemContext.Provider>
  );
}

test("failing viz shows the tile fallback; sibling tile still renders", async () => {
  render(
    createLoadedComponent({
      children: (
        <>
          {mountItem("boom")}
          {mountItem("happy")}
        </>
      ),
      options: { initialDashboard: userDashboard },
    }),
  );

  // Failing tile swaps in the TileErrorFallback message
  expect(
    await screen.findByText("Visualization could not be rendered")
  ).toBeInTheDocument();
  // Sibling tile is unaffected — its mocked viz still renders
  expect(screen.getByTestId("viz-happy")).toBeInTheDocument();
  // The dead viz itself is absent — error boundary replaced it
  expect(screen.queryByTestId("viz-boom")).not.toBeInTheDocument();
});

test("error boundary catches the throw (componentDidCatch fires)", async () => {
  render(
    createLoadedComponent({
      children: mountItem("boom"),
      options: { initialDashboard: userDashboard },
    }),
  );

  await screen.findByText("Visualization could not be rendered");
  // React logs caught render errors via console.error. The fact that the
  // fallback renders AT ALL proves componentDidCatch fired — if the error
  // had escaped the boundary, the test would have crashed with an
  // unhandled exception before this assertion.
  expect(errorSpy).toHaveBeenCalled();
});

test("tile chrome (outer gridVisualization container) is preserved on crash", async () => {
  render(
    createLoadedComponent({
      children: mountItem("boom"),
      options: { initialDashboard: userDashboard },
    }),
  );

  // The outer gridItem label comes from DashboardItem's StyledContainer —
  // it must still be in the DOM. The crash is narrowly scoped to the viz,
  // not the whole tile.
  expect(await screen.findByLabelText("gridItem")).toBeInTheDocument();
  // And the fallback content is inside that container, not in place of it.
  expect(
    screen.getByText("Visualization could not be rendered")
  ).toBeInTheDocument();
});
