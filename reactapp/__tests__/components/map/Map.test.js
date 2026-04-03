import { useRef, useState, useEffect } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MapComponent from "components/map/Map";
import PropTypes from "prop-types";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import { Map } from "ol";
import { exampleStyle } from "__tests__/utilities/constants";
import { VariableInputsContext } from "components/contexts/Contexts";
import * as olMapboxStyle from "ol-mapbox-style";
import WebGLTileLayer from "ol/layer/WebGLTile";

global.ResizeObserver = require("resize-observer-polyfill");

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

TestingComponent.propTypes = {
  mapProps: PropTypes.shape({
    onMapClick: PropTypes.bool,
    onMapMove: PropTypes.bool,
    layers: PropTypes.array,
  }),
};
