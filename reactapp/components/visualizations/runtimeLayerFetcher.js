import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import {
  compareFilteredArgs,
  filterNonRelativeDateArgs,
} from "components/visualizations/Base";
import { updateObjectWithVariableInputs } from "components/visualizations/utilities";
import { swapVectorLayerFeatures } from "components/map/utilities";
import appAPI from "services/api/app";

/**
 * Runtime map-layer fetch orchestrator.
 *
 * Orchestrates per-layer feature fetches for dynamic_map_layer plugins:
 *
 * - On mount, on `layers` change, and on `variableInputValues` change, scans
 *   the current layer list for entries with `pluginSource` and determines
 *   which layers have a resolved-args delta that warrants a fetch.
 * - For each layer that needs to fetch, applies a 250ms debounce, cancels
 *   any in-flight fetch for that layer via `axios.CancelToken`, then calls
 *   `appAPI.getVisualizationFeatures({source, args, requestId, cancelToken})`.
 * - On success, locates the OL layer on the map by its `layerId` tag and
 *   swaps in the returned FeatureCollection via `swapVectorLayerFeatures`.
 *   Invokes the optional `onBeforeSwap(layerId)` callback first so Unit 7's
 *   UI can dismiss any open popup before the features are swapped.
 * - On error (other than axios-cancel), records the error in per-layer state.
 * - Caller's `useRuntimeLayerFetcher` gets back `{ errorsByLayerId, retry }`
 *   so Unit 7's LayersControl can render per-layer error indicators and a
 *   Retry action.
 *
 * Dependent-layer cycle handling: no publisher attribution. If layer A's
 * feature click publishes to a variable input that layer A also consumes,
 * A re-fetches itself exactly once (idempotent, debounced, cancellable on
 * supersession). No infinite loop because the second fetch's resolved args
 * match the first and the diff gate suppresses further iterations.
 *
 * Cancellation is transport-layer only — axios-cancel rejects the promise
 * but the backend plugin run continues to completion. Plugin authors must
 * design fetch_features to be idempotent (documented in plugins.rst).
 *
 * The hook guards all state updates behind `isMountedRef` because
 * CancelToken-cancellation still fires the `.catch` handler. Without the
 * guard, late rejections after unmount would trigger React warnings.
 *
 * Reactivity diff ordering (MUST be in this order):
 *   1. raw template args (pluginSource.args)
 *   2. filterNonRelativeDateArgs on raw args → keysToCompare
 *   3. updateObjectWithVariableInputs on raw args → resolvedArgs
 *   4. compareFilteredArgs(lastResolvedArgs, resolvedArgs, keysToCompare)
 *
 * Applying filterNonRelativeDateArgs to resolved args would short-circuit
 * its date-relative suppression (no template tokens to inspect). See
 * Key Technical Decisions in the plan for the rationale.
 *
 * @param {Object} params
 * @param {Array} params.layers — current layer configs (as produced by
 *   visualizations/Map.js). Runtime layers are those with
 *   `configuration.props.pluginSource`.
 * @param {string} params.gridItemUuid — the hosting grid item's UUID,
 *   used to build the composite requestId.
 * @param {string} params.sessionNonce — per-tab nonce from AppContext,
 *   used to prevent cross-tab WebSocket collisions.
 * @param {React.RefObject} params.mapRef — ref to the OL Map instance
 *   so we can locate layers by `layerId`.
 * @param {Object} params.variableInputValues — current VariableInputsContext.
 * @param {Object} params.variableInputDateFormats — date formats from
 *   VariableInputsContext (for filterNonRelativeDateArgs).
 * @param {Function} [params.onBeforeSwap] — optional callback invoked with
 *   (layerId) before the feature swap lands. Unit 7 uses this to dismiss
 *   popups anchored to features about to be removed.
 * @param {number} [params.debounceMs=250] — debounce window for re-fetch
 *   supersession.
 *
 * @returns {Object} { errorsByLayerId, retry }
 *   - errorsByLayerId: { [layerId]: { message, kind: "error" | "unavailable" } }
 *   - retry: (layerId) => void — bypasses debounce; cancels any in-flight
 *     fetch for the layer; fires a fresh request with current args.
 */
export default function useRuntimeLayerFetcher({
  layers,
  gridItemUuid,
  sessionNonce,
  mapRef,
  variableInputValues,
  variableInputDateFormats,
  onBeforeSwap,
  debounceMs = 250,
}) {
  // Per-layer orchestrator state. Refs (not state) because updates inside
  // fetch handlers must be synchronous and must not trigger re-renders.
  const perLayerStateRef = useRef(new Map()); // layerId → state
  const isMountedRef = useRef(true);
  const [errorsByLayerId, setErrorsByLayerId] = useState({});

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cancel every in-flight fetch and clear debounce timers so late
      // rejections don't re-enter setState after unmount.
      perLayerStateRef.current.forEach((state) => {
        if (state.debounceTimer) {
          clearTimeout(state.debounceTimer);
        }
        if (state.cancelTokenSource) {
          state.cancelTokenSource.cancel("unmount");
        }
      });
      perLayerStateRef.current.clear();
    };
  }, []);

  const clearError = useCallback((layerId) => {
    if (!isMountedRef.current) return;
    setErrorsByLayerId((prev) => {
      if (!(layerId in prev)) return prev;
      const next = { ...prev };
      delete next[layerId];
      return next;
    });
  }, []);

  const setError = useCallback((layerId, payload) => {
    if (!isMountedRef.current) return;
    setErrorsByLayerId((prev) => ({ ...prev, [layerId]: payload }));
  }, []);

  // Resolve a runtime layer's args through the same variable-input
  // substitution + date-format machinery Base.js uses. Returns:
  //   - keysToCompare: the arg keys that should drive re-fetch (excludes
  //     args whose only dependents are relative-date inputs).
  //   - resolvedArgs: template-substituted args passed to fetch_features.
  const resolveLayerArgs = useCallback(
    (pluginArgs) => {
      const rawArgs = pluginArgs ?? {};
      const keysToCompare = filterNonRelativeDateArgs(
        rawArgs,
        variableInputValues,
        variableInputDateFormats,
      );
      const resolvedArgs = updateObjectWithVariableInputs({
        args: rawArgs,
        variableInputs: variableInputValues ?? {},
        variableInputDateFormats,
      });
      return { keysToCompare, resolvedArgs };
    },
    [variableInputValues, variableInputDateFormats],
  );

  // Fire the actual fetch for a single layer with current resolved args.
  // Returns the Promise so retry() can be awaited by tests.
  const performFetch = useCallback(
    (layerId, pluginSource, resolvedArgs) => {
      const state = perLayerStateRef.current.get(layerId);
      if (!state) return Promise.resolve();

      // Supersede any in-flight fetch for this layer before issuing a new
      // one. Axios CancelToken rejects the prior promise; the .catch arm
      // below detects axios.isCancel and is a no-op for the cancelled run.
      if (state.cancelTokenSource) {
        state.cancelTokenSource.cancel("superseded");
      }
      const cancelTokenSource = axios.CancelToken.source();
      state.cancelTokenSource = cancelTokenSource;
      state.lastResolvedArgs = resolvedArgs;

      const requestId = `${sessionNonce}:${gridItemUuid}:${layerId}`;

      return appAPI
        .getVisualizationFeatures({
          source: pluginSource.source,
          args: resolvedArgs,
          requestId,
          cancelToken: cancelTokenSource.token,
        })
        .then((response) => {
          if (!isMountedRef.current) return;
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
          // Swap features into the preserved OL layer. onBeforeSwap lets
          // Unit 7 dismiss any popup anchored to features about to go away.
          if (typeof onBeforeSwap === "function") {
            onBeforeSwap(layerId);
          }
          const map = mapRef?.current;
          if (!map) return;
          const olLayer = map
            .getLayers()
            .getArray()
            .find((l) => l.get("layerId") === layerId);
          if (olLayer) {
            const mapProjection = map.getView().getProjection().getCode();
            swapVectorLayerFeatures(
              olLayer,
              response?.data ?? null,
              mapProjection,
            );
          }
          clearError(layerId);
        })
        .catch((err) => {
          if (axios.isCancel(err)) return; // superseded / unmount
          if (!isMountedRef.current) return;
          setError(layerId, {
            message: err?.message ?? "Fetch failed",
            kind: "error",
          });
        });
    },
    [sessionNonce, gridItemUuid, mapRef, onBeforeSwap, setError, clearError],
  );

  // Schedule a debounced fetch for a layer. Cancels any pending debounce
  // timer and any in-flight fetch, then schedules a new one `debounceMs`
  // later. Called from the reactivity effect on diff.
  const scheduleFetch = useCallback(
    (layerId, pluginSource, resolvedArgs) => {
      const state = perLayerStateRef.current.get(layerId);
      if (!state) return;
      if (state.debounceTimer) {
        clearTimeout(state.debounceTimer);
      }
      state.debounceTimer = setTimeout(() => {
        state.debounceTimer = null;
        performFetch(layerId, pluginSource, resolvedArgs);
      }, debounceMs);
    },
    [debounceMs, performFetch],
  );

  // Immediate retry (no debounce) — used by Unit 7's Retry action.
  const retry = useCallback(
    (layerId) => {
      const layer = (layers ?? []).find(
        (l) => l?.configuration?.props?.layerId === layerId,
      );
      if (!layer) return;
      const pluginSource = layer.configuration.props.pluginSource;
      if (!pluginSource) return;
      if (!perLayerStateRef.current.has(layerId)) {
        perLayerStateRef.current.set(layerId, {
          cancelTokenSource: null,
          debounceTimer: null,
          lastResolvedArgs: undefined,
        });
      }
      const state = perLayerStateRef.current.get(layerId);
      if (state.debounceTimer) {
        clearTimeout(state.debounceTimer);
        state.debounceTimer = null;
      }
      const { resolvedArgs } = resolveLayerArgs(pluginSource.args);
      performFetch(layerId, pluginSource, resolvedArgs);
    },
    [layers, resolveLayerArgs, performFetch],
  );

  // Main reactivity effect. Iterates runtime layers, diffs against the
  // prior resolved args for each, and schedules a debounced fetch when the
  // diff indicates a re-fetch is needed (or when it's the layer's first
  // appearance).
  useEffect(() => {
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
        if (state.cancelTokenSource) state.cancelTokenSource.cancel("removed");
        perLayerStateRef.current.delete(layerId);
      }
    });

    runtimeLayers.forEach((layer) => {
      const { layerId, pluginSource } = layer.configuration.props;
      const { keysToCompare, resolvedArgs } = resolveLayerArgs(
        pluginSource.args,
      );

      if (!perLayerStateRef.current.has(layerId)) {
        perLayerStateRef.current.set(layerId, {
          cancelTokenSource: null,
          debounceTimer: null,
          lastResolvedArgs: undefined,
        });
        // First appearance — always fetch (subject to debounce).
        scheduleFetch(layerId, pluginSource, resolvedArgs);
        return;
      }

      const state = perLayerStateRef.current.get(layerId);
      const argsUnchanged = compareFilteredArgs(
        state.lastResolvedArgs,
        resolvedArgs,
        keysToCompare,
      );
      if (argsUnchanged) return;

      scheduleFetch(layerId, pluginSource, resolvedArgs);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, variableInputValues, variableInputDateFormats]);

  return { errorsByLayerId, retry };
}
