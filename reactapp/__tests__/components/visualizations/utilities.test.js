import { render, screen } from "@testing-library/react";
import {
  setVisualization,
  getGridItem,
  updateGridItemArgsWithVariableInputs,
  getBaseMapLayer,
  findSelectOptionByValue,
  baseMapLayers,
  downloadJSONFile,
} from "components/visualizations/utilities";
import appAPI from "services/api/app";

jest.mock("components/visualizations/Map", () => {
  const MockMapVisualization = () => <div>Map Mock</div>;
  MockMapVisualization.displayName = "MapVisualization"; // Set the display name to resolve the linting warning
  return MockMapVisualization;
});

jest.mock("components/visualizations/ModuleLoader", () => {
  const MockModuleLoader = () => <div>ModuleLoader Mock</div>;
  MockModuleLoader.displayName = "ModuleLoader"; // Set the display name to resolve the linting warning
  return MockModuleLoader;
});

test("setVisualization bad response", async () => {
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: false,
    });
  };

  const setViz = jest.fn();
  const visualizationRef = jest.fn();
  await setVisualization({
    setViz,
    itemData: {},
    visualizationRef,
    metadataString: "{}",
    argsString: "{}",
    variableInputValues: [],
  });

  // eslint-disable-next-line
  expect(setViz.mock.calls[0][0].props.children.props["data-testid"]).toBe(
    "Loading..."
  );

  // Render the element passed to setViz to check the text content
  render(setViz.mock.calls[1][0]);

  // Check if the rendered content contains the error message
  expect(
    await screen.findByText("Failed to retrieve data")
  ).toBeInTheDocument();
});

test("setVisualization bad response with custom messaging", async () => {
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: false,
    });
  };

  const setViz = jest.fn();
  const visualizationRef = jest.fn();
  await setVisualization({
    setViz,
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

  // eslint-disable-next-line
  expect(setViz.mock.calls[0][0].props.children.props["data-testid"]).toBe(
    "Loading..."
  );

  // Render the element passed to setViz to check the text content
  render(setViz.mock.calls[1][0]);

  // Check if the rendered content contains the error message
  expect(await screen.findByText("custom error message")).toBeInTheDocument();
});

test("setVisualization bad type", async () => {
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: true,
      viz_type: "some random type",
    });
  };

  const setViz = jest.fn();
  const visualizationRef = jest.fn();
  await setVisualization({
    setViz,
    itemData: {},
    visualizationRef,
    metadataString: "{}",
    argsString: "{}",
    variableInputValues: [],
  });

  // eslint-disable-next-line
  expect(setViz.mock.calls[0][0].props.children.props["data-testid"]).toBe(
    "Loading..."
  );

  // Render the element passed to setViz to check the text content
  render(setViz.mock.calls[1][0]);

  // Check if the rendered content contains the error message
  expect(
    await screen.findByText(
      "some random type visualizations still need to be configured"
    )
  ).toBeInTheDocument();
});

test("setVisualization plotly", async () => {
  const plotData = { data: {}, layout: {} };
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: true,
      viz_type: "plotly",
      data: plotData,
    });
  };

  const setViz = jest.fn();
  const visualizationRef = { current: null };
  await setVisualization({
    setViz,
    itemData: {},
    visualizationRef,
    metadataString: "{}",
    argsString: "{}",
    variableInputValues: [],
  });

  // eslint-disable-next-line
  expect(setViz.mock.calls[0][0].props.children.props["data-testid"]).toBe(
    "Loading..."
  );

  expect(setViz.mock.calls[1][0].type.type.name).toBe("BasePlot");
  expect(setViz.mock.calls[1][0].props).toStrictEqual({
    plotData: {
      data: {},
      layout: {},
    },
    visualizationRef: {
      current: null,
    },
  });
});

test("setVisualization image", async () => {
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: true,
      viz_type: "image",
      data: "some_path",
    });
  };

  const setViz = jest.fn();
  const visualizationRef = { current: null };
  await setVisualization({
    setViz,
    itemData: { source: "some_source" },
    visualizationRef,
    metadataString: "{}",
    argsString: "{}",
    variableInputValues: [],
  });

  // eslint-disable-next-line
  expect(setViz.mock.calls[0][0].props.children.props["data-testid"]).toBe(
    "Loading..."
  );

  expect(setViz.mock.calls[1][0].type.type.name).toBe("Image");
  expect(setViz.mock.calls[1][0].props).toStrictEqual({
    source: "some_path",
    alt: "some_source",
    imageError: undefined,
    visualizationRef: {
      current: null,
    },
  });
});

test("setVisualization, empty variable and no custom messaging", async () => {
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: true,
      viz_type: "image",
      data: "some_path",
    });
  };

  const setViz = jest.fn();
  const visualizationRef = { current: null };
  await setVisualization({
    setViz,
    itemData: { source: "some_source" },
    visualizationRef,
    metadataString: JSON.stringify({}),
    // eslint-disable-next-line
    argsString: JSON.stringify({ gauge_location: "${Location} ${Time}" }),
    variableInputValues: {},
  });

  // eslint-disable-next-line
  expect(setViz.mock.calls[0][0].props.children.props["data-testid"]).toBe(
    "Loading..."
  );

  // Render the element passed to setViz to check the text content
  render(setViz.mock.calls[1][0]);

  // Check if the rendered content contains the error message
  expect(
    await screen.findByText(/Location variable is empty/i)
  ).toBeInTheDocument();
  expect(
    await screen.findByText(/Time variable is empty/i)
  ).toBeInTheDocument();
});

test("setVisualization, empty variable and custom messaging", async () => {
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: true,
      viz_type: "image",
      data: "some_path",
    });
  };

  const setViz = jest.fn();
  const visualizationRef = { current: null };
  await setVisualization({
    setViz,
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

  // eslint-disable-next-line
  expect(setViz.mock.calls[0][0].props.children.props["data-testid"]).toBe(
    "Loading..."
  );

  // Render the element passed to setViz to check the text content
  render(setViz.mock.calls[1][0]);

  // Check if the rendered content contains the error message
  expect(
    await screen.findByText("custom location message")
  ).toBeInTheDocument();
});

test("setVisualization table", async () => {
  const tableData = { data: [], title: "Some Title" };
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: true,
      viz_type: "table",
      data: tableData,
    });
  };

  const setViz = jest.fn();
  const visualizationRef = { current: null };
  await setVisualization({
    setViz,
    itemData: {},
    visualizationRef,
    metadataString: "{}",
    argsString: "{}",
    variableInputValues: [],
  });

  // eslint-disable-next-line
  expect(setViz.mock.calls[0][0].props.children.props["data-testid"]).toBe(
    "Loading..."
  );

  expect(setViz.mock.calls[1][0].type.type.name).toBe("DataTable");
  expect(setViz.mock.calls[1][0].props).toStrictEqual({
    data: [],
    title: "Some Title",
    visualizationRef: {
      current: null,
    },
  });
});

test("setVisualization card", async () => {
  const cardData = {
    data: [],
    title: "Some Title",
    description: "Some Description",
  };
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: true,
      viz_type: "card",
      data: cardData,
    });
  };

  const setViz = jest.fn();
  const visualizationRef = { current: null };
  await setVisualization({
    setViz,
    itemData: {},
    visualizationRef,
    metadataString: "{}",
    argsString: "{}",
    variableInputValues: [],
  });

  // eslint-disable-next-line
  expect(setViz.mock.calls[0][0].props.children.props["data-testid"]).toBe(
    "Loading..."
  );

  expect(setViz.mock.calls[1][0].type.name).toBe("Card");
  expect(setViz.mock.calls[1][0].props).toStrictEqual({
    data: [],
    title: "Some Title",
    description: "Some Description",
    visualizationRef: {
      current: null,
    },
  });
});

test("setVisualization map", async () => {
  const mapData = {
    viewConfig: {},
    layers: [],
    mapConfig: {},
    legend: [],
  };
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: true,
      viz_type: "map",
      data: mapData,
    });
  };

  const setViz = jest.fn();
  const visualizationRef = { current: null };
  await setVisualization({
    setViz,
    itemData: {},
    visualizationRef,
    metadataString: "{}",
    argsString: "{}",
    variableInputValues: [],
  });

  // eslint-disable-next-line
  expect(setViz.mock.calls[0][0].props.children.props["data-testid"]).toBe(
    "Loading..."
  );

  expect(setViz.mock.calls[1][0].type.name).toBe("MockMapVisualization");
  expect(setViz.mock.calls[1][0].props).toStrictEqual({
    layers: [],
    legend: [],
    mapConfig: {},
    viewConfig: {},
    visualizationRef: {
      current: null,
    },
  });
});

test("setVisualization custom", async () => {
  const customData = {
    url: "url",
    scope: "scope",
    module: "module",
    props: {},
  };
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: true,
      viz_type: "custom",
      data: customData,
    });
  };

  const setViz = jest.fn();
  const visualizationRef = { current: null };
  await setVisualization({
    setViz,
    itemData: {},
    visualizationRef,
    metadataString: "{}",
    argsString: "{}",
    variableInputValues: [],
  });

  // eslint-disable-next-line
  expect(setViz.mock.calls[0][0].props.children.props["data-testid"]).toBe(
    "Loading..."
  );

  expect(setViz.mock.calls[1][0].type.name).toBe("MockModuleLoader");
  expect(setViz.mock.calls[1][0].props).toStrictEqual({
    url: "url",
    scope: "scope",
    module: "module",
    props: {},
    visualizationRef: {
      current: null,
    },
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

test("updateGridItemArgsWithVariableInputs", async () => {
  const argsString = JSON.stringify({
    // eslint-disable-next-line
    location: "${Some Variable}",
    // eslint-disable-next-line
    text: "Here is some text with the a variable ${Some Variable}",
  });
  const variableInputs = { "Some Variable": "Test" };

  const result = updateGridItemArgsWithVariableInputs(
    argsString,
    variableInputs
  );
  expect(result).toStrictEqual({
    location: "Test",
    text: "Here is some text with the a variable Test",
  });

  const newResult = updateGridItemArgsWithVariableInputs(argsString, {});
  expect(newResult).toStrictEqual({
    location: "",
    text: "Here is some text with the a variable ",
  });
});

test("getBaseMapLayer", async () => {
  const result = getBaseMapLayer(
    "https://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer"
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
        type: "ImageTile",
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
    "https://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Reference/MapServer"
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
    "https://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Reference/MapServer"
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
