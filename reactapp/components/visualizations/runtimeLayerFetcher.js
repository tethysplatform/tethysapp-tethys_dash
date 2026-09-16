import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { updateObjectWithVariableInputs } from "components/visualizations/utilities";
import { swapVectorLayerFeatures } from "components/map/utilities";
import appAPI from "services/api/app";
import { valuesEqual } from "components/modals/utilities";
import { CANCEL_REASON } from "components/map/layerStatus";

/** Find the OL layer carrying a runtime layer's identity tag. */
function findOlLayer(map, layerId) {
  return map
    .getLayers()
    .getArray()
    .find((l) => l.get("layerId") === layerId);
}

/** Drop any listener left waiting for this layer to appear. */
function cancelPendingSwap(state) {
  if (state.pendingSwap) {
    state.pendingSwap();
    state.pendingSwap = null;
  }
}

/**
 * Hold a fetched FeatureCollection until its OL layer exists on the map.
 *
 * Map.js constructs layers asynchronously, so the first fetch of a dashboard can
 * return before the layer it belongs to has been added. Discarding the payload
 * left the layer permanently blank: performFetch records the resolved args
 * before requesting, so the reconciliation effect then saw `argsUnchanged` and
 * never refetched -- the features only appeared once an argument genuinely
 * changed.
 */
function swapWhenLayerAppears(state, map, layerId, featureCollection) {
  const collection = map.getLayers();
  cancelPendingSwap(state);
  const onAdd = () => {
    const olLayer = findOlLayer(map, layerId);
    if (!olLayer) return;
    cancelPendingSwap(state);
    // Read the projection now rather than when the fetch resolved: a GeoTIFF
    // auto-fit can change the view in between, and parsing into a projection
    // the map has already left strands the features off screen.
    const projection = map.getView().getProjection().getCode();
    swapVectorLayerFeatures(olLayer, featureCollection, projection);
  };
  state.pendingSwap = () => collection.un("add", onAdd);
  collection.on("add", onAdd);
}

export default function useRuntimeLayerFetcher({
  layers,
  gridItemUUID,
  sessionNonce,
  mapRef,
  variableInputValues,
  variableInputDateFormats,
  onBeforeSwap,
  debounceMs = 250,
  refreshTick = 0,
}) {
  const perLayerStateRef = useRef(new Map()); // layerId → state
  const isMountedRef = useRef(true);
  const [errorsByLayerId, setErrorsByLayerId] = useState({});
  // Which layers have a fetch outstanding. The hook has always known this and
  // thrown it away, which is why a plugin that simply takes a while looked
  // identical to one that had finished with nothing to show.
  const [loadingByLayerId, setLoadingByLayerId] = useState({});
  // Request generation per layer id, deliberately NOT on the per-layer state
  // object: the removal sweep deletes that object and a re-add builds a fresh
  // one, so a counter living there would reset and let a pre-removal response
  // pass the staleness guard. Monotonic for the lifetime of the hook.
  const generationRef = useRef(new Map());

  useEffect(() => {
    isMountedRef.current = true;
    const stateMap = perLayerStateRef.current;
    return () => {
      isMountedRef.current = false;
      stateMap.forEach((state) => {
        if (state.debounceTimer) {
          clearTimeout(state.debounceTimer);
        }
        if (state.cancelTokenSource) {
          state.cancelTokenSource.cancel(CANCEL_REASON.UNMOUNT);
        }
        cancelPendingSwap(state);
      });
      stateMap.clear();
    };
  }, []);

  const clearError = useCallback((layerId) => {
    // istanbul ignore next
    if (!isMountedRef.current) return;
    setErrorsByLayerId((prev) => {
      if (!(layerId in prev)) return prev;
      const next = { ...prev };
      delete next[layerId];
      return next;
    });
  }, []);

  const openLoading = useCallback((layerId) => {
    // istanbul ignore next
    if (!isMountedRef.current) return;
    setLoadingByLayerId((prev) =>
      prev[layerId] ? prev : { ...prev, [layerId]: true },
    );
  }, []);

  const closeLoading = useCallback((layerId) => {
    // istanbul ignore next
    if (!isMountedRef.current) return;
    setLoadingByLayerId((prev) => {
      if (!(layerId in prev)) return prev;
      const next = { ...prev };
      delete next[layerId];
      return next;
    });
  }, []);

  const setError = useCallback((layerId, payload) => {
    // istanbul ignore next
    if (!isMountedRef.current) return;
    setErrorsByLayerId((prev) => ({ ...prev, [layerId]: payload }));
  }, []);

  const resolveLayerArgs = useCallback(
    (pluginArgs) => {
      const rawArgs = pluginArgs ?? {};
      const resolvedArgs = updateObjectWithVariableInputs({
        args: rawArgs,
        variableInputs: variableInputValues ?? {},
        variableInputDateFormats,
      });
      return { resolvedArgs };
    },
    [variableInputValues, variableInputDateFormats],
  );

  const performFetch = useCallback(
    (layerId, pluginSource, resolvedArgs) => {
      const state = perLayerStateRef.current.get(layerId);
      // istanbul ignore next
      if (!state) return Promise.resolve();

      if (state.cancelTokenSource) {
        state.cancelTokenSource.cancel(CANCEL_REASON.SUPERSEDED);
      }
      // A newer fetch replaces whatever an older one was still waiting to paint.
      cancelPendingSwap(state);
      const cancelTokenSource = axios.CancelToken.source();
      state.cancelTokenSource = cancelTokenSource;
      state.lastResolvedArgs = resolvedArgs;
      state.lastSource = pluginSource.source;

      // Claim this layer's next generation. A request that had already resolved
      // when a newer one superseded it is never rejected by axios, so its tail
      // still runs a microtask later; without this guard it would close the
      // newer request's window and paint its own stale payload over the map.
      const myGeneration = (generationRef.current.get(layerId) ?? 0) + 1;
      generationRef.current.set(layerId, myGeneration);
      const isCurrent = () =>
        generationRef.current.get(layerId) === myGeneration;
      // Idempotent by layer id, so the open in scheduleFetch -- which covers
      // the debounce wait -- costs nothing, and a request dispatched by any
      // future path still reports itself.
      openLoading(layerId);

      const requestId = `${sessionNonce}:${gridItemUUID}:${layerId}`;

      return appAPI
        .getVisualizationFeatures({
          source: pluginSource.source,
          args: resolvedArgs,
          requestId,
          cancelToken: cancelTokenSource.token,
        })
        .then((response) => {
          if (!isMountedRef.current) return;
          if (!isCurrent()) return;
          closeLoading(layerId);
          if (response && response.success === false) {
            const errorText = response?.data?.error ?? "Unknown error";
            const kind =
              errorText === "Plugin not available" ||
              errorText.includes("does not support")
                ? "unavailable"
                : "error";
            setError(layerId, { message: errorText, kind });
            return;
          }

          if (typeof onBeforeSwap === "function") {
            onBeforeSwap(layerId);
          }
          const map = mapRef?.current;
          if (!map) {
            // No map to paint into yet. Forget the args so the next
            // reconciliation refetches rather than treating this as done.
            state.lastResolvedArgs = undefined;
            return;
          }
          const featureCollection = response?.data ?? null;
          const mapProjection = map.getView().getProjection().getCode();
          const olLayer = findOlLayer(map, layerId);
          if (olLayer) {
            swapVectorLayerFeatures(olLayer, featureCollection, mapProjection);
          } else {
            swapWhenLayerAppears(state, map, layerId, featureCollection);
          }
          clearError(layerId);
        })
        .catch((err) => {
          // Cancels return before any state write, so the window is closed at
          // the cancel sites instead -- except a supersede, where the newer
          // request has already reopened it.
          if (axios.isCancel(err)) return;
          if (!isMountedRef.current) return;
          if (!isCurrent()) return;
          closeLoading(layerId);
          setError(layerId, {
            message: err?.message ?? "Fetch failed",
            kind: "error",
          });
        });
    },
    [
      sessionNonce,
      gridItemUUID,
      mapRef,
      onBeforeSwap,
      setError,
      clearError,
      openLoading,
      closeLoading,
    ],
  );

  const scheduleFetch = useCallback(
    (layerId, pluginSource, resolvedArgs) => {
      const state = perLayerStateRef.current.get(layerId);
      // istanbul ignore next
      if (!state) return;
      if (state.debounceTimer) {
        clearTimeout(state.debounceTimer);
      }
      // The wait counts as loading. Opening at dispatch instead would leave a
      // quarter-second of silence on every load, and would report a settled map
      // for the whole of a slider drag, where the timer keeps restarting.
      openLoading(layerId);
      state.debounceTimer = setTimeout(() => {
        state.debounceTimer = null;
        performFetch(layerId, pluginSource, resolvedArgs);
      }, debounceMs);
    },
    [debounceMs, performFetch, openLoading],
  );

  const prevRefreshTickRef = useRef(refreshTick);

  useEffect(() => {
    const refreshTickChanged = prevRefreshTickRef.current !== refreshTick;
    prevRefreshTickRef.current = refreshTick;

    const runtimeLayers = (layers ?? []).filter(
      (l) =>
        l?.configuration?.props?.pluginSource &&
        l?.configuration?.props?.layerId,
    );

    // Remove orchestrator state for layers that were removed from the map.
    const currentLayerIds = new Set(
      runtimeLayers.map((l) => l.configuration.props.layerId),
    );
    perLayerStateRef.current.forEach((state, layerId) => {
      if (!currentLayerIds.has(layerId)) {
        if (state.debounceTimer) clearTimeout(state.debounceTimer);
        if (state.cancelTokenSource)
          state.cancelTokenSource.cancel(CANCEL_REASON.REMOVED);
        cancelPendingSwap(state);
        perLayerStateRef.current.delete(layerId);
        closeLoading(layerId);
      }
    });

    runtimeLayers.forEach((layer) => {
      const { layerId, pluginSource } = layer.configuration.props;
      const { resolvedArgs } = resolveLayerArgs(pluginSource.args);

      if (!perLayerStateRef.current.has(layerId)) {
        perLayerStateRef.current.set(layerId, {
          cancelTokenSource: null,
          debounceTimer: null,
          lastResolvedArgs: undefined,
          lastSource: undefined,
          pendingSwap: null,
        });
        // First appearance — always fetch (subject to debounce).
        scheduleFetch(layerId, pluginSource, resolvedArgs);
        return;
      }

      if (refreshTickChanged) {
        scheduleFetch(layerId, pluginSource, resolvedArgs);
        return;
      }

      const state = perLayerStateRef.current.get(layerId);
      // A layer whose plugin source is edited is rebuilt from scratch, because
      // identity preservation requires the same source. Comparing arguments
      // alone left that rebuilt layer blank forever: the arguments had not
      // changed, so nothing refetched and nothing was ever painted into it.
      const argsUnchanged = valuesEqual(state.lastResolvedArgs, resolvedArgs);
      const sourceUnchanged = state.lastSource === pluginSource.source;
      if (argsUnchanged && sourceUnchanged) return;

      scheduleFetch(layerId, pluginSource, resolvedArgs);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, variableInputValues, variableInputDateFormats, refreshTick]);

  return { errorsByLayerId, loadingByLayerId };
}
