import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { updateObjectWithVariableInputs } from "components/visualizations/utilities";
import { swapVectorLayerFeatures } from "components/map/utilities";
import {
  applyRuntimeRaster,
  attachGeoTIFFSourceErrorHandlers,
  buildRuntimeRaster,
  isRuntimeRasterConfig,
  resolveEffectiveRasterConfig,
} from "components/map/runtimeRaster";
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
 * Run `onAppear` once this runtime layer's OL layer exists on the map.
 *
 * Map.js constructs layers asynchronously, so the first fetch of a dashboard can
 * return before the layer it belongs to has been added. Discarding the payload
 * left the layer permanently blank: performFetch records the resolved args
 * before requesting, so the reconciliation effect then saw `argsUnchanged` and
 * never refetched -- the features only appeared once an argument genuinely
 * changed.
 *
 * What is held is the fetch's payload, not anything built from it: a raster's
 * source is built when the layer appears, under the same staleness guards as a
 * build for a layer that was already there.
 */
function whenLayerAppears(state, map, layerId, onAppear) {
  const collection = map.getLayers();
  cancelPendingSwap(state);
  const onAdd = () => {
    const olLayer = findOlLayer(map, layerId);
    if (!olLayer) return;
    cancelPendingSwap(state);
    onAppear(olLayer);
  };
  state.pendingSwap = () => collection.un("add", onAdd);
  collection.on("add", onAdd);
}

function swapWhenLayerAppears(state, map, layerId, featureCollection) {
  whenLayerAppears(state, map, layerId, (olLayer) => {
    // Read the projection now rather than when the fetch resolved: a GeoTIFF
    // auto-fit can change the view in between, and parsing into a projection
    // the map has already left strands the features off screen.
    const projection = map.getView().getProjection().getCode();
    swapVectorLayerFeatures(olLayer, featureCollection, projection);
  });
}

/** Detach the error listeners on the source a raster was last repointed at. */
function detachSourceErrors(state) {
  if (state.detachSourceErrors) {
    state.detachSourceErrors();
    state.detachSourceErrors = null;
  }
}

/**
 * Everything about a layer whose change must refetch it.
 *
 * `type` and `imageRatio` are what Map.js requires to be unchanged before it
 * preserves the OL layer instead of rebuilding it: anything there that differs
 * means a fresh, empty layer is about to be built, and a rebuilt layer has to
 * be repainted even when the plugin arguments are identical.
 *
 * A runtime raster adds its saved style. Map.js preserves the layer across a
 * style edit -- the style is compiled per fetch, from the saved one and the
 * plugin's -- so pinning, un-pinning or editing a pinned style changes nothing
 * on screen until the next fetch, and this is what makes there be one.
 */
function changeIdentity(configuration) {
  const identity = {
    type: configuration.type,
    imageRatio: configuration.props.imageRatio,
  };
  if (isRuntimeRasterConfig(configuration)) {
    const source = configuration.props.source;
    identity.style = {
      stylePinned: configuration.props.pluginSource.stylePinned === true,
      rampName: source.rampName,
      rampMin: source.rampMin,
      rampMax: source.rampMax,
      rampReverse: source.rampReverse,
      styleMode: source.styleMode,
      classes: source.classes,
      maskBelow: source.props?.mask_below,
    };
  }
  return identity;
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
  // The ramp each runtime raster is drawn with, for the legend: what the last
  // successful repoint resolved, or null when it draws with no colorbar to
  // label. A failed fetch leaves it alone, because the old raster is still the
  // one on screen.
  const [rasterLegendByLayerId, setRasterLegendByLayerId] = useState({});

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
        detachSourceErrors(state);
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

  const publishLegend = useCallback((layerId, legendRamp) => {
    // istanbul ignore next
    if (!isMountedRef.current) return;
    setRasterLegendByLayerId((prev) =>
      layerId in prev && valuesEqual(prev[layerId], legendRamp)
        ? prev
        : { ...prev, [layerId]: legendRamp },
    );
  }, []);

  const clearLegend = useCallback((layerId) => {
    // istanbul ignore next
    if (!isMountedRef.current) return;
    setRasterLegendByLayerId((prev) => {
      if (!(layerId in prev)) return prev;
      const next = { ...prev };
      delete next[layerId];
      return next;
    });
  }, []);

  // Build a runtime raster's source from a fetched description and repoint the
  // layer at it.
  //
  // The build is async -- it reads the file's header and statistics and waits
  // for the source to open -- where the vector swap is synchronous, so the
  // request's generation is re-checked after it: a fetch superseded while its
  // build ran must neither paint nor touch the loading window or the error
  // state, all of which belong to the request that replaced it. A build that
  // fails changes nothing on the layer, so the previous file stays drawn.
  const paintRaster = useCallback(
    async (layerId, state, description, isCurrent) => {
      const map = mapRef.current;
      // Reopened for a build that waited for its layer to appear; idempotent
      // when the request's own window is still open.
      openLoading(layerId);
      let built;
      try {
        const effective = resolveEffectiveRasterConfig(
          state.configuration,
          description,
        );
        built = await buildRuntimeRaster(
          effective,
          map.getView().getProjection().getCode(),
        );
      } catch (err) {
        if (!isMountedRef.current || !isCurrent()) return;
        closeLoading(layerId);
        setError(layerId, {
          message: err?.message ?? "Failed to load the raster",
          kind: "error",
        });
        return;
      }
      if (!isMountedRef.current || !isCurrent()) return;

      // Looked up again rather than carried across the build: Map.js may have
      // rebuilt the layer meanwhile, and the source belongs on the one there now.
      const olLayer = findOlLayer(map, layerId);
      if (!olLayer) {
        closeLoading(layerId);
        whenLayerAppears(state, map, layerId, () =>
          paintRaster(layerId, state, description, isCurrent),
        );
        return;
      }
      if (typeof onBeforeSwap === "function") {
        onBeforeSwap(layerId);
      }
      applyRuntimeRaster(olLayer, built);
      // The previous source is off the map, and a late failure from it says
      // nothing about the file now drawn.
      detachSourceErrors(state);
      state.detachSourceErrors = attachGeoTIFFSourceErrorHandlers(
        built.source,
        state.configuration?.props?.name,
        (message) => setError(layerId, { message, kind: "error" }),
      );
      publishLegend(layerId, built.legendRamp);
      clearError(layerId);
      closeLoading(layerId);
    },
    [
      mapRef,
      onBeforeSwap,
      openLoading,
      closeLoading,
      setError,
      clearError,
      publishLegend,
    ],
  );

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
    (layerId, pluginSource, resolvedArgs, renderIdentity) => {
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
      state.lastRenderIdentity = renderIdentity;

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
          const map = mapRef?.current;
          if (
            map &&
            response?.success !== false &&
            isRuntimeRasterConfig(state.configuration)
          ) {
            const description = response?.data ?? null;
            if (findOlLayer(map, layerId)) {
              // The window stays open through the build, which is where a
              // raster's real wait is: the header read and the file opening.
              return paintRaster(layerId, state, description, isCurrent);
            }
            closeLoading(layerId);
            whenLayerAppears(state, map, layerId, () =>
              paintRaster(layerId, state, description, isCurrent),
            );
            return;
          }
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
      paintRaster,
    ],
  );

  const scheduleFetch = useCallback(
    (layerId, pluginSource, resolvedArgs, renderIdentity) => {
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
        performFetch(layerId, pluginSource, resolvedArgs, renderIdentity);
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
        detachSourceErrors(state);
        perLayerStateRef.current.delete(layerId);
        // A response that had already resolved is never rejected by the
        // cancel above, and a raster's build outlives its response: claiming a
        // generation here is what stops either from painting into a layer that
        // is gone, or writing an error against it.
        generationRef.current.set(
          layerId,
          (generationRef.current.get(layerId) ?? 0) + 1,
        );
        closeLoading(layerId);
        clearLegend(layerId);
      }
    });

    runtimeLayers.forEach((layer) => {
      const { layerId, pluginSource } = layer.configuration.props;
      const { resolvedArgs } = resolveLayerArgs(pluginSource.args);
      const renderIdentity = changeIdentity(layer.configuration);

      if (!perLayerStateRef.current.has(layerId)) {
        perLayerStateRef.current.set(layerId, {
          cancelTokenSource: null,
          debounceTimer: null,
          lastResolvedArgs: undefined,
          lastSource: undefined,
          lastRenderIdentity: undefined,
          pendingSwap: null,
          // The saved config a raster build starts from. Read when the
          // response lands, not when the request left, so the build uses
          // whatever the author saved last.
          configuration: layer.configuration,
          detachSourceErrors: null,
        });
        // First appearance — always fetch (subject to debounce).
        scheduleFetch(layerId, pluginSource, resolvedArgs, renderIdentity);
        return;
      }

      const state = perLayerStateRef.current.get(layerId);
      state.configuration = layer.configuration;

      if (refreshTickChanged) {
        scheduleFetch(layerId, pluginSource, resolvedArgs, renderIdentity);
        return;
      }

      // A layer whose plugin source is edited is rebuilt from scratch, because
      // identity preservation requires the same source. Comparing arguments
      // alone left that rebuilt layer blank forever: the arguments had not
      // changed, so nothing refetched and nothing was ever painted into it.
      const argsUnchanged = valuesEqual(state.lastResolvedArgs, resolvedArgs);
      const sourceUnchanged = state.lastSource === pluginSource.source;
      // Same reasoning as the source check above, generalised: switching a
      // layer to image rendering, or changing its imageRatio, forces Map.js to
      // rebuild it because neither can be applied to a live OL layer. Without
      // this the rebuilt layer stayed blank until the page was reloaded.
      const renderUnchanged = valuesEqual(
        state.lastRenderIdentity,
        renderIdentity,
      );
      if (argsUnchanged && sourceUnchanged && renderUnchanged) return;

      scheduleFetch(layerId, pluginSource, resolvedArgs, renderIdentity);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, variableInputValues, variableInputDateFormats, refreshTick]);

  return { errorsByLayerId, loadingByLayerId, rasterLegendByLayerId };
}
