import { useEffect, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import ReactDOM from "react-dom";
import styled from "styled-components";
import { FaTimes } from "react-icons/fa";

// Under the fixed header (1030), so the header and the menus it opens - the
// image export among them - stay usable while a popup is open. Above
// everything inside the dashboard, whose map controls sit at 1000.
const POPUP_Z_INDEX = 1025;
const SMALL_VIEWPORT_BREAKPOINT = 768;
// Inset of the small-viewport fallback from the content area's edges (1rem).
const SMALL_VIEWPORT_INSET_PX = 16;

const DEFAULT_POSITION = {
  leftPct: 20,
  topPct: 20,
  widthPct: 60,
  heightPct: 60,
};

// Minimum hit target per WCAG 2.5.5.
const MIN_TOUCH_TARGET_PX = 44;

// The smallest a popup can be dragged to, so it never collapses past use.
export const MIN_POPUP_WIDTH_PX = 320;
export const MIN_POPUP_HEIGHT_PX = 200;

// The edges and corners a popup is resized from, by compass point.
const RESIZE_EDGES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
const RESIZE_CURSORS = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};
const EDGE_PX = 6;
const CORNER_PX = 14;

const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

/* The popup's rect after a drag of (dx, dy) from `start`: the whole popup
   for "move", one edge or corner ("n", "se", ...) otherwise. Rects are
   {left, top, right, bottom} in pixels. The popup stays inside `area` - the
   window below the header - and no smaller than the minimum size. */
export function draggedRect(start, edge, dx, dy, area) {
  if (edge === "move") {
    const width = start.right - start.left;
    const height = start.bottom - start.top;
    const left = clamp(start.left + dx, area.left, area.right - width);
    const top = clamp(start.top + dy, area.top, area.bottom - height);
    return { left, top, right: left + width, bottom: top + height };
  }
  let { left, top, right, bottom } = start;
  if (edge.includes("w")) {
    left = clamp(start.left + dx, area.left, right - MIN_POPUP_WIDTH_PX);
  }
  if (edge.includes("e")) {
    right = clamp(start.right + dx, left + MIN_POPUP_WIDTH_PX, area.right);
  }
  if (edge.includes("n")) {
    top = clamp(start.top + dy, area.top, bottom - MIN_POPUP_HEIGHT_PX);
  }
  if (edge.includes("s")) {
    bottom = clamp(start.bottom + dy, top + MIN_POPUP_HEIGHT_PX, area.bottom);
  }
  return { left, top, right, bottom };
}

/* A rect as a popup position: percentages of the window's width and of the
   content area below the header, the form computePositionStyle reads, so a
   dragged popup still scales with the window as a configured one does. */
export function rectToPosition(
  rect,
  { viewportWidth, viewportHeight, headerHeight },
) {
  const contentHeight = Math.max(1, viewportHeight - headerHeight);
  return {
    leftPct: (rect.left / viewportWidth) * 100,
    widthPct: ((rect.right - rect.left) / viewportWidth) * 100,
    topPct: ((rect.top - headerHeight) / contentHeight) * 100,
    heightPct: ((rect.bottom - rect.top) / contentHeight) * 100,
  };
}

const ModalContainer = styled.div`
  position: fixed;
  display: flex;
  flex-direction: column;
  background-color: white;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  outline: none;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
  gap: 0.5rem;
`;

// Auto-width slot on the left for optional navigation controls (e.g., the
// multi-feature carousel's prev/next arrows). Renders nothing when no
// controls are supplied.
const LeadingSlot = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  min-width: 0;
`;

// Flexible middle slot. text-align:center keeps the title visually balanced
// between the leading controls and the close button. min-width:0 + the
// ellipsis styles together guarantee long titles truncate instead of
// overlapping the arrows on the left or the close button on the right.
const TitleSlot = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CloseButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: #333;
  padding: 0;
  flex-shrink: 0;

  &:hover {
    background-color: rgba(0, 0, 0, 0.06);
  }

  &:focus-visible {
    outline: 2px solid #2684ff;
    outline-offset: 2px;
  }
`;

// The thin strip along an edge, or the square at a corner, that a resize
// starts from. Inside the popup, whose overflow would clip anything outside.
function handleStyle(edge) {
  const style = {
    position: "absolute",
    zIndex: 2,
    cursor: RESIZE_CURSORS[edge],
    touchAction: "none",
  };
  const vertical = edge.includes("n")
    ? "top"
    : edge.includes("s")
      ? "bottom"
      : null;
  const horizontal = edge.includes("w")
    ? "left"
    : edge.includes("e")
      ? "right"
      : null;
  if (vertical && horizontal) {
    return {
      ...style,
      [vertical]: 0,
      [horizontal]: 0,
      width: CORNER_PX,
      height: CORNER_PX,
    };
  }
  if (vertical) {
    return {
      ...style,
      [vertical]: 0,
      left: CORNER_PX,
      right: CORNER_PX,
      height: EDGE_PX,
    };
  }
  return {
    ...style,
    [horizontal]: 0,
    top: CORNER_PX,
    bottom: CORNER_PX,
    width: EDGE_PX,
  };
}

const ModalBody = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  /* display:flex is required so PopupModalChrome's <Body> can flex-fill
     this region. Without it the body falls back to height:auto, which
     makes the popup's GridContainer measure RGL's own content height
     (self-referential) instead of the modal body height — pinning
     rowHeight at DEFAULT_ROW_HEIGHT and leaving a large empty gap below
     the visualization. */
  display: flex;
  flex-direction: column;
  overflow: auto;
  padding: 0.75rem;
`;

export function readHeaderHeight() {
  if (typeof window === "undefined") return 0;
  const parsed = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(
      "--ts-header-height",
    ),
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

/* The vertical percentages measure the content area below the fixed header,
   not the whole window, so a popup never covers the header - and the image
   export button in it. Horizontal ones still measure the window's width, which
   the header does not take from. Pixels rather than calc(), so the position
   reads back from the inline style in tests as it does in the browser. */
export function computePositionStyle({
  position,
  isSmallViewport,
  viewportHeight,
  headerHeight = 0,
}) {
  if (isSmallViewport) {
    return {
      top: `${headerHeight + SMALL_VIEWPORT_INSET_PX}px`,
      left: "1rem",
      right: "1rem",
      bottom: "1rem",
      width: "auto",
      height: "auto",
    };
  }

  const leftPct = position?.leftPct ?? DEFAULT_POSITION.leftPct;
  const topPct = position?.topPct ?? DEFAULT_POSITION.topPct;
  const widthPct = position?.widthPct ?? DEFAULT_POSITION.widthPct;
  const heightPct = position?.heightPct ?? DEFAULT_POSITION.heightPct;
  const contentHeight = Math.max(0, viewportHeight - headerHeight);

  return {
    left: `${leftPct}vw`,
    top: `${Math.round(headerHeight + (contentHeight * topPct) / 100)}px`,
    width: `${widthPct}vw`,
    height: `${Math.round((contentHeight * heightPct) / 100)}px`,
  };
}

export function isEditableTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  const ceAttr = el.getAttribute && el.getAttribute("contenteditable");
  if (ceAttr === "" || ceAttr === "true" || ceAttr === "plaintext-only") {
    return true;
  }
  return false;
}

export function getInitialViewportHeight() {
  if (typeof window === "undefined") return 0;
  return window.innerHeight;
}

export function getInitialIsSmallViewport() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < SMALL_VIEWPORT_BREAKPOINT;
}

export function trackSmallViewport(setIsSmallViewport) {
  if (typeof window === "undefined") return undefined;
  const handleResize = () => {
    setIsSmallViewport(window.innerWidth < SMALL_VIEWPORT_BREAKPOINT);
  };
  handleResize();
  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
}

function PopupModal({
  show,
  onClose,
  position,
  title,
  leadingControls,
  ariaLabelledBy,
  triggerRef,
  children,
}) {
  const containerRef = useRef(null);
  const [isSmallViewport, setIsSmallViewport] = useState(
    getInitialIsSmallViewport,
  );
  const [viewportHeight, setViewportHeight] = useState(
    getInitialViewportHeight,
  );
  // Where the popup was dragged to, moved or resized, as a position. It
  // stands in for every popup this map shows from then on -- other features,
  // other layers, a popup closed and reopened -- until the page reloads; it
  // is never saved into the dashboard.
  const [draggedPosition, setDraggedPosition] = useState(null);
  const endDragRef = useRef(null);
  useEffect(() => () => endDragRef.current?.(), []);

  const startDrag = useCallback((edge, event) => {
    if (event.button !== 0) return;
    // The header's own controls -- the carousel, the close button -- are
    // pressed, not dragged.
    if (
      edge === "move" &&
      event.target.closest?.(
        "button, a, input, select, textarea, [role=button]",
      )
    ) {
      return;
    }
    event.preventDefault();
    const { left, top, right, bottom } =
      containerRef.current.getBoundingClientRect();
    const start = { left, top, right, bottom };
    const headerHeight = readHeaderHeight();
    const area = {
      left: 0,
      top: headerHeight,
      right: window.innerWidth,
      bottom: window.innerHeight,
    };
    const { clientX, clientY } = event;
    // A drag still live -- a second finger, or a release the window never
    // saw -- is ended first, so the selection style saved here is the page's
    // own and not that drag's "none".
    endDragRef.current?.();
    const userSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    // On the window, so a plot under the pointer cannot take the drag.
    const onMove = (moveEvent) => {
      const rect = draggedRect(
        start,
        edge,
        moveEvent.clientX - clientX,
        moveEvent.clientY - clientY,
        area,
      );
      setDraggedPosition(
        rectToPosition(rect, {
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          headerHeight,
        }),
      );
    };
    const endDrag = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      document.body.style.userSelect = userSelect;
      endDragRef.current = null;
    };
    endDragRef.current = endDrag;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  }, []);

  // Track viewport size for R9 fallback.
  useEffect(() => trackSmallViewport(setIsSmallViewport), []);

  // The vertical position is in pixels of the content area, so it follows the
  // window's height.
  useEffect(() => {
    const handleResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Focus goes back to the trigger only when the modal actually closes, not
  // when it mounts already closed. Every map on a dashboard mounts one, and
  // each handing focus to its map scrolled the page down to the last of them.
  const wasShownRef = useRef(false);

  useEffect(() => {
    if (show) {
      wasShownRef.current = true;
      // Defer focus so the portal node is mounted in the DOM.
      const node = containerRef.current;
      if (node) {
        node.focus();
      }
    } else if (wasShownRef.current) {
      wasShownRef.current = false;
      triggerRef?.current?.focus();
    }
  }, [show, triggerRef]);

  // Esc closes — unless focus is inside an editable element (R14, R30).
  const handleKeyDown = useCallback(
    (event) => {
      if (event.key !== "Escape") return;
      if (isEditableTarget(event.target)) return;
      event.stopPropagation();
      onClose?.();
    },
    [onClose],
  );

  if (!show) return null;

  const positionStyle = computePositionStyle({
    position: draggedPosition ?? position,
    isSmallViewport,
    viewportHeight,
    headerHeight: readHeaderHeight(),
  });

  const containerStyle = {
    ...positionStyle,
    zIndex: POPUP_Z_INDEX,
  };

  const closeButtonStyle = {
    minWidth: `${MIN_TOUCH_TARGET_PX}px`,
    minHeight: `${MIN_TOUCH_TARGET_PX}px`,
  };

  const content = (
    <ModalContainer
      ref={containerRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabelledBy ? undefined : "Popup Modal"}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={containerStyle}
      data-testid="popup-modal"
    >
      {/* A small screen's popup fills it, with nothing to drag. */}
      {!isSmallViewport &&
        RESIZE_EDGES.map((edge) => (
          <div
            key={edge}
            aria-hidden="true"
            data-testid={`popup-modal-resize-${edge}`}
            style={handleStyle(edge)}
            onPointerDown={(event) => startDrag(edge, event)}
          />
        ))}
      <ModalHeader
        data-testid="popup-modal-header"
        style={
          isSmallViewport ? undefined : { cursor: "move", touchAction: "none" }
        }
        onPointerDown={
          isSmallViewport ? undefined : (event) => startDrag("move", event)
        }
      >
        <LeadingSlot data-testid="popup-modal-header-leading">
          {leadingControls}
        </LeadingSlot>
        <TitleSlot data-testid="popup-modal-header-title-slot">
          {title}
        </TitleSlot>
        <CloseButton
          type="button"
          onClick={onClose}
          aria-label="Close popup"
          style={closeButtonStyle}
          data-testid="popup-modal-close"
        >
          <FaTimes aria-hidden="true" />
        </CloseButton>
      </ModalHeader>
      <ModalBody>{children}</ModalBody>
    </ModalContainer>
  );

  return ReactDOM.createPortal(content, document.body);
}

PopupModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  position: PropTypes.shape({
    leftPct: PropTypes.number,
    topPct: PropTypes.number,
    widthPct: PropTypes.number,
    heightPct: PropTypes.number,
  }),
  title: PropTypes.node,
  // Optional left-side header content (e.g., the multi-feature carousel's
  // prev/next arrows). Renders to an empty slot when omitted.
  leadingControls: PropTypes.node,
  ariaLabelledBy: PropTypes.string,
  triggerRef: PropTypes.shape({
    // eslint-disable-next-line react/forbid-prop-types
    current: PropTypes.any,
  }),
  children: PropTypes.node,
};

PopupModal.defaultProps = {
  position: { ...DEFAULT_POSITION },
  title: null,
  leadingControls: null,
  ariaLabelledBy: undefined,
  triggerRef: null,
  children: null,
};

export default PopupModal;
