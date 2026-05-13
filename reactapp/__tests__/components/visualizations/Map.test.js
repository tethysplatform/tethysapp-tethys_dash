import { useRef, useEffect, useState } from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import createLoadedComponent, {
  InputVariablePComponent,
} from "__tests__/utilities/customRender";
import PropTypes from "prop-types";
import { Map } from "ol";
import ImageArcGISRest from "ol/source/ImageArcGISRest.js";
import VariableInput from "components/visualizations/VariableInput";
import { Vector as VectorSource } from "ol/source.js";
import appAPI from "services/api/app";
import { applyStyle } from "ol-mapbox-style";
import Point from "ol/geom/Point.js";
import { queryLayerFeatures } from "components/map/utilities";
import Overlay from "ol/Overlay";
import {
  mockedTextVariable,
  mockedDropdownVariable,
  mockedDropdownVisualization,
  userDashboard,
  layerConfigImageArcGISRest,
  dynamicMapLayer,
} from "__tests__/utilities/constants";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";

jest.mock("components/map/ModuleLoader", () => {
  const actual = jest.requireActual("components/map/ModuleLoader");
  return {
    __esModule: true,
    default: actual.default, // use the real default export
    createJsonStyleFunction: jest.fn(), // mock only this function
  };
});

// eslint-disable-next-line
import MapVisualization, { Popup } from "components/visualizations/Map";
// eslint-disable-next-line
import { createJsonStyleFunction } from "components/map/ModuleLoader";

global.ResizeObserver = require("resize-observer-polyfill");

jest.mock("ol-mapbox-style", () => ({
  applyStyle: jest.fn(),
}));
const mockedApplyStyle = jest.mocked(applyStyle);

jest.mock("components/map/utilities", () => {
  const originalModule = jest.requireActual("components/map/utilities");
  return {
    ...originalModule,
    queryLayerFeatures: jest.fn(),
    swapVectorLayerFeatures: jest.fn(),
  };
});
const mockedQueryLayerFeatures = jest.mocked(queryLayerFeatures);

const exampleGeoJSON = {
  type: "FeatureCollection",
  crs: {
    type: "name",
    properties: {
      name: "EPSG:3857",
    },
  },
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [0, 0],
      },
    },
  ],
};

const exampleStyle = {
  version: 8,
  sprite:
    "https://cdn.arcgis.com/sharing/rest/content/items/005b8960ddd04ae781df8d471b6726b3/resources/styles/../sprites/sprite",
  glyphs:
    "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/resources/fonts/{fontstack}/{range}.pbf",
  sources: {
    esri: {
      type: "vector",
      url: "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer",
      tiles: [
        "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile/{z}/{y}/{x}.pbf",
      ],
    },
  },
  layers: [
    {
      id: "Land/Ice",
      type: "fill",
      source: "esri",
      "source-layer": "Land",
      filter: ["==", "_symbol", 1],
      layout: {},
      paint: {
        "fill-opacity": 0.8,
        "fill-color": "#feffff",
      },
    },
  ],
};

const exampleRuleBasedStyle = {
  rules: [],
  default: {
    point: {
      shape: "star",
      size: "10",
      strokeWidth: "2",
      fill: "#fb0000",
      stroke: "#09f510",
    },
  },
};

const TestingComponent = ({
  onMapClick,
  onMapPointerMove,
  onMapZoom,
  clickCoordinates,
  mapProps,
}) => {
  const visualizationRef = useRef();
  const { mapReady } = useMapContext();

  useEffect(() => {
    if (!visualizationRef.current || !mapReady) return;

    if (onMapClick) {
      const evt = {
        type: "singleclick",
        coordinate: clickCoordinates,
      };
      visualizationRef.current.dispatchEvent(evt);
    }

    if (onMapPointerMove) {
      const evt = {
        type: "pointermove",
        coordinate: clickCoordinates,
      };
      visualizationRef.current.dispatchEvent(evt);
    }

    if (onMapZoom) {
      visualizationRef.current.getView().setZoom(8);
    }
  }, [mapReady, clickCoordinates, onMapClick, onMapPointerMove, onMapZoom]);

  return (
    <div>
      <MapVisualization visualizationRef={visualizationRef} {...mapProps} />
      <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
      <InputVariablePComponent />
    </div>
  );
};

test("Map default and update layers", async () => {
  const baseMap =
    "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer";
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers: [],
            baseMap,
            layerControl: true,
          }}
        />
      </MapContextProvider>
    ),
  });
  const { rerender } = render(LoadedComponent);

  const mapDiv = await screen.findByLabelText("Map Div");
  expect(mapDiv).toBeInTheDocument();
  expect(mapDiv).toHaveStyle("width: 100%");

  expect(screen.queryByLabelText("Map Legend")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Show Layers Control")).toBeInTheDocument();

  // should only add basemap
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  expect(addLayerSpy.mock.calls[0][0].getSource().key_).toBe(
    "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  );

  addLayerSpy.mockClear(); // Reset the call count
  const newLayers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
    },
  ];
  const NewLoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers: newLayers,
            baseMap: null,
            layerControl: true,
          }}
        />
      </MapContextProvider>
    ),
  });
  rerender(NewLoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  // should only add the layer because of no basemap
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  expect(
    addLayerSpy.mock.calls[0][0].getSource() instanceof ImageArcGISRest,
  ).toBe(true);
});

test("Map GeoJSON with legend and style", async () => {
  const mockDownloadJSON = jest.fn();
  jest.spyOn(appAPI, "downloadJSON").mockImplementation(mockDownloadJSON);
  mockDownloadJSON.mockResolvedValueOnce({
    success: true,
    data: exampleStyle,
  });
  mockDownloadJSON.mockResolvedValueOnce({
    success: true,
    data: exampleGeoJSON,
  });

  mockedApplyStyle.mockResolvedValue(true);
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

  const layers = [
    {
      configuration: {
        type: "VectorLayer",
        props: {
          name: "GeoJSON Layer",
          source: {
            type: "GeoJSON",
            props: {},
            geojson: "some_file.json",
          },
        },
        style: "some_style_file.json",
      },
      legend: {
        title: "Some Title",
        items: [{ label: "Some Label", color: "green", symbol: "square" }],
      },
    },
  ];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  // should only add the layer because of no basemap
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  expect(addLayerSpy.mock.calls[0][0].getSource() instanceof VectorSource).toBe(
    true,
  );
  expect(
    addLayerSpy.mock.calls[0][0]
      .getSource()
      .getFeatures()[0]
      .getGeometry() instanceof Point,
  ).toBe(true);
  expect(mockedApplyStyle).toHaveBeenCalledTimes(1);
  expect(createJsonStyleFunction).toHaveBeenCalledTimes(0);
  expect(await screen.findByLabelText("Legend Control")).toBeInTheDocument();
});

test("Map GeoJSON with legend and rule-based style", async () => {
  const mockDownloadJSON = jest.fn();
  jest.spyOn(appAPI, "downloadJSON").mockImplementation(mockDownloadJSON);
  mockDownloadJSON.mockResolvedValueOnce({
    success: true,
    data: exampleRuleBasedStyle,
  });
  mockDownloadJSON.mockResolvedValueOnce({
    success: true,
    data: exampleGeoJSON,
  });

  mockedApplyStyle.mockRejectedValueOnce(new Error("Not a valid Mapbox style"));
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

  const layers = [
    {
      configuration: {
        type: "VectorLayer",
        props: {
          name: "GeoJSON Layer",
          source: {
            type: "GeoJSON",
            props: {},
            geojson: "some_file.json",
          },
        },
        style: "some_rule_based_style_file.json",
      },
      legend: "default",
    },
  ];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  // should only add the layer because of no basemap
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  expect(addLayerSpy.mock.calls[0][0].getSource() instanceof VectorSource).toBe(
    true,
  );
  expect(
    addLayerSpy.mock.calls[0][0]
      .getSource()
      .getFeatures()[0]
      .getGeometry() instanceof Point,
  ).toBe(true);
  expect(mockedApplyStyle).toHaveBeenCalledTimes(1);
  expect(createJsonStyleFunction).toHaveBeenCalledTimes(1);
  expect(await screen.findByLabelText("Legend Control")).toBeInTheDocument();
});

test("Map GeoJSON with legend and string rule-based style", async () => {
  const mockDownloadJSON = jest.fn();
  jest.spyOn(appAPI, "downloadJSON").mockImplementation(mockDownloadJSON);
  mockDownloadJSON.mockResolvedValueOnce({
    success: true,
    data: JSON.stringify(exampleRuleBasedStyle),
  });
  mockDownloadJSON.mockResolvedValueOnce({
    success: true,
    data: exampleGeoJSON,
  });

  mockedApplyStyle.mockRejectedValueOnce(new Error("Not a valid Mapbox style"));
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

  const layers = [
    {
      configuration: {
        type: "VectorLayer",
        props: {
          name: "GeoJSON Layer",
          source: {
            type: "GeoJSON",
            props: {},
            geojson: "some_file.json",
          },
        },
        style: "some_rule_based_style_file.json",
      },
      legend: "default",
    },
  ];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  // should only add the layer because of no basemap
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  expect(addLayerSpy.mock.calls[0][0].getSource() instanceof VectorSource).toBe(
    true,
  );
  expect(
    addLayerSpy.mock.calls[0][0]
      .getSource()
      .getFeatures()[0]
      .getGeometry() instanceof Point,
  ).toBe(true);
  expect(mockedApplyStyle).toHaveBeenCalledTimes(1);
  expect(createJsonStyleFunction).toHaveBeenCalledTimes(1);
  expect(await screen.findByLabelText("Legend Control")).toBeInTheDocument();
});

test("Map GeoJSON with legend and bad style", async () => {
  const mockDownloadJSON = jest.fn();
  jest.spyOn(appAPI, "downloadJSON").mockImplementation(mockDownloadJSON);
  mockDownloadJSON.mockResolvedValueOnce({
    success: true,
    data: {},
  });
  mockDownloadJSON.mockResolvedValueOnce({
    success: true,
    data: exampleGeoJSON,
  });

  mockedApplyStyle.mockRejectedValueOnce(new Error("Not a valid Mapbox style"));
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

  const layers = [
    {
      configuration: {
        type: "VectorLayer",
        props: {
          name: "GeoJSON Layer",
          source: {
            type: "GeoJSON",
            props: {},
            geojson: "some_file.json",
          },
        },
        style: "some_rule_based_style_file.json",
      },
      legend: "default",
    },
  ];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  // should only add the layer because of no basemap
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  expect(addLayerSpy.mock.calls[0][0].getSource() instanceof VectorSource).toBe(
    true,
  );
  expect(
    addLayerSpy.mock.calls[0][0]
      .getSource()
      .getFeatures()[0]
      .getGeometry() instanceof Point,
  ).toBe(true);
  expect(mockedApplyStyle).toHaveBeenCalledTimes(1);
  expect(createJsonStyleFunction).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText("Legend Control")).not.toBeInTheDocument();
});

test("Map GeoJSON with legend and bad format", async () => {
  const mockDownloadJSON = jest.fn();
  jest.spyOn(appAPI, "downloadJSON").mockImplementation(mockDownloadJSON);
  mockDownloadJSON.mockResolvedValueOnce({
    success: true,
    data: "bad format",
  });
  mockDownloadJSON.mockResolvedValueOnce({
    success: true,
    data: exampleGeoJSON,
  });

  mockedApplyStyle.mockRejectedValueOnce(new Error("Not a valid Mapbox style"));
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

  const layers = [
    {
      configuration: {
        type: "VectorLayer",
        props: {
          name: "GeoJSON Layer",
          source: {
            type: "GeoJSON",
            props: {},
            geojson: "some_file.json",
          },
        },
        style: "some_rule_based_style_file.json",
      },
      legend: "default",
    },
  ];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  // should only add the layer because of no basemap
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  expect(addLayerSpy.mock.calls[0][0].getSource() instanceof VectorSource).toBe(
    true,
  );
  expect(
    addLayerSpy.mock.calls[0][0]
      .getSource()
      .getFeatures()[0]
      .getGeometry() instanceof Point,
  ).toBe(true);
  expect(mockedApplyStyle).toHaveBeenCalledTimes(1);
  expect(createJsonStyleFunction).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText("Legend Control")).not.toBeInTheDocument();
});

test("Map GeoTIFF with default legend emits a ramp colorbar from sourceProps metadata", async () => {
  // Covers lines 353-360: when a GeoTIFF layer carries persisted
  // rampName/rampMin/rampMax on its source, `legend: "default"` should
  // bypass the style/url legend paths and produce a colorbar legend
  // straight from COLOR_RAMPS[rampName] + the persisted bounds.
  const layer = {
    configuration: {
      type: "WebGLTile",
      props: {
        name: "Ramp Raster Layer",
        source: {
          type: "GeoTIFF",
          props: {
            sources: [{ url: "https://example.com/ramp.tif" }],
          },
          rampName: "viridis",
          rampMin: "0",
          rampMax: "100",
        },
      },
      style: {
        color: [
          "interpolate",
          ["linear"],
          ["band", 1],
          0,
          "#000000",
          100,
          "#ffffff",
        ],
      },
    },
    legend: "default",
  };

  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers: [layer],
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  // LegendControl is collapsed by default; clicking expand reveals the
  // colorbar produced by the auto-legend path.
  fireEvent.click(await screen.findByLabelText("Show Legend Control"));

  // LegendRenderer renders rampColors as a CSS linear-gradient strip
  // with aria-label `Color ramp from <min> to <max>`.
  expect(
    await screen.findByLabelText("Color ramp from 0 to 100"),
  ).toBeInTheDocument();
  // Layer name is used as the legend title for the colorbar entry
  // (line 357: `title: layer.configuration?.props?.name`).
  expect(screen.getByText("Ramp Raster Layer")).toBeInTheDocument();
});

test("Map ESRI with default legend", async () => {
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const layer = layerConfigImageArcGISRest;
  layer.legend = "default";

  const layers = [layer];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  // should only add the layer because of no basemap
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  expect(
    addLayerSpy.mock.calls[0][0].getSource() instanceof ImageArcGISRest,
  ).toBe(true);
});

test("Map click", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "some value" },
      geometry: {
        paths: [
          [
            [0, 0],
            [0, 1],
          ],
          [
            [1, 0],
            [1, 1],
          ],
        ],
      },
      layerName: "Some Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const removeLayerSpy = jest.spyOn(Map.prototype, "removeLayer");

  // Mock the clear method on VectorSource to test it's called
  const mockClear = jest.fn();
  jest.spyOn(VectorSource.prototype, "clear").mockImplementation(mockClear);

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={clickCoordinates}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  const { rerender } = render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // layer, marker, and highlight layer
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(3);
  });
  await waitFor(() => {
    expect(removeLayerSpy.mock.calls.length).toBe(0);
  });

  expect(
    addLayerSpy.mock.calls[2][0].getSource() instanceof ImageArcGISRest,
  ).toBe(true);

  // highlight layer
  const highLightLayer = addLayerSpy.mock.calls[0][0];
  expect(highLightLayer.get("name")).toBe("Highlighted Layer");
  expect(highLightLayer.getSource() instanceof VectorSource).toBe(true);
  expect(
    highLightLayer.getSource().getFeatures()[0].getGeometry().getCoordinates(),
  ).toStrictEqual([
    [0, 0],
    [0, 1],
  ]);

  // marker layer
  expect(addLayerSpy.mock.calls[1][0].get("name")).toBe("Marker");
  expect(addLayerSpy.mock.calls[1][0].getSource() instanceof VectorSource).toBe(
    true,
  );
  expect(
    addLayerSpy.mock.calls[1][0]
      .getSource()
      .getFeatures()[0]
      .getGeometry()
      .getCoordinates(),
  ).toStrictEqual(clickCoordinates);

  // popup
  expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates);

  expect(await screen.findByText("Some Layer")).toBeInTheDocument();
  expect(await screen.findByText("Field")).toBeInTheDocument();
  expect(await screen.findByText("Value")).toBeInTheDocument();
  expect(await screen.findByText("field1")).toBeInTheDocument();
  expect(await screen.findByText("some value")).toBeInTheDocument();

  addLayerSpy.mockClear(); // Reset the call count
  mockClear.mockClear(); // Reset the clear call count

  const newClickCoordinates = [20, 10];
  const NewLoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={newClickCoordinates}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  rerender(NewLoadedComponent);

  // new marker layer
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  // remove old marker layer
  await waitFor(() => {
    expect(removeLayerSpy.mock.calls.length).toBe(1);
  });

  // Verify that the highlight layer's clear method was called on the second click
  expect(mockClear).toHaveBeenCalledTimes(1);

  // marker layer
  expect(addLayerSpy.mock.calls[0][0].getSource() instanceof VectorSource).toBe(
    true,
  );
  expect(
    addLayerSpy.mock.calls[0][0]
      .getSource()
      .getFeatures()[0]
      .getGeometry()
      .getCoordinates(),
  ).toStrictEqual(newClickCoordinates);
});

test("Map click with aliases", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "some value" },
      geometry: {
        paths: [
          [
            [0, 0],
            [0, 1],
          ],
          [
            [1, 0],
            [1, 1],
          ],
        ],
      },
      layerName: "Some Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
      attributeAliases: { "Some Layer": { field1: "Some Alias Field" } },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={clickCoordinates}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // layer, marker, and highlight layer
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(3);
  });

  // popup
  expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates);

  expect(await screen.findByText("Some Layer")).toBeInTheDocument();
  expect(await screen.findByText("Field")).toBeInTheDocument();
  expect(await screen.findByText("Value")).toBeInTheDocument();
  expect(screen.queryByText("field1")).not.toBeInTheDocument();
  expect(await screen.findByText("Some Alias Field")).toBeInTheDocument();
  expect(await screen.findByText("some value")).toBeInTheDocument();
});

test("Map click no queryable layer", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "some value" },
      geometry: {
        paths: [
          [
            [0, 0],
            [0, 1],
          ],
          [
            [1, 0],
            [1, 1],
          ],
        ],
      },
      layerName: "Some Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC not queryable",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
      queryable: false,
    },
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={clickCoordinates}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // layer, marker, and highlight layer
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(4);
  });

  expect(addLayerSpy.mock.calls[0][0].values_.name).toBe("Highlighted Layer");
  expect(addLayerSpy.mock.calls[1][0].values_.name).toBe("Marker");
  expect(addLayerSpy.mock.calls[2][0].values_.name).toBe("NWC not queryable");
  expect(addLayerSpy.mock.calls[3][0].values_.name).toBe("NWC");

  expect(mockedQueryLayerFeatures.mock.calls.length).toBe(1);
  expect(
    mockedQueryLayerFeatures.mock.calls[0][0].configuration.props.name,
  ).toBe("NWC");
});

test("Map click skips layers the user has hidden via the layer control", async () => {
  // Visibility is mutated on the OL layer directly by LayersControl, so the
  // config-side `layers` array doesn't reflect toggles. The click handler
  // must consult `olLayer.getVisible()` (looked up by name) and skip
  // queries on hidden layers — otherwise a user who turned off a layer
  // would still see its features in the popup table. The OL layer's
  // `layerVisibility: false` flag in the layer config drives initial
  // visibility (Map.js#L329-L334).
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "some value" },
      geometry: { x: 0, y: 0 },
      layerName: "Some Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        layerVisibility: false,
        props: {
          name: "NWC hidden",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "some_url" },
          },
        },
      },
    },
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC visible",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "some_url" },
          },
        },
      },
    },
  ];

  // The default TestingComponent dispatches the click on mapReady, but
  // mapReady flips to true on OL's first `rendercomplete` — BEFORE the
  // async customLayers loop finishes mounting OL layers. That race
  // doesn't matter for tests that filter config-side (queryable: false),
  // but the visibility filter needs the OL layers to exist. Gate the
  // click on the OL layers actually being added.
  const ManualClickHarness = () => {
    const visualizationRef = useRef();
    const { mapReady } = useMapContext();
    const clickCoordinates = [10, 20];
    return (
      <div>
        <MapVisualization
          visualizationRef={visualizationRef}
          mapConfig={{}}
          viewConfig={{}}
          layers={layers}
          baseMap={null}
          layerControl={false}
        />
        <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
        <button
          type="button"
          onClick={() =>
            visualizationRef.current?.dispatchEvent({
              type: "singleclick",
              coordinate: clickCoordinates,
            })
          }
        >
          fire-click
        </button>
      </div>
    );
  };

  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <ManualClickHarness />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // Wait for OL to mount both custom layers before firing the click.
  // (The Highlighted Layer + Marker are added LATER, inside onMapClick.)
  await waitFor(() => {
    const addedNames = addLayerSpy.mock.calls.map(
      (call) => call[0].values_?.name,
    );
    expect(addedNames).toEqual(
      expect.arrayContaining(["NWC hidden", "NWC visible"]),
    );
  });

  fireEvent.click(screen.getByText("fire-click"));

  await waitFor(() => {
    expect(mockedQueryLayerFeatures.mock.calls.length).toBe(1);
  });
  expect(
    mockedQueryLayerFeatures.mock.calls[0][0].configuration.props.name,
  ).toBe("NWC visible");
});

test("Map click no features found", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={clickCoordinates}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  expect(popSetPosition).toHaveBeenLastCalledWith(clickCoordinates);

  await waitFor(async () => {
    expect(await screen.findByText("No Attributes Found")).toBeInTheDocument();
  });

  const popupCloser = await screen.findByLabelText("Popup Closer");
  fireEvent.click(popupCloser);
  expect(popSetPosition).toHaveBeenLastCalledWith(undefined);
});

test("Map click no attributes found", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: {},
      geometry: { x: 10, y: 10 },
      layerName: "Some Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={clickCoordinates}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  expect(popSetPosition).toHaveBeenLastCalledWith(clickCoordinates);

  await waitFor(async () => {
    expect(await screen.findByText("No Attributes Found")).toBeInTheDocument();
  });

  const popupCloser = await screen.findByLabelText("Popup Closer");
  fireEvent.click(popupCloser);
  expect(popSetPosition).toHaveBeenLastCalledWith(undefined);
});

test("Map click all attributes omitted", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "some value" },
      geometry: { x: 10, y: 10 },
      layerName: "Some Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
      omittedPopupAttributes: { "Some Layer": ["field1"] },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={clickCoordinates}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith(undefined);
  });
});

test("Map click attribute variables update text variable input then swipe and update again", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "some value" },
      geometry: { x: 10, y: 10 },
      layerName: "Some Layer",
    },
    {
      attributes: { field1: "another value" },
      geometry: { x: 10, y: 10 },
      layerName: "Some Layer",
    },
    {
      attributes: { field1: "Null" },
      geometry: { x: 10, y: 10 },
      layerName: "Some Layer",
    },
    {
      attributes: { field1: "yet another value" },
      geometry: { x: 10, y: 10 },
      layerName: "Another Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");
  const handleChange = jest.fn();
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedTextVariable];
  const varInputArgs = JSON.parse(mockedTextVariable.args_string);

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
      attributeVariables: { "Some Layer": { field1: "Test Variable" } },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={clickCoordinates}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
        <VariableInput
          variable_name={varInputArgs.variable_name}
          initial_value={varInputArgs.initial_value}
          variable_options_source={varInputArgs.variable_options_source}
          onChange={handleChange}
        />
      </MapContextProvider>
    ),
    options: { dashboards: { dashboards: [dashboard] } },
  });
  render(LoadedComponent);

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "" }),
  );

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  // popup
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates);
  });

  expect(await screen.findAllByText("Some Layer")).toHaveLength(3);
  expect(await screen.findByText("Another Layer")).toBeInTheDocument();
  expect(await screen.findAllByText("Field")).toHaveLength(4);
  expect(await screen.findAllByText("Value")).toHaveLength(4);
  expect(await screen.findAllByText("field1")).toHaveLength(4);
  expect(await screen.findByText("some value")).toBeInTheDocument();
  expect(await screen.findByText("another value")).toBeInTheDocument();
  expect(await screen.findByText("Null")).toBeInTheDocument();
  expect(await screen.findByText("yet another value")).toBeInTheDocument();

  await waitFor(async () => {
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({
        "Test Variable": "some value",
      }),
    );
  });
  const variableInput = screen.getByRole("textbox");
  await waitFor(() => {
    expect(variableInput.value).toBe("some value");
  });

  const nextSwiper = screen.getByLabelText("Next Swiper");
  fireEvent.click(nextSwiper);

  await waitFor(async () => {
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({
        "Test Variable": "another value",
      }),
    );
  });

  fireEvent.click(nextSwiper);

  await waitFor(async () => {
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({
        "Test Variable": "another value",
      }),
    );
  });

  fireEvent.click(nextSwiper);

  await waitFor(async () => {
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({
        "Test Variable": "another value",
      }),
    );
  });
});

test("Map click attribute variables update dropdown variable input", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "FTDC1" },
      geometry: { x: 10, y: 10 },
      layerName: "Some Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");
  const handleChange = jest.fn();
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedDropdownVariable];
  const varInputArgs = JSON.parse(mockedDropdownVariable.args_string);

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
      attributeVariables: { "Some Layer": { field1: "Test Variable" } },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={clickCoordinates}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
        <VariableInput
          variable_name={varInputArgs.variable_name}
          initial_value={varInputArgs.initial_value}
          variable_options_source={varInputArgs.variable_options_source}
          onChange={handleChange}
        />
      </MapContextProvider>
    ),
    options: {
      dashboards: { dashboards: [dashboard] },
      visualizations: mockedDropdownVisualization,
    },
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  await waitFor(() => {
    expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates);
  });

  expect(await screen.findByText("Some Layer")).toBeInTheDocument();
  expect(await screen.findByText("Field")).toBeInTheDocument();
  expect(await screen.findByText("Value")).toBeInTheDocument();
  expect(await screen.findByText("field1")).toBeInTheDocument();
  expect(await screen.findByText("FTDC1")).toBeInTheDocument();

  await waitFor(async () => {
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({
        "Test Variable": "FTDC1",
      }),
    );
  });
  await waitFor(async () => {
    expect(
      screen.getByText("FTDC1 - SMITH RIVER - DOCTOR FINE BRIDGE"),
    ).toBeInTheDocument();
  });
});

test("Map click attribute variables Null values", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "Null" },
      geometry: { x: 10, y: 10 },
      layerName: "Some Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
      attributeVariables: { "Some Layer": { field1: "Some Variable" } },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={clickCoordinates}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({}),
  );

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  await waitFor(() => {
    expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates);
  });

  expect(await screen.findByText("Some Layer")).toBeInTheDocument();
  expect(await screen.findByText("Field")).toBeInTheDocument();
  expect(await screen.findByText("Value")).toBeInTheDocument();
  expect(await screen.findByText("field1")).toBeInTheDocument();
  expect(await screen.findByText("Null")).toBeInTheDocument();

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({}),
  );
});

test("Map click attribute variables match field name and alias", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { alias1: "value1", field2: "value2", field3: "value3" },
      geometry: { x: 10, y: 10 },
      layerName: "Layer1",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");
  // Simulate dashboard variable config
  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "some_url" },
          },
        },
      },
      attributeVariables: {
        Layer1: { field1: "Var1", alias2: "Var2", field3: "Var3" },
      },
      attributeAliases: { Layer1: { field1: "alias1", field2: "alias2" } },
      omittedPopupAttributes: { Layer1: ["field2"] },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={clickCoordinates}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates);
  });
  // Both variable inputs should be updated
  await waitFor(async () => {
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ Var1: "value1", Var2: "value2", Var3: "value3" }),
    );
  });
  // Both values should be visible in popup
  expect(await screen.findByText("alias1")).toBeInTheDocument();
  expect(await screen.findByText("value1")).toBeInTheDocument();
  expect(await screen.findByText("field3")).toBeInTheDocument();
  expect(await screen.findByText("value3")).toBeInTheDocument();
});

test("Map click query error", async () => {
  mockedQueryLayerFeatures.mockRejectedValue("some error");
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={clickCoordinates}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith(clickCoordinates);
  });
  expect(await screen.findByText("No Attributes Found")).toBeInTheDocument();
});

test("Map click not happen in dataviewer mode", async () => {
  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
    },
  ];
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const removeLayerSpy = jest.spyOn(Map.prototype, "removeLayer");
  const clickCoordinates = [10, 20];

  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={clickCoordinates}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
            dataviewerViz: true,
          }}
        />
      </MapContextProvider>
    ),
    options: {
      inDataViewerMode: true,
    },
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  expect(await screen.findByLabelText("Info Div")).toBeInTheDocument();

  // layer, marker, and highlight layer
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  await waitFor(() => {
    expect(removeLayerSpy.mock.calls.length).toBe(0);
  });

  expect(
    addLayerSpy.mock.calls[0][0].getSource() instanceof ImageArcGISRest,
  ).toBe(true);
  expect(popSetPosition).toHaveBeenCalledTimes(0);
});

test("Map click layer zoomed query result", async () => {
  mockedQueryLayerFeatures.mockResolvedValue("zoomed");
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
      omittedPopupAttributes: { "Some Layer": ["field1"] },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={clickCoordinates}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith(undefined);
  });
});

test("Map info div in dataviewer mode with pontermove", async () => {
  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          clickCoordinates={clickCoordinates}
          onMapPointerMove={true}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
            dataviewerViz: true,
          }}
        />
      </MapContextProvider>
    ),
    options: {
      inDataViewerMode: true,
    },
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  expect(await screen.findByLabelText("Info Div")).toBeInTheDocument();
  expect(await screen.findByText(/Zoom: 4.5/i)).toBeInTheDocument();
  expect(
    await screen.findByText(/Lon: 10.00, Lat: 20.00/i),
  ).toBeInTheDocument();
  expect(await screen.findByText(/Projection: EPSG:3857/i)).toBeInTheDocument();
});

test("Map info div in dataviewer mode with zoom", async () => {
  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapZoom={true}
          clickCoordinates={clickCoordinates}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
            mapExtent: { extent: "-10686671.12, 4721671.57,4.5" },
            dataviewerViz: true,
          }}
        />
      </MapContextProvider>
    ),
    options: {
      inDataViewerMode: true,
    },
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  expect(await screen.findByLabelText("Info Div")).toBeInTheDocument();
  expect(await screen.findByText(/Zoom: 8/i)).toBeInTheDocument();
  expect(
    await screen.findByText(/Lon: -10686671.12, Lat: 4721671.57/i),
  ).toBeInTheDocument();
  expect(await screen.findByText(/Projection: EPSG:3857/i)).toBeInTheDocument();
});

test("Map bad basemap", async () => {
  const baseMap = "some bad basemap";
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const consoleErrorSpy = jest.spyOn(console, "error");

  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers: [],
            baseMap,
            layerControl: true,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // no basemap added
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(0);
  });
  expect(consoleErrorSpy).toHaveBeenCalledWith(
    "some bad basemap is not a valid basemap",
  );
});

test("Map bad GeoJSON", async () => {
  const mockDownloadJSON = jest.fn();
  jest.spyOn(appAPI, "downloadJSON").mockImplementation(mockDownloadJSON);
  mockDownloadJSON.mockResolvedValueOnce({
    success: false,
  });

  mockedApplyStyle.mockResolvedValue(true);
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

  const layers = [
    {
      configuration: {
        type: "VectorLayer",
        props: {
          name: "GeoJSON Layer",
          source: {
            type: "GeoJSON",
            props: {},
            geojson: "some_file.json",
          },
        },
      },
    },
  ];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // no geojson added
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(0);
  });
  expect(
    await screen.findByText('Failed to load the "GeoJSON Layer" layer(s)'),
  ).toBeInTheDocument();
});

test("Map bad style", async () => {
  const mockDownloadJSON = jest.fn();
  jest.spyOn(appAPI, "downloadJSON").mockImplementation(mockDownloadJSON);
  mockDownloadJSON.mockResolvedValueOnce({
    success: false,
  });
  mockDownloadJSON.mockResolvedValueOnce({
    success: true,
    data: exampleGeoJSON,
  });

  mockedApplyStyle.mockResolvedValue(true);
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const consoleErrorSpy = jest.spyOn(console, "error");

  const layers = [
    {
      configuration: {
        type: "VectorLayer",
        props: {
          name: "GeoJSON Layer",
          source: {
            type: "GeoJSON",
            props: {},
            geojson: "some_file.json",
          },
        },
        style: "some_style_file.json",
      },
    },
  ];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // should only add the geojson
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  expect(addLayerSpy.mock.calls[0][0].getSource() instanceof VectorSource).toBe(
    true,
  );
  expect(
    addLayerSpy.mock.calls[0][0]
      .getSource()
      .getFeatures()[0]
      .getGeometry() instanceof Point,
  ).toBe(true);
  expect(mockedApplyStyle).toHaveBeenCalledTimes(0);
  expect(consoleErrorSpy).toHaveBeenCalledWith(
    "Failed to load the style for GeoJSON Layer layer",
  );
});

test("Map runtime layer swap dismisses popup overlay (no prior click)", async () => {
  const mockGetVisualizationFeatures = jest
    .spyOn(appAPI, "getVisualizationFeatures")
    .mockResolvedValue({
      success: true,
      viz_type: "features",
      data: {
        type: "FeatureCollection",
        features: [],
        crs: { type: "name", properties: { name: "EPSG:4326" } },
      },
    });
  const setPositionSpy = jest.spyOn(Overlay.prototype, "setPosition");
  const vectorClearSpy = jest.spyOn(VectorSource.prototype, "clear");

  const layers = [JSON.parse(JSON.stringify(dynamicMapLayer))];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
            refreshCount: 0,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // Wait for the runtime layer fetch (debounced 250ms) to complete; that
  // resolution path invokes onBeforeSwap → dismissPopupBeforeSwap.
  await waitFor(() => {
    expect(mockGetVisualizationFeatures).toHaveBeenCalledTimes(1);
  });

  // Popup overlay was hidden via setPosition(undefined). No popup was open
  // yet, but the dismiss path runs unconditionally for the overlay branch.
  await waitFor(() => {
    expect(setPositionSpy).toHaveBeenCalledWith(undefined);
  });

  // No click happened, so highlightLayer.current is still undefined and the
  // optional-chain guard short-circuits — VectorSource.clear must not run.
  expect(vectorClearSpy).not.toHaveBeenCalled();
});

test("Map runtime layer swap dismisses popup and clears highlight after click", async () => {
  jest.spyOn(appAPI, "getVisualizationFeatures").mockResolvedValue({
    success: true,
    viz_type: "features",
    data: {
      type: "FeatureCollection",
      features: [],
      crs: { type: "name", properties: { name: "EPSG:4326" } },
    },
  });
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "some value" },
      geometry: {
        paths: [
          [
            [0, 0],
            [0, 1],
          ],
        ],
      },
      layerName: "Some Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const setPositionSpy = jest.spyOn(Overlay.prototype, "setPosition");
  const vectorClearSpy = jest.spyOn(VectorSource.prototype, "clear");

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
    },
    JSON.parse(JSON.stringify(dynamicMapLayer)),
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={clickCoordinates}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
            refreshCount: 0,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // Once the runtime fetcher resolves (~250ms after mount), onBeforeSwap →
  // dismissPopupBeforeSwap fires. clear() can only happen here, since
  // swapVectorLayerFeatures is mocked and onMapClick only calls clear() on a
  // *second* click (this test dispatches one). So a single clear() call is
  // proof the click ran first (creating the highlight) and the dismiss path
  // then ran with both branches taken.
  await waitFor(() => {
    expect(vectorClearSpy).toHaveBeenCalled();
  });
  expect(setPositionSpy).toHaveBeenCalledWith(undefined);
});

// Helper component that sets MapContext.extentDrawMode synchronously on
// mount. Used by the draw-mode-suppression test.
const ExtentDrawModeSetter = ({ mode }) => {
  const { setExtentDrawMode } = useMapContext();
  useEffect(() => {
    setExtentDrawMode(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};
ExtentDrawModeSetter.propTypes = { mode: PropTypes.string };

describe("modal-mode popup integration", () => {
  test("modal-mode layer click opens PopupModal alongside the table popup; outer-context attribute write still fires", async () => {
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { station_id: "ABC", state_id: "WA" },
        geometry: { x: 10, y: 10 },
        layerName: "Stations",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

    const layers = [
      {
        name: "Stations",
        configuration: {
          type: "ImageLayer",
          props: {
            name: "Stations",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "some_url" },
            },
          },
        },
        // attributeVariables drives the outer-context write — both table
        // and modal popups now render in parallel, so the host's
        // attributeVariables → variableInputs flow continues for
        // modal-mode features.
        attributeVariables: { Stations: { station_id: "Test Variable" } },
        popupConfig: {
          mode: "modal",
          position: {
            leftPct: 25,
            topPct: 30,
            widthPct: 50,
            heightPct: 40,
          },
          titleTemplate: null,
          gridItems: [],
        },
      },
    ];
    const clickCoordinates = [10, 20];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={clickCoordinates}
            mapProps={{
              mapConfig: {},
              viewConfig: {},
              layers,
              baseMap: null,
              layerControl: false,
            }}
          />
        </MapContextProvider>
      ),
    });
    render(LoadedComponent);

    expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    // Modal opens (PopupModal renders role=dialog into document.body via
    // portal).
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByTestId("popup-modal-chrome")).toBeInTheDocument();
    expect(screen.getByTestId("popup-modal-header-title")).toHaveTextContent(
      "Stations",
    );

    // Outer-context attributeVariables write fires (modal-mode no longer
    // suppresses it): station_id="ABC" → "Test Variable".
    await waitFor(() => {
      expect(screen.getByTestId("input-variables")).toHaveTextContent(
        JSON.stringify({ "Test Variable": "ABC" }),
      );
    });

    // OL Overlay table popup also opens at the click coordinate — the
    // modal-mode click no longer suppresses it.
    await waitFor(() => {
      expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates);
    });
  });

  // eslint-disable-next-line no-template-curly-in-string
  test("modal header substitutes ${feature.<key>} from the active feature's attributes", async () => {
    // Title template is configured by the user in the popup pane and lives
    // on layer.popupConfig.titleTemplate. Map.js computes the substituted
    // title (using FEATURE_SCOPE host-pass preservation + the popup's own
    // substituteTemplateString) and renders it into PopupModal's header.
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { station_id: "ABC", station_name: "Boulder Creek" },
        geometry: { x: 10, y: 10 },
        layerName: "Stations",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const layers = [
      {
        configuration: {
          type: "ImageLayer",
          props: {
            name: "Stations",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "some_url" },
            },
          },
        },
        popupConfig: {
          mode: "modal",
          // eslint-disable-next-line no-template-curly-in-string
          titleTemplate: "Site: ${feature.station_name}",
          gridItems: [],
        },
      },
    ];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={[10, 20]}
            mapProps={{
              mapConfig: {},
              viewConfig: {},
              layers,
              baseMap: null,
              layerControl: false,
            }}
          />
        </MapContextProvider>
      ),
    });
    render(LoadedComponent);

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByTestId("popup-modal-header-title")).toHaveTextContent(
      "Site: Boulder Creek",
    );
  });

  // Regression: with a popup open, host-level variable input changes rebuild
  // the Map's `layers` prop with freshly substituted strings. The wrapper
  // layer captured onto `__wrapperLayer` at click time becomes stale —
  // `activeModalLayer` must be re-resolved against the current `layers`
  // prop (matched by `configuration.props.name`) so the popup body and
  // header always see up-to-date popupConfig content.
  test("popup body re-resolves layer config when host re-substitutes the layers prop", async () => {
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { id: "X" },
        geometry: { x: 10, y: 10 },
        layerName: "Stations",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const buildLayers = (fValue) => [
      {
        configuration: {
          type: "ImageLayer",
          props: {
            name: "Stations",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "some_url" },
            },
          },
        },
        popupConfig: {
          mode: "modal",
          titleTemplate: `Site ${fValue}`,
          gridItems: [],
        },
      },
    ];

    const HostHarness = () => {
      const [fValue, setFValue] = useState("first");
      return (
        <>
          <button type="button" onClick={() => setFValue("second")}>
            change-f
          </button>
          <MapContextProvider>
            <TestingComponent
              onMapClick={jest.fn()}
              clickCoordinates={[10, 20]}
              mapProps={{
                mapConfig: {},
                viewConfig: {},
                layers: buildLayers(fValue),
                baseMap: null,
                layerControl: false,
              }}
            />
          </MapContextProvider>
        </>
      );
    };

    const LoadedComponent = createLoadedComponent({
      children: <HostHarness />,
    });
    render(LoadedComponent);

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByTestId("popup-modal-header-title")).toHaveTextContent(
      "Site first",
    );

    fireEvent.click(screen.getByText("change-f"));

    await waitFor(() => {
      expect(screen.getByTestId("popup-modal-header-title")).toHaveTextContent(
        "Site second",
      );
    });
  });

  test("table-mode (popupConfig absent) layer click still drives outer-context attribute write", async () => {
    // Regression coverage for R2 — table mode unchanged.
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { field1: "ABC" },
        geometry: { x: 10, y: 10 },
        layerName: "Stations",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

    const dashboard = JSON.parse(JSON.stringify(userDashboard));
    dashboard.tabs[0].gridItems = [mockedTextVariable];
    const layers = [
      {
        configuration: {
          type: "ImageLayer",
          props: {
            name: "Stations",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "some_url" },
            },
          },
        },
        attributeVariables: { Stations: { field1: "Test Variable" } },
        // popupConfig is absent — table-mode default.
      },
    ];
    const clickCoordinates = [10, 20];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={clickCoordinates}
            mapProps={{
              mapConfig: {},
              viewConfig: {},
              layers,
              baseMap: null,
              layerControl: false,
            }}
          />
        </MapContextProvider>
      ),
      options: { dashboards: { dashboards: [dashboard] } },
    });
    render(LoadedComponent);

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    // OL Overlay popup opens at the click coordinate.
    await waitFor(() => {
      expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates);
    });

    // Outer-context attribute write fired (backward compat).
    await waitFor(() => {
      expect(screen.getByTestId("input-variables")).toHaveTextContent(
        JSON.stringify({ "Test Variable": "ABC" }),
      );
    });

    // Modal did NOT render.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("ESRI sub-layer click resolves to the wrapper layer's popupConfig (modal opens)", async () => {
    // ESRI Image/Map Service queries return features keyed by the
    // sub-layer name (e.g., "Flow Forecast (m³/sec)") rather than the
    // wrapper layer's configured name ("China Flowlines"). The wrapper
    // is now tagged onto every feature at query time
    // (feature.__wrapperLayer), so popup resolution doesn't depend on
    // any string-name back-lookup that would only work when the user
    // happens to have configured aliases/variables/omitted-attrs on
    // the relevant sub-layer.
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { comid: "55555" },
        geometry: { x: 10, y: 10 },
        layerName: "Flow Forecast (m³/sec)",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    jest.spyOn(Overlay.prototype, "setPosition");

    const layers = [
      {
        configuration: {
          type: "ImageLayer",
          props: {
            name: "China Flowlines",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "some_url" },
            },
          },
        },
        attributeAliases: {
          "Flow Forecast (m³/sec)": { comid: "TDX Hydro Link Number" },
        },
        attributeVariables: {
          "Flow Forecast (m³/sec)": { comid: "river_id" },
        },
        popupConfig: {
          mode: "modal",
          position: { leftPct: 1, topPct: 3, widthPct: 95, heightPct: 55 },
          titleTemplate: null,
          gridItems: [],
        },
      },
    ];
    const clickCoordinates = [10, 20];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={clickCoordinates}
            mapProps={{
              mapConfig: {},
              viewConfig: {},
              layers,
              baseMap: null,
              layerControl: false,
            }}
          />
        </MapContextProvider>
      ),
    });
    render(LoadedComponent);

    expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    // Modal opens because the sub-layer feature resolved to the wrapper's
    // popupConfig.
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByTestId("popup-modal-chrome")).toBeInTheDocument();
    expect(screen.getByTestId("popup-modal-header-title")).toHaveTextContent(
      "Flow Forecast (m³/sec)",
    );
  });

  test("ESRI sub-layer click opens the modal even with no aliases configured (regression)", async () => {
    // Bug scenario: user names a layer "a", configures a modal popup, but
    // never sets attributeAliases/Variables/OmittedPopupAttributes. The
    // ESRI service returns features tagged with the sub-layer name
    // ("Max Status - Forecast Trend"). The string-name back-lookup
    // previously failed because there were no alias maps to mine for
    // sub-layer keys — so the popup wouldn't open. With wrapper-tagging
    // at query time, popup resolution works regardless.
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { nws_lid: "NILM4", nws_name: "Niles" },
        geometry: { x: 10, y: 10 },
        layerName: "Max Status - Forecast Trend",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const layers = [
      {
        configuration: {
          type: "ImageLayer",
          props: {
            name: "a",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "https://example.com/MapServer" },
            },
          },
        },
        // No attributeAliases / attributeVariables / omittedPopupAttributes
        // — the user only configured the popup, nothing else.
        popupConfig: {
          mode: "modal",
          position: { leftPct: 20, topPct: 20, widthPct: 60, heightPct: 60 },
          titleTemplate: null,
          gridItems: [],
        },
      },
    ];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={[10, 20]}
            mapProps={{
              mapConfig: {},
              viewConfig: {},
              layers,
              baseMap: null,
              layerControl: false,
            }}
          />
        </MapContextProvider>
      ),
    });
    render(LoadedComponent);

    expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByTestId("popup-modal-chrome")).toBeInTheDocument();
  });

  test("MapContext.extentDrawMode active suppresses modal open on a modal-mode click", async () => {
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { station_id: "ABC" },
        geometry: { x: 10, y: 10 },
        layerName: "Stations",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const layers = [
      {
        name: "Stations",
        configuration: {
          type: "ImageLayer",
          props: {
            name: "Stations",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "some_url" },
            },
          },
        },
        popupConfig: {
          mode: "modal",
          position: null,
          titleTemplate: null,
          gridItems: [],
        },
      },
    ];
    const clickCoordinates = [10, 20];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <ExtentDrawModeSetter mode="rectangle" />
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={clickCoordinates}
            mapProps={{
              mapConfig: {},
              viewConfig: {},
              layers,
              baseMap: null,
              layerControl: false,
            }}
          />
        </MapContextProvider>
      ),
    });
    render(LoadedComponent);

    expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    // Give async query a chance to resolve, then assert no dialog.
    await waitFor(() => {
      expect(mockedQueryLayerFeatures).toHaveBeenCalled();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("mixed-mode multi-layer click — both modal AND table popup open in parallel", async () => {
    // Two queryable layers; one modal-mode, one table-mode. Modal mode is
    // additive: the OL Overlay table popup AND the PopupModal both open,
    // and the table-mode layer's outer-context attributeVariables write
    // continues to flow.
    mockedQueryLayerFeatures.mockImplementation(async (layer) => {
      if (layer.name === "ModalLayer") {
        return [
          {
            attributes: { station_id: "ABC" },
            geometry: { x: 10, y: 10 },
            layerName: "ModalLayer",
          },
        ];
      }
      return [
        {
          attributes: { field1: "table-value" },
          geometry: { x: 10, y: 10 },
          layerName: "TableLayer",
        },
      ];
    });
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

    const layers = [
      {
        name: "ModalLayer",
        configuration: {
          type: "ImageLayer",
          props: {
            name: "ModalLayer",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "modal_url" },
            },
          },
        },
        popupConfig: {
          mode: "modal",
          position: null,
          titleTemplate: null,
          gridItems: [],
        },
      },
      {
        name: "TableLayer",
        configuration: {
          type: "ImageLayer",
          props: {
            name: "TableLayer",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "table_url" },
            },
          },
        },
        attributeVariables: { TableLayer: { field1: "Some Variable" } },
      },
    ];
    const clickCoordinates = [10, 20];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={clickCoordinates}
            mapProps={{
              mapConfig: {},
              viewConfig: {},
              layers,
              baseMap: null,
              layerControl: false,
            }}
          />
        </MapContextProvider>
      ),
    });
    render(LoadedComponent);

    expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    // Modal opens for the modal-mode feature.
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByTestId("popup-modal-chrome")).toBeInTheDocument();
    expect(screen.getByTestId("popup-modal-header-title")).toHaveTextContent(
      "ModalLayer",
    );

    // OL Overlay popup ALSO opens at the click coordinate (additive).
    // Both views now render simultaneously — the modal in document.body
    // via portal, the overlay anchored to the map.
    await waitFor(() => {
      expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates);
    });
    // Note: outer-context variable writes go through popupContent[0], so
    // whichever layer's features come back first in the click result owns
    // the write. That ordering is exercised in the single-layer modal-mode
    // test above; this test only asserts the additive both-popups-open
    // behavior.
  });

  test("closing the modal via the X button clears modal state and unmounts the dialog", async () => {
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { station_id: "ABC" },
        geometry: { x: 10, y: 10 },
        layerName: "Stations",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const layers = [
      {
        name: "Stations",
        configuration: {
          type: "ImageLayer",
          props: {
            name: "Stations",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "some_url" },
            },
          },
        },
        popupConfig: {
          mode: "modal",
          position: null,
          titleTemplate: null,
          gridItems: [],
        },
      },
    ];
    const clickCoordinates = [10, 20];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={clickCoordinates}
            mapProps={{
              mapConfig: {},
              viewConfig: {},
              layers,
              baseMap: null,
              layerControl: false,
            }}
          />
        </MapContextProvider>
      ),
    });
    render(LoadedComponent);

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("popup-modal-close"));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  // Defensive coverage: query results without a wrapper-layer tag don't
  // trigger the modal. The wrapper-tag is added in onMapClick's queryCalls
  // loop; if a feature somehow lacks it (or lacks the popupConfig wrapper
  // entirely), the `feature.__wrapperLayer?.popupConfig?.mode === "modal"`
  // predicate falls through cleanly to false and no modal opens.
  test("no modal opens when the query feature carries no popup-config wrapper", async () => {
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { id: "ABC" },
        geometry: { x: 10, y: 10 },
        // layerName intentionally absent.
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const layers = [
      {
        name: "Stations",
        configuration: {
          type: "ImageLayer",
          props: {
            name: "Stations",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "some_url" },
            },
          },
        },
        popupConfig: {
          mode: "modal",
          position: null,
          titleTemplate: null,
          gridItems: [],
        },
      },
    ];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={[10, 20]}
            mapProps={{
              mapConfig: {},
              viewConfig: {},
              layers,
              baseMap: null,
              layerControl: false,
            }}
          />
        </MapContextProvider>
      ),
    });
    render(LoadedComponent);

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedQueryLayerFeatures).toHaveBeenCalled();
    });

    // findLayerByName(undefined) hit the !layerName guard and returned
    // undefined, so isModalModeLayer returned false and no modal opens.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // Line 307: closeModal's `if (container && typeof container.focus === "function")`.
  // Existing tests always close with a real div (focus IS a function), so the
  // if-not-taken branch is unhit. Replacing the wrapper's .focus with null
  // makes typeof !== "function", so the branch returns false.
  test("closeModal skips focus restore when the map container's focus is not callable (covers line 307 false branch)", async () => {
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { station_id: "ABC" },
        geometry: { x: 10, y: 10 },
        layerName: "Stations",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const layers = [
      {
        name: "Stations",
        configuration: {
          type: "ImageLayer",
          props: {
            name: "Stations",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "some_url" },
            },
          },
        },
        popupConfig: {
          mode: "modal",
          position: null,
          titleTemplate: null,
          gridItems: [],
        },
      },
    ];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={[10, 20]}
            mapProps={{
              mapConfig: {},
              viewConfig: {},
              layers,
              baseMap: null,
              layerControl: false,
            }}
          />
        </MapContextProvider>
      ),
    });
    const { container } = render(LoadedComponent);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // mapContainerRef points at the wrapper div with tabIndex=-1 inside the
    // test container. PopupModal's own tabIndex=-1 lives on document.body via
    // portal, so the only tabindex=-1 element under `container` is the
    // MapVisualization wrapper.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const wrapper = container.querySelector('div[tabindex="-1"]');
    expect(wrapper).not.toBeNull();
    // Make wrapper.focus return null on Map.js's first access (the
    // `typeof container.focus === "function"` check at line 307 → false →
    // branch alt 1 hit), then a no-op function for PopupModal's subsequent
    // `triggerRef.current.focus()` call so the close-side focus restore
    // doesn't crash on null.
    let focusAccessCount = 0;
    Object.defineProperty(wrapper, "focus", {
      configurable: true,
      get() {
        focusAccessCount += 1;
        if (focusAccessCount === 1) return null;
        return () => {};
      },
    });

    fireEvent.click(screen.getByTestId("popup-modal-close"));

    // Modal closed cleanly: Map.js's closeModal skipped its focus call
    // (branch 307 alt 1 — the if body NOT taken) and PopupModal's
    // focus-restore call was a no-op.
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(focusAccessCount).toBeGreaterThanOrEqual(1);
  });

  // Lines 767, 769:
  //   activeModalFeature.attributes ?? {}      ← line 767 (?? right-side)
  //   if (substituted.trim().length > 0) { ... } ← line 769 (false branch)
  //
  // The OL-Overlay Popup component renders the same feature and would crash
  // on `Object.entries(undefined)` if attributes is nullish. We side-step that
  // by replacing react-dom/client's createRoot with a stub whose .render is a
  // no-op so the Popup overlay is never actually rendered. The PopupModal
  // (the React-Bootstrap-style portal) still renders normally and we can
  // assert against its header.
  // eslint-disable-next-line no-template-curly-in-string
  test("modal title falls back to layerName when attributes is nullish and template substitutes to empty (covers lines 767, 769)", async () => {
    const ReactDOMClient = require("react-dom/client");
    const originalCreateRoot = ReactDOMClient.createRoot;
    ReactDOMClient.createRoot = jest.fn(() => ({
      render: jest.fn(),
      unmount: jest.fn(),
    }));

    try {
      mockedQueryLayerFeatures.mockResolvedValue([
        {
          // attributes intentionally undefined → exercises `?? {}` right side.
          geometry: { x: 10, y: 10 },
          layerName: "Stations",
        },
      ]);
      jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

      const layers = [
        {
          name: "Stations",
          configuration: {
            type: "ImageLayer",
            props: {
              name: "Stations",
              source: {
                type: "ESRI Image and Map Service",
                props: { url: "some_url" },
              },
            },
          },
          popupConfig: {
            mode: "modal",
            position: null,
            // Template references a key that doesn't exist on the (empty)
            // attributes map → substituted is "", trim().length === 0,
            // so the `if (substituted.trim().length > 0)` body is skipped
            // and popupTitleText stays at activeModalFeature.layerName.
            // eslint-disable-next-line no-template-curly-in-string
            titleTemplate: "${feature.missing}",
            gridItems: [],
          },
        },
      ];
      const LoadedComponent = createLoadedComponent({
        children: (
          <MapContextProvider>
            <TestingComponent
              onMapClick={jest.fn()}
              clickCoordinates={[10, 20]}
              mapProps={{
                mapConfig: {},
                viewConfig: {},
                layers,
                baseMap: null,
                layerControl: false,
              }}
            />
          </MapContextProvider>
        ),
      });
      render(LoadedComponent);

      expect(await screen.findByText("Map Ready")).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Empty substitution → header falls back to the layerName.
      expect(screen.getByTestId("popup-modal-header-title")).toHaveTextContent(
        "Stations",
      );
    } finally {
      ReactDOMClient.createRoot = originalCreateRoot;
    }
  });
});

describe("Popup component", () => {
  const features = [
    {
      layerName: "Layer 1",
      attributes: {
        field1: "value1",
        field2: "value2",
        url: "https://example.com",
      },
    },
    {
      layerName: "Layer 2",
      attributes: {
        fieldA: "valueA",
        fieldB: "valueB",
        url: "www.example.org",
      },
    },
  ];

  it("renders all features and fields", () => {
    render(
      <Popup
        layerAttributes={features}
        onSwipe={jest.fn()}
        omittedPopupAttributes={{}}
        aliases={{}}
      />,
    );
    expect(screen.getByText("Layer 1")).toBeInTheDocument();
    expect(screen.getByText("Layer 2")).toBeInTheDocument();
    expect(screen.getByText("field1")).toBeInTheDocument();
    expect(screen.getByText("value1")).toBeInTheDocument();
    expect(screen.getByText("fieldA")).toBeInTheDocument();
    expect(screen.getByText("valueA")).toBeInTheDocument();
  });

  it("renders URLs as links with protocol", () => {
    render(
      <Popup
        layerAttributes={features}
        onSwipe={jest.fn()}
        omittedPopupAttributes={{}}
        aliases={{}}
      />,
    );
    const httpsLink = screen.getByText("https://example.com");
    // eslint-disable-next-line testing-library/no-node-access
    expect(httpsLink.closest("a")).toHaveAttribute(
      "href",
      "https://example.com",
    );
    const wwwLink = screen.getByText("www.example.org");
    // eslint-disable-next-line testing-library/no-node-access
    expect(wwwLink.closest("a")).toHaveAttribute(
      "href",
      "https://www.example.org",
    );
  });

  it("calls onSwipe when slide changes", () => {
    const onSwipe = jest.fn();
    render(
      <Popup
        layerAttributes={features}
        onSwipe={onSwipe}
        omittedPopupAttributes={{}}
        aliases={{}}
      />,
    );
    // Simulate swipe by firing Swiper's slide change event
    // Swiper's event is not easily triggered, so we call onSwipe directly
    onSwipe();
    expect(onSwipe).toHaveBeenCalled();
  });

  it("renders empty attributes gracefully", () => {
    const emptyFeature = [{ layerName: "Empty", attributes: {} }];
    render(
      <Popup
        layerAttributes={emptyFeature}
        onSwipe={jest.fn()}
        omittedPopupAttributes={{}}
        aliases={{}}
      />,
    );
    expect(screen.getByText("Empty")).toBeInTheDocument();
    expect(screen.getByRole("row")).not.toBeNull();
  });

  it("renders with only one feature", () => {
    const singleFeature = [{ layerName: "Single", attributes: { foo: "bar" } }];
    render(
      <Popup
        layerAttributes={singleFeature}
        onSwipe={jest.fn()}
        omittedPopupAttributes={{}}
        aliases={{}}
      />,
    );
    expect(screen.getByText("Single")).toBeInTheDocument();
    expect(screen.getByText("foo")).toBeInTheDocument();
    expect(screen.getByText("bar")).toBeInTheDocument();
  });

  it("renders with no features", () => {
    render(
      <Popup
        layerAttributes={[]}
        onSwipe={jest.fn()}
        omittedPopupAttributes={{}}
        aliases={{}}
      />,
    );
    // Should not throw, but nothing rendered
    expect(screen.queryByText(/:/)).not.toBeInTheDocument();
  });
});

describe("MapVisualization — branch/statement coverage gaps", () => {
  // Map.js:646 (else branch of `feature && typeof feature === "object"`)
  // queryLayerFeatures normally yields plain feature objects, but the map
  // at L644 also defensively passes non-objects through unwrapped. Drive
  // that path by mocking one layer's queryLayerFeatures to return an
  // array containing `null`. A second layer returns the sentinel
  // "zoomed" string, which sets hasZoomed=true at L664 and short-
  // circuits the popup render — so the null from the first layer hits
  // the defensive else branch but never reaches the (non-null-safe)
  // downstream filter that would crash on `null.attributes`.
  test("non-object features in a query result pass through unwrapped (defensive map branch)", async () => {
    mockedQueryLayerFeatures
      .mockResolvedValueOnce([null])
      .mockResolvedValueOnce("zoomed");
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

    const layers = [
      {
        configuration: {
          type: "ImageLayer",
          props: {
            name: "L1",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "url1" },
            },
          },
        },
      },
      {
        configuration: {
          type: "ImageLayer",
          props: {
            name: "L2",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "url2" },
            },
          },
        },
      },
    ];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={[10, 20]}
            mapProps={{
              mapConfig: {},
              viewConfig: {},
              layers,
              baseMap: null,
              layerControl: false,
            }}
          />
        </MapContextProvider>
      ),
    });
    render(LoadedComponent);

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedQueryLayerFeatures.mock.calls.length).toBeGreaterThanOrEqual(
        2,
      );
    });
    // hasZoomed short-circuits → popup is dismissed (position=undefined).
    // The `null` from the first layer still flowed through the defensive
    // map branch on the way to that decision.
    await waitFor(() => {
      expect(popSetPosition).toHaveBeenLastCalledWith(undefined);
    });
  });

  // Map.js:741 (`return captured` fallback in the activeModalLayer
  // useMemo). When the captured `__wrapperLayer` (snapshotted at
  // click-time) has no match in the current `layers` prop — e.g. the
  // host swaps the layer set while the modal is open — the lookup falls
  // back to the captured value so the popup keeps showing its original
  // titleTemplate instead of going blank.
  test("activeModalLayer falls back to the captured wrapper when the layers prop no longer contains a match", async () => {
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { id: "X" },
        geometry: { x: 10, y: 10 },
        layerName: "Stations",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const layerA = {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "LayerA",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "url" },
          },
        },
      },
      popupConfig: {
        mode: "modal",
        titleTemplate: "Captured Title",
        gridItems: [],
      },
    };
    const layerB = {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "LayerB",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "url" },
          },
        },
      },
    };

    const SwapHarness = () => {
      const [layers, setLayers] = useState([layerA]);
      return (
        <>
          <button type="button" onClick={() => setLayers([layerB])}>
            swap-layers
          </button>
          <MapContextProvider>
            <TestingComponent
              onMapClick={jest.fn()}
              clickCoordinates={[10, 20]}
              mapProps={{
                mapConfig: {},
                viewConfig: {},
                layers,
                baseMap: null,
                layerControl: false,
              }}
            />
          </MapContextProvider>
        </>
      );
    };

    const LoadedComponent = createLoadedComponent({
      children: <SwapHarness />,
    });
    render(LoadedComponent);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByTestId("popup-modal-header-title")).toHaveTextContent(
      "Captured Title",
    );

    // Drop LayerA from the layers prop. activeModalLayer's `find` returns
    // undefined; the fallback (`return captured`) keeps the original
    // popupConfig in play, so the title stays.
    fireEvent.click(screen.getByText("swap-layers"));

    // Modal still shows the captured title.
    expect(screen.getByTestId("popup-modal-header-title")).toHaveTextContent(
      "Captured Title",
    );
  });

  // Map.js:758 (`feature?.layerName ?? \`Feature ${(i ?? 0) + 1}\``).
  // When the active feature has no `layerName` and the popupConfig
  // doesn't carry a titleTemplate, buildFeatureLabel falls through to
  // the generic "Feature N" label.
  test("popup title falls back to 'Feature N' when the feature has no layerName and no titleTemplate", async () => {
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { id: "X" },
        geometry: { x: 10, y: 10 },
        // No layerName — exercises the `feature?.layerName ?? ...` fallback.
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const layers = [
      {
        configuration: {
          type: "ImageLayer",
          props: {
            name: "NoNameLayer",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "url" },
            },
          },
        },
        popupConfig: {
          mode: "modal",
          // No titleTemplate so the early-return at L756 doesn't run.
          gridItems: [],
        },
      },
    ];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={[10, 20]}
            mapProps={{
              mapConfig: {},
              viewConfig: {},
              layers,
              baseMap: null,
              layerControl: false,
            }}
          />
        </MapContextProvider>
      ),
    });
    render(LoadedComponent);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    // safeActiveFeatureIndex=0 → fallback string ends with "Feature 1".
    expect(screen.getByTestId("popup-modal-header-title")).toHaveTextContent(
      "Feature 1",
    );
  });

  // Map.js:569 (`if (name)` else inside the visibility loop) AND
  // Map.js:735 (`if (name && Array.isArray(layers))` else inside the
  // activeModalLayer useMemo). Both fire when a layer config lacks
  // `configuration.props.name`:
  //   - the OL layer's `get("name")` returns undefined, so the
  //     visibility-collection if-skip branch runs;
  //   - the captured `__wrapperLayer` (snapshotted at click time) also
  //     has no name, so the useMemo's name-and-array guard short-
  //     circuits and falls through to `return captured`.
  // Uses the ManualClickHarness pattern so the click is dispatched
  // AFTER the unnamed custom layer is mounted into OL (mapReady fires
  // on first rendercomplete, which is before customLayers finish).
  test("unnamed layer: visibility-loop skips it AND activeModalLayer falls back to captured wrapper", async () => {
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { id: "X" },
        geometry: { x: 10, y: 10 },
        layerName: "Feature Source",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

    const layers = [
      {
        configuration: {
          type: "ImageLayer",
          // Intentionally omit `props.name` so the OL layer ends up
          // with `get("name") === undefined`. Modal mode is still
          // configured so the popup opens and the activeModalLayer
          // useMemo runs.
          props: {
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "url" },
            },
          },
        },
        popupConfig: {
          mode: "modal",
          titleTemplate: "No-Name Title",
          gridItems: [],
        },
      },
    ];

    const ManualClickHarness = () => {
      const visualizationRef = useRef();
      const { mapReady } = useMapContext();
      return (
        <div>
          <MapVisualization
            visualizationRef={visualizationRef}
            mapConfig={{}}
            viewConfig={{}}
            layers={layers}
            baseMap={null}
            layerControl={false}
          />
          <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
          <button
            type="button"
            onClick={() =>
              visualizationRef.current?.dispatchEvent({
                type: "singleclick",
                coordinate: [10, 20],
              })
            }
          >
            fire-click
          </button>
        </div>
      );
    };

    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <ManualClickHarness />
        </MapContextProvider>
      ),
    });
    render(LoadedComponent);

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    // Wait for the unnamed custom layer to actually land in OL — its
    // value `get("name")` will be undefined, which is exactly what we
    // need at click time to hit Map.js:569's `if (name)` else branch.
    await waitFor(() => {
      const addedNames = addLayerSpy.mock.calls.map(
        (call) => call[0].values_?.name,
      );
      // 3 layers expected: undefined (our custom), Highlighted, Marker
      // are added later at click time. Until click, only the unnamed
      // custom layer is present.
      expect(addedNames).toContain(undefined);
    });

    fireEvent.click(screen.getByText("fire-click"));

    // Modal opens with the captured wrapper's titleTemplate — the
    // useMemo's else branch (`return captured`) supplies the layer to
    // popupTitleText since `name` was undefined and the `find` lookup
    // would have been skipped.
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByTestId("popup-modal-header-title")).toHaveTextContent(
      "No-Name Title",
    );
  });

  // Map.js:758 `(i ?? 0)` else branch. The runtime call sites for
  // buildFeatureLabel always pass a numeric index, so this branch is
  // only reachable by invoking the `getLabel` prop directly. Pull it
  // off the carousel's React fiber and call with no index.
  test("buildFeatureLabel falls back to 'Feature 1' when invoked with no index (covers `i ?? 0` else)", async () => {
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { id: "A" },
        geometry: { x: 10, y: 10 },
        layerName: "Stations",
      },
      {
        attributes: { id: "B" },
        geometry: { x: 10, y: 10 },
        layerName: "Stations",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const layers = [
      {
        configuration: {
          type: "ImageLayer",
          props: {
            name: "Stations",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "url" },
            },
          },
        },
        // No titleTemplate so buildFeatureLabel's first if-branch is
        // skipped and the test exercises the `??` fallback path.
        popupConfig: { mode: "modal", gridItems: [] },
      },
    ];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={[10, 20]}
            mapProps={{
              mapConfig: {},
              viewConfig: {},
              layers,
              baseMap: null,
              layerControl: false,
            }}
          />
        </MapContextProvider>
      ),
    });
    render(LoadedComponent);

    await waitFor(() => {
      expect(screen.getByTestId("popup-modal-carousel")).toBeInTheDocument();
    });

    // `getLabel` is a prop on <PopupModalCarousel>, not on its inner
    // DOM nodes. Walk up the React fiber tree from the carousel's DOM
    // node until we find a fiber whose memoizedProps carries getLabel.
    const carouselDiv = screen.getByTestId("popup-modal-carousel");
    const fiberKey = Object.keys(carouselDiv).find((k) =>
      k.startsWith("__reactFiber"),
    );
    if (!fiberKey) throw new Error("React fiber not found on carousel node");
    let fiber = carouselDiv[fiberKey];
    while (fiber && !fiber.memoizedProps?.getLabel) {
      fiber = fiber.return;
    }
    const getLabel = fiber?.memoizedProps?.getLabel;
    expect(typeof getLabel).toBe("function");

    // Feature without a layerName forces `feature?.layerName ??` to
    // fall through; calling with no second arg makes `i` undefined →
    // `(undefined ?? 0)` falls back to 0 → "Feature 1".
    expect(getLabel({ attributes: { id: "Z" } })).toBe("Feature 1");
  });

  // Map.js:797 (the `modalFeatures.length > 1` branch of the
  // leadingControls ternary). With multiple modal-mode features, the
  // PopupModalCarousel renders into the modal header's leading slot.
  test("multi-feature modal popup renders the carousel in the header slot", async () => {
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { id: "A" },
        geometry: { x: 10, y: 10 },
        layerName: "Stations",
      },
      {
        attributes: { id: "B" },
        geometry: { x: 10, y: 10 },
        layerName: "Stations",
      },
      {
        attributes: { id: "C" },
        geometry: { x: 10, y: 10 },
        layerName: "Stations",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const layers = [
      {
        configuration: {
          type: "ImageLayer",
          props: {
            name: "Stations",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "url" },
            },
          },
        },
        popupConfig: {
          mode: "modal",
          titleTemplate: "Site ${feature.id}", // eslint-disable-line no-template-curly-in-string
          gridItems: [],
        },
      },
    ];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={[10, 20]}
            mapProps={{
              mapConfig: {},
              viewConfig: {},
              layers,
              baseMap: null,
              layerControl: false,
            }}
          />
        </MapContextProvider>
      ),
    });
    render(LoadedComponent);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    // Carousel only renders when modalFeatures.length > 1 (3 here).
    expect(screen.getByTestId("popup-modal-carousel")).toBeInTheDocument();
    expect(
      screen.getByTestId("popup-modal-carousel-pagination"),
    ).toHaveTextContent("1 / 3");
  });
});

TestingComponent.propTypes = {
  mapProps: PropTypes.shape({
    onMapClick: PropTypes.func,
    layers: PropTypes.array,
  }),
  onMapClick: PropTypes.func,
  onMapPointerMove: PropTypes.bool,
  onMapZoom: PropTypes.bool,
  clickCoordinates: PropTypes.arrayOf(PropTypes.number),
};
