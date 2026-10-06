import { createContext, useContext, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

/**
 * A map control that knows how tall its map is.
 *
 * It renders where it is written, inside the map div, and that is the whole
 * point: the map div is an isolated stacking context, so a control's z-index
 * orders it against the map and the other controls and never against another
 * grid item. A tile an author sends to the front covers the map and its
 * controls together, which is what "in front" has to mean.
 *
 * This used to portal the control out to document.body so it could paint above
 * every tile. That was the opposite rule, and it made a map's legend the one
 * thing on the board that ignored the order an author set. A fill-viewport tile
 * is `position: fixed` and so a stacking context of its own, which is what made
 * portalling look necessary -- but being sealed into your own tile is the
 * behaviour, not the problem.
 *
 * What remains here is the map-height measurement: a control sizes itself
 * against the map it belongs to, and only this component is positioned to
 * measure that and hand it down.
 */

/**
 * The map div's current height, in CSS pixels, or `null` when it has not been
 * measured. Provided by FloatingMapControl and read by its children, so a
 * control can size itself against the map it belongs to rather than against the
 * viewport. Measured rather than expressed in CSS because the control is not a
 * child of the element whose height it needs to follow.
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

// The collapsed controls render as a fixed-size square button. The expanded cap
// is floored here so a very short map can never shrink a control below its own
// toggle and leave it unopenable.
export const COLLAPSED_CONTROL_PX = 40;

// Three-quarters of the map, per the control-height spec.
const MAP_HEIGHT_FRACTION = 0.75;

// What the controls capped at before the map div was measurable. Still the
// fallback for the window where no measurement exists -- an inactive tab, a
// runtime that reports zero -- because it is the behavior users already had.
const UNMEASURED_MAX_HEIGHT = "35vh";

/**
 * The `max-height` a floating control should declare.
 *
 * Capped by the viewport as well as the map. A grid item can be taller than the
 * browser window, and the control is `position: fixed` and pinned to the map's
 * bottom edge -- so three-quarters of a very tall map would put the control's
 * top off-screen with no way to scroll to it. The old `35vh` cap was bounded by
 * the window for free; this one has to say so.
 *
 * @param {number|null} mapDivHeight measured map div height, or null.
 * @param {boolean} expanded whether the control is expanded.
 * @param {number} [viewportHeight] window height; omitted means no viewport cap.
 * @returns {string} a CSS length, or `none` while collapsed -- a collapsed
 *   control is a fixed-size button and capping it would clip the toggle.
 */
export function deriveControlMaxHeight(mapDivHeight, expanded, viewportHeight) {
  if (!expanded) return "none";
  if (mapDivHeight === null) return UNMEASURED_MAX_HEIGHT;
  const viewportCap = Number.isFinite(viewportHeight)
    ? viewportHeight * MAP_HEIGHT_FRACTION
    : Infinity;
  const capped = Math.round(
    Math.min(mapDivHeight * MAP_HEIGHT_FRACTION, viewportCap),
  );
  return `${Math.max(capped, COLLAPSED_CONTROL_PX)}px`;
}

/**
 * Render a control's styled container with a `$maxheight` sized to the map.
 *
 * Exists for two reasons. The container is a `styled.div` and cannot call a
 * hook; and the control itself renders FloatingMapControl as its CHILD, which
 * puts the control ABOVE the height provider, where `useMapDivHeight` would
 * always read null. This component sits below the provider, so it can read it.
 */
export const MapSizedControlContainer = ({
  container: Container,
  expanded,
  children,
  ...rest
}) => {
  const mapDivHeight = useMapDivHeight();
  // Own resize subscription: this component is passed as `children` to
  // FloatingMapControl, so FloatingMapControl re-rendering on resize does NOT
  // re-render it (React bails out on the stable children element). A render-time
  // window.innerHeight read would therefore go stale on a window resize that
  // doesn't also change the map-div height, leaving the viewport clamp wrong.
  const [viewportHeight, setViewportHeight] = useState(
    // istanbul ignore next -- window is always defined under jsdom; SSR guard.
    () => (typeof window === "undefined" ? undefined : window.innerHeight),
  );
  useEffect(() => {
    // istanbul ignore next -- SSR guard; jsdom always has window.
    if (typeof window === "undefined") return undefined;
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return (
    <Container
      $isexpanded={expanded}
      $maxheight={deriveControlMaxHeight(
        mapDivHeight,
        expanded,
        viewportHeight,
      )}
      {...rest}
    >
      {children}
    </Container>
  );
};

MapSizedControlContainer.propTypes = {
  /** The styled container to render. */
  container: PropTypes.elementType.isRequired,
  expanded: PropTypes.bool,
  children: PropTypes.node,
};

const FloatingMapControl = ({ className, mapDivRef, children, ...rest }) => {
  const hostRef = useRef(null);
  const [mapDivHeight, setMapDivHeight] = useState(null);

  // Deliberately a passive effect, not a layout effect. A parent host element's
  // ref is not attached yet when a child's layout effect runs, so `mapDivRef`
  // reads null there and the height would stay unmeasured forever. (The
  // measure-and-derive pattern in PopupModalChrome uses a layout effect safely
  // only because it measures its OWN element.)
  useEffect(() => {
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
    const observed = mapDivRef?.current ?? hostRef.current?.offsetParent;

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
      observer = new ResizeObserver(measure);
      observer.observe(observed);
    }
    // Seed from the current layout as well: a runtime without ResizeObserver
    // still gets one measurement, and an observer's first callback is async.
    measure();

    return () => observer?.disconnect();
  }, [mapDivRef]);

  return (
    <div
      ref={hostRef}
      className={className}
      data-testid="floating-map-control-inplace"
      {...rest}
    >
      <MapDivHeightContext.Provider value={mapDivHeight}>
        {children}
      </MapDivHeightContext.Provider>
    </div>
  );
};

FloatingMapControl.propTypes = {
  /** Where the caller's positioning CSS goes. */
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
