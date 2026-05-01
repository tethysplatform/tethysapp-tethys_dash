import { renderHook, act, waitFor } from "@testing-library/react";
import axios from "axios";
import useRuntimeLayerFetcher from "components/visualizations/runtimeLayerFetcher";
import appAPI from "services/api/app";
import * as mapUtilities from "components/map/utilities";

// Minimal fake OL Map + VectorLayer that exposes the surface the orchestrator
// interacts with: getLayers().getArray().find(l => l.get("layerId") === id),
// getView().getProjection().getCode(), and a source with clear/addFeatures.
function fakeOlLayer(layerId) {
  const source = {
    clear: jest.fn(),
    addFeatures: jest.fn(),
  };
  return {
    _layerId: layerId,
    get: (key) => (key === "layerId" ? layerId : undefined),
    getSource: () => source,
    _source: source,
  };
}

function fakeOlMap(olLayers) {
  return {
    getLayers: () => ({ getArray: () => olLayers }),
    getView: () => ({
      getProjection: () => ({ getCode: () => "EPSG:3857" }),
    }),
  };
}

function runtimeLayerConfig({
  layerId = "layer-1",
  name = "Runtime A",
  source = "my_plugin",
  args = {},
} = {}) {
  return {
    configuration: {
      type: "VectorLayer",
      props: {
        name,
        layerId,
        pluginSource: { source, args },
        source: {
          type: "GeoJSON",
          props: {},
          geojson: {
            type: "FeatureCollection",
            features: [],
            crs: { type: "name", properties: { name: "EPSG:4326" } },
          },
        },
      },
    },
  };
}

const validFc = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { id: 1 },
      geometry: { type: "Point", coordinates: [0, 0] },
    },
  ],
  crs: { type: "name", properties: { name: "EPSG:4326" } },
};

describe("useRuntimeLayerFetcher", () => {
  let getFeaturesMock;
  let swapSpy;

  beforeEach(() => {
    jest.useFakeTimers();
    getFeaturesMock = jest
      .spyOn(appAPI, "getVisualizationFeatures")
      .mockResolvedValue({
        success: true,
        viz_type: "features",
        data: validFc,
      });
    swapSpy = jest
      .spyOn(mapUtilities, "swapVectorLayerFeatures")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("fetches once after debounce on mount", async () => {
    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const layers = [runtimeLayerConfig({ layerId: "layer-1" })];

    renderHook(() =>
      useRuntimeLayerFetcher({
        layers,
        gridItemUuid: "grid-a",
        sessionNonce: "nonce",
        mapRef,
        variableInputValues: {},
        variableInputDateFormats: {},
      }),
    );

    // No fetch yet — still inside debounce.
    expect(getFeaturesMock).not.toHaveBeenCalled();

    // Advance past the 250ms debounce.
    await act(async () => {
      jest.advanceTimersByTime(250);
      // Allow promise microtasks to flush.
      await Promise.resolve();
    });

    expect(getFeaturesMock).toHaveBeenCalledTimes(1);
    const call = getFeaturesMock.mock.calls[0][0];
    expect(call.source).toBe("my_plugin");
    expect(call.requestId).toBe("nonce:grid-a:layer-1");

    await waitFor(() => {
      expect(swapSpy).toHaveBeenCalledTimes(1);
    });
    expect(swapSpy.mock.calls[0][0]).toBe(olLayer);
    expect(swapSpy.mock.calls[0][1]).toBe(validFc);
    expect(swapSpy.mock.calls[0][2]).toBe("EPSG:3857");
  });

  test("rapid variable-input changes within debounce only fire once", async () => {
    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const layers = [runtimeLayerConfig({ args: { bbox: "${BBox}" } })];

    const { rerender } = renderHook(
      ({ variableInputValues }) =>
        useRuntimeLayerFetcher({
          layers,
          gridItemUuid: "g",
          sessionNonce: "n",
          mapRef,
          variableInputValues,
          variableInputDateFormats: {},
        }),
      { initialProps: { variableInputValues: { BBox: "1,2,3,4" } } },
    );

    // Simulate three quick changes within the 250ms debounce window.
    rerender({ variableInputValues: { BBox: "1,2,3,5" } });
    rerender({ variableInputValues: { BBox: "1,2,3,6" } });
    rerender({ variableInputValues: { BBox: "1,2,3,7" } });

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    // Only one fetch fires — the final settled value.
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);
    const call = getFeaturesMock.mock.calls[0][0];
    expect(call.args.bbox).toBe("1,2,3,7");
  });

  test("empty or missing args fire a single fetch on mount (no re-fire)", async () => {
    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const layers = [runtimeLayerConfig({ args: {} })];

    const { rerender } = renderHook(
      ({ variableInputValues }) =>
        useRuntimeLayerFetcher({
          layers,
          gridItemUuid: "g",
          sessionNonce: "n",
          mapRef,
          variableInputValues,
          variableInputDateFormats: {},
        }),
      { initialProps: { variableInputValues: {} } },
    );

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);

    // Unrelated variable change — args still {} → no re-fetch.
    rerender({ variableInputValues: { SomeUnrelated: "hi" } });
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);
  });

  test("two layers sharing a variable input fetch in parallel with distinct requestIds", async () => {
    const olA = fakeOlLayer("layer-a");
    const olB = fakeOlLayer("layer-b");
    const mapRef = { current: fakeOlMap([olA, olB]) };
    const layers = [
      runtimeLayerConfig({ layerId: "layer-a", args: { v: "${X}" } }),
      runtimeLayerConfig({ layerId: "layer-b", args: { v: "${X}" } }),
    ];

    renderHook(() =>
      useRuntimeLayerFetcher({
        layers,
        gridItemUuid: "g",
        sessionNonce: "n",
        mapRef,
        variableInputValues: { X: 1 },
        variableInputDateFormats: {},
      }),
    );

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(getFeaturesMock).toHaveBeenCalledTimes(2);
    const requestIds = getFeaturesMock.mock.calls.map((c) => c[0].requestId);
    expect(requestIds).toEqual(
      expect.arrayContaining(["n:g:layer-a", "n:g:layer-b"]),
    );
  });

  test("plugin-not-available error surfaces as kind=unavailable", async () => {
    getFeaturesMock.mockResolvedValueOnce({
      success: false,
      data: { error: "Plugin not available" },
    });

    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const layers = [runtimeLayerConfig()];

    const { result } = renderHook(() =>
      useRuntimeLayerFetcher({
        layers,
        gridItemUuid: "g",
        sessionNonce: "n",
        mapRef,
        variableInputValues: {},
        variableInputDateFormats: {},
      }),
    );

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.errorsByLayerId["layer-1"]).toBeDefined();
    });
    expect(result.current.errorsByLayerId["layer-1"].kind).toBe("unavailable");
    expect(result.current.errorsByLayerId["layer-1"].message).toBe(
      "Plugin not available",
    );
    // No features swap on error — OL layer source untouched.
    expect(swapSpy).not.toHaveBeenCalled();
  });

  test("generic plugin error surfaces as kind=error and doesn't block other layers", async () => {
    getFeaturesMock.mockImplementation(({ source }) =>
      Promise.resolve(
        source === "broken"
          ? { success: false, data: { error: "boom" } }
          : { success: true, data: validFc },
      ),
    );

    const olA = fakeOlLayer("layer-a");
    const olB = fakeOlLayer("layer-b");
    const mapRef = { current: fakeOlMap([olA, olB]) };
    const layers = [
      runtimeLayerConfig({ layerId: "layer-a", source: "broken" }),
      runtimeLayerConfig({ layerId: "layer-b", source: "healthy" }),
    ];

    const { result } = renderHook(() =>
      useRuntimeLayerFetcher({
        layers,
        gridItemUuid: "g",
        sessionNonce: "n",
        mapRef,
        variableInputValues: {},
        variableInputDateFormats: {},
      }),
    );

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
      // Let all microtasks settle.
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.errorsByLayerId["layer-a"]).toBeDefined();
    });
    expect(result.current.errorsByLayerId["layer-a"].kind).toBe("error");
    expect(result.current.errorsByLayerId["layer-a"].message).toBe("boom");
    expect(result.current.errorsByLayerId["layer-b"]).toBeUndefined();
    // Healthy layer's features still got swapped.
    expect(swapSpy.mock.calls.some((call) => call[0] === olB)).toBe(true);
  });

  test("successful fetch clears prior error state for that layer", async () => {
    getFeaturesMock
      .mockResolvedValueOnce({ success: false, data: { error: "boom" } })
      .mockResolvedValueOnce({ success: true, data: validFc });

    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const layers = [runtimeLayerConfig()];

    const { result } = renderHook(() =>
      useRuntimeLayerFetcher({
        layers,
        gridItemUuid: "g",
        sessionNonce: "n",
        mapRef,
        variableInputValues: {},
        variableInputDateFormats: {},
      }),
    );

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.errorsByLayerId["layer-1"]).toBeDefined();
    });

    // Retry → second mock returns success → error state cleared.
    act(() => {
      result.current.retry("layer-1");
    });
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.errorsByLayerId["layer-1"]).toBeUndefined();
    });
  });

  test("retry bypasses debounce and cancels prior in-flight", async () => {
    // First call never resolves (simulated in-flight); second call returns.
    let firstCancelled = false;
    getFeaturesMock.mockImplementationOnce(({ cancelToken }) => {
      // Axios attaches a cancellation listener via promise subscribe/throwIfRequested.
      // We simulate by checking cancellation inside the returned promise.
      return new Promise((resolve, reject) => {
        if (cancelToken && typeof cancelToken.promise?.then === "function") {
          cancelToken.promise.then((reason) => {
            firstCancelled = true;
            reject(new axios.Cancel(reason?.message ?? "cancel"));
          });
        }
      });
    });
    getFeaturesMock.mockResolvedValueOnce({
      success: true,
      data: validFc,
    });

    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const layers = [runtimeLayerConfig()];

    const { result } = renderHook(() =>
      useRuntimeLayerFetcher({
        layers,
        gridItemUuid: "g",
        sessionNonce: "n",
        mapRef,
        variableInputValues: {},
        variableInputDateFormats: {},
      }),
    );

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    // First fetch is in-flight (never resolves).
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);

    // Retry fires a second fetch immediately without debounce and cancels
    // the first via the layer's cancelTokenSource.
    act(() => {
      result.current.retry("layer-1");
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getFeaturesMock).toHaveBeenCalledTimes(2);
    expect(firstCancelled).toBe(true);
    // No error state recorded for the cancelled first fetch.
    expect(result.current.errorsByLayerId["layer-1"]).toBeUndefined();
  });

  test("unmount cancels in-flight fetches without setState warning", async () => {
    // Never-resolving fetch so unmount has something to cancel.
    let cancelled = false;
    getFeaturesMock.mockImplementation(({ cancelToken }) => {
      return new Promise((_, reject) => {
        cancelToken?.promise?.then?.((reason) => {
          cancelled = true;
          reject(new axios.Cancel(reason?.message ?? "cancel"));
        });
      });
    });

    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const layers = [runtimeLayerConfig()];

    const warnSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = renderHook(() =>
      useRuntimeLayerFetcher({
        layers,
        gridItemUuid: "g",
        sessionNonce: "n",
        mapRef,
        variableInputValues: {},
        variableInputDateFormats: {},
      }),
    );

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    unmount();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(cancelled).toBe(true);
    // No React setState-after-unmount warnings logged.
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test("non-runtime layers (no pluginSource) are ignored", async () => {
    const layers = [
      {
        configuration: {
          type: "ImageLayer",
          props: {
            name: "static",
            source: { type: "WMS", props: {} },
          },
        },
      },
    ];

    renderHook(() =>
      useRuntimeLayerFetcher({
        layers,
        gridItemUuid: "g",
        sessionNonce: "n",
        mapRef: { current: fakeOlMap([]) },
        variableInputValues: {},
        variableInputDateFormats: {},
      }),
    );

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(getFeaturesMock).not.toHaveBeenCalled();
  });

  test("refreshTick increment forces a re-fetch even when args are unchanged", async () => {
    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const layers = [runtimeLayerConfig({ args: { x: 1 } })];

    const { rerender } = renderHook(
      ({ refreshTick }) =>
        useRuntimeLayerFetcher({
          layers,
          gridItemUuid: "g",
          sessionNonce: "n",
          mapRef,
          variableInputValues: {},
          variableInputDateFormats: {},
          refreshTick,
        }),
      { initialProps: { refreshTick: 0 } },
    );

    // Initial mount fetch.
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);

    // Same args, same layers — normally the diff gate would suppress the
    // fetch. But refreshTick incrementing forces it through.
    rerender({ refreshTick: 1 });
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(getFeaturesMock).toHaveBeenCalledTimes(2);

    // Another tick — another fetch.
    rerender({ refreshTick: 2 });
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(getFeaturesMock).toHaveBeenCalledTimes(3);
  });

  test("unmount during pending debounce clears the queued timer", async () => {
    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const layers = [runtimeLayerConfig({ layerId: "layer-1" })];

    const { unmount } = renderHook(() =>
      useRuntimeLayerFetcher({
        layers,
        gridItemUuid: "g",
        sessionNonce: "n",
        mapRef,
        variableInputValues: {},
        variableInputDateFormats: {},
      }),
    );

    // Debounce is queued but has not fired yet.
    expect(getFeaturesMock).not.toHaveBeenCalled();

    unmount();

    // Advance past the debounce window — if cleanup didn't clear the timer,
    // performFetch would fire here.
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(getFeaturesMock).not.toHaveBeenCalled();
  });

  test("onBeforeSwap is invoked with the layerId before swapping features", async () => {
    const onBeforeSwap = jest.fn();
    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const layers = [runtimeLayerConfig({ layerId: "layer-1" })];

    renderHook(() =>
      useRuntimeLayerFetcher({
        layers,
        gridItemUuid: "g",
        sessionNonce: "n",
        mapRef,
        variableInputValues: {},
        variableInputDateFormats: {},
        onBeforeSwap,
      }),
    );

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(swapSpy).toHaveBeenCalledTimes(1);
    });
    expect(onBeforeSwap).toHaveBeenCalledTimes(1);
    expect(onBeforeSwap).toHaveBeenCalledWith("layer-1");
    // onBeforeSwap fires before the actual swap.
    expect(onBeforeSwap.mock.invocationCallOrder[0]).toBeLessThan(
      swapSpy.mock.invocationCallOrder[0],
    );
  });

  test("rejected (non-cancel) fetch surfaces as kind=error with the thrown message", async () => {
    getFeaturesMock.mockRejectedValueOnce(new Error("network down"));

    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const layers = [runtimeLayerConfig({ layerId: "layer-1" })];

    const { result } = renderHook(() =>
      useRuntimeLayerFetcher({
        layers,
        gridItemUuid: "g",
        sessionNonce: "n",
        mapRef,
        variableInputValues: {},
        variableInputDateFormats: {},
      }),
    );

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.errorsByLayerId["layer-1"]).toBeDefined();
    });
    expect(result.current.errorsByLayerId["layer-1"]).toEqual({
      message: "network down",
      kind: "error",
    });
    expect(swapSpy).not.toHaveBeenCalled();
  });

  test("retry clears a pending debounce timer so only the immediate fetch fires", async () => {
    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const layers = [runtimeLayerConfig({ layerId: "layer-1" })];

    const { result } = renderHook(() =>
      useRuntimeLayerFetcher({
        layers,
        gridItemUuid: "g",
        sessionNonce: "n",
        mapRef,
        variableInputValues: {},
        variableInputDateFormats: {},
      }),
    );

    // Mount queued a debounce timer; nothing has fetched yet.
    expect(getFeaturesMock).not.toHaveBeenCalled();

    act(() => {
      result.current.retry("layer-1");
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Immediate retry fired exactly once.
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);

    // The originally-queued debounce timer should have been cleared by retry.
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);
  });

  test("retry re-creates orchestrator state when prior state was cleared", async () => {
    const olLayer = fakeOlLayer("layer-a");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const initialLayers = [runtimeLayerConfig({ layerId: "layer-a" })];

    const { result, rerender } = renderHook(
      ({ layers }) =>
        useRuntimeLayerFetcher({
          layers,
          gridItemUuid: "g",
          sessionNonce: "n",
          mapRef,
          variableInputValues: {},
          variableInputDateFormats: {},
        }),
      { initialProps: { layers: initialLayers } },
    );

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);

    // Capture the retry callback whose closure still references the original
    // layers array — before the rerender swaps it out.
    const staleRetry = result.current.retry;

    // Rerender with no layers — orchestrator state for "layer-a" is deleted
    // by the cleanup branch.
    rerender({ layers: [] });

    // Stale-closure retry: layer is still findable in its captured `layers`,
    // but perLayerStateRef has no entry → forces the state.set branch.
    act(() => {
      staleRetry("layer-a");
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(getFeaturesMock).toHaveBeenCalledTimes(2);
  });

  test("orchestrator state cleared when a layer is removed from the map", async () => {
    const olA = fakeOlLayer("layer-a");
    const mapRef = { current: fakeOlMap([olA]) };
    const initialLayers = [runtimeLayerConfig({ layerId: "layer-a" })];

    const { rerender } = renderHook(
      ({ layers }) =>
        useRuntimeLayerFetcher({
          layers,
          gridItemUuid: "g",
          sessionNonce: "n",
          mapRef,
          variableInputValues: {},
          variableInputDateFormats: {},
        }),
      { initialProps: { layers: initialLayers } },
    );

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);

    // Remove the layer — orchestrator should not re-fire on subsequent
    // variable input changes.
    rerender({ layers: [] });
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);
  });
});
