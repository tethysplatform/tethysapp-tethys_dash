import { useRef } from "react";
import VectorSource from "ol/source/Vector";
import {
  createSnapLayer,
  addSnapPreview,
  fetchLayerVectorFeatures,
  findBestSnap,
} from "components/map/snapping";

// --- Feature snapping (Approach A) -------------------------------------
// Maintain a hidden vector cache of snap-enabled layers' features for the
// current view, snap the cursor to the nearest one on hover, and on a snapped
// click select the river directly from that local feature (no ESRI /identify,
// which is slow on a cache miss and sometimes returns empty on-geometry).
export const SNAP_PIXELS = 15;
// Wider radius (mirrors the old /identify tolerance) for gathering the
// connected reaches at a confluence into the click popup's swiper.
export const GATHER_PIXELS = 35;

// Live OL-layer visibility keyed by layer name — built fresh per call because
// LayersControl mutates visibility directly on the OL layer without any React
// state change this hook could subscribe to.
const getOlVisibilityMap = (map) => {
  const olVisibility = new Map();
  map
    .getLayers()
    .getArray()
    .forEach((olLayer) => {
      const name = olLayer.get("name");
      if (name) olVisibility.set(name, olLayer.getVisible());
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
          if (
            sourceType === "GeoJSON" ||
            sourceType === "ESRI Feature Service"
          ) {
            // Live source, not a snapshot: these layers' features already
            // live in an OL VectorSource in the browser, so the cache entry
            // IS that source — no fetch, no new VectorSource. This means the
            // snap set always equals the rendered set (strictly better than
            // the fetch path's approximation); features streaming in via the
            // source's loading strategy become snappable as they load, with
            // no moveend dependency; and the generation token above is
            // irrelevant for these entries since there's nothing async to
            // discard — they resolve synchronously below. Rebuilt every
            // refresh so a layer rebuild re-resolves the OL instance.
            const olLayer = getOlLayerByName(map, layerName);
            const source = olLayer?.getSource?.();
            // Unresolved OL instance (mid-rebuild) or a missing source:
            // contribute nothing this cycle rather than throw — the next
            // refresh picks it up.
            return source ? { layerName, source } : null;
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
    return snapCachesRef.current.filter(
      // Entries with no matching OL layer are retained on purpose: mid-rebuild
      // the layer may not be mounted yet (matches refreshSnapCaches'
      // benefit-of-the-doubt filter).
      (cache) =>
        !olVisibility.has(cache.layerName) ||
        olVisibility.get(cache.layerName) === true,
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
