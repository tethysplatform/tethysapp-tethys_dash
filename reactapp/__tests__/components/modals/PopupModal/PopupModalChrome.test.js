/* eslint-disable no-template-curly-in-string */
// This file tests literal `${feature.<key>}` template syntax handling.
import React, { useState } from "react";
import PropTypes from "prop-types";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PopupModalChrome from "components/modals/PopupModal/PopupModalChrome";
import { VariableInputsContext } from "components/contexts/Contexts";
import {
  deriveRowHeight,
  DEFAULT_ROW_HEIGHT,
} from "components/modals/PopupModal/PopupModalChrome";

// DashboardLayout transitively reads contexts and renders real visualization
// machinery; replace it with a stub that exposes the props we care about for
// chrome-level assertions.
jest.mock("components/dashboard/DashboardLayout", () => {
  // eslint-disable-next-line react/prop-types
  const MockDashboardLayout = ({
    // eslint-disable-next-line react/prop-types
    tabId,
    // eslint-disable-next-line react/prop-types
    gridItems,
    // eslint-disable-next-line react/prop-types
    responsive,
    // eslint-disable-next-line react/prop-types
    rowHeight,
    // eslint-disable-next-line react/prop-types
    allowOverlap,
  }) => (
    <div data-testid="mock-dashboard-layout">
      <span data-testid="mock-dl-tab-id">{tabId}</span>
      <span data-testid="mock-dl-responsive">{String(responsive)}</span>
      <span data-testid="mock-dl-row-height">{rowHeight}</span>
      <span data-testid="mock-dl-allow-overlap">{String(allowOverlap)}</span>
      {/* eslint-disable-next-line react/prop-types */}
      <span data-testid="mock-dl-grid-items-count">{gridItems.length}</span>
    </div>
  );
  return MockDashboardLayout;
});

const baseGridItem = (overrides = {}) => ({
  i: "1",
  x: 0,
  y: 0,
  w: 4,
  h: 4,
  source: "Text",
  args_string: "{}",
  metadata_string: "{}",
  ...overrides,
});

const samplePopupConfig = (overrides = {}) => ({
  id: 1,
  mode: "modal",
  position: { leftPct: 20, topPct: 20, widthPct: 60, heightPct: 60 },
  titleTemplate: "",
  gridItems: [baseGridItem()],
  ...overrides,
});

const featureA = {
  layerName: "Stations",
  attributes: { station_id: "ABC", station_name: "Boulder Creek" },
};
const featureB = {
  layerName: "Stations",
  attributes: { station_id: "XYZ", station_name: "Eagle River" },
};
const featureC = {
  layerName: "Stations",
  attributes: { station_id: "QRS", station_name: "Animas River" },
};

// Chrome is purely controlled — title substitution lives in PopupModal's
// header, owned by Map.js. This harness pretends to be the parent: it owns
// the activeIndex state and exposes it for assertions.
const Harness = ({ features, popupConfig, initialActiveIndex = 0 }) => {
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);
  const [variableInputValues, setVariableInputValues] = useState({});
  return (
    <VariableInputsContext.Provider
      value={{
        variableInputValues,
        setVariableInputValues,
        variableInputDateFormats: {},
        variableInputSliderMeta: {},
        setVariableInputSliderMeta: () => {},
      }}
    >
      <span data-testid="harness-active-index">{activeIndex}</span>
      <PopupModalChrome
        features={features}
        popupConfig={popupConfig}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
      />
    </VariableInputsContext.Provider>
  );
};
Harness.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  features: PropTypes.array.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  popupConfig: PropTypes.object.isRequired,
  initialActiveIndex: PropTypes.number,
};

describe("PopupModalChrome — carousel", () => {
  test("does not render the carousel for a single feature", () => {
    render(<Harness features={[featureA]} popupConfig={samplePopupConfig()} />);
    expect(screen.queryByTestId("popup-modal-carousel")).toBeNull();
  });

  test("renders the carousel for multiple features with substituted labels", () => {
    render(
      <Harness
        features={[
          featureA,
          featureB,
          featureC,
          {
            layerName: "Stations",
          },
        ]}
        popupConfig={samplePopupConfig({
          titleTemplate: "${feature.station_name}",
        })}
      />,
    );
    expect(screen.getByTestId("popup-modal-carousel")).toBeInTheDocument();
    expect(screen.getByTestId("popup-modal-carousel-chip-0")).toHaveTextContent(
      "Boulder Creek",
    );
    expect(screen.getByTestId("popup-modal-carousel-chip-1")).toHaveTextContent(
      "Eagle River",
    );
    expect(screen.getByTestId("popup-modal-carousel-chip-2")).toHaveTextContent(
      "Animas River",
    );
    expect(screen.getByTestId("popup-modal-carousel-chip-3")).toHaveTextContent(
      "Feature 4",
    );
  });

  test("falls back to 'Feature N' carousel label when the template is empty", () => {
    render(
      <Harness
        features={[featureA, featureB]}
        popupConfig={samplePopupConfig({ titleTemplate: "" })}
      />,
    );
    expect(screen.getByText("Feature 1")).toBeInTheDocument();
    expect(screen.getByText("Feature 2")).toBeInTheDocument();
  });

  test("clicking a chip bubbles up via onActiveIndexChange", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        features={[featureA, featureB, featureC]}
        popupConfig={samplePopupConfig()}
      />,
    );
    expect(screen.getByTestId("harness-active-index")).toHaveTextContent("0");
    await user.click(screen.getByTestId("popup-modal-carousel-chip-2"));
    expect(screen.getByTestId("harness-active-index")).toHaveTextContent("2");
  });
});

describe("PopupModalChrome — DashboardLayout wiring", () => {
  test("renders a DashboardLayout with the popup's gridItems", () => {
    const items = [baseGridItem({ i: "1" }), baseGridItem({ i: "2" })];
    render(
      <Harness
        features={[featureA]}
        popupConfig={samplePopupConfig({ gridItems: items })}
      />,
    );
    expect(screen.getByTestId("mock-dashboard-layout")).toBeInTheDocument();
    expect(screen.getByTestId("mock-dl-tab-id").textContent).toBe("popup");
    expect(screen.getByTestId("mock-dl-responsive").textContent).toBe("true");
    expect(screen.getByTestId("mock-dl-grid-items-count").textContent).toBe(
      "2",
    );
  });

  test("renders an empty hint when there are no gridItems", () => {
    render(
      <Harness
        features={[featureA]}
        popupConfig={samplePopupConfig({ gridItems: null })}
      />,
    );
    expect(screen.getByTestId("popup-modal-chrome-empty")).toBeInTheDocument();
    expect(
      screen.getByText(/no visualizations have been configured/i),
    ).toBeInTheDocument();
  });

  test("forces allowOverlap=false (popup grids never stack tiles, regardless of host)", () => {
    render(
      <Harness
        features={[featureA]}
        popupConfig={samplePopupConfig({ gridItems: [baseGridItem()] })}
      />,
    );
    expect(screen.getByTestId("mock-dl-allow-overlap").textContent).toBe(
      "false",
    );
  });

  test("rowHeight is a positive integer derived from a measured body height", () => {
    render(<Harness features={[featureA]} popupConfig={samplePopupConfig()} />);
    const rowHeightText = screen.getByTestId("mock-dl-row-height").textContent;
    const rowHeight = Number(rowHeightText);
    expect(Number.isFinite(rowHeight)).toBe(true);
    expect(rowHeight).toBeGreaterThan(0);
  });

  test("empty gridItems shows the empty hint instead of DashboardLayout", () => {
    render(
      <Harness
        features={[featureA]}
        popupConfig={samplePopupConfig({ gridItems: [] })}
      />,
    );
    expect(screen.getByTestId("popup-modal-chrome-empty")).toBeInTheDocument();
    expect(
      screen.getByText(/no visualizations have been configured/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("mock-dashboard-layout")).toBeNull();
  });
});

describe("PopupModalChrome — re-render behavior", () => {
  test("switching the active carousel slide re-renders without remounting DashboardLayout twice", () => {
    render(
      <Harness
        features={[featureA, featureB]}
        popupConfig={samplePopupConfig()}
      />,
    );
    expect(screen.getAllByTestId("mock-dashboard-layout")).toHaveLength(1);
    fireEvent.click(screen.getByTestId("popup-modal-carousel-chip-1"));
    expect(screen.getAllByTestId("mock-dashboard-layout")).toHaveLength(1);
    expect(screen.getByTestId("harness-active-index")).toHaveTextContent("1");
  });

  test("clamps an out-of-range activeIndex to the last available feature", () => {
    // Defensive: if the parent's activeIndex drifts past the end of the
    // features array (e.g., features shrink without an immediate sync),
    // the chrome shows the last feature rather than crashing.
    render(
      <Harness
        features={[featureA, featureB]}
        popupConfig={samplePopupConfig()}
        initialActiveIndex={5}
      />,
    );
    // No crash; carousel renders with the last chip selected.
    const chips = screen.getAllByRole("tab");
    expect(chips[1]).toHaveAttribute("aria-selected", "true");
  });

  test("clamps to 0 when features array is empty", () => {
    render(
      <Harness
        features={[]}
        popupConfig={samplePopupConfig()}
        initialActiveIndex={3}
      />,
    );
    // No crash; carousel doesn't render since there's only one "feature" (the empty state).
    expect(screen.queryByTestId("popup-modal-carousel")).toBeNull();
    // Active index clamps to 0.
    expect(screen.getByTestId("harness-active-index")).toHaveTextContent("3");
  });
});

describe("PopupModalChrome — useLayoutEffect branch coverage (lines 86-91)", () => {
  // Line 86: `if (!node) return undefined` — guards against bodyRef.current
  // being null when the layout effect runs. In normal rendering React always
  // populates the ref before useLayoutEffect fires. Wrap React.useRef so the
  // fiber hook slot is registered (call-through to real useRef) but .current
  // stays null via an accessor with a no-op setter.
  test("layout effect returns early without crashing when bodyRef has no node", () => {
    const realUseRef = React.useRef;
    jest.spyOn(React, "useRef").mockImplementationOnce(() => {
      const ref = realUseRef(null);
      Object.defineProperty(ref, "current", {
        get: () => null,
        set: () => {},
        configurable: true,
        enumerable: true,
      });
      return ref;
    });

    render(<Harness features={[featureA]} popupConfig={samplePopupConfig()} />);

    // No crash — the !node guard returned undefined before reaching apply().
    expect(screen.getByTestId("popup-modal-chrome")).toBeInTheDocument();
    // rowHeight stayed at the initial DEFAULT_ROW_HEIGHT because apply() never ran.
    expect(screen.getByTestId("mock-dl-row-height").textContent).toBe(
      String(DEFAULT_ROW_HEIGHT),
    );

    jest.restoreAllMocks();
  });

  // Line 91: setRowHeight((prev) => (prev === next ? prev : next))
  // jsdom's default getBoundingClientRect returns zeros, so deriveRowHeight
  // falls back to DEFAULT_ROW_HEIGHT — equal to the useState initial value,
  // which makes the ternary always take the `prev === next` branch. Mocking
  // a non-zero height makes deriveRowHeight produce a different value and
  // forces the `prev !== next` branch.
  test("setRowHeight takes the non-equal branch when measured height differs from default", () => {
    jest
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(() => ({
        width: 800,
        height: 800, // deriveRowHeight(800) = max(20, floor(800/20)) = 40
        top: 0,
        left: 0,
        right: 800,
        bottom: 800,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }));

    render(<Harness features={[featureA]} popupConfig={samplePopupConfig()} />);

    // The updater fn observed prev=30 (DEFAULT_ROW_HEIGHT) vs next=40,
    // returned `next`, and React committed the new value.
    expect(screen.getByTestId("mock-dl-row-height").textContent).toBe("40");

    jest.restoreAllMocks();
  });
});

describe("PopupModalChrome — ResizeObserver callback (line 97)", () => {
  // Line 97: `new window.ResizeObserver(() => apply())`. JSDOM doesn't ship
  // ResizeObserver, so by default the layout effect returns early at line 94
  // and the constructor + its callback are never reached. Install a mock that
  // captures the callback, then invoke it manually after changing
  // getBoundingClientRect to drive apply() through a re-measure.
  test("ResizeObserver callback re-runs apply() and propagates the new rowHeight", () => {
    let observerCallback;
    const originalRO = window.ResizeObserver;
    window.ResizeObserver = jest.fn().mockImplementation((cb) => {
      observerCallback = cb;
      return {
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      };
    });

    // Initial height → deriveRowHeight(400) = 20. Different from
    // DEFAULT_ROW_HEIGHT (30) so the first apply() commits a new state, then
    // a follow-up re-measure with a larger rect must commit again.
    const rectSpy = jest
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(() => ({
        width: 800,
        height: 400,
        top: 0,
        left: 0,
        right: 800,
        bottom: 400,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }));

    render(<Harness features={[featureA]} popupConfig={samplePopupConfig()} />);

    // First apply() ran during the layout effect: 400 → rowHeight = 20.
    expect(screen.getByTestId("mock-dl-row-height").textContent).toBe("20");
    expect(window.ResizeObserver).toHaveBeenCalledTimes(1);
    expect(typeof observerCallback).toBe("function");

    // Boundary grows. apply()'s setRowHeight must commit a new value.
    rectSpy.mockImplementation(() => ({
      width: 1600,
      height: 1600, // deriveRowHeight(1600) = max(20, 80) = 80
      top: 0,
      left: 0,
      right: 1600,
      bottom: 1600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }));

    act(() => {
      observerCallback();
    });

    // The captured `() => apply()` callback ran apply(), which re-measured
    // and called setRowHeight with the new value (80 !== 20).
    expect(screen.getByTestId("mock-dl-row-height").textContent).toBe("80");

    window.ResizeObserver = originalRO;
    jest.restoreAllMocks();
  });
});

describe("deriveRowHeight", () => {
  test("derives rowHeight from the given height and minimum row count", () => {
    expect(deriveRowHeight(400, 20)).toBe(20);
    expect(deriveRowHeight(200, 20)).toBe(20);
    expect(deriveRowHeight(800, 20)).toBe(40);
    expect(deriveRowHeight(1000, 25)).toBe(50);
    expect(deriveRowHeight(null)).toBe(DEFAULT_ROW_HEIGHT);
    expect(deriveRowHeight({})).toBe(DEFAULT_ROW_HEIGHT);
  });
});
