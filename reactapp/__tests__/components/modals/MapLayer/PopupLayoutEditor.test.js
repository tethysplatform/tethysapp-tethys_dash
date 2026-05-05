import { useState, useContext } from "react";
import PropTypes from "prop-types";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditingContext } from "components/contexts/Contexts";

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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
  } = require("components/contexts/Contexts");

  const MockDashboardLayout = ({ tabId, gridItems, rowHeight, responsive }) => {
    const tabCtx = React.useContext(TC);
    const editingCtx = React.useContext(EC);

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
        <span data-testid="mock-dl-grid-items">{JSON.stringify(gridItems)}</span>
        <span data-testid="mock-dl-editing">
          {editingCtx?.isEditing ? "editing" : "not-editing"}
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

// eslint-disable-next-line import/first
import PopupLayoutEditor from "components/modals/MapLayer/PopupLayoutEditor";

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
  size: { widthPct: 60, heightPct: 60 },
  anchor: { name: "center", offsetX: 0, offsetY: 0 },
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

  expect(
    screen.getByText("Edit popup layout: My Layer"),
  ).toBeInTheDocument();
  expect(
    screen.getByLabelText("Save Popup Layout Editor"),
  ).toBeInTheDocument();
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

  const active = JSON.parse(screen.getByTestId("mock-dl-active-tab").textContent);
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

test("rowHeight is derived from the modal body's bounding rect (positive integer)", () => {
  render(
    <PopupLayoutEditor
      show={true}
      onClose={jest.fn()}
      onSave={jest.fn()}
      popupConfig={samplePopupConfig({ gridItems: [baseGridItem()] })}
      layerName="Layer A"
    />,
  );

  const rh = parseInt(
    screen.getByTestId("mock-dl-row-height").textContent,
    10,
  );
  expect(rh).toBeGreaterThan(0);
  // 600 / 20 = 30
  expect(rh).toBe(30);
});

test("DashboardLayout receives responsive=true and tabId=popup", () => {
  render(
    <PopupLayoutEditor
      show={true}
      onClose={jest.fn()}
      onSave={jest.fn()}
      popupConfig={samplePopupConfig({ gridItems: [baseGridItem()] })}
      layerName="Layer A"
    />,
  );

  expect(screen.getByTestId("mock-dl-responsive").textContent).toBe("true");
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
