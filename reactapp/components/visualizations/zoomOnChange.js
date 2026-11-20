import { useCallback, useEffect, useRef } from "react";
import { updateObjectWithVariableInputs } from "components/visualizations/utilities";
import { valuesEqual } from "components/modals/utilities";
import { zoomToLayer } from "components/map/layerExtent";
import { ZOOM_ON_CHANGE_SOURCE_TYPES } from "components/map/utilities";

// zoomToLayerOnChange: a layer the author ticked fits the map to itself when
// the map first loads, and when a variable input changes what its data is
// loaded for. An edit, a newly added layer and a refresh never move the map.
// Dynamic plugin layers are decided in runtimeLayerFetcher.js, every other
// layer by useStaticLayerZoom below; both use the stamp and the size wait here.

// What the map's own extent variable resolves to in a stamp's key. The map
// republishes that variable after every settled move, so a fit would
// otherwise change the key, the reload would fit again, and so on.
const MASKED = "__tethysdash_masked_map_extent__";

/**
 * What a layer's data was loaded for, as zoomToLayerOnChange compares it.
 *
 * `raw` is the saved config the data comes from: a dynamic layer's plugin and
 * arguments, a static layer's source. `key` is that config with the variable
 * inputs filled in, though not quite as a request sees them. The map's own
 * extent variable is masked, so a fit never causes another. Dates are left
 * unformatted, so a layer bound to `now-1D` keeps one key while the moment it
 * resolves to moves with the clock, and a refresh never zooms.
 */
export function zoomStampFor(raw, variableInputValues, mapExtentVariable) {
  const values = variableInputValues ?? {};
  return {
    raw,
    key: updateObjectWithVariableInputs({
      args: raw,
      variableInputs: mapExtentVariable
        ? { ...values, [mapExtentVariable]: MASKED }
        : values,
    }),
  };
}

/**
 * Whether going from one stamp to the next is a variable input change: the
 * same saved config, filled in differently. An edit changes the saved config
 * and a refresh changes neither, so neither one is.
 */
export function isVariableChange(previous, next) {
  return (
    !!previous &&
    valuesEqual(previous.raw, next.raw) &&
    !valuesEqual(previous.key, next.key)
  );
}

const hasSize = (size) => !!size && size[0] > 0 && size[1] > 0;

// How long a map's size has to hold still before a fit is taken against it.
// The same window MapComponent settles moves over: comfortably above a frame,
// short enough to go unnoticed.
export const SIZE_SETTLE_MS = 150;

/**
 * Call `fit` once the map has a size that has held still for SIZE_SETTLE_MS.
 * Returns what drops the wait.
 *
 * Not at its first size: a tab shown again grows its tiles back from no width
 * over a couple of hundred milliseconds, as the dashboard grid lays them out,
 * and a fit taken against the first frame of that is for a sliver of the map
 * -- the layer ends up a speck once the map is full width. A tab not shown or
 * a collapsed tile has no size at all, and waits until it has one.
 */
export function whenMapSizeSettles(map, fit) {
  let timer = null;
  const drop = () => {
    clearTimeout(timer);
    map.un("change:size", restart);
  };
  function restart() {
    clearTimeout(timer);
    if (!hasSize(map.getSize())) return;
    timer = setTimeout(() => {
      drop();
      fit();
    }, SIZE_SETTLE_MS);
  }
  map.on("change:size", restart);
  restart();
  return drop;
}

// The layer of this name added last: during a rebuild the old one is still on
// the map until its replacement has painted.
const newestLayerNamed = (map, name) =>
  map
    .getLayers()
    .getArray()
    .filter((layer) => layer.get("name") === name)
    .pop();

// Whether two sources or stamps are the same. Usually they are the very same
// object, which is checked first: a GeoJSON source can carry a whole parsed
// FeatureCollection.
const same = (a, b) => a === b || valuesEqual(a, b);

// A ticked layer the map builds from its saved config, whose source the
// browser can fit the map to, and whose unresolved source getVisualization
// handed over.
const zoomsOnChange = (layer) => {
  const props = layer?.configuration?.props;
  return (
    !!props?.name &&
    props.zoomToLayerOnChange === true &&
    !props.pluginSource &&
    !!layer.rawSource &&
    ZOOM_ON_CHANGE_SOURCE_TYPES.includes(props.source?.type)
  );
};

/**
 * zoomToLayerOnChange for the layers the map builds from their saved config.
 *
 * MapComponent rebuilds such a layer after an edit, a refresh and a variable
 * input change alike, so each new set of layers is sorted here, before the
 * rebuild. A ticked layer owes a zoom on the map's first load, and when a
 * variable input changed what its source resolves to. What is recorded is
 * the resolved source the zoom is for, under the layer's name. The zoom
 * happens when MapComponent adds a layer built from that source, through the
 * returned `onLayerAdded`. It is matched by name and source rather than by
 * config object because a popup map is handed copies, and because the source
 * tells a build superseded by a newer change from the one that replaced it.
 *
 * A fit waits for the layer's data, and lands only if the layer's stamp is
 * still the one the zoom was owed for: a quick second change must not be
 * overtaken by the first one's slower data. The stamp rather than the source,
 * because a refresh can move a relative date in the source without changing
 * what the layer is loaded for.
 *
 * A zoom stays owed until a layer is built for it, so a refresh or another
 * layer's change before the build lands does not lose it, and a build that
 * fails leaves it to the next one that succeeds -- as a dynamic layer's next
 * successful fetch delivers a zoom its failed one owed. An edit to the layer's
 * source, unticking it or removing it drops the zoom, and any wait for the
 * map's size to settle.
 *
 * `variableInputValues` and `mapExtentVariable` are read only when `layers`
 * changes. Base substitutes a variable change into the layers in an effect,
 * so the new layers arrive a render after the new values; stamping the old
 * layers with the new values in between would owe a zoom to a source no
 * build will ever have.
 */
export function useStaticLayerZoom({
  layers,
  mapRef,
  variableInputValues,
  mapExtentVariable,
}) {
  // Layer name to the stamp and resolved source of each ticked layer last
  // seen. Null until the map's first layers, which are its first load.
  const seenRef = useRef(null);
  // Layer name to the resolved source whose build zooms the map, and the
  // stamp the zoom was owed for.
  const owedRef = useRef(new Map());
  // Layer name to what drops a zoom waiting for the map's size to settle.
  const waitsRef = useRef(new Map());

  useEffect(() => {
    const firstLoad = seenRef.current === null;
    const previous = seenRef.current ?? new Map();
    const seen = new Map();
    const owed = new Map();
    (layers ?? []).filter(zoomsOnChange).forEach((layer) => {
      const { name, source } = layer.configuration.props;
      const stamp = zoomStampFor(
        layer.rawSource,
        variableInputValues,
        mapExtentVariable,
      );
      seen.set(name, { stamp, source });
      const before = previous.get(name);
      const edited = !!before && !valuesEqual(before.stamp.raw, stamp.raw);
      const stillOwed = owedRef.current.has(name) && !edited;
      // A change that resolves to the same source -- `now-1D` swapped for the
      // date it stands for -- loads nothing new, so there is nothing to fit.
      const changed =
        isVariableChange(before?.stamp, stamp) && !same(before.source, source);
      if (firstLoad || stillOwed || changed) {
        // The source as resolved now: a refresh can move a relative date in
        // it, and the build that delivers the zoom is built from this one.
        owed.set(name, { source, stamp });
      }
    });
    waitsRef.current.forEach((drop, name) => {
      const now = seen.get(name)?.stamp;
      const was = previous.get(name)?.stamp;
      if (now && was && valuesEqual(now.raw, was.raw)) return;
      drop();
      waitsRef.current.delete(name);
    });
    seenRef.current = seen;
    owedRef.current = owed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers]);

  useEffect(() => {
    const waits = waitsRef.current;
    return () => {
      waits.forEach((drop) => drop());
      waits.clear();
    };
  }, []);

  return useCallback(
    (_olLayer, layerConfig) => {
      const name = layerConfig?.props?.name;
      const owed = owedRef.current.get(name);
      if (!owed || !same(owed.source, layerConfig.props.source)) return;
      owedRef.current.delete(name);
      const map = mapRef.current;
      const isCurrent = () => {
        const now = seenRef.current?.get(name)?.stamp;
        return !!now && same(now, owed.stamp);
      };
      waitsRef.current.get(name)?.();
      waitsRef.current.delete(name);
      const drop = whenMapSizeSettles(map, () => {
        waitsRef.current.delete(name);
        // The layer of this name on the map now: a refresh while the map was
        // hidden may have rebuilt it from the same source. None means it was
        // taken off, and there is nothing current to fit.
        const target = newestLayerNamed(map, name);
        if (target && isCurrent()) zoomToLayer(map, target, { isCurrent });
      });
      waitsRef.current.set(name, drop);
    },
    [mapRef],
  );
}
