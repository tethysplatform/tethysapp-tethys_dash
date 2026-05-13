/* eslint-disable no-template-curly-in-string */
// This file tests literal `${feature.<key>}` template syntax handling.
import React, { useState } from "react";
import PropTypes from "prop-types";
import { render, screen, act } from "@testing-library/react";
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

// Chrome is purely controlled — title + carousel live in PopupModal's header
// (owned by Map.js). This harness wraps the chrome in a stand-in
// VariableInputsContext provider so FeatureScopedVariableInputs can chain off it.
const Harness = ({ feature, popupConfig }) => {
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
      <PopupModalChrome feature={feature} popupConfig={popupConfig} />
    </VariableInputsContext.Provider>
  );
};
Harness.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  feature: PropTypes.object,
  // eslint-disable-next-line react/forbid-prop-types
  popupConfig: PropTypes.object.isRequired,
};

describe("PopupModalChrome — DashboardLayout wiring", () => {
  test("renders a DashboardLayout with the popup's gridItems", () => {
    const items = [baseGridItem({ i: "1" }), baseGridItem({ i: "2" })];
    render(
      <Harness
        feature={featureA}
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
        feature={featureA}
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
        feature={featureA}
        popupConfig={samplePopupConfig({ gridItems: [baseGridItem()] })}
      />,
    );
    expect(screen.getByTestId("mock-dl-allow-overlap").textContent).toBe(
      "false",
    );
  });

  test("rowHeight is a positive integer derived from a measured body height", () => {
    render(<Harness feature={featureA} popupConfig={samplePopupConfig()} />);
    const rowHeightText = screen.getByTestId("mock-dl-row-height").textContent;
    const rowHeight = Number(rowHeightText);
    expect(Number.isFinite(rowHeight)).toBe(true);
    expect(rowHeight).toBeGreaterThan(0);
  });

  test("empty gridItems shows the empty hint instead of DashboardLayout", () => {
    render(
      <Harness
        feature={featureA}
        popupConfig={samplePopupConfig({ gridItems: [] })}
      />,
    );
    expect(screen.getByTestId("popup-modal-chrome-empty")).toBeInTheDocument();
    expect(
      screen.getByText(/no visualizations have been configured/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("mock-dashboard-layout")).toBeNull();
  });

  test("no carousel is rendered inside the chrome body (it lives in the modal header)", () => {
    render(<Harness feature={featureA} popupConfig={samplePopupConfig()} />);
    expect(screen.queryByTestId("popup-modal-carousel")).toBeNull();
  });
});

describe("PopupModalChrome — useLayoutEffect branch coverage", () => {
  // Guards against bodyRef.current being null when the layout effect runs.
  // In normal rendering React always populates the ref before useLayoutEffect
  // fires. Wrap React.useRef so the fiber hook slot is registered
  // (call-through to real useRef) but .current stays null via an accessor.
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

    render(<Harness feature={featureA} popupConfig={samplePopupConfig()} />);

    // No crash — the !node guard returned undefined before reaching apply().
    expect(screen.getByTestId("popup-modal-chrome")).toBeInTheDocument();
    // rowHeight stayed at the initial DEFAULT_ROW_HEIGHT because apply() never ran.
    expect(screen.getByTestId("mock-dl-row-height").textContent).toBe(
      String(DEFAULT_ROW_HEIGHT),
    );

    jest.restoreAllMocks();
  });

  // setRowHeight((prev) => (prev === next ? prev : next)) — jsdom's default
  // getBoundingClientRect returns zeros, so deriveRowHeight falls back to
  // DEFAULT_ROW_HEIGHT (equal to the useState initial value), which makes the
  // ternary always take the `prev === next` branch. Mocking a non-zero height
  // forces the `prev !== next` branch.
  test("setRowHeight takes the non-equal branch when measured height differs from default", () => {
    jest
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(() => ({
        width: 800,
        height: 800, // deriveRowHeight(800) = 800 / 20 = 40
        top: 0,
        left: 0,
        right: 800,
        bottom: 800,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }));

    render(<Harness feature={featureA} popupConfig={samplePopupConfig()} />);

    expect(screen.getByTestId("mock-dl-row-height").textContent).toBe("40");

    jest.restoreAllMocks();
  });
});

describe("PopupModalChrome — ResizeObserver callback", () => {
  // JSDOM doesn't ship ResizeObserver, so by default the layout effect
  // returns early and the constructor + its callback are never reached.
  // Install a mock that captures the callback, then invoke it manually
  // after changing getBoundingClientRect to drive apply() through a
  // re-measure.
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

    render(<Harness feature={featureA} popupConfig={samplePopupConfig()} />);

    // First apply() ran during the layout effect: 400 → rowHeight = 20.
    expect(screen.getByTestId("mock-dl-row-height").textContent).toBe("20");
    expect(window.ResizeObserver).toHaveBeenCalledTimes(1);
    expect(typeof observerCallback).toBe("function");

    // Boundary grows.
    rectSpy.mockImplementation(() => ({
      width: 1600,
      height: 1600, // deriveRowHeight(1600) = 1600 / 20 = 80
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

    expect(screen.getByTestId("mock-dl-row-height").textContent).toBe("80");

    window.ResizeObserver = originalRO;
    jest.restoreAllMocks();
  });
});

describe("deriveRowHeight", () => {
  test("divides container height evenly across TARGET_ROWS slices", () => {
    // Clean divisions still yield integers. Editor and runtime use the
    // same helper, so identical `h` values fill the same fraction of body.
    expect(deriveRowHeight(400)).toBe(20);
    expect(deriveRowHeight(200)).toBe(10);
    expect(deriveRowHeight(800)).toBe(40);
    expect(deriveRowHeight(1000)).toBe(50);
    expect(deriveRowHeight(null)).toBe(DEFAULT_ROW_HEIGHT);
    expect(deriveRowHeight({})).toBe(DEFAULT_ROW_HEIGHT);
  });

  test("returns fractional rowHeight when the body doesn't divide evenly", () => {
    // Floor-rounding here would leak up to 19px (~5% of small modals) as a
    // gap below the visualization at h=TARGET_ROWS. RGL accepts fractional
    // rowHeight so we just don't round.
    expect(deriveRowHeight(450)).toBe(22.5);
    expect(deriveRowHeight(999)).toBeCloseTo(49.95, 5);
  });

  test("clamps to 1 only to avoid pathological zero/sub-pixel rows", () => {
    expect(deriveRowHeight(10)).toBe(1);
    expect(deriveRowHeight(1)).toBe(1);
  });
});
