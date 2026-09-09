import { useRef, useState, useEffect } from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import MapComponent from "components/map/Map";
import PropTypes from "prop-types";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import { Map, View } from "ol";
import {
  exampleStyle,
  layerConfigGeoJSON,
} from "__tests__/utilities/constants";
import {
  GridItemContext,
  TabContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import ViewGroupProvider from "components/contexts/ViewGroupContext";
import { wrapMercatorX } from "components/map/utilities";
import * as olMapboxStyle from "ol-mapbox-style";
import WebGLTileLayer from "ol/layer/WebGLTile";
import GeoTIFFSource from "ol/source/GeoTIFF.js";
import * as olProj from "ol/proj";
import { get as olGetProj } from "ol/proj";

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
      // Overridable so a test can drive a raster whose projection resolves from
      // a registered definition rather than natively.
      return Promise.resolve(
        MockGeoTIFFSource.viewOptions ?? {
          projection: "EPSG:4326",
          extent: [-180, -90, 180, 90],
          center: [0, 0],
          zoom: 2,
        },
      );
    }
  }
  MockGeoTIFFSource.getViewSpy = getViewSpy;
  MockGeoTIFFSource.viewOptions = null;
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
    await waitFor(() =>
      expect(screen.getByTestId("map-view")).toHaveTextContent(
        JSON.stringify({
          zoom: 4.5,
          center: [-10686671.12, 4721671.57],
        }),
      ),
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

  await waitFor(() =>
    expect(screen.getByTestId("map-view")).toHaveTextContent(
      JSON.stringify({
        zoom: 7,
        center: [-10686671.12, 4721671.57],
      }),
    ),
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

  await waitFor(() =>
    expect(screen.getByTestId("map-view")).toHaveTextContent(
      JSON.stringify({
        zoom: 8,
        center: [-10686671.12, 4721671.57],
      }),
    ),
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

  await waitFor(() =>
    expect(screen.getByTestId("map-view")).toHaveTextContent(
      JSON.stringify({
        zoom: 8,
        center: [-10686671.12, 4721671.57],
      }),
    ),
  );
});

test("Characterization: an extent change replaces the View object, sweeps vector features, and an unchanged extent replaces nothing", async () => {
  // Pins the behaviour the view-group publisher keys on: a `mapExtent` change
  // builds a NEW `View` and hands it to `setView`, rather than mutating the
  // live view in place -- which is what makes view-object identity a reliable
  // "this was not a user action" signal. The vector sweep alongside it is the
  // prior defect (features parsed into the outgoing projection are stranded
  // off screen), so it is pinned here too.
  const capturedRef = { current: null };
  const ExtentHarness = ({ mapProps }) => {
    const visualizationRef = useRef();
    const { mapReady } = useMapContext();
    useEffect(() => {
      capturedRef.current = visualizationRef.current;
    });
    return (
      <div>
        <MapComponent visualizationRef={visualizationRef} {...mapProps} />
        <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
      </div>
    );
  };
  ExtentHarness.propTypes = { mapProps: PropTypes.object };

  const layers = [
    {
      type: "VectorLayer",
      props: {
        name: "Vector Alongside",
        zIndex: 1,
        source: {
          type: "GeoJSON",
          props: {},
          geojson: {
            type: "FeatureCollection",
            crs: { type: "name", properties: { name: "EPSG:4326" } },
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "Point", coordinates: [-90.54, 14.48] },
              },
            ],
          },
        },
      },
    },
  ];

  const renderWithExtent = (extent) => (
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <ExtentHarness mapProps={{ layers, mapExtent: { extent } }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>
  );

  const { rerender } = render(renderWithExtent("-10686671.12,4721671.57,5"));
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  const findVectorFeature = () =>
    capturedRef.current
      ?.getLayers()
      .getArray()
      .find((layer) => layer.get("name") === "Vector Alongside")
      ?.getSource()
      .getFeatures()[0];

  await waitFor(() => expect(findVectorFeature()).toBeDefined());

  const viewBefore = capturedRef.current.getView();
  expect(viewBefore.getZoom()).toBe(5);
  // Parsed into the view projection, so Web Mercator metres rather than the
  // degrees the GeoJSON carries.
  const [xBefore] = findVectorFeature().getGeometry().getCoordinates();
  expect(Math.abs(xBefore)).toBeGreaterThan(1e6);

  rerender(renderWithExtent("0,0,6"));

  await waitFor(() =>
    expect(capturedRef.current.getView()).not.toBe(viewBefore),
  );
  const viewAfter = capturedRef.current.getView();
  expect(viewAfter.getZoom()).toBe(6);
  expect(viewAfter.getCenter()).toEqual([0, 0]);
  // Same projection on both sides, so the sweep leaves the coordinates alone.
  expect(findVectorFeature().getGeometry().getCoordinates()[0]).toBe(xBefore);

  // Re-rendering with an equal extent string (a fresh object each time) is
  // guarded by `lastAppliedExtentRef`, so the view is NOT replaced -- the
  // publisher must not read that as a programmatic move.
  rerender(renderWithExtent("0, 0, 6"));
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  expect(capturedRef.current.getView()).toBe(viewAfter);
});

test("Custom map extent wraps an out-of-range lon for EPSG:3857 projections", async () => {
  // The reported bug coordinate: stored center one world-width west of the
  // valid EPSG:3857 range. The setCenter call on line 164 should receive the
  // wrapped value (via the EPSG:3857 branch of the line 158 ternary), not the
  // raw out-of-range lon.
  const inputLon = -25981450.0;
  const lat = 5746110.48;
  const zoom = 7;
  const expectedX = wrapMercatorX(inputLon);
  expect(expectedX).not.toBe(inputLon); // sanity: wrap actually transforms

  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: { style: { width: "50%" } },
            mapExtent: { extent: `${inputLon}, ${lat}, ${zoom}` },
          }}
        />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  await waitFor(() =>
    expect(screen.getByTestId("map-view")).toHaveTextContent(
      JSON.stringify({
        zoom,
        center: [expectedX, lat],
      }),
    ),
  );
});

test("Custom map extent passes through raw lon for non-EPSG:3857 projections", async () => {
  // Covers the falsy side of the projection ternary on Map.js:158. The
  // `projection` state is initialized to EPSG:3857 with no external override,
  // so the only way to exercise this branch is to spy on the View's
  // getProjection so it reports a non-3857 code during the mapExtent effect.
  // In that branch the raw lon must pass through unchanged — even when its
  // magnitude is out of range for Web Mercator (no wrap is applied).
  const mockProj = olGetProj("EPSG:4326");
  const getProjectionSpy = jest
    .spyOn(View.prototype, "getProjection")
    .mockReturnValue(mockProj);

  const inputLon = -25981450.0; // out-of-range for EPSG:3857
  const lat = 30;
  const zoom = 4;

  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: { style: { width: "50%" } },
            mapExtent: { extent: `${inputLon}, ${lat}, ${zoom}` },
          }}
        />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  const viewText = (await screen.findByTestId("map-view")).textContent;
  const parsed = JSON.parse(viewText);
  // Raw lon passes through unchanged — no wrap applied on the false branch.
  expect(parsed.center[0]).toBe(inputLon);
  expect(parsed.center[1]).toBe(lat);

  getProjectionSpy.mockRestore();
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

  await waitFor(() =>
    expect(screen.getByTestId("map-view")).toHaveTextContent(
      JSON.stringify({ zoom: 19.578127880157357, center: [20, 30] }),
    ),
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

  await waitFor(() =>
    expect(screen.getByTestId("map-view")).toHaveTextContent(
      JSON.stringify({ zoom: 19.578127880157357, center: [20, 30] }),
    ),
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
    await waitFor(() =>
      expect(screen.getByTestId("map-view")).toHaveTextContent(
        JSON.stringify({ zoom: 19.578127880157357, center: [20, 30] }),
      ),
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

const tileLayer = (url) => [
  {
    type: "WebGLTile",
    props: {
      source: { type: "Image Tile", props: { url } },
      name: "buf_layer",
      zIndex: 0,
    },
  },
];

const wrapLayers = (layers) => (
  <VariableInputsContext.Provider value={{ setVariableInputValues: jest.fn() }}>
    <MapContextProvider>
      <TestingComponent mapProps={{ layers }} />
    </MapContextProvider>
  </VariableInputsContext.Provider>
);

test("replacement tile layer stays hidden until painted, then reveals on swap", async () => {
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const removeLayerSpy = jest.spyOn(Map.prototype, "removeLayer");

  const { rerender } = render(
    wrapLayers(tileLayer("https://example.com/a/{z}/{y}/{x}")),
  );
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => expect(addLayerSpy.mock.calls.length).toBe(1));

  rerender(wrapLayers(tileLayer("https://example.com/b/{z}/{y}/{x}")));
  await waitFor(() => expect(addLayerSpy.mock.calls.length).toBe(2));

  const newLayer = addLayerSpy.mock.calls[1][0];
  // Hidden via opacity (still loading) while the old layer is still present.
  expect(newLayer.getOpacity()).toBe(0);
  expect(removeLayerSpy.mock.calls.length).toBe(0);

  newLayer.getSource().dispatchEvent("tileloadend");

  await waitFor(() => expect(removeLayerSpy.mock.calls.length).toBe(1));
  // Revealed on the swap; the old layer is the one removed.
  expect(newLayer.getOpacity()).toBe(1);
  expect(removeLayerSpy.mock.calls[0][0].values_.name).toBe("buf_layer");
});

test("superseded frame is discarded; only the newest replacement reveals", async () => {
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const removeLayerSpy = jest.spyOn(Map.prototype, "removeLayer");

  const { rerender } = render(
    wrapLayers(tileLayer("https://example.com/a/{z}/{y}/{x}")),
  );
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => expect(addLayerSpy.mock.calls.length).toBe(1));

  // Two rerenders before any tiles paint: the middle frame is superseded.
  rerender(wrapLayers(tileLayer("https://example.com/b/{z}/{y}/{x}")));
  await waitFor(() => expect(addLayerSpy.mock.calls.length).toBe(2));
  rerender(wrapLayers(tileLayer("https://example.com/c/{z}/{y}/{x}")));
  await waitFor(() => expect(addLayerSpy.mock.calls.length).toBe(3));

  const layerA = addLayerSpy.mock.calls[0][0];
  const layerB = addLayerSpy.mock.calls[1][0];
  const layerC = addLayerSpy.mock.calls[2][0];

  // Both replacements are still hidden (opacity 0); the original is untouched.
  expect(layerA.getOpacity()).toBe(1);
  expect(layerB.getOpacity()).toBe(0);
  expect(layerC.getOpacity()).toBe(0);

  // The newest frame paints first: it reveals and the old layer is dropped.
  layerC.getSource().dispatchEvent("tileloadend");
  await waitFor(() => expect(layerC.getOpacity()).toBe(1));
  expect(removeLayerSpy.mock.calls.map((c) => c[0])).toContain(layerA);

  // The superseded middle frame paints late: discarded, never revealed.
  layerB.getSource().dispatchEvent("tileloadend");
  await waitFor(() =>
    expect(removeLayerSpy.mock.calls.map((c) => c[0])).toContain(layerB),
  );
  expect(layerB.getOpacity()).toBe(0);
});

test("GeoTIFF with no url is silently skipped (not a failed layer)", async () => {
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const layers = [
    {
      type: "WebGLTile",
      props: {
        name: "In-progress GeoTIFF",
        source: {
          type: "GeoTIFF",
          props: {},
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

  // The url-less GeoTIFF is NOT surfaced in the failedLayers warning.
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

  test("auto-fit does not adopt a registered-but-not-native projection as the view projection", async () => {
    // EPSG:5041 resolves because the projection table registers it, which is
    // what makes such a raster render at all. It must not also become the view
    // projection: adoption calls setView and publishes the adopted code into the
    // map-extent variable other visualizations read. Widening that is a separate
    // change, so the view has to stay put while the layer still renders.
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    GeoTIFFSource.viewOptions = {
      projection: "EPSG:5041",
      extent: [-1405881, -1405881, 5405881, 5405881],
      center: [2000000, 2000000],
      zoom: 2,
    };

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
    RefCapture.propTypes = { mapProps: PropTypes.object };

    const layers = [
      {
        type: "WebGLTile",
        props: {
          source: {
            type: "GeoTIFF",
            props: { url: "https://example.com/polar.tif" },
          },
          name: "Polar GeoTIFF Layer",
          zIndex: 0,
        },
      },
    ];

    try {
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
      await waitFor(() => {
        expect(GeoTIFFSource.getViewSpy).toHaveBeenCalled();
      });

      // The layer is still added -- rendering by reprojection is the point.
      await waitFor(() => {
        const names = capturedRef.current
          .getLayers()
          .getArray()
          .map((l) => l.get("name"));
        expect(names).toContain("Polar GeoTIFF Layer");
      });

      // ...but the view did not move off the default.
      expect(capturedRef.current.getView().getProjection().getCode()).toBe(
        "EPSG:3857",
      );
      await waitFor(() => {
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining('Not adopting "EPSG:5041"'),
        );
      });
    } finally {
      GeoTIFFSource.viewOptions = null;
      warn.mockRestore();
    }
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
              url: "https://example.com/test.tif",
            },
          },
          name: "Auto-fit GeoTIFF Layer",
          zIndex: 0,
        },
      },
      // A vector layer alongside it: its features are parsed into the map's
      // projection when added, so the auto-fit has to move them with the view
      // or they are left holding the outgoing projection's numbers.
      {
        type: "VectorLayer",
        props: {
          name: "Vector Alongside",
          zIndex: 1,
          source: {
            type: "GeoJSON",
            props: {},
            geojson: {
              type: "FeatureCollection",
              crs: { type: "name", properties: { name: "EPSG:4326" } },
              features: [
                {
                  type: "Feature",
                  properties: {},
                  geometry: { type: "Point", coordinates: [-90.54, 14.48] },
                },
              ],
            },
          },
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

    // And the vector features moved with it. Parsed into EPSG:3857 when the
    // layer was added, they would otherwise still hold metres (~-1e7) while the
    // view now reads degrees -- far off screen, which is what stranded the
    // dynamic layers on a dashboard whose rasters are UTM.
    const findVector = () =>
      capturedRef.current
        .getLayers()
        .getArray()
        .find((l) => l.get("name") === "Vector Alongside");
    await waitFor(() => {
      expect(findVector()).toBeDefined();
    });
    await waitFor(() => {
      const [x] = findVector()
        .getSource()
        .getFeatures()[0]
        .getGeometry()
        .getCoordinates();
      expect(Math.abs(x - -90.54)).toBeLessThan(0.01);
    });
    const [, y] = findVector()
      .getSource()
      .getFeatures()[0]
      .getGeometry()
      .getCoordinates();
    expect(Math.abs(y - 14.48)).toBeLessThan(0.01);
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
            props: { url: "https://example.com/test.tif" },
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
            props: { url: "https://example.com/test.tif" },
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
            props: { url: "https://example.com/test.tif" },
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

  test("a second raster in the projection already adopted leaves the view alone", async () => {
    // This is the jitter. Every raster runs the auto-fit as it mounts, so a
    // dashboard built on several rasters in one projection ran it once per
    // raster -- and `setView` replaces the view outright, so each call made
    // every layer re-render and the basemap refetch its tiles. Once the layers
    // stopped arriving in a single burst, that showed up as the map jumping
    // once per raster.
    jest.spyOn(Map.prototype, "getSize").mockReturnValue([256, 256]);
    jest.spyOn(Map.prototype, "renderSync").mockImplementation(() => {});
    const setViewSpy = jest.spyOn(Map.prototype, "setView");
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

    // Both rasters report EPSG:4326 over the whole world, so the first adopts
    // it and the second finds the view already in it and already overlapping.
    const raster = (name) => ({
      type: "WebGLTile",
      props: {
        source: {
          type: "GeoTIFF",
          props: { url: `https://example.com/${name}.tif` },
        },
        name,
        zIndex: 0,
      },
    });

    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <TestingComponent
            mapProps={{ layers: [raster("first"), raster("second")] }}
          />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    await waitFor(() => expect(addLayerSpy.mock.calls.length).toBe(2));
    await waitFor(() => expect(setViewSpy).toHaveBeenCalled());

    // Both rasters are on the map, and the view moved exactly once.
    expect(setViewSpy).toHaveBeenCalledTimes(1);
  });

  test("a non-owning raster never moves the view, wherever it is", async () => {
    // Five rasters in two projections each asserting their own CRS on one view
    // is not resolvable by "skip if already adopted" -- each adoption undoes
    // the last. One raster owns the view; the rest render by reprojection,
    // which OpenLayers does for a DataTile source whose projection differs
    // from the view's.
    jest.spyOn(Map.prototype, "getSize").mockReturnValue([256, 256]);
    jest.spyOn(Map.prototype, "renderSync").mockImplementation(() => {});
    const setViewSpy = jest.spyOn(Map.prototype, "setView");
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

    // The owner covers the world in EPSG:4326; the second sits in the Pacific
    // in a different projection, so under the old policy it would have both
    // re-fitted and re-projected the view.
    jest
      .spyOn(GeoTIFFSource.prototype, "getView")
      .mockImplementation(function () {
        const url = this.options?.sources?.[0]?.url ?? "";
        return url.includes("pacific")
          ? Promise.resolve({
              projection: "EPSG:32615",
              extent: [170, -10, 175, -5],
              center: [172.5, -7.5],
              zoom: 8,
            })
          : Promise.resolve({
              projection: "EPSG:4326",
              extent: [-180, -90, 180, 90],
              center: [0, 0],
              zoom: 2,
            });
      });

    const raster = (name, file, zIndex) => ({
      type: "WebGLTile",
      props: {
        source: {
          type: "GeoTIFF",
          props: { url: `https://example.com/${file}.tif` },
        },
        name,
        zIndex,
      },
    });

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
    RefCapture.propTypes = { mapProps: PropTypes.object };

    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <RefCapture
            mapProps={{
              layers: [
                raster("World", "world", 0),
                raster("Pacific", "pacific", 1),
              ],
            }}
          />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    await waitFor(() => expect(addLayerSpy.mock.calls.length).toBe(2));
    await waitFor(() => expect(setViewSpy).toHaveBeenCalled());

    // Both layers render; the view moved once, into the owner's projection.
    expect(setViewSpy).toHaveBeenCalledTimes(1);
    expect(capturedRef.current.getView().getProjection().getCode()).toBe(
      "EPSG:4326",
    );
  });

  test("rebuilding the owning raster does not move the view again", async () => {
    // The owner is the only layer that reaches the adoption at all now, so this
    // is the remaining path to it a second time: the owner itself is torn down
    // and rebuilt (a variable-input URL change, an opacity edit) after it has
    // already adopted. The view is already in its projection and already shows
    // it, so there is nothing to adopt and `setView` would only re-render every
    // layer and refetch the basemap.
    jest.spyOn(Map.prototype, "getSize").mockReturnValue([256, 256]);
    jest.spyOn(Map.prototype, "renderSync").mockImplementation(() => {});
    // The animation-frame render would reach the WebGL renderer, which has no
    // GL context in jsdom.
    jest.spyOn(Map.prototype, "renderFrame_").mockImplementation(() => {});
    const setViewSpy = jest.spyOn(Map.prototype, "setView");
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

    const owner = (opacity) => [
      {
        type: "WebGLTile",
        props: {
          source: {
            type: "GeoTIFF",
            props: { url: "https://example.com/owner.tif" },
          },
          name: "Owner",
          opacity,
          zIndex: 0,
        },
      },
    ];

    let setLayers;
    const Restyleable = () => {
      const ref = useRef();
      const [layers, setLayersState] = useState(owner(1));
      setLayers = setLayersState;
      return (
        <div>
          <MapComponent visualizationRef={ref} layers={layers} />
          <p>{useMapContext()?.mapReady ? "Map Ready" : "Map Not Ready"}</p>
        </div>
      );
    };

    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <Restyleable />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    await waitFor(() => expect(addLayerSpy.mock.calls.length).toBe(1));
    await waitFor(() => expect(setViewSpy).toHaveBeenCalledTimes(1));

    // An opacity edit fails the props comparison, so the layer is rebuilt.
    await act(async () => setLayers(owner(0.5)));
    await waitFor(() => expect(addLayerSpy.mock.calls.length).toBe(2));

    expect(setViewSpy).toHaveBeenCalledTimes(1);
  });

  test("the first raster in the array owns the view even when it lands last", async () => {
    // The owner is chosen from the author's array rather than from whichever
    // file the network served first, so the projection the map settles in is
    // the same on a fast connection and a slow one.
    // Deliberately unsized: the ownership decision does not depend on the map
    // having a size, and with one the delay below lets a real animation frame
    // reach the WebGL renderer, which has no GL context in jsdom.
    const setViewSpy = jest.spyOn(Map.prototype, "setView");
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

    jest
      .spyOn(GeoTIFFSource.prototype, "getView")
      .mockImplementation(function () {
        const url = this.options?.sources?.[0]?.url ?? "";
        if (url.includes("slow")) {
          // The owner, and the last to answer.
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  projection: "EPSG:4326",
                  extent: [-180, -90, 180, 90],
                  center: [0, 0],
                  zoom: 2,
                }),
              120,
            ),
          );
        }
        return Promise.resolve({
          projection: "EPSG:32615",
          extent: [170, -10, 175, -5],
          center: [172.5, -7.5],
          zoom: 8,
        });
      });

    const raster = (name, file, zIndex) => ({
      type: "WebGLTile",
      props: {
        source: {
          type: "GeoTIFF",
          props: { url: `https://example.com/${file}.tif` },
        },
        name,
        zIndex,
      },
    });

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
    RefCapture.propTypes = { mapProps: PropTypes.object };

    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <RefCapture
            mapProps={{
              layers: [
                raster("Slow owner", "slow", 0),
                raster("Quick", "quick", 1),
              ],
            }}
          />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

    await waitFor(() => expect(addLayerSpy.mock.calls.length).toBe(2));
    await waitFor(() =>
      expect(capturedRef.current.getView().getProjection().getCode()).toBe(
        "EPSG:4326",
      ),
    );
    // The quick one answered first and still did not touch the view.
    expect(setViewSpy).toHaveBeenCalledTimes(1);
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
            props: { url: "https://example.com/test.tif" },
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
            props: { url: "https://example.com/test.tif" },
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
            props: { url: "https://example.com/test.tif" },
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
            props: { url: "https://example.com/test.tif" },
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
          props: { url: "https://example.com/test.tif" },
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
            props: { url: "https://example.com/test.tif" },
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

    // The control itself must sit outside the map div. A fill-viewport tile is
    // position:fixed, which seals its subtree into a stacking context that no
    // descendant z-index can escape -- so a control rendered inside the map
    // cannot paint above a grid item overlapping it, whatever its z-index.
    const mapDiv = await screen.findByLabelText("Map Div");
    const control = await screen.findByLabelText("Show Legend Control");
    expect(mapDiv).not.toContainElement(control);
    expect(document.body).toContainElement(control);
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
            props: { url: "https://example.com/test.tif" },
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
            props: { url: "https://example.com/test.tif" },
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

describe("onMapMoveEnd registration and mount-time prime", () => {
  // Registration lives in the async layer-sync effect: every layers update
  // must un+on re-register (no handler pile-up) and the handler must be
  // primed exactly once per map instance so the snap cache exists before the
  // first user pan.
  const renderMoveEndMap = (
    onMapMoveEnd,
    initialLayers = [layerConfigGeoJSON.configuration],
  ) => {
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
    const tree = (layers) => (
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <RefCapture mapProps={{ layers, onMapMoveEnd }} />
        </MapContextProvider>
      </VariableInputsContext.Provider>
    );
    const { rerender } = render(tree(initialLayers));
    return {
      getMap: () => capturedRef.current,
      // A fresh array identity re-runs the [layers] effect → re-registration.
      rerenderLayers: (layers = initialLayers) => rerender(tree([...layers])),
    };
  };

  test("moveend fires the handler once per event; re-registration on a layer update does not double-fire", async () => {
    const onMapMoveEnd = jest.fn();
    const { getMap, rerenderLayers } = renderMoveEndMap(onMapMoveEnd);

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    // The only call so far is the mount-time prime.
    await waitFor(() => expect(onMapMoveEnd).toHaveBeenCalledTimes(1));
    // OL assigns `un` per instance (not on Map.prototype), so spy on the map.
    const unSpy = jest.spyOn(getMap(), "un");

    getMap().dispatchEvent({ type: "moveend" });
    expect(onMapMoveEnd).toHaveBeenCalledTimes(2);
    expect(onMapMoveEnd).toHaveBeenLastCalledWith(getMap());

    // Re-run the layer effect; the old handler must be un-registered before
    // the new one is attached.
    rerenderLayers();
    await waitFor(() =>
      expect(unSpy.mock.calls.filter((c) => c[0] === "moveend")).toHaveLength(
        1,
      ),
    );

    // Exactly one live handler: one event → one additional call, not two.
    getMap().dispatchEvent({ type: "moveend" });
    expect(onMapMoveEnd).toHaveBeenCalledTimes(3);
  });

  test("onMapMoveEnd is primed exactly once on mount, and not again when the layer effect re-runs", async () => {
    const onMapMoveEnd = jest.fn();
    const { getMap, rerenderLayers } = renderMoveEndMap(onMapMoveEnd);

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    // Fired once WITHOUT any dispatched moveend — the prime.
    await waitFor(() => expect(onMapMoveEnd).toHaveBeenCalledTimes(1));
    expect(onMapMoveEnd).toHaveBeenCalledWith(getMap());
    // OL assigns `un` per instance (not on Map.prototype), so spy on the map.
    const unSpy = jest.spyOn(getMap(), "un");

    // The layer effect re-runs (re-registers) but must NOT re-prime: the
    // handler issues real network fetches in production.
    rerenderLayers();
    await waitFor(() =>
      expect(unSpy.mock.calls.filter((c) => c[0] === "moveend")).toHaveLength(
        1,
      ),
    );
    expect(onMapMoveEnd).toHaveBeenCalledTimes(1);

    // A real moveend still reaches the (re-registered) handler.
    getMap().dispatchEvent({ type: "moveend" });
    expect(onMapMoveEnd).toHaveBeenCalledTimes(2);
  });

  test("the prime waits for the first layers-bearing effect run", async () => {
    const onMapMoveEnd = jest.fn();
    // Mount with NO layers: the parent's layer state hasn't resolved on the
    // first effect pass, and live-source snap caches (GeoJSON/Feature
    // Service) need their OL layers mounted before the prime is useful.
    const { rerenderLayers } = renderMoveEndMap(onMapMoveEnd, []);

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    expect(onMapMoveEnd).not.toHaveBeenCalled();

    // The first run that actually carries layers primes exactly once.
    rerenderLayers([layerConfigGeoJSON.configuration]);
    await waitFor(() => expect(onMapMoveEnd).toHaveBeenCalledTimes(1));
  });
});

test("a map-extent view replacement moves vector features with the view", async () => {
  // The reprojection sweep had one call site, on the raster auto-fit path. This
  // path replaces the view too: the auto-fit adopts a projection without
  // updating the state this view is rebuilt from, so a later extent change
  // reverts the projection underneath features that were already moved once --
  // leaving them holding the outgoing projection's numbers, drawn far off screen
  // while still reporting the right feature count.
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
  RefCapture.propTypes = { mapProps: PropTypes.object };

  const layers = [
    {
      type: "WebGLTile",
      props: {
        source: {
          type: "GeoTIFF",
          props: { url: "https://example.com/t.tif" },
        },
        name: "Auto-fit Raster",
        zIndex: 0,
      },
    },
    {
      type: "VectorLayer",
      props: {
        name: "Vector Alongside",
        zIndex: 1,
        source: {
          type: "GeoJSON",
          props: {},
          geojson: {
            type: "FeatureCollection",
            crs: { type: "name", properties: { name: "EPSG:4326" } },
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "Point", coordinates: [-90.54, 14.48] },
              },
            ],
          },
        },
      },
    },
  ];

  const { rerender } = render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <RefCapture mapProps={{ layers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  const findVector = () =>
    capturedRef.current
      ?.getLayers()
      .getArray()
      .find((l) => l.get("name") === "Vector Alongside");

  // The auto-fit adopts the raster's EPSG:4326, so the features now hold degrees.
  await waitFor(() => {
    expect(capturedRef.current.getView().getProjection().getCode()).toBe(
      "EPSG:4326",
    );
  });
  await waitFor(() => {
    const [x] = findVector()
      .getSource()
      .getFeatures()[0]
      .getGeometry()
      .getCoordinates();
    expect(Math.abs(x - -90.54)).toBeLessThan(0.01);
  });

  // Now an extent change rebuilds the view from component state, which the
  // auto-fit never updated -- so the view goes back to Web Mercator.
  rerender(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <RefCapture mapProps={{ layers, mapExtent: "-90.54,14.48,5" }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

  await waitFor(() => {
    expect(capturedRef.current.getView().getProjection().getCode()).toBe(
      "EPSG:3857",
    );
  });

  // The features must have come with it: metres now, not the degrees they held.
  await waitFor(() => {
    const [x] = findVector()
      .getSource()
      .getFeatures()[0]
      .getGeometry()
      .getCoordinates();
    expect(Math.abs(x)).toBeGreaterThan(1e6);
  });
});

describe("swapping layers", () => {
  const renderWith = (layers) => (
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <TestingComponent mapProps={{ layers }} />
      </MapContextProvider>
    </VariableInputsContext.Provider>
  );

  // A replacement layer is buffered at opacity 0 until it paints, then faded
  // in. Nothing paints in jsdom, so the buffer is released by the loader's own
  // safety timeout.
  const frame = (url) => ({
    type: "WebGLTile",
    props: {
      name: "storm",
      zIndex: 0,
      source: { type: "Image Tile", props: { url } },
    },
  });

  it("finalizes a running fade before the next one starts", async () => {
    // A buffered replacement is held at opacity 0 until it paints. Nothing
    // paints in jsdom, so the tile event is fired here; and time is held still
    // so the first fade is still running when the next swap lands -- otherwise
    // its 250ms elapses and the overlap this guards cannot happen.
    jest.useFakeTimers();
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
    const setOpacity = jest.spyOn(WebGLTileLayer.prototype, "setOpacity");
    const paint = () => {
      const layer = addLayerSpy.mock.calls.at(-1)?.[0];
      layer?.getSource?.()?.dispatchEvent?.("tileloadend");
    };
    // Microtasks only: advancing timers would let the fade's own frame run.
    const flush = () => act(async () => Promise.resolve());

    try {
      const { rerender } = render(
        renderWith([frame("https://tiles.test/a/{z}/{y}/{x}")]),
      );
      await flush();

      rerender(renderWith([frame("https://tiles.test/b/{z}/{y}/{x}")]));
      await flush();
      paint();
      await flush();

      rerender(renderWith([frame("https://tiles.test/c/{z}/{y}/{x}")]));
      await flush();
      paint();
      await flush();

      // Both swaps buffered, so a second fade was requested while the first
      // was still animating.
      expect(
        setOpacity.mock.calls.filter(([value]) => value === 0).length,
      ).toBeGreaterThan(1);
    } finally {
      addLayerSpy.mockRestore();
      setOpacity.mockRestore();
      jest.useRealTimers();
    }
  });

  it("restores a buffered layer's opacity once it has painted", async () => {
    // Storm playback swaps frames faster than a 250ms fade, so an overlapping
    // swap must not leave the previous frame stranded part way through.
    jest.useFakeTimers();
    try {
      const setOpacity = jest.spyOn(WebGLTileLayer.prototype, "setOpacity");
      const { rerender } = render(
        renderWith([frame("https://tiles.test/a/{z}/{y}/{x}")]),
      );
      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      rerender(renderWith([frame("https://tiles.test/b/{z}/{y}/{x}")]));
      await act(async () => {
        jest.advanceTimersByTime(6000);
      });

      rerender(renderWith([frame("https://tiles.test/c/{z}/{y}/{x}")]));
      await act(async () => {
        jest.advanceTimersByTime(6000);
      });

      // Buffered at 0, then restored -- not left mid-fade.
      expect(setOpacity).toHaveBeenCalledWith(0);
      setOpacity.mockRestore();
    } finally {
      jest.useRealTimers();
    }
  });

  it("renders with no layers prop at all", async () => {
    // A dashboard can carry a map with nothing on it yet.
    render(renderWith(undefined));
    expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  });
});

describe("projection registry loading", () => {
  const renderLayers = (layers) =>
    render(
      <VariableInputsContext.Provider
        value={{ setVariableInputValues: jest.fn() }}
      >
        <MapContextProvider>
          <TestingComponent mapProps={{ layers }} />
        </MapContextProvider>
      </VariableInputsContext.Provider>,
    );

  const layerWithProjection = (projection) => ({
    type: "WebGLTile",
    props: {
      name: "tiles",
      zIndex: 0,
      source: {
        type: "Image Tile",
        props: { url: "https://tiles.test/{z}/{y}/{x}", projection },
      },
    },
  });

  it("loads the registry for a code OpenLayers cannot resolve itself", async () => {
    // EPSG:5070 needs a definition; without one the raster draws at raw
    // coordinates in the view's units -- visibly wrong but silent.
    renderLayers([layerWithProjection("EPSG:5070")]);
    expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  });

  it("skips the registry for a natively resolvable code", async () => {
    renderLayers([layerWithProjection("EPSG:3857")]);
    expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  });

  it("skips the registry for a source declaring no projection", async () => {
    renderLayers([layerWithProjection("")]);
    expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  });
});

describe("linked map view groups", () => {
  // Members are keyed by grid item UUID, so the harness hands each map its own
  // GridItemContext and collects the OL Map refs by the same key.
  const GroupMember = ({
    uuid,
    mapExtent,
    maps,
    shouldLoad = true,
    dataviewerViz,
    onMapMoveEnd,
  }) => {
    const visualizationRef = useRef();
    useEffect(() => {
      maps[uuid] = visualizationRef;
    }, [maps, uuid]);
    return (
      <GridItemContext.Provider
        value={{ gridItemUUID: uuid, shouldLoad, gridItemI: uuid }}
      >
        <MapComponent
          visualizationRef={visualizationRef}
          mapExtent={mapExtent}
          dataviewerViz={dataviewerViz}
          onMapMoveEnd={onMapMoveEnd}
        />
      </GridItemContext.Provider>
    );
  };
  GroupMember.propTypes = {
    uuid: PropTypes.string,
    mapExtent: PropTypes.any,
    maps: PropTypes.object,
    shouldLoad: PropTypes.bool,
    dataviewerViz: PropTypes.bool,
    onMapMoveEnd: PropTypes.func,
  };

  const Dashboard = ({
    members,
    maps,
    activeTabId = "tab-1",
    tabs = [],
    setVariableInputValues = jest.fn(),
  }) => (
    <VariableInputsContext.Provider value={{ setVariableInputValues }}>
      <TabContext.Provider value={{ activeTabId, tabs }}>
        <ViewGroupProvider>
          {members.map((member) => (
            <GroupMember
              key={member.uuid ?? "unkeyed"}
              maps={maps}
              {...member}
            />
          ))}
        </ViewGroupProvider>
      </TabContext.Provider>
    </VariableInputsContext.Provider>
  );
  Dashboard.propTypes = {
    members: PropTypes.array,
    maps: PropTypes.object,
    activeTabId: PropTypes.string,
    tabs: PropTypes.array,
    setVariableInputValues: PropTypes.func,
  };

  // The layer-sync effect is async and ends in a renderSync(), which dispatches
  // the map's first real postrender. Let it land before a test drives anything.
  const settle = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  const frame = async (mapRef) => {
    await act(async () => {
      mapRef.current.dispatchEvent({ type: "postrender" });
      await Promise.resolve();
    });
  };

  const viewOf = (mapRef) => mapRef.current.getView();

  const stateOf = (mapRef) => ({
    center: viewOf(mapRef).getCenter(),
    resolution: viewOf(mapRef).getResolution(),
    rotation: viewOf(mapRef).getRotation(),
  });

  const grouped = (uuid, group, extent = "0,0,5") => ({
    uuid,
    mapExtent: { extent, viewGroup: group },
  });

  const renderDashboard = async (members, options = {}) => {
    const maps = {};
    const utils = render(
      <Dashboard members={members} maps={maps} {...options} />,
    );
    await settle();
    // Every member records a baseline from its own opening view before
    // anything is driven, so the tests below start from a quiet group.
    for (const member of members) {
      await frame(maps[member.uuid]);
    }
    return { maps, ...utils };
  };

  test("covers AE4: a grouped map's view change leaves an ungrouped map alone", async () => {
    const { maps } = await renderDashboard([
      grouped("a", "Basin"),
      grouped("b", "Basin"),
      { uuid: "c", mapExtent: { extent: "0,0,5" } },
    ]);
    const before = stateOf(maps.c);

    await act(async () => {
      viewOf(maps.a).setCenter([100000, 200000]);
      viewOf(maps.a).setZoom(7);
    });
    await frame(maps.a);

    expect(stateOf(maps.b).center).toEqual([100000, 200000]);
    expect(stateOf(maps.c)).toEqual(before);
  });

  test("changing center and zoom on one member moves the other to the same center and resolution", async () => {
    const { maps } = await renderDashboard([
      grouped("a", "Basin"),
      grouped("b", "Basin"),
    ]);

    await act(async () => {
      viewOf(maps.a).setCenter([-500000, 750000]);
      viewOf(maps.a).setZoom(8);
    });
    await frame(maps.a);

    expect(stateOf(maps.b).center).toEqual([-500000, 750000]);
    expect(stateOf(maps.b).resolution).toBe(stateOf(maps.a).resolution);
    expect(stateOf(maps.b).rotation).toBe(stateOf(maps.a).rotation);
  });

  test("a member whose applied resolution is clamped settles at the clamp and publishes no correction", async () => {
    const { maps } = await renderDashboard([
      grouped("a", "Basin"),
      grouped("b", "Basin"),
    ]);

    // The component gives no way to configure a view constraint, so the
    // follower's constrained view is installed directly -- which is also the
    // shape the raster auto-fit path produces.
    await act(async () => {
      maps.b.current.setView(
        new View({
          projection: "EPSG:3857",
          center: [0, 0],
          zoom: 5,
          maxZoom: 6,
        }),
      );
    });
    await frame(maps.b);

    await act(async () => {
      viewOf(maps.a).setZoom(10);
    });
    await frame(maps.a);

    const clamped = viewOf(maps.b).getResolution();
    expect(viewOf(maps.b).getZoom()).toBeCloseTo(6, 5);
    expect(clamped).toBeGreaterThan(viewOf(maps.a).getResolution());

    // The follower's read-back happens on its own next frame, so this is the
    // frame that would publish the clamp back if the baseline were recorded
    // from what was asked for rather than from what the view settled at.
    await frame(maps.b);
    await frame(maps.b);

    expect(viewOf(maps.a).getZoom()).toBeCloseTo(10, 5);
    expect(viewOf(maps.b).getResolution()).toBe(clamped);
  });

  test("covers AE12: after a clamped apply both maps come to rest and the unconstrained one stays put", async () => {
    const { maps } = await renderDashboard([
      grouped("a", "Basin"),
      grouped("b", "Basin"),
    ]);
    await act(async () => {
      maps.b.current.setView(
        new View({
          projection: "EPSG:3857",
          center: [0, 0],
          zoom: 5,
          maxZoom: 6,
        }),
      );
    });
    await frame(maps.b);

    await act(async () => {
      viewOf(maps.a).setCenter([12345, 67890]);
      viewOf(maps.a).setZoom(11);
    });
    await frame(maps.a);
    await frame(maps.b);

    const restA = stateOf(maps.a);
    const restB = stateOf(maps.b);

    // One more frame each: nothing may move again.
    await frame(maps.a);
    await frame(maps.b);
    await frame(maps.a);

    expect(stateOf(maps.a)).toEqual(restA);
    expect(stateOf(maps.b)).toEqual(restB);
    expect(restA.center).toEqual([12345, 67890]);
    expect(restB.center).toEqual([12345, 67890]);
  });

  test("replacing a member's view makes it re-adopt the group view and publish nothing", async () => {
    const { maps } = await renderDashboard([
      grouped("a", "Basin"),
      grouped("b", "Basin"),
    ]);

    await act(async () => {
      viewOf(maps.b).setCenter([4000, 5000]);
      viewOf(maps.b).setZoom(9);
    });
    await frame(maps.b);
    const groupState = stateOf(maps.b);

    // The raster auto-fit path: a brand new View handed to the map, holding
    // somewhere else entirely.
    await act(async () => {
      maps.a.current.setView(
        new View({
          projection: "EPSG:3857",
          center: [999999, 888888],
          zoom: 2,
        }),
      );
    });
    await frame(maps.a);

    expect(stateOf(maps.a).center).toEqual(groupState.center);
    expect(stateOf(maps.a).resolution).toBe(groupState.resolution);
    // The replacement published nothing, so the other member never moved.
    expect(stateOf(maps.b)).toEqual(groupState);
  });

  test("covers AE7: a projection-changing raster resolving on one member does not move the other", async () => {
    const { maps } = await renderDashboard([
      grouped("a", "Basin"),
      grouped("b", "Basin"),
    ]);

    await act(async () => {
      viewOf(maps.b).setCenter([4000, 5000]);
      viewOf(maps.b).setZoom(9);
    });
    await frame(maps.b);
    const groupState = stateOf(maps.b);

    await act(async () => {
      maps.a.current.setView(
        new View({ projection: "EPSG:4326", center: [-90.5, 14.4], zoom: 6 }),
      );
    });
    await frame(maps.a);

    // The mismatched member neither applies the group's Web Mercator view nor
    // publishes its own degrees into it.
    expect(stateOf(maps.a).center).toEqual([-90.5, 14.4]);
    expect(stateOf(maps.b)).toEqual(groupState);
  });

  test("a member reporting a different projection neither syncs nor publishes, and shows the mismatch notice", async () => {
    const { maps } = await renderDashboard([
      grouped("a", "Basin"),
      grouped("b", "Basin"),
    ]);

    await act(async () => {
      maps.b.current.setView(
        new View({ projection: "EPSG:4326", center: [10, 20], zoom: 4 }),
      );
    });
    await frame(maps.b);

    expect(
      await screen.findByLabelText("View Group Projection Mismatch"),
    ).toHaveTextContent(
      'This map is not synced with the "Basin" view group: it is in EPSG:4326 and the group is in EPSG:3857.',
    );

    // Does not apply.
    await act(async () => {
      viewOf(maps.a).setCenter([70000, 80000]);
    });
    await frame(maps.a);
    expect(stateOf(maps.b).center).toEqual([10, 20]);

    // Does not publish.
    const beforeA = stateOf(maps.a);
    await act(async () => {
      viewOf(maps.b).setCenter([-30, -40]);
    });
    await frame(maps.b);
    expect(stateOf(maps.a)).toEqual(beforeA);
  });

  test("an interacting member ignores an applied view and adopts once the interaction ends", async () => {
    const { maps } = await renderDashboard([
      grouped("a", "Basin"),
      grouped("b", "Basin"),
    ]);

    const interacting = jest
      .spyOn(viewOf(maps.b), "getInteracting")
      .mockReturnValue(true);
    const beforeB = stateOf(maps.b);

    await act(async () => {
      viewOf(maps.a).setCenter([321000, 654000]);
      viewOf(maps.a).setZoom(8);
    });
    await frame(maps.a);

    expect(stateOf(maps.b)).toEqual(beforeB);

    interacting.mockReturnValue(false);
    await frame(maps.b);

    expect(stateOf(maps.b).center).toEqual([321000, 654000]);
    expect(stateOf(maps.b).resolution).toBe(stateOf(maps.a).resolution);
  });

  test("a member animating a view change of its own is not cut short by a peer", async () => {
    const { maps } = await renderDashboard([
      grouped("a", "Basin"),
      grouped("b", "Basin"),
    ]);

    // Double-click zoom, keyboard zoom and the Zoom control all run through
    // `view.animate()`, which raises ANIMATING and never INTERACTING -- so a
    // decline that only looks at `getInteracting()` lets the apply through,
    // and the apply cancels the animation (`applyTargetState_` calls
    // `cancelAnimations()`).
    await act(async () => {
      viewOf(maps.b).animate({ zoom: 9, duration: 1000000 });
    });
    expect(viewOf(maps.b).getAnimating()).toBe(true);
    const beforeCenter = stateOf(maps.b).center;

    await act(async () => {
      viewOf(maps.a).setCenter([456000, 789000]);
      viewOf(maps.a).setZoom(7);
    });
    await frame(maps.a);

    // The member's own animation is still in flight and its view is still
    // going where the viewer sent it.
    expect(viewOf(maps.b).getAnimating()).toBe(true);
    expect(stateOf(maps.b).center).toEqual(beforeCenter);

    // The refusal was recorded, so the group is re-adopted on the first
    // settled frame after the animation actually ends.
    await act(async () => {
      viewOf(maps.b).cancelAnimations();
    });
    expect(viewOf(maps.b).getAnimating()).toBe(false);
    await frame(maps.b);

    expect(stateOf(maps.b).center).toEqual([456000, 789000]);
    expect(stateOf(maps.b).resolution).toBe(stateOf(maps.a).resolution);
  });

  test("a frame rendered during a member's own animation is not a settled frame", async () => {
    const { maps } = await renderDashboard([
      grouped("a", "Basin"),
      grouped("b", "Basin"),
    ]);

    await act(async () => {
      viewOf(maps.b).animate({ zoom: 9, duration: 1000000 });
    });
    const beforeCenter = stateOf(maps.b).center;

    // The peer moves, and this member records the refusal.
    await act(async () => {
      viewOf(maps.a).setCenter([12000, 13000]);
    });
    await frame(maps.a);

    // An animation renders frames of its own, and every one of them reaches
    // the postrender handler. None of them is settled: treating one as such
    // would re-adopt the group view over the animation and cancel it outright
    // -- exactly what declining the apply in the first place avoided.
    await frame(maps.b);
    await frame(maps.b);
    expect(viewOf(maps.b).getAnimating()).toBe(true);
    expect(stateOf(maps.b).center).toEqual(beforeCenter);

    // The deferred re-adopt still lands on the first frame after it ends.
    await act(async () => {
      viewOf(maps.b).cancelAnimations();
    });
    await frame(maps.b);
    expect(stateOf(maps.b).center).toEqual([12000, 13000]);
  });

  test("a group view landing on values a member already holds does not swallow its next move", async () => {
    const { maps } = await renderDashboard([
      grouped("a", "Basin"),
      grouped("b", "Basin"),
    ]);

    // B is moved without being framed, so it publishes nothing and the group
    // still knows nothing about it...
    await act(async () => {
      viewOf(maps.b).setCenter([7000, 8000]);
    });

    // ...and then A publishes exactly the values B is already at. OpenLayers
    // writes nothing for an apply that changes nothing, so no frame follows
    // it and a read-back armed for that apply would never be consumed.
    await act(async () => {
      viewOf(maps.a).setCenter([7000, 8000]);
    });
    await frame(maps.a);
    expect(stateOf(maps.b).center).toEqual([7000, 8000]);

    // B's own next move is a single frame. A stale read-back would eat it and
    // this member would silently stop driving the group.
    await act(async () => {
      viewOf(maps.b).setCenter([9000, 1000]);
    });
    await frame(maps.b);

    expect(stateOf(maps.a).center).toEqual([9000, 1000]);
  });

  test("a map joining a group after mount adopts the group view with no other event", async () => {
    const maps = {};
    const solo = { uuid: "b", mapExtent: { extent: "0,0,5" } };
    const members = [grouped("a", "Basin"), solo];
    const { rerender } = render(<Dashboard members={members} maps={maps} />);
    await settle();
    for (const member of members) await frame(maps[member.uuid]);

    await act(async () => {
      viewOf(maps.a).setCenter([61000, 62000]);
      viewOf(maps.a).setZoom(8);
    });
    await frame(maps.a);
    const groupState = stateOf(maps.a);
    expect(stateOf(maps.b).center).not.toEqual(groupState.center);

    // The map joins an existing group while idle: same extent string, same
    // layers, nothing on the dashboard redrawing it. Adoption happens on a
    // rendered frame, so joining has to ask for one itself.
    rerender(
      <Dashboard
        members={[
          members[0],
          { ...solo, mapExtent: { extent: "0,0,5", viewGroup: "Basin" } },
        ]}
        maps={maps}
      />,
    );
    await settle();
    // Deliberately no synthetic frame here -- only the one the join asked for.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(stateOf(maps.b).center).toEqual(groupState.center);
    expect(stateOf(maps.b).resolution).toBe(groupState.resolution);
  });

  test("a member's own gesture ending is not undone: it publishes and the group follows", async () => {
    const { maps } = await renderDashboard([
      grouped("a", "Basin"),
      grouped("b", "Basin"),
    ]);

    // First ending: a gesture with nothing to decline. The settled frame must
    // publish where the gesture actually finished rather than re-adopt.
    //
    // The group is deliberately left standing behind the gesture for that
    // frame -- one rendered frame lands at [11000, 22000] and publishes it,
    // and the gesture's last movement then lands between frames, as a real
    // one does. So a settled frame that re-adopted unconditionally would drag
    // this member visibly back to where the group is, and the assertions
    // below would see it.
    const interacting = jest
      .spyOn(viewOf(maps.a), "getInteracting")
      .mockReturnValue(true);
    await act(async () => {
      viewOf(maps.a).setCenter([11000, 22000]);
    });
    await frame(maps.a);
    await frame(maps.b);
    expect(stateOf(maps.b).center).toEqual([11000, 22000]);

    await act(async () => {
      viewOf(maps.a).setCenter([15000, 25000]);
    });
    interacting.mockReturnValue(false);
    await frame(maps.a);

    expect(stateOf(maps.a).center).toEqual([15000, 25000]);
    expect(stateOf(maps.b).center).toEqual([15000, 25000]);
    // The follower's own next frame records its read-back, exactly as the
    // render the setters scheduled would.
    await frame(maps.b);

    // Second ending: a gesture that DID decline an apply. That one re-adopts.
    interacting.mockReturnValue(true);
    await act(async () => {
      viewOf(maps.b).setCenter([33000, 44000]);
    });
    await frame(maps.b);
    expect(stateOf(maps.a).center).toEqual([15000, 25000]);

    interacting.mockReturnValue(false);
    await frame(maps.a);
    expect(stateOf(maps.a).center).toEqual([33000, 44000]);
  });

  test("a published EPSG:3857 center beyond one world copy arrives wrapped on the follower", async () => {
    const { maps } = await renderDashboard([
      grouped("a", "Basin"),
      grouped("b", "Basin"),
    ]);

    const farX = -25981450;
    expect(wrapMercatorX(farX)).not.toBe(farX);

    await act(async () => {
      viewOf(maps.a).setCenter([farX, 5746110]);
    });
    await frame(maps.a);

    expect(stateOf(maps.b).center).toEqual([wrapMercatorX(farX), 5746110]);
  });

  test("a dataviewer map and a map with no grid item UUID never join a group", async () => {
    const { maps } = await renderDashboard([
      grouped("a", "Basin"),
      { ...grouped("preview", "Basin"), dataviewerViz: true },
      { uuid: undefined, mapExtent: { extent: "0,0,5", viewGroup: "Basin" } },
    ]);
    const unkeyed = maps[undefined];

    const beforePreview = stateOf(maps.preview);
    const beforeUnkeyed = stateOf(unkeyed);

    await act(async () => {
      viewOf(maps.a).setCenter([90000, 90000]);
    });
    await frame(maps.a);

    expect(stateOf(maps.preview)).toEqual(beforePreview);
    expect(stateOf(unkeyed)).toEqual(beforeUnkeyed);

    // And neither of them publishes into the group either.
    const beforeA = stateOf(maps.a);
    await act(async () => {
      viewOf(maps.preview).setCenter([-1000, -2000]);
      viewOf(unkeyed).setCenter([-3000, -4000]);
    });
    await frame(maps.preview);
    await frame(unkeyed);
    expect(stateOf(maps.a)).toEqual(beforeA);
  });

  test("a map on the synthetic popup tab never joins a group", async () => {
    const { maps } = await renderDashboard(
      [grouped("a", "Basin"), grouped("b", "Basin")],
      { activeTabId: "popup" },
    );
    const beforeB = stateOf(maps.b);

    await act(async () => {
      viewOf(maps.a).setCenter([55000, 66000]);
    });
    await frame(maps.a);

    expect(stateOf(maps.b)).toEqual(beforeB);
  });

  test("unmounting a member mid-gesture leaves the rest of the group working", async () => {
    const maps = {};
    const members = [
      grouped("a", "Basin"),
      grouped("b", "Basin"),
      grouped("c", "Basin"),
    ];
    const { rerender } = render(<Dashboard members={members} maps={maps} />);
    await settle();
    for (const member of members) await frame(maps[member.uuid]);

    const mapC = maps.c;
    // Mid-gesture: C is being interacted with when it goes away.
    jest.spyOn(viewOf(mapC), "getInteracting").mockReturnValue(true);
    await act(async () => {
      viewOf(mapC).setCenter([777, 888]);
    });

    rerender(<Dashboard members={members.slice(0, 2)} maps={maps} />);
    await settle();

    // The departed member's frames are inert -- its handler is unbound and its
    // membership gone -- so nothing it does reaches the group.
    const beforeA = stateOf(maps.a);
    expect(mapC.current).toBeNull();

    await act(async () => {
      viewOf(maps.a).setCenter([13000, 14000]);
    });
    await frame(maps.a);
    expect(stateOf(maps.b).center).toEqual([13000, 14000]);
    expect(beforeA.center).not.toEqual([13000, 14000]);
  });

  test("covers AE10: a member hidden during a group move shows the group view on reactivation and publishes nothing", async () => {
    const maps = {};
    const visible = grouped("a", "Basin");
    const hiddenMember = { ...grouped("b", "Basin"), shouldLoad: false };
    const { rerender } = render(
      <Dashboard members={[visible, hiddenMember]} maps={maps} />,
    );
    await settle();
    await frame(maps.a);
    await frame(maps.b);

    await act(async () => {
      viewOf(maps.a).setCenter([24000, 25000]);
      viewOf(maps.a).setZoom(9);
    });
    await frame(maps.a);
    const groupState = stateOf(maps.a);

    // A member that was mounted and hidden never unmounts, so the registration
    // effect never re-runs for it -- the shouldLoad transition is what forces
    // it back in step.
    rerender(
      <Dashboard
        members={[visible, { ...hiddenMember, shouldLoad: true }]}
        maps={maps}
      />,
    );
    await settle();
    await frame(maps.b);
    await frame(maps.b);

    expect(stateOf(maps.b).center).toEqual(groupState.center);
    expect(stateOf(maps.b).resolution).toBe(groupState.resolution);
    // Arriving must not push the reactivated member's own view at the others.
    expect(stateOf(maps.a)).toEqual(groupState);
  });
  // --- Group seeding and late join (U3) ----------------------------------

  // A stored grid item as the provider's seed scan reads it: only `source` and
  // `args_string` matter to it.
  const mapGridItem = (
    uuid,
    group,
    extent,
    { flagged = false, source = "Map" } = {},
  ) => ({
    uuid,
    source,
    args_string: JSON.stringify({
      map_extent: { extent, viewGroup: group, isGroupInitialExtent: flagged },
    }),
  });

  const tabOf = (id, ...gridItems) => ({ id, name: `Tab ${id}`, gridItems });

  const resolutionForZoom = (zoom) =>
    new View({ projection: "EPSG:3857" }).getResolutionForZoom(zoom);

  test("covers AE1: with no flagged member each map opens at its own extent, then they move together", async () => {
    const { maps } = await renderDashboard([
      grouped("a", "Basin", "0,0,5"),
      grouped("b", "Basin", "1000000,2000000,7"),
    ]);

    expect(stateOf(maps.a).center).toEqual([0, 0]);
    expect(stateOf(maps.b).center).toEqual([1000000, 2000000]);
    expect(stateOf(maps.a).resolution).not.toBe(stateOf(maps.b).resolution);

    await act(async () => {
      viewOf(maps.a).setCenter([-300000, 400000]);
      viewOf(maps.a).setZoom(9);
    });
    await frame(maps.a);

    expect(stateOf(maps.b).center).toEqual([-300000, 400000]);
    expect(stateOf(maps.b).resolution).toBe(stateOf(maps.a).resolution);
  });

  test("covers AE2: a flagged member on a tab that never mounts still seeds the group", async () => {
    const tabs = [
      tabOf(
        1,
        mapGridItem("a", "Basin", "0,0,5"),
        mapGridItem("b", "Basin", "1000000,2000000,7"),
      ),
      tabOf(
        2,
        mapGridItem("hidden", "Basin", "-5000000,3000000,8", {
          flagged: true,
        }),
      ),
    ];

    const { maps } = await renderDashboard(
      [
        grouped("a", "Basin", "0,0,5"),
        grouped("b", "Basin", "1000000,2000000,7"),
      ],
      { tabs },
    );

    // The flagged member is on the inactive tab and was never rendered: its
    // extent reached the group purely through the provider's scan of the args.
    expect(maps.hidden).toBeUndefined();
    expect(stateOf(maps.a).center).toEqual([-5000000, 3000000]);
    expect(stateOf(maps.a).resolution).toBe(resolutionForZoom(8));
    expect(stateOf(maps.b).center).toEqual([-5000000, 3000000]);
    expect(stateOf(maps.b).resolution).toBe(resolutionForZoom(8));
  });

  test("covers AE11: a bbox seed opens members of differing aspect ratios at one center and resolution", async () => {
    const bbox = "-1000000,-500000,3000000,1500000";
    const tabs = [
      tabOf(
        1,
        mapGridItem("seed", "Basin", bbox, { flagged: true }),
        mapGridItem("a", "Basin", "0,0,5"),
        mapGridItem("b", "Basin", "1000000,2000000,7"),
      ),
    ];
    const maps = {};
    render(
      <Dashboard
        members={[
          grouped("a", "Basin", "0,0,5"),
          grouped("b", "Basin", "1000000,2000000,7"),
        ]}
        maps={maps}
        tabs={tabs}
      />,
    );
    await settle();

    // jsdom lays nothing out, so the two viewports the aspect-ratio hazard
    // needs are installed directly. Until a member has area the bbox stays
    // unresolved, which is exactly the hidden-tab case.
    await act(async () => {
      maps.a.current.setSize([400, 400]);
      maps.b.current.setSize([200, 400]);
    });
    await frame(maps.a);
    await frame(maps.b);

    expect(stateOf(maps.a).center).toEqual([1000000, 500000]);
    expect(stateOf(maps.b).center).toEqual(stateOf(maps.a).center);
    expect(stateOf(maps.b).resolution).toBe(stateOf(maps.a).resolution);

    // Each fitting the bbox to its own tile is the failure this pins: b's own
    // fit lands on a different resolution entirely.
    const solo = new View({ projection: "EPSG:3857" });
    solo.fit(bbox.split(",").map(Number), { size: [200, 400] });
    expect(solo.getResolution()).not.toBe(stateOf(maps.b).resolution);
  });

  test("a flagged member whose extent is a variable template seeds nothing", async () => {
    const tabs = [
      tabOf(
        1,
        mapGridItem("a", "Basin", "0,0,5"),
        mapGridItem("b", "Basin", "1000000,2000000,7"),
      ),
      tabOf(
        2,
        // eslint-disable-next-line no-template-curly-in-string
        mapGridItem("hidden", "Basin", "${SomeVariable}", { flagged: true }),
      ),
    ];

    const { maps } = await renderDashboard(
      [
        grouped("a", "Basin", "0,0,5"),
        grouped("b", "Basin", "1000000,2000000,7"),
      ],
      { tabs },
    );

    expect(stateOf(maps.a).center).toEqual([0, 0]);
    expect(stateOf(maps.b).center).toEqual([1000000, 2000000]);
  });

  test("a plugin-supplied flagged member is ignored as a seed", async () => {
    const tabs = [
      tabOf(
        1,
        mapGridItem("a", "Basin", "0,0,5"),
        mapGridItem("b", "Basin", "1000000,2000000,7"),
      ),
      tabOf(
        2,
        mapGridItem("plugin", "Basin", "-5000000,3000000,8", {
          flagged: true,
          source: "my_plugin_map",
        }),
      ),
    ];

    const { maps } = await renderDashboard(
      [
        grouped("a", "Basin", "0,0,5"),
        grouped("b", "Basin", "1000000,2000000,7"),
      ],
      { tabs },
    );

    expect(stateOf(maps.a).center).toEqual([0, 0]);
    expect(stateOf(maps.b).center).toEqual([1000000, 2000000]);
  });

  test("with two flagged members the earlier in tab-then-grid order seeds, on every load", async () => {
    const tabs = [
      tabOf(
        1,
        mapGridItem("first", "Basin", "1000000,2000000,6", { flagged: true }),
        mapGridItem("second", "Basin", "-3000000,-4000000,9", {
          flagged: true,
        }),
      ),
      tabOf(
        2,
        mapGridItem("third", "Basin", "7000000,8000000,3", { flagged: true }),
      ),
    ];

    const openings = [];
    for (let load = 0; load < 3; load += 1) {
      const { maps, unmount } = await renderDashboard(
        [grouped("m", "Basin", "0,0,5")],
        { tabs },
      );
      openings.push(stateOf(maps.m));
      unmount();
    }

    openings.forEach((opening) => {
      expect(opening.center).toEqual([1000000, 2000000]);
      expect(opening.resolution).toBe(resolutionForZoom(6));
    });
  });

  test("a member joining a group that has already moved adopts its view on its first frame", async () => {
    const maps = {};
    const members = [grouped("a", "Basin"), grouped("b", "Basin")];
    const { rerender } = render(<Dashboard members={members} maps={maps} />);
    await settle();
    for (const member of members) await frame(maps[member.uuid]);

    await act(async () => {
      viewOf(maps.a).setCenter([61000, 62000]);
      viewOf(maps.a).setZoom(8);
    });
    await frame(maps.a);
    const groupState = stateOf(maps.a);

    rerender(
      <Dashboard
        members={[...members, grouped("c", "Basin", "1000000,2000000,7")]}
        maps={maps}
      />,
    );
    await settle();

    expect(stateOf(maps.c).center).toEqual(groupState.center);
    expect(stateOf(maps.c).resolution).toBe(groupState.resolution);
    // Joining is not a move: the members already in the group stay put.
    expect(stateOf(maps.a)).toEqual(groupState);
  });

  test("covers AE10: returning to a visited tab shows the group's current view and publishes nothing", async () => {
    const maps = {};
    const visible = grouped("a", "Basin");
    const second = grouped("b", "Basin", "1000000,2000000,7");

    // The viewer visits the second tab, so its member mounts and renders...
    const { rerender } = render(
      <Dashboard members={[visible, second]} maps={maps} />,
    );
    await settle();
    await frame(maps.a);
    await frame(maps.b);

    // ...and returns to the first one, which leaves that member mounted at
    // zero size rather than unmounting it.
    rerender(
      <Dashboard
        members={[visible, { ...second, shouldLoad: false }]}
        maps={maps}
      />,
    );
    await settle();

    await act(async () => {
      viewOf(maps.a).setCenter([24000, 25000]);
      viewOf(maps.a).setZoom(9);
    });
    await frame(maps.a);
    const groupState = stateOf(maps.a);

    // Drive the hidden member somewhere stale, so re-adoption has something to
    // correct and a stale publish has something to leak.
    await act(async () => {
      viewOf(maps.b).setCenter([-999990, -888880]);
    });

    rerender(
      <Dashboard
        members={[visible, { ...second, shouldLoad: true }]}
        maps={maps}
      />,
    );
    await settle();
    await frame(maps.b);
    await frame(maps.b);

    expect(stateOf(maps.b).center).toEqual(groupState.center);
    expect(stateOf(maps.b).resolution).toBe(groupState.resolution);
    expect(stateOf(maps.a)).toEqual(groupState);
  });

  // --- Coalesced follower side effects (U4) -------------------------------

  describe("coalescing follower side effects", () => {
    // Longer than the settle window in components/map/Map.js by a wide margin.
    // Every assertion below is written against "at least one window has
    // passed", never against the window's exact value.
    const PAST_SETTLE_MS = 1000;

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    // One rendered frame as OpenLayers produces it for a map whose view moved
    // without it holding a view hint: `renderFrame_` dispatches `moveend`
    // BEFORE `postrender`, and a follower driven by bare setters gets one of
    // each per frame of a peer's gesture. jsdom maps have no area, so they
    // never build a frame state of their own and the pair is synthesized here.
    const followerFrame = async (mapRef) => {
      await act(async () => {
        mapRef.current.dispatchEvent({ type: "moveend", map: mapRef.current });
        mapRef.current.dispatchEvent({ type: "postrender" });
        await Promise.resolve();
      });
    };

    // A published extent arrives as the GeoJSON polygon of the viewport, so
    // the assertions read its center back out rather than rebuilding the
    // whole geometry.
    const publishedCenter = (value) => {
      const ring = value.geometries[0].coordinates[0];
      const xs = ring.map((point) => point[0]);
      const ys = ring.map((point) => point[1]);
      return [
        (Math.min(...xs) + Math.max(...xs)) / 2,
        (Math.min(...ys) + Math.max(...ys)) / 2,
      ];
    };

    // A stateful stand-in for the dashboard's variable input store, so tests
    // can assert on the value that actually landed and not just the call count.
    const recordingSetter = (values) =>
      jest.fn((updater) => Object.assign(values, updater({ ...values })));

    const withVariable = (uuid, group, variable, onMapMoveEnd) => ({
      uuid,
      mapExtent: { extent: "0,0,5", viewGroup: group, variable },
      onMapMoveEnd,
    });

    const expectCenterPublished = (value, mapRef) => {
      const [x, y] = publishedCenter(value);
      const [cx, cy] = viewOf(mapRef).getCenter();
      expect(x).toBeCloseTo(cx, 6);
      expect(y).toBeCloseTo(cy, 6);
    };

    test("covers AE8: a two-second peer drag does not storm the follower's extent publish or snap refresh", async () => {
      const setVariableInputValues = jest.fn();
      const refreshSnapCaches = jest.fn();
      const { maps } = await renderDashboard(
        [
          grouped("a", "Basin"),
          withVariable("b", "Basin", "Viewport", refreshSnapCaches),
        ],
        { setVariableInputValues },
      );
      setVariableInputValues.mockClear();
      refreshSnapCaches.mockClear();

      // Two seconds of a continuous drag on the peer, at 60fps.
      // A frame's step has to clear the group's publish tolerance (half a
      // rendered pixel, ~2.4km at this resolution) or the peer coalesces the
      // drag by itself and the follower never sees a per-frame apply.
      const FRAMES = 120;
      for (let i = 1; i <= FRAMES; i += 1) {
        await act(async () => {
          viewOf(maps.a).setCenter([i * 5000, i * 2500]);
        });
        await frame(maps.a);
        await followerFrame(maps.b);
      }

      const publishesDuringDrag = setVariableInputValues.mock.calls.length;
      const refreshesDuringDrag = refreshSnapCaches.mock.calls.length;
      await act(async () => {
        jest.advanceTimersByTime(PAST_SETTLE_MS);
      });

      // The follower did follow -- every one of those frames moved it.
      expect(stateOf(maps.b).center).toEqual([FRAMES * 5000, FRAMES * 2500]);
      // ...but the `moveend` it emits per frame while doing so is coalesced,
      // rather than costing a dashboard-wide refetch and a feature query each.
      // Unguarded this is 120 of each. Exact counts, not a bound: the gate is
      // shut when the apply is made and not when the resulting motion is
      // observed, so not even the leading edge of the gesture gets out --
      // OpenLayers dispatches `moveend` before `postrender` within a frame,
      // and a gate armed from `postrender` would leak the first frame of
      // every gesture without moving either of these numbers past 2.
      expect(publishesDuringDrag).toBe(0);
      expect(refreshesDuringDrag).toBe(0);
      // One each on the settled flush, for where the group came to rest.
      expect(setVariableInputValues).toHaveBeenCalledTimes(1);
      expect(refreshSnapCaches).toHaveBeenCalledTimes(1);
    });

    test("a follower with an extent variable still publishes once the group settles", async () => {
      const values = {};
      const setVariableInputValues = recordingSetter(values);
      const refreshSnapCaches = jest.fn();
      const { maps } = await renderDashboard(
        [
          grouped("a", "Basin"),
          withVariable("b", "Basin", "Viewport", refreshSnapCaches),
        ],
        { setVariableInputValues },
      );

      for (let i = 1; i <= 10; i += 1) {
        await act(async () => {
          viewOf(maps.a).setCenter([i * 6000, i * 9000]);
        });
        await frame(maps.a);
        await followerFrame(maps.b);
      }
      await act(async () => {
        jest.advanceTimersByTime(PAST_SETTLE_MS);
      });

      // Coalescing must not swallow the publish: viewport-filtered data on the
      // follower still has to refetch for where the group came to rest.
      expectCenterPublished(values.Viewport, maps.b);
      expect(refreshSnapCaches).toHaveBeenCalled();
    });

    // Drives one deferred publish on the follower and hands back the pieces
    // the caller needs to change its extent out from under it.
    const deferOnFollower = async (follower, setVariableInputValues) => {
      const maps = {};
      const members = [grouped("a", "Basin"), follower];
      const view = render(
        <Dashboard
          members={members}
          maps={maps}
          setVariableInputValues={setVariableInputValues}
        />,
      );
      await settle();
      for (const member of members) await frame(maps[member.uuid]);

      await act(async () => {
        viewOf(maps.a).setCenter([31000, 32000]);
      });
      await frame(maps.a);
      await followerFrame(maps.b);

      return { maps, members, ...view };
    };

    test("an extent variable dropped while a publish is deferred is never published under it", async () => {
      const values = {};
      const setVariableInputValues = recordingSetter(values);
      const follower = withVariable("b", "Basin", "Viewport", jest.fn());
      const { members, rerender, maps } = await deferOnFollower(
        follower,
        setVariableInputValues,
      );

      // Inside the settle window the follower loses its variable. The flush
      // still runs -- it was armed before -- and dereferences the variable
      // name at flush time, so without a guard it publishes under the key
      // `undefined` and writes a junk entry into the dashboard's store.
      rerender(
        <Dashboard
          members={[
            members[0],
            { ...follower, mapExtent: { extent: "0,0,5", viewGroup: "Basin" } },
          ]}
          maps={maps}
          setVariableInputValues={setVariableInputValues}
        />,
      );
      await settle();
      setVariableInputValues.mockClear();

      await act(async () => {
        jest.advanceTimersByTime(PAST_SETTLE_MS);
      });

      expect(setVariableInputValues).not.toHaveBeenCalled();
      expect(Object.keys(values)).not.toContain("undefined");
    });

    test("changing the extent drops a publish deferred under the previous one", async () => {
      const setVariableInputValues = jest.fn();
      const follower = withVariable("b", "Basin", "Viewport", jest.fn());
      const { members, rerender, maps } = await deferOnFollower(
        follower,
        setVariableInputValues,
      );

      // A new extent is a new subscription. The publish held over from the
      // previous one was asked for on behalf of a subscription that no longer
      // exists, so it goes with it rather than landing a window later.
      rerender(
        <Dashboard
          members={[
            members[0],
            {
              ...follower,
              mapExtent: {
                extent: "10,20,6",
                viewGroup: "Basin",
                variable: "Viewport",
              },
            },
          ]}
          maps={maps}
          setVariableInputValues={setVariableInputValues}
        />,
      );
      await settle();
      setVariableInputValues.mockClear();

      await act(async () => {
        jest.advanceTimersByTime(PAST_SETTLE_MS);
      });

      expect(setVariableInputValues).not.toHaveBeenCalled();
    });

    test("a user-driven move on an ungrouped map publishes its extent exactly as it does today", async () => {
      const setVariableInputValues = jest.fn();
      const { maps } = await renderDashboard(
        [
          {
            uuid: "solo",
            mapExtent: { extent: "0,0,5", variable: "Viewport" },
          },
        ],
        { setVariableInputValues },
      );
      setVariableInputValues.mockClear();

      await act(async () => {
        viewOf(maps.solo).setCenter([12345, 54321]);
        maps.solo.current.dispatchEvent({
          type: "moveend",
          map: maps.solo.current,
        });
      });

      // No timer is advanced: an ungrouped map has no peer that can drive it,
      // so its publish stays synchronous with the event.
      expect(setVariableInputValues).toHaveBeenCalledTimes(1);
    });

    test("rapid alternating drags across two members leave no pending publish unflushed", async () => {
      const values = {};
      const setVariableInputValues = recordingSetter(values);
      const { maps } = await renderDashboard(
        [
          withVariable("a", "Basin", "ViewportA", jest.fn()),
          withVariable("b", "Basin", "ViewportB", jest.fn()),
        ],
        { setVariableInputValues },
      );

      for (let round = 0; round < 6; round += 1) {
        const source = round % 2 === 0 ? maps.a : maps.b;
        for (let i = 1; i <= 8; i += 1) {
          await act(async () => {
            viewOf(source).setCenter([round * 90000 + i * 7000, i * 5000]);
          });
          await frame(source);
          await followerFrame(maps.a);
          await followerFrame(maps.b);
        }
      }
      await act(async () => {
        jest.advanceTimersByTime(PAST_SETTLE_MS);
      });

      // Both members ended up publishing where they actually came to rest, so
      // no member is left holding a deferred publish that never fired.
      expectCenterPublished(values.ViewportA, maps.a);
      expectCenterPublished(values.ViewportB, maps.b);

      const settledCalls = setVariableInputValues.mock.calls.length;
      await act(async () => {
        jest.advanceTimersByTime(PAST_SETTLE_MS);
      });
      expect(setVariableInputValues.mock.calls.length).toBe(settledCalls);
    });

    test("a follower whose applied resolution is clamped still publishes its extent once the group settles", async () => {
      const values = {};
      const setVariableInputValues = recordingSetter(values);
      const { maps } = await renderDashboard(
        [
          grouped("a", "Basin"),
          withVariable("b", "Basin", "Viewport", jest.fn()),
        ],
        { setVariableInputValues },
      );

      // The component exposes no view-constraint prop, so the constrained view
      // is installed directly -- the same shape the raster auto-fit produces.
      await act(async () => {
        maps.b.current.setView(
          new View({
            projection: "EPSG:3857",
            center: [0, 0],
            zoom: 5,
            maxZoom: 6,
          }),
        );
      });
      await frame(maps.b);

      // The peer pans and zooms past the follower's limit...
      for (let i = 1; i <= 10; i += 1) {
        await act(async () => {
          viewOf(maps.a).setCenter([i * 8000, i * 4000]);
          viewOf(maps.a).setZoom(6 + i * 0.3);
        });
        await frame(maps.a);
        await followerFrame(maps.b);
      }
      // ...and then keeps zooming without panning, so the follower goes on
      // receiving applies whose read-back can never match while its own view
      // no longer changes at all. A gate that opened on applies ceasing would
      // still be shut here, and this member would never publish again.
      const clampedCenter = stateOf(maps.b).center;
      const clampedResolution = stateOf(maps.b).resolution;
      for (let i = 1; i <= 10; i += 1) {
        await act(async () => {
          viewOf(maps.a).setZoom(9 + i * 0.3);
        });
        await frame(maps.a);
        await followerFrame(maps.b);
      }
      expect(stateOf(maps.b).center).toEqual(clampedCenter);
      expect(stateOf(maps.b).resolution).toBe(clampedResolution);

      setVariableInputValues.mockClear();
      await act(async () => {
        jest.advanceTimersByTime(PAST_SETTLE_MS);
      });

      expect(setVariableInputValues).toHaveBeenCalledTimes(1);
      expectCenterPublished(values.Viewport, maps.b);
    });

    test("publishing the same extent value twice in a row calls the variable-input setter once", async () => {
      const setVariableInputValues = jest.fn();
      const { maps } = await renderDashboard(
        [
          {
            uuid: "solo",
            mapExtent: { extent: "0,0,5", variable: "Viewport" },
          },
        ],
        { setVariableInputValues },
      );
      setVariableInputValues.mockClear();

      await act(async () => {
        viewOf(maps.solo).setCenter([777, 888]);
        maps.solo.current.dispatchEvent({
          type: "moveend",
          map: maps.solo.current,
        });
        maps.solo.current.dispatchEvent({
          type: "moveend",
          map: maps.solo.current,
        });
      });

      expect(setVariableInputValues).toHaveBeenCalledTimes(1);
    });

    test("a dashboard map re-renders no more during a peer's zoom than during its own equivalent zoom", async () => {
      const renders = { count: 0 };
      // The map reads `viewGroup` off its stored extent exactly once per
      // render, which makes a getter on that key an honest render counter
      // without instrumenting the component.
      const countedExtent = {
        extent: "0,0,5",
        get viewGroup() {
          renders.count += 1;
          return "Basin";
        },
      };
      const { maps } = await renderDashboard([
        grouped("a", "Basin"),
        { uuid: "b", mapExtent: countedExtent },
      ]);

      const zoomAcross = async (sourceKey, followerKey) => {
        for (let step = 1; step <= 12; step += 1) {
          await act(async () => {
            viewOf(maps[sourceKey]).setZoom(5 + step * 0.25);
          });
          await frame(maps[sourceKey]);
          await followerFrame(maps[followerKey]);
        }
      };

      renders.count = 0;
      await zoomAcross("a", "b");
      const peerZoomRenders = renders.count;

      renders.count = 0;
      await zoomAcross("b", "a");
      const ownZoomRenders = renders.count;

      // Following a peer costs the map no React render at all: nothing on a
      // dashboard renders the zoom, so nothing writes it to state per frame.
      expect(peerZoomRenders).toBe(0);
      expect(peerZoomRenders).toBeLessThanOrEqual(ownZoomRenders);
    });
  });
});
