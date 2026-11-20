/* eslint-disable no-template-curly-in-string */
import { renderHook, act } from "@testing-library/react";
import {
  isVariableChange,
  SIZE_SETTLE_MS,
  useStaticLayerZoom,
  whenMapSizeSettles,
  zoomStampFor,
} from "components/visualizations/zoomOnChange";
import { updateObjectWithVariableInputs } from "components/visualizations/utilities";
import * as layerExtent from "components/map/layerExtent";

// The surface the hook and the size wait use: the layers on the map by name,
// its size, and its "change:size" event.
function fakeMap({ size = [800, 600] } = {}) {
  const layers = [];
  const sizeListeners = [];
  let currentSize = size;
  return {
    layers,
    getLayers: () => ({ getArray: () => layers }),
    getSize: () => currentSize,
    on: (type, fn) => {
      if (type === "change:size") sizeListeners.push(fn);
    },
    un: (type, fn) => {
      const i = sizeListeners.indexOf(fn);
      if (i !== -1) sizeListeners.splice(i, 1);
    },
    resize: (next) => {
      currentSize = next;
      [...sizeListeners].forEach((fn) => fn());
    },
    pendingSizeListeners: () => sizeListeners.length,
  };
}

const fakeOlLayer = (name) => ({
  get: (key) => (key === "name" ? name : undefined),
});

// A GeoJSON layer read from a URL, as the layer editor saves one.
const URL_SOURCE = {
  type: "GeoJSON",
  props: {},
  geojson: "https://h/${Network}.geojson",
};

// A static layer as getVisualization hands it to the map: the source resolved
// with the variable values, the raw one alongside. `resolved` stands in for a
// source resolved some other way -- a relative date at a later moment.
function staticLayer({
  name = "Basins",
  rawSource = URL_SOURCE,
  values = { Network: "a" },
  resolved,
  zoom = true,
  extra = {},
} = {}) {
  return {
    configuration: {
      type: "VectorLayer",
      props: {
        name,
        source:
          resolved ??
          updateObjectWithVariableInputs({
            args: rawSource,
            variableInputs: values,
          }),
        ...(zoom ? { zoomToLayerOnChange: true } : {}),
        ...extra,
      },
    },
    rawSource,
  };
}

describe("zoomStampFor and isVariableChange", () => {
  test("the same saved config filled in differently is a variable change", () => {
    const a = zoomStampFor(URL_SOURCE, { Network: "a" });
    const b = zoomStampFor(URL_SOURCE, { Network: "b" });
    expect(a.key.geojson).toBe("https://h/a.geojson");
    expect(isVariableChange(a, b)).toBe(true);
  });

  test("an edit, a repeat, and a first stamp are not", () => {
    const a = zoomStampFor(URL_SOURCE, { Network: "a" });
    const edited = zoomStampFor(
      { ...URL_SOURCE, geojson: "https://h/v2/${Network}.geojson" },
      { Network: "a" },
    );
    expect(isVariableChange(a, edited)).toBe(false);
    expect(
      isVariableChange(a, zoomStampFor(URL_SOURCE, { Network: "a" })),
    ).toBe(false);
    expect(isVariableChange(undefined, a)).toBe(false);
  });

  test("masks the map's own extent variable, and only that one", () => {
    const raw = { geojson: "https://h/q?bbox=${Map Extent}" };
    const own = (extent) =>
      zoomStampFor(raw, { "Map Extent": extent }, "Map Extent");
    expect(isVariableChange(own("0,0,1,1"), own("2,2,3,3"))).toBe(false);

    const other = (extent) =>
      zoomStampFor(raw, { "Map Extent": extent }, "Other Extent");
    expect(isVariableChange(other("0,0,1,1"), other("2,2,3,3"))).toBe(true);
  });

  test("leaves a relative date as it was saved", () => {
    const raw = { geojson: "https://h/${Start}.geojson" };
    expect(zoomStampFor(raw, { Start: "now-1D" }).key.geojson).toBe(
      "https://h/now-1D.geojson",
    );
  });
});

describe("whenMapSizeSettles", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("fits once the map's size has held still, and only once", () => {
    const map = fakeMap();
    const fit = jest.fn();
    whenMapSizeSettles(map, fit);

    jest.advanceTimersByTime(SIZE_SETTLE_MS - 1);
    expect(fit).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(fit).toHaveBeenCalledTimes(1);
    expect(map.pendingSizeListeners()).toBe(0);

    map.resize([400, 300]);
    jest.advanceTimersByTime(SIZE_SETTLE_MS);
    expect(fit).toHaveBeenCalledTimes(1);
  });

  test("a map still growing is fitted at the size it settles at", () => {
    // A tab shown again: its map grows back from no width over a few frames.
    const map = fakeMap({ size: [0, 724] });
    const sizeAtFit = [];
    whenMapSizeSettles(map, () => sizeAtFit.push(map.getSize()));

    jest.advanceTimersByTime(1000);
    for (const width of [135, 781, 1753, 1912]) {
      map.resize([width, 724]);
      jest.advanceTimersByTime(40);
    }
    expect(sizeAtFit).toEqual([]);

    jest.advanceTimersByTime(SIZE_SETTLE_MS);
    expect(sizeAtFit).toEqual([[1912, 724]]);
  });

  test("waits for a size on both axes", () => {
    const map = fakeMap({ size: [0, 0] });
    const fit = jest.fn();
    whenMapSizeSettles(map, fit);

    map.resize([800, 0]);
    jest.advanceTimersByTime(1000);
    expect(fit).not.toHaveBeenCalled();
    map.resize([800, 600]);
    jest.advanceTimersByTime(SIZE_SETTLE_MS);
    expect(fit).toHaveBeenCalledTimes(1);
  });

  test("the returned function drops the wait", () => {
    const map = fakeMap();
    const fit = jest.fn();
    whenMapSizeSettles(map, fit)();
    expect(map.pendingSizeListeners()).toBe(0);
    jest.advanceTimersByTime(SIZE_SETTLE_MS);
    map.resize([400, 300]);
    jest.advanceTimersByTime(SIZE_SETTLE_MS);
    expect(fit).not.toHaveBeenCalled();
  });
});

describe("useStaticLayerZoom", () => {
  let zoomSpy;

  beforeEach(() => {
    jest.useFakeTimers();
    zoomSpy = jest.spyOn(layerExtent, "zoomToLayer").mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // Let the map's size hold for as long as a zoom waits on it.
  const settleSize = () =>
    act(() => {
      jest.advanceTimersByTime(SIZE_SETTLE_MS);
    });
  // Give the map a size, and let it hold.
  const resizeTo = (map, size) => {
    act(() => map.resize(size));
    settleSize();
  };

  // The hook over the given layers, where `show` delivers new layers as Base
  // would, and `build` does what MapComponent does once it has built a layer
  // from a config and put it on the map.
  const setup = ({
    layers = [staticLayer()],
    values = { Network: "a" },
    map = fakeMap(),
    mapExtentVariable,
  } = {}) => {
    let props = {
      layers,
      variableInputValues: values,
      mapRef: { current: map },
      mapExtentVariable,
    };
    const view = renderHook((p) => useStaticLayerZoom(p), {
      initialProps: props,
    });
    const show = (nextLayers, nextValues = props.variableInputValues) => {
      props = { ...props, layers: nextLayers, variableInputValues: nextValues };
      view.rerender(props);
    };
    const build = (configuration) => {
      const olLayer = fakeOlLayer(configuration.props.name);
      map.layers.push(olLayer);
      act(() => view.result.current(olLayer, configuration));
      settleSize();
      return olLayer;
    };
    return { ...view, map, show, build };
  };

  // A variable change as the hook sees it: the layers re-substituted with the
  // new values. (Base delivers the layers a render after the values, but the
  // hook reads the values only when the layers change.)
  const change = ({ show }, values, options = {}) => {
    const layers = [staticLayer({ values, ...options })];
    show(layers, values);
    return layers[0].configuration;
  };

  // The arguments of a fit of `layer`, with the check zoomToLayer asks once
  // the layer's data has arrived.
  const fitOf = (map, layer) => [
    map,
    layer,
    { isCurrent: expect.any(Function) },
  ];
  // That check, from the given call.
  const isCurrentOf = (call) => zoomSpy.mock.calls[call][2].isCurrent;

  test("a ticked layer zooms on the map's first load, once it is built", () => {
    const layers = [staticLayer()];
    const { map, build } = setup({ layers });
    expect(zoomSpy).not.toHaveBeenCalled();

    const olLayer = build(layers[0].configuration);
    expect(zoomSpy).toHaveBeenCalledTimes(1);
    expect(zoomSpy).toHaveBeenCalledWith(...fitOf(map, olLayer));

    // A rebuild from the same config -- a base map swap that failed a layer,
    // say -- owes nothing more.
    build(layers[0].configuration);
    expect(zoomSpy).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["is not ticked", { zoom: false }],
    [
      "is drawn by a server",
      {
        rawSource: { type: "WMS", props: { url: "https://h/${Network}" } },
      },
    ],
    ["is a plugin's", { extra: { pluginSource: { source: "p", args: {} } } }],
  ])("a layer that %s never zooms", (_, options) => {
    const layers = [staticLayer(options)];
    const hook = setup({ layers });
    hook.build(layers[0].configuration);
    hook.build(change(hook, { Network: "b" }, options));
    expect(zoomSpy).not.toHaveBeenCalled();
  });

  test("a map given no layers at all has nothing to zoom to", () => {
    const { build } = setup({ layers: null });
    build(staticLayer().configuration);
    expect(zoomSpy).not.toHaveBeenCalled();
  });

  test("a layer with no raw source never zooms", () => {
    const { rawSource: _dropped, ...layer } = staticLayer();
    const { build } = setup({ layers: [layer] });
    build(layer.configuration);
    expect(zoomSpy).not.toHaveBeenCalled();
  });

  test("a variable change zooms to the layer rebuilt for it", () => {
    const hook = setup();
    hook.build(staticLayer().configuration);
    expect(zoomSpy).toHaveBeenCalledTimes(1);

    const rebuiltFor = change(hook, { Network: "b" });
    // Nothing moves until the layer built from the new source is on the map.
    expect(zoomSpy).toHaveBeenCalledTimes(1);
    const rebuilt = hook.build(rebuiltFor);
    expect(zoomSpy).toHaveBeenCalledTimes(2);
    expect(zoomSpy).toHaveBeenLastCalledWith(...fitOf(hook.map, rebuilt));
  });

  test("a refresh does not zoom, even when a relative date in the source moves", () => {
    const rawSource = {
      ...URL_SOURCE,
      geojson: "https://h/${Start}.geojson",
    };
    const values = { Start: "now-1D" };
    const at = (day) => [
      staticLayer({
        rawSource,
        values,
        resolved: { ...URL_SOURCE, geojson: `https://h/${day}.geojson` },
      }),
    ];
    const first = at("2026-02-28");
    const { build, show } = setup({ layers: first, values });
    build(first[0].configuration);
    expect(zoomSpy).toHaveBeenCalledTimes(1);

    // The same saved source and values, resolved a day later.
    const refreshed = at("2026-03-01");
    show(refreshed, values);
    build(refreshed[0].configuration);
    expect(zoomSpy).toHaveBeenCalledTimes(1);
  });

  describe("with a relative date in the source", () => {
    const rawSource = { ...URL_SOURCE, geojson: "https://h/${Start}.geojson" };
    const resolvedTo = (day) => ({
      ...URL_SOURCE,
      geojson: `https://h/${day}.geojson`,
    });
    const at = (values, day) => [
      staticLayer({ rawSource, values, resolved: resolvedTo(day) }),
    ];

    test("a refresh that moves the date keeps a fit still waiting current", () => {
      const values = { Start: "now-1D" };
      const first = at(values, "2026-02-28");
      const { build, show } = setup({ layers: first, values });
      build(first[0].configuration);
      const stillWanted = isCurrentOf(0);

      show(at(values, "2026-03-01"), values);
      expect(stillWanted()).toBe(true);
    });

    test("a change that resolves to the same source does not zoom, then or on a refresh", () => {
      const relative = { Start: "now-1D" };
      const first = at(relative, "2026-02-28");
      const { build, show } = setup({ layers: first, values: relative });
      build(first[0].configuration);
      expect(zoomSpy).toHaveBeenCalledTimes(1);

      // The date it stands for, picked outright: the same file either way.
      const absolute = { Start: "2026-02-28" };
      const same = at(absolute, "2026-02-28");
      show(same, absolute);
      build(same[0].configuration);
      const refreshed = at(absolute, "2026-02-28");
      show(refreshed, absolute);
      build(refreshed[0].configuration);
      expect(zoomSpy).toHaveBeenCalledTimes(1);
    });
  });

  test("an edit to the layer's source does not zoom", () => {
    const hook = setup();
    hook.build(staticLayer().configuration);

    const edited = change(
      hook,
      { Network: "a" },
      {
        rawSource: {
          ...URL_SOURCE,
          geojson: "https://h/v2/${Network}.geojson",
        },
      },
    );
    hook.build(edited);
    expect(zoomSpy).toHaveBeenCalledTimes(1);
  });

  test("a layer added after the first load zooms only once a variable it uses changes", () => {
    const hook = setup({ layers: [] });
    hook.build(change(hook, { Network: "a" }));
    expect(zoomSpy).not.toHaveBeenCalled();

    hook.build(change(hook, { Network: "b" }));
    expect(zoomSpy).toHaveBeenCalledTimes(1);
  });

  test("a change to the map's own extent variable does not zoom", () => {
    const rawSource = {
      ...URL_SOURCE,
      geojson: "https://h/q?bbox=${Map Extent}",
    };
    const values = { "Map Extent": "0,0,1,1" };
    const layers = [staticLayer({ rawSource, values })];
    const hook = setup({ layers, values, mapExtentVariable: "Map Extent" });
    hook.build(layers[0].configuration);
    expect(zoomSpy).toHaveBeenCalledTimes(1);

    hook.build(change(hook, { "Map Extent": "2,2,3,3" }, { rawSource }));
    expect(zoomSpy).toHaveBeenCalledTimes(1);
  });

  test("a build for a change already superseded does not zoom; the newer one does", () => {
    const hook = setup();
    hook.build(staticLayer().configuration);

    const forB = change(hook, { Network: "b" });
    const forC = change(hook, { Network: "c" });
    // B's build lands after C was delivered: it is not what the map owes.
    hook.build(forB);
    expect(zoomSpy).toHaveBeenCalledTimes(1);

    const forCLayer = hook.build(forC);
    expect(zoomSpy).toHaveBeenCalledTimes(2);
    expect(zoomSpy).toHaveBeenLastCalledWith(...fitOf(hook.map, forCLayer));
  });

  test("a fit still waiting for its layer's data is dropped once a newer change arrives", () => {
    const hook = setup();
    hook.build(staticLayer().configuration);
    hook.build(change(hook, { Network: "b" }));
    const stillWanted = isCurrentOf(1);
    expect(stillWanted()).toBe(true);

    // A refresh delivers the same source again: b's data is still current.
    change(hook, { Network: "b" });
    expect(stillWanted()).toBe(true);

    // c's data is on its way: b's must not land over it, however slow.
    change(hook, { Network: "c" });
    expect(stillWanted()).toBe(false);
  });

  test.each([
    [
      "its source is edited",
      {
        rawSource: {
          ...URL_SOURCE,
          geojson: "https://h/v2/${Network}.geojson",
        },
      },
    ],
    ["it is unticked", { zoom: false }],
    ["it is renamed", { name: "Basins 2" }],
  ])(
    "a fit still waiting for its layer's data is dropped once %s",
    (_, options) => {
      const hook = setup();
      hook.build(staticLayer().configuration);
      const stillWanted = isCurrentOf(0);

      change(hook, { Network: "a" }, options);
      expect(stillWanted()).toBe(false);
    },
  );

  test("a zoom stays owed until a build for it lands, through a refresh or a failed build", () => {
    const hook = setup();
    hook.build(staticLayer().configuration);

    // Its build failed, or a refresh replaced the pass before it landed.
    change(hook, { Network: "b" });
    // Base delivers the same layers again, as new objects.
    const refreshed = change(hook, { Network: "b" });
    hook.build(refreshed);
    expect(zoomSpy).toHaveBeenCalledTimes(2);
  });

  test("an edit to the layer's source drops a zoom it owed", () => {
    const hook = setup();
    hook.build(staticLayer().configuration);

    change(hook, { Network: "b" });
    const edited = change(
      hook,
      { Network: "b" },
      {
        rawSource: {
          ...URL_SOURCE,
          geojson: "https://h/v2/${Network}.geojson",
        },
      },
    );
    hook.build(edited);
    expect(zoomSpy).toHaveBeenCalledTimes(1);
  });

  test("renaming a layer is an edit, and does not zoom", () => {
    const hook = setup();
    hook.build(staticLayer().configuration);

    hook.build(change(hook, { Network: "b" }, { name: "Basins 2" }));
    expect(zoomSpy).toHaveBeenCalledTimes(1);
  });

  test("unticking a layer drops a zoom it owed", () => {
    const hook = setup();
    hook.build(staticLayer().configuration);

    change(hook, { Network: "b" });
    hook.build(change(hook, { Network: "b" }, { zoom: false }));
    expect(zoomSpy).toHaveBeenCalledTimes(1);
  });

  test("a copied config still zooms: a build is matched by name and source", () => {
    const layers = [staticLayer()];
    const { build } = setup({ layers });
    build(JSON.parse(JSON.stringify(layers[0].configuration)));
    expect(zoomSpy).toHaveBeenCalledTimes(1);
  });

  describe("on a map with no size", () => {
    test("waits for a size, then zooms the layer of that name on the map", () => {
      const map = fakeMap({ size: [0, 0] });
      const layers = [staticLayer()];
      const { build } = setup({ layers, map });
      build(layers[0].configuration);
      expect(zoomSpy).not.toHaveBeenCalled();
      expect(map.pendingSizeListeners()).toBe(1);

      // A refresh while the tab is hidden rebuilds the layer.
      const rebuilt = fakeOlLayer("Basins");
      map.layers.push(rebuilt);

      resizeTo(map, [800, 600]);
      expect(zoomSpy).toHaveBeenCalledTimes(1);
      expect(zoomSpy).toHaveBeenCalledWith(...fitOf(map, rebuilt));
      expect(map.pendingSizeListeners()).toBe(0);
    });

    test("does not fit a layer since rebuilt for a newer change; that build zooms", () => {
      const map = fakeMap({ size: [0, 0] });
      const layers = [staticLayer()];
      const hook = setup({ layers, map });
      hook.build(layers[0].configuration);

      const forB = change(hook, { Network: "b" });
      // Shown before b's layer is built: a's layer is the one on the map.
      resizeTo(map, [800, 600]);
      expect(zoomSpy).not.toHaveBeenCalled();

      const forBLayer = hook.build(forB);
      expect(zoomSpy).toHaveBeenCalledTimes(1);
      expect(zoomSpy).toHaveBeenCalledWith(...fitOf(map, forBLayer));
    });

    test("a map growing back as its tab is shown is fitted at its full size", () => {
      const map = fakeMap({ size: [0, 0] });
      const sizeAtFit = [];
      zoomSpy.mockImplementation(async (m) => {
        sizeAtFit.push(m.getSize());
        return true;
      });
      const layers = [staticLayer()];
      const { build } = setup({ layers, map });
      build(layers[0].configuration);

      for (const width of [135, 781, 1753, 1912]) {
        act(() => map.resize([width, 724]));
        act(() => {
          jest.advanceTimersByTime(40);
        });
      }
      expect(zoomSpy).not.toHaveBeenCalled();
      settleSize();
      expect(sizeAtFit).toEqual([[1912, 724]]);
    });

    test("does not fit a layer taken off the map before it was shown", () => {
      const map = fakeMap({ size: [0, 0] });
      const layers = [staticLayer()];
      const { build } = setup({ layers, map });
      build(layers[0].configuration);

      map.layers.length = 0;
      resizeTo(map, [800, 600]);
      expect(zoomSpy).not.toHaveBeenCalled();
    });

    test("an edit to the layer's source drops the wait", () => {
      const map = fakeMap({ size: [0, 0] });
      const layers = [staticLayer()];
      const hook = setup({ layers, map });
      hook.build(layers[0].configuration);

      change(
        hook,
        { Network: "a" },
        {
          rawSource: {
            ...URL_SOURCE,
            geojson: "https://h/v2/${Network}.geojson",
          },
        },
      );
      expect(map.pendingSizeListeners()).toBe(0);
    });

    test("unticking the layer drops the wait", () => {
      const map = fakeMap({ size: [0, 0] });
      const layers = [staticLayer()];
      const hook = setup({ layers, map });
      hook.build(layers[0].configuration);

      change(hook, { Network: "a" }, { zoom: false });
      expect(map.pendingSizeListeners()).toBe(0);
      resizeTo(map, [800, 600]);
      expect(zoomSpy).not.toHaveBeenCalled();
    });

    test("removing the layer drops the wait", () => {
      const map = fakeMap({ size: [0, 0] });
      const layers = [staticLayer()];
      const { build, show } = setup({ layers, map });
      build(layers[0].configuration);

      show([]);
      expect(map.pendingSizeListeners()).toBe(0);
    });

    test("unmounting drops the wait", () => {
      const map = fakeMap({ size: [0, 0] });
      const layers = [staticLayer()];
      const { build, unmount } = setup({ layers, map });
      build(layers[0].configuration);

      unmount();
      expect(map.pendingSizeListeners()).toBe(0);
      map.resize([800, 600]);
      expect(zoomSpy).not.toHaveBeenCalled();
    });
  });
});
