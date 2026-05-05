import PropTypes from "prop-types";
import { useState, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";
import { FaPlus } from "react-icons/fa";
import { TabContext, EditingContext } from "components/contexts/Contexts";
import DashboardLayout from "components/dashboard/DashboardLayout";
import "components/modals/wideModal.css";

// Default rowHeight used before the layout-effect measurement runs. Matches a
// ballpark cell size that keeps tiles legible on first paint inside the wide
// modal. Subsequent updates flow through the ResizeObserver.
const DEFAULT_ROW_HEIGHT = 30;

// Target row count used to derive rowHeight from the measured modal body
// height. Picking ~20 rows per visible body keeps tiles roughly square at the
// 100-column grid width (matching DashboardLayout's static column count).
const TARGET_ROWS = 20;

const noop = () => {};

const StyledModalBody = styled(Modal.Body)`
  display: flex;
  flex-direction: column;
  height: 80vh;
  padding: 0.75rem;
  overflow: hidden;
`;

const ChromeBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.5rem;
  padding: 0 0.25rem 0.5rem;
  flex: 0 0 auto;
`;

const GridContainer = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  position: relative;
`;

const EmptyHint = styled.p`
  color: #6c757d;
  font-size: 0.9rem;
  text-align: center;
  margin: 1rem 0;
`;

function deriveRowHeight(containerHeight) {
  if (!containerHeight || !Number.isFinite(containerHeight)) {
    return DEFAULT_ROW_HEIGHT;
  }
  return Math.max(20, Math.floor(containerHeight / TARGET_ROWS));
}

function buildNewGridItem(localGridItems) {
  // Mirror Header.js#onAddGridItem so popup grid items have the same shape as
  // host-dashboard grid items (the runtime carousel renders them through the
  // same DashboardLayout path).
  const maxGridItemI = localGridItems.reduce((acc, value) => {
    const parsed = parseInt(value.i, 10);
    return Number.isFinite(parsed) && parsed > acc ? parsed : acc;
  }, 0);

  return {
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "",
    args_string: "{}",
    metadata_string: JSON.stringify({ refreshRate: 0 }),
    uuid: uuidv4(),
    id: null,
    i: `${maxGridItemI + 1}`,
  };
}

const PopupLayoutEditor = ({
  show,
  onClose,
  popupConfig,
  onSave,
  layerName,
}) => {
  // Local in-memory state. Drag/resize/add/delete only mutate this; the parent
  // is told via onSave() when the user commits, and the actual persistence
  // happens in MapLayer's overall Save flow (so Cancel on the host modal also
  // discards popup edits — matches DataViewer's sub-modal pattern).
  const [localGridItems, setLocalGridItems] = useState(
    () => popupConfig?.gridItems ?? [],
  );

  // Reset local state every time the editor re-opens. If the user cancels,
  // their abandoned edits must not leak into the next open.
  useEffect(() => {
    if (show) {
      setLocalGridItems(popupConfig?.gridItems ?? []);
    }
    // popupConfig is intentionally omitted — we only re-seed on the open
    // transition, not on every parent rerender that creates a new object
    // identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  // Measure the modal body to pick a sensible per-row pixel height. Use
  // useLayoutEffect for a synchronous first measurement — this avoids the
  // first-paint reflow flash described in the plan's Key Decision section.
  const bodyRef = useRef(null);
  const [rowHeight, setRowHeight] = useState(DEFAULT_ROW_HEIGHT);

  useLayoutEffect(() => {
    if (!show) return undefined;
    const node = bodyRef.current;
    if (!node) return undefined;

    const apply = () => {
      const rect = node.getBoundingClientRect();
      const next = deriveRowHeight(rect.height);
      setRowHeight((prev) => (prev === next ? prev : next));
    };

    // Synchronous first measurement.
    apply();

    // ResizeObserver picks up subsequent modal size changes (viewport resize,
    // dev tools toggling, etc.). Falls back to a no-op when the environment
    // doesn't expose ResizeObserver (some jsdom setups).
    if (typeof window === "undefined" || !window.ResizeObserver) {
      return undefined;
    }
    const observer = new window.ResizeObserver(() => apply());
    observer.observe(node);
    return () => observer.disconnect();
  }, [show]);

  // Synthetic TabContext value. The popup is modeled as a single "popup" tab —
  // the embedded DashboardLayout calls updateTab() on drag/resize, and
  // DashboardItem calls it for delete/copy/reorder via getActiveTab(). Methods
  // that don't make sense for a single-tab popup (addTab, deleteTab, etc.)
  // degrade to no-ops rather than throwing so any downstream consumer that
  // walks the context shape doesn't crash.
  const tabContextValue = useMemo(() => {
    const popupTab = { id: "popup", name: "popup", gridItems: localGridItems };
    return {
      tabs: [popupTab],
      activeTabId: "popup",
      setActiveTabId: noop,
      addTab: noop,
      importTabs: noop,
      updateTab: (_tabId, updates) => {
        if (updates && Array.isArray(updates.gridItems)) {
          setLocalGridItems(updates.gridItems);
        }
      },
      deleteTab: noop,
      reorderTabs: noop,
      resetTabs: noop,
      getActiveTab: () => ({
        id: "popup",
        name: "popup",
        gridItems: localGridItems,
      }),
      getTab: () => ({
        id: "popup",
        name: "popup",
        gridItems: localGridItems,
      }),
    };
  }, [localGridItems]);

  // Always editing inside the sub-editor regardless of host edit mode (R12).
  const editingContextValue = useMemo(
    () => ({ isEditing: true, setIsEditing: noop }),
    [],
  );

  function handleAddGridItem() {
    setLocalGridItems((prev) => [...prev, buildNewGridItem(prev)]);
  }

  function handleSave() {
    // Parent's onSave handler closes the sub-editor; do NOT also call
    // onClose() here or it would double-fire.
    onSave(localGridItems);
  }

  function handleCancel() {
    onClose();
  }

  const titleText = layerName
    ? `Edit popup layout: ${layerName}`
    : "Edit popup layout";

  return (
    <Modal
      show={show}
      onHide={handleCancel}
      dialogClassName="wideModalDialog"
      aria-label="Popup Layout Editor Modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>{titleText}</Modal.Title>
      </Modal.Header>
      <StyledModalBody ref={bodyRef}>
        <ChromeBar>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAddGridItem}
            aria-label="Add Popup Visualization Button"
          >
            <FaPlus style={{ marginRight: "0.35rem" }} />
            Add Visualization
          </Button>
          {localGridItems.length === 0 && (
            <EmptyHint>
              The popup grid is empty. Click &ldquo;Add Visualization&rdquo; to
              add the first tile.
            </EmptyHint>
          )}
        </ChromeBar>
        <GridContainer aria-label="Popup Layout Grid Container">
          <TabContext.Provider value={tabContextValue}>
            <EditingContext.Provider value={editingContextValue}>
              <DashboardLayout
                tabId="popup"
                gridItems={localGridItems}
                shouldLoad={true}
                responsive
                rowHeight={rowHeight}
                allowOverlap={false}
              />
            </EditingContext.Provider>
          </TabContext.Provider>
        </GridContainer>
      </StyledModalBody>
      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={handleCancel}
          aria-label="Cancel Popup Layout Editor"
        >
          Cancel
        </Button>
        <Button
          variant="success"
          onClick={handleSave}
          aria-label="Save Popup Layout Editor"
        >
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

PopupLayoutEditor.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  popupConfig: PropTypes.shape({
    id: PropTypes.number,
    mode: PropTypes.string,
    size: PropTypes.object,
    anchor: PropTypes.object,
    titleTemplate: PropTypes.string,
    gridItems: PropTypes.array,
  }),
  onSave: PropTypes.func.isRequired,
  popupId: PropTypes.number,
  gridItemId: PropTypes.number,
  layerName: PropTypes.string,
};

PopupLayoutEditor.defaultProps = {
  popupConfig: null,
  popupId: null,
  gridItemId: null,
  layerName: null,
};

export default PopupLayoutEditor;
