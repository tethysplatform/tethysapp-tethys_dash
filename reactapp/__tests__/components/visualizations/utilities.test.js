import {
  getVisualization,
  getGridItem,
  updateObjectWithVariableInputs,
  getBaseMapLayer,
  findSelectOptionByValue,
  baseMapLayers,
  downloadJSONFile,
  checkForEmptyVariableInputs,
} from "components/visualizations/utilities";
import { server } from "__tests__/utilities/server";
import { rest } from "msw";
import { format } from "date-fns";

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
    // eslint-disable-next-line
    argsString: JSON.stringify({
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
    // eslint-disable-next-line
    argsString: JSON.stringify({
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
    // eslint-disable-next-line
    argsString: JSON.stringify({
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
    // eslint-disable-next-line
    argsString: JSON.stringify({
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
