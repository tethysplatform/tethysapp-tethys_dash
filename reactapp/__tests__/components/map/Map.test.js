import { useRef, useState, useEffect } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MapComponent from "components/map/Map";
import PropTypes from "prop-types";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import { Map, View } from "ol";
import { exampleStyle } from "__tests__/utilities/constants";
import { VariableInputsContext } from "components/contexts/Contexts";
import * as olMapboxStyle from "ol-mapbox-style";
import WebGLTileLayer from "ol/layer/WebGLTile";
import GeoTIFFSource from "ol/source/GeoTIFF.js";
import * as olProj from "ol/proj";

global.ResizeObserver = require("resize-observer-polyfill"); // Mock GeoTIFF source so auto-fit tests don't trigger real network fetches.

jest.mock("ol/source/GeoTIFF.js", () => {
  const ActualSource = jest.requireActual("ol/source/Source.js").default;
  const getViewSpy = jest.fn();
  class MockGeoTIFFSource extends ActualSource {
    constructor(options) {
      super({ projection: null });
      this.options = options;
    }
    getView() {
      getViewSpy();
      return Promise.resolve({
        projection: "EPSG:4326",
        extent: [-180, -90, 180, 90],
        center: [0, 0],
        zoom: 2,
      });
    }
  }
  MockGeoTIFFSource.getViewSpy = getViewSpy;
  return {
    __esModule: true,
    default: MockGeoTIFFSource,
  };
});

const TestingComponent = ({ mapProps }) => {
  const visualizationRef = useRef();
  const { mapReady } = useMapContext();
  const [view, setView] = useState();

  useEffect(() => {
    var evt = {};
    if (mapProps?.onMapClick && mapReady) {
      evt.type = "singleclick";
      evt.coordinate = [];
      evt.coordinate[0] = 6633511;
      evt.coordinate[1] = 4079902;
      visualizationRef.current.dispatchEvent(evt);
    }

    if (mapProps?.onMapMove && mapReady) {
      evt.type = "moveend";
      evt.map = visualizationRef.current;
      visualizationRef.current.dispatchEvent(evt);
    }

    if (visualizationRef.current && mapReady) {
      const newView = visualizationRef.current.getView();
      setView(
        JSON.stringify({
          zoom: newView.getZoom(),
          center: newView.getCenter(),
        }),
      );
    }
    // eslint-disable-next-line
  }, [mapProps, mapReady]);

  return (
    <div>
      <MapComponent visualizationRef={visualizationRef} {...mapProps} />
      <>
        <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
        <p data-testid="map-view">{view}</p>
      </>
    </div>
  );
};

test("Default Map", async () => {
  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  const mapDiv = await screen.findByLabelText("Map Div");
  expect(mapDiv).toBeInTheDocument();
  expect(mapDiv).toHaveStyle("width: 100%");

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(async () => {
    expect(await screen.findByTestId("map-view")).toHaveTextContent(
      JSON.stringify({
        zoom: 4.5,
        center: [-10686671.12, 4721671.57],
      }),
    );
  });

  expect(screen.queryByLabelText("Map Legend")).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Show Layers Control"),
  ).not.toBeInTheDocument();
});

test("Default Map with layer control and legend", async () => {
  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layerControl: true, legend: [] }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  expect(screen.queryByLabelText("Map Legend")).not.toBeInTheDocument();
  expect(
    await screen.findByLabelText("Show Layers Control"),
  ).toBeInTheDocument();
});

test("Custom Map Config and View Config", async () => {
  const { rerender } = render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: { style: { width: "50%" } },
            mapExtent: { extent: "-10686671.12, 4721671.57, 7" },
          }}
        />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  const mapDiv = await screen.findByLabelText("Map Div");
  expect(mapDiv).toBeInTheDocument();
  expect(mapDiv).toHaveStyle("width: 50%");
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  expect(await screen.findByTestId("map-view")).toHaveTextContent(
    JSON.stringify({
      zoom: 7,
      center: [-10686671.12, 4721671.57],
    }),
  );

  rerender(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: { style: { width: "50%" } },
            mapExtent: { extent: "-10686671.12, 4721671.57, 8" },
          }}
        />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  expect(await screen.findByTestId("map-view")).toHaveTextContent(
    JSON.stringify({
      zoom: 8,
      center: [-10686671.12, 4721671.57],
    }),
  );

  rerender(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: { style: { width: "50%" } },
            mapExtent: { extent: "-10686671.12, 4721671.57, 8" },
          }}
        />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  expect(await screen.findByTestId("map-view")).toHaveTextContent(
    JSON.stringify({
      zoom: 8,
      center: [-10686671.12, 4721671.57],
    }),
  );
});

test("Custom bounding old map extent string", async () => {
  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: { style: { width: "50%" } },
            mapExtent: "10, 20, 30, 40",
          }}
        />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  const mapDiv = await screen.findByLabelText("Map Div");
  expect(mapDiv).toBeInTheDocument();
  expect(mapDiv).toHaveStyle("width: 50%");
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  expect(await screen.findByTestId("map-view")).toHaveTextContent(
    JSON.stringify({ zoom: 19.578127880157357, center: [20, 30] }),
  );
});

test("Custom bounding box map extent", async () => {
  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: { style: { width: "50%" } },
            mapExtent: { extent: "10, 20, 30, 40" },
          }}
        />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  const mapDiv = await screen.findByLabelText("Map Div");
  expect(mapDiv).toBeInTheDocument();
  expect(mapDiv).toHaveStyle("width: 50%");
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  expect(await screen.findByTestId("map-view")).toHaveTextContent(
    JSON.stringify({ zoom: 19.578127880157357, center: [20, 30] }),
  );
});

test("Custom bounding box map extent with variable", async () => {
  const mockSetVariableInputValues = jest.fn();
  const { rerender } = render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: mockSetVariableInputValues }}
    >
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: { style: { width: "50%" } },
            mapExtent: { extent: "10, 20, 30, 40", variable: "test" },
            onMapMove: true,
          }}
        />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  const mapDiv = await screen.findByLabelText("Map Div");
  expect(mapDiv).toBeInTheDocument();
  expect(mapDiv).toHaveStyle("width: 50%");
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  await waitFor(async () => {
    expect(await screen.findByTestId("map-view")).toHaveTextContent(
      JSON.stringify({ zoom: 19.578127880157357, center: [20, 30] }),
    );
  });

  let updaterFn = mockSetVariableInputValues.mock.calls[0][0];
  let result = updaterFn({}); // simulate previousVariableInputValues = {}

  expect(result).toEqual({
    test: {
      projection: "EPSG:3857",
      geometries: [
        {
          type: "Polygon",
          coordinates: [
            [
              [10, 20],
              [10, 40],
              [30, 40],
              [30, 20],
              [10, 20],
            ],
          ],
        },
      ],
    },
  });

  rerender(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: mockSetVariableInputValues }}
    >
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: { style: { width: "50%" } },
            mapExtent: { extent: "20, 20, 30, 40", variable: "test" },
            onMapMove: true,
          }}
        />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  updaterFn = mockSetVariableInputValues.mock.calls[1][0];
  result = updaterFn({}); // simulate previousVariableInputValues = {}

  expect(result).toEqual({
    test: {
      projection: "EPSG:3857",
      geometries: [
        {
          type: "Polygon",
          coordinates: [
            [
              [15, 20],
              [15, 40],
              [35, 40],
              [35, 20],
              [15, 20],
            ],
          ],
        },
      ],
    },
  });
});

test("Map Layers and Updated Layers", async () => {
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const removeLayerSpy = jest.spyOn(Map.prototype, "removeLayer");
  const layers = [
    {
      type: "WebGLTile",
      props: {
        source: {
          type: "Image Tile",
          props: {
            url: "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          },
        },
        name: "World Light Gray Base",
        zIndex: 0,
      },
    },
    {
      type: "ImageLayer",
      props: {
        name: "esri",
        source: {
          type: "ESRI Image and Map Service",
          props: {
            url: "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",
          },
        },
        zIndex: 1,
      },
    },
  ];

  const { rerender } = render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(2);
  });
  expect(removeLayerSpy.mock.calls.length).toBe(0);

  expect(addLayerSpy.mock.calls[0][0].values_.name).toBe(
    "World Light Gray Base",
  );
  expect(addLayerSpy.mock.calls[1][0].values_.name).toBe("esri");

  let newLayers = [
    {
      type: "VectorLayer",
      props: {
        name: "GeoJSON Layer",
        source: {
          type: "GeoJSON",
          props: {},
          geojson: {
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
          },
        },
      },
      style: exampleStyle,
    },
    {
      type: "ImageLayer",
      props: {
        name: "esri",
        source: {
          type: "ESRI Image and Map Service",
          props: {
            url: "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",
          },
        },
        zIndex: 1,
      },
      layerVisibility: true,
    },
  ];
  rerender(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers: newLayers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(3);
  });
  expect(removeLayerSpy.mock.calls.length).toBe(1);

  rerender(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers: null }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(3);
  });
  expect(removeLayerSpy.mock.calls.length).toBe(3);
});

test("Map Layers  default invisible layer", async () => {
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const layers = [
    {
      type: "WebGLTile",
      props: {
        source: {
          type: "Image Tile",
          props: {
            url: "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          },
        },
        name: "World Light Gray Base",
        zIndex: 0,
      },
    },
    {
      type: "ImageLayer",
      props: {
        name: "esri",
        source: {
          type: "ESRI Image and Map Service",
          props: {
            url: "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",
          },
        },
        zIndex: 1,
      },
      layerVisibility: false,
    },
  ];

  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(2);
  });

  expect(addLayerSpy.mock.calls[0][0].values_.name).toBe(
    "World Light Gray Base",
  );
  expect(addLayerSpy.mock.calls[0][0].isVisible()).toBe(true);
  expect(addLayerSpy.mock.calls[1][0].values_.name).toBe("esri");
  expect(addLayerSpy.mock.calls[1][0].isVisible()).toBe(false);
});

test("Bad Map Layers", async () => {
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const removeLayerSpy = jest.spyOn(Map.prototype, "removeLayer");
  const layers = [
    {
      type: "WeTile",
      props: {
        source: {
          type: "Image Tile",
          props: {
            url: "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          },
        },
        name: "Base Layer",
        zIndex: 0,
      },
    },
    {
      type: "Imagayer",
      props: {
        name: "Image Layer",
        source: {
          type: "ESRI Image and Map Service",
          props: {
            url: "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",
          },
        },
        zIndex: 1,
      },
    },
  ];

  const { rerender } = render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  const warningMessage = await screen.findByText(
    'Failed to load the "Base Layer, Image Layer" layer(s)',
  );
  expect(warningMessage).toBeInTheDocument();
  const alertCloseButton = await screen.findByLabelText("Close alert");
  fireEvent.click(alertCloseButton);
  expect(
    screen.queryByText('Failed to load the "Base Layer, Image Layer" layer(s)'),
  ).not.toBeInTheDocument();

  let updatedLayers = [
    {
      type: "WebGLTile",
      props: {
        source: {
          type: "Image Tile",
          props: {
            url: "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          },
        },
        name: "World Light Gray Base",
        zIndex: 0,
      },
    },
  ];

  rerender(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers: updatedLayers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });

  expect(addLayerSpy.mock.calls[0][0].values_.name).toBe(
    "World Light Gray Base",
  );

  updatedLayers = [
    {
      type: "ImageLayer",
      props: {
        name: "esri",
        source: {
          type: "ESRI Image and Map Service",
          props: {
            url: "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",
          },
        },
        zIndex: 1,
      },
    },
  ];

  rerender(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers: updatedLayers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(2);
  });
  await waitFor(() => {
    expect(removeLayerSpy.mock.calls.length).toBe(1);
  });

  expect(addLayerSpy.mock.calls[1][0].values_.name).toBe("esri");
  expect(removeLayerSpy.mock.calls[0][0].values_.name).toBe(
    "World Light Gray Base",
  );
});

test("Map Layer JSON Style Function", async () => {
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const layers = [
    {
      type: "WebGLTile",
      props: {
        source: {
          type: "Image Tile",
          props: {
            url: "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          },
        },
        name: "World Light Gray Base",
        zIndex: 0,
      },
      style: {},
    },
  ];

  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });

  expect(addLayerSpy.mock.calls[0][0].values_.name).toBe(
    "World Light Gray Base",
  );
});

test("Map Layer mapbox style crs error message, dont do JSON style function", async () => {
  // Mock applyStyle for this test only
  const applyStyleMock = jest
    .spyOn(olMapboxStyle, "applyStyle")
    .mockImplementation(() => {
      throw new TypeError(
        "Cannot read properties of undefined (reading 'crs')",
      );
    });
  const setStyleSpy = jest.spyOn(WebGLTileLayer.prototype, "setStyle");

  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const layers = [
    {
      type: "WebGLTile",
      props: {
        source: {
          type: "Image Tile",
          props: {
            url: "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          },
        },
        name: "World Light Gray Base",
        zIndex: 0,
      },
      style: {},
    },
  ];

  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  const layer = addLayerSpy.mock.calls[0][0];
  expect(layer.values_.name).toBe("World Light Gray Base");
  expect(setStyleSpy).toHaveBeenCalledTimes(1); // only once with mapbox applyStyle

  applyStyleMock.mockRestore(); // Clean up after test
});

test("Map Layer createJsonStyleFunction returns null, style not set", async () => {
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const layers = [
    {
      type: "ImageLayer",
      props: {
        name: "esri",
        source: {
          type: "ESRI Image and Map Service",
          props: {
            url: "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",
          },
        },
        zIndex: 1,
      },
      style: {},
    },
  ];

  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  const layer = addLayerSpy.mock.calls[0][0];
  expect(layer.values_.name).toBe("esri");
  // setStyle should not be called because the layer has no setStyle function
});

test("ExtentInteraction renders when extentDrawMode is set", async () => {
  const ExtentActivator = () => {
    const { setExtentDrawMode, mapReady } = useMapContext();
    const visualizationRef = useRef();

    return (
      <div>
        <MapComponent visualizationRef={visualizationRef} />
        {mapReady && (
          <button
            data-testid="activate-extent"
            onClick={() =>
              setExtentDrawMode({
                imageUrl: "https://example.com/image.png",
                projection: "EPSG:3857",
                initialExtent: null,
              })
            }
          >
            Activate
          </button>
        )}
      </div>
    );
  };

  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <ExtentActivator />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  const activateButton = await screen.findByTestId("activate-extent");
  fireEvent.click(activateButton);

  expect(
    await screen.findByText("Draw or adjust a rectangle to place the image"),
  ).toBeInTheDocument();
});

test("Replacing a layer with same name waits for load before removing old", async () => {
  jest.useFakeTimers();
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const removeLayerSpy = jest.spyOn(Map.prototype, "removeLayer");

  const layers = [
    {
      type: "WebGLTile",
      props: {
        source: {
          type: "Image Tile",
          props: {
            url: "https://example.com/tiles/v1/{z}/{y}/{x}",
          },
        },
        name: "animated_layer",
        zIndex: 0,
      },
    },
  ];

  const { rerender } = render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  expect(removeLayerSpy.mock.calls.length).toBe(0);

  // Replace with same name but different URL — triggers double-buffering
  const updatedLayers = [
    {
      type: "WebGLTile",
      props: {
        source: {
          type: "Image Tile",
          props: {
            url: "https://example.com/tiles/v2/{z}/{y}/{x}",
          },
        },
        name: "animated_layer",
        zIndex: 0,
      },
    },
  ];

  rerender(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers: updatedLayers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  // Advance past the 5-second safety timeout so the load promise resolves
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(2);
  });
  jest.advanceTimersByTime(5100);

  await waitFor(() => {
    expect(removeLayerSpy.mock.calls.length).toBe(1);
  });

  // Old layer was removed after the new one was added
  expect(addLayerSpy.mock.calls[1][0].values_.name).toBe("animated_layer");
  expect(removeLayerSpy.mock.calls[0][0].values_.name).toBe("animated_layer");

  jest.useRealTimers();
});

test("Replacing an ImageLayer with same name uses imageloadend path", async () => {
  jest.useFakeTimers();
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const removeLayerSpy = jest.spyOn(Map.prototype, "removeLayer");

  const layers = [
    {
      type: "ImageLayer",
      props: {
        name: "esri_animated",
        source: {
          type: "ESRI Image and Map Service",
          props: {
            url: "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",
          },
        },
        zIndex: 0,
      },
    },
  ];

  const { rerender } = render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });

  // Replace with same name, different URL
  const updatedLayers = [
    {
      type: "ImageLayer",
      props: {
        name: "esri_animated",
        source: {
          type: "ESRI Image and Map Service",
          props: {
            url: "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast_v2/MapServer",
          },
        },
        zIndex: 0,
      },
    },
  ];

  rerender(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers: updatedLayers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(2);
  });

  // Trigger the safety timeout
  jest.advanceTimersByTime(5100);

  await waitFor(() => {
    expect(removeLayerSpy.mock.calls.length).toBe(1);
  });

  expect(removeLayerSpy.mock.calls[0][0].values_.name).toBe("esri_animated");

  jest.useRealTimers();
});

test("Replacing a VectorLayer with same name removes old immediately (no load wait)", async () => {
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const removeLayerSpy = jest.spyOn(Map.prototype, "removeLayer");

  const geojson = {
    type: "FeatureCollection",
    crs: { type: "name", properties: { name: "EPSG:3857" } },
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 0] },
      },
    ],
  };

  const layers = [
    {
      type: "VectorLayer",
      props: {
        name: "vector_animated",
        source: { type: "GeoJSON", props: {}, geojson },
      },
    },
  ];

  const { rerender } = render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });

  // Replace with same name but different data — VectorLayer has no getTile/getImage
  const updatedGeojson = {
    ...geojson,
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [1, 1] },
      },
    ],
  };

  const updatedLayers = [
    {
      type: "VectorLayer",
      props: {
        name: "vector_animated",
        source: { type: "GeoJSON", props: {}, geojson: updatedGeojson },
      },
    },
  ];

  rerender(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers: updatedLayers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  // Should remove immediately — no load promise for vector sources
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(2);
  });
  await waitFor(() => {
    expect(removeLayerSpy.mock.calls.length).toBe(1);
  });

  expect(removeLayerSpy.mock.calls[0][0].values_.name).toBe("vector_animated");
});

test("Double-buffering done() is idempotent when called twice", async () => {
  jest.useFakeTimers();
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const removeLayerSpy = jest.spyOn(Map.prototype, "removeLayer");

  const layers = [
    {
      type: "WebGLTile",
      props: {
        source: {
          type: "Image Tile",
          props: {
            url: "https://example.com/tiles/v1/{z}/{y}/{x}",
          },
        },
        name: "double_done_layer",
        zIndex: 0,
      },
    },
  ];

  const { rerender } = render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });

  const updatedLayers = [
    {
      type: "WebGLTile",
      props: {
        source: {
          type: "Image Tile",
          props: {
            url: "https://example.com/tiles/v2/{z}/{y}/{x}",
          },
        },
        name: "double_done_layer",
        zIndex: 0,
      },
    },
  ];

  rerender(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers: updatedLayers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(2);
  });

  // Manually fire the tileloadend event on the new layer's source
  // BEFORE the timeout — this triggers done() the first time
  const newLayer = addLayerSpy.mock.calls[1][0];
  const source = newLayer.getSource();
  source.dispatchEvent("tileloadend");

  // Now advance past the timeout — done() fires a second time (should be no-op)
  jest.advanceTimersByTime(5100);

  await waitFor(() => {
    expect(removeLayerSpy.mock.calls.length).toBe(1);
  });

  // Only one removal despite done() being called twice
  expect(removeLayerSpy.mock.calls[0][0].values_.name).toBe(
    "double_done_layer",
  );

  jest.useRealTimers();
});

test("GeoTIFF with empty sources is silently skipped (not a failed layer)", async () => {
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const layers = [
    {
      type: "WebGLTile",
      props: {
        name: "In-progress GeoTIFF",
        source: {
          type: "GeoTIFF",
          props: {
            sources: [],
          },
        },
        zIndex: 0,
      },
    },
    {
      type: "WebGLTile",
      props: {
        source: {
          type: "Image Tile",
          props: {
            url: "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          },
        },
        name: "Other Layer",
        zIndex: 0,
      },
    },
  ];

  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // The valid layer still loads.
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  expect(addLayerSpy.mock.calls[0][0].values_.name).toBe("Other Layer");

  // The empty-sources GeoTIFF is NOT surfaced in the failedLayers warning.
  expect(
    screen.queryByText(/Failed to load the "In-progress GeoTIFF"/),
  ).not.toBeInTheDocument();
});

describe("WebGLTile ramp-style render path (Unit 7)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("WebGLTile layer with style.color uses setStyle directly, bypassing applyStyle", async () => {
    const applyStyleSpy = jest.spyOn(olMapboxStyle, "applyStyle");
    const setStyleSpy = jest.spyOn(WebGLTileLayer.prototype, "setStyle");

    const rampStyle = {
      color: [
        "interpolate",
        ["linear"],
        ["band", 1],
        0,
        "#000000",
        100,
        "#ffffff",
      ],
    };

    const layers = [
      {
        type: "WebGLTile",
        props: {
          source: {
            type: "Image Tile",
            props: {
              url: "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
            },
          },
          name: "Ramp Styled Layer",
          zIndex: 0,
        },
        style: rampStyle,
      },
    ];

    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <TestingComponent mapProps={{ layers }} />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    await waitFor(() => {
      expect(setStyleSpy).toHaveBeenCalled();
    });

    // setStyle received the raw style object (not a style function).
    const callArgs = setStyleSpy.mock.calls.map((c) => c[0]);
    expect(callArgs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          color: expect.arrayContaining(["interpolate"]),
        }),
      ]),
    );

    // applyStyle must NOT have been invoked for this layer.
    expect(applyStyleSpy).not.toHaveBeenCalled();
  });

  test("non-WebGLTile layer with a style still goes through applyStyle", async () => {
    const applyStyleSpy = jest
      .spyOn(olMapboxStyle, "applyStyle")
      .mockResolvedValue(undefined);

    const layers = [
      {
        type: "VectorLayer",
        props: {
          name: "Vector Layer",
          source: {
            type: "GeoJSON",
            props: {},
            geojson: {
              type: "FeatureCollection",
              crs: {
                type: "name",
                properties: { name: "EPSG:3857" },
              },
              features: [],
            },
          },
          zIndex: 1,
        },
        style: exampleStyle,
      },
    ];

    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <TestingComponent mapProps={{ layers }} />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    await waitFor(() => {
      expect(applyStyleSpy).toHaveBeenCalled();
    });
  });

  test("GeoTIFF layer triggers auto-fit: map view's projection switches to the TIF's", async () => {
    // The auto-fit's contract is: when a GeoTIFF layer is added, the map's
    // view projection switches to the TIF's so tiles can render. The mock
    // returns EPSG:4326 — different from the default EPSG:3857 — so we can
    // observe the projection change directly. Asserting on the resulting
    // view (rather than spying on setView) avoids fragile prototype-spy
    // wiring and tests the actual behavior.
    let capturedRef;
    const RefCapture = ({ mapProps }) => {
      const ref = useRef();
      capturedRef = ref;
      return (
        <div>
          <MapComponent visualizationRef={ref} {...mapProps} />
          <p>{useMapContext()?.mapReady ? "Map Ready" : "Map Not Ready"}</p>
        </div>
      );
    };
    RefCapture.propTypes = {
      mapProps: PropTypes.object,
    };

    const layers = [
      {
        type: "WebGLTile",
        props: {
          source: {
            type: "GeoTIFF",
            props: {
              sources: [{ url: "https://example.com/test.tif" }],
            },
          },
          name: "Auto-fit GeoTIFF Layer",
          zIndex: 0,
        },
      },
    ];

    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <RefCapture mapProps={{ layers }} />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    // The mock GeoTIFF's getView() must have been called.
    await waitFor(() => {
      expect(GeoTIFFSource.getViewSpy).toHaveBeenCalled();
    });

    // The map's view projection must have switched from default EPSG:3857
    // to the TIF's EPSG:4326. This proves auto-fit ran end-to-end.
    await waitFor(() => {
      const projCode = capturedRef.current
        ?.getView()
        ?.getProjection()
        ?.getCode();
      expect(projCode).toBe("EPSG:4326");
    });
  });

  test("WebGLTile layer without a style does not apply a ramp expression or call applyStyle", async () => {
    const applyStyleSpy = jest.spyOn(olMapboxStyle, "applyStyle");
    const setStyleSpy = jest.spyOn(WebGLTileLayer.prototype, "setStyle");

    const layers = [
      {
        type: "WebGLTile",
        props: {
          source: {
            type: "Image Tile",
            props: {
              url: "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
            },
          },
          name: "Default Shader Layer",
          zIndex: 0,
        },
        // No style key: WebGLTile default shader handles rendering.
      },
    ];

    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <TestingComponent mapProps={{ layers }} />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    // OL's WebGLTile constructor internally calls setStyle({}) during layer
    // construction — that's not our Unit 7 branch firing. The invariant is
    // that our code path does NOT push a ramp expression (object with `color`)
    // and does NOT route through ol-mapbox-style's applyStyle.
    expect(setStyleSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ color: expect.anything() }),
    );
    expect(applyStyleSpy).not.toHaveBeenCalled();
  });

  test("GeoTIFF source 'error' event surfaces fetch-failure message", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

    const layers = [
      {
        type: "WebGLTile",
        props: {
          source: {
            type: "GeoTIFF",
            props: { sources: [{ url: "https://example.com/test.tif" }] },
          },
          name: "Failing GeoTIFF",
          zIndex: 0,
        },
      },
    ];

    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <TestingComponent mapProps={{ layers }} />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    await waitFor(() => {
      expect(addLayerSpy.mock.calls.length).toBe(1);
    });

    // Listeners are wired synchronously after addLayer in updateLayers, so by
    // the time the spy records the call the source already has handlers.
    const source = addLayerSpy.mock.calls[0][0].getSource();
    source.dispatchEvent({
      type: "error",
      error: { message: "Request failed: AggregateError on byte range" },
    });

    expect(
      await screen.findByText(/failed to fetch the file/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/CORS headers/)).toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('GeoTIFF layer "Failing GeoTIFF" (source error)'),
      expect.anything(),
    );
  });

  test("GeoTIFF 'tileloaderror' surfaces format-failure message and throttles after first event", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

    const layers = [
      {
        type: "WebGLTile",
        props: {
          source: {
            type: "GeoTIFF",
            props: { sources: [{ url: "https://example.com/test.tif" }] },
          },
          name: "Format-Bad GeoTIFF",
          zIndex: 0,
        },
      },
    ];

    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <TestingComponent mapProps={{ layers }} />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    await waitFor(() => {
      expect(addLayerSpy.mock.calls.length).toBe(1);
    });

    const source = addLayerSpy.mock.calls[0][0].getSource();
    // Fire twice to verify the errorSurfaced throttle — the second event
    // must not produce another warn or another alert.
    source.dispatchEvent({
      type: "tileloaderror",
      error: { message: "unsupported compression scheme" },
    });
    source.dispatchEvent({
      type: "tileloaderror",
      error: { message: "another tile failed" },
    });

    const alert = await screen.findByText(
      /may not be a Cloud Optimized GeoTIFF/i,
    );
    expect(alert).toBeInTheDocument();
    // Format-failure branch carries the gdal_translate hint.
    expect(alert.textContent).toMatch(/gdal_translate -of COG/);
    // The phase string proves which listener fired.
    expect(alert.textContent).toMatch(/failed \(tile load error\)/);
    // Throttle: only one warn despite two events.
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  test("Auto-fit with valid map size fits new view to transformed previous extent (overlap branch)", async () => {
    // The default View (EPSG:3857, center near continental US) projected to
    // EPSG:4326 lands inside the mock TIF's extent [-180,-90,180,90], so the
    // overlap branch wins and targetExtent === transformed.
    jest.spyOn(Map.prototype, "getSize").mockReturnValue([256, 256]);
    // With a real size, OL's renderSync invokes the WebGL renderer, which
    // has no GL context in jsdom. Stub it — the auto-fit code doesn't
    // depend on actual rendering happening.
    jest.spyOn(Map.prototype, "renderSync").mockImplementation(() => {});
    const fitSpy = jest.spyOn(View.prototype, "fit");
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

    const layers = [
      {
        type: "WebGLTile",
        props: {
          source: {
            type: "GeoTIFF",
            props: { sources: [{ url: "https://example.com/test.tif" }] },
          },
          name: "Auto-fit Sized",
          zIndex: 0,
        },
      },
    ];

    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <TestingComponent mapProps={{ layers }} />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    await waitFor(() => {
      expect(addLayerSpy.mock.calls.length).toBe(1);
    });
    await waitFor(() => {
      expect(fitSpy).toHaveBeenCalled();
    });

    // Last fit call is the auto-fit one (no mapExtent prop set, so no other
    // fit path can fire). Assert it received a finite 4-elem extent and the
    // mocked map size.
    const [extent, options] = fitSpy.mock.calls[fitSpy.mock.calls.length - 1];
    expect(Array.isArray(extent)).toBe(true);
    expect(extent).toHaveLength(4);
    expect(extent.every(Number.isFinite)).toBe(true);
    // Overlap branch: transformed extent is in EPSG:4326 lon/lat (the new
    // view's projection), so values are well inside [-180, 180] x [-90, 90]
    // — distinguishing this from the no-haveMapSize path where fit isn't
    // called at all, AND from the fallback branch where extent equals the
    // mock's full TIF extent [-180,-90,180,90].
    expect(extent[0]).toBeGreaterThan(-180);
    expect(extent[2]).toBeLessThan(180);
    expect(extent[0]).not.toBe(-180);
    expect(extent[2]).not.toBe(180);
    expect(options).toEqual({ size: [256, 256] });
  });

  test("Auto-fit falls back to TIF extent when previous view does not overlap", async () => {
    // Override getView to return a tiny TIF extent in the Pacific. The
    // default view (continental US) does not overlap, so intersects() is
    // false and targetExtent falls through to the TIF's own extent.
    const tinyTifExtent = [170, -10, 175, -5];
    jest.spyOn(GeoTIFFSource.prototype, "getView").mockResolvedValue({
      projection: "EPSG:4326",
      extent: tinyTifExtent,
      center: [172.5, -7.5],
      zoom: 8,
    });
    jest.spyOn(Map.prototype, "getSize").mockReturnValue([256, 256]);
    jest.spyOn(Map.prototype, "renderSync").mockImplementation(() => {});
    const fitSpy = jest.spyOn(View.prototype, "fit");
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

    const layers = [
      {
        type: "WebGLTile",
        props: {
          source: {
            type: "GeoTIFF",
            props: { sources: [{ url: "https://example.com/test.tif" }] },
          },
          name: "Pacific GeoTIFF",
          zIndex: 0,
        },
      },
    ];

    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <TestingComponent mapProps={{ layers }} />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    await waitFor(() => {
      expect(addLayerSpy.mock.calls.length).toBe(1);
    });
    await waitFor(() => {
      expect(fitSpy).toHaveBeenCalled();
    });

    const [extent] = fitSpy.mock.calls[fitSpy.mock.calls.length - 1];
    expect(extent).toEqual(tinyTifExtent);
  });

  test("GeoTIFF 'error' event with only top-level message uses fetch path; warn logs evt itself", async () => {
    // detail comes from evt.message (the second branch of the
    // `evt?.error?.message || evt?.message || ""` chain), and console.warn
    // falls back to evt itself in `evt?.error ?? evt`.
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

    const layers = [
      {
        type: "WebGLTile",
        props: {
          source: {
            type: "GeoTIFF",
            props: { sources: [{ url: "https://example.com/test.tif" }] },
          },
          name: "Top-level Message GeoTIFF",
          zIndex: 0,
        },
      },
    ];

    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <TestingComponent mapProps={{ layers }} />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    await waitFor(() => {
      expect(addLayerSpy.mock.calls.length).toBe(1);
    });

    const source = addLayerSpy.mock.calls[0][0].getSource();
    const evt = { type: "error", message: "Failed to fetch the resource" };
    source.dispatchEvent(evt);

    expect(
      await screen.findByText(/failed to fetch the file/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Failed to fetch the resource/),
    ).toBeInTheDocument();
    // evt.error is undefined, so warn receives the event itself.
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("source error"),
      evt,
    );
  });

  test("GeoTIFF 'tileloaderror' empty event uses format path with empty detail", async () => {
    // No evt.error and no evt.message — `detail` falls back to "" (the
    // third branch of the chain), looksLikeFetchFailure is false (regex
    // doesn't match empty string), so format-failure path runs with the
    // empty-detail branch of `(detail ? "Detail: ..." : "")`.
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

    const layers = [
      {
        type: "WebGLTile",
        props: {
          source: {
            type: "GeoTIFF",
            props: { sources: [{ url: "https://example.com/test.tif" }] },
          },
          name: "Empty-event GeoTIFF",
          zIndex: 0,
        },
      },
    ];

    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <TestingComponent mapProps={{ layers }} />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    await waitFor(() => {
      expect(addLayerSpy.mock.calls.length).toBe(1);
    });

    const source = addLayerSpy.mock.calls[0][0].getSource();
    const evt = { type: "tileloaderror" };
    source.dispatchEvent(evt);

    const alert = await screen.findByText(
      /may not be a Cloud Optimized GeoTIFF/i,
    );
    expect(alert).toBeInTheDocument();
    // Empty-detail branch: no "Detail:" segment between "(tile load error)."
    // and "The file...".
    expect(alert.textContent).not.toMatch(/Detail:/);
    expect(alert.textContent).toMatch(/failed \(tile load error\)\. The file/);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("tile load error"),
      evt,
    );
  });

  test("Auto-fit defaults center=[0,0] and zoom=0 when getView omits them, falls back to transformed when tifExtent missing", async () => {
    // Single test that hits three branches: viewOptions.center default,
    // viewOptions.zoom default, and the `: transformed` fallback inside
    // the overlap ternary (because tifExtent is undefined → overlaps=false
    // → tifExtent invalid → fall to transformed).
    jest.spyOn(GeoTIFFSource.prototype, "getView").mockResolvedValue({
      projection: "EPSG:4326",
      // No center, no zoom, no extent — exercises all three defaults.
    });
    jest.spyOn(Map.prototype, "getSize").mockReturnValue([256, 256]);
    jest.spyOn(Map.prototype, "renderSync").mockImplementation(() => {});
    const fitSpy = jest.spyOn(View.prototype, "fit");
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

    const layers = [
      {
        type: "WebGLTile",
        props: {
          source: {
            type: "GeoTIFF",
            props: { sources: [{ url: "https://example.com/test.tif" }] },
          },
          name: "Bare-projection GeoTIFF",
          zIndex: 0,
        },
      },
    ];

    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <TestingComponent mapProps={{ layers }} />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    await waitFor(() => {
      expect(addLayerSpy.mock.calls.length).toBe(1);
    });
    await waitFor(() => {
      expect(fitSpy).toHaveBeenCalled();
    });

    // The fit extent is the transformed prev extent, not [-180,-90,180,90]
    // (the mock TIF's full extent is missing in this test).
    const [extent] = fitSpy.mock.calls[fitSpy.mock.calls.length - 1];
    expect(extent.every(Number.isFinite)).toBe(true);
    expect(extent).not.toEqual([-180, -90, 180, 90]);
  });

  test("Auto-fit takes the unclamped-prev branch when the source projection's getExtent returns a non-array", async () => {
    // Render without layers first so the initial Map and View are
    // constructed normally. Only after mount do we make EPSG:3857's
    // getExtent return a non-array — that way the auto-fit's
    // `prevProjection.getExtent?.()` yields a non-array sourceValid and
    // takes the `: prevExtent` branch of the clampedPrev ternary, while
    // OL's own internal usage at mount stays untouched.
    jest.spyOn(Map.prototype, "getSize").mockReturnValue([256, 256]);
    jest.spyOn(Map.prototype, "renderSync").mockImplementation(() => {});
    // The async renderFrame_ would normally fire after addLayer and try
    // to use WebGL (no GL context in jsdom). Stub it too.
    jest.spyOn(Map.prototype, "renderFrame_").mockImplementation(() => {});
    const fitSpy = jest.spyOn(View.prototype, "fit");
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

    const layer = {
      type: "WebGLTile",
      props: {
        source: {
          type: "GeoTIFF",
          props: { sources: [{ url: "https://example.com/test.tif" }] },
        },
        name: "Non-array-getExtent GeoTIFF",
        zIndex: 0,
      },
    };

    const { rerender } = render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <TestingComponent mapProps={{}} />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    // Now break getExtent and add the GeoTIFF layer. The spy stays a
    // function (so any further OL internals that grab it don't throw on
    // typeof checks); it simply returns a non-array.
    const proj = olProj.get("EPSG:3857");
    jest.spyOn(proj, "getExtent").mockReturnValue(undefined);

    rerender(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <TestingComponent mapProps={{ layers: [layer] }} />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    await waitFor(() => {
      expect(addLayerSpy).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(fitSpy).toHaveBeenCalled();
    });
  });

  test("Auto-fit handles non-finite transformExtent result (skips inner block, falls back to TIF extent)", async () => {
    // Force transformExtent to return non-finite values so
    // `transformed.every(Number.isFinite)` is false, exercising that
    // guard's else branch. Auto-fit then falls through to the second
    // `if (!targetExtent && Array.isArray(tifExtent) && ...)` block and
    // uses the mock's full extent.
    jest
      .spyOn(olProj, "transformExtent")
      .mockReturnValueOnce([NaN, NaN, NaN, NaN]);
    jest.spyOn(Map.prototype, "getSize").mockReturnValue([256, 256]);
    jest.spyOn(Map.prototype, "renderSync").mockImplementation(() => {});
    const fitSpy = jest.spyOn(View.prototype, "fit");
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

    const layers = [
      {
        type: "WebGLTile",
        props: {
          source: {
            type: "GeoTIFF",
            props: { sources: [{ url: "https://example.com/test.tif" }] },
          },
          name: "NaN-Transform GeoTIFF",
          zIndex: 0,
        },
      },
    ];

    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <TestingComponent mapProps={{ layers }} />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    await waitFor(() => {
      expect(addLayerSpy.mock.calls.length).toBe(1);
    });
    await waitFor(() => {
      expect(fitSpy).toHaveBeenCalled();
    });

    // Fell through to the TIF's full extent.
    expect(fitSpy.mock.calls[fitSpy.mock.calls.length - 1][0]).toEqual([
      -180, -90, 180, 90,
    ]);
  });

  test("dataviewerViz: InfoDiv is rendered and pointermove updates the displayed coordinates", async () => {
    // Two coverage targets: the JSX `<InfoDiv>` branch (only evaluated
    // when dataviewerViz is truthy) and the pointermove callback that
    // setLonLat's from evt.coordinate.
    let capturedRef;
    const RefCapture = ({ mapProps }) => {
      const ref = useRef();
      capturedRef = ref;
      return (
        <>
          <MapComponent visualizationRef={ref} {...mapProps} />
          <p>{useMapContext()?.mapReady ? "Map Ready" : "Map Not Ready"}</p>
        </>
      );
    };
    RefCapture.propTypes = {
      mapProps: PropTypes.object,
    };

    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <RefCapture mapProps={{ dataviewerViz: true }} />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    const infoDiv = await screen.findByLabelText("Info Div");
    expect(infoDiv).toBeInTheDocument();

    // Trigger the pointermove handler that sets lonLat.
    capturedRef.current.dispatchEvent({
      type: "pointermove",
      coordinate: [123.456, 789.012],
    });

    await waitFor(() => {
      expect(infoDiv.textContent).toMatch(/Lon: 123\.46, Lat: 789\.01/);
    });
  });

  test("mapDrawing prop renders DrawInteractions (covers JSX truthy branch)", async () => {
    // mapDrawingPropType: { options: string[], limit: number }
    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <TestingComponent
            mapProps={{
              mapDrawing: { options: ["Point"], limit: 1 },
              drawing: { current: false },
            }}
          />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    // DrawInteractions writes its own UI under the map div; merely
    // rendering without throwing is enough to take the JSX `&&` branch.
    expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  });

  test("legend with at least one item renders LegendControl (covers JSX truthy branch)", async () => {
    // `legend && legend.length > 0 && <LegendControl />` — the existing
    // empty-array test only covers the falsy short-circuit on length.
    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <TestingComponent
            mapProps={{
              legend: [
                {
                  title: "Test Legend",
                  items: [{ color: "red", label: "Red" }],
                },
              ],
            }}
          />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    expect(await screen.findByLabelText("Map Legend")).toBeInTheDocument();
  });

  test("Auto-fit skips inner extent block when clampedPrev is non-finite", async () => {
    // Force prevView.calculateExtent to return non-finite values so
    // `clampedPrev.every(Number.isFinite)` is false and the if condition
    // at the top of the haveMapSize block goes false. targetExtent stays
    // null inside the inner block, then the fallback `if (!targetExtent
    // && Array.isArray(tifExtent) ...)` uses the mock TIF's extent.
    jest
      .spyOn(View.prototype, "calculateExtent")
      .mockReturnValue([NaN, NaN, NaN, NaN]);
    jest.spyOn(Map.prototype, "getSize").mockReturnValue([256, 256]);
    jest.spyOn(Map.prototype, "renderSync").mockImplementation(() => {});
    jest.spyOn(Map.prototype, "renderFrame_").mockImplementation(() => {});
    const fitSpy = jest.spyOn(View.prototype, "fit");
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

    const layers = [
      {
        type: "WebGLTile",
        props: {
          source: {
            type: "GeoTIFF",
            props: { sources: [{ url: "https://example.com/test.tif" }] },
          },
          name: "Non-finite Prev GeoTIFF",
          zIndex: 0,
        },
      },
    ];

    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <TestingComponent mapProps={{ layers }} />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    await waitFor(() => {
      expect(addLayerSpy.mock.calls.length).toBe(1);
    });
    await waitFor(() => {
      expect(fitSpy).toHaveBeenCalled();
    });

    // Inner block was skipped (transformed never computed); fallback
    // to TIF's full extent kicked in.
    expect(fitSpy.mock.calls[fitSpy.mock.calls.length - 1][0]).toEqual([
      -180, -90, 180, 90,
    ]);
  });

  test("Auto-fit catch logs warning when getView rejects", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    jest
      .spyOn(GeoTIFFSource.prototype, "getView")
      .mockRejectedValue(new Error("kaboom"));
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

    const layers = [
      {
        type: "WebGLTile",
        props: {
          source: {
            type: "GeoTIFF",
            props: { sources: [{ url: "https://example.com/test.tif" }] },
          },
          name: "Bomber",
          zIndex: 0,
        },
      },
    ];

    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <TestingComponent mapProps={{ layers }} />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    await waitFor(() => {
      expect(addLayerSpy.mock.calls.length).toBe(1);
    });
    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('GeoTIFF auto-fit failed for layer "Bomber"'),
        expect.any(Error),
      );
    });
  });
});

TestingComponent.propTypes = {
  mapProps: PropTypes.shape({
    onMapClick: PropTypes.bool,
    onMapMove: PropTypes.bool,
    layers: PropTypes.array,
  }),
};

// --- Runtime dynamic_map_layer identity keep-branch tests -------------------

// A minimal runtime-capable VectorLayer config. Uses an empty FeatureCollection
// placeholder with a valid crs so moduleLoader's GeoJSON branch can instantiate
// the OL VectorLayer even before the runtime fetcher has painted features.
const runtimeLayerConfig = (overrides = {}) => ({
  type: "VectorLayer",
  props: {
    name: overrides.name ?? "Runtime Layer",
    layerId: overrides.layerId ?? "layer-1",
    pluginSource: overrides.pluginSource ?? {
      source: "my_runtime_plugin",
      args: { bbox: "x" },
    },
    source: {
      type: "GeoJSON",
      props: {},
      geojson: {
        type: "FeatureCollection",
        features: [],
        crs: { type: "name", properties: { name: "EPSG:4326" } },
      },
    },
    opacity: overrides.opacity ?? 1,
    zIndex: overrides.zIndex ?? 0,
  },
});

test("runtime layer preserved on cosmetic re-render (opacity change)", async () => {
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const removeLayerSpy = jest.spyOn(Map.prototype, "removeLayer");
  addLayerSpy.mockClear();
  removeLayerSpy.mockClear();

  const layers = [runtimeLayerConfig({ opacity: 0.8 })];

  const { rerender } = render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  const initialOlLayer = addLayerSpy.mock.calls[0][0];
  expect(initialOlLayer.get("layerId")).toBe("layer-1");
  expect(initialOlLayer.get("pluginSource").source).toBe("my_runtime_plugin");

  // Rerender with opacity changed; identity (layerId + pluginSource.source)
  // unchanged — layer should be preserved, not rebuilt.
  const updatedLayers = [
    runtimeLayerConfig({ opacity: 0.3, name: "Runtime Layer" }),
  ];
  rerender(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers: updatedLayers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  await waitFor(() => {
    // Opacity setter applied in place — OL instance still the same.
    expect(initialOlLayer.getOpacity()).toBe(0.3);
  });
  // No new addLayer call, no removeLayer call — identity branch kept it.
  expect(addLayerSpy.mock.calls.length).toBe(1);
  expect(removeLayerSpy.mock.calls.length).toBe(0);
});

test("runtime layer rebuilt when pluginSource.source changes", async () => {
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const removeLayerSpy = jest.spyOn(Map.prototype, "removeLayer");
  addLayerSpy.mockClear();
  removeLayerSpy.mockClear();

  const layers = [runtimeLayerConfig()];
  const { rerender } = render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });

  // Same layerId but different plugin — identity broken; rebuild is required
  // so the new plugin's fetch flow takes over.
  const updatedLayers = [
    runtimeLayerConfig({
      pluginSource: { source: "different_plugin", args: {} },
    }),
  ];
  rerender(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers: updatedLayers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(2);
  });
  expect(removeLayerSpy.mock.calls.length).toBe(1);
});

test("duplicate layerId triggers rebuild of both + console warning", async () => {
  const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  addLayerSpy.mockClear();

  // Initial render with one runtime layer.
  const layers = [runtimeLayerConfig({ name: "A", layerId: "shared" })];
  const { rerender } = render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });

  // Rerender with two layers sharing the same layerId (a simulated copy/paste
  // or bulk-import bug). The identity branch bails out for both and falls
  // through to rebuild + logs a warning so the author can diagnose.
  const updatedLayers = [
    runtimeLayerConfig({ name: "A", layerId: "shared" }),
    runtimeLayerConfig({ name: "B", layerId: "shared" }),
  ];
  rerender(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers: updatedLayers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  await waitFor(() => {
    expect(warnSpy).toHaveBeenCalled();
  });
  expect(warnSpy.mock.calls[0][0]).toMatch(/share layerId "shared"/);
  warnSpy.mockRestore();
});

test("Runtime identity branch tolerates a missing OL layer (line 291 falsy)", async () => {
  const layerId = "missing-ol-layer-id";
  const cfg = (extra = {}) => ({
    type: "VectorLayer",
    props: {
      name: "Runtime Layer",
      layerId,
      pluginSource: { source: "stream_gauges", args: {} },
      source: {
        type: "GeoJSON",
        props: {},
        geojson: {
          type: "FeatureCollection",
          crs: { type: "name", properties: { name: "EPSG:3857" } },
          features: [],
        },
      },
      ...extra,
    },
  });

  let capturedRef;
  const RefCapture = ({ mapProps }) => {
    const ref = useRef();
    capturedRef = ref;
    return (
      <>
        <MapComponent visualizationRef={ref} {...mapProps} />
        <p>{useMapContext()?.mapReady ? "Map Ready" : "Map Not Ready"}</p>
      </>
    );
  };
  RefCapture.propTypes = { mapProps: PropTypes.object };

  const { rerender } = render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <RefCapture mapProps={{ layers: [cfg()] }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    const olLayers = capturedRef.current.getLayers().getArray();
    expect(olLayers.find((l) => l.get("layerId") === layerId)).toBeDefined();
  });

  // Externally remove the OL layer so currentLayers.current still records
  // the runtime config but the OL map no longer has it. The next render's
  // identity-keep branch will queue a runtimeLayerUpdate for a layerId
  // that currentMapLayers.find(...) cannot resolve.
  const map = capturedRef.current;
  const stale = map
    .getLayers()
    .getArray()
    .find((l) => l.get("layerId") === layerId);
  map.removeLayer(stale);

  // Cosmetic change keeps the identity match (same layerId + pluginSource.source),
  // so runtimeLayerUpdates gets a push — but the falsy branch of `if (olLayer)`
  // at Map.js:291 fires because the OL layer is gone.
  rerender(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <RefCapture mapProps={{ layers: [cfg({ opacity: 0.5 })] }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  // No throw, and the missing layer is not resurrected — proving the
  // identity branch quietly skipped the absent OL instance.
  await waitFor(() => {
    const olLayers = capturedRef.current.getLayers().getArray();
    expect(olLayers.find((l) => l.get("layerId") === layerId)).toBeUndefined();
  });
});
