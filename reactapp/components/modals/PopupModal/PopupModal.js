import { useEffect, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import ReactDOM from "react-dom";
import styled from "styled-components";
import { FaTimes } from "react-icons/fa";

// Bootstrap-modal z-index is 1050; sit just above so we render over any
// open react-bootstrap modal but stay below toasts (1080).
const POPUP_Z_INDEX = 1055;

// Below this viewport width we ignore anchor/size and render near-fullscreen
// (R9 small-viewport fallback).
const SMALL_VIEWPORT_BREAKPOINT = 768;

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
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
  gap: 0.5rem;
`;

const TitleSlot = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
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
  overflow: auto;
  padding: 0.75rem;
`;

/**
 * Compute the inline style (position + size) for the modal container based on
 * anchor + size + small-viewport state. Returns a style object suitable for
 * the `style` prop.
 */
function computePositionStyle({ anchor, size, isSmallViewport }) {
  if (isSmallViewport) {
    // Near-fullscreen with a small inset so the modal doesn't visually
    // bleed to viewport edges.
    return {
      top: "1rem",
      left: "1rem",
      right: "1rem",
      bottom: "1rem",
      width: "auto",
      height: "auto",
    };
  }

  const widthPct = size?.widthPct ?? 60;
  const heightPct = size?.heightPct ?? 60;
  const offsetX = anchor?.offsetX ?? 0;
  const offsetY = anchor?.offsetY ?? 0;
  const name = anchor?.name ?? "center";

  const width = `${widthPct}vw`;
  const height = `${heightPct}vh`;

  switch (name) {
    case "top-left":
      return {
        top: `${offsetY}px`,
        left: `${offsetX}px`,
        width,
        height,
      };
    case "top-right":
      return {
        top: `${offsetY}px`,
        right: `${offsetX}px`,
        width,
        height,
      };
    case "bottom-left":
      return {
        bottom: `${offsetY}px`,
        left: `${offsetX}px`,
        width,
        height,
      };
    case "bottom-right":
      return {
        bottom: `${offsetY}px`,
        right: `${offsetX}px`,
        width,
        height,
      };
    case "center":
    default:
      // Translate to true center; offsets shift from center.
      return {
        top: `calc(50% + ${offsetY}px)`,
        left: `calc(50% + ${offsetX}px)`,
        width,
        height,
        transform: "translate(-50%, -50%)",
      };
  }
}

function isEditableTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  // Prefer the live `isContentEditable` getter where it exists (in real
  // browsers it walks the inheritance chain). Fall back to the
  // `contenteditable` attribute for environments — including jsdom — where
  // the live getter isn't fully implemented.
  if (el.isContentEditable) return true;
  const ceAttr = el.getAttribute && el.getAttribute("contenteditable");
  if (ceAttr === "" || ceAttr === "true" || ceAttr === "plaintext-only") {
    return true;
  }
  return false;
}

/**
 * `PopupModal` — a custom positioned overlay rendered into `document.body` via
 * a portal. Designed for the modal-mode map feature popup.
 *
 * Differences from `react-bootstrap/Modal`:
 *   - No backdrop element (the underlying map stays interactive — R15).
 *   - `aria-modal="false"` and no focus trap (R27).
 *   - Anchored sizing via viewport percentages and named anchors (R7, R8).
 *   - Esc-to-close, but no click-outside-to-close (R14).
 *   - Below 768px viewport width, ignores anchor/size and renders
 *     near-fullscreen (R9).
 */
function PopupModal({
  show,
  onClose,
  anchor,
  size,
  title,
  ariaLabelledBy,
  triggerRef,
  children,
}) {
  const containerRef = useRef(null);
  const [isSmallViewport, setIsSmallViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < SMALL_VIEWPORT_BREAKPOINT;
  });

  // Track viewport size for R9 fallback.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => {
      setIsSmallViewport(window.innerWidth < SMALL_VIEWPORT_BREAKPOINT);
    };
    // Sync once in case the initial state was computed before mount.
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Focus management: on open, focus the modal container. On close,
  // restore focus to the trigger element if provided (R28).
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
    anchor,
    size,
    isSmallViewport,
  });

  const containerStyle = {
    ...positionStyle,
    zIndex: POPUP_Z_INDEX,
  };

  // Inline min-width/min-height on the X button so the WCAG 2.5.5 hit-target
  // assertion is observable via getComputedStyle in jsdom (styled-components'
  // generated stylesheet isn't parsed by jsdom).
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
        <TitleSlot>{title}</TitleSlot>
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
  anchor: PropTypes.shape({
    name: PropTypes.oneOf([
      "center",
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
    ]),
    offsetX: PropTypes.number,
    offsetY: PropTypes.number,
  }),
  size: PropTypes.shape({
    widthPct: PropTypes.number,
    heightPct: PropTypes.number,
  }),
  title: PropTypes.node,
  ariaLabelledBy: PropTypes.string,
  triggerRef: PropTypes.shape({
    // eslint-disable-next-line react/forbid-prop-types
    current: PropTypes.any,
  }),
  children: PropTypes.node,
};

PopupModal.defaultProps = {
  anchor: { name: "center" },
  size: { widthPct: 60, heightPct: 60 },
  title: null,
  ariaLabelledBy: undefined,
  triggerRef: null,
  children: null,
};

export default PopupModal;
