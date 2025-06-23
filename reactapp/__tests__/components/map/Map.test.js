import { useRef, useState, useEffect } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MapComponent from "components/map/Map";
import PropTypes from "prop-types";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import { Map } from "ol";
import createLoadedComponent, {
  InputVariablePComponent,
} from "__tests__/utilities/customRender";

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
        })
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
  const loadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent />
      </MapContextProvider>
    ),
  });

  render(loadedComponent);

  const mapDiv = await screen.findByLabelText("Map Div");
  expect(mapDiv).toBeInTheDocument();
  expect(mapDiv).toHaveStyle("width: 100%");

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(async () => {
    expect(await screen.findByTestId("map-view")).toHaveTextContent(
      JSON.stringify({
        zoom: 4.5,
        center: [-10686671.12, 4721671.57],
      })
    );
  });

  expect(screen.queryByLabelText("Map Legend")).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Show Layers Control")
  ).not.toBeInTheDocument();
});

test("Default Map with layer control and legend", async () => {
  const loadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent mapProps={{ layerControl: true, legend: [] }} />
      </MapContextProvider>
    ),
  });

  render(loadedComponent);

  expect(screen.queryByLabelText("Map Legend")).not.toBeInTheDocument();
  expect(
    await screen.findByLabelText("Show Layers Control")
  ).toBeInTheDocument();
});

test("Custom Map Config and View Config", async () => {
  let loadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: { style: { width: "50%" } },
            mapExtent: { extent: "-10686671.12, 4721671.57, 7" },
          }}
        />
      </MapContextProvider>
    ),
  });

  const { rerender } = render(loadedComponent);

  const mapDiv = await screen.findByLabelText("Map Div");
  expect(mapDiv).toBeInTheDocument();
  expect(mapDiv).toHaveStyle("width: 50%");
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  expect(await screen.findByTestId("map-view")).toHaveTextContent(
    JSON.stringify({
      zoom: 7,
      center: [-10686671.12, 4721671.57],
    })
  );

  loadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: { style: { width: "50%" } },
            mapExtent: { extent: "-10686671.12, 4721671.57, 8" },
          }}
        />
      </MapContextProvider>
    ),
  });

  rerender(loadedComponent);

  expect(await screen.findByTestId("map-view")).toHaveTextContent(
    JSON.stringify({
      zoom: 8,
      center: [-10686671.12, 4721671.57],
    })
  );
});

test("Custom bounding box map extent", async () => {
  const loadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: { style: { width: "50%" } },
            mapExtent: { extent: "10, 20, 30, 40" },
          }}
        />
      </MapContextProvider>
    ),
  });

  render(loadedComponent);

  const mapDiv = await screen.findByLabelText("Map Div");
  expect(mapDiv).toBeInTheDocument();
  expect(mapDiv).toHaveStyle("width: 50%");
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  expect(await screen.findByTestId("map-view")).toHaveTextContent(
    JSON.stringify({ zoom: 19.578127880157357, center: [20, 30] })
  );
});

test("Custom bounding box map extent with variable", async () => {
  const loadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: { style: { width: "50%" } },
            mapExtent: { extent: "10, 20, 30, 40", variable: "test" },
            onMapMove: true,
          }}
        />
        <InputVariablePComponent />
      </MapContextProvider>
    ),
  });

  render(loadedComponent);

  const mapDiv = await screen.findByLabelText("Map Div");
  expect(mapDiv).toBeInTheDocument();
  expect(mapDiv).toHaveStyle("width: 50%");
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  expect(await screen.findByTestId("map-view")).toHaveTextContent(
    JSON.stringify({ zoom: 19.578127880157357, center: [20, 30] })
  );

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
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
    })
  );
});

test("Map Layers and Updated Layers", async () => {
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
    },
  ];

  const loadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent mapProps={{ layers }} />
      </MapContextProvider>
    ),
  });

  render(loadedComponent);

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(2);
  });

  expect(addLayerSpy.mock.calls[0][0].values_.name).toBe(
    "World Light Gray Base"
  );
  expect(addLayerSpy.mock.calls[1][0].values_.name).toBe("esri");
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

  const loadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent mapProps={{ layers }} />
      </MapContextProvider>
    ),
  });

  render(loadedComponent);

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(2);
  });

  expect(addLayerSpy.mock.calls[0][0].values_.name).toBe(
    "World Light Gray Base"
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

  let loadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent mapProps={{ layers }} />
      </MapContextProvider>
    ),
  });

  const { rerender } = render(loadedComponent);

  const warningMessage = await screen.findByText(
    'Failed to load the "Base Layer, Image Layer" layer(s)'
  );
  expect(warningMessage).toBeInTheDocument();
  const alertCloseButton = await screen.findByLabelText("Close alert");
  fireEvent.click(alertCloseButton);
  expect(
    screen.queryByText('Failed to load the "Base Layer, Image Layer" layer(s)')
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

  loadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent mapProps={{ layers: updatedLayers }} />
      </MapContextProvider>
    ),
  });

  rerender(loadedComponent);

  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });

  expect(addLayerSpy.mock.calls[0][0].values_.name).toBe(
    "World Light Gray Base"
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

  loadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent mapProps={{ layers: updatedLayers }} />
      </MapContextProvider>
    ),
  });

  rerender(loadedComponent);

  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(2);
  });
  await waitFor(() => {
    expect(removeLayerSpy.mock.calls.length).toBe(1);
  });

  expect(addLayerSpy.mock.calls[1][0].values_.name).toBe("esri");
  expect(removeLayerSpy.mock.calls[0][0].values_.name).toBe(
    "World Light Gray Base"
  );
});

test("Map Layer Styles", async () => {
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
    createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent mapProps={{ layers }} />
        </MapContextProvider>
      ),
    })
  );

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });

  expect(addLayerSpy.mock.calls[0][0].values_.name).toBe(
    "World Light Gray Base"
  );
});

TestingComponent.propTypes = {
  mapProps: PropTypes.shape({
    onMapClick: PropTypes.bool,
    onMapMove: PropTypes.bool,
    layers: PropTypes.array,
  }),
};
