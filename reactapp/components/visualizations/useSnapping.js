import { useRef } from "react";
import VectorSource from "ol/source/Vector";
import { inView } from "ol/layer/Layer";
import {
  createSnapLayer,
  addSnapPreview,
  fetchLayerVectorFeatures,
  findBestSnap,
} from "components/map/snapping";
import { CLIENT_VECTOR_SOURCE_TYPES } from "components/map/utilities";

// --- Feature snapping (Approach A) -------------------------------------
// Maintain a hidden vector cache of snap-enabled layers' features for the
// current view, snap the cursor to the nearest one on hover, and on a snapped
// click select the river directly from that local feature (no ESRI /identify,
// which is slow on a cache miss and sometimes returns empty on-geometry).
export const SNAP_PIXELS = 15;
// Wider radius (mirrors the old /identify tolerance) for gathering the
// connected reaches at a confluence into the click popup's swiper.
export const GATHER_PIXELS = 35;

// Effective per-layer visibility: the renderer's own test (visible flag plus
// the layer's min/max zoom and resolution bounds) via ol's `inView` —
// `getVisible()` alone reports true for layers the view has zoomed out of.
// Falls back to the plain flag for layer objects without OL layer state.
const isLayerShown = (olLayer, viewState) =>
  viewState && olLayer.getLayerState
    ? inView(olLayer.getLayerState(), viewState)
    : olLayer.getVisible();

// Live OL-layer visibility keyed by layer name — built fresh per call because
// LayersControl mutates visibility directly on the OL layer without any React
// state change this hook could subscribe to.
const getOlVisibilityMap = (map) => {
  const olVisibility = new Map();
  const viewState = map.getView().getState?.();
  map
    .getLayers()
    .getArray()
    .forEach((olLayer) => {
      const name = olLayer.get("name");
      if (name) olVisibility.set(name, isLayerShown(olLayer, viewState));
    });
  return olVisibility;
};

// Resolve a live OL layer instance by its configured `name` — same lookup
// convention as getOlVisibilityMap. Returns undefined when no OL layer with
// that name is currently mounted (e.g. mid-rebuild).
const getOlLayerByName = (map, name) =>
  map
    .getLayers()
    .getArray()
    .find((olLayer) => olLayer.get("name") === name);

export default function useSnapping({ layers }) {
  const snapLayer = useRef(null);
  const snapCachesRef = useRef([]);
  const snapRefreshId = useRef(0);

  const ensureSnapLayer = (map) => {
    if (!snapLayer.current) {
      snapLayer.current = createSnapLayer();
      map.addLayer(snapLayer.current);
    } else if (!map.getLayers().getArray().includes(snapLayer.current)) {
      // The layer-reconciliation sweep in map/Map.js removes OL layers absent
      // from the configured list, so any layer-config rebuild detaches the
      // preview while this ref still holds it — re-attach rather than leak it.
      map.addLayer(snapLayer.current);
    }
    return snapLayer.current;
  };

  // Clears the snap preview and resets the pointer-cursor affordance — the one
  // place snap visual state is torn down, so no clear path can leak the cursor.
  const clearSnap = (map) => {
    snapLayer.current?.getSource().clear();
    const targetEl = map?.getTargetElement?.();
    if (targetEl) targetEl.style.cursor = "";
  };

  // Clears only the preview features, leaving the cursor untouched — used by
  // the click path, which takes over the selection highlight from the hover
  // preview without resetting the pointer affordance mid-click.
  const clearSnapPreview = () => {
    snapLayer.current?.getSource().clear();
  };

  // moveend handler: rebuild the vector cache for visible snap-enabled layers
  // that are zoomed to their query level. Below that zoom snapping is off and
  // the first click still auto-zooms via queryLayerFeatures.
  const refreshSnapCaches = async (map) => {
    // Generation token: a slower fetch from an earlier view must not overwrite
    // a newer one (moveend can fire again before the async /query resolves).
    const refreshId = (snapRefreshId.current += 1);
    const olVisibility = getOlVisibilityMap(map);
    const zoom = map.getView().getZoom();
    const snapLayers = layers.filter((item) => {
      if (!item.configuration?.props?.snapToFeatures) return false;
      const name = item.configuration?.props?.name;
      if (name && olVisibility.has(name) && olVisibility.get(name) !== true) {
        return false;
      }
      const minZoom = parseFloat(item.configuration.props.minZoomQuery ?? 0);
      return zoom >= minZoom;
    });
    if (snapLayers.length === 0) {
      snapCachesRef.current = [];
      clearSnap(map);
      return;
    }
    const caches = (
      await Promise.all(
        snapLayers.map(async (layer) => {
          const layerName = layer.configuration.props.name;
          const sourceType = layer.configuration?.props?.source?.type;
          if (CLIENT_VECTOR_SOURCE_TYPES.includes(sourceType)) {
            // Live source, not a snapshot: these layers' features already
            // live in an OL VectorSource in the browser, so no fetch and no
            // new VectorSource — the snap set always equals the rendered set
            // (strictly better than the fetch path's approximation), and
            // features streaming in via the source's loading strategy become
            // snappable as they load, with no moveend dependency. The entry
            // is only a marker; the OL source is resolved at USE time
            // (visibleSnapCaches) because (a) the reconciliation sweep in
            // map/Map.js rebuilds VectorLayers on any layers change, so a
            // reference captured here goes stale until the next moveend, and
            // (b) use-time resolution also covers snap layers that mount
            // after the one-shot prime. Nothing async here, so the
            // generation token above is irrelevant for these entries.
            return { layerName, live: true };
          }
          const source = new VectorSource();
          source.addFeatures(await fetchLayerVectorFeatures(layer, map));
          return { layerName, source };
        }),
      )
    ).filter(Boolean);
    // Discard if a newer refresh started while this one was in flight.
    if (refreshId === snapRefreshId.current) {
      snapCachesRef.current = caches;
    }
  };

  // LayersControl toggles `olLayer.setVisible(...)` without firing moveend, so
  // the cache can still hold features for a layer the user just hid. Filter
  // against live OL visibility at use time instead of event-wiring the control.
  const visibleSnapCaches = (map) => {
    const olVisibility = getOlVisibilityMap(map);
    // snapCachesRef.current is initialized to [] and only ever assigned arrays.
    return (
      snapCachesRef.current
        .filter(
          // Entries with no matching OL layer pass the visibility check on
          // purpose: mid-rebuild the layer may not be mounted yet (matches
          // refreshSnapCaches' benefit-of-the-doubt filter).
          (cache) =>
            !olVisibility.has(cache.layerName) ||
            olVisibility.get(cache.layerName) === true,
        )
        // Live entries resolve their OL source at use time so snapping always
        // targets the currently-mounted VectorSource (the reconciliation
        // sweep rebuilds VectorLayers on any layers change). When the OL
        // layer/source isn't currently resolvable (mid-rebuild), the entry is
        // dropped for this call — there is nothing to snap against — and the
        // next call re-resolves it.
        .map((cache) => {
          if (!cache.live) return cache;
          const source = getOlLayerByName(map, cache.layerName)?.getSource?.();
          return source ? { layerName: cache.layerName, source } : null;
        })
        .filter(Boolean)
    );
  };

  // pointermove handler (synchronous, immediate so the highlight tracks the
  // cursor): draw the snap preview + pointer cursor for the nearest feature.
  // The click recomputes its own snap from the click coordinate, so this only
  // drives the hover visual — it deliberately keeps no state the click reads.
  const updateSnap = (map, coordinate) => {
    const caches = visibleSnapCaches(map);
    const best = caches.length
      ? findBestSnap(caches, coordinate, map, SNAP_PIXELS)
      : null;
    if (!best) {
      clearSnap(map);
      return;
    }
    // Affordance: pointer cursor when a click would select a snapped river.
    const targetEl = map.getTargetElement?.();
    if (targetEl) targetEl.style.cursor = "pointer";
    addSnapPreview(ensureSnapLayer(map), best.feature, best.coordinate);
  };

  return {
    refreshSnapCaches,
    updateSnap,
    visibleSnapCaches,
    clearSnapPreview,
  };
}
