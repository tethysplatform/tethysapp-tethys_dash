import PropTypes from "prop-types";
import { useState, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";
import { FaPlus } from "react-icons/fa";
import {
  TabContext,
  EditingContext,
  DisabledEditingMovementContext,
} from "components/contexts/Contexts";
import DashboardLayout from "components/dashboard/DashboardLayout";
import "components/modals/wideModal.css";

// Default rowHeight used before the layout-effect measurement runs. Matches a
// ballpark cell size that keeps tiles legible on first paint inside the wide
// modal. Subsequent updates flow through the ResizeObserver.
const DEFAULT_ROW_HEIGHT = 30;

// Target row count used to derive rowHeight from the preview-area height.
// Picking ~20 rows per visible body keeps tiles roughly square at the
// 100-column grid width (matching DashboardLayout's static column count).
const TARGET_ROWS = 20;

// Default popup position — same shape PopupConfigPane uses when popupConfig
// is null/missing. Keeps the editor preview faithful to what the runtime
// modal will render in the absence of explicit user config.
const DEFAULT_POSITION = {
  leftPct: 20,
  topPct: 20,
  widthPct: 60,
  heightPct: 60,
};

// Minimum preview-area pixel dims so the grid stays interactable even when
// the user configures a tiny popup or a very small viewport.
const MIN_PREVIEW_WIDTH = 240;
const MIN_PREVIEW_HEIGHT = 160;

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
  flex-wrap: wrap;
`;

const DimensionsLabel = styled.span`
  font-size: 0.85rem;
  color: #495057;
  margin-left: auto;
  white-space: nowrap;
`;

const PreviewBoundary = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  background-color: #f1f3f5;
  border-radius: 4px;
  padding: 0.5rem;
`;

// The fixed-pixel-size box that mirrors the runtime popup's actual
// dimensions. Tiles configured against this box scale 1:1 to the runtime
// popup at the same viewport, so users can size visualizations relative to
// the actual popup area instead of the editor's full body.
const PreviewSizedBox = styled.div`
  flex: 0 0 auto;
  background-color: #ffffff;
  border: 1px solid #adb5bd;
  border-radius: 4px;
  box-shadow: 0 0 0 4px rgba(13, 110, 253, 0.08);
  position: relative;
  overflow: hidden;
`;

const GridContainer = styled.div`
  width: 100%;
  height: 100%;
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

/**
 * Compute the preview box dimensions in pixels.
 *
 * - True size = popup's configured % of viewport in pixels
 * - If true size > available editor body, scale down proportionally so the
 *   popup's aspect ratio is preserved
 * - Clamp to MIN_PREVIEW_* so the box stays interactable even on tiny
 *   configurations
 *
 * Returns `{ trueWidth, trueHeight, displayWidth, displayHeight, scaled }`
 * — `true*` are the runtime pixel dimensions (for the dimensions label),
 * `display*` are what the box actually renders at, and `scaled` flags
 * whether the down-scale kicked in.
 */
function computePreviewDimensions({
  position,
  viewportWidth,
  viewportHeight,
  availableWidth,
  availableHeight,
}) {
  const widthPct = position?.widthPct ?? DEFAULT_POSITION.widthPct;
  const heightPct = position?.heightPct ?? DEFAULT_POSITION.heightPct;

  const trueWidth = (viewportWidth * widthPct) / 100;
  const trueHeight = (viewportHeight * heightPct) / 100;

  // If we don't have a body measurement yet, fall back to the true size —
  // the box will paint at full popup dimensions until the boundary
  // measures and we re-render with a scale factor.
  const fitsHorizontally =
    !Number.isFinite(availableWidth) || trueWidth <= availableWidth;
  const fitsVertically =
    !Number.isFinite(availableHeight) || trueHeight <= availableHeight;

  if (fitsHorizontally && fitsVertically) {
    return {
      trueWidth,
      trueHeight,
      displayWidth: Math.max(MIN_PREVIEW_WIDTH, trueWidth),
      displayHeight: Math.max(MIN_PREVIEW_HEIGHT, trueHeight),
      scaled: false,
    };
  }

  const scaleX = availableWidth / trueWidth;
  const scaleY = availableHeight / trueHeight;
  const scale = Math.min(scaleX, scaleY);
  return {
    trueWidth,
    trueHeight,
    displayWidth: Math.max(MIN_PREVIEW_WIDTH, Math.floor(trueWidth * scale)),
    displayHeight: Math.max(
      MIN_PREVIEW_HEIGHT,
      Math.floor(trueHeight * scale),
    ),
    scaled: true,
  };
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

  // Measure the preview boundary (where the sized popup-area box lives) so
  // we know how much room is available for the box. Synchronous first
  // measurement via useLayoutEffect — avoids a first-paint reflow flash.
  const boundaryRef = useRef(null);
  const [boundarySize, setBoundarySize] = useState({
    width: NaN,
    height: NaN,
  });

  useLayoutEffect(() => {
    if (!show) return undefined;
    const node = boundaryRef.current;
    if (!node) return undefined;

    const apply = () => {
      const rect = node.getBoundingClientRect();
      setBoundarySize((prev) => {
        if (prev.width === rect.width && prev.height === rect.height) {
          return prev;
        }
        return { width: rect.width, height: rect.height };
      });
    };

    apply();

    if (typeof window === "undefined" || !window.ResizeObserver) {
      return undefined;
    }
    const observer = new window.ResizeObserver(() => apply());
    observer.observe(node);
    return () => observer.disconnect();
  }, [show]);

  // Track viewport size so the preview area's "true pixel size" stays
  // accurate as the user resizes the browser. The runtime popup also uses
  // viewport percentages, so the editor preview tracks alongside it.
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1920,
    height: typeof window !== "undefined" ? window.innerHeight : 1080,
  }));

  useEffect(() => {
    if (!show || typeof window === "undefined") return undefined;
    const onResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [show]);

  const { trueWidth, trueHeight, displayWidth, displayHeight, scaled } =
    useMemo(
      () =>
        computePreviewDimensions({
          position: popupConfig?.position,
          viewportWidth: viewportSize.width,
          viewportHeight: viewportSize.height,
          availableWidth: boundarySize.width,
          availableHeight: boundarySize.height,
        }),
      [popupConfig, viewportSize, boundarySize],
    );

  const rowHeight = useMemo(
    () => deriveRowHeight(displayHeight),
    [displayHeight],
  );

  const widthPct = popupConfig?.position?.widthPct ?? DEFAULT_POSITION.widthPct;
  const heightPct =
    popupConfig?.position?.heightPct ?? DEFAULT_POSITION.heightPct;

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

  // Force movement on inside the sub-editor regardless of the host
  // dashboard's "lock movement" toggle. The popup editor needs drag/resize
  // handles to be usable; the host's lock has no semantic meaning here.
  const disabledEditingMovementContextValue = useMemo(
    () => ({ disabledEditingMovement: false, setDisabledEditingMovement: noop }),
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
      <StyledModalBody>
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
          <DimensionsLabel
            data-testid="popup-layout-editor-dimensions"
            title={
              scaled
                ? `Scaled down to fit; true popup size at this viewport is ${Math.round(trueWidth)}×${Math.round(trueHeight)} px`
                : undefined
            }
          >
            Popup area: {Math.round(trueWidth)}&nbsp;×&nbsp;
            {Math.round(trueHeight)}&nbsp;px ({widthPct}% &times; {heightPct}%
            of viewport)
            {scaled ? " — scaled to fit" : ""}
          </DimensionsLabel>
        </ChromeBar>
        <PreviewBoundary
          ref={boundaryRef}
          aria-label="Popup Layout Preview Boundary"
        >
          <PreviewSizedBox
            aria-label="Popup Layout Preview Box"
            data-testid="popup-layout-editor-preview-box"
            style={{ width: displayWidth, height: displayHeight }}
          >
            <GridContainer aria-label="Popup Layout Grid Container">
              <TabContext.Provider value={tabContextValue}>
                <EditingContext.Provider value={editingContextValue}>
                  <DisabledEditingMovementContext.Provider
                    value={disabledEditingMovementContextValue}
                  >
                    <DashboardLayout
                      tabId="popup"
                      gridItems={localGridItems}
                      shouldLoad={true}
                      responsive
                      rowHeight={rowHeight}
                      allowOverlap={false}
                    />
                  </DisabledEditingMovementContext.Provider>
                </EditingContext.Provider>
              </TabContext.Provider>
            </GridContainer>
          </PreviewSizedBox>
        </PreviewBoundary>
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
    position: PropTypes.shape({
      leftPct: PropTypes.number,
      topPct: PropTypes.number,
      widthPct: PropTypes.number,
      heightPct: PropTypes.number,
    }),
    titleTemplate: PropTypes.string,
    // eslint-disable-next-line react/forbid-prop-types
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
