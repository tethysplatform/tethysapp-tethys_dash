import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import styled from "styled-components";

/**
 * Lift a map control out of the map tile so it can paint above other grid items.
 *
 * A fill-viewport grid item is `position: fixed`, which creates a stacking
 * context even at `z-index: auto`. Everything inside it is sealed in: the
 * legend, layer control and error alert all set `z-index: 1000`, but inside a
 * stacking context that only orders them against each other, never against
 * another grid item. No descendant z-index can escape a stacking context, so the
 * control has to leave the tile in the DOM.
 *
 * The alternative -- raising the whole tile while a control is open -- works but
 * the map is opaque, so every overlapping grid item disappears for as long as
 * the control is open. Floating only the control keeps both visible.
 *
 * An anchor element stays behind, carrying the caller's original positioning CSS
 * so the offsets are not duplicated here, and the floated copy is pinned to
 * whatever rectangle that anchor occupies.
 *
 * This mirrors PopupModal, the app's other portal: createPortal into
 * document.body, `position: fixed`. Deliberately not react-bootstrap Overlay --
 * that is for a popover anchored to a trigger, and its popper flip/shift would
 * move a control that must stay pinned to a map corner.
 */

// Above grid items and Bootstrap dropdowns (1000), below $zindex-fixed (1030),
// $zindex-modal-backdrop (1050) and $zindex-modal (1055) as configured here, so
// the fixed header and any modal still cover it.
export const FLOATING_CONTROL_Z_INDEX = 1029;

const Anchor = styled.div`
  /* Occupies the position the control would have had. Never interactive: the
     real control is the floated copy. */
  pointer-events: none;
`;

const Floating = styled.div`
  position: fixed;
  z-index: ${FLOATING_CONTROL_Z_INDEX};
`;

/**
 * Turn the anchor's rectangle into fixed-position styles.
 *
 * Only the pinned edges carry meaning. Once the content is portalled away the
 * anchor collapses, so an anchor pinned bottom-left is a zero-size point whose
 * `left`/`bottom` are the corner the control should sit in -- its `right` and
 * `top` are the same point and say nothing about the control's size.
 */
export function styleFromAnchor(rect, edges, viewport) {
  if (!rect) return null;
  const style = {};
  if (edges.includes("left")) style.left = `${rect.left}px`;
  if (edges.includes("right")) style.right = `${viewport.width - rect.right}px`;
  if (edges.includes("top")) style.top = `${rect.top}px`;
  if (edges.includes("bottom")) {
    style.bottom = `${viewport.height - rect.bottom}px`;
  }
  // Pinned on both sides: the anchor spans a real width, so carry it across
  // rather than letting the floated copy shrink to its content.
  if (edges.includes("left") && edges.includes("right")) {
    style.width = `${rect.width}px`;
    delete style.right;
  }
  return style;
}

const FloatingMapControl = ({ edges, className, children, ...rest }) => {
  const anchorRef = useRef(null);
  const [style, setStyle] = useState(null);

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    setStyle(
      styleFromAnchor(anchor.getBoundingClientRect(), edges, {
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    );
    // edges is a literal array at every call site, so compare by value rather
    // than identity or this recreates on every render.
  }, [edges.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Layout effect so the first paint of the floated copy is already positioned,
  // rather than flashing at the top-left corner.
  useLayoutEffect(() => {
    reposition();
  }, [reposition, children]);

  useEffect(() => {
    window.addEventListener("resize", reposition);
    // Capture phase: a non-fill map scrolls with the grid, and the scroll may
    // happen on an ancestor rather than the window.
    window.addEventListener("scroll", reposition, true);

    // Track the tile itself being moved or resized, which happens while editing
    // the dashboard layout.
    let observer;
    const observed = anchorRef.current?.offsetParent;
    if (observed && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(reposition);
      observer.observe(observed);
    }

    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      observer?.disconnect();
    };
  }, [reposition]);

  return (
    <>
      <Anchor
        ref={anchorRef}
        className={className}
        aria-hidden="true"
        data-testid="floating-map-control-anchor"
      />
      {style &&
        ReactDOM.createPortal(
          <Floating style={style} data-testid="floating-map-control" {...rest}>
            {children}
          </Floating>,
          document.body,
        )}
    </>
  );
};

FloatingMapControl.propTypes = {
  /** Which sides the anchor's CSS pins, e.g. ["bottom", "left"]. */
  edges: PropTypes.arrayOf(PropTypes.oneOf(["top", "bottom", "left", "right"]))
    .isRequired,
  /** Applied to the anchor: this is where the caller's positioning CSS goes. */
  className: PropTypes.string,
  children: PropTypes.node,
};

export default FloatingMapControl;
