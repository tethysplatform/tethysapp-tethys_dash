import { useRef, useState, useEffect, act } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MapComponent from "components/map/Map";
import { debug } from "jest-preview";

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
  }, [mapProps]);

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
  expect(mapPopupContent.children.length).toBe(0);
});

test("Custom Map Config and View Config", async () => {
  render(
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
  expect(await screen.findByTestId("map-layers")).toHaveTextContent(
    "World Light Gray Base"
  );

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
