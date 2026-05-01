import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { updateObjectWithVariableInputs } from "components/visualizations/utilities";
import { swapVectorLayerFeatures } from "components/map/utilities";
import appAPI from "services/api/app";
import { valuesEqual } from "components/modals/utilities";

export default function useRuntimeLayerFetcher({
  layers,
  gridItemUuid,
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
          state.cancelTokenSource.cancel("unmount");
        }
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

  const scheduleFetch = useCallback(
    (layerId, pluginSource, resolvedArgs) => {
      const state = perLayerStateRef.current.get(layerId);
      // istanbul ignore next
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
        if (state.cancelTokenSource) state.cancelTokenSource.cancel("removed");
        perLayerStateRef.current.delete(layerId);
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
      const argsUnchanged = valuesEqual(state.lastResolvedArgs, resolvedArgs);
      if (argsUnchanged) return;

      scheduleFetch(layerId, pluginSource, resolvedArgs);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, variableInputValues, variableInputDateFormats, refreshTick]);

  return { errorsByLayerId, retry };
}
