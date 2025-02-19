import { useRef, useState, useEffect } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MapComponent from "components/map/Map";
import PropTypes from "prop-types";

global.ResizeObserver = require("resize-observer-polyfill");

const TestingComponent = ({ expectedLayerCount, mapProps }) => {
  const visualizationRef = useRef();
  const [mapReady, setMapReady] = useState(false);
  const [layers, setLayers] = useState();
  const [view, setView] = useState();

  useEffect(() => {
    let isMounted = true;
    setMapReady(false);

    const fetchMapData = () => {
      if (visualizationRef.current) {
        const newView = visualizationRef.current.getView();
        setView(
          JSON.stringify({
            zoom: newView.getZoom(),
            center: newView.getCenter(),
          })
        );

        const mapLayers = visualizationRef.current
          .getLayers()
          .getArray()
          .map((item) => item.get("name"));
        setLayers(mapLayers.join(","));
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
    if (mapProps?.onMapClick && mapReady) {
      var evt = {};
      evt.type = "singleclick";
      evt.coordinate = [];
      evt.coordinate[0] = 6633511;
      evt.coordinate[1] = 4079902;
      visualizationRef.current.dispatchEvent(evt);
    }
    // eslint-disable-next-line
  }, [mapReady]);

  return (
    <div>
      <MapComponent visualizationRef={visualizationRef} {...mapProps} />
      <>
        <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
        <p data-testid="map-view">{view}</p>
        <p data-testid="map-layers">{layers}</p>
      </>
    </div>
  );
};

test("Default Map", async () => {
  render(<TestingComponent />);

  const mapDiv = await screen.findByLabelText("Map Div");
  expect(mapDiv).toBeInTheDocument();
  expect(mapDiv).toHaveStyle("width: 100%");

  expect(await screen.findByTestId("map-view")).toHaveTextContent(
    JSON.stringify({
      zoom: 4.5,
      center: [-10686671.116154263, 4721671.572580108],
    })
  );

  const mapPopup = await screen.findByLabelText("Map Popup");
  expect(mapPopup).toBeInTheDocument();

  const mapPopupContent = await screen.findByLabelText("Map Popup Content");
  expect(mapPopupContent).toBeInTheDocument();
  // eslint-disable-next-line
  expect(mapPopupContent.children.length).toBe(0);

  expect(screen.queryByLabelText("Map Legend")).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Show Layers Control")
  ).not.toBeInTheDocument();
});

test("Default Map with layer control and legend", async () => {
  render(<TestingComponent mapProps={{ layerControl: true, legend: [] }} />);

  expect(await screen.findByLabelText("Map Legend")).toBeInTheDocument();
  expect(
    await screen.findByLabelText("Show Layers Control")
  ).toBeInTheDocument();
});

test("Custom Map Config and View Config", async () => {
  const { rerender } = render(
    <TestingComponent
      mapProps={{
        mapConfig: { style: { width: "50%" } },
        viewConfig: { zoom: 7 },
      }}
    />
  );

  const mapDiv = await screen.findByLabelText("Map Div");
  expect(mapDiv).toBeInTheDocument();
  expect(mapDiv).toHaveStyle("width: 50%");

  expect(await screen.findByTestId("map-view")).toHaveTextContent(
    JSON.stringify({
      zoom: 7,
      center: [-10686671.116154263, 4721671.572580108],
    })
  );

  rerender(
    <TestingComponent
      mapProps={{
        mapConfig: { style: { width: "50%" } },
        viewConfig: { zoom: 7 },
      }}
    />
  );
  expect(await screen.findByTestId("map-view")).toHaveTextContent(
    JSON.stringify({
      zoom: 7,
      center: [-10686671.116154263, 4721671.572580108],
    })
  );
});

test("Map Layers and Updated Layers", async () => {
  const layers = [
    {
      type: "WebGLTile",
      props: {
        source: {
          type: "ImageTile",
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
          type: "ImageArcGISRest",
          props: {
            url: "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",
          },
        },
        zIndex: 1,
      },
    },
  ];

  render(<TestingComponent expectedLayerCount={2} mapProps={{ layers }} />);
  await waitFor(
    () => {
      expect(screen.getByText("Map Ready")).toBeInTheDocument();
    },
    { timeout: 2000 }
  );
  expect(await screen.findByTestId("map-layers")).toHaveTextContent(
    "World Light Gray Base,esri"
  );
});

test("Bad Map Layers", async () => {
  const layers = [
    {
      type: "WeTile",
      props: {
        source: {
          type: "ImageTile",
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
          type: "ImageArcGISRest",
          props: {
            url: "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",
          },
        },
        zIndex: 1,
      },
    },
  ];

  const { rerender } = render(<TestingComponent mapProps={{ layers }} />);

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
          type: "ImageTile",
          props: {
            url: "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          },
        },
        name: "World Light Gray Base",
        zIndex: 0,
      },
    },
  ];

  const mockMapClick = jest.fn((map, evt, setPopupContent, popup) => {
    setPopupContent("The map was clicked");
  });
  rerender(
    <TestingComponent
      expectedLayerCount={1}
      mapProps={{ layers: updatedLayers, onMapClick: mockMapClick }}
    />
  );
  await waitFor(
    () => {
      expect(screen.getByText("Map Not Ready")).toBeInTheDocument();
    },
    { timeout: 2000 }
  );
  await waitFor(
    () => {
      expect(screen.getByText("Map Ready")).toBeInTheDocument();
    },
    { timeout: 2000 }
  );
  expect(await screen.findByTestId("map-layers")).toHaveTextContent(
    "World Light Gray Base"
  );
  await waitFor(() => {
    expect(mockMapClick).toHaveBeenCalled();
  });
  expect(await screen.findByText("The map was clicked")).toBeInTheDocument();

  const popupCloser = await screen.findByLabelText("Popup Closer");
  fireEvent.click(popupCloser);
  expect(screen.queryByText("The map was clicked")).not.toBeInTheDocument();

  updatedLayers = [
    {
      type: "ImageLayer",
      props: {
        name: "esri",
        source: {
          type: "ImageArcGISRest",
          props: {
            url: "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",
          },
        },
        zIndex: 1,
      },
    },
  ];

  rerender(
    <TestingComponent
      expectedLayerCount={1}
      mapProps={{ layers: updatedLayers }}
    />
  );
  await waitFor(
    () => {
      expect(screen.getByText("Map Not Ready")).toBeInTheDocument();
    },
    { timeout: 2000 }
  );
  await waitFor(
    () => {
      expect(screen.getByText("Map Ready")).toBeInTheDocument();
    },
    { timeout: 2000 }
  );
  expect(await screen.findByTestId("map-layers")).toHaveTextContent("esri");
});

test("Map Layer Styles", async () => {
  const layers = [
    {
      type: "WebGLTile",
      props: {
        source: {
          type: "ImageTile",
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

  render(<TestingComponent expectedLayerCount={1} mapProps={{ layers }} />);

  await waitFor(
    () => {
      expect(screen.getByText("Map Ready")).toBeInTheDocument();
    },
    { timeout: 2000 }
  );
  expect(await screen.findByTestId("map-layers")).toHaveTextContent(
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
