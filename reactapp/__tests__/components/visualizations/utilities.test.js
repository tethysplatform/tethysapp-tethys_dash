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
} from "components/visualizations/utilities";
import { server } from "__tests__/utilities/server";
import { rest } from "msw";
import { format } from "date-fns";
import { convertDatesToLocalISO, parseDate } from "components/inputs/dateUtils";

jest.mock("components/visualizations/Map", () => {
  const MockMapVisualization = () => <div>Map Mock</div>;
  MockMapVisualization.displayName = "MapVisualization"; // Set the display name to resolve the linting warning
  return MockMapVisualization;
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
  });
});

test("getVisualization plotly passes through subplot toggle opt-in keys", async () => {
  // Regression: the plotly branch must forward plugin-returned top-level
  // `toggle_subplots`/`subplot_toggle` keys, not strip them to data/layout/config.
  const plotData = {
    data: [],
    layout: {},
    toggle_subplots: true,
    subplot_toggle: { reflow: "vertical" },
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

  test("safe to call repeatedly without leaking regex state", () => {
    // Defends against the global-regex `lastIndex` pitfall shared with
    // findUnresolvedFeatureTokens.
    expect(findUnresolvedVariableInputTokens("${A}")).toEqual(["A"]);
    expect(findUnresolvedVariableInputTokens("${B}")).toEqual(["B"]);
    expect(findUnresolvedVariableInputTokens("${C}")).toEqual(["C"]);
  });
});
