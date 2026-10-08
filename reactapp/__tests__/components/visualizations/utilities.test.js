/* eslint-disable no-template-curly-in-string */
// This file tests ${variable} substitution (including the feature.* scope);
// literal `${...}` strings appear throughout test names and assertions on
// purpose, so disable the missing-backtick lint at the file level.
import {
  getVisualization,
  getGridItem,
  updateObjectWithVariableInputs,
  getBaseMapLayer,
  findSelectOptionByValue,
  baseMapLayers,
  downloadJSONFile,
  checkForEmptyVariableInputs,
  findUnresolvedFeatureTokens,
  findUnresolvedVariableInputTokens,
  clearImageVizCache,
  getCachedImageViz,
  setCachedImageViz,
  buildImageVizCacheKey,
  argsContainPreset,
  IMAGE_VIZ_CACHE_LIMIT,
  toNumberOrEmpty,
  normalizeVariableInputValue,
  getPublishedVariableInputValues,
  getVariableInputDateFormat,
  buildPreloadedRequestKey,
} from "components/visualizations/utilities";
import appAPI from "services/api/app";
import {
  buildPreloadedVisualizationKey,
  clearPreloadedVisualizations,
  setPreloadedVisualization,
  takePreloadedVisualization,
} from "components/visualizations/preloadedVisualizationCache";
import { server } from "__tests__/utilities/server";
import { rest } from "msw";
import { format } from "date-fns";
import { convertDatesToLocalISO, parseDate } from "components/inputs/dateUtils";

jest.mock("components/visualizations/Map", () => {
  const MockMapVisualization = () => <div>Map Mock</div>;
  MockMapVisualization.displayName = "MapVisualization"; // Set the display name to resolve the linting warning
  return MockMapVisualization;
});

// The image-viz cache is module-level state; reset it between tests so cached
// results from one test don't short-circuit the backend call another expects.
beforeEach(() => {
  clearImageVizCache();
});

test("getVisualization bad response", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: false,
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const visualizationRef = jest.fn();
  await getVisualization({
    setVizType: mockSetVizType,
    setVizData: mockSetVizData,
    sourceType: "",
    itemData: {},
    visualizationRef,
    metadataString: "{}",
    argsString: "{}",
    variableInputValues: [],
  });

  expect(mockSetVizType.mock.calls[0][0]).toBe("loader");
  expect(mockSetVizType.mock.calls[1][0]).toBe("vizError");
  expect(mockSetVizData.mock.calls[0][0]).toStrictEqual({
    error: "Failed to retrieve data",
  });
});

test("getVisualization bad response with custom messaging", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: false,
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const visualizationRef = jest.fn();
  await getVisualization({
    setVizType: mockSetVizType,
    setVizData: mockSetVizData,
    sourceType: "",
    itemData: {},
    visualizationRef,
    metadataString: JSON.stringify({
      customMessaging: {
        error: "custom error message",
      },
    }),
    argsString: "{}",
    variableInputValues: [],
  });

  expect(mockSetVizType.mock.calls[0][0]).toBe("loader");
  expect(mockSetVizType.mock.calls[1][0]).toBe("vizError");
  expect(mockSetVizData.mock.calls[0][0]).toStrictEqual({
    error: "custom error message",
  });
});

test("getVisualization bad type", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            data: {},
            viz_type: "some random type",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const visualizationRef = jest.fn();
  await getVisualization({
    setVizType: mockSetVizType,
    setVizData: mockSetVizData,
    sourceType: "sdfsd",
    itemData: {},
    visualizationRef,
    metadataString: "{}",
    argsString: "{}",
    variableInputValues: [],
  });

  expect(mockSetVizType.mock.calls[0][0]).toBe("loader");
  expect(mockSetVizType.mock.calls[1][0]).toBe("vizWarning");
  expect(mockSetVizData.mock.calls[0][0]).toStrictEqual({
    warnings: ["some random type visualizations still need to be configured"],
  });
});

test("getVisualization plotly", async () => {
  const plotData = { data: {}, layout: {} };
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            viz_type: "plotly",
            data: plotData,
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const visualizationRef = jest.fn();
  await getVisualization({
    setVizType: mockSetVizType,
    setVizData: mockSetVizData,
    sourceType: "plotly",
    itemData: {},
    visualizationRef,
    metadataString: "{}",
    argsString: "{}",
    variableInputValues: [],
  });

  expect(mockSetVizType.mock.calls[0][0]).toBe("loader");
  expect(mockSetVizType.mock.calls[1][0]).toBe("plotly");
  expect(mockSetVizData.mock.calls[0][0]).toStrictEqual({
    data: {},
    layout: {},
    config: undefined,
    toggle_subplots: undefined,
    subplot_toggle: undefined,
    min_plot_height: undefined,
    min_plot_width: undefined,
  });
});

test("getVisualization plotly passes through subplot toggle opt-in keys", async () => {
  // Regression: the plotly branch must forward the plugin-returned
  // top-level `toggle_subplots`, `subplot_toggle`, `min_plot_height` and
  // `min_plot_width` keys, not strip the response to data/layout/config.
  const plotData = {
    data: [],
    layout: {},
    toggle_subplots: true,
    subplot_toggle: { reflow: "vertical" },
    min_plot_height: 800,
    min_plot_width: 1200,
  };
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({ success: true, viz_type: "plotly", data: plotData }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  await getVisualization({
    setVizType: mockSetVizType,
    setVizData: mockSetVizData,
    sourceType: "plotly",
    itemData: {},
    visualizationRef: jest.fn(),
    metadataString: "{}",
    argsString: "{}",
    variableInputValues: [],
  });

  expect(mockSetVizData.mock.calls[0][0]).toStrictEqual({
    data: [],
    layout: {},
    config: undefined,
    toggle_subplots: true,
    subplot_toggle: { reflow: "vertical" },
    min_plot_height: 800,
    min_plot_width: 1200,
  });
});

test("getVisualization image", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            viz_type: "image",
            data: "some_path",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const visualizationRef = jest.fn();
  await getVisualization({
    setVizType: mockSetVizType,
    setVizData: mockSetVizData,
    sourceType: "image",
    itemData: { source: "some_source" },
    visualizationRef,
    metadataString: "{}",
    argsString: "{}",
    variableInputValues: [],
  });

  expect(mockSetVizType.mock.calls[0][0]).toBe("loader");
  expect(mockSetVizType.mock.calls[1][0]).toBe("image");
  expect(mockSetVizData.mock.calls[0][0]).toStrictEqual({
    source: "some_path",
    alt: "some_source",
    imageError: undefined,
  });
});

test("getVisualization image caches result, skips repeat request, refresh bypasses", async () => {
  let requestCount = 0;
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        requestCount += 1;
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            viz_type: "image",
            data: "cached_path",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  const baseParams = (setVizType, setVizData) => ({
    setVizType,
    setVizData,
    sourceType: "image",
    itemData: { source: "img_source" },
    metadataString: "{}",
    argsString: JSON.stringify({ station: "ABC", hour: "05" }),
    variableInputValues: {},
  });

  // First call: hits the backend and populates the cache.
  const type1 = jest.fn();
  const data1 = jest.fn();
  await getVisualization(baseParams(type1, data1));
  expect(requestCount).toBe(1);
  expect(type1.mock.calls.map((c) => c[0])).toEqual(["loader", "image"]);
  expect(data1.mock.calls[0][0]).toStrictEqual({
    source: "cached_path",
    alt: "img_source",
    imageError: undefined,
  });

  // Second identical call: served from cache — no backend request, no loader.
  const type2 = jest.fn();
  const data2 = jest.fn();
  await getVisualization(baseParams(type2, data2));
  expect(requestCount).toBe(1);
  expect(type2.mock.calls.map((c) => c[0])).toEqual(["image"]);
  expect(data2.mock.calls[0][0]).toStrictEqual({
    source: "cached_path",
    alt: "img_source",
    imageError: undefined,
  });

  // refresh: true bypasses the cache and re-fetches.
  const type3 = jest.fn();
  const data3 = jest.fn();
  await getVisualization({ ...baseParams(type3, data3), refresh: true });
  expect(requestCount).toBe(2);
  expect(type3.mock.calls[0][0]).toBe("loader");

  // Different args do not collide with the cached entry.
  const type4 = jest.fn();
  const data4 = jest.fn();
  await getVisualization({
    ...baseParams(type4, data4),
    argsString: JSON.stringify({ station: "ABC", hour: "06" }),
  });
  expect(requestCount).toBe(3);
  expect(type4.mock.calls[0][0]).toBe("loader");
});

test("getVisualization does not cache an image whose date arg is the 'latest' preset", async () => {
  let requestCount = 0;
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        requestCount += 1;
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            viz_type: "image",
            data: "latest_path",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  const baseParams = (setVizType, setVizData) => ({
    setVizType,
    setVizData,
    sourceType: "image",
    sourceArgs: { DATETIME: "date" },
    itemData: { source: "img_source" },
    metadataString: "{}",
    argsString: JSON.stringify({ DATETIME: "latest" }),
    variableInputValues: {},
  });

  // First call hits the backend.
  const type1 = jest.fn();
  const data1 = jest.fn();
  await getVisualization(baseParams(type1, data1));
  expect(requestCount).toBe(1);

  // Second identical call must NOT be served from cache — "latest" re-resolves,
  // so the cache is neither read nor written for a sentinel-bearing date arg.
  const type2 = jest.fn();
  const data2 = jest.fn();
  await getVisualization(baseParams(type2, data2));
  expect(requestCount).toBe(2);
  expect(type2.mock.calls.map((c) => c[0])).toEqual(["loader", "image"]);
});

test("buildImageVizCacheKey falls back to null for missing source/args", () => {
  // Both ?? null branches: nullish source and nullish args.
  expect(buildImageVizCacheKey({})).toBe(JSON.stringify({ s: null, a: null }));
  // Truthy branches: both provided.
  expect(buildImageVizCacheKey({ source: "img", args: { hour: "05" } })).toBe(
    JSON.stringify({ s: "img", a: { hour: "05" } }),
  );
});

test("argsContainPreset detects a preset only in date-typed args", () => {
  // Sentinel in a date-typed arg -> true.
  expect(argsContainPreset({ DATETIME: "latest" }, { DATETIME: "date" })).toBe(
    true,
  );
  // Sentinel in a NON-date arg -> false (no spurious cache-disable collision).
  expect(argsContainPreset({ region: "latest" }, { region: "text" })).toBe(
    false,
  );
  // Concrete date -> false.
  expect(
    argsContainPreset(
      { DATETIME: "2026-06-29T00:00:00" },
      { DATETIME: "date" },
    ),
  ).toBe(false);
  // Nested date-range endpoint sentinel -> true; array values handled too.
  expect(
    argsContainPreset(
      { range: { "Start Date": "latest", "End Date": "x" } },
      { range: "date-range" },
    ),
  ).toBe(true);
  expect(argsContainPreset({ d: ["latest"] }, { d: "date" })).toBe(true);
  // Without sourceArgs nothing is known to be date-typed -> false.
  expect(argsContainPreset({ DATETIME: "latest" })).toBe(false);
  expect(argsContainPreset({})).toBe(false);
  expect(argsContainPreset(null)).toBe(false);
});

test("image cache evicts the least-recently-used entry past the limit", () => {
  // LRU mechanics are pure, so exercise the eviction branch directly rather
  // than driving thousands of slow getVisualization round-trips.
  for (let i = 0; i < IMAGE_VIZ_CACHE_LIMIT; i += 1) {
    setCachedImageViz(`k${i}`, `v${i}`);
  }
  // A read promotes k0 to most-recently-used, so the next eviction must drop
  // k1 (now the oldest) instead.
  expect(getCachedImageViz("k0")).toBe("v0");

  // One more distinct entry overflows the cache and evicts the LRU entry.
  setCachedImageViz("kOverflow", "vOverflow");

  expect(getCachedImageViz("k1")).toBeUndefined(); // evicted
  expect(getCachedImageViz("k0")).toBe("v0"); // promoted, survived
  expect(getCachedImageViz("kOverflow")).toBe("vOverflow");
});

test("getVisualization, empty variable and no custom messaging", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            viz_type: "image",
            data: "some_path",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const visualizationRef = jest.fn();
  await getVisualization({
    setVizType: mockSetVizType,
    setVizData: mockSetVizData,
    sourceType: "image",
    itemData: { source: "some_source" },
    visualizationRef,
    metadataString: JSON.stringify({}),
    // eslint-disable-next-line
    argsString: JSON.stringify({ gauge_location: "${Location} ${Time}" }),
    variableInputValues: {},
  });

  expect(mockSetVizType.mock.calls[0][0]).toBe("vizWarning");
  expect(mockSetVizData.mock.calls[0][0]).toStrictEqual({
    warnings: ["Location variable is empty", "Time variable is empty"],
  });
});

test("getVisualization, empty variable and custom messaging", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            viz_type: "image",
            data: "some_path",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const visualizationRef = jest.fn();
  await getVisualization({
    setVizType: mockSetVizType,
    setVizData: mockSetVizData,
    sourceType: "image",
    itemData: { source: "some_source" },
    visualizationRef,
    metadataString: JSON.stringify({
      customMessaging: {
        Location: "custom location message",
      },
    }),
    // eslint-disable-next-line
    argsString: JSON.stringify({ gauge_location: "${Location} ${Time}" }),
    variableInputValues: { Time: "some value" },
  });

  expect(mockSetVizType.mock.calls[0][0]).toBe("vizWarning");
  expect(mockSetVizData.mock.calls[0][0]).toStrictEqual({
    warnings: ["custom location message"],
  });
});

test("getVisualization table", async () => {
  const tableData = {
    data: [],
    title: "Some Title",
    subtitle: "Some Subtitle",
  };
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            viz_type: "table",
            data: tableData,
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const visualizationRef = jest.fn();
  await getVisualization({
    setVizType: mockSetVizType,
    setVizData: mockSetVizData,
    sourceType: "table",
    itemData: {},
    visualizationRef,
    metadataString: "{}",
    argsString: "{}",
    variableInputValues: [],
  });

  expect(mockSetVizType.mock.calls[0][0]).toBe("loader");
  expect(mockSetVizType.mock.calls[1][0]).toBe("table");
  expect(mockSetVizData.mock.calls[0][0]).toStrictEqual({
    data: [],
    title: "Some Title",
    subtitle: "Some Subtitle",
  });
});

test("getVisualization card", async () => {
  const cardData = {
    data: [],
    title: "Some Title",
    description: "Some Description",
  };
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            viz_type: "card",
            data: cardData,
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const visualizationRef = jest.fn();
  await getVisualization({
    setVizType: mockSetVizType,
    setVizData: mockSetVizData,
    sourceType: "card",
    itemData: {},
    visualizationRef,
    metadataString: "{}",
    argsString: "{}",
    variableInputValues: [],
  });

  expect(mockSetVizType.mock.calls[0][0]).toBe("loader");
  expect(mockSetVizType.mock.calls[1][0]).toBe("card");
  expect(mockSetVizData.mock.calls[0][0]).toStrictEqual({
    data: [],
    title: "Some Title",
    description: "Some Description",
  });
});

test("getVisualization map", async () => {
  const mapData = {
    map_extent: "",
    layers: [],
    mapConfig: {},
    legend: [],
  };
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            viz_type: "map",
            data: mapData,
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const visualizationRef = jest.fn();
  await getVisualization({
    setVizType: mockSetVizType,
    setVizData: mockSetVizData,
    sourceType: "map",
    itemData: {},
    visualizationRef,
    metadataString: "{}",
    argsString: "{}",
    variableInputValues: [],
  });

  expect(mockSetVizType.mock.calls[0][0]).toBe("map");
  expect(mockSetVizData.mock.calls[0][0]).toStrictEqual({
    baseMap: undefined,
    layerControl: undefined,
    layers: [],
    mapConfig: {},
    map_extent: "",
  });
});

// Lines 126-130: source === "Map" short-circuit with popupConfig restoration.
// These tests do NOT need a server mock — the Map branch returns before any API call.

describe("getVisualization source=Map (popupConfig restoration, lines 126-130)", () => {
  const baseCall = (overrides) =>
    getVisualization({
      setVizType: jest.fn(),
      setVizData: jest.fn(),
      sourceType: "Map",
      metadataString: "{}",
      variableInputValues: [],
      ...overrides,
    });

  test("restores raw popupConfig onto each layer when argsString has one (line 130 truthy branch)", async () => {
    // The resolved layer would lose ${variable} tokens in popupConfig;
    // the raw argsString version must win.
    const rawPopupConfig = { titleTemplate: "${feature.name}", mode: "modal" };
    const resolvedLayer = {
      name: "Layer A",
      popupConfig: { titleTemplate: "resolved name", mode: "modal" },
    };

    const mockSetVizData = jest.fn();
    await baseCall({
      setVizData: mockSetVizData,
      itemData: {
        source: "Map",
        args: {
          layers: [resolvedLayer],
          baseMap: "base",
          layerControl: true,
          map_extent: [0, 0, 1, 1],
          mapConfig: {},
          mapDrawing: null,
        },
      },
      argsString: JSON.stringify({
        layers: [{ name: "Layer A", popupConfig: rawPopupConfig }],
      }),
    });

    const { layers } = mockSetVizData.mock.calls[0][0];
    expect(layers).toHaveLength(1);
    // popupConfig must come from the raw argsString, not the resolved layer
    expect(layers[0].popupConfig).toEqual(rawPopupConfig);
    // other layer props are preserved from itemData.args
    expect(layers[0].name).toBe("Layer A");
  });

  test("returns layer unchanged when argsString layer has no popupConfig (line 130 falsy branch)", async () => {
    const layer = { name: "Layer B", fill: "#ff0000" };

    const mockSetVizData = jest.fn();
    await baseCall({
      setVizData: mockSetVizData,
      itemData: {
        source: "Map",
        args: {
          layers: [layer],
          baseMap: null,
          layerControl: false,
          map_extent: null,
          mapConfig: null,
          mapDrawing: null,
        },
      },
      // argsString has a layer but no popupConfig on it
      argsString: JSON.stringify({ layers: [{ name: "Layer B" }] }),
    });

    const { layers } = mockSetVizData.mock.calls[0][0];
    expect(layers[0]).toEqual(layer);
  });

  test("falls back to empty rawLayers when argsString has no layers key (line 127 ?? branch)", async () => {
    // argsString has no `layers` property → rawLayers = []
    // rawLayers[i] is undefined → popupConfig treated as absent → layer unchanged
    const layer = { name: "Layer C", popupConfig: { mode: "table" } };

    const mockSetVizData = jest.fn();
    await baseCall({
      setVizData: mockSetVizData,
      itemData: {
        source: "Map",
        args: {
          layers: [layer],
          baseMap: null,
          layerControl: false,
          map_extent: null,
          mapConfig: null,
          mapDrawing: null,
        },
      },
      argsString: JSON.stringify({}), // no "layers" key at all
    });

    const { layers } = mockSetVizData.mock.calls[0][0];
    // layer returned as-is because there was no raw entry to restore from
    expect(layers[0]).toEqual(layer);
  });

  test("produces empty layers when itemData.args.layers is undefined (line 128 ?? branch)", async () => {
    const mockSetVizData = jest.fn();
    await baseCall({
      setVizData: mockSetVizData,
      itemData: {
        source: "Map",
        args: {
          // layers deliberately omitted
          baseMap: "base",
          layerControl: true,
          map_extent: null,
          mapConfig: {},
          mapDrawing: null,
        },
      },
      argsString: JSON.stringify({
        layers: [{ name: "Layer D", popupConfig: { mode: "modal" } }],
      }),
    });

    const { layers, baseMap } = mockSetVizData.mock.calls[0][0];
    expect(layers).toEqual([]);
    expect(baseMap).toBe("base");
  });
});

test("getVisualization custom", async () => {
  const customData = {
    url: "url",
    scope: "scope",
    module: "module",
    props: {},
  };
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            data: customData,
            viz_type: "custom",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const visualizationRef = jest.fn();
  await getVisualization({
    setVizType: mockSetVizType,
    setVizData: mockSetVizData,
    sourceType: "custom",
    itemData: {},
    visualizationRef,
    metadataString: "{}",
    argsString: "{}",
    variableInputValues: [],
  });

  expect(mockSetVizType.mock.calls[0][0]).toBe("loader");
  expect(mockSetVizType.mock.calls[1][0]).toBe("custom");
  expect(mockSetVizData.mock.calls[0][0]).toStrictEqual({
    url: "url",
    scope: "scope",
    module: "module",
    remoteType: "webpack",
    props: {},
  });
});

test("getVisualization text", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            data: { text: "some text" },
            viz_type: "text",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const visualizationRef = jest.fn();
  await getVisualization({
    setVizType: mockSetVizType,
    setVizData: mockSetVizData,
    sourceType: "text",
    itemData: {},
    visualizationRef,
    metadataString: "{}",
    argsString: "{}",
    variableInputValues: [],
  });

  expect(mockSetVizType.mock.calls[0][0]).toBe("loader");
  expect(mockSetVizType.mock.calls[1][0]).toBe("text");
  expect(mockSetVizData.mock.calls[0][0]).toStrictEqual({
    text: "some text",
  });
});

test("getVisualization variable input", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            data: {
              variable_name: "some variable_name",
              initial_value: "some initial_value",
              variable_options_source: "some variable_options_source",
              show_label: true,
            },
            viz_type: "variable_input",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const visualizationRef = jest.fn();
  await getVisualization({
    setVizType: mockSetVizType,
    setVizData: mockSetVizData,
    sourceType: "variableInput",
    itemData: {},
    visualizationRef,
    metadataString: "{}",
    argsString: "{}",
    variableInputValues: [],
  });

  expect(mockSetVizType.mock.calls[0][0]).toBe("loader");
  expect(mockSetVizType.mock.calls[1][0]).toBe("variableInput");
  expect(mockSetVizData.mock.calls[0][0]).toStrictEqual({
    variable_name: "some variable_name",
    initial_value: "some initial_value",
    variable_options_source: "some variable_options_source",
    show_label: true,
    metadata: undefined,
  });
});

test("getVisualization Live Chat", async () => {
  const date = Date.now();
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            data: {
              chatHistory: [
                {
                  message: "Hello world!",
                  sessionId: "session-1",
                  sender: "Alice",
                  timestamp: date,
                  messageId: "msg-1",
                  edited: false,
                },
              ],
              requestId: "some-request-id",
            },
            viz_type: "Live Chat",
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const visualizationRef = jest.fn();
  await getVisualization({
    setVizType: mockSetVizType,
    setVizData: mockSetVizData,
    sourceType: "Live Chat",
    itemData: { requestId: "some-request-id" },
    visualizationRef,
    metadataString: "{}",
    argsString: "{}",
    variableInputValues: [],
  });

  expect(mockSetVizType.mock.calls[0][0]).toBe("loader");
  expect(mockSetVizType.mock.calls[1][0]).toBe("liveChat");
  expect(mockSetVizData.mock.calls[0][0]).toStrictEqual({
    chatHistory: [
      {
        message: "Hello world!",
        sessionId: "session-1",
        sender: "Alice",
        timestamp: date,
        messageId: "msg-1",
        edited: false,
      },
    ],
    requestId: "some-request-id",
  });
});

test("getVisualization imageCollection", async () => {
  const imageCollectionData = {
    title: "Image Collection",
    urls: ["https://example.com/image1.png", "https://example.com/image2.png"],
    columns: 2,
  };
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            viz_type: "imageCollection",
            data: imageCollectionData,
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();
  const visualizationRef = jest.fn();
  await getVisualization({
    setVizType: mockSetVizType,
    setVizData: mockSetVizData,
    sourceType: "imageCollection",
    itemData: {},
    visualizationRef,
    metadataString: "{}",
    argsString: "{}",
    variableInputValues: [],
  });

  expect(mockSetVizType.mock.calls[0][0]).toBe("loader");
  expect(mockSetVizType.mock.calls[1][0]).toBe("imageCollection");
  expect(mockSetVizData.mock.calls[0][0]).toStrictEqual({
    title: "Image Collection",
    urls: ["https://example.com/image1.png", "https://example.com/image2.png"],
    columns: 2,
    imageError: undefined,
  });
});

test("getGridItem", async () => {
  const gridItems = [
    { i: 1, data: "1" },
    { i: 2, data: "2" },
    { i: 3, data: "3" },
  ];
  const result = getGridItem(gridItems, 2);

  expect(result).toStrictEqual({ i: 2, data: "2" });
});

test("updateObjectWithVariableInputs", async () => {
  const args = {
    // eslint-disable-next-line
    location: "${Some Variable}",
    // eslint-disable-next-line
    text: "Here is some text with the a variable ${Some Variable}",
  };
  const variableInputs = { "Some Variable": "Test" };

  let result = updateObjectWithVariableInputs({
    args: JSON.parse(JSON.stringify(args)),
    variableInputs,
  });
  expect(result).toStrictEqual({
    location: "Test",
    text: "Here is some text with the a variable Test",
  });

  const newResult = updateObjectWithVariableInputs({
    args: JSON.parse(JSON.stringify(args)),
    variableInputs: {},
  });
  expect(newResult).toStrictEqual({
    location: "",
    text: "Here is some text with the a variable ",
  });

  const jsonResult = updateObjectWithVariableInputs({
    args: JSON.parse(JSON.stringify(args)),
    variableInputs: { "Some Variable": { some: "value" } },
  });
  expect(jsonResult).toStrictEqual({
    location: { some: "value" },
    text: 'Here is some text with the a variable {"some":"value"}',
  });

  const date_args = {
    // eslint-disable-next-line
    a_date: "${Some Variable}",
    text_arg: "now",
  };
  const dateVariableInputs = {
    "Some Variable": "now",
  };
  const variableInputDateFormats = {
    "Some Variable": "yyyy-MM-dd'T'HH:mm:ss'Z'",
  };

  // Mock Date to ensure consistent timing
  const fixedDate = new Date("2023-01-01T12:00:00Z");
  const originalDate = global.Date;
  global.Date = jest.fn(() => fixedDate);
  global.Date.now = jest.fn(() => fixedDate.getTime());

  try {
    const dateResult = updateObjectWithVariableInputs({
      args: JSON.parse(JSON.stringify(date_args)),
      variableInputs: dateVariableInputs,
      variableInputDateFormats,
    });
    const expectedADate = format(
      fixedDate,
      variableInputDateFormats["Some Variable"],
    );
    expect(dateResult).toStrictEqual({
      a_date: expectedADate,
      text_arg: "now",
    });
  } finally {
    // Restore original Date
    global.Date = originalDate;
  }
});

describe("updateObjectWithVariableInputs date arg resolution", () => {
  // Mock Date so "now" math is deterministic and timezone-independent
  // assertions can be derived from the same parseDate/convertDatesToLocalISO
  // helpers the implementation uses.
  const fixedDate = new Date("2023-06-15T12:30:00Z");
  let originalDate;

  beforeEach(() => {
    originalDate = global.Date;
    const MockedDate = class extends originalDate {
      constructor(...dateArgs) {
        if (dateArgs.length === 0) {
          super(fixedDate.getTime());
          return;
        }
        super(...dateArgs);
      }
      static now = () => fixedDate.getTime();
      static UTC = originalDate.UTC;
      static parse = originalDate.parse;
    };
    global.Date = MockedDate;
  });

  afterEach(() => {
    global.Date = originalDate;
  });

  it("resolves a relative date for an exactly-'date' arg", () => {
    const result = updateObjectWithVariableInputs({
      args: { d: "now-1D" },
      variableInputs: {},
      variableInputDateFormats: {},
      sourceArgs: { d: "date" },
      returnDatesAsLocalISO: true,
    });
    expect(result.d).toBe(convertDatesToLocalISO(parseDate("now-1D")));
    expect(result.d).not.toBe("now-1D");
  });

  it("resolves a relative date for a 'date-hour' arg (regression guard)", () => {
    const result = updateObjectWithVariableInputs({
      args: { d: "now-1D" },
      variableInputs: {},
      variableInputDateFormats: {},
      sourceArgs: { d: "date-hour" },
      returnDatesAsLocalISO: true,
    });
    expect(result.d).toBe(convertDatesToLocalISO(parseDate("now-1D")));
    expect(result.d).not.toBe("now-1D");
  });

  it("passes a 'latest' preset sentinel through a date arg verbatim", () => {
    const result = updateObjectWithVariableInputs({
      args: { d: "latest" },
      variableInputs: {},
      variableInputDateFormats: {},
      sourceArgs: { d: "date" },
      returnDatesAsLocalISO: true,
    });
    expect(result.d).toBe("latest");
  });

  it("passes a 'latest' preset through a shared date variable input", () => {
    // AE3: a date-typed variable input set to 'latest' substitutes the literal
    // string into the connected arg rather than formatting it to null.
    const result = updateObjectWithVariableInputs({
      args: { d: "${Forecast Date}" },
      variableInputs: { "Forecast Date": "latest" },
      variableInputDateFormats: { "Forecast Date": "MM/dd/yyyy h:mm aa" },
      sourceArgs: { d: "date" },
      returnDatesAsLocalISO: true,
    });
    expect(result.d).toBe("latest");
  });

  it("passes a 'latest' sentinel through a date-range endpoint verbatim", () => {
    const result = updateObjectWithVariableInputs({
      args: { range: { "Start Date": "latest", "End Date": "now" } },
      variableInputs: {},
      variableInputDateFormats: {},
      sourceArgs: { range: "date-range" },
      returnDatesAsLocalISO: true,
    });
    expect(result.range["Start Date"]).toBe("latest");
    expect(result.range["End Date"]).toBe(
      convertDatesToLocalISO(parseDate("now")),
    );
  });

  it("resolves both endpoints of a 'date-range' arg with relative values", () => {
    const result = updateObjectWithVariableInputs({
      args: { range: { "Start Date": "now-7D", "End Date": "now" } },
      variableInputs: {},
      variableInputDateFormats: {},
      sourceArgs: { range: "date-range" },
      returnDatesAsLocalISO: true,
    });
    expect(result.range).toStrictEqual({
      "Start Date": convertDatesToLocalISO(parseDate("now-7D")),
      "End Date": convertDatesToLocalISO(parseDate("now")),
    });
    expect(typeof result.range).toBe("object");
  });

  it("resolves a 'date-range' arg with mixed relative + absolute values using the arg format", () => {
    const fmt = "MM/dd/yyyy h:mm aa";
    const result = updateObjectWithVariableInputs({
      args: {
        range: { "Start Date": "now-7D", "End Date": "01/05/2024 3:00 PM" },
      },
      variableInputs: {},
      variableInputDateFormats: { range: fmt },
      sourceArgs: { range: "date-range" },
      returnDatesAsLocalISO: true,
    });
    expect(result.range).toStrictEqual({
      "Start Date": convertDatesToLocalISO(parseDate("now-7D", fmt)),
      "End Date": convertDatesToLocalISO(parseDate("01/05/2024 3:00 PM", fmt)),
    });
  });

  it("resolves a 'date-range' arg with custom endpoint key names", () => {
    const result = updateObjectWithVariableInputs({
      args: { range: { From: "now-1D", To: "now" } },
      variableInputs: {},
      variableInputDateFormats: {},
      sourceArgs: { range: "date-range" },
      returnDatesAsLocalISO: true,
    });
    expect(result.range).toStrictEqual({
      From: convertDatesToLocalISO(parseDate("now-1D")),
      To: convertDatesToLocalISO(parseDate("now")),
    });
  });

  it("resolves an absolute single date", () => {
    const fmt = "MM/dd/yyyy h:mm aa";
    const result = updateObjectWithVariableInputs({
      args: { d: "01/05/2024 3:00 PM" },
      variableInputs: {},
      variableInputDateFormats: { d: fmt },
      sourceArgs: { d: "date" },
      returnDatesAsLocalISO: true,
    });
    expect(result.d).toBe(
      convertDatesToLocalISO(parseDate("01/05/2024 3:00 PM", fmt)),
    );
  });

  it("resolves a date arg fed by a variable input holding a relative date", () => {
    // eslint-disable-next-line no-template-curly-in-string
    const result = updateObjectWithVariableInputs({
      // eslint-disable-next-line no-template-curly-in-string
      args: { d: "${StartVar}" },
      variableInputs: { StartVar: "now-1D" },
      variableInputDateFormats: {},
      sourceArgs: { d: "date" },
      returnDatesAsLocalISO: true,
    });
    expect(result.d).toBe(convertDatesToLocalISO(parseDate("now-1D")));
  });

  it("resolves only the concrete endpoint when a date-range endpoint is an unresolved variable", () => {
    const result = updateObjectWithVariableInputs({
      // eslint-disable-next-line no-template-curly-in-string
      args: { range: { "Start Date": "${StartVar}", "End Date": "now" } },
      variableInputs: {},
      variableInputDateFormats: {},
      sourceArgs: { range: "date-range" },
      returnDatesAsLocalISO: true,
    });
    // Unresolved ${StartVar} substitutes to "" (missing variable); parseDate("")
    // is null, so the empty endpoint becomes null. "End Date" resolves normally.
    expect(result.range["End Date"]).toBe(
      convertDatesToLocalISO(parseDate("now")),
    );
    expect(result.range["Start Date"]).toBeNull();
  });

  it("leaves a non-date arg with a relative-looking value untouched", () => {
    const result = updateObjectWithVariableInputs({
      args: { label: "now-1D" },
      variableInputs: {},
      variableInputDateFormats: {},
      sourceArgs: { label: "text" },
      returnDatesAsLocalISO: true,
    });
    expect(result.label).toBe("now-1D");
  });

  it("keeps relative dates symbolic when no sourceArgs are passed (snapshot comparison)", () => {
    const result = updateObjectWithVariableInputs({
      args: { d: "now-1D" },
      variableInputs: {},
      variableInputDateFormats: {},
    });
    expect(result.d).toBe("now-1D");
  });

  it("leaves non-string endpoints in a date-range arg untouched", () => {
    // Covers the `if (typeof endpointValue === "string")` guard inside
    // the date-range endpoint loop. If a host supplies a number, null,
    // or other non-string value for a range endpoint (legitimately as a
    // Date-as-number or accidentally), we skip the parseDate /
    // convertDatesToLocalISO conversion and pass the value through
    // verbatim — converting a number with the wrong format would corrupt
    // it. After the loop, the object is re-serialized so the result
    // round-trips through the JSON.parse reassembly below.
    const result = updateObjectWithVariableInputs({
      args: {
        range: {
          "Start Date": 1735689600000, // numeric epoch ms
          "End Date": "now",
        },
      },
      variableInputs: {},
      variableInputDateFormats: {},
      sourceArgs: { range: "date-range" },
      returnDatesAsLocalISO: true,
    });
    // The numeric endpoint passed through untouched.
    expect(result.range["Start Date"]).toBe(1735689600000);
    // The string endpoint was still resolved as before.
    expect(result.range["End Date"]).toBe(
      convertDatesToLocalISO(parseDate("now")),
    );
  });

  it("safely passes through a date-range arg whose value is not valid JSON", () => {
    // Covers the catch branch in the date-range resolution path
    // (`rangeObj = null` after JSON.parse throws). A date-range arg is
    // shaped as a `{Start, End}` object, but a malformed configuration
    // (or a bad host substitution) could deliver a plain string. The
    // helper must not crash — it falls through, leaves the value as-is,
    // and lets downstream code handle the type mismatch.
    const result = updateObjectWithVariableInputs({
      args: { range: "not-valid-json" },
      variableInputs: {},
      variableInputDateFormats: {},
      sourceArgs: { range: "date-range" },
      returnDatesAsLocalISO: true,
    });
    expect(result.range).toBe("not-valid-json");
  });
});

test("updateObjectWithVariableInputs preserves unresolved ${feature.<key>} tokens", () => {
  // The feature.* namespace is owned by FeatureScopedVariableInputs (the
  // popup scope). At the host pass, those tokens must be preserved rather
  // than stripped to "" — otherwise titleTemplate "River: ${feature.comid}"
  // surfaces as "River: " by the time the popup chrome reads it.
  const args = {
    // eslint-disable-next-line no-template-curly-in-string
    inline: "River: ${feature.comid}",
    // eslint-disable-next-line no-template-curly-in-string
    exact: "${feature.station_id}",
    // eslint-disable-next-line no-template-curly-in-string
    mixed: "Site ${Site Name} flow ${feature.flow}",
  };

  const result = updateObjectWithVariableInputs({
    args: JSON.parse(JSON.stringify(args)),
    variableInputs: { "Site Name": "Boulder" },
  });

  // Both branches (inline and exact-match) preserve feature.* tokens.
  expect(result.inline).toBe("River: ${feature.comid}");
  expect(result.exact).toBe("${feature.station_id}");
  // Mixed: host-resolved variable substituted, feature.* preserved.
  expect(result.mixed).toBe("Site Boulder flow ${feature.flow}");
});

test("updateObjectWithVariableInputs still resolves ${feature.<key>} when the value IS in scope", () => {
  // Inside the FeatureScopedVariableInputs scope, feature.* keys are present
  // in the merged variableInputs and should resolve normally.
  const args = {
    // eslint-disable-next-line no-template-curly-in-string
    title: "River: ${feature.comid}",
  };
  const result = updateObjectWithVariableInputs({
    args,
    variableInputs: { "feature.comid": "12345" },
  });
  expect(result.title).toBe("River: 12345");
});

test("updateObjectWithVariableInputs resolves missing ${feature.<key>} to empty inside the popup scope", () => {
  // FEATURE_SCOPE_MARKER signals that we are inside the popup scope and
  // there is no further resolution layer below — unresolved feature.*
  // tokens must fall back to "" like any other missing variable.
  const args = {
    // eslint-disable-next-line no-template-curly-in-string
    title: "River: ${feature.unknown}",
    // eslint-disable-next-line no-template-curly-in-string
    exact: "${feature.also_missing}",
  };
  const result = updateObjectWithVariableInputs({
    args,
    variableInputs: {
      __tethysdash_feature_scope__: true,
      "feature.comid": "12345",
    },
  });
  expect(result.title).toBe("River: ");
  expect(result.exact).toBe("");
});

test("getBaseMapLayer", async () => {
  const result = getBaseMapLayer(
    "https://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer",
  );

  expect(result).toStrictEqual({
    // Read by Map.js, which holds the basemap back until a raster has finished
    // deciding the view projection so its tiles are fetched once rather than
    // fetched, discarded and fetched again.
    isBaseMap: true,
    props: {
      name: "World Ocean Base",
      source: {
        props: {
          attributions:
            'Tiles © <a href="https://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer">ArcGIS</a>',
          url: "https://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
        },
        type: "Image Tile",
      },
    },
    type: "WebGLTile",
  });

  const newResult = getBaseMapLayer("some bad path");

  expect(newResult).toStrictEqual(null);
});

test("findSelectOptionByValue", async () => {
  let result;
  result = findSelectOptionByValue(
    baseMapLayers,
    "https://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Reference/MapServer",
  );
  expect(result).toStrictEqual({
    label: "World Ocean Reference",
    value:
      "https://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Reference/MapServer",
  });

  result = findSelectOptionByValue(baseMapLayers, "some bad value");
  expect(result).toStrictEqual(null);

  const options = [
    {
      label: "World Ocean Reference",
      value:
        "https://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Reference/MapServer",
    },
  ];
  result = findSelectOptionByValue(
    options,
    "https://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Reference/MapServer",
  );
  expect(result).toStrictEqual({
    label: "World Ocean Reference",
    value:
      "https://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Reference/MapServer",
  });

  result = findSelectOptionByValue(options, "some bad value");
  expect(result).toStrictEqual(null);
});

describe("downloadJSONFile", () => {
  let createObjectURLMock, revokeObjectURLMock;

  beforeEach(() => {
    // Ensure URL.createObjectURL and URL.revokeObjectURL are defined before spying
    global.URL.createObjectURL = jest.fn(() => "mock-url");
    global.URL.revokeObjectURL = jest.fn();

    createObjectURLMock = jest
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("mock-url");
    revokeObjectURLMock = jest.spyOn(URL, "revokeObjectURL");
  });

  afterEach(() => {
    createObjectURLMock.mockRestore();
    revokeObjectURLMock.mockRestore();
  });

  it("should create and click a download link with correct attributes", () => {
    document.body.innerHTML = ""; // Reset the DOM

    const appendChildSpy = jest.spyOn(document.body, "appendChild");
    const removeChildSpy = jest.spyOn(document.body, "removeChild");
    const createElementSpy = jest.spyOn(document, "createElement");

    // Create a real <a> element instead of a plain object
    const mockAnchor = document.createElement("a");
    mockAnchor.click = jest.fn(); // Mock the click method

    createElementSpy.mockReturnValue(mockAnchor);

    const data = { key: "value" };
    const filename = "test.json";

    downloadJSONFile(data, filename);

    // Validate URL.createObjectURL was called
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);

    // Validate that the mock URL was applied correctly
    expect(mockAnchor.href).toBe("http://localhost/mock-url");
    expect(mockAnchor.download).toBe(filename);
    expect(mockAnchor.click).toHaveBeenCalled();

    expect(appendChildSpy).toHaveBeenCalledWith(mockAnchor);
    expect(removeChildSpy).toHaveBeenCalledWith(mockAnchor);
    expect(revokeObjectURLMock).toHaveBeenCalledWith("mock-url");

    // Cleanup
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});

test("checkForEmptyVariableInputs", async () => {
  let argsString = JSON.stringify({ source: "some value" });
  let metadataString = JSON.stringify({});
  let variableInputValues = {};

  let emptyVariableWarnings = checkForEmptyVariableInputs({
    metadataString,
    argsString,
    variableInputValues,
  });

  expect(emptyVariableWarnings).toStrictEqual(null);

  // eslint-disable-next-line
  argsString = JSON.stringify({ source: "${variable}" });
  metadataString = JSON.stringify({});
  variableInputValues = {};
  emptyVariableWarnings = checkForEmptyVariableInputs({
    metadataString,
    argsString,
    variableInputValues,
  });

  expect(emptyVariableWarnings).toStrictEqual(["variable variable is empty"]);

  argsString = JSON.stringify({
    // eslint-disable-next-line
    source: "${variable}",
    // eslint-disable-next-line
    another_source: "${variable2}",
  });
  metadataString = JSON.stringify({
    customMessaging: { variable: "some custom variable message" },
  });
  variableInputValues = {};
  emptyVariableWarnings = checkForEmptyVariableInputs({
    metadataString,
    argsString,
    variableInputValues,
  });

  expect(emptyVariableWarnings).toStrictEqual([
    "some custom variable message",
    "variable2 variable is empty",
  ]);

  argsString = JSON.stringify({
    // eslint-disable-next-line
    source: "${variable}",
    // eslint-disable-next-line
    another_source: "${variable2}",
  });
  metadataString = JSON.stringify({
    customMessaging: { anyEmptyVariable: "general message" },
  });
  variableInputValues = {};
  emptyVariableWarnings = checkForEmptyVariableInputs({
    metadataString,
    argsString,
    variableInputValues,
  });

  expect(emptyVariableWarnings).toStrictEqual(["general message"]);

  argsString = JSON.stringify({
    // eslint-disable-next-line
    source: "${variable}",
    // eslint-disable-next-line
    another_source: "${variable2}",
  });
  metadataString = JSON.stringify({
    customMessaging: { anyEmptyVariable: "general message" },
  });
  variableInputValues = { variable: "test" };
  emptyVariableWarnings = checkForEmptyVariableInputs({
    metadataString,
    argsString,
    variableInputValues,
  });

  expect(emptyVariableWarnings).toStrictEqual(["general message"]);

  argsString = JSON.stringify({
    // eslint-disable-next-line
    source: "${variable}",
    // eslint-disable-next-line
    another_source: "${variable2}",
  });
  metadataString = JSON.stringify({
    customMessaging: { anyEmptyVariable: "general message" },
  });
  variableInputValues = { variable: "test", variable2: "test2" };
  emptyVariableWarnings = checkForEmptyVariableInputs({
    metadataString,
    argsString,
    variableInputValues,
  });

  expect(emptyVariableWarnings).toStrictEqual(null);
});

describe("checkForEmptyVariableInputs treats 0 and false as set", () => {
  // A truthiness test used to report a numeric 0 or an unchecked checkbox as
  // "empty", which made every fractional threshold unusable once parseFloat
  // started preserving them.
  // eslint-disable-next-line no-template-curly-in-string
  const argsString = JSON.stringify({ threshold: "${Threshold}" });
  const metadataString = JSON.stringify({});
  const check = (variableInputValues) =>
    checkForEmptyVariableInputs({
      metadataString,
      argsString,
      variableInputValues,
    });

  test.each([
    ["numeric zero", 0],
    ["a fraction", 0.15],
    ["boolean false", false],
    ["the string zero", "0"],
  ])("%s is not empty", (_label, value) => {
    expect(check({ Threshold: value })).toStrictEqual(null);
  });

  test.each([
    ["undefined", undefined],
    ["null", null],
    ["an empty string", ""],
  ])("%s is empty", (_label, value) => {
    expect(check({ Threshold: value })).toStrictEqual([
      "Threshold variable is empty",
    ]);
  });

  test("a missing key is still empty", () => {
    expect(check({})).toStrictEqual(["Threshold variable is empty"]);
  });
});

test("updateObjectWithVariableInputs preserves 0 and false", () => {
  // The exact-match branch used `|| ""`, so a zero threshold reached the plugin
  // as an empty string and silently fell back to the plugin's own default.
  const result = updateObjectWithVariableInputs({
    args: {
      // eslint-disable-next-line no-template-curly-in-string
      zero: "${Zero}",
      // eslint-disable-next-line no-template-curly-in-string
      fraction: "${Fraction}",
      // eslint-disable-next-line no-template-curly-in-string
      off: "${Off}",
      // eslint-disable-next-line no-template-curly-in-string
      missing: "${Missing}",
    },
    variableInputs: { Zero: 0, Fraction: 0.15, Off: false },
  });

  expect(result).toStrictEqual({
    zero: 0,
    fraction: 0.15,
    off: false,
    missing: "",
  });
});

test("checkForEmptyVariableInputs skips feature.* keys", () => {
  // feature.* keys are scoped/unbinding-by-design; they should never
  // produce a warning regardless of whether the value is set.
  // eslint-disable-next-line
  let argsString = JSON.stringify({ source: "${feature.station_id}" });
  let metadataString = JSON.stringify({});
  let variableInputValues = {};

  let emptyVariableWarnings = checkForEmptyVariableInputs({
    metadataString,
    argsString,
    variableInputValues,
  });

  expect(emptyVariableWarnings).toStrictEqual(null);

  // feature.* keys with spaces and dots in the suffix also skipped.
  // eslint-disable-next-line
  argsString = JSON.stringify({ source: "${feature.Site Name}" });
  emptyVariableWarnings = checkForEmptyVariableInputs({
    metadataString,
    argsString,
    variableInputValues,
  });
  expect(emptyVariableWarnings).toStrictEqual(null);
});

test("checkForEmptyVariableInputs warns for non-feature.* keys when feature.* is also present", () => {
  // Regression: filtering out feature.* must not suppress warnings for
  // sibling host variable keys.
  const argsString = JSON.stringify({
    // eslint-disable-next-line
    a: "${feature.station_id}",
    // eslint-disable-next-line
    b: "${some_host_var}",
  });
  const metadataString = JSON.stringify({});
  const variableInputValues = {};

  const emptyVariableWarnings = checkForEmptyVariableInputs({
    metadataString,
    argsString,
    variableInputValues,
  });

  expect(emptyVariableWarnings).toStrictEqual([
    "some_host_var variable is empty",
  ]);
});

test("checkForEmptyVariableInputs skips popupConfig subtree (popup-scoped vars do not gate host)", () => {
  // Regression: a Map layer whose popupConfig defines its own variable inputs
  // (e.g. "Start Time" supplied by a Variable Input grid item INSIDE the popup)
  // must not gate the host map render. Those names live in the popup's
  // nested FeatureScopedVariableInputs provider — not in the host context —
  // so the host must NOT warn that they're "empty" before the popup even opens.
  const argsString = JSON.stringify({
    baseMap: "https://example.com/basemap",
    layers: [
      {
        configuration: { type: "ImageLayer", props: { name: "Stations" } },
        popupConfig: {
          mode: "modal",
          titleTemplate: "Site: ${feature.station_name}",
          gridItems: [
            {
              source: "some_plot",
              args_string:
                '{"location":"${feature.cw3e_id}","start_time":"${Start Time}","end_time":"${End Time}"}',
            },
            {
              source: "Variable Input",
              args_string:
                '{"variable_name":"Start Time","initial_value":"now-48H"}',
            },
          ],
        },
      },
    ],
  });
  const metadataString = JSON.stringify({});
  const variableInputValues = {};

  const emptyVariableWarnings = checkForEmptyVariableInputs({
    metadataString,
    argsString,
    variableInputValues,
  });

  expect(emptyVariableWarnings).toStrictEqual(null);
});

test("checkForEmptyVariableInputs still warns for host-level vars when popupConfig also present", () => {
  // Positive control for the popupConfig skip: we're skipping ONLY the
  // popupConfig subtree, not silencing host-level references on the same
  // visualization. A genuinely-missing host variable referenced outside
  // popupConfig must still warn.
  const argsString = JSON.stringify({
    baseMap: "${Host Var}",
    layers: [
      {
        configuration: { type: "ImageLayer", props: { name: "Stations" } },
        popupConfig: {
          mode: "modal",
          gridItems: [
            {
              source: "some_plot",
              args_string: '{"start_time":"${Start Time}"}',
            },
          ],
        },
      },
    ],
  });
  const metadataString = JSON.stringify({});
  const variableInputValues = {};

  const emptyVariableWarnings = checkForEmptyVariableInputs({
    metadataString,
    argsString,
    variableInputValues,
  });

  expect(emptyVariableWarnings).toStrictEqual(["Host Var variable is empty"]);
});

test("checkForEmptyVariableInputs ignores variable inputs referenced only by a label template", () => {
  // Regression guard, direction 1: the empty-input check replaces the whole
  // widget with a warning panel. `hasVariableInputValue` counts "" as empty,
  // so a viewer clearing a text box referenced by a label would otherwise
  // wipe out the map. The accepted trade is that a label-only reference
  // never raises the unset-input warning.
  const argsString = JSON.stringify({
    baseMap: "https://example.com/basemap",
    layers: [
      {
        configuration: {
          type: "VectorLayer",
          props: { name: "Stations" },
          labels: {
            template: "${Station Filter} — ${feature.station}",
            anchor: "top-center",
          },
        },
      },
    ],
  });
  const metadataString = JSON.stringify({});
  const variableInputValues = { "Station Filter": "" };

  const emptyVariableWarnings = checkForEmptyVariableInputs({
    metadataString,
    argsString,
    variableInputValues,
  });

  expect(emptyVariableWarnings).toStrictEqual(null);
});

test("checkForEmptyVariableInputs still warns for an unset input referenced outside a label template", () => {
  // Regression guard, direction 2: the label skip must not silence the
  // check for the rest of the widget. Same empty input, referenced both in a
  // label and in a real arg — the real arg still warns.
  const argsString = JSON.stringify({
    baseMap: "${Station Filter}",
    layers: [
      {
        configuration: {
          type: "VectorLayer",
          props: { name: "Stations" },
          labels: { template: "${Station Filter}" },
        },
      },
    ],
  });
  const metadataString = JSON.stringify({});
  const variableInputValues = { "Station Filter": "" };

  const emptyVariableWarnings = checkForEmptyVariableInputs({
    metadataString,
    argsString,
    variableInputValues,
  });

  expect(emptyVariableWarnings).toStrictEqual([
    "Station Filter variable is empty",
  ]);
});

test("checkForEmptyVariableInputs warns for an unset input under a non-map `labels` key", () => {
  // The exemption is scoped to a map layer's `configuration.labels`. `labels`
  // is an ordinary word other visualizations use, so a plugin argument that
  // merely shares the name is ordinary args: clearing an input it references
  // must still raise the warning rather than be swallowed.
  const argsString = JSON.stringify({
    chart_title: "Timeseries",
    subplot_toggle: { labels: { 1: "${Station Filter}" } },
  });
  const metadataString = JSON.stringify({});
  const variableInputValues = { "Station Filter": "" };

  const emptyVariableWarnings = checkForEmptyVariableInputs({
    metadataString,
    argsString,
    variableInputValues,
  });

  expect(emptyVariableWarnings).toStrictEqual([
    "Station Filter variable is empty",
  ]);
});

test("updateObjectWithVariableInputs still substitutes inside a label template", () => {
  // Substitution consults no skip set, so exempting a layer's labels from the
  // scanners must not stop a label picking up variable input changes.
  const args = {
    baseMap: "https://example.com/basemap",
    layers: [
      {
        configuration: {
          type: "VectorLayer",
          props: { name: "Stations" },
          labels: {
            template: "${Station Filter} — ${feature.station}",
            anchor: "top-center",
          },
        },
      },
    ],
  };

  const result = updateObjectWithVariableInputs({
    args,
    variableInputs: { "Station Filter": "Snow" },
    variableInputDateFormats: {},
  });

  // The variable input resolves; the per-feature token is preserved for the
  // style function to resolve at draw time.
  expect(result.layers[0].configuration.labels.template).toBe(
    "Snow — ${feature.station}",
  );

  // And a later change to the same input flows through.
  const updated = updateObjectWithVariableInputs({
    args,
    variableInputs: { "Station Filter": "Rain" },
    variableInputDateFormats: {},
  });
  expect(updated.layers[0].configuration.labels.template).toBe(
    "Rain — ${feature.station}",
  );
});

test("getVisualization Custom Image with slider metadata returns imageSequence", async () => {
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();

  await getVisualization({
    setVizType: mockSetVizType,
    setVizData: mockSetVizData,
    sourceType: "image",
    itemData: {
      source: "Custom Image",
      args: { image_source: "https://example.com/frame2.gif" },
    },
    metadataString: JSON.stringify({ refreshRate: 0 }),
    argsString: JSON.stringify({
      // eslint-disable-next-line
      image_source: "https://example.com/${Slider}.gif",
    }),
    variableInputValues: { Slider: "frame2" },
    variableInputSliderMeta: {
      Slider: { values: ["frame1", "frame2", "frame3"] },
    },
  });

  expect(mockSetVizType).toHaveBeenCalledWith("imageSequence");
  expect(mockSetVizData).toHaveBeenCalledWith({
    urls: [
      "https://example.com/frame1.gif",
      "https://example.com/frame2.gif",
      "https://example.com/frame3.gif",
    ],
    activeUrl: "https://example.com/frame2.gif",
    alt: "custom_image",
    imageError: undefined,
  });
});

test("getVisualization Custom Image with slider metadata and custom error message", async () => {
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();

  await getVisualization({
    setVizType: mockSetVizType,
    setVizData: mockSetVizData,
    sourceType: "image",
    itemData: {
      source: "Custom Image",
      args: { image_source: "https://example.com/frame1.gif" },
    },
    metadataString: JSON.stringify({
      refreshRate: 0,
      customMessaging: { error: "Image not available" },
    }),
    argsString: JSON.stringify({
      // eslint-disable-next-line
      image_source: "https://example.com/${Slider}.gif",
    }),
    variableInputValues: { Slider: "frame1" },
    variableInputSliderMeta: {
      Slider: { values: ["frame1", "frame2"] },
    },
  });

  expect(mockSetVizType).toHaveBeenCalledWith("imageSequence");
  expect(mockSetVizData).toHaveBeenCalledWith(
    expect.objectContaining({
      imageError: "Image not available",
    }),
  );
});

test("getVisualization Custom Image without slider metadata falls back to image", async () => {
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();

  await getVisualization({
    setVizType: mockSetVizType,
    setVizData: mockSetVizData,
    sourceType: "image",
    itemData: {
      source: "Custom Image",
      args: { image_source: "https://example.com/frame1.gif" },
    },
    metadataString: JSON.stringify({ refreshRate: 0 }),
    argsString: JSON.stringify({
      // eslint-disable-next-line
      image_source: "https://example.com/${Dropdown}.gif",
    }),
    variableInputValues: { Dropdown: "frame1" },
    // Dropdown has no slider metadata — should fall through to regular image
    variableInputSliderMeta: {},
  });

  expect(mockSetVizType).toHaveBeenCalledWith("image");
  expect(mockSetVizData).toHaveBeenCalledWith({
    source: "https://example.com/frame1.gif",
    alt: "custom_image",
    imageError: undefined,
  });
});

test("getVisualization Custom Image without image_source in argsString falls back to image", async () => {
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();

  await getVisualization({
    setVizType: mockSetVizType,
    setVizData: mockSetVizData,
    sourceType: "image",
    itemData: {
      source: "Custom Image",
      args: { image_source: "https://example.com/static.gif" },
    },
    metadataString: JSON.stringify({ refreshRate: 0 }),
    // argsString has no image_source key → originalArgs.image_source is undefined → falls back to ""
    argsString: JSON.stringify({}),
    variableInputValues: {},
    variableInputSliderMeta: {
      Slider: { values: ["a", "b"] },
    },
  });

  // No ${} in empty template → depVars is empty → no sliderVar → falls through to image
  expect(mockSetVizType).toHaveBeenCalledWith("image");
  expect(mockSetVizData).toHaveBeenCalledWith({
    source: "https://example.com/static.gif",
    alt: "custom_image",
    imageError: undefined,
  });
});

test("getVisualization Custom Image with empty slider values falls back to image", async () => {
  const mockSetVizType = jest.fn();
  const mockSetVizData = jest.fn();

  await getVisualization({
    setVizType: mockSetVizType,
    setVizData: mockSetVizData,
    sourceType: "image",
    itemData: {
      source: "Custom Image",
      args: { image_source: "https://example.com/current.gif" },
    },
    metadataString: JSON.stringify({ refreshRate: 0 }),
    argsString: JSON.stringify({
      // eslint-disable-next-line
      image_source: "https://example.com/${Slider}.gif",
    }),
    variableInputValues: { Slider: "current" },
    // Slider metadata exists but values array is empty
    variableInputSliderMeta: {
      Slider: { values: [] },
    },
  });

  expect(mockSetVizType).toHaveBeenCalledWith("image");
  expect(mockSetVizData).toHaveBeenCalledWith({
    source: "https://example.com/current.gif",
    alt: "custom_image",
    imageError: undefined,
  });
});

describe("findUnresolvedFeatureTokens", () => {
  test("returns empty array for non-string/non-object inputs", () => {
    expect(findUnresolvedFeatureTokens(undefined)).toEqual([]);
    expect(findUnresolvedFeatureTokens(null)).toEqual([]);
    expect(findUnresolvedFeatureTokens(42)).toEqual([]);
    expect(findUnresolvedFeatureTokens(true)).toEqual([]);
  });

  test("returns empty array when no feature.* tokens are present", () => {
    expect(findUnresolvedFeatureTokens("plain text")).toEqual([]);
    expect(findUnresolvedFeatureTokens({ x: "no tokens here" })).toEqual([]);
    expect(findUnresolvedFeatureTokens({ x: "${other.var}" })).toEqual([]);
  });

  test("finds feature.* tokens in a top-level string", () => {
    expect(findUnresolvedFeatureTokens("River: ${feature.comid}")).toEqual([
      "feature.comid",
    ]);
  });

  test("finds tokens nested inside an object", () => {
    expect(
      findUnresolvedFeatureTokens({
        river_id: "${feature.comid}",
        title: "Site ${feature.station_name}",
      }),
    ).toEqual(["feature.comid", "feature.station_name"]);
  });

  test("finds tokens nested inside an array", () => {
    expect(
      findUnresolvedFeatureTokens(["${feature.a}", { b: "${feature.b}" }]),
    ).toEqual(["feature.a", "feature.b"]);
  });

  test("deduplicates repeated tokens", () => {
    expect(
      findUnresolvedFeatureTokens({
        a: "${feature.x}",
        b: "${feature.x}/${feature.x}",
      }),
    ).toEqual(["feature.x"]);
  });

  test("supports keys with dots, spaces, and parens", () => {
    expect(
      findUnresolvedFeatureTokens("${feature.Mean Flow (m³/sec)}"),
    ).toEqual(["feature.Mean Flow (m³/sec)"]);
  });

  test("does NOT match non-feature ${...} tokens", () => {
    expect(findUnresolvedFeatureTokens("${other}")).toEqual([]);
    expect(
      findUnresolvedFeatureTokens({ a: "${plain}", b: "${feature.kept}" }),
    ).toEqual(["feature.kept"]);
  });

  test("safe to call repeatedly without leaking regex state", () => {
    // Defends against the global-regex `lastIndex` pitfall — if the helper
    // accidentally shared state across calls, the second call could miss
    // tokens depending on where the previous call left lastIndex.
    expect(findUnresolvedFeatureTokens("${feature.a}")).toEqual(["feature.a"]);
    expect(findUnresolvedFeatureTokens("${feature.b}")).toEqual(["feature.b"]);
    expect(findUnresolvedFeatureTokens("${feature.c}")).toEqual(["feature.c"]);
  });

  test("skips subtrees under `popupConfig` (deferred to the popup scope)", () => {
    // Map widget's args carry per-layer popupConfig. Those tokens belong
    // to the popup's own scope and must NOT gate the parent Map.
    const mapArgs = {
      // Map's own args have no feature.* tokens.
      baseMap: "https://example.com/basemap",
      layers: [
        {
          configuration: { type: "ImageLayer", props: { name: "Stations" } },
          popupConfig: {
            titleTemplate: "Site: ${feature.station_name}",
            gridItems: [
              {
                source: "geoglows_forecast_plot",
                args_string: '{"river_id":"${feature.comid}"}',
              },
            ],
          },
        },
      ],
    };
    expect(findUnresolvedFeatureTokens(mapArgs)).toEqual([]);
  });

  test("still finds tokens at non-skip keys when popupConfig is also present", () => {
    // If a parent-widget arg legitimately references feature.* (which is
    // the gate's whole point), the skip on popupConfig must NOT mask it.
    const args = {
      river_id: "${feature.comid}",
      popupConfig: {
        titleTemplate: "${feature.also_skipped}",
      },
    };
    expect(findUnresolvedFeatureTokens(args)).toEqual(["feature.comid"]);
  });

  test("skips a map layer's `labels` (resolved per feature at draw time)", () => {
    // A map layer's label template resolves inside the OpenLayers style
    // function, one feature at a time. If the gate saw it, every labeled
    // layer would flip the Map widget to `featurePending` and blank it.
    // Written at the path the layer editor saves it to: beside
    // `configuration.style`, under the map's `layers`.
    const mapArgs = {
      baseMap: "https://example.com/basemap",
      layers: [
        {
          configuration: {
            type: "VectorLayer",
            props: { name: "Stations" },
            labels: {
              template: "${feature.station} (${feature.elevation})",
              anchor: "top-center",
            },
          },
        },
      ],
    };
    expect(findUnresolvedFeatureTokens(mapArgs)).toEqual([]);
  });

  test("does NOT skip a `labels` under `layers` whose parent is not `configuration`", () => {
    // The scope pins the whole path, not just the `layers` ancestor: a key
    // named `labels` sitting anywhere else inside a map's layers is ordinary
    // args and must still gate the fetch.
    const mapArgs = {
      baseMap: "https://example.com/basemap",
      layers: [
        {
          configuration: {
            type: "VectorLayer",
            props: { name: "Stations", labels: "${feature.station}" },
          },
        },
      ],
    };
    expect(findUnresolvedFeatureTokens(mapArgs)).toEqual(["feature.station"]);
  });

  test("does NOT skip a `labels` outside a map's layers", () => {
    // The exemption means "a map layer's label configuration". `labels` is a
    // far more ordinary word than the other skip keys, and other
    // visualizations really do use it, so args that merely carry a key of the
    // same name must still gate on a real unresolved feature reference --
    // otherwise the token would reach the plugin as a literal.
    expect(
      findUnresolvedFeatureTokens({
        chart_title: "Timeseries",
        subplot_toggle: { labels: { 1: "${feature.station}" } },
      }),
    ).toEqual(["feature.station"]);
    // Even the exact parent key, with no `layers` ancestor above it.
    expect(
      findUnresolvedFeatureTokens({
        configuration: { labels: { template: "${feature.station}" } },
      }),
    ).toEqual(["feature.station"]);
  });

  test("still reports feature tokens outside both a layer's labels and popupConfig", () => {
    // Both directions of the guard on one object: the two exempt subtrees
    // stay exempt, and a sibling reference still gates the fetch.
    const mapArgs = {
      river_id: "${feature.comid}",
      layers: [
        {
          configuration: { labels: { template: "${feature.label_only}" } },
          popupConfig: { titleTemplate: "${feature.popup_only}" },
        },
      ],
    };
    expect(findUnresolvedFeatureTokens(mapArgs)).toEqual(["feature.comid"]);
  });
});

describe("findUnresolvedVariableInputTokens", () => {
  test("returns empty array for non-string/non-object inputs", () => {
    expect(findUnresolvedVariableInputTokens(undefined)).toEqual([]);
    expect(findUnresolvedVariableInputTokens(null)).toEqual([]);
    expect(findUnresolvedVariableInputTokens(42)).toEqual([]);
    expect(findUnresolvedVariableInputTokens(true)).toEqual([]);
  });

  test("returns empty array when no ${...} tokens are present", () => {
    expect(findUnresolvedVariableInputTokens("plain text")).toEqual([]);
    expect(findUnresolvedVariableInputTokens({ x: "no tokens here" })).toEqual(
      [],
    );
  });

  test("finds bare-name tokens in a top-level string", () => {
    expect(findUnresolvedVariableInputTokens("Hello ${Name}")).toEqual([
      "Name",
    ]);
  });

  test("finds feature.* tokens just like any other token", () => {
    // findUnresolvedVariableInputTokens is the superset walker — it captures
    // every ${...} reference, feature-scoped or not. Filtering happens at
    // the call site (checkForEmptyVariableInputs filters out feature.*).
    expect(findUnresolvedVariableInputTokens("${feature.comid}")).toEqual([
      "feature.comid",
    ]);
  });

  test("finds tokens nested inside an object", () => {
    expect(
      findUnresolvedVariableInputTokens({
        a: "${Foo}",
        b: "Bar = ${Bar}",
      }),
    ).toEqual(["Foo", "Bar"]);
  });

  test("finds tokens nested inside an array", () => {
    expect(findUnresolvedVariableInputTokens(["${A}", { b: "${B}" }])).toEqual([
      "A",
      "B",
    ]);
  });

  test("deduplicates repeated tokens", () => {
    expect(
      findUnresolvedVariableInputTokens({
        a: "${X}",
        b: "${X}/${X}",
      }),
    ).toEqual(["X"]);
  });

  test("supports variable names with spaces", () => {
    expect(findUnresolvedVariableInputTokens("${Start Time}")).toEqual([
      "Start Time",
    ]);
  });

  test("skips subtrees under `popupConfig` (deferred to the popup scope)", () => {
    // The core bug: popup-internal variable inputs (Start Time, End Time)
    // declared inside the popup must NOT surface at the host level.
    const mapArgs = {
      baseMap: "https://example.com/basemap",
      layers: [
        {
          configuration: { type: "ImageLayer", props: { name: "Stations" } },
          popupConfig: {
            mode: "modal",
            titleTemplate: "Site: ${feature.station_name}",
            gridItems: [
              {
                source: "some_plot",
                args_string:
                  '{"start_time":"${Start Time}","end_time":"${End Time}"}',
              },
            ],
          },
        },
      ],
    };
    expect(findUnresolvedVariableInputTokens(mapArgs)).toEqual([]);
  });

  test("still finds host-level tokens when popupConfig is also present", () => {
    // Skip applies ONLY to popupConfig — sibling host-level references
    // must still surface so the host gate can warn appropriately.
    const args = {
      baseMap: "${Host Base}",
      layers: [
        {
          popupConfig: {
            gridItems: [{ args_string: '{"start_time":"${Popup Var}"}' }],
          },
        },
      ],
    };
    expect(findUnresolvedVariableInputTokens(args)).toEqual(["Host Base"]);
  });

  test("skips a map layer's `labels` but still reports siblings", () => {
    // Same skip set as the feature scanner, so a variable input referenced
    // only by a label stays invisible to the empty-input check while a
    // sibling reference on the same widget still surfaces.
    const mapArgs = {
      baseMap: "${Host Base}",
      layers: [
        {
          configuration: {
            props: { name: "Stations" },
            labels: {
              template: "${Station Filter}: ${feature.station}",
            },
          },
        },
      ],
    };
    expect(findUnresolvedVariableInputTokens(mapArgs)).toEqual(["Host Base"]);
  });

  test("does NOT skip a `labels` under `layers` whose parent is not `configuration`", () => {
    // Same scoping check as the feature scanner: the skip keys are shared, so
    // the full path has to match for both.
    const mapArgs = {
      baseMap: "${Host Base}",
      layers: [
        {
          configuration: {
            props: { name: "Stations", labels: "${Station Filter}" },
          },
        },
      ],
    };
    expect(findUnresolvedVariableInputTokens(mapArgs)).toEqual([
      "Host Base",
      "Station Filter",
    ]);
  });

  test("does NOT skip a `labels` outside a map's layers", () => {
    // A variable input's `metadata.labels` is walked normally, so an unset
    // input referenced under it still surfaces to checkForEmptyVariableInputs
    // instead of being silently swallowed.
    expect(
      findUnresolvedVariableInputTokens({
        chart_title: "Timeseries",
        metadata: { labels: { 1: "${Some Input}" } },
      }),
    ).toEqual(["Some Input"]);
    // Even the exact parent key, with no `layers` ancestor above it.
    expect(
      findUnresolvedVariableInputTokens({
        configuration: { labels: { template: "${Some Input}" } },
      }),
    ).toEqual(["Some Input"]);
  });

  test("safe to call repeatedly without leaking regex state", () => {
    // Defends against the global-regex `lastIndex` pitfall shared with
    // findUnresolvedFeatureTokens.
    expect(findUnresolvedVariableInputTokens("${A}")).toEqual(["A"]);
    expect(findUnresolvedVariableInputTokens("${B}")).toEqual(["B"]);
    expect(findUnresolvedVariableInputTokens("${C}")).toEqual(["C"]);
  });
});

describe("toNumberOrEmpty", () => {
  it("parses a numeric value", () => {
    expect(toNumberOrEmpty("12.5")).toBe(12.5);
    expect(toNumberOrEmpty(0)).toBe(0);
  });

  it("gives back an empty string for anything unparseable", () => {
    // Empty rather than NaN: the value goes straight into a controlled input,
    // and NaN there renders as the literal text "NaN".
    expect(toNumberOrEmpty("abc")).toBe("");
    expect(toNumberOrEmpty("")).toBe("");
    expect(toNumberOrEmpty(undefined)).toBe("");
  });
});

describe("variable input publishing helpers", () => {
  it("normalizes initial values the way VariableInput publishes them", () => {
    expect(
      normalizeVariableInputValue({
        variable_options_source: "number",
        initial_value: "0.3",
      }),
    ).toBe(0.3);
    expect(
      normalizeVariableInputValue({
        variable_options_source: "checkbox",
        initial_value: null,
      }),
    ).toBe(false);
    expect(
      normalizeVariableInputValue({
        variable_options_source: "text",
        initial_value: null,
      }),
    ).toBeNull();
  });

  it("publishes nothing for an empty value but publishes 0 and false", () => {
    expect(getPublishedVariableInputValues("A", "")).toBeNull();
    expect(getPublishedVariableInputValues("A", null)).toBeNull();
    expect(getPublishedVariableInputValues("A", undefined)).toBeNull();
    expect(getPublishedVariableInputValues("A", 0)).toEqual({ A: 0 });
    expect(getPublishedVariableInputValues("A", false)).toEqual({ A: false });
  });

  it("spreads an object value's keys alongside the variable", () => {
    const range = { "Start Date": "a", "End Date": "b" };
    expect(getPublishedVariableInputValues("Range", range)).toEqual({
      Range: range,
      "Start Date": "a",
      "End Date": "b",
    });
  });

  it("finds the date format a variable input registers", () => {
    expect(
      getVariableInputDateFormat({
        variable_options_source: "date-range",
        metadata: { format: "MM/dd/yyyy" },
      }),
    ).toBe("MM/dd/yyyy");
    expect(
      getVariableInputDateFormat({
        variable_options_source: "slider",
        metadata: { dataType: "Date", outputFormat: "yyyy" },
      }),
    ).toBe("yyyy");
    expect(
      getVariableInputDateFormat({
        variable_options_source: "slider",
        metadata: { dataType: "Number" },
      }),
    ).toBeNull();
    expect(
      getVariableInputDateFormat({ variable_options_source: ["a"] }),
    ).toBeNull();
  });
});

describe("preloaded visualization cache", () => {
  afterEach(() => {
    clearPreloadedVisualizations();
    jest.restoreAllMocks();
  });

  it("keys a request by what it is built from, regardless of key order", () => {
    expect(
      buildPreloadedVisualizationKey({ source: "s", args: { a: 1, b: 2 } }),
    ).toBe(
      buildPreloadedVisualizationKey({ source: "s", args: { b: 2, a: 1 } }),
    );
    expect(
      buildPreloadedVisualizationKey({ source: "s", args: { a: 1 } }),
    ).not.toBe(buildPreloadedVisualizationKey({ source: "s", args: { a: 2 } }));
    // Only the referenced variables' values count.
    const key = (variableInputValues) =>
      buildPreloadedVisualizationKey({
        source: "s",
        args: { a: "${X}" },
        variableInputValues,
        tokens: ["X"],
      });
    expect(key({ X: 1, Y: 1 })).toBe(key({ X: 1, Y: 2 }));
    expect(key({ X: 1 })).not.toBe(key({ X: 2 }));
  });

  it("keys an array arg by its order, and descends into it", () => {
    // An args value is often a list -- a multi-select's selection, a bbox --
    // and order is meaningful in both. Serializing one as a plain object would
    // key [1, 2] and [2, 1] alike and hand the tile the wrong response.
    const key = (args) => buildPreloadedVisualizationKey({ source: "s", args });
    expect(key({ a: [1, 2] })).toBe(key({ a: [1, 2] }));
    expect(key({ a: [1, 2] })).not.toBe(key({ a: [2, 1] }));
    expect(key({ a: [1, 2] })).not.toBe(key({ a: [1, 2, 3] }));
    // Key order is normalized at every depth, inside a list as well as outside.
    expect(key({ a: [{ x: 1, y: 2 }] })).toBe(key({ a: [{ y: 2, x: 1 }] }));
    expect(key({ a: [{ x: 1 }] })).not.toBe(key({ a: [{ x: 2 }] }));
  });

  it("keys the values JSON cannot carry without collapsing them", () => {
    // JSON.stringify returns undefined rather than a string for these, so the
    // fallback is what keeps them from reading as the same key.
    const key = (args) => buildPreloadedVisualizationKey({ source: "s", args });
    expect(key({ a: undefined })).toBe(key({ a: null }));
    expect(key({ a: 1 })).not.toBe(key({ a: null }));
  });

  it("keys a request with no source or args without collapsing them", () => {
    // Neither is guaranteed: a key is built from whatever the grid item has,
    // and JSON.stringify gives nothing back for undefined, which would make
    // every such key identical.
    const bare = buildPreloadedVisualizationKey({});
    expect(bare).toBe(
      buildPreloadedVisualizationKey({ source: null, args: null }),
    );
    expect(bare).not.toBe(buildPreloadedVisualizationKey({ source: "s" }));
    expect(bare).not.toBe(buildPreloadedVisualizationKey({ args: {} }));
  });

  it("caches nothing for a grid item with no request id", () => {
    // A popup-nested item, or one not yet saved, has no uuid to key on. There
    // is nothing to hand back to later, so the preload simply does not cache
    // it -- rather than storing every such item under one shared key.
    expect(() =>
      setPreloadedVisualization(undefined, "key", Promise.resolve({})),
    ).not.toThrow();
    expect(takePreloadedVisualization(undefined, "key")).toBe(undefined);
    expect(takePreloadedVisualization(null, "key")).toBe(undefined);
  });

  it("keys an unset variable the same as one explicitly null", () => {
    // A referenced variable with no value yet is part of the key, as null, so
    // the request built before it was set does not match the one built after.
    const key = (variableInputValues) =>
      buildPreloadedVisualizationKey({
        source: "s",
        args: { a: "${X}" },
        variableInputValues,
        tokens: ["X"],
      });
    expect(key({})).toBe(key({ X: null }));
    expect(key(undefined)).toBe(key({ X: null }));
    // Explicitly null, which skips the default parameter: the variable inputs
    // context holds null until its provider mounts, and a key built then has
    // to match one built from an empty map rather than throwing.
    expect(key(null)).toBe(key({ X: null }));
    expect(key({})).not.toBe(key({ X: "set" }));
  });

  it("keys a referenced variable's date format as well as its value", () => {
    // The format decides what a date value resolves to, so two requests with
    // the same value and different formats are different requests.
    const key = (variableInputDateFormats) =>
      buildPreloadedVisualizationKey({
        source: "s",
        args: { a: "${When}" },
        variableInputValues: { When: "now-1D" },
        variableInputDateFormats,
        tokens: ["When"],
      });
    expect(key({ When: "YYYY-MM-DD" })).not.toBe(key({ When: "YYYY" }));
    expect(key({ When: "YYYY-MM-DD" })).not.toBe(key({}));
    expect(key({})).toBe(key(undefined));
    expect(key({})).toBe(key(null));
  });

  it("hands an entry out once, and only for the key it was built from", async () => {
    const response = { success: true };
    setPreloadedVisualization("uuid", "key", Promise.resolve(response));
    expect(takePreloadedVisualization("uuid", "other")).toBe(undefined);
    // A miss discards the entry: it was for a configuration now gone.
    expect(takePreloadedVisualization("uuid", "key")).toBe(undefined);

    setPreloadedVisualization("uuid", "key", Promise.resolve(response));
    await Promise.resolve();
    const entry = takePreloadedVisualization("uuid", "key");
    expect(entry.settled).toBe(true);
    await expect(entry.promise).resolves.toBe(response);
    expect(takePreloadedVisualization("uuid", "key")).toBe(undefined);
  });

  const preloadedResponse = {
    success: true,
    viz_type: "variable_input",
    data: {
      variable_name: "Station",
      initial_value: "ABC",
      variable_options_source: "text",
    },
  };

  const runGetVisualization = (overrides = {}) => {
    const setVizType = jest.fn();
    const setVizData = jest.fn();
    return getVisualization({
      setVizType,
      setVizData,
      sourceType: "variable_input",
      sourceArgs: { region: "text" },
      itemData: { source: "station_picker", args: {}, requestId: "uuid-1" },
      argsString: JSON.stringify({ region: "west" }),
      metadataString: "{}",
      variableInputValues: {},
      dashboardView: true,
      ...overrides,
    }).then(() => ({ setVizType, setVizData }));
  };

  const preload = (
    promise = Promise.resolve(preloadedResponse),
    args = { region: "west" },
    variableInputValues = {},
  ) =>
    setPreloadedVisualization(
      "uuid-1",
      buildPreloadedRequestKey({
        source: "station_picker",
        args,
        variableInputValues,
      }),
      promise,
    );

  it("serves a preloaded response to the tile once, then fetches", async () => {
    const spy = jest
      .spyOn(appAPI, "getVisualizationData")
      .mockResolvedValue(preloadedResponse);
    preload();
    await Promise.resolve();

    const first = await runGetVisualization();
    expect(spy).not.toHaveBeenCalled();
    // No loader flash for a response that is already here.
    expect(first.setVizType.mock.calls.map((call) => call[0])).toEqual([
      "variableInput",
    ]);
    expect(first.setVizData).toHaveBeenCalledWith(
      expect.objectContaining({
        variable_name: "Station",
        initial_value: "ABC",
      }),
    );

    await runGetVisualization();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("awaits a preload still in flight, showing the loader meanwhile", async () => {
    const spy = jest.spyOn(appAPI, "getVisualizationData");
    let resolvePreload;
    preload(
      new Promise((resolve) => {
        resolvePreload = resolve;
      }),
    );

    const tile = runGetVisualization({ vizLoadingIcon: true });
    await Promise.resolve();
    resolvePreload(preloadedResponse);
    const { setVizType } = await tile;

    expect(spy).not.toHaveBeenCalled();
    expect(setVizType.mock.calls.map((call) => call[0])).toEqual([
      "loader",
      "variableInput",
    ]);
  });

  it("matches across date math resolved at different times", async () => {
    jest.useFakeTimers({ now: new Date("2026-01-01T00:00:00Z") });
    try {
      const spy = jest.spyOn(appAPI, "getVisualizationData");
      const args = { region: "now-1D" };
      preload(Promise.resolve(preloadedResponse), args);
      jest.setSystemTime(new Date("2026-01-01T00:00:07Z"));

      await runGetVisualization({
        argsString: JSON.stringify(args),
        sourceArgs: { region: "date" },
      });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("is not consumed outside the dashboard view", async () => {
    const spy = jest
      .spyOn(appAPI, "getVisualizationData")
      .mockResolvedValue(preloadedResponse);
    preload();

    await runGetVisualization({ dashboardView: false });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(
      takePreloadedVisualization(
        "uuid-1",
        buildPreloadedRequestKey({
          source: "station_picker",
          args: { region: "west" },
        }),
      ),
    ).toBeDefined();
  });

  it("is bypassed, and discarded, on a refresh", async () => {
    const spy = jest
      .spyOn(appAPI, "getVisualizationData")
      .mockResolvedValue(preloadedResponse);
    preload();

    await runGetVisualization({ refresh: true });
    expect(spy).toHaveBeenCalledTimes(1);
    await runGetVisualization();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("misses when the args differ from the preloaded ones", async () => {
    const spy = jest
      .spyOn(appAPI, "getVisualizationData")
      .mockResolvedValue(preloadedResponse);
    preload();

    await runGetVisualization({
      argsString: JSON.stringify({ region: "east" }),
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("misses when a referenced variable's value differs", async () => {
    const spy = jest
      .spyOn(appAPI, "getVisualizationData")
      .mockResolvedValue(preloadedResponse);
    preload(
      Promise.resolve(preloadedResponse),
      { region: "${Region}" },
      {
        Region: "west",
      },
    );

    await runGetVisualization({
      argsString: JSON.stringify({ region: "${Region}" }),
      variableInputValues: { Region: "east" },
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].args).toEqual({ region: "east" });
  });
});
