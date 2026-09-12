import {
  createContext,
  useCallback,
  useContext,
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

/**
 * The map div's current height, in CSS pixels, or `null` when it has not been
 * measured. Provided by FloatingMapControl and read by whatever it portals, so
 * a control can size itself against the map it belongs to rather than against
 * the viewport -- the portal means it has no CSS relationship to the map at all.
 */
const MapDivHeightContext = createContext(null);

/** @returns {number|null} the map div height, or null when unmeasured. */
export const useMapDivHeight = () => useContext(MapDivHeightContext);

/**
 * A measured height, or `null` when there is nothing usable to report.
 *
 * Zero is reported as unmeasured rather than as a real zero: a map on an
 * inactive dashboard tab is mounted but `display: none`, and a tile mid-drag
 * can measure zero too. Treating those as a real height would cap a control at
 * a fraction of zero and hide it outright. Any floor above zero belongs to the
 * consumer, which knows its own collapsed size.
 */
export function normalizeMeasuredHeight(height) {
  return Number.isFinite(height) && height > 0 ? height : null;
}

const FloatingMapControl = ({
  edges,
  className,
  mapDivRef,
  children,
  ...rest
}) => {
  const anchorRef = useRef(null);
  const [style, setStyle] = useState(null);
  const [mapDivHeight, setMapDivHeight] = useState(null);

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    // The resize observer below is created in a passive effect, so its cleanup
    // runs a phase later than the mutation phase in which React nulls this
    // ref -- and detaching the anchor is itself what resizes the offsetParent
    // being observed. A callback delivered in that window finds no anchor, and
    // has nothing left to position.
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

  // Deliberately a passive effect, not a layout effect. A parent host element's
  // ref is not attached yet when a child's layout effect runs, so `mapDivRef`
  // reads null there and the height would stay unmeasured forever. (The
  // measure-and-derive pattern in PopupModalChrome uses a layout effect safely
  // only because it measures its OWN element.)
  useEffect(() => {
    window.addEventListener("resize", reposition);
    // Capture phase: a non-fill map scrolls with the grid, and the scroll may
    // happen on an ancestor rather than the window.
    window.addEventListener("scroll", reposition, true);

    // Track the tile itself being moved or resized, which happens while editing
    // the dashboard layout.
    //
    // Prefer the caller's map div over `offsetParent`. `offsetParent` resolves
    // to the map div only because the default map style sets
    // `position: relative`, and a plugin-supplied `mapConfig.style` replaces
    // that default wholesale -- which would silently move the observed box to
    // an ancestor. It is also null for a map on an inactive tab, where the tile
    // is `display: none` at mount, so no observer would ever be attached.
    // Callers that pass no ref keep the old behavior exactly.
    const observed = mapDivRef?.current ?? anchorRef.current?.offsetParent;

    const measure = () => {
      if (!observed) return;
      setMapDivHeight((previous) => {
        const next = normalizeMeasuredHeight(
          observed.getBoundingClientRect().height,
        );
        // Equality guard: the observer fires on every frame of a tile drag, and
        // an unconditional set would re-render both controls each time.
        return next === previous ? previous : next;
      });
    };

    let observer;
    if (observed && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        reposition();
        measure();
      });
      observer.observe(observed);
    }
    // Seed from the current layout as well: a runtime without ResizeObserver
    // still gets one measurement, and an observer's first callback is async.
    measure();

    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      observer?.disconnect();
    };
  }, [reposition, mapDivRef]);

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
            <MapDivHeightContext.Provider value={mapDivHeight}>
              {children}
            </MapDivHeightContext.Provider>
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
  /**
   * The map div this control belongs to. Observed for size so children can read
   * its height via `useMapDivHeight`. Optional: without it the component falls
   * back to observing `offsetParent`, which is what it did before.
   */
  mapDivRef: PropTypes.shape({ current: PropTypes.any }),
  children: PropTypes.node,
};

export default FloatingMapControl;
