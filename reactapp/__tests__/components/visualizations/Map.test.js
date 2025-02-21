import { useRef, useState, useEffect, act } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MapVisualization from "components/visualizations/Map";
import createLoadedComponent, {
  InputVariablePComponent,
} from "__tests__/utilities/customRender";
import PropTypes from "prop-types";
import { Map } from "ol";
import ImageArcGISRest from "ol/source/ImageArcGISRest.js";
import { Vector as VectorSource } from "ol/source.js";
import appAPI from "services/api/app";
import { applyStyle } from "ol-mapbox-style";
import Point from "ol/geom/Point.js";
import { queryLayerFeatures } from "components/map/utilities";
import Overlay from "ol/Overlay";

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

const TestingComponent = ({
  expectedLayerCount,
  onMapClick,
  clickCoordinates,
  mapProps,
}) => {
  const visualizationRef = useRef();
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setMapReady(false);

    const fetchMapData = () => {
      if (visualizationRef.current) {
        const mapLayers = visualizationRef.current
          .getLayers()
          .getArray()
          .map((item) => item.get("name"));
        if (
          !expectedLayerCount ||
          !mapProps.layers ||
          mapLayers.length === expectedLayerCount
        ) {
          if (isMounted) {
            setMapReady(true);
          }
        } else {
          // Simulate fetching data
          setTimeout(fetchMapData, 1000);
        }
      } else {
        // Simulate fetching data
        setTimeout(fetchMapData, 1000);
      }
    };

    fetchMapData();

    return () => {
      isMounted = false; // Prevent setting state on unmounted component
    };
    // eslint-disable-next-line
  }, [mapProps]);

  useEffect(() => {
    if (onMapClick && mapReady) {
      var evt = {};
      evt.type = "singleclick";
      evt.coordinate = [];
      evt.coordinate[0] = clickCoordinates[0];
      evt.coordinate[1] = clickCoordinates[1];
      visualizationRef.current.dispatchEvent(evt);
    }
    // eslint-disable-next-line
  }, [mapReady, clickCoordinates]);

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
      <TestingComponent
        expectedLayerCount={1}
        mapProps={{
          mapConfig: {},
          viewConfig: {},
          layers: [],
          baseMap,
          layerControl: true,
        }}
      />
    ),
  });
  const { rerender } = render(LoadedComponent);

  const mapDiv = await screen.findByLabelText("Map Div");
  expect(mapDiv).toBeInTheDocument();
  expect(mapDiv).toHaveStyle("width: 100%");

  const mapPopup = await screen.findByLabelText("Map Popup");
  expect(mapPopup).toBeInTheDocument();

  const mapPopupContent = await screen.findByLabelText("Map Popup Content");
  expect(mapPopupContent).toBeInTheDocument();
  // eslint-disable-next-line
  expect(mapPopupContent.children.length).toBe(0);

  expect(screen.queryByLabelText("Map Legend")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Show Layers Control")).toBeInTheDocument();

  // should only add basemap
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  expect(addLayerSpy.mock.calls[0][0].getSource().key_).toBe(
    "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
  );

  addLayerSpy.mockClear(); // Reset the call count
  const newLayers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ImageArcGISRest",
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
      <TestingComponent
        expectedLayerCount={1}
        mapProps={{
          mapConfig: {},
          viewConfig: {},
          layers: newLayers,
          baseMap: null,
          layerControl: true,
        }}
      />
    ),
  });
  rerender(NewLoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  // should only add the layer because of no basemap
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  expect(
    addLayerSpy.mock.calls[0][0].getSource() instanceof ImageArcGISRest
  ).toBe(true);
});

test("Map GeoJSON with legend and style", async () => {
  const mockDownloadJSON = jest.fn();
  appAPI.downloadJSON = mockDownloadJSON;
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
      },
      style: "some_style_file.json",
      legend: {
        title: "Some Title",
        items: [{ label: "Some Label", color: "green", symbol: "square" }],
      },
    },
  ];
  const LoadedComponent = createLoadedComponent({
    children: (
      <TestingComponent
        expectedLayerCount={1}
        mapProps={{
          mapConfig: {},
          viewConfig: {},
          layers,
          baseMap: null,
          layerControl: false,
        }}
      />
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  await waitFor(
    async () => {
      expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    },
    { timeout: 2000 }
  );

  // should only add the layer because of no basemap
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  expect(addLayerSpy.mock.calls[0][0].getSource() instanceof VectorSource).toBe(
    true
  );
  expect(
    addLayerSpy.mock.calls[0][0]
      .getSource()
      .getFeatures()[0]
      .getGeometry() instanceof Point
  ).toBe(true);
  expect(mockedApplyStyle).toHaveBeenCalledTimes(1);
});

test("Map click", async () => {
  const mockMapClick = jest.fn();
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

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ImageArcGISRest",
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
      <TestingComponent
        expectedLayerCount={1}
        onMapClick={mockMapClick}
        clickCoordinates={clickCoordinates}
        mapProps={{
          mapConfig: {},
          viewConfig: {},
          layers,
          baseMap: null,
          layerControl: false,
        }}
      />
    ),
  });
  const { rerender } = render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  await waitFor(
    async () => {
      expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    },
    { timeout: 2000 }
  );

  // layer, marker, and highlight layer
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(3);
  });
  await waitFor(() => {
    expect(removeLayerSpy.mock.calls.length).toBe(0);
  });

  expect(
    addLayerSpy.mock.calls[0][0].getSource() instanceof ImageArcGISRest
  ).toBe(true);

  // marker layer
  expect(addLayerSpy.mock.calls[1][0].getSource() instanceof VectorSource).toBe(
    true
  );
  expect(
    addLayerSpy.mock.calls[1][0]
      .getSource()
      .getFeatures()[0]
      .getGeometry()
      .getCoordinates()
  ).toStrictEqual(clickCoordinates);

  // highlight layer
  expect(addLayerSpy.mock.calls[2][0].getSource() instanceof VectorSource).toBe(
    true
  );
  expect(
    addLayerSpy.mock.calls[2][0]
      .getSource()
      .getFeatures()[0]
      .getGeometry()
      .getCoordinates()
  ).toStrictEqual([
    [0, 0],
    [0, 1],
  ]);

  // popup
  expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates);

  expect(await screen.findByText("Some Layer")).toBeInTheDocument();
  expect(await screen.findByText("Field")).toBeInTheDocument();
  expect(await screen.findByText("Value")).toBeInTheDocument();
  expect(await screen.findByText("field1")).toBeInTheDocument();
  expect(await screen.findByText("some value")).toBeInTheDocument();

  addLayerSpy.mockClear(); // Reset the call count
  const newClickCoordinates = [20, 10];
  const NewLoadedComponent = createLoadedComponent({
    children: (
      <TestingComponent
        expectedLayerCount={3}
        onMapClick={mockMapClick}
        clickCoordinates={newClickCoordinates}
        mapProps={{
          mapConfig: {},
          viewConfig: {},
          layers,
          baseMap: null,
          layerControl: false,
        }}
      />
    ),
  });
  rerender(NewLoadedComponent);

  // new marker and new highlight layer
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(2);
  });
  // remove old marker and highlight layer
  await waitFor(() => {
    expect(removeLayerSpy.mock.calls.length).toBe(2);
  });

  // marker layer
  expect(addLayerSpy.mock.calls[0][0].getSource() instanceof VectorSource).toBe(
    true
  );
  expect(
    addLayerSpy.mock.calls[0][0]
      .getSource()
      .getFeatures()[0]
      .getGeometry()
      .getCoordinates()
  ).toStrictEqual(newClickCoordinates);

  // highlight layer
  expect(addLayerSpy.mock.calls[1][0].getSource() instanceof VectorSource).toBe(
    true
  );
  expect(
    addLayerSpy.mock.calls[1][0]
      .getSource()
      .getFeatures()[0]
      .getGeometry()
      .getCoordinates()
  ).toStrictEqual([
    [0, 0],
    [0, 1],
  ]);
});

test("Map click no attributes found", async () => {
  const mockMapClick = jest.fn();
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
            type: "ImageArcGISRest",
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
      <TestingComponent
        expectedLayerCount={1}
        onMapClick={mockMapClick}
        clickCoordinates={clickCoordinates}
        mapProps={{
          mapConfig: {},
          viewConfig: {},
          layers,
          baseMap: null,
          layerControl: false,
        }}
      />
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  await waitFor(
    async () => {
      expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    },
    { timeout: 2000 }
  );
  expect(popSetPosition).toHaveBeenLastCalledWith(clickCoordinates);
  expect(await screen.findByText("No Attributes Found")).toBeInTheDocument();
});

test("Map click all attributes omitted", async () => {
  const mockMapClick = jest.fn();
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
            type: "ImageArcGISRest",
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
      <TestingComponent
        expectedLayerCount={1}
        onMapClick={mockMapClick}
        clickCoordinates={clickCoordinates}
        mapProps={{
          mapConfig: {},
          viewConfig: {},
          layers,
          baseMap: null,
          layerControl: false,
        }}
      />
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  await waitFor(
    async () => {
      expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    },
    { timeout: 2000 }
  );
  expect(popSetPosition).toHaveBeenLastCalledWith(undefined);
});

test("Map click attribute variables", async () => {
  const mockMapClick = jest.fn();
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
            type: "ImageArcGISRest",
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
      <TestingComponent
        expectedLayerCount={1}
        onMapClick={mockMapClick}
        clickCoordinates={clickCoordinates}
        mapProps={{
          mapConfig: {},
          viewConfig: {},
          layers,
          baseMap: null,
          layerControl: false,
        }}
      />
    ),
  });
  render(LoadedComponent);
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({})
  );

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  await waitFor(
    async () => {
      expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    },
    { timeout: 2000 }
  );
  // popup
  expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates);

  expect(await screen.findByText("Some Layer")).toBeInTheDocument();
  expect(await screen.findByText("Field")).toBeInTheDocument();
  expect(await screen.findByText("Value")).toBeInTheDocument();
  expect(await screen.findByText("field1")).toBeInTheDocument();
  expect(await screen.findByText("some value")).toBeInTheDocument();

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Some Variable": "some value",
    })
  );
});

test("Map click attribute variables Null values", async () => {
  const mockMapClick = jest.fn();
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
            type: "ImageArcGISRest",
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
      <TestingComponent
        expectedLayerCount={1}
        onMapClick={mockMapClick}
        clickCoordinates={clickCoordinates}
        mapProps={{
          mapConfig: {},
          viewConfig: {},
          layers,
          baseMap: null,
          layerControl: false,
        }}
      />
    ),
  });
  render(LoadedComponent);
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({})
  );

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  await waitFor(
    async () => {
      expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    },
    { timeout: 2000 }
  );
  // popup
  expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates);

  expect(await screen.findByText("Some Layer")).toBeInTheDocument();
  expect(await screen.findByText("Field")).toBeInTheDocument();
  expect(await screen.findByText("Value")).toBeInTheDocument();
  expect(await screen.findByText("field1")).toBeInTheDocument();
  expect(await screen.findByText("Null")).toBeInTheDocument();

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({})
  );
});

test("Map click query error", async () => {
  const mockMapClick = jest.fn();
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
            type: "ImageArcGISRest",
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
      <TestingComponent
        expectedLayerCount={1}
        onMapClick={mockMapClick}
        clickCoordinates={clickCoordinates}
        mapProps={{
          mapConfig: {},
          viewConfig: {},
          layers,
          baseMap: null,
          layerControl: false,
        }}
      />
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  await waitFor(
    async () => {
      expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    },
    { timeout: 2000 }
  );
  expect(popSetPosition).toHaveBeenLastCalledWith(clickCoordinates);
  expect(await screen.findByText("No Attributes Found")).toBeInTheDocument();
});

test("Map click not happen in dataviewer mode", async () => {
  const mockMapClick = jest.fn();

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ImageArcGISRest",
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
      <TestingComponent
        expectedLayerCount={1}
        onMapClick={mockMapClick}
        clickCoordinates={clickCoordinates}
        mapProps={{
          mapConfig: {},
          viewConfig: {},
          layers,
          baseMap: null,
          layerControl: false,
        }}
      />
    ),
    options: {
      inDataViewerMode: true,
    },
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  await waitFor(
    async () => {
      expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    },
    { timeout: 2000 }
  );

  expect(mockMapClick).toHaveBeenCalledTimes(0);
});

test("Map bad basemap", async () => {
  const baseMap = "some bad basemap";
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const consoleErrorSpy = jest.spyOn(console, "error");

  const LoadedComponent = createLoadedComponent({
    children: (
      <TestingComponent
        expectedLayerCount={0}
        mapProps={{
          mapConfig: {},
          viewConfig: {},
          layers: [],
          baseMap,
          layerControl: true,
        }}
      />
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  await waitFor(
    async () => {
      expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    },
    { timeout: 2000 }
  );

  // no basemap added
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(0);
  });
  expect(consoleErrorSpy).toHaveBeenCalledWith(
    "some bad basemap is not a valid basemap"
  );
});

test("Map bad GeoJSON", async () => {
  const mockDownloadJSON = jest.fn();
  appAPI.downloadJSON = mockDownloadJSON;
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
      <TestingComponent
        expectedLayerCount={0}
        mapProps={{
          mapConfig: {},
          viewConfig: {},
          layers,
          baseMap: null,
          layerControl: false,
        }}
      />
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  await waitFor(
    async () => {
      expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    },
    { timeout: 2000 }
  );

  // no geojson added
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(0);
  });
  expect(
    await screen.findByText('Failed to load the "GeoJSON Layer" layer(s)')
  ).toBeInTheDocument();
});

test("Map bad style", async () => {
  const mockDownloadJSON = jest.fn();
  appAPI.downloadJSON = mockDownloadJSON;
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
      },
      style: "some_style_file.json",
    },
  ];
  const LoadedComponent = createLoadedComponent({
    children: (
      <TestingComponent
        expectedLayerCount={0}
        mapProps={{
          mapConfig: {},
          viewConfig: {},
          layers,
          baseMap: null,
          layerControl: false,
        }}
      />
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  await waitFor(
    async () => {
      expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    },
    { timeout: 2000 }
  );

  // should only add the geojson
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  expect(addLayerSpy.mock.calls[0][0].getSource() instanceof VectorSource).toBe(
    true
  );
  expect(
    addLayerSpy.mock.calls[0][0]
      .getSource()
      .getFeatures()[0]
      .getGeometry() instanceof Point
  ).toBe(true);
  expect(mockedApplyStyle).toHaveBeenCalledTimes(0);
  expect(consoleErrorSpy).toHaveBeenCalledWith(
    "Failed to load the style for GeoJSON Layer layer"
  );
});

TestingComponent.propTypes = {
  expectedLayerCount: PropTypes.number,
  mapProps: PropTypes.shape({
    onMapClick: PropTypes.func,
    layers: PropTypes.array,
  }),
};
