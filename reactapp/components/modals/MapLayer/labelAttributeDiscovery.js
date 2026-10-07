import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLayerAttributes } from "components/map/utilities";
import { findSelectOptionByValue } from "components/visualizations/utilities";

/**
 * Author-triggered attribute discovery for the Labels tab.
 *
 * This is a dispatcher over the two readers the editor already has, not a third
 * one. Shapefiles go through `useShapefileDiscovery`, which the modal already
 * hoists; everything else goes through `getLayerAttributes`. The two cover
 * disjoint source sets -- `getLayerAttributes` throws for shapefiles, which is
 * why the shapefile hook exists at all -- so the split is the existing shape of
 * the codebase rather than a choice made here.
 *
 * Discovery fires when the author opens the attribute menu, not when the editor
 * or the tab opens. That matters beyond saving a request: for a plugin-produced
 * layer `getLayerAttributes` RUNS THE PLUGIN to read the attribute metadata it
 * declares, so firing on open would execute a plugin for every author who
 * glances at the tab.
 *
 * A mistyped attribute name renders a blank label and raises no error anywhere,
 * which is the silent failure this control exists to remove. It never blocks
 * typing: the template field stays editable in every state, because a fetched
 * list can be empty, stale against a templated URL, or unavailable entirely.
 */
// A read that never settles would otherwise pin the control in "loading"
// forever: the dedupe key is claimed before the request starts, so reopening
// the menu is a no-op and the author never gets the typed-field fallback. The
// API client sets no timeout of its own, and for a plugin-backed layer this
// read executes the plugin, which is exactly the call most likely to hang.
export const DISCOVERY_TIMEOUT_MS = 30000;

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("Timed out reading this layer's attributes.")),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

export function useLabelAttributeDiscovery({
  sourceProps,
  layerName,
  dynamicMapLayers,
  shapefileDiscovery,
}) {
  const [state, setState] = useState("idle");
  const [fields, setFields] = useState([]);
  const [error, setError] = useState(null);
  // Which source a result belongs to. Opening the menu twice against the same
  // source must not refetch; changing the source must.
  const loadedKeyRef = useRef(null);
  const requestRef = useRef(0);

  const isShapefile = Boolean(shapefileDiscovery?.isShapefile);

  const sourceKey = useMemo(
    () =>
      JSON.stringify({
        type: sourceProps?.type ?? null,
        url: sourceProps?.props?.url ?? null,
        layer: sourceProps?.props?.layer ?? null,
        hasGeojson: Boolean(sourceProps?.geojson),
        layerName: layerName ?? null,
      }),
    [sourceProps, layerName],
  );

  // A source edit invalidates whatever was read for the previous one. Bumping
  // the request counter here is what actually discards an in-flight read --
  // without it, a request issued for the old source resolves after the reset
  // and writes the previous source's attributes into the new source's state.
  useEffect(() => {
    requestRef.current += 1;
    loadedKeyRef.current = null;
    setState("idle");
    setFields([]);
    setError(null);
  }, [sourceKey]);

  const open = useCallback(() => {
    if (isShapefile) {
      // The shapefile hook owns its own state machine and caching; asking it to
      // load twice is already a no-op there.
      shapefileDiscovery?.load?.();
      return;
    }
    if (loadedKeyRef.current === sourceKey) return;
    loadedKeyRef.current = sourceKey;

    const requestId = ++requestRef.current;
    setState("loading");
    setError(null);

    (async () => {
      try {
        const isDynamicMapLayer = findSelectOptionByValue(
          dynamicMapLayers,
          sourceProps?.type,
        );
        const attributes = await withTimeout(
          getLayerAttributes({ sourceProps, layerName, isDynamicMapLayer }),
          DISCOVERY_TIMEOUT_MS,
        );
        if (requestId !== requestRef.current) return;
        // `getLayerAttributes` returns a map of layer name to field list. Prefer
        // this layer's entry; fall back to the only entry when the source names
        // its layer differently than the editor does.
        const byLayer = attributes ?? {};
        const own = byLayer[layerName];
        const entries = Object.values(byLayer);
        const resolved =
          own ?? (entries.length === 1 ? entries[0] : entries.flat());
        setFields(Array.isArray(resolved) ? resolved : []);
        setState("ready");
      } catch (err) {
        if (requestId !== requestRef.current) return;
        // A failed read must not strand the author -- it reopens the typed
        // field with a reason, it does not disable it.
        loadedKeyRef.current = null;
        setError(err?.message ?? "Could not read this layer's attributes.");
        setFields([]);
        setState("failed");
      }
    })();
  }, [
    isShapefile,
    shapefileDiscovery,
    sourceKey,
    sourceProps,
    layerName,
    dynamicMapLayers,
  ]);

  // Mirror the shapefile hook rather than duplicating its machinery.
  if (isShapefile) {
    const shapefileState =
      shapefileDiscovery.state === "ready"
        ? "ready"
        : shapefileDiscovery.state === "loading"
          ? "loading"
          : shapefileDiscovery.state === "error" || shapefileDiscovery.failure
            ? "failed"
            : "idle";
    return {
      state: shapefileState,
      fields: (shapefileDiscovery.fields ?? []).map((field) =>
        typeof field === "string" ? { name: field, alias: field } : field,
      ),
      // The shapefile reader reports failures as `{detail, remedy}`. The pane
      // renders this value as text, so handing it the object crashes the React
      // tree -- take the string the hook's own contract promises.
      error:
        shapefileDiscovery.failure?.detail ??
        (shapefileDiscovery.failure
          ? "Could not read this layer's attributes."
          : null),
      open,
    };
  }

  return { state, fields, error, open };
}

export default useLabelAttributeDiscovery;
