import { useRef, useState, useEffect } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MapComponent from "components/map/Map";
import PropTypes from "prop-types";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import { Map } from "ol";

global.ResizeObserver = require("resize-observer-polyfill");

const TestingComponent = ({ expectedLayerCount, mapProps }) => {
  const visualizationRef = useRef();
  const { mapReady } = useMapContext();
  const [view, setView] = useState();

  useEffect(() => {
    if (mapProps?.onMapClick && mapReady) {
      var evt = {};
      evt.type = "singleclick";
      evt.coordinate = [];
      evt.coordinate[0] = 6633511;
      evt.coordinate[1] = 4079902;
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
  render(
    <MapContextProvider>
      <TestingComponent />
    </MapContextProvider>
  );

  const mapDiv = await screen.findByLabelText("Map Div");
  expect(mapDiv).toBeInTheDocument();
  expect(mapDiv).toHaveStyle("width: 100%");

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  expect(await screen.findByTestId("map-view")).toHaveTextContent(
    JSON.stringify({
      zoom: 4.5,
      center: [-10686671.12, 4721671.57],
    })
  );

  expect(screen.queryByLabelText("Map Legend")).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Show Layers Control")
  ).not.toBeInTheDocument();
});

test("Default Map with layer control and legend", async () => {
  render(
    <MapContextProvider>
      <TestingComponent mapProps={{ layerControl: true, legend: [] }} />
    </MapContextProvider>
  );

  expect(screen.queryByLabelText("Map Legend")).not.toBeInTheDocument();
  expect(
    await screen.findByLabelText("Show Layers Control")
  ).toBeInTheDocument();
});

test("Custom Map Config and View Config", async () => {
  const { rerender } = render(
    <MapContextProvider>
      <TestingComponent
        mapProps={{
          mapConfig: { style: { width: "50%" } },
          mapExtent: "-10686671.12, 4721671.57, 7}",
        }}
      />
    </MapContextProvider>
  );

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

  rerender(
    <MapContextProvider>
      <TestingComponent
        mapProps={{
          mapConfig: { style: { width: "50%" } },
          viewConfig: { zoom: 7 },
        }}
      />
    </MapContextProvider>
  );
  expect(await screen.findByTestId("map-view")).toHaveTextContent(
    JSON.stringify({
      zoom: 7,
      center: [-10686671.12, 4721671.57],
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

  render(
    <MapContextProvider>
      <TestingComponent expectedLayerCount={2} mapProps={{ layers }} />
    </MapContextProvider>
  );

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(2);
  });

  expect(addLayerSpy.mock.calls[0][0].values_.name).toBe(
    "World Light Gray Base"
  );
  expect(addLayerSpy.mock.calls[1][0].values_.name).toBe("esri");
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
    <MapContextProvider>
      <TestingComponent mapProps={{ layers }} />
    </MapContextProvider>
  );

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

  rerender(
    <MapContextProvider>
      <TestingComponent
        expectedLayerCount={1}
        mapProps={{ layers: updatedLayers }}
      />
    </MapContextProvider>
  );

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

  rerender(
    <MapContextProvider>
      <TestingComponent
        expectedLayerCount={1}
        mapProps={{ layers: updatedLayers }}
      />
    </MapContextProvider>
  );

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
    <MapContextProvider>
      <TestingComponent expectedLayerCount={1} mapProps={{ layers }} />
    </MapContextProvider>
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
  expectedLayerCount: PropTypes.number,
  mapProps: PropTypes.shape({
    onMapClick: PropTypes.func,
    layers: PropTypes.array,
  }),
};
