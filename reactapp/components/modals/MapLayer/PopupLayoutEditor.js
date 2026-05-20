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
import { deriveRowHeight } from "components/modals/PopupModal/PopupModalChrome";

const DEFAULT_POSITION = {
  leftPct: 20,
  topPct: 20,
  widthPct: 60,
  heightPct: 60,
};
const MIN_PREVIEW_WIDTH = 240;
const MIN_PREVIEW_HEIGHT = 160;
const PREVIEW_HEADER_HEIGHT = 60;
const PREVIEW_BODY_PADDING_Y = 8;

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

const PreviewSizedBox = styled.div`
  flex: 0 0 auto;
  background-color: #ffffff;
  border: 1px solid #adb5bd;
  border-radius: 4px;
  box-shadow: 0 0 0 4px rgba(13, 110, 253, 0.08);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const PreviewHeader = styled.div`
  flex: 0 0 ${PREVIEW_HEADER_HEIGHT}px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.15);
  background-color: #f8f9fa;
  color: #6c757d;
  font-size: 0.85rem;
  font-style: italic;
  user-select: none;
`;

const PreviewHeaderClose = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  font-size: 1.1rem;
  line-height: 1;
  color: #adb5bd;
  border: 1px dashed #ced4da;
`;

const PreviewBodyArea = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  padding: ${PREVIEW_BODY_PADDING_Y}px 0;
  display: flex;
  flex-direction: column;
`;

const GridContainer = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  overflow: auto;
  position: relative;
`;

const EmptyHint = styled.p`
  color: #6c757d;
  font-size: 0.9rem;
  text-align: center;
  margin: 1rem 0;
`;

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
    displayHeight: Math.max(MIN_PREVIEW_HEIGHT, Math.floor(trueHeight * scale)),
    scaled: true,
  };
}

export function buildNewGridItem(localGridItems) {
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

export function getInitialViewportSize() {
  return {
    width: typeof window !== "undefined" ? window.innerWidth : 1920,
    height: typeof window !== "undefined" ? window.innerHeight : 1080,
  };
}

const PopupLayoutEditor = ({
  show,
  onClose,
  popupConfig,
  onSave,
  layerName,
}) => {
  const [localGridItems, setLocalGridItems] = useState(
    () => popupConfig?.gridItems ?? [],
  );

  // Re-seed local state whenever the editor (re-)opens. popupConfig is
  // intentionally omitted from the dep list — re-seeding on every parent
  // rerender that creates a new object identity would wipe in-progress
  // edits, and the [show] gate is what we actually want.
  useEffect(() => {
    if (show) {
      setLocalGridItems(popupConfig?.gridItems ?? []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

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

  const [viewportSize, setViewportSize] = useState(getInitialViewportSize);

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

  const gridAreaHeight = Math.max(
    1,
    displayHeight - PREVIEW_HEADER_HEIGHT - 2 * PREVIEW_BODY_PADDING_Y,
  );
  const rowHeight = useMemo(
    () => deriveRowHeight(gridAreaHeight),
    [gridAreaHeight],
  );

  const widthPct = popupConfig?.position?.widthPct ?? DEFAULT_POSITION.widthPct;
  const heightPct =
    popupConfig?.position?.heightPct ?? DEFAULT_POSITION.heightPct;

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

  const disabledEditingMovementContextValue = useMemo(
    () => ({
      disabledEditingMovement: false,
      setDisabledEditingMovement: noop,
    }),
    [],
  );

  function handleAddGridItem() {
    setLocalGridItems((prev) => [...prev, buildNewGridItem(prev)]);
  }

  function handleSave() {
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
            <PreviewHeader
              data-testid="popup-layout-editor-preview-header"
              aria-hidden="true"
            >
              <span>Popup header (preview)</span>
              <PreviewHeaderClose>×</PreviewHeaderClose>
            </PreviewHeader>
            <PreviewBodyArea
              data-testid="popup-layout-editor-preview-body"
              data-grid-height={gridAreaHeight}
            >
              <GridContainer aria-label="Popup Layout Grid Container">
                <TabContext.Provider value={tabContextValue}>
                  <EditingContext.Provider value={editingContextValue}>
                    <DisabledEditingMovementContext.Provider
                      value={disabledEditingMovementContextValue}
                    >
                      {/*
                        Editor uses non-responsive DashboardLayout so RGL
                        always works in the canonical 100-col coordinate
                        space (matches the runtime's lg layout). At narrow
                        preview widths the responsive grid would emit edits
                        in the current breakpoint's column system (4-col
                        xs, 12-col sm, etc.); persisting those straight
                        back into the lg layout produced "ghost reverts"
                        — a w=3 xs edit became a 3%-wide lg tile. The
                        runtime PopupModalChrome stays responsive so the
                        viewer's narrow viewports collapse correctly; the
                        editor just edits the canonical lg layout.
                      */}
                      <DashboardLayout
                        tabId="popup"
                        gridItems={localGridItems}
                        shouldLoad={true}
                        rowHeight={rowHeight}
                        allowOverlap={false}
                      />
                    </DisabledEditingMovementContext.Provider>
                  </EditingContext.Provider>
                </TabContext.Provider>
              </GridContainer>
            </PreviewBodyArea>
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
  layerName: PropTypes.string,
};

PopupLayoutEditor.defaultProps = {
  popupConfig: null,
  layerName: null,
};

export default PopupLayoutEditor;
