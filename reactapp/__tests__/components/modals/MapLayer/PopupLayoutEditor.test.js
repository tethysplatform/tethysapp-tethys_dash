import React, { useState, useContext } from "react";
import PropTypes from "prop-types";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  EditingContext,
  DisabledEditingMovementContext,
} from "components/contexts/Contexts";
import PopupLayoutEditor, {
  getInitialViewportSize,
  buildNewGridItem,
} from "components/modals/MapLayer/PopupLayoutEditor";

// Mock DashboardLayout so the popup editor's wiring (TabContext / EditingContext
// / rowHeight) can be asserted without standing up react-grid-layout. The mock
// renders simple probes that surface the values the editor passes down so the
// tests can assert against them and exercise the synthetic context's
// updateTab() path.
jest.mock("components/dashboard/DashboardLayout", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PT = require("prop-types");
  const {
    TabContext: TC,
    EditingContext: EC,
    DisabledEditingMovementContext: DEMC,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
  } = require("components/contexts/Contexts");

  const MockDashboardLayout = ({ tabId, gridItems, rowHeight, responsive }) => {
    const tabCtx = React.useContext(TC);
    const editingCtx = React.useContext(EC);
    const disabledMovementCtx = React.useContext(DEMC);

    const callNoops = () => {
      let didThrow = false;
      try {
        tabCtx.addTab();
        tabCtx.deleteTab(1);
        tabCtx.reorderTabs([]);
        tabCtx.resetTabs();
        tabCtx.importTabs([]);
        tabCtx.setActiveTabId(1);
        // getTab should also work without throwing.
        tabCtx.getTab("popup");
      } catch {
        didThrow = true;
      }
      return didThrow;
    };

    return (
      <div data-testid="mock-dashboard-layout">
        <span data-testid="mock-dl-tab-id">{tabId}</span>
        <span data-testid="mock-dl-row-height">{rowHeight}</span>
        <span data-testid="mock-dl-responsive">{String(!!responsive)}</span>
        <span data-testid="mock-dl-grid-items-count">{gridItems.length}</span>
        <span data-testid="mock-dl-grid-items">
          {JSON.stringify(gridItems)}
        </span>
        <span data-testid="mock-dl-editing">
          {editingCtx?.isEditing ? "editing" : "not-editing"}
        </span>
        <span data-testid="mock-dl-disabled-movement">
          {String(disabledMovementCtx?.disabledEditingMovement)}
        </span>
        <span data-testid="mock-dl-active-tab">
          {JSON.stringify(tabCtx?.getActiveTab?.() ?? null)}
        </span>
        <span data-testid="mock-dl-tabs-count">
          {tabCtx?.tabs?.length ?? -1}
        </span>
        <button
          aria-label="probe-update-tab"
          onClick={() =>
            tabCtx.updateTab(tabId, {
              gridItems: [
                ...gridItems,
                {
                  i: "probe",
                  x: 0,
                  y: 0,
                  w: 5,
                  h: 5,
                  source: "probe-source",
                  args_string: "{}",
                  metadata_string: "{}",
                },
              ],
            })
          }
        >
          probe-update-tab
        </button>
        <button
          aria-label="probe-call-noops"
          onClick={(e) => {
            const threw = callNoops();
            e.currentTarget.setAttribute(
              "data-noop-result",
              threw ? "threw" : "ok",
            );
          }}
        >
          probe-call-noops
        </button>
        {/* Probes for the false-branch of updateTab's gridItems guard (line 377) */}
        <button
          aria-label="probe-update-tab-null"
          onClick={() => tabCtx.updateTab(tabId, null)}
        >
          probe-update-tab-null
        </button>
        <button
          aria-label="probe-update-tab-non-array"
          onClick={() => tabCtx.updateTab(tabId, { gridItems: "not-an-array" })}
        >
          probe-update-tab-non-array
        </button>
      </div>
    );
  };
  MockDashboardLayout.propTypes = {
    tabId: PT.oneOfType([PT.string, PT.number]),
    gridItems: PT.array,
    rowHeight: PT.number,
    responsive: PT.bool,
    shouldLoad: PT.bool,
  };
  return { __esModule: true, default: MockDashboardLayout };
});

const baseGridItem = (overrides = {}) => ({
  i: "1",
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  source: "Plot",
  args_string: "{}",
  metadata_string: JSON.stringify({ refreshRate: 0 }),
  uuid: "uuid-1",
  id: null,
  ...overrides,
});

const samplePopupConfig = (overrides = {}) => ({
  id: 1,
  mode: "modal",
  position: { leftPct: 20, topPct: 20, widthPct: 60, heightPct: 60 },
  titleTemplate: "",
  gridItems: [],
  ...overrides,
});

const Harness = ({ children, initialEditing = false }) => {
  const [isEditing, setIsEditing] = useState(initialEditing);
  return (
    <EditingContext.Provider value={{ isEditing, setIsEditing }}>
      {children}
    </EditingContext.Provider>
  );
};
Harness.propTypes = {
  children: PropTypes.node,
  initialEditing: PropTypes.bool,
};

// Probe that surfaces the host-level EditingContext.isEditing for assertions
// (mirrors EditingPComponent in customRender.js).
const HostEditingProbe = () => {
  const { isEditing } = useContext(EditingContext);
  return (
    <p data-testid="host-editing">{isEditing ? "editing" : "not-editing"}</p>
  );
};

let originalRO;
beforeEach(() => {
  originalRO = window.ResizeObserver;
  // jsdom doesn't expose ResizeObserver; provide a noop implementation so the
  // editor's useLayoutEffect cleanup branch is exercised but no real callback
  // fires (we don't need to simulate resize).
  window.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  // Force a non-zero bounding rect so the rowHeight measurement produces a
  // sensible value. jsdom returns 0 for everything by default.
  Element.prototype.getBoundingClientRect = jest.fn(() => ({
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => {},
  }));
});

afterEach(() => {
  window.ResizeObserver = originalRO;
  jest.restoreAllMocks();
});

test("does not render the modal when show is false", () => {
  render(
    <PopupLayoutEditor
      show={false}
      onClose={jest.fn()}
      onSave={jest.fn()}
      popupConfig={samplePopupConfig()}
      layerName="Layer A"
    />,
  );

  expect(
    screen.queryByLabelText("Popup Layout Editor Modal"),
  ).not.toBeInTheDocument();
});

test("renders modal title with layer name and Save/Cancel buttons", () => {
  render(
    <PopupLayoutEditor
      show={true}
      onClose={jest.fn()}
      onSave={jest.fn()}
      popupConfig={samplePopupConfig({ gridItems: [] })}
      layerName="My Layer"
    />,
  );

  expect(screen.getByText("Edit popup layout: My Layer")).toBeInTheDocument();
  expect(screen.getByLabelText("Save Popup Layout Editor")).toBeInTheDocument();
  expect(
    screen.getByLabelText("Cancel Popup Layout Editor"),
  ).toBeInTheDocument();
});

test("renders fallback title when layerName is missing", () => {
  render(
    <PopupLayoutEditor
      show={true}
      onClose={jest.fn()}
      onSave={jest.fn()}
      popupConfig={samplePopupConfig({ gridItems: [] })}
    />,
  );

  expect(screen.getByText("Edit popup layout")).toBeInTheDocument();
});

test("empty gridItems shows the empty hint and Add Visualization button", () => {
  render(
    <PopupLayoutEditor
      show={true}
      onClose={jest.fn()}
      onSave={jest.fn()}
      popupConfig={samplePopupConfig({ gridItems: [] })}
      layerName="Layer A"
    />,
  );

  expect(
    screen.getByLabelText("Add Popup Visualization Button"),
  ).toBeInTheDocument();
  expect(screen.getByText(/popup grid is empty/i)).toBeInTheDocument();
  expect(screen.getByTestId("mock-dl-grid-items-count").textContent).toBe("0");
});

test("non-empty gridItems are passed through to DashboardLayout", () => {
  const items = [baseGridItem(), baseGridItem({ i: "2", uuid: "uuid-2" })];
  render(
    <PopupLayoutEditor
      show={true}
      onClose={jest.fn()}
      onSave={jest.fn()}
      popupConfig={samplePopupConfig({ gridItems: items })}
      layerName="Layer A"
    />,
  );

  expect(screen.getByTestId("mock-dl-grid-items-count").textContent).toBe("2");
  expect(screen.queryByText(/popup grid is empty/i)).not.toBeInTheDocument();
});

test("clicking Add Visualization appends a new grid item to local state", async () => {
  render(
    <PopupLayoutEditor
      show={true}
      onClose={jest.fn()}
      onSave={jest.fn()}
      popupConfig={samplePopupConfig({ gridItems: [] })}
      layerName="Layer A"
    />,
  );

  await userEvent.click(
    screen.getByLabelText("Add Popup Visualization Button"),
  );

  expect(screen.getByTestId("mock-dl-grid-items-count").textContent).toBe("1");
  const items = JSON.parse(
    screen.getByTestId("mock-dl-grid-items").textContent,
  );
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "",
    args_string: "{}",
    id: null,
  });
  expect(items[0].i).toBe("1");
});

test("Add Visualization assigns sequential `i` values relative to existing items", async () => {
  render(
    <PopupLayoutEditor
      show={true}
      onClose={jest.fn()}
      onSave={jest.fn()}
      popupConfig={samplePopupConfig({
        gridItems: [baseGridItem({ i: "5" })],
      })}
      layerName="Layer A"
    />,
  );

  await userEvent.click(
    screen.getByLabelText("Add Popup Visualization Button"),
  );

  const items = JSON.parse(
    screen.getByTestId("mock-dl-grid-items").textContent,
  );
  expect(items).toHaveLength(2);
  expect(items[1].i).toBe("6");
});

test("Save calls onSave with the current localGridItems and does not call onClose", async () => {
  const onSave = jest.fn();
  const onClose = jest.fn();
  const initial = [baseGridItem()];

  render(
    <PopupLayoutEditor
      show={true}
      onClose={onClose}
      onSave={onSave}
      popupConfig={samplePopupConfig({ gridItems: initial })}
      layerName="Layer A"
    />,
  );

  await userEvent.click(
    screen.getByLabelText("Add Popup Visualization Button"),
  );
  await userEvent.click(screen.getByLabelText("Save Popup Layout Editor"));

  expect(onSave).toHaveBeenCalledTimes(1);
  const passed = onSave.mock.calls[0][0];
  expect(passed).toHaveLength(2);
  expect(onClose).not.toHaveBeenCalled();
});

test("Cancel calls onClose without calling onSave", async () => {
  const onSave = jest.fn();
  const onClose = jest.fn();

  render(
    <PopupLayoutEditor
      show={true}
      onClose={onClose}
      onSave={onSave}
      popupConfig={samplePopupConfig({ gridItems: [baseGridItem()] })}
      layerName="Layer A"
    />,
  );

  await userEvent.click(
    screen.getByLabelText("Add Popup Visualization Button"),
  );
  await userEvent.click(screen.getByLabelText("Cancel Popup Layout Editor"));

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onSave).not.toHaveBeenCalled();
});

test("re-opening the editor resets localGridItems from the prop", async () => {
  // Wrapper that toggles `show` and lets the test add an item, close, then
  // reopen — verifying the abandoned in-memory edit was discarded.
  const Wrapper = () => {
    const [show, setShow] = useState(true);
    return (
      <>
        <button aria-label="external-close" onClick={() => setShow(false)}>
          close
        </button>
        <button aria-label="external-open" onClick={() => setShow(true)}>
          open
        </button>
        <PopupLayoutEditor
          show={show}
          onClose={() => setShow(false)}
          onSave={jest.fn()}
          popupConfig={samplePopupConfig({ gridItems: [baseGridItem()] })}
          layerName="Layer A"
        />
      </>
    );
  };

  render(<Wrapper />);

  // Add a tile (now 2 in local state).
  await userEvent.click(
    screen.getByLabelText("Add Popup Visualization Button"),
  );
  expect(screen.getByTestId("mock-dl-grid-items-count").textContent).toBe("2");

  // Close (without saving). react-bootstrap's Modal may keep portal nodes
  // around with show=false; rely on the external-open click to trigger the
  // re-seed via the [show] effect.
  await userEvent.click(screen.getByLabelText("external-close"));

  // Reopen — should show original 1 item, not 2 (in-memory edit was discarded).
  await userEvent.click(screen.getByLabelText("external-open"));
  expect(screen.getByTestId("mock-dl-grid-items-count").textContent).toBe("1");
});

test("synthetic EditingContext exposes isEditing=true regardless of host edit state", () => {
  render(
    <Harness initialEditing={false}>
      <HostEditingProbe />
      <PopupLayoutEditor
        show={true}
        onClose={jest.fn()}
        onSave={jest.fn()}
        popupConfig={samplePopupConfig({ gridItems: [baseGridItem()] })}
        layerName="Layer A"
      />
    </Harness>,
  );

  // Inside the editor the synthetic provider always reports isEditing=true.
  expect(screen.getByTestId("mock-dl-editing").textContent).toBe("editing");
  // The host EditingContext was NOT mutated.
  expect(screen.getByTestId("host-editing").textContent).toBe("not-editing");
});

test("synthetic DisabledEditingMovementContext forces movement on regardless of host lock", () => {
  // The host dashboard's "lock movement" toggle (DisabledEditingMovementContext
  // = { disabledEditingMovement: true }) must NOT bleed into the popup
  // editor — drag/resize handles are part of how the editor is operated, so
  // the synthetic provider always pins disabledEditingMovement=false.
  render(
    <DisabledEditingMovementContext.Provider
      value={{
        disabledEditingMovement: true,
        setDisabledEditingMovement: () => {},
      }}
    >
      <PopupLayoutEditor
        show={true}
        onClose={jest.fn()}
        onSave={jest.fn()}
        popupConfig={samplePopupConfig({ gridItems: [baseGridItem()] })}
        layerName="Layer A"
      />
    </DisabledEditingMovementContext.Provider>,
  );

  // Inside the editor the synthetic provider reports false even though the
  // host wraps with disabledEditingMovement=true.
  expect(screen.getByTestId("mock-dl-disabled-movement").textContent).toBe(
    "false",
  );
});

test("synthetic TabContext.getActiveTab returns the popup tab with current gridItems", () => {
  const items = [baseGridItem(), baseGridItem({ i: "2" })];
  render(
    <PopupLayoutEditor
      show={true}
      onClose={jest.fn()}
      onSave={jest.fn()}
      popupConfig={samplePopupConfig({ gridItems: items })}
      layerName="Layer A"
    />,
  );

  const active = JSON.parse(
    screen.getByTestId("mock-dl-active-tab").textContent,
  );
  expect(active.id).toBe("popup");
  expect(active.gridItems).toHaveLength(2);
});

test("synthetic TabContext.updateTab mutates local state and shows up on save", async () => {
  const onSave = jest.fn();
  render(
    <PopupLayoutEditor
      show={true}
      onClose={jest.fn()}
      onSave={onSave}
      popupConfig={samplePopupConfig({ gridItems: [baseGridItem()] })}
      layerName="Layer A"
    />,
  );

  // Trigger updateTab via the mock's probe button (simulating a drag-stop or
  // resize-stop from inside the real DashboardLayout).
  await userEvent.click(screen.getByLabelText("probe-update-tab"));
  expect(screen.getByTestId("mock-dl-grid-items-count").textContent).toBe("2");

  await userEvent.click(screen.getByLabelText("Save Popup Layout Editor"));
  expect(onSave).toHaveBeenCalledTimes(1);
  const passed = onSave.mock.calls[0][0];
  expect(passed).toHaveLength(2);
  expect(passed[1].i).toBe("probe");
  expect(passed[1].source).toBe("probe-source");
});

test("rowHeight is derived from the preview box's height (positive integer)", () => {
  render(
    <PopupLayoutEditor
      show={true}
      onClose={jest.fn()}
      onSave={jest.fn()}
      popupConfig={samplePopupConfig({ gridItems: [baseGridItem()] })}
      layerName="Layer A"
    />,
  );

  const rh = parseInt(screen.getByTestId("mock-dl-row-height").textContent, 10);
  expect(rh).toBeGreaterThan(0);
  expect(Number.isInteger(rh)).toBe(true);
});

test("DashboardLayout in the editor is non-responsive (tabId=popup) so edits land in the canonical 100-col layout", () => {
  // Counterpart to PopupModalChrome which IS responsive at runtime — the
  // editor edits the canonical lg layout directly. Responsive editing
  // would cause RGL to emit drag/resize coords in the current
  // breakpoint's column system (4 / 12 / 100), which when persisted
  // straight into the lg layout produced "ghost reverts" of width edits.
  render(
    <PopupLayoutEditor
      show={true}
      onClose={jest.fn()}
      onSave={jest.fn()}
      popupConfig={samplePopupConfig({ gridItems: [baseGridItem()] })}
      layerName="Layer A"
    />,
  );

  expect(screen.getByTestId("mock-dl-responsive").textContent).toBe("false");
  expect(screen.getByTestId("mock-dl-tab-id").textContent).toBe("popup");
});

test("modal does not set an inline zIndex (parent MapLayer modal drops below to stack correctly)", () => {
  render(
    <PopupLayoutEditor
      show={true}
      onClose={jest.fn()}
      onSave={jest.fn()}
      popupConfig={samplePopupConfig({ gridItems: [] })}
      layerName="Layer A"
    />,
  );

  // Stacking convention in this codebase: the parent modal lowers its
  // zIndex to 1050 while a sub-modal is open, so the sub-modal can use
  // Bootstrap's default 1055 and render above. Asserting no inline zIndex
  // here guards against regressing back to the equal-stack bug.
  const modalEl = screen.getByLabelText("Popup Layout Editor Modal");
  expect(modalEl.style.zIndex).toBe("");
});

test("missing popupConfig is treated as empty gridItems", () => {
  render(
    <PopupLayoutEditor
      show={true}
      onClose={jest.fn()}
      onSave={jest.fn()}
      popupConfig={null}
      layerName="Layer A"
    />,
  );

  expect(screen.getByTestId("mock-dl-grid-items-count").textContent).toBe("0");
});

test("Modal close (header X) routes through onClose, not onSave", () => {
  const onClose = jest.fn();
  const onSave = jest.fn();

  render(
    <PopupLayoutEditor
      show={true}
      onClose={onClose}
      onSave={onSave}
      popupConfig={samplePopupConfig({ gridItems: [] })}
      layerName="Layer A"
    />,
  );

  // react-bootstrap Modal close button has aria-label="Close" by default.
  const closeBtn = screen.getByRole("button", { name: /close/i });
  fireEvent.click(closeBtn);
  expect(onClose).toHaveBeenCalled();
  expect(onSave).not.toHaveBeenCalled();
});

test("synthetic TabContext exposes addTab/deleteTab/etc. as no-ops that do not throw", async () => {
  render(
    <PopupLayoutEditor
      show={true}
      onClose={jest.fn()}
      onSave={jest.fn()}
      popupConfig={samplePopupConfig({ gridItems: [baseGridItem()] })}
      layerName="Layer A"
    />,
  );

  const noopBtn = screen.getByLabelText("probe-call-noops");
  await userEvent.click(noopBtn);
  expect(noopBtn).toHaveAttribute("data-noop-result", "ok");

  // The synthetic context exposes a single "popup" tab.
  expect(screen.getByTestId("mock-dl-tabs-count").textContent).toBe("1");
});

describe("PopupLayoutEditor — preview dimensions", () => {
  const ORIGINAL_WIDTH = window.innerWidth;
  const ORIGINAL_HEIGHT = window.innerHeight;

  function setViewport(width, height) {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: width,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: height,
    });
  }

  afterEach(() => {
    setViewport(ORIGINAL_WIDTH, ORIGINAL_HEIGHT);
    jest.restoreAllMocks();
  });

  test("dimensions label shows the popup's true pixel size and percentage", () => {
    setViewport(1000, 800);
    // Boundary measures larger than the popup so no scale-to-fit kicks in.
    jest
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(() => ({
        width: 5000,
        height: 5000,
        top: 0,
        left: 0,
        right: 5000,
        bottom: 5000,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }));

    render(
      <PopupLayoutEditor
        show={true}
        onClose={jest.fn()}
        onSave={jest.fn()}
        popupConfig={samplePopupConfig({
          position: {
            leftPct: 10,
            topPct: 10,
            widthPct: 60,
            heightPct: 50,
          },
        })}
        layerName="Layer A"
      />,
    );

    const label = screen.getByTestId("popup-layout-editor-dimensions");
    // 1000 × 60% = 600, 800 × 50% = 400.
    expect(label.textContent).toContain("600");
    expect(label.textContent).toContain("400");
    expect(label.textContent).toContain("60%");
    expect(label.textContent).toContain("50%");
    // Fits → no scaled-to-fit suffix.
    expect(label.textContent).not.toMatch(/scaled to fit/i);
  });

  test("preview box renders at the popup's true size when it fits", () => {
    setViewport(1000, 800);
    jest
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(() => ({
        width: 5000,
        height: 5000,
        top: 0,
        left: 0,
        right: 5000,
        bottom: 5000,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }));

    render(
      <PopupLayoutEditor
        show={true}
        onClose={jest.fn()}
        onSave={jest.fn()}
        popupConfig={samplePopupConfig({
          position: {
            leftPct: 10,
            topPct: 10,
            widthPct: 60,
            heightPct: 50,
          },
        })}
        layerName="Layer A"
      />,
    );

    const box = screen.getByTestId("popup-layout-editor-preview-box");
    expect(box.style.width).toBe("600px");
    expect(box.style.height).toBe("400px");
  });

  test("preview box scales down proportionally when the popup is larger than the body", () => {
    setViewport(2000, 1500);
    // Tight boundary forces scale-to-fit. Boundary is 800x400; popup at
    // 95% × 95% would be 1900×1425 — both exceed the boundary, so scale
    // is min(800/1900, 400/1425) ≈ 0.281. Resulting box ≈ 533×400.
    jest
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

    render(
      <PopupLayoutEditor
        show={true}
        onClose={jest.fn()}
        onSave={jest.fn()}
        popupConfig={samplePopupConfig({
          position: {
            leftPct: 0,
            topPct: 0,
            widthPct: 95,
            heightPct: 95,
          },
        })}
        layerName="Layer A"
      />,
    );

    const box = screen.getByTestId("popup-layout-editor-preview-box");
    const w = parseInt(box.style.width, 10);
    const h = parseInt(box.style.height, 10);
    // Aspect ratio preserved (true is 1900:1425 = ~4:3, allow rounding slack).
    const aspect = w / h;
    expect(aspect).toBeGreaterThan(1.2);
    expect(aspect).toBeLessThan(1.4);
    // Scaled down — neither true dim should fit.
    expect(w).toBeLessThan(1900);
    expect(h).toBeLessThanOrEqual(400);
    // Label flags the scale-to-fit so the user knows the box isn't 1:1.
    const label = screen.getByTestId("popup-layout-editor-dimensions");
    expect(label.textContent).toMatch(/scaled to fit/i);
  });

  test("falls back to default position when popupConfig has no position", () => {
    setViewport(1000, 800);
    render(
      <PopupLayoutEditor
        show={true}
        onClose={jest.fn()}
        onSave={jest.fn()}
        popupConfig={samplePopupConfig({ position: undefined })}
        layerName="Layer A"
      />,
    );

    // Default DEFAULT_POSITION is 60% × 60% → 600 × 480 at 1000 × 800.
    const label = screen.getByTestId("popup-layout-editor-dimensions");
    expect(label.textContent).toContain("60%");
  });

  test("preview reserves the runtime modal header above the grid area", () => {
    setViewport(1000, 800);
    jest
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(() => ({
        width: 5000,
        height: 5000,
        top: 0,
        left: 0,
        right: 5000,
        bottom: 5000,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }));

    render(
      <PopupLayoutEditor
        show={true}
        onClose={jest.fn()}
        onSave={jest.fn()}
        popupConfig={samplePopupConfig({
          position: {
            leftPct: 10,
            topPct: 10,
            widthPct: 60,
            heightPct: 50,
          },
        })}
        layerName="Layer A"
      />,
    );

    // Preview box is the full popup size: 600 × 400.
    const box = screen.getByTestId("popup-layout-editor-preview-box");
    expect(box.style.height).toBe("400px");

    // A header band is rendered at the top of the box mirroring the runtime
    // PopupModal header — visible to the user as a placeholder so they
    // know the runtime will eat that space.
    expect(
      screen.getByTestId("popup-layout-editor-preview-header"),
    ).toBeInTheDocument();

    // The grid area exposes its computed height so we can assert it is
    // popup height MINUS the header MINUS the body padding (60 + 16 = 76).
    const body = screen.getByTestId("popup-layout-editor-preview-body");
    const gridHeight = Number(body.getAttribute("data-grid-height"));
    expect(gridHeight).toBe(400 - 60 - 2 * 8);

    // rowHeight passed to DashboardLayout derives from the SHRUNK grid
    // height, not the full popup height — so 20 tile rows fit the actual
    // runtime grid budget rather than overflowing once the header lands.
    // deriveRowHeight: gridHeight / TARGET_ROWS (fractional allowed). The
    // editor and runtime share this helper so identical `h` fills the
    // same fraction of body in both views.
    const rh = Number(screen.getByTestId("mock-dl-row-height").textContent);
    expect(rh).toBe(Math.max(1, (400 - 60 - 2 * 8) / 20));
  });
});

describe("PopupLayoutEditor — branch coverage for guards and cleanup", () => {
  // Line 377: if (updates && Array.isArray(updates.gridItems))
  // The false branch fires when updateTab is called with null or with an object
  // whose gridItems is not an array. Local state must stay unchanged in both cases.
  test("updateTab with null updates does not change localGridItems", async () => {
    render(
      <PopupLayoutEditor
        show={true}
        onClose={jest.fn()}
        onSave={jest.fn()}
        popupConfig={samplePopupConfig({ gridItems: [baseGridItem()] })}
        layerName="Layer A"
      />,
    );

    expect(screen.getByTestId("mock-dl-grid-items-count").textContent).toBe(
      "1",
    );
    await userEvent.click(screen.getByLabelText("probe-update-tab-null"));
    expect(screen.getByTestId("mock-dl-grid-items-count").textContent).toBe(
      "1",
    );
  });

  test("updateTab with a non-array gridItems property does not change localGridItems", async () => {
    render(
      <PopupLayoutEditor
        show={true}
        onClose={jest.fn()}
        onSave={jest.fn()}
        popupConfig={samplePopupConfig({ gridItems: [baseGridItem()] })}
        layerName="Layer A"
      />,
    );

    expect(screen.getByTestId("mock-dl-grid-items-count").textContent).toBe(
      "1",
    );
    await userEvent.click(screen.getByLabelText("probe-update-tab-non-array"));
    expect(screen.getByTestId("mock-dl-grid-items-count").textContent).toBe(
      "1",
    );
  });

  // Line 289: if (!node) return undefined — safety guard inside useLayoutEffect.
  // boundaryRef.current is always populated when show=true in normal rendering
  // because useLayoutEffect fires after the DOM commit. To exercise the true
  // branch we spy on React.useRef and wrap the real call so the fiber hook slot
  // is still registered (preventing hook-count mismatch on re-render), but
  // .current is permanently null via a no-op setter so React's own ref-
  // assignment during commit cannot overwrite it.
  test("useLayoutEffect returns early without crashing when boundaryRef has no node", () => {
    const realUseRef = React.useRef;
    jest.spyOn(React, "useRef").mockImplementationOnce(() => {
      // Register the hook slot in React's fiber by calling the real useRef.
      const ref = realUseRef(null);
      // Replace the data property with an accessor so React's commit-phase
      // `ref.current = domNode` silently does nothing.
      Object.defineProperty(ref, "current", {
        get: () => null,
        set: () => {},
        configurable: true,
        enumerable: true,
      });
      return ref;
    });

    render(
      <PopupLayoutEditor
        show={true}
        onClose={jest.fn()}
        onSave={jest.fn()}
        popupConfig={samplePopupConfig({ gridItems: [] })}
        layerName="Layer A"
      />,
    );

    // The null-node guard causes the layout effect to return early — no crash.
    expect(screen.getByText("Edit popup layout: Layer A")).toBeInTheDocument();
    // restoreAllMocks in afterEach handles spy cleanup
  });

  // Line 316: new window.ResizeObserver(() => apply())
  // The arrow function passed to ResizeObserver fires when the observed
  // boundary resizes. The default mock in beforeEach discards the constructor
  // argument, so the callback never runs. Here we replace the mock to capture
  // the callback, then invoke it manually after changing getBoundingClientRect
  // so apply()'s "did the rect change?" guard takes the non-equal branch.
  test("ResizeObserver callback re-runs apply() and propagates the new boundary size", () => {
    let observerCallback;
    window.ResizeObserver = jest.fn().mockImplementation((cb) => {
      observerCallback = cb;
      return {
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      };
    });

    // Tiny initial boundary forces scale-to-fit; displayWidth clamps to MIN.
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 50,
      height: 50,
      top: 0,
      left: 0,
      right: 50,
      bottom: 50,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }));

    render(
      <PopupLayoutEditor
        show={true}
        onClose={jest.fn()}
        onSave={jest.fn()}
        popupConfig={samplePopupConfig({
          position: { leftPct: 0, topPct: 0, widthPct: 60, heightPct: 60 },
        })}
        layerName="Layer A"
      />,
    );

    const initialBoxWidth = screen.getByTestId(
      "popup-layout-editor-preview-box",
    ).style.width;

    // Boundary grows. Returning a different rect lets apply()'s guard take
    // the non-equal branch and call setBoundarySize.
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 5000,
      height: 5000,
      top: 0,
      left: 0,
      right: 5000,
      bottom: 5000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }));

    act(() => {
      observerCallback();
    });

    // After re-render, the preview box renders at popup true size (no scaling)
    // — proving the captured `() => apply()` callback actually ran apply().
    expect(
      screen.getByTestId("popup-layout-editor-preview-box").style.width,
    ).not.toBe(initialBoxWidth);
  });

  // Lines 315-316: typeof window !== "undefined" ? window.innerWidth : 1920
  // The false branch (SSR fallback to 1920/1080) is unreachable via render()
  // because testing-library itself needs window. getInitialViewportSize() is
  // the extracted lazy initializer; calling it directly while window is
  // temporarily deleted exercises both ternary false branches.
  test("getInitialViewportSize falls back to 1920×1080 when window is not defined", () => {
    const savedWindow = global.window;
    // Deleting global.window makes `typeof window` return "undefined" in the
    // same JS environment, because `window` in Node.js/JSDOM is just a regular
    // configurable global property (not a built-in).
    delete global.window;
    let result;
    try {
      result = getInitialViewportSize();
    } finally {
      global.window = savedWindow;
    }
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
  });
});

describe("buildNewGridItem helper function", () => {
  test("returns a grid item with default properties and sequential `i`", () => {
    const existing = [
      baseGridItem({ i: "1" }),
      baseGridItem({ i: "2" }),
      baseGridItem({ i: "5" }),
    ];
    const newItem = buildNewGridItem(existing);
    expect(newItem).toMatchObject({
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "",
      args_string: "{}",
      id: null,
    });
    expect(newItem.i).toBe("6");
  });

  test("returns `i` of '1' when no existing items", () => {
    const newItem = buildNewGridItem([]);
    expect(newItem.i).toBe("1");
  });

  test("handles non-sequential and non-numeric `i` values in existing items", () => {
    const existing = [
      baseGridItem({ i: "a" }),
      baseGridItem({ i: "3" }),
      baseGridItem({ i: "7" }),
    ];
    const newItem = buildNewGridItem(existing);
    expect(newItem.i).toBe("8");
  });

  // Covers the `parsed > acc` false sub-branch of
  // `Number.isFinite(parsed) && parsed > acc` in buildNewGridItem.
  // The first item seeds acc=10; the second's parsed=3 is finite but
  // NOT greater than acc, so the reducer keeps acc=10 (falls into the
  // ternary's false branch via the comparison, not the !isFinite path).
  test("keeps the running max when a later item's numeric `i` is smaller", () => {
    const existing = [
      baseGridItem({ i: "10" }),
      baseGridItem({ i: "3" }),
    ];
    const newItem = buildNewGridItem(existing);
    expect(newItem.i).toBe("11");
  });
});
