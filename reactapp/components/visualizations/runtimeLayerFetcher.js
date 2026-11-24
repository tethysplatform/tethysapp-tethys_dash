import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useContext,
  useMemo,
} from "react";
import axios from "axios";
import {
  dataRequestArgs,
  findSelectOptionByValue,
  pendingSecretArgs,
  storedSecretArgs,
  updateObjectWithVariableInputs,
} from "components/visualizations/utilities";
import {
  AppContext,
  EditingContext,
  LayoutContext,
} from "components/contexts/Contexts";
import { swapVectorLayerFeatures } from "components/map/utilities";
import { rasterStyleSettings } from "components/map/geoTIFFStyle";
import {
  applyRuntimeRaster,
  attachGeoTIFFSourceErrorHandlers,
  buildRuntimeRaster,
  disposeRuntimeSource,
  isRuntimeRasterConfig,
  resolveEffectiveRasterConfig,
} from "components/map/runtimeRaster";
import appAPI from "services/api/app";
import { valuesEqual } from "components/modals/utilities";
import { CANCEL_REASON } from "components/map/layerStatus";
import { zoomToLayer } from "components/map/layerExtent";
import {
  isVariableChange,
  whenMapSizeSettles,
  zoomStampFor,
} from "components/visualizations/zoomOnChange";

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

/**
 * Drop a zoom left waiting for the map's size to settle. Returns whether
 * there was one.
 */
function cancelPendingZoom(state) {
  if (!state.pendingZoom) return false;
  state.pendingZoom();
  state.pendingZoom = null;
  return true;
}

/**
 * Cancel a zoom waiting for the map's size, but leave it owed to the next
 * paint. Without this, a timed refresh on a hidden tab would cancel the zoom
 * for good.
 */
function keepZoomOwed(state) {
  if (cancelPendingZoom(state)) state.zoomOwed = true;
}

/**
 * Record the zoom stamp a layer's arguments arrived with, and decide from it
 * whether the layer owes a zoom (see zoomOnChange.js). A variable input change
 * owes one, when it changes the arguments a request is sent with: one that
 * resolves to the same arguments -- `now-1D` swapped for the date it stands
 * for -- fetches nothing, and its zoom would wait for the next refresh. An
 * edit to the layer's plugin or arguments drops any zoom owed,
 * and any wait for a size, because an edit never zooms. Deciding here, as the
 * arguments arrive, rather than at the paint means an edit whose fetch never
 * paints -- superseded, or failed -- cannot make the next variable change read
 * as an edit.
 */
function noteZoomStamp(state, zoomStamp, argsChanged) {
  const seen = state.seenZoomStamp;
  state.seenZoomStamp = zoomStamp;
  if (!valuesEqual(seen.raw, zoomStamp.raw)) {
    cancelPendingZoom(state);
    state.zoomOwed = false;
  } else if (argsChanged && isVariableChange(seen, zoomStamp)) {
    state.zoomOwed = true;
  }
}

/**
 * Fit the map to the layer just painted, when the author asked for it and the
 * layer owes a zoom. What is owed is decided as the layers arrive (see the
 * reconciliation effect): the first load, or a variable input change.
 *
 * The paint takes what is owed whether or not the option is on, so turning it
 * on later waits for the next real change rather than zooming at once. The
 * fit waits for the map's size to settle (see whenMapSizeSettles); a newer
 * fetch drops that wait and leaves the zoom owed (see keepZoomOwed).
 *
 * Only the newest request may zoom, and every caller has already checked that
 * before painting: the paints here are synchronous after the check, and a
 * deferred one is cancelled when a newer fetch starts.
 */
function zoomAfterPaint(state, map) {
  const owed = state.zoomOwed;
  state.zoomOwed = false;
  const enabled = () =>
    state.configuration?.props?.zoomToLayerOnChange === true;
  if (!owed || !enabled()) return;
  cancelPendingZoom(state);
  state.pendingZoom = whenMapSizeSettles(map, () => {
    state.pendingZoom = null;
    // Read again for a zoom that waited: the author may have turned it off
    // while the map was hidden. And fit what is painted now: a repaint moves
    // the paint onto a layer Map.js rebuilt, and a raster repaint that failed
    // leaves nothing to fit.
    if (!enabled() || !state.lastPaint) return;
    zoomToLayer(map, state.lastPaint.olLayer);
  });
}

/**
 * Swap a vector payload into a runtime layer, and remember which OL layer holds
 * it, so a layer Map.js rebuilds behind the fetcher's back can be repainted.
 */
function swapVectorPayload(state, map, olLayer, featureCollection) {
  // Parsed into the view's own projection, read off the map at the swap.
  const projection = map.getView().getProjection().getCode();
  swapVectorLayerFeatures(olLayer, featureCollection, projection);
  state.lastPaint = {
    kind: "vector",
    payload: featureCollection,
    olLayer,
  };
}

/** A fetch's vector paint: the swap, then the zoom it may owe. */
function paintVector(state, map, olLayer, featureCollection) {
  swapVectorPayload(state, map, olLayer, featureCollection);
  zoomAfterPaint(state, map);
}

function swapWhenLayerAppears(state, map, layerId, featureCollection) {
  whenLayerAppears(state, map, layerId, (olLayer) =>
    paintVector(state, map, olLayer, featureCollection),
  );
}

/**
 * Take a runtime raster off the map.
 *
 * A fetch that cannot be drawn leaves nothing drawn. The alternative -- keeping
 * the file the last good fetch returned -- shows data from a file the layer no
 * longer names, which reads as current and is not: an author who repoints a
 * layer at something broken would see the old raster and believe it.
 *
 * The OL layer itself is kept, with its identity tags, z-order and opacity, so
 * the next successful fetch repoints it as usual.
 */
function clearRasterPaint(state, map, layerId) {
  const olLayer = map ? findOlLayer(map, layerId) : null;
  // A null source draws nothing; the layer stays where it is in the stack.
  olLayer?.setSource(null);
  // Nothing is drawn, so nothing is left to report a failure about.
  detachSourceErrors(state);
  // Not a repaint candidate any more: there is no payload worth restoring to a
  // layer Map.js rebuilds, because that payload is the one that just failed.
  state.lastPaint = null;
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
 * A runtime raster adds its saved style, which is the only style it has. Map.js
 * preserves the layer across a style edit, and the compiled expression is built
 * per fetch against the file, so editing the style changes nothing on screen
 * until the next fetch -- this is what makes there be one.
 */
function changeIdentity(configuration) {
  const identity = {
    type: configuration.type,
    imageRatio: configuration.props.imageRatio,
  };
  if (isRuntimeRasterConfig(configuration)) {
    // The saved style's settings, picked by the shared list so a style field
    // added there refetches here too, plus the mask -- which is a source
    // property rather than a style one, and so has to be named separately or
    // an edit to it would repaint with the old threshold still applied.
    identity.style = {
      maskBelow: configuration.props.source?.props?.mask_below,
      ...rasterStyleSettings(configuration.style),
    };
  }
  return identity;
}

export default function useRuntimeLayerFetcher({
  layers,
  // The dashboard and the Map tile the layers belong to, which every request
  // names along with its layer's layerId.
  dashboardUUID,
  gridItemUUID,
  sessionNonce,
  mapRef,
  variableInputValues,
  variableInputDateFormats,
  // The name of the variable the map publishes its own extent to, if any.
  // Masked out of each layer's zoom stamp (see zoomOnChange.js).
  mapExtentVariable = null,
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
  // The layers with an outstanding fetch, mirrored synchronously from
  // loadingByLayerId: the rebuilt-layer check below runs from OpenLayers
  // events, where React state is not yet readable.
  const loadingRef = useRef(new Set());
  // The map layer collection being watched for rebuilt runtime layers.
  const collectionWatchRef = useRef(null);
  const repaintIfRebuiltRef = useRef(null);
  // The ramp each runtime raster is drawn with, for the legend: what the last
  // successful repoint resolved, or null when it draws with no colorbar to
  // label. A failed fetch leaves it alone, because the old raster is still the
  // one on screen.
  const [rasterLegendByLayerId, setRasterLegendByLayerId] = useState({});
  // An editor's requests carry the secrets entered for their layers and not
  // saved yet (see pendingSecretArgs); a viewer's never do. The places holding
  // a stored secret are read too, so a save that stores or clears one
  // refetches the layer with what is stored now.
  const { pendingSecrets, storedSecrets, editable } =
    useContext(LayoutContext) ?? {};
  const { isEditing } = useContext(EditingContext) ?? {};
  // The plugins' arg types, for the args a request sends (dataRequestArgs).
  const { dynamicMapLayers } = useContext(AppContext) ?? {};
  const editorSecrets = useMemo(
    () => (isEditing ? pendingSecrets : undefined),
    [isEditing, pendingSecrets],
  );

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
        cancelPendingZoom(state);
        detachSourceErrors(state);
      });
      stateMap.clear();
      if (collectionWatchRef.current) {
        collectionWatchRef.current.detach();
        collectionWatchRef.current = null;
      }
    };
  }, []);

  // Claim this layer's next request generation, returning whether the claim is
  // still the newest. Everything that commits to painting claims one, so
  // anything older stops at its next staleness check.
  const claimGeneration = useCallback((layerId) => {
    const generation = (generationRef.current.get(layerId) ?? 0) + 1;
    generationRef.current.set(layerId, generation);
    return () => generationRef.current.get(layerId) === generation;
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
    loadingRef.current.add(layerId);
    setLoadingByLayerId((prev) =>
      prev[layerId] ? prev : { ...prev, [layerId]: true },
    );
  }, []);

  const closeLoading = useCallback((layerId) => {
    // istanbul ignore next
    if (!isMountedRef.current) return;
    loadingRef.current.delete(layerId);
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
  // fails changes nothing on the layer, so the previous file stays drawn, and a
  // source built but never applied is disposed.
  //
  // A repaint goes through here too, so it delivers a zoom still owed (see
  // keepZoomOwed) and otherwise does not zoom.
  const paintRaster = useCallback(
    async (layerId, state, description, isCurrent) => {
      // Belt and braces. No caller can reach this already stale: a fetch has
      // just claimed its generation, a repaint claims one as it calls, and the
      // layer-appeared retry runs under a claim that nothing could have
      // superseded -- everything that claims a generation also cancels the
      // listener that retry is waiting on.
      // istanbul ignore next -- unreachable; see above
      if (!isCurrent()) return;
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
        clearRasterPaint(state, map, layerId);
        clearLegend(layerId);
        setError(layerId, {
          message: err?.message ?? "Failed to load the raster",
          kind: "error",
        });
        return;
      }
      if (!isMountedRef.current || !isCurrent()) {
        disposeRuntimeSource(built.source);
        return;
      }

      // Looked up again rather than carried across the build: Map.js may have
      // rebuilt the layer meanwhile, and the source belongs on the one there now.
      const olLayer = findOlLayer(map, layerId);
      if (!olLayer) {
        // An OL source cannot move between layers, so the one that appears
        // gets a build of its own.
        disposeRuntimeSource(built.source);
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
      state.lastPaint = {
        kind: "raster",
        payload: description,
        olLayer,
      };
      publishLegend(layerId, built.legendRamp);
      clearError(layerId);
      closeLoading(layerId);
      // After the repoint, so the fit reads the file now open on the layer.
      zoomAfterPaint(state, map);
    },
    [
      mapRef,
      onBeforeSwap,
      openLoading,
      closeLoading,
      setError,
      clearError,
      publishLegend,
      clearLegend,
    ],
  );

  // The arguments a request is sent with, and the stamp a paint of them is
  // compared by for zoomToLayerOnChange (see zoomOnChange.js). The plugin is
  // part of the stamp's saved config, so switching it is an edit.
  //
  // An editor's pending secrets join the arguments sent, so entering one
  // refetches the layer with it, but never the stamp: a secret is no variable
  // change, and never zooms.
  const resolveLayerArgs = useCallback(
    (pluginSource, layerId) => {
      const rawArgs = pluginSource.args ?? {};
      let resolvedArgs = updateObjectWithVariableInputs({
        args: rawArgs,
        variableInputs: variableInputValues ?? {},
        variableInputDateFormats,
      });
      const secretArgs = pendingSecretArgs(editorSecrets, {
        tile: gridItemUUID,
        layer: layerId,
        source: pluginSource.source,
      });
      if (Object.keys(secretArgs).length > 0) {
        resolvedArgs = { ...resolvedArgs, ...secretArgs };
      }
      const zoomStamp = zoomStampFor(
        { source: pluginSource.source, args: rawArgs },
        variableInputValues,
        mapExtentVariable,
      );
      return { resolvedArgs, zoomStamp };
    },
    [
      variableInputValues,
      variableInputDateFormats,
      mapExtentVariable,
      editorSecrets,
      gridItemUUID,
    ],
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
      // Usually already done by scheduleFetch, but a raster repaint during the
      // debounce can leave a new wait behind.
      keepZoomOwed(state);
      const cancelTokenSource = axios.CancelToken.source();
      state.cancelTokenSource = cancelTokenSource;
      state.lastResolvedArgs = resolvedArgs;
      state.lastSource = pluginSource.source;
      state.lastRenderIdentity = renderIdentity;

      // Claim this layer's next generation. A request that had already resolved
      // when a newer one superseded it is never rejected by axios, so its tail
      // still runs a microtask later; without this guard it would close the
      // newer request's window and paint its own stale payload over the map.
      const isCurrent = claimGeneration(layerId);
      // Idempotent by layer id, so the open in scheduleFetch -- which covers
      // the debounce wait -- costs nothing, and a request dispatched by any
      // future path still reports itself.
      openLoading(layerId);

      const requestId = `${sessionNonce}:${gridItemUUID}:${layerId}`;

      return appAPI
        .getVisualizationFeatures({
          dashboard: dashboardUUID,
          tile: gridItemUUID,
          layer: layerId,
          source: pluginSource.source,
          // Every arg for a caller who may edit the dashboard, whose request
          // then runs as sent; a viewer's wired ones only (dataRequestArgs).
          args: dataRequestArgs({
            rawArgs: pluginSource.args,
            resolvedArgs,
            argTypes: findSelectOptionByValue(
              dynamicMapLayers ?? [],
              pluginSource.source,
              "source",
            )?.args,
            kind: "layer",
            allArgs: editable,
          }),
          requestId,
          cancelToken: cancelTokenSource.token,
          allArgs: editable,
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
            // A raster whose plugin reports a failure is in the same position
            // as one whose build failed: there is no file to draw.
            if (isRuntimeRasterConfig(state.configuration)) {
              clearRasterPaint(state, map, layerId);
              clearLegend(layerId);
            }
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
          const olLayer = findOlLayer(map, layerId);
          if (olLayer) {
            paintVector(state, map, olLayer, featureCollection);
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
          if (isRuntimeRasterConfig(state.configuration)) {
            clearRasterPaint(state, mapRef?.current, layerId);
            clearLegend(layerId);
          }
          setError(layerId, {
            message: err?.message ?? "Fetch failed",
            kind: "error",
          });
        });
    },
    [
      sessionNonce,
      dashboardUUID,
      gridItemUUID,
      mapRef,
      onBeforeSwap,
      setError,
      clearError,
      openLoading,
      closeLoading,
      clearLegend,
      paintRaster,
      claimGeneration,
      dynamicMapLayers,
      editable,
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
      // A queued request supersedes whatever is in flight now, not only once it
      // is dispatched: an older request settling during the wait would
      // otherwise close the window this one just opened, and paint a payload
      // for arguments that are no longer current. Its axios request is
      // cancelled when this one is dispatched.
      claimGeneration(layerId);
      cancelPendingSwap(state);
      keepZoomOwed(state);
      // The wait counts as loading. Opening at dispatch instead would leave a
      // quarter-second of silence on every load, and would report a settled map
      // for the whole of a slider drag, where the timer keeps restarting.
      openLoading(layerId);
      state.debounceTimer = setTimeout(() => {
        state.debounceTimer = null;
        performFetch(layerId, pluginSource, resolvedArgs, renderIdentity);
      }, debounceMs);
    },
    [debounceMs, performFetch, openLoading, claimGeneration],
  );

  // Repaint a runtime layer that Map.js rebuilt without its change identity
  // changing -- a layer sync that started before the previous one recorded its
  // layers, or a duplicated layerId -- which would otherwise stay blank (a
  // raster) or empty (a vector) until an argument changed.
  //
  // Only when nothing is outstanding: a request in flight, queued, or waiting
  // for its layer looks the layer up when it lands, so it paints the rebuilt
  // one anyway. The last payload is repainted, not the last build: an OL source
  // cannot be shared between layers, so a raster is built again from it, under
  // a generation of its own that any newer request supersedes.
  const repaintIfRebuilt = useCallback(
    (layerId) => {
      const state = perLayerStateRef.current.get(layerId);
      const map = mapRef?.current;
      if (!state?.lastPaint || !map || !isMountedRef.current) return;
      if (
        state.debounceTimer ||
        state.pendingSwap ||
        loadingRef.current.has(layerId)
      ) {
        return;
      }
      const olLayer = findOlLayer(map, layerId);
      if (!olLayer || olLayer === state.lastPaint.olLayer) return;

      // A vector repaint never zooms; a raster one goes through paintRaster,
      // which delivers a zoom still owed (see keepZoomOwed).
      const { kind, payload } = state.lastPaint;
      const isRaster = isRuntimeRasterConfig(state.configuration);
      // A layer that changed kind is refetched by its identity change.
      // istanbul ignore next
      if ((kind === "raster") !== isRaster) return;
      if (isRaster) {
        paintRaster(layerId, state, payload, claimGeneration(layerId));
        return;
      }
      if (typeof onBeforeSwap === "function") {
        onBeforeSwap(layerId);
      }
      swapVectorPayload(state, map, olLayer, payload);
    },
    [mapRef, onBeforeSwap, paintRaster, claimGeneration],
  );

  useEffect(() => {
    repaintIfRebuiltRef.current = repaintIfRebuilt;
  }, [repaintIfRebuilt]);

  const prevRefreshTickRef = useRef(refreshTick);
  // Whether the layers the map was mounted with have been seen yet.
  const reconciledRef = useRef(false);

  useEffect(() => {
    const refreshTickChanged = prevRefreshTickRef.current !== refreshTick;
    prevRefreshTickRef.current = refreshTick;
    const firstLoad = !reconciledRef.current;
    reconciledRef.current = true;

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
        cancelPendingZoom(state);
        detachSourceErrors(state);
        perLayerStateRef.current.delete(layerId);
        // A response that had already resolved is never rejected by the
        // cancel above, and a raster's build outlives its response: claiming a
        // generation here is what stops either from painting into a layer that
        // is gone, or writing an error against it.
        claimGeneration(layerId);
        closeLoading(layerId);
        clearLegend(layerId);
      }
    });

    runtimeLayers.forEach((layer) => {
      const { layerId, pluginSource } = layer.configuration.props;
      const { resolvedArgs, zoomStamp } = resolveLayerArgs(
        pluginSource,
        layerId,
      );
      // A save that stores or clears one of the layer's secrets changes what
      // the next request runs with, though nothing the request sends changes.
      const renderIdentity = {
        ...changeIdentity(layer.configuration),
        storedSecrets: storedSecretArgs(storedSecrets, {
          tile: gridItemUUID,
          layer: layerId,
        }),
      };
      const schedule = () =>
        scheduleFetch(layerId, pluginSource, resolvedArgs, renderIdentity);

      if (!perLayerStateRef.current.has(layerId)) {
        perLayerStateRef.current.set(layerId, {
          cancelTokenSource: null,
          debounceTimer: null,
          lastResolvedArgs: undefined,
          lastSource: undefined,
          lastRenderIdentity: undefined,
          pendingSwap: null,
          // The zoom stamp the layer's arguments last arrived with.
          seenZoomStamp: zoomStamp,
          // Whether the next paint zooms the map (see noteZoomStamp). True for
          // the layers the map was mounted with, which is the first load; a
          // layer appearing later was added by an edit, which never zooms.
          zoomOwed: firstLoad,
          // Unsubscribes a zoom waiting for the map's size to settle.
          pendingZoom: null,
          // The saved config a raster build starts from. Read when the
          // response lands, not when the request left, so the build uses
          // whatever the author saved last.
          configuration: layer.configuration,
          detachSourceErrors: null,
        });
        // First appearance — always fetch (subject to debounce).
        schedule();
        return;
      }

      const state = perLayerStateRef.current.get(layerId);
      state.configuration = layer.configuration;
      noteZoomStamp(
        state,
        zoomStamp,
        !valuesEqual(state.lastResolvedArgs, resolvedArgs),
      );

      if (refreshTickChanged) {
        schedule();
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
      if (argsUnchanged && sourceUnchanged && renderUnchanged) {
        repaintIfRebuilt(layerId);
        return;
      }

      schedule();
    });

    // Map.js rebuilds a layer asynchronously, after this effect has run, so the
    // check above cannot see most rebuilds. The collection can. A rebuilt layer
    // is usually added before the one it replaces is removed, so it is the
    // removal that exposes it to findOlLayer, but a superseded sync can remove
    // first and add later; "change:length" fires, after the array has changed,
    // for both.
    const map = mapRef?.current;
    const collection = map?.getLayers?.();
    if (collection && collectionWatchRef.current?.collection !== collection) {
      collectionWatchRef.current?.detach();
      const onLengthChange = () => {
        perLayerStateRef.current.forEach((_, layerId) =>
          repaintIfRebuiltRef.current?.(layerId),
        );
      };
      collection.on("change:length", onLengthChange);
      collectionWatchRef.current = {
        collection,
        detach: () => collection.un("change:length", onLengthChange),
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    layers,
    variableInputValues,
    variableInputDateFormats,
    refreshTick,
    editorSecrets,
    storedSecrets,
  ]);

  return { errorsByLayerId, loadingByLayerId, rasterLegendByLayerId };
}
