import { renderHook, act, waitFor } from "@testing-library/react";
import axios from "axios";
import useRuntimeLayerFetcher from "components/visualizations/runtimeLayerFetcher";
import appAPI from "services/api/app";
import * as mapUtilities from "components/map/utilities";
import * as runtimeRaster from "components/map/runtimeRaster";
import { GeoTIFFError } from "components/map/ModuleLoader";
import Source from "ol/source/Source.js";

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
  const lengthListeners = [];
  const listenersFor = (type) =>
    type === "add"
      ? addListeners
      : type === "change:length"
        ? lengthListeners
        : null;
  const collection = {
    getArray: () => olLayers,
    on: (type, fn) => {
      listenersFor(type)?.push(fn);
    },
    un: (type, fn) => {
      const listeners = listenersFor(type);
      if (!listeners) return;
      const i = listeners.indexOf(fn);
      if (i !== -1) listeners.splice(i, 1);
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
    // Mimics a Map.js layer sync rebuilding a layer: the replacement is added
    // before the layer it replaces is removed, each changing the length.
    rebuildLayer: (index, layer) => {
      olLayers.push(layer);
      lengthListeners.slice().forEach((fn) => fn());
      olLayers.splice(index, 1);
      lengthListeners.slice().forEach((fn) => fn());
    },
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

describe("useRuntimeLayerFetcher with a runtime GeoTIFF layer", () => {
  // The resolve-and-build steps are runtimeRaster.js's own and have their own
  // suite; mocked here so these tests are about when the fetcher calls them,
  // what it does with the result, and which request a result belongs to. The
  // apply and the error-listener helpers stay real, against a real OL source.
  let getFeaturesMock;
  let resolveSpy;
  let buildSpy;
  let swapSpy;

  // A WebGLTile stand-in: enough of the surface applyRuntimeRaster touches.
  function fakeRasterLayer(layerId) {
    let source = null;
    return {
      get: (key) => (key === "layerId" ? layerId : undefined),
      getSource: () => source,
      setSource: jest.fn((next) => {
        source = next;
      }),
      setStyle: jest.fn(),
    };
  }

  function rasterLayerConfig({
    layerId = "layer-1",
    name = "Depth",
    args = {},
    stylePinned,
    rampName = "viridis",
    rampMin,
    rampMax,
    maskBelow,
    fallbackColor,
  } = {}) {
    return {
      configuration: {
        type: "WebGLTile",
        props: {
          name,
          layerId,
          pluginSource: {
            source: "echo_raster",
            args,
            ...(stylePinned === undefined ? {} : { stylePinned }),
          },
          source: {
            type: "GeoTIFF",
            props: maskBelow === undefined ? {} : { mask_below: maskBelow },
          },
        },
        style: {
          rampName,
          ...(rampMin === undefined ? {} : { rampMin }),
          ...(rampMax === undefined ? {} : { rampMax }),
          ...(fallbackColor === undefined ? {} : { fallbackColor }),
        },
      },
    };
  }

  const sourceResponse = (url) => ({
    success: true,
    viz_type: "source",
    data: { type: "GeoTIFF", props: { url } },
  });

  // A build result whose source is real, so the error listeners attach to it.
  const builtFor = (url, legendRamp = null) => {
    const source = new Source({ state: "ready" });
    source.url = url;
    return { source, style: { color: url }, legendRamp };
  };

  const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  const flush = async (ms = 250) => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
      for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
      }
    });
  };

  const hookFor = (initialProps) =>
    renderHook(
      ({ layers, variableInputValues = noVariableInputs, mapRef }) =>
        useRuntimeLayerFetcher({
          layers,
          gridItemUUID: "g",
          sessionNonce: "n",
          mapRef,
          variableInputValues,
          variableInputDateFormats: noDateFormats,
        }),
      { initialProps },
    );

  beforeEach(() => {
    jest.useFakeTimers();
    getFeaturesMock = jest
      .spyOn(appAPI, "getVisualizationFeatures")
      .mockImplementation(async ({ args }) =>
        sourceResponse(`https://h/${args?.storm ?? "a"}.tif`),
      );
    resolveSpy = jest
      .spyOn(runtimeRaster, "resolveEffectiveRasterConfig")
      .mockImplementation((saved, description) => ({
        saved,
        url: description.props.url,
      }));
    buildSpy = jest
      .spyOn(runtimeRaster, "buildRuntimeRaster")
      .mockImplementation(async (effective) =>
        builtFor(effective.url, {
          rampName: "viridis",
          rampReverse: false,
          rampMin: 0,
          rampMax: 50,
        }),
      );
    swapSpy = jest
      .spyOn(mapUtilities, "swapVectorLayerFeatures")
      .mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("a variable-input change refetches once and repoints the layer", async () => {
    const olLayer = fakeRasterLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    // eslint-disable-next-line no-template-curly-in-string
    const layers = [rasterLayerConfig({ args: { storm: "${Storm}" } })];

    const { result, rerender } = hookFor({
      layers,
      mapRef,
      variableInputValues: { Storm: "ian" },
    });
    await flush();
    expect(olLayer.setSource).toHaveBeenCalledTimes(1);
    expect(olLayer.getSource().url).toBe("https://h/ian.tif");

    rerender({ layers, mapRef, variableInputValues: { Storm: "milton" } });
    await flush();

    expect(getFeaturesMock).toHaveBeenCalledTimes(2);
    // The build starts from the layer's saved configuration and the fetched
    // description, in the map's current projection.
    expect(resolveSpy).toHaveBeenLastCalledWith(layers[0].configuration, {
      type: "GeoTIFF",
      props: { url: "https://h/milton.tif" },
    });
    expect(buildSpy.mock.calls[1][1]).toBe("EPSG:3857");
    expect(olLayer.getSource().url).toBe("https://h/milton.tif");
    expect(olLayer.setStyle).toHaveBeenLastCalledWith({
      color: "https://h/milton.tif",
    });
    expect(swapSpy).not.toHaveBeenCalled();
    expect(result.current.errorsByLayerId).toEqual({});
    expect(result.current.loadingByLayerId).toEqual({});
    expect(result.current.rasterLegendByLayerId).toEqual({
      "layer-1": {
        rampName: "viridis",
        rampReverse: false,
        rampMin: 0,
        rampMax: 50,
      },
    });
  });

  test("Covers AE4. A failed fetch keeps the previous file drawn and sets the error", async () => {
    const olLayer = fakeRasterLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    // eslint-disable-next-line no-template-curly-in-string
    const layers = [rasterLayerConfig({ args: { storm: "${Storm}" } })];

    const { result, rerender } = hookFor({
      layers,
      mapRef,
      variableInputValues: { Storm: "a" },
    });
    await flush();
    const fileA = olLayer.getSource();
    expect(fileA.url).toBe("https://h/a.tif");

    getFeaturesMock.mockResolvedValueOnce({
      success: false,
      viz_type: null,
      data: { error: "No forecast for that storm" },
    });
    rerender({ layers, mapRef, variableInputValues: { Storm: "b" } });
    await flush();

    expect(olLayer.getSource()).toBe(fileA);
    expect(olLayer.setSource).toHaveBeenCalledTimes(1);
    expect(buildSpy).toHaveBeenCalledTimes(1);
    expect(result.current.errorsByLayerId["layer-1"]).toEqual({
      message: "No forecast for that storm",
      kind: "error",
    });
    expect(result.current.loadingByLayerId).toEqual({});
  });

  test("a build that cannot range the file reports through the fetch error channel", async () => {
    const olLayer = fakeRasterLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    // eslint-disable-next-line no-template-curly-in-string
    const layers = [rasterLayerConfig({ args: { storm: "${Storm}" } })];

    const { result, rerender } = hookFor({
      layers,
      mapRef,
      variableInputValues: { Storm: "a" },
    });
    await flush();
    const fileA = olLayer.getSource();

    const rangeMessage =
      "This GeoTIFF publishes no statistics and is too large to scan for " +
      "its own value range";
    buildSpy.mockRejectedValueOnce(new GeoTIFFError(rangeMessage));
    rerender({ layers, mapRef, variableInputValues: { Storm: "huge" } });
    await flush();

    expect(olLayer.getSource()).toBe(fileA);
    expect(result.current.errorsByLayerId["layer-1"]).toEqual({
      message: rangeMessage,
      kind: "error",
    });
    expect(result.current.loadingByLayerId).toEqual({});
    // The legend still labels the file on screen.
    expect(result.current.rasterLegendByLayerId["layer-1"]).not.toBeNull();
  });

  test("a resolve that throws is reported the same way, before any build", async () => {
    const olLayer = fakeRasterLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    resolveSpy.mockImplementationOnce(() => {
      throw new Error('returned a "XYZ" source');
    });

    const { result } = hookFor({ layers: [rasterLayerConfig()], mapRef });
    await flush();

    expect(buildSpy).not.toHaveBeenCalled();
    expect(olLayer.setSource).not.toHaveBeenCalled();
    expect(result.current.errorsByLayerId["layer-1"].message).toMatch(/XYZ/);
    expect(result.current.loadingByLayerId).toEqual({});
  });

  test("the loading window stays open until the build settles", async () => {
    const olLayer = fakeRasterLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const build = deferred();
    buildSpy.mockReturnValueOnce(build.promise);

    const { result } = hookFor({ layers: [rasterLayerConfig()], mapRef });
    await flush();

    // The response is in; the header read is not.
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);
    expect(result.current.loadingByLayerId["layer-1"]).toBe(true);

    await act(async () => {
      build.resolve(builtFor("https://h/a.tif"));
      await Promise.resolve();
    });
    expect(result.current.loadingByLayerId).toEqual({});
    expect(result.current.rasterLegendByLayerId).toEqual({ "layer-1": null });
  });

  test("a superseded build that finishes last is discarded", async () => {
    const olLayer = fakeRasterLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    // eslint-disable-next-line no-template-curly-in-string
    const layers = [rasterLayerConfig({ args: { storm: "${Storm}" } })];
    const first = deferred();
    const second = deferred();
    buildSpy
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result, rerender } = hookFor({
      layers,
      mapRef,
      variableInputValues: { Storm: "one" },
    });
    await flush();
    rerender({ layers, mapRef, variableInputValues: { Storm: "two" } });
    await flush();
    // Both responses are in and both builds are running.
    expect(buildSpy).toHaveBeenCalledTimes(2);
    expect(result.current.loadingByLayerId["layer-1"]).toBe(true);

    await act(async () => {
      second.resolve(builtFor("https://h/two.tif"));
      await Promise.resolve();
    });
    expect(olLayer.getSource().url).toBe("https://h/two.tif");
    expect(result.current.loadingByLayerId).toEqual({});

    // The first build lands late, with a result and then with a failure: it
    // may neither paint over the newer file nor reopen, close or error.
    await act(async () => {
      first.resolve(builtFor("https://h/one.tif"));
      await Promise.resolve();
    });
    expect(olLayer.setSource).toHaveBeenCalledTimes(1);
    expect(olLayer.getSource().url).toBe("https://h/two.tif");
    expect(result.current.loadingByLayerId).toEqual({});
    expect(result.current.errorsByLayerId).toEqual({});
  });

  test("a superseded build that fails cannot close the newer window", async () => {
    const olLayer = fakeRasterLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    // eslint-disable-next-line no-template-curly-in-string
    const layers = [rasterLayerConfig({ args: { storm: "${Storm}" } })];
    const first = deferred();
    const second = deferred();
    buildSpy
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result, rerender } = hookFor({
      layers,
      mapRef,
      variableInputValues: { Storm: "one" },
    });
    await flush();
    rerender({ layers, mapRef, variableInputValues: { Storm: "two" } });
    await flush();

    await act(async () => {
      first.reject(new Error("stale failure"));
      await Promise.resolve();
    });
    expect(result.current.loadingByLayerId["layer-1"]).toBe(true);
    expect(result.current.errorsByLayerId).toEqual({});

    await act(async () => {
      second.resolve(builtFor("https://h/two.tif"));
      await Promise.resolve();
    });
    expect(result.current.loadingByLayerId).toEqual({});
  });

  test("a layer removed mid-build is neither repointed nor given an error", async () => {
    const olLayer = fakeRasterLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const layers = [rasterLayerConfig()];
    const build = deferred();
    buildSpy.mockReturnValueOnce(build.promise);

    const { result, rerender } = hookFor({ layers, mapRef });
    await flush();
    expect(buildSpy).toHaveBeenCalledTimes(1);

    rerender({ layers: [], mapRef });
    await flush();
    expect(result.current.loadingByLayerId).toEqual({});

    await act(async () => {
      build.resolve(builtFor("https://h/a.tif"));
      await Promise.resolve();
    });
    expect(olLayer.setSource).not.toHaveBeenCalled();
    expect(result.current.errorsByLayerId).toEqual({});
    expect(result.current.rasterLegendByLayerId).toEqual({});
  });

  test("a build failing after its layer was removed writes no error", async () => {
    const olLayer = fakeRasterLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const build = deferred();
    buildSpy.mockReturnValueOnce(build.promise);

    const { result, rerender } = hookFor({
      layers: [rasterLayerConfig()],
      mapRef,
    });
    await flush();
    rerender({ layers: [], mapRef });
    await flush();

    await act(async () => {
      build.reject(new Error("too late"));
      await Promise.resolve();
    });
    expect(result.current.errorsByLayerId).toEqual({});
    expect(result.current.loadingByLayerId).toEqual({});
  });

  test("removing a painted layer clears its legend entry", async () => {
    const olLayer = fakeRasterLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };

    const { result, rerender } = hookFor({
      layers: [rasterLayerConfig()],
      mapRef,
    });
    await flush();
    expect(result.current.rasterLegendByLayerId["layer-1"]).toBeDefined();

    rerender({ layers: [], mapRef });
    await flush();
    expect(result.current.rasterLegendByLayerId).toEqual({});
  });

  test("a fetch landing before the layer exists builds when the layer appears", async () => {
    const map = fakeOlMap([]);
    const mapRef = { current: map };

    const { result } = hookFor({ layers: [rasterLayerConfig()], mapRef });
    await flush();

    // Held, not built: there is nothing yet to hand a source to.
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);
    expect(buildSpy).not.toHaveBeenCalled();
    expect(map.pendingAddListeners()).toBe(1);
    expect(result.current.loadingByLayerId).toEqual({});

    const late = fakeRasterLayer("layer-1");
    await act(async () => {
      map.addLayerLate(late);
      for (let i = 0; i < 5; i += 1) {
        await Promise.resolve();
      }
    });

    expect(buildSpy).toHaveBeenCalledTimes(1);
    expect(late.getSource().url).toBe("https://h/a.tif");
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);
    expect(map.pendingAddListeners()).toBe(0);
    expect(result.current.loadingByLayerId).toEqual({});
  });

  test("a held description is dropped when a newer fetch replaces it", async () => {
    const map = fakeOlMap([]);
    const mapRef = { current: map };
    // eslint-disable-next-line no-template-curly-in-string
    const layers = [rasterLayerConfig({ args: { storm: "${Storm}" } })];
    const { rerender } = hookFor({
      layers,
      mapRef,
      variableInputValues: { Storm: "one" },
    });
    await flush();
    rerender({ layers, mapRef, variableInputValues: { Storm: "two" } });
    await flush();

    const late = fakeRasterLayer("layer-1");
    await act(async () => {
      map.addLayerLate(late);
      for (let i = 0; i < 5; i += 1) {
        await Promise.resolve();
      }
    });
    // Only the newer description is built.
    expect(buildSpy).toHaveBeenCalledTimes(1);
    expect(late.getSource().url).toBe("https://h/two.tif");
  });

  test("a layer gone by the time its build finishes is painted when it returns", async () => {
    const olLayer = fakeRasterLayer("layer-1");
    const olLayers = [olLayer];
    const map = fakeOlMap(olLayers);
    const mapRef = { current: map };
    const build = deferred();
    buildSpy.mockReturnValueOnce(build.promise);

    hookFor({ layers: [rasterLayerConfig()], mapRef });
    await flush();

    // Map.js tears the OL layer down and rebuilds it while the build runs.
    olLayers.splice(0, 1);
    await act(async () => {
      build.resolve(builtFor("https://h/a.tif"));
      await Promise.resolve();
    });
    expect(olLayer.setSource).not.toHaveBeenCalled();
    expect(map.pendingAddListeners()).toBe(1);

    const rebuilt = fakeRasterLayer("layer-1");
    await act(async () => {
      map.addLayerLate(rebuilt);
      for (let i = 0; i < 5; i += 1) {
        await Promise.resolve();
      }
    });
    expect(rebuilt.getSource().url).toBe("https://h/a.tif");
  });

  test.each([
    ["pinning the style", { stylePinned: true }],
    ["changing the ramp", { rampName: "magma" }],
    ["changing a bound", { rampMin: "5" }],
    ["changing the mask", { maskBelow: 0.1 }],
    ['changing only the "Other values" color', { fallbackColor: "#ff00ff" }],
  ])(
    "%s refetches exactly once, with the same arguments",
    async (_label, change) => {
      const olLayer = fakeRasterLayer("layer-1");
      const mapRef = { current: fakeOlMap([olLayer]) };

      const { rerender } = hookFor({ layers: [rasterLayerConfig()], mapRef });
      await flush();
      expect(getFeaturesMock).toHaveBeenCalledTimes(1);

      const edited = [rasterLayerConfig(change)];
      rerender({ layers: edited, mapRef });
      await flush();
      expect(getFeaturesMock).toHaveBeenCalledTimes(2);
      // The repaint starts from the edited saved style.
      expect(resolveSpy.mock.calls[1][0]).toBe(edited[0].configuration);

      // Re-rendering the same edit is not another change.
      rerender({ layers: [rasterLayerConfig(change)], mapRef });
      await flush();
      expect(getFeaturesMock).toHaveBeenCalledTimes(2);
    },
  );

  test("un-pinning refetches", async () => {
    const olLayer = fakeRasterLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const { rerender } = hookFor({
      layers: [rasterLayerConfig({ stylePinned: true })],
      mapRef,
    });
    await flush();
    rerender({ layers: [rasterLayerConfig()], mapRef });
    await flush();
    expect(getFeaturesMock).toHaveBeenCalledTimes(2);
  });

  test("a tile failure on the swapped-in source sets the layer's error", async () => {
    const olLayer = fakeRasterLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    // eslint-disable-next-line no-template-curly-in-string
    const layers = [rasterLayerConfig({ args: { storm: "${Storm}" } })];

    const { result, rerender } = hookFor({
      layers,
      mapRef,
      variableInputValues: { Storm: "a" },
    });
    await flush();
    const fileA = olLayer.getSource();

    rerender({ layers, mapRef, variableInputValues: { Storm: "b" } });
    await flush();
    const fileB = olLayer.getSource();
    expect(fileB).not.toBe(fileA);

    // The replaced source's listeners were detached with it.
    await act(async () => {
      fileA.dispatchEvent({
        type: "tileloaderror",
        error: new Error("old tile"),
      });
    });
    expect(result.current.errorsByLayerId).toEqual({});

    await act(async () => {
      fileB.dispatchEvent({
        type: "tileloaderror",
        error: new Error("Failed to fetch"),
      });
    });
    expect(result.current.errorsByLayerId["layer-1"].kind).toBe("error");
    expect(result.current.errorsByLayerId["layer-1"].message).toMatch(
      /GeoTIFF layer "Depth" failed to fetch the file/,
    );
  });

  test("reports a build that failed without saying why", async () => {
    // Whatever rejected the build is reported as-is where it has a message. A
    // rejection carrying none -- a thrown non-Error -- still has to leave the
    // layer in an error state rather than a silent loading one.
    buildSpy.mockRejectedValue({ notAnError: true });
    const olLayer = fakeRasterLayer("layer-1");
    const { result } = hookFor({
      layers: [rasterLayerConfig()],
      mapRef: { current: fakeOlMap([olLayer]) },
    });
    await flush();

    expect(result.current.errorsByLayerId["layer-1"]).toEqual({
      message: "Failed to load the raster",
      kind: "error",
    });
    expect(result.current.loadingByLayerId).toEqual({});
    // Nothing was repointed, so the previous file stays drawn.
    expect(olLayer.setSource).not.toHaveBeenCalled();
  });

  test("hands the resolver a null description when the plugin sends no data", async () => {
    // A success with nothing in it. The resolver is what reports the shape --
    // it is the one that knows what a source description has to look like --
    // so this passes it an explicit null rather than undefined, and its
    // complaint reaches the layer's error state.
    getFeaturesMock.mockResolvedValue({ success: true });
    resolveSpy.mockImplementation(() => {
      throw new Error("did not return a source description");
    });
    const { result } = hookFor({
      layers: [rasterLayerConfig()],
      mapRef: { current: fakeOlMap([fakeRasterLayer("layer-1")]) },
    });
    await flush();

    expect(resolveSpy).toHaveBeenCalledWith(expect.anything(), null);
    expect(result.current.errorsByLayerId["layer-1"].message).toBe(
      "did not return a source description",
    );
  });

  test("onBeforeSwap runs only once a build has succeeded", async () => {
    const olLayer = fakeRasterLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    const onBeforeSwap = jest.fn();
    buildSpy.mockRejectedValueOnce(new Error("unreadable"));

    const { rerender } = renderHook(
      ({ refreshTick }) =>
        useRuntimeLayerFetcher({
          layers: [rasterLayerConfig()],
          gridItemUUID: "g",
          sessionNonce: "n",
          mapRef,
          variableInputValues: noVariableInputs,
          variableInputDateFormats: noDateFormats,
          onBeforeSwap,
          refreshTick,
        }),
      { initialProps: { refreshTick: 0 } },
    );
    await flush();
    // A failed build leaves the open popup describing the file still drawn.
    expect(onBeforeSwap).not.toHaveBeenCalled();

    rerender({ refreshTick: 1 });
    await flush();
    expect(onBeforeSwap).toHaveBeenCalledWith("layer-1");
    expect(olLayer.setSource).toHaveBeenCalledTimes(1);
  });

  test("a request settling during a newer one's debounce neither closes the window nor paints", async () => {
    const olLayer = fakeRasterLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    // eslint-disable-next-line no-template-curly-in-string
    const layers = [rasterLayerConfig({ args: { storm: "${Storm}" } })];
    const first = deferred();
    getFeaturesMock.mockReturnValueOnce(first.promise);

    const { result, rerender } = hookFor({
      layers,
      mapRef,
      variableInputValues: { Storm: "one" },
    });
    await flush();
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);

    // A newer request is queued but not yet dispatched...
    rerender({ layers, mapRef, variableInputValues: { Storm: "two" } });
    await flush(100);
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);

    // ...when the older one lands.
    await act(async () => {
      first.resolve(sourceResponse("https://h/one.tif"));
      for (let i = 0; i < 5; i += 1) {
        await Promise.resolve();
      }
    });
    expect(result.current.loadingByLayerId["layer-1"]).toBe(true);
    expect(buildSpy).not.toHaveBeenCalled();
    expect(olLayer.setSource).not.toHaveBeenCalled();

    await flush(150);
    expect(getFeaturesMock).toHaveBeenCalledTimes(2);
    expect(buildSpy).toHaveBeenCalledTimes(1);
    expect(olLayer.getSource().url).toBe("https://h/two.tif");
    expect(result.current.loadingByLayerId).toEqual({});
  });

  test("a superseded build's source is disposed, never applied", async () => {
    const olLayer = fakeRasterLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    // eslint-disable-next-line no-template-curly-in-string
    const layers = [rasterLayerConfig({ args: { storm: "${Storm}" } })];
    const first = deferred();
    buildSpy.mockReturnValueOnce(first.promise);

    const { rerender } = hookFor({
      layers,
      mapRef,
      variableInputValues: { Storm: "one" },
    });
    await flush();
    rerender({ layers, mapRef, variableInputValues: { Storm: "two" } });
    await flush();
    expect(olLayer.getSource().url).toBe("https://h/two.tif");
    const painted = olLayer.getSource();
    jest.spyOn(painted, "dispose");

    const stale = builtFor("https://h/one.tif");
    const dispose = jest.spyOn(stale.source, "dispose");
    await act(async () => {
      first.resolve(stale);
      await Promise.resolve();
    });
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(olLayer.getSource()).toBe(painted);
    expect(painted.dispose).not.toHaveBeenCalled();
  });

  test("a build whose layer vanished is disposed, and the layer that returns gets its own", async () => {
    const olLayers = [fakeRasterLayer("layer-1")];
    const map = fakeOlMap(olLayers);
    const mapRef = { current: map };
    const build = deferred();
    buildSpy.mockReturnValueOnce(build.promise);

    hookFor({ layers: [rasterLayerConfig()], mapRef });
    await flush();
    olLayers.splice(0, 1);

    const orphan = builtFor("https://h/a.tif");
    const dispose = jest.spyOn(orphan.source, "dispose");
    await act(async () => {
      build.resolve(orphan);
      await Promise.resolve();
    });
    expect(dispose).toHaveBeenCalledTimes(1);

    const rebuilt = fakeRasterLayer("layer-1");
    await act(async () => {
      map.addLayerLate(rebuilt);
      for (let i = 0; i < 5; i += 1) {
        await Promise.resolve();
      }
    });
    expect(rebuilt.getSource()).not.toBe(orphan.source);
    expect(rebuilt.getSource().url).toBe("https://h/a.tif");
  });

  test("a build that hits its deadline reports the timeout as the layer's error", async () => {
    const olLayer = fakeRasterLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };
    buildSpy.mockRejectedValueOnce(
      new GeoTIFFError(
        'GeoTIFF layer "Depth" timed out opening the file after 30 seconds.',
      ),
    );

    const { result } = hookFor({ layers: [rasterLayerConfig()], mapRef });
    await flush();
    expect(result.current.errorsByLayerId["layer-1"]).toEqual({
      message:
        'GeoTIFF layer "Depth" timed out opening the file after 30 seconds.',
      kind: "error",
    });
    expect(result.current.loadingByLayerId).toEqual({});
    expect(olLayer.setSource).not.toHaveBeenCalled();
  });

  test("a raster layer rebuilt behind the fetcher's back is repainted", async () => {
    const olLayer = fakeRasterLayer("layer-1");
    const map = fakeOlMap([olLayer]);
    const mapRef = { current: map };
    const layers = [rasterLayerConfig()];

    const { result } = hookFor({ layers, mapRef });
    await flush();
    expect(olLayer.getSource().url).toBe("https://h/a.tif");

    // A layer sync rebuilds the layer -- a new, sourceless WebGLTile -- while
    // nothing the fetcher compares has changed.
    const rebuilt = fakeRasterLayer("layer-1");
    await act(async () => {
      map.rebuildLayer(0, rebuilt);
      for (let i = 0; i < 5; i += 1) {
        await Promise.resolve();
      }
    });

    // Rebuilt from the last description, not refetched, and not the old
    // layer's source: an OL source cannot be shared between layers.
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);
    expect(buildSpy).toHaveBeenCalledTimes(2);
    expect(rebuilt.getSource().url).toBe("https://h/a.tif");
    expect(rebuilt.getSource()).not.toBe(olLayer.getSource());
    expect(result.current.loadingByLayerId).toEqual({});

    // Once repainted, the same layer is not repainted again.
    await act(async () => {
      map.rebuildLayer(0, rebuilt);
      await Promise.resolve();
    });
    expect(buildSpy).toHaveBeenCalledTimes(2);
  });

  test("a rebuild while a fetch is outstanding is left to that fetch", async () => {
    const olLayer = fakeRasterLayer("layer-1");
    const map = fakeOlMap([olLayer]);
    const mapRef = { current: map };
    // eslint-disable-next-line no-template-curly-in-string
    const layers = [rasterLayerConfig({ args: { storm: "${Storm}" } })];
    const { rerender } = hookFor({
      layers,
      mapRef,
      variableInputValues: { Storm: "one" },
    });
    await flush();

    rerender({ layers, mapRef, variableInputValues: { Storm: "two" } });
    const rebuilt = fakeRasterLayer("layer-1");
    await act(async () => {
      map.rebuildLayer(0, rebuilt);
      await Promise.resolve();
    });
    await flush();
    // Only the queued request paints, and it paints the rebuilt layer.
    expect(buildSpy).toHaveBeenCalledTimes(2);
    expect(rebuilt.getSource().url).toBe("https://h/two.tif");
  });

  const vectorLayers = [runtimeLayerConfig()];

  test("a vector layer rebuilt behind the fetcher's back gets its features back", async () => {
    getFeaturesMock.mockResolvedValue({
      success: true,
      viz_type: "features",
      data: validFc,
    });
    const olLayer = fakeOlLayer("layer-1");
    const map = fakeOlMap([olLayer]);
    const mapRef = { current: map };
    const onBeforeSwap = jest.fn();
    renderHook(() =>
      useRuntimeLayerFetcher({
        layers: vectorLayers,
        gridItemUUID: "g",
        sessionNonce: "n",
        mapRef,
        variableInputValues: noVariableInputs,
        variableInputDateFormats: noDateFormats,
        onBeforeSwap,
      }),
    );
    await flush();
    expect(swapSpy).toHaveBeenCalledTimes(1);
    expect(onBeforeSwap).toHaveBeenCalledTimes(1);

    const rebuilt = fakeOlLayer("layer-1");
    await act(async () => {
      map.rebuildLayer(0, rebuilt);
    });
    expect(getFeaturesMock).toHaveBeenCalledTimes(1);
    expect(swapSpy).toHaveBeenCalledTimes(2);
    expect(swapSpy).toHaveBeenLastCalledWith(rebuilt, validFc, "EPSG:3857");
    // The repaint replaces the features under any open popup, as a fetch does.
    expect(onBeforeSwap).toHaveBeenCalledTimes(2);
  });

  test("a rebuilt vector layer repaints without an onBeforeSwap to call", async () => {
    // onBeforeSwap is the host map's hook for closing a popup over features
    // that are about to be replaced. A host that passes none -- the popup
    // editor's preview, for one -- must still get its features back.
    getFeaturesMock.mockResolvedValue({
      success: true,
      viz_type: "features",
      data: validFc,
    });
    const olLayer = fakeOlLayer("layer-1");
    const map = fakeOlMap([olLayer]);
    renderHook(() =>
      useRuntimeLayerFetcher({
        layers: vectorLayers,
        gridItemUUID: "g",
        sessionNonce: "n",
        mapRef: { current: map },
        variableInputValues: noVariableInputs,
        variableInputDateFormats: noDateFormats,
      }),
    );
    await flush();
    expect(swapSpy).toHaveBeenCalledTimes(1);

    const rebuilt = fakeOlLayer("layer-1");
    await act(async () => {
      map.rebuildLayer(0, rebuilt);
    });
    expect(swapSpy).toHaveBeenCalledTimes(2);
    expect(swapSpy).toHaveBeenLastCalledWith(rebuilt, validFc, "EPSG:3857");
  });

  test("a vector runtime layer still swaps features and never builds a raster", async () => {
    getFeaturesMock.mockResolvedValue({
      success: true,
      viz_type: "features",
      data: validFc,
    });
    const olLayer = fakeOlLayer("layer-1");
    const mapRef = { current: fakeOlMap([olLayer]) };

    const { result } = hookFor({ layers: [runtimeLayerConfig()], mapRef });
    await flush();

    expect(swapSpy).toHaveBeenCalledWith(olLayer, validFc, "EPSG:3857");
    expect(resolveSpy).not.toHaveBeenCalled();
    expect(buildSpy).not.toHaveBeenCalled();
    expect(result.current.rasterLegendByLayerId).toEqual({});
  });
});
