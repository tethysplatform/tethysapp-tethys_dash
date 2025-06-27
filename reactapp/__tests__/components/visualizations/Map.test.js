import { useRef, useEffect } from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import MapVisualization from "components/visualizations/Map";
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
  mockedDashboards,
} from "__tests__/utilities/constants";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";

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
          onMapClick={true}
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
    addLayerSpy.mock.calls[2][0].getSource() instanceof ImageArcGISRest
  ).toBe(true);

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
  ).toStrictEqual(clickCoordinates);

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
      <MapContextProvider>
        <TestingComponent
          onMapClick={true}
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
          onMapClick={true}
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
          onMapClick={true}
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

  expect(addLayerSpy.mock.calls[0][0].values_.name).toBe("ClickMarkerLayer");
  expect(addLayerSpy.mock.calls[1][0].values_.name).toBe(
    "ClickHighlighterLayer"
  );
  expect(addLayerSpy.mock.calls[2][0].values_.name).toBe("NWC not queryable");
  expect(addLayerSpy.mock.calls[3][0].values_.name).toBe("NWC");

  expect(mockedQueryLayerFeatures.mock.calls.length).toBe(1);
  expect(
    mockedQueryLayerFeatures.mock.calls[0][0].configuration.props.name
  ).toBe("NWC");
});

test("Map click no attributes found", async () => {
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
          onMapClick={true}
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
  expect(await screen.findByText("No Attributes Found")).toBeInTheDocument();

  const popupCloser = await screen.findByLabelText("Popup Closer");
  fireEvent.click(popupCloser);
  expect(screen.queryByText("No Attributes Found")).not.toBeInTheDocument();
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
          onMapClick={true}
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

test("Map click attribute variables update text variable input", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "some value" },
      geometry: { x: 10, y: 10 },
      layerName: "Some Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");
  const handleChange = jest.fn();
  const dashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  dashboard.gridItems = [mockedTextVariable];
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
          onMapClick={true}
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
    options: { dashboards: { user: [dashboard], public: [] } },
  });
  render(LoadedComponent);

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "" })
  );

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  // popup
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates);
  });

  expect(await screen.findByText("Some Layer")).toBeInTheDocument();
  expect(await screen.findByText("Field")).toBeInTheDocument();
  expect(await screen.findByText("Value")).toBeInTheDocument();
  expect(await screen.findByText("field1")).toBeInTheDocument();
  expect(await screen.findByText("some value")).toBeInTheDocument();

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Test Variable": "some value",
    })
  );
  const variableInput = screen.getByRole("textbox");
  await waitFor(() => {
    expect(variableInput.value).toBe("some value");
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
  const dashboard = JSON.parse(JSON.stringify(mockedDashboards.user[0]));
  dashboard.gridItems = [mockedDropdownVariable];
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
          onMapClick={true}
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
      dashboards: { user: [dashboard], public: [] },
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

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Test Variable": "FTDC1",
    })
  );
  await waitFor(async () => {
    expect(
      screen.getByText("FTDC1 - SMITH RIVER - DOCTOR FINE BRIDGE")
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
          onMapClick={true}
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
    JSON.stringify({})
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
    JSON.stringify({})
  );
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
          onMapClick={true}
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
          onMapClick={true}
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
    addLayerSpy.mock.calls[0][0].getSource() instanceof ImageArcGISRest
  ).toBe(true);
  expect(popSetPosition).toHaveBeenCalledTimes(0);
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
    await screen.findByText(/Lon: 10.00, Lat: 20.00/i)
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
    await screen.findByText(/Lon: -10686671.12, Lat: 4721671.57/i)
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
  mapProps: PropTypes.shape({
    onMapClick: PropTypes.func,
    layers: PropTypes.array,
  }),
  onMapClick: PropTypes.func,
  onMapPointerMove: PropTypes.bool,
  onMapZoom: PropTypes.bool,
  clickCoordinates: PropTypes.arrayOf(PropTypes.string),
};
