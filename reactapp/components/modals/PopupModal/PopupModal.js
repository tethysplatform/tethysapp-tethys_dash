import { useEffect, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import ReactDOM from "react-dom";
import styled from "styled-components";
import { FaTimes } from "react-icons/fa";

const POPUP_Z_INDEX = 1055;
const SMALL_VIEWPORT_BREAKPOINT = 768;

const DEFAULT_POSITION = {
  leftPct: 20,
  topPct: 20,
  widthPct: 60,
  heightPct: 60,
};

// Minimum hit target per WCAG 2.5.5.
const MIN_TOUCH_TARGET_PX = 44;

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

function computePositionStyle({ position, isSmallViewport }) {
  if (isSmallViewport) {
    return {
      top: "1rem",
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

  return {
    left: `${leftPct}vw`,
    top: `${topPct}vh`,
    width: `${widthPct}vw`,
    height: `${heightPct}vh`,
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

  // Track viewport size for R9 fallback.
  useEffect(() => trackSmallViewport(setIsSmallViewport), []);

  useEffect(() => {
    if (show) {
      // Defer focus so the portal node is mounted in the DOM.
      const node = containerRef.current;
      if (node) {
        node.focus();
      }
    } else if (triggerRef && triggerRef.current) {
      triggerRef.current.focus();
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
    position,
    isSmallViewport,
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
      <ModalHeader data-testid="popup-modal-header">
        <LeadingSlot data-testid="popup-modal-header-leading">
          {leadingControls}
        </LeadingSlot>
        <TitleSlot data-testid="popup-modal-header-title-slot">{title}</TitleSlot>
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
