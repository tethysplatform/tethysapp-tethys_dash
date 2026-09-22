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
  // The layer collection must be a stable object with working on/un, because a
  // fetch that lands before its layer exists waits on the collection's "add"
  // event rather than discarding the payload.
  const addListeners = [];
  const collection = {
    getArray: () => olLayers,
    on: (type, fn) => {
      if (type === "add") addListeners.push(fn);
    },
    un: (type, fn) => {
      if (type !== "add") return;
      const i = addListeners.indexOf(fn);
      if (i !== -1) addListeners.splice(i, 1);
    },
  };
  return {
    getLayers: () => collection,
    getView: () => ({
      getProjection: () => ({ getCode: () => "EPSG:3857" }),
    }),
    // Mimics Map.js finishing its async layer construction.
    addLayerLate: (layer) => {
      olLayers.push(layer);
      addListeners.slice().forEach((fn) => fn());
    },
    pendingAddListeners: () => addListeners.length,
  };
}

function runtimeLayerConfig({
  layerId = "layer-1",
  name = "Runtime A",
  source = "my_plugin",
  args = {},
  type = "VectorLayer",
  imageRatio,
} = {}) {
  return {
    configuration: {
      type,
      props: {
        name,
        layerId,
        imageRatio,
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

// Stable identities: the reconciliation effect keys on these by reference, so
// fresh literals per render would re-run it every render.
const noVariableInputs = {};
const noDateFormats = {};

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
        gridItemUUID: "grid-a",
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
    // eslint-disable-next-line no-template-curly-in-string
    const layers = [runtimeLayerConfig({ args: { bbox: "${BBox}" } })];

    const { rerender } = renderHook(
      ({ variableInputValues }) =>
        useRuntimeLayerFetcher({
          layers,
          gridItemUUID: "g",
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
          gridItemUUID: "g",
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
      // eslint-disable-next-line no-template-curly-in-string
      runtimeLayerConfig({ layerId: "layer-a", args: { v: "${X}" } }),
      // eslint-disable-next-line no-template-curly-in-string
      runtimeLayerConfig({ layerId: "layer-b", args: { v: "${X}" } }),
    ];

    renderHook(() =>
      useRuntimeLayerFetcher({
        layers,
        gridItemUUID: "g",
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
        gridItemUUID: "g",
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
        gridItemUUID: "g",
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

    const { result, rerender } = renderHook(
      ({ refreshTick }) =>
        useRuntimeLayerFetcher({
          layers,
          gridItemUUID: "g",
          sessionNonce: "n",
          mapRef,
          variableInputValues: noVariableInputs,
          variableInputDateFormats: noDateFormats,
          refreshTick,
        }),
      { initialProps: { refreshTick: 0 } },
    );

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.errorsByLayerId["layer-1"]).toBeDefined();
    });

    // A refresh drives the second fetch; success clears the error state.
    rerender({ refreshTick: 1 });
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.errorsByLayerId["layer-1"]).toBeUndefined();
    });
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
        gridItemUUID: "g",
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
        gridItemUUID: "g",
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
          gridItemUUID: "g",
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
        gridItemUUID: "g",
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
        gridItemUUID: "g",
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
        gridItemUUID: "g",
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

  test("orchestrator state cleared when a layer is removed from the map", async () => {
    const olA = fakeOlLayer("layer-a");
    const mapRef = { current: fakeOlMap([olA]) };
    const initialLayers = [runtimeLayerConfig({ layerId: "layer-a" })];

    const { rerender } = renderHook(
      ({ layers }) =>
        useRuntimeLayerFetcher({
          layers,
          gridItemUUID: "g",
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

  test("mapRef is nullish — no swap, no error, no crash", async () => {
    const layers = [runtimeLayerConfig({ layerId: "layer-1" })];

    const { result } = renderHook(() =>
      useRuntimeLayerFetcher({
        layers,
        gridItemUUID: "g",
        sessionNonce: "n",
        mapRef: null,
        variableInputValues: {},
        variableInputDateFormats: {},
      }),
    );

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getFeaturesMock).toHaveBeenCalledTimes(1);
    expect(swapSpy).not.toHaveBeenCalled();
    expect(result.current.errorsByLayerId).toEqual({});
  });

  describe("when the fetch lands before its OL layer exists", () => {
    // Map.js builds layers asynchronously, so on a dashboard load the first
    // fetch can win the race. The payload must be held rather than dropped:
    // performFetch records the resolved args before requesting, so a discarded
    // payload was never refetched and the layer stayed blank until an argument
    // actually changed.
    const setup = () => {
      const otherLayer = fakeOlLayer("other-layer");
      const map = fakeOlMap([otherLayer]);
      const layers = [runtimeLayerConfig({ layerId: "layer-1" })];
      const view = renderHook(() =>
        useRuntimeLayerFetcher({
          layers,
          gridItemUUID: "g",
          sessionNonce: "n",
          mapRef: { current: map },
          variableInputValues: {},
          variableInputDateFormats: {},
        }),
      );
      return { map, layers, view };
    };

    const settle = async () => {
      await act(async () => {
        jest.advanceTimersByTime(250);
        await Promise.resolve();
        await Promise.resolve();
      });
    };

    test("paints as soon as the layer is added", async () => {
      const { map } = setup();
      await settle();

      expect(getFeaturesMock).toHaveBeenCalledTimes(1);
      expect(swapSpy).not.toHaveBeenCalled();
      expect(map.pendingAddListeners()).toBe(1);

      const late = fakeOlLayer("layer-1");
      await act(async () => {
        map.addLayerLate(late);
      });

      expect(swapSpy).toHaveBeenCalledTimes(1);
      expect(swapSpy.mock.calls[0][0]).toBe(late);
      // No refetch was needed to get the features onto the map.
      expect(getFeaturesMock).toHaveBeenCalledTimes(1);
      // The listener is released once it has fired.
      expect(map.pendingAddListeners()).toBe(0);
    });

    test("an unrelated layer arriving does not consume the pending swap", async () => {
      const { map } = setup();
      await settle();

      await act(async () => {
        map.addLayerLate(fakeOlLayer("someone-else"));
      });
      expect(swapSpy).not.toHaveBeenCalled();
      expect(map.pendingAddListeners()).toBe(1);

      await act(async () => {
        map.addLayerLate(fakeOlLayer("layer-1"));
      });
      expect(swapSpy).toHaveBeenCalledTimes(1);
    });

    test("unmounting releases the pending listener", async () => {
      const { map, view } = setup();
      await settle();
      expect(map.pendingAddListeners()).toBe(1);

      view.unmount();
      expect(map.pendingAddListeners()).toBe(0);

      await act(async () => {
        map.addLayerLate(fakeOlLayer("layer-1"));
      });
      expect(swapSpy).not.toHaveBeenCalled();
    });
  });

  test("success: false with empty data falls back to 'Unknown error'", async () => {
    getFeaturesMock.mockResolvedValueOnce({ success: false, data: {} });

    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const layers = [runtimeLayerConfig({ layerId: "layer-1" })];

    const { result } = renderHook(() =>
      useRuntimeLayerFetcher({
        layers,
        gridItemUUID: "g",
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
      message: "Unknown error",
      kind: "error",
    });
  });

  test("error containing 'does not support' surfaces as kind=unavailable", async () => {
    getFeaturesMock.mockResolvedValueOnce({
      success: false,
      data: { error: "Plugin does not support that argument" },
    });

    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const layers = [runtimeLayerConfig({ layerId: "layer-1" })];

    const { result } = renderHook(() =>
      useRuntimeLayerFetcher({
        layers,
        gridItemUUID: "g",
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
  });

  test("rejection without a message defaults to 'Fetch failed'", async () => {
    getFeaturesMock.mockRejectedValueOnce({});

    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const layers = [runtimeLayerConfig({ layerId: "layer-1" })];

    const { result } = renderHook(() =>
      useRuntimeLayerFetcher({
        layers,
        gridItemUUID: "g",
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
      message: "Fetch failed",
      kind: "error",
    });
  });

  test("late success resolution after unmount returns early without swapping", async () => {
    let capturedResolve;
    getFeaturesMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          capturedResolve = resolve;
        }),
    );

    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const layers = [runtimeLayerConfig({ layerId: "layer-1" })];

    const warnSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = renderHook(() =>
      useRuntimeLayerFetcher({
        layers,
        gridItemUUID: "g",
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
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => {
      capturedResolve({ success: true, data: validFc });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(swapSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test("late non-cancel rejection after unmount returns early without setError", async () => {
    let capturedReject;
    getFeaturesMock.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          capturedReject = reject;
        }),
    );

    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const layers = [runtimeLayerConfig({ layerId: "layer-1" })];

    const warnSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = renderHook(() =>
      useRuntimeLayerFetcher({
        layers,
        gridItemUUID: "g",
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
      capturedReject(new Error("late"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(swapSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test("undefined layers prop is treated as empty (no fetch)", async () => {
    renderHook(() =>
      useRuntimeLayerFetcher({
        layers: undefined,
        gridItemUUID: "g",
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

  test("layer without args and undefined variableInputValues fetches with empty args", async () => {
    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const layers = [
      {
        configuration: {
          type: "VectorLayer",
          props: {
            name: "Runtime A",
            layerId: "layer-1",
            // pluginSource has no `args` field — exercises `pluginArgs ?? {}`.
            pluginSource: { source: "my_plugin" },
            source: { type: "GeoJSON", props: {} },
          },
        },
      },
    ];

    renderHook(() =>
      useRuntimeLayerFetcher({
        layers,
        gridItemUUID: "g",
        sessionNonce: "n",
        mapRef,
        // exercises `variableInputValues ?? {}`.
        variableInputValues: undefined,
        variableInputDateFormats: {},
      }),
    );

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(getFeaturesMock).toHaveBeenCalledTimes(1);
    expect(getFeaturesMock.mock.calls[0][0].args).toEqual({});
  });

  test("successful response without a data field swaps with null features", async () => {
    getFeaturesMock.mockResolvedValueOnce({ success: true });

    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const layers = [runtimeLayerConfig({ layerId: "layer-1" })];

    renderHook(() =>
      useRuntimeLayerFetcher({
        layers,
        gridItemUUID: "g",
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
      expect(swapSpy).toHaveBeenCalledTimes(1);
    });
    // response.data is undefined → `?? null` → swap called with null.
    expect(swapSpy.mock.calls[0][1]).toBeNull();
  });

  test("layer removed mid-debounce clears the timer with no cancel token to cancel", async () => {
    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const initialLayers = [runtimeLayerConfig({ layerId: "layer-1" })];

    const { rerender } = renderHook(
      ({ layers }) =>
        useRuntimeLayerFetcher({
          layers,
          gridItemUUID: "g",
          sessionNonce: "n",
          mapRef,
          variableInputValues: {},
          variableInputDateFormats: {},
        }),
      { initialProps: { layers: initialLayers } },
    );

    // Mount queued debounce; cancelTokenSource is still null because the
    // fetch hasn't fired yet.
    expect(getFeaturesMock).not.toHaveBeenCalled();

    // Remove the layer before the debounce fires — cleanup branch sees
    // debounceTimer truthy AND cancelTokenSource null.
    rerender({ layers: [] });

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(getFeaturesMock).not.toHaveBeenCalled();
  });

  test("a changed plugin source refetches even when the arguments match", async () => {
    // Editing a layer's plugin source rebuilds the layer, because identity
    // preservation requires the same source. Comparing arguments alone left
    // that rebuilt layer blank forever -- nothing refetched, so nothing was
    // ever painted into it.
    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const first = [
      runtimeLayerConfig({ layerId: "layer-1", source: "plugin_a" }),
    ];
    const second = [
      runtimeLayerConfig({ layerId: "layer-1", source: "plugin_b" }),
    ];

    const { rerender } = renderHook(
      ({ currentLayers }) =>
        useRuntimeLayerFetcher({
          layers: currentLayers,
          gridItemUUID: "grid-a",
          sessionNonce: "nonce",
          mapRef,
          variableInputValues: undefined,
          variableInputDateFormats: undefined,
        }),
      { initialProps: { currentLayers: first } },
    );

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);
    expect(getFeaturesMock.mock.calls[0][0].source).toBe("plugin_a");

    rerender({ currentLayers: second });
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(getFeaturesMock).toHaveBeenCalledTimes(2);
    expect(getFeaturesMock.mock.calls[1][0].source).toBe("plugin_b");
  });

  test("switching a layer to image rendering refetches", async () => {
    // Opting into VectorImageLayer changes the layer class, which Map.js
    // cannot apply to a live OL layer -- so it rebuilds. Comparing arguments
    // and plugin source alone left that rebuilt layer blank: the layer
    // vanished from the map and only came back on a page reload.
    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const asVector = [runtimeLayerConfig({ layerId: "layer-1" })];
    const asImage = [
      runtimeLayerConfig({ layerId: "layer-1", type: "VectorImageLayer" }),
    ];

    const { rerender } = renderHook(
      ({ currentLayers }) =>
        useRuntimeLayerFetcher({
          layers: currentLayers,
          gridItemUUID: "grid-a",
          sessionNonce: "nonce",
          mapRef,
          variableInputValues: undefined,
          variableInputDateFormats: undefined,
        }),
      { initialProps: { currentLayers: asVector } },
    );

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);

    rerender({ currentLayers: asImage });
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(getFeaturesMock).toHaveBeenCalledTimes(2);
  });

  test("changing imageRatio refetches", async () => {
    // OpenLayers exposes no setter for imageRatio, so this also rebuilds.
    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const base = {
      layerId: "layer-1",
      type: "VectorImageLayer",
    };
    const first = [runtimeLayerConfig({ ...base, imageRatio: 1 })];
    const second = [runtimeLayerConfig({ ...base, imageRatio: 1.5 })];

    const { rerender } = renderHook(
      ({ currentLayers }) =>
        useRuntimeLayerFetcher({
          layers: currentLayers,
          gridItemUUID: "grid-a",
          sessionNonce: "nonce",
          mapRef,
          variableInputValues: undefined,
          variableInputDateFormats: undefined,
        }),
      { initialProps: { currentLayers: first } },
    );

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);

    rerender({ currentLayers: second });
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(getFeaturesMock).toHaveBeenCalledTimes(2);
  });

  test("an unrelated rerender still does not refetch", async () => {
    // The guard must not have become unconditional: a layer whose args,
    // source and construction props are all unchanged stays put.
    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const config = [
      runtimeLayerConfig({ layerId: "layer-1", type: "VectorImageLayer" }),
    ];

    const { rerender } = renderHook(
      ({ currentLayers }) =>
        useRuntimeLayerFetcher({
          layers: currentLayers,
          gridItemUUID: "grid-a",
          sessionNonce: "nonce",
          mapRef,
          variableInputValues: undefined,
          variableInputDateFormats: undefined,
        }),
      { initialProps: { currentLayers: config } },
    );

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);

    rerender({
      currentLayers: [
        runtimeLayerConfig({ layerId: "layer-1", type: "VectorImageLayer" }),
      ],
    });
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(getFeaturesMock).toHaveBeenCalledTimes(1);
  });

  // The window the hook always computed and never published. Every clear path
  // is load-bearing for banner correctness -- there is no reconciliation pass
  // or timeout behind it -- so each terminal path gets its own test.
  describe("in-flight reporting", () => {
    const hookArgs = (over = {}) => ({
      gridItemUUID: "grid-a",
      sessionNonce: "nonce",
      variableInputValues: noVariableInputs,
      variableInputDateFormats: noDateFormats,
      ...over,
    });

    test("opens on schedule and stays open across the debounce wait", async () => {
      const olLayer = fakeOlLayer("layer-1");
      const mapRef = { current: fakeOlMap([olLayer]) };
      const layers = [runtimeLayerConfig({ layerId: "layer-1" })];

      const { result } = renderHook(() =>
        useRuntimeLayerFetcher(hookArgs({ layers, mapRef })),
      );

      // Open before the request is dispatched: the debounce is inside the
      // window, otherwise every load has a silent quarter-second.
      await waitFor(() => {
        expect(result.current.loadingByLayerId["layer-1"]).toBe(true);
      });
      expect(getFeaturesMock).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(249);
        await Promise.resolve();
      });
      expect(result.current.loadingByLayerId["layer-1"]).toBe(true);
      expect(getFeaturesMock).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(2);
        await Promise.resolve();
      });
      expect(getFeaturesMock).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        expect(result.current.loadingByLayerId).toEqual({});
      });
    });

    test("a superseding fetch keeps the window continuously open", async () => {
      const olLayer = fakeOlLayer("layer-1");
      const mapRef = { current: fakeOlMap([olLayer]) };
      // eslint-disable-next-line no-template-curly-in-string
      const layers = [runtimeLayerConfig({ args: { bbox: "${BBox}" } })];

      // Sampled on every render, not only at the end: a flag that drops between
      // the old request settling and the new one completing is exactly the
      // handover defect, and an end-state assertion cannot see it.
      // Both deferred: if the replacement resolved immediately the window would
      // close legitimately and the handover would not be observable.
      let resolveFirst;
      let resolveSecond;
      getFeaturesMock
        .mockImplementationOnce(
          () =>
            new Promise((res) => {
              resolveFirst = res;
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise((res) => {
              resolveSecond = res;
            }),
        );

      const samples = [];
      const { result, rerender } = renderHook(
        ({ variableInputValues }) => {
          const r = useRuntimeLayerFetcher(
            hookArgs({ layers, mapRef, variableInputValues }),
          );
          samples.push(r.loadingByLayerId["layer-1"] === true);
          return r;
        },
        { initialProps: { variableInputValues: { BBox: "1,2,3,4" } } },
      );

      await act(async () => {
        jest.advanceTimersByTime(250);
        await Promise.resolve();
      });
      expect(getFeaturesMock).toHaveBeenCalledTimes(1);

      const openedBefore = samples.length;
      rerender({ variableInputValues: { BBox: "9,9,9,9" } });
      await act(async () => {
        jest.advanceTimersByTime(250);
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(getFeaturesMock).toHaveBeenCalledTimes(2);

      // The superseded request settles after its replacement started.
      await act(async () => {
        resolveFirst({ success: true, viz_type: "features", data: validFc });
        await Promise.resolve();
        await Promise.resolve();
      });

      // Across the whole handover the layer never reported settled.
      expect(samples.slice(openedBefore).every(Boolean)).toBe(true);
      expect(result.current.loadingByLayerId["layer-1"]).toBe(true);

      await act(async () => {
        resolveSecond({ success: true, viz_type: "features", data: validFc });
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(result.current.loadingByLayerId).toEqual({});
      });
    });

    test("a late success from a superseded request cannot close the newer window", async () => {
      const olLayer = fakeOlLayer("layer-1");
      const mapRef = { current: fakeOlMap([olLayer]) };
      // eslint-disable-next-line no-template-curly-in-string
      const layers = [runtimeLayerConfig({ args: { bbox: "${BBox}" } })];

      // First request resolves on our schedule. axios never rejects a request
      // that had already resolved when a newer one superseded it, so its tail
      // runs a microtask later and would otherwise clear the new window.
      let resolveFirst;
      let resolveSecond;
      getFeaturesMock
        .mockImplementationOnce(
          () =>
            new Promise((res) => {
              resolveFirst = res;
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise((res) => {
              resolveSecond = res;
            }),
        );

      const { result, rerender } = renderHook(
        ({ variableInputValues }) =>
          useRuntimeLayerFetcher(
            hookArgs({ layers, mapRef, variableInputValues }),
          ),
        { initialProps: { variableInputValues: { BBox: "1,2,3,4" } } },
      );

      await act(async () => {
        jest.advanceTimersByTime(250);
        await Promise.resolve();
      });
      expect(getFeaturesMock).toHaveBeenCalledTimes(1);

      // Second request is dispatched while the first is still unresolved.
      rerender({ variableInputValues: { BBox: "9,9,9,9" } });
      await act(async () => {
        jest.advanceTimersByTime(250);
        await Promise.resolve();
      });
      expect(getFeaturesMock).toHaveBeenCalledTimes(2);

      // Now let the superseded request's success tail run.
      await act(async () => {
        resolveFirst({ success: true, viz_type: "features", data: validFc });
        await Promise.resolve();
        await Promise.resolve();
      });

      // The replacement is still outstanding, so the window stays open.
      expect(result.current.loadingByLayerId["layer-1"]).toBe(true);

      await act(async () => {
        resolveSecond({ success: true, viz_type: "features", data: validFc });
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(result.current.loadingByLayerId).toEqual({});
      });
    });

    test("a late rejection from a superseded request cannot close the newer window", async () => {
      // The success half of this is covered above. A superseded request that
      // rejects late reaches a different tail, and that tail also closes the
      // window and writes an error -- both of which belong to whoever owns the
      // layer now, not to a request that has been replaced.
      const olLayer = fakeOlLayer("layer-1");
      const mapRef = { current: fakeOlMap([olLayer]) };
      // eslint-disable-next-line no-template-curly-in-string
      const layers = [runtimeLayerConfig({ args: { bbox: "${BBox}" } })];

      let rejectFirst;
      let resolveSecond;
      getFeaturesMock
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              rejectFirst = reject;
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveSecond = resolve;
            }),
        );

      const { result, rerender } = renderHook(
        ({ variableInputValues }) =>
          useRuntimeLayerFetcher(
            hookArgs({ layers, mapRef, variableInputValues }),
          ),
        { initialProps: { variableInputValues: { BBox: "1,2,3,4" } } },
      );

      await act(async () => {
        jest.advanceTimersByTime(250);
        await Promise.resolve();
      });
      expect(getFeaturesMock).toHaveBeenCalledTimes(1);

      rerender({ variableInputValues: { BBox: "9,9,9,9" } });
      await act(async () => {
        jest.advanceTimersByTime(250);
        await Promise.resolve();
      });
      expect(getFeaturesMock).toHaveBeenCalledTimes(2);

      await act(async () => {
        rejectFirst(new Error("late boom"));
        await Promise.resolve();
        await Promise.resolve();
      });

      // The replacement still owns the layer: still loading, and not failed by
      // a request nobody is waiting for.
      expect(result.current.loadingByLayerId["layer-1"]).toBe(true);
      expect(result.current.errorsByLayerId["layer-1"]).toBeUndefined();

      await act(async () => {
        resolveSecond({ success: true, viz_type: "features", data: validFc });
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(result.current.loadingByLayerId).toEqual({});
      });
    });

    test("a layer removed mid-flight closes its window at the cancel site", async () => {
      const olLayer = fakeOlLayer("layer-1");
      const mapRef = { current: fakeOlMap([olLayer]) };
      const layers = [runtimeLayerConfig({ layerId: "layer-1" })];

      // Never settles, so only the removal sweep can close the window.
      getFeaturesMock.mockImplementation(
        ({ cancelToken }) =>
          new Promise((_res, rej) => {
            cancelToken.promise.then(rej);
          }),
      );

      const { result, rerender } = renderHook(
        ({ currentLayers }) =>
          useRuntimeLayerFetcher(hookArgs({ layers: currentLayers, mapRef })),
        { initialProps: { currentLayers: layers } },
      );

      await act(async () => {
        jest.advanceTimersByTime(250);
        await Promise.resolve();
      });
      expect(result.current.loadingByLayerId["layer-1"]).toBe(true);

      rerender({ currentLayers: [] });
      await act(async () => {
        await Promise.resolve();
      });

      // Cleared by the sweep itself, not by waiting on the cancel rejection.
      expect(result.current.loadingByLayerId).toEqual({});
    });

    test("a stale response after remove and re-add cannot close the new window", async () => {
      const olLayer = fakeOlLayer("layer-1");
      const mapRef = { current: fakeOlMap([olLayer]) };
      const layers = [runtimeLayerConfig({ layerId: "layer-1" })];

      let resolveFirst;
      let resolveSecond;
      getFeaturesMock
        .mockImplementationOnce(
          () =>
            new Promise((res) => {
              resolveFirst = res;
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise((res) => {
              resolveSecond = res;
            }),
        );

      const { result, rerender } = renderHook(
        ({ currentLayers }) =>
          useRuntimeLayerFetcher(hookArgs({ layers: currentLayers, mapRef })),
        { initialProps: { currentLayers: layers } },
      );

      await act(async () => {
        jest.advanceTimersByTime(250);
        await Promise.resolve();
      });
      expect(getFeaturesMock).toHaveBeenCalledTimes(1);

      // Remove, then re-add the same id. The removal sweep deletes the
      // per-layer state object, so a generation counter living on it would
      // reset here and let the first request's tail pass the guard.
      rerender({ currentLayers: [] });
      await act(async () => {
        await Promise.resolve();
      });
      // The re-registering effect must flush before the timers advance, or the
      // new debounce timer does not exist yet when they do.
      rerender({ currentLayers: layers });
      await act(async () => {
        await Promise.resolve();
      });
      await act(async () => {
        jest.advanceTimersByTime(250);
        await Promise.resolve();
      });
      expect(getFeaturesMock).toHaveBeenCalledTimes(2);

      await act(async () => {
        resolveFirst({ success: true, viz_type: "features", data: validFc });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.loadingByLayerId["layer-1"]).toBe(true);

      await act(async () => {
        resolveSecond({ success: true, viz_type: "features", data: validFc });
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(result.current.loadingByLayerId).toEqual({});
      });
    });

    test("a response arriving with no map still closes the window", async () => {
      const mapRef = { current: null };
      const layers = [runtimeLayerConfig({ layerId: "layer-1" })];

      const { result } = renderHook(() =>
        useRuntimeLayerFetcher(hookArgs({ layers, mapRef })),
      );

      await act(async () => {
        jest.advanceTimersByTime(250);
        await Promise.resolve();
        await Promise.resolve();
      });

      // Settled with nothing painted and no error -- the window must not be
      // left open, even though the layer is blank.
      await waitFor(() => {
        expect(result.current.loadingByLayerId).toEqual({});
      });
      expect(result.current.errorsByLayerId).toEqual({});
    });

    test("unmount mid-flight leaves no setState warning", async () => {
      const olLayer = fakeOlLayer("layer-1");
      const mapRef = { current: fakeOlMap([olLayer]) };
      const layers = [runtimeLayerConfig({ layerId: "layer-1" })];
      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      getFeaturesMock.mockImplementation(
        ({ cancelToken }) =>
          new Promise((_res, rej) => {
            cancelToken.promise.then(rej);
          }),
      );

      const { result, unmount } = renderHook(() =>
        useRuntimeLayerFetcher(hookArgs({ layers, mapRef })),
      );

      await act(async () => {
        jest.advanceTimersByTime(250);
        await Promise.resolve();
      });
      expect(result.current.loadingByLayerId["layer-1"]).toBe(true);

      await act(async () => {
        unmount();
        await Promise.resolve();
      });

      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});
