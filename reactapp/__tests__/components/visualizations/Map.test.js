// MapVisualization: layers, legends, basemaps and runtime layers. Shares its
// harness with MapClick, MapHover and MapLinkedViews, which were one file;
// split so the four run in parallel instead of one worker taking a minute.
import {
  mockRasterLegendStore,
  mockRenderedLegends,
  mockedApplyStyle,
  mockedQueryLayerFeatures,
  mockedSwapVectorLayerFeatures,
  exampleGeoJSON,
  exampleStyle,
  exampleRuleBasedStyle,
  TestingComponent,
  BASE_MAP_A,
  BASE_MAP_B,
  renderMapWithLayers,
  zarrRampLayer,
  zarrSlice,
} from "__tests__/utilities/mapVisualizationHarness";
import { useRef, useState } from "react";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";
import createLoadedComponent from "__tests__/utilities/customRender";
import PropTypes from "prop-types";
import { Map } from "ol";
import ImageArcGISRest from "ol/source/ImageArcGISRest.js";
import { Vector as VectorSource } from "ol/source.js";
import { GridItemContext } from "components/contexts/Contexts";
import appAPI from "services/api/app";
import Point from "ol/geom/Point.js";
import Overlay from "ol/Overlay";
import {
  layerConfigImageArcGISRest,
  dynamicMapLayer,
} from "__tests__/utilities/constants";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import { WebsocketContext } from "components/contexts/WebSocketContext";
import { resolveRamp } from "components/map/colorRamps";
import { readSlice } from "components/map/zarrReader";
import MapVisualization from "components/visualizations/Map";
import {
  createJsonStyleFunction,
  clearClientSourceCaches,
} from "components/map/ModuleLoader";
import { fromUrl } from "geotiff";

// The GeoParquet/Zarr read caches are module-scoped and live for the page's
// lifetime by design, so each test must start from an empty one.
beforeEach(() => {
  clearClientSourceCaches();
});

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
  // A rule-based style goes straight to the style function now. It used to
  // reach createJsonStyleFunction only via the catch of a failed applyStyle
  // attempt, which also meant a layer carrying a label but no rules never got
  // styled at all. ol-mapbox-style is still used for Mapbox style documents.
  expect(mockedApplyStyle).toHaveBeenCalledTimes(0);
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

test("Map GeoJSON with default legend and no style emits a single default swatch", async () => {
  // A styleless client vector has no symbology to describe, so the default
  // legend used to come out empty. It now shows one swatch titled by the layer
  // name (geojson passed inline so no downloadJSON round-trip is needed).
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const layers = [
    {
      configuration: {
        type: "VectorLayer",
        props: {
          name: "Plain GeoJSON",
          source: { type: "GeoJSON", props: {}, geojson: exampleGeoJSON },
        },
        // deliberately no style
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

  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  fireEvent.click(await screen.findByLabelText("Show Legend Control"));
  // The swatch's title is the layer name...
  expect(await screen.findByText("Plain GeoJSON")).toBeInTheDocument();
  // ...and the symbol is a circle (matching the default point style, since the
  // inline GeoJSON's feature is a Point) in the default stroke color.
  expect(await screen.findByLabelText("#3399CC-circle")).toBeInTheDocument();
});

test.each([
  [
    "a line",
    {
      type: "LineString",
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    },
    "linestring",
  ],
  [
    "a polygon",
    {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [0, 0],
        ],
      ],
    },
    "#3399CC-square",
  ],
  [
    // A geometry type that is neither point/line/polygon falls back to a circle.
    "a geometry collection",
    { type: "GeometryCollection", geometries: [] },
    "#3399CC-circle",
  ],
])(
  "default legend swatch matches %s geometry (inline GeoJSON)",
  async (_label, geometry, expectedSwatchLabel) => {
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
    const geojson = {
      type: "FeatureCollection",
      crs: { type: "name", properties: { name: "EPSG:3857" } },
      features: [{ type: "Feature", geometry, properties: {} }],
    };
    const layers = [
      {
        configuration: {
          type: "VectorLayer",
          props: {
            name: "Plain Vector",
            source: { type: "GeoJSON", props: {}, geojson },
          },
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

    await waitFor(() => {
      expect(addLayerSpy.mock.calls.length).toBe(1);
    });
    fireEvent.click(await screen.findByLabelText("Show Legend Control"));
    expect(
      await screen.findByLabelText(expectedSwatchLabel),
    ).toBeInTheDocument();
  },
);

test("default legend swatch is a circle for a URL GeoJSON source (geometry unknown)", async () => {
  // A URL source is handed to OL as a URL and not fetched at legend-build time,
  // so its geometry is unknown; the swatch falls back to a circle.
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const layers = [
    {
      configuration: {
        type: "VectorLayer",
        props: {
          name: "URL GeoJSON",
          source: {
            type: "GeoJSON",
            props: {},
            geojson: "https://example.com/features.geojson",
          },
        },
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

  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  fireEvent.click(await screen.findByLabelText("Show Legend Control"));
  expect(await screen.findByLabelText("#3399CC-circle")).toBeInTheDocument();
});

test("Map GeoTIFF with default legend shows a 0..1 colorbar when normalized with no range", async () => {
  // geotiff.fromUrl is mocked (returns undefined), so applyAutoRamp's header
  // read fails and the raster stays normalized with no resolved min/max. The
  // ramp legend should still render, labelled 0..1, rather than coming out empty.
  const layer = {
    configuration: {
      type: "WebGLTile",
      props: {
        name: "Normalized Raster",
        source: {
          type: "GeoTIFF",
          props: { url: "https://example.com/norm.tif", normalize: true },
        },
      },
      // The layer's saved style is its ramp settings; no bounds, so the ramp
      // is fitted to the file -- or stays on 0..1 when that read fails.
      style: {
        rampName: "viridis",
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

  fireEvent.click(await screen.findByLabelText("Show Legend Control"));
  expect(
    await screen.findByLabelText("Color ramp from 0 to 1"),
  ).toBeInTheDocument();
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
  // Covers lines 353-360: when a GeoTIFF layer's saved style carries
  // rampName/rampMin/rampMax, `legend: "default"` should bypass the
  // style/url legend paths and produce a colorbar legend straight from
  // COLOR_RAMPS[rampName] + the persisted bounds.
  const layer = {
    configuration: {
      type: "WebGLTile",
      props: {
        name: "Ramp Raster Layer",
        source: {
          type: "GeoTIFF",
          props: {
            url: "https://example.com/ramp.tif",
          },
        },
      },
      style: { rampName: "viridis", rampMin: "0", rampMax: "100" },
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

test("Map Zarr with default legend labels the colorbar with the resolved slice range", async () => {
  // A Zarr layer in auto mode persists no rampMin/rampMax — the range comes
  // from the decoded slice's real value span, resolved before the legend is built.
  readSlice.mockResolvedValue(zarrSlice());

  renderMapWithLayers([zarrRampLayer()]);
  fireEvent.click(await screen.findByLabelText("Show Legend Control"));

  expect(
    await screen.findByLabelText("Color ramp from 0 to 17"),
  ).toBeInTheDocument();
  expect(screen.getByText("Flood Depth")).toBeInTheDocument();
});

test("Map Zarr with default legend prefers an author-pinned range over the slice", async () => {
  readSlice.mockResolvedValue(zarrSlice());

  renderMapWithLayers([zarrRampLayer({ rampMin: "0", rampMax: "50" })]);
  fireEvent.click(await screen.findByLabelText("Show Legend Control"));

  expect(
    await screen.findByLabelText("Color ramp from 0 to 50"),
  ).toBeInTheDocument();
});

test("Map Zarr with default legend omits the legend when the slice cannot be read", async () => {
  // Unreadable store: no slice range to resolve and the layer never renders
  // normalized either, so there is nothing to label. The whole entry is
  // dropped rather than a colorbar over a range nobody knows -- which leaves
  // no legend to open at all.
  readSlice.mockRejectedValue(new Error("network"));

  renderMapWithLayers([zarrRampLayer()]);
  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  await waitFor(() => expect(readSlice).toHaveBeenCalled());
  expect(
    screen.queryByLabelText("Show Legend Control"),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/^Color ramp from/)).not.toBeInTheDocument();
});

test("Map GeoTIFF with an empty range auto-fits the legend to the file statistics", async () => {
  // No persisted rampMin/rampMax: the colorbar range comes from the file's
  // STATISTICS_* tags, so it refits when a variable input swaps the URL.
  fromUrl.mockResolvedValue({
    getImage: jest.fn().mockResolvedValue({
      getGDALMetadata: jest.fn(() => ({
        STATISTICS_MINIMUM: "0.05",
        STATISTICS_MAXIMUM: "11.732",
      })),
      getGDALNoData: jest.fn(() => null),
    }),
  });

  renderMapWithLayers([
    {
      configuration: {
        type: "WebGLTile",
        props: {
          name: "Depth Raster",
          source: {
            type: "GeoTIFF",
            props: { url: "https://example.com/depth.tif" },
          },
        },
        style: { rampName: "viridis" },
      },
      legend: "default",
    },
  ]);
  fireEvent.click(await screen.findByLabelText("Show Legend Control"));

  // Rounded to 2 decimals by formatRampBound.
  expect(
    await screen.findByLabelText("Color ramp from 0.05 to 11.73"),
  ).toBeInTheDocument();
  expect(screen.getByText("Depth Raster")).toBeInTheDocument();
});

test("Map default legend draws no colorbar for a ramp the app does not know", async () => {
  // A hand-edited config, or one saved against a ramp a later version dropped.
  // The colorbar is the one thing the legend cannot fake -- there are no
  // colors to draw -- so the entry is left out rather than drawn blank.
  fromUrl.mockResolvedValue({
    getImage: jest.fn().mockResolvedValue({
      getGDALMetadata: jest.fn(() => ({
        STATISTICS_MINIMUM: "0",
        STATISTICS_MAXIMUM: "1",
      })),
      getGDALNoData: jest.fn(() => null),
    }),
  });

  renderMapWithLayers([
    {
      configuration: {
        type: "WebGLTile",
        props: {
          name: "Mystery Raster",
          source: {
            type: "GeoTIFF",
            props: { url: "https://example.com/mystery.tif" },
          },
        },
        style: { rampName: "not-a-real-ramp", rampMin: "0", rampMax: "1" },
      },
      legend: "default",
    },
  ]);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  await waitFor(() => expect(fromUrl).toHaveBeenCalled());
  expect(
    screen.queryByLabelText("Show Legend Control"),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/^Color ramp from/)).not.toBeInTheDocument();
});

test("Map categorical raster emits discrete legend items, not a colorbar", async () => {
  // A gradient would imply a continuum between land classes that does not exist.
  fromUrl.mockResolvedValue({
    getImage: jest.fn().mockResolvedValue({
      getGDALMetadata: jest.fn(() => null),
      getGDALNoData: jest.fn(() => 255),
    }),
  });

  renderMapWithLayers([
    {
      configuration: {
        type: "WebGLTile",
        props: {
          name: "Land Use",
          source: {
            type: "GeoTIFF",
            props: { url: "https://example.com/landuse.tif" },
          },
        },
        style: {
          styleMode: "categorical",
          rampName: "viridis",
          classes: [
            { value: "0", color: "#aaaaaa", label: "Bare" },
            { value: "1", color: "#bbbbbb", label: "Crop" },
            { value: "2", color: "#cccccc" },
          ],
        },
      },
      legend: "default",
    },
  ]);
  fireEvent.click(await screen.findByLabelText("Show Legend Control"));

  expect(await screen.findByText("Bare")).toBeInTheDocument();
  expect(screen.getByText("Crop")).toBeInTheDocument();
  // A class with no label falls back to its value.
  expect(screen.getByText("2")).toBeInTheDocument();
  // No colorbar for a categorical layer.
  expect(screen.queryByLabelText(/^Color ramp from/)).not.toBeInTheDocument();
});

test("Map ranges raster emits one swatch per class in ascending order", async () => {
  fromUrl.mockResolvedValue({
    getImage: jest.fn().mockResolvedValue({
      getGDALMetadata: jest.fn(() => null),
      getGDALNoData: jest.fn(() => -9999),
    }),
  });

  renderMapWithLayers([
    {
      configuration: {
        type: "WebGLTile",
        props: {
          name: "Streamflow",
          source: {
            type: "GeoTIFF",
            props: { url: "https://example.com/flow.tif", mask_below: "0" },
          },
        },
        style: {
          styleMode: "ranges",
          rampName: "turbo",
          // Entered out of order, and one unlabelled: the legend reads in
          // the order the style colors, with the bound standing in.
          classes: [
            { value: "20", color: "#2c7bb6", label: "10 to 20" },
            { value: "2", color: "#d9ef8b", label: "1 to 2" },
            { value: "1", color: "#bdbdbd", label: "0.1 to 1" },
            { value: "100000000", color: "#08306b" },
          ],
        },
      },
      legend: "default",
    },
  ]);
  fireEvent.click(await screen.findByLabelText("Show Legend Control"));

  const first = await screen.findByText("0.1 to 1");
  const second = screen.getByText("1 to 2");
  const third = screen.getByText("10 to 20");
  const last = screen.getByText("Up to 100000000");
  const follows = (a, b) =>
    Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  expect(follows(first, second)).toBe(true);
  expect(follows(second, third)).toBe(true);
  expect(follows(third, last)).toBe(true);
  expect(screen.queryByLabelText(/^Color ramp from/)).not.toBeInTheDocument();
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

test("Map runtime layer hands features to the swap and identifies its grid item", async () => {
  // End-to-end guard for two separate failures that each left a dynamic layer
  // silently blank on dashboard load:
  //   1. the fetch resolving before Map.js finished building the OL layer, and
  //   2. the requestId carrying "undefined" for the grid item, because the hook
  //      destructured gridItemUuid while the caller passes gridItemUUID.
  // Neither showed up in the hook's own tests: those pass the map and the prop
  // name the hook expects, so the race and the casing mismatch were invisible.
  const mockGetVisualizationFeatures = jest
    .spyOn(appAPI, "getVisualizationFeatures")
    .mockResolvedValue({
      success: true,
      viz_type: "features",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { peligro: 3, nivel: "Alto" },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-90.54, 14.48],
                  [-90.53, 14.48],
                  [-90.53, 14.49],
                  [-90.54, 14.48],
                ],
              ],
            },
          },
        ],
        crs: { type: "name", properties: { name: "EPSG:4326" } },
      },
    });
  mockedSwapVectorLayerFeatures.mockClear();

  const layers = [JSON.parse(JSON.stringify(dynamicMapLayer))];
  const layerId = layers[0].configuration.props.layerId;

  render(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider value={{ gridItemUUID: "grid-uuid-1" }}>
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
        </GridItemContext.Provider>
      ),
    }),
  );

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(mockGetVisualizationFeatures).toHaveBeenCalledTimes(1);
  });

  const { requestId } = mockGetVisualizationFeatures.mock.calls[0][0];
  expect(requestId).not.toContain("undefined");
  expect(requestId).toContain(":grid-uuid-1:");
  expect(requestId.endsWith(`:${layerId}`)).toBe(true);

  // The payload reaches the swap, aimed at the OL layer carrying this layerId.
  // components/map/utilities is mocked in this file, so this asserts the
  // hand-off rather than OpenLayers' own parsing; the deferred path -- when the
  // fetch wins the race against layer construction -- is covered by
  // runtimeLayerFetcher.test.js.
  await waitFor(() => {
    expect(mockedSwapVectorLayerFeatures).toHaveBeenCalledTimes(1);
  });
  const [targetLayer, collection] = mockedSwapVectorLayerFeatures.mock.calls[0];
  expect(targetLayer.get("layerId")).toBe(layerId);
  expect(collection.features).toHaveLength(1);
  expect(collection.features[0].properties.nivel).toBe("Alto");
});

test("Map runtime layer resolves a composite request id for the layers control", async () => {
  // The layers control builds `${sessionNonce}:${gridItemUuid}:${layerId}` and
  // only looks up progress when every part is present. MapVisualization used to
  // publish the grid item under `gridItemUUID` while the control read
  // `gridItemUuid`, so the id was always null and the per-layer progress bar
  // never rendered in the app. LayersControl's own tests pass the prop by hand,
  // so only a render through the real producer can see this.
  jest.spyOn(appAPI, "getVisualizationFeatures").mockResolvedValue({
    success: true,
    viz_type: "features",
    data: {
      type: "FeatureCollection",
      features: [],
      crs: { type: "name", properties: { name: "EPSG:4326" } },
    },
  });
  const getMessageForRequest = jest.fn(() => null);

  const layers = [JSON.parse(JSON.stringify(dynamicMapLayer))];
  const layerId = layers[0].configuration.props.layerId;

  render(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider value={{ gridItemUUID: "grid-uuid-1" }}>
          <WebsocketContext.Provider value={{ getMessageForRequest }}>
            <MapContextProvider>
              <TestingComponent
                mapProps={{
                  mapConfig: {},
                  viewConfig: {},
                  layers,
                  baseMap: null,
                  layerControl: true,
                  refreshCount: 0,
                }}
              />
            </MapContextProvider>
          </WebsocketContext.Provider>
        </GridItemContext.Provider>
      ),
    }),
  );

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  fireEvent.click(await screen.findByLabelText("Show Layers Control"));

  await waitFor(() => {
    expect(getMessageForRequest).toHaveBeenCalled();
  });
  const requestIds = getMessageForRequest.mock.calls.map(([id]) => id);
  const composite = requestIds.find((id) => id && id.endsWith(`:${layerId}`));
  expect(composite).toBeDefined();
  expect(composite).not.toContain("undefined");
  expect(composite).toContain(":grid-uuid-1:");
});

test("changing the base map leaves runtime layers on the map", async () => {
  // Reported symptom: switching the base map made plugin-backed layers vanish.
  // The base map was published on its own so it could paint before the slow
  // layer preparation, which handed the reconciliation a list with no runtime
  // layer in it -- so it tore them off. That run is superseded by the full
  // publish, so it never records what it rendered, and the winning run then
  // compares against the pre-change list, believes the layer is still mounted
  // and skips rebuilding it. Removed, never rebuilt.
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
  const removeLayerSpy = jest.spyOn(Map.prototype, "removeLayer");

  const layers = [JSON.parse(JSON.stringify(dynamicMapLayer))];
  const layerId = layers[0].configuration.props.layerId;

  const BaseMapSwitcher = () => {
    const [baseMap, setBaseMap] = useState(BASE_MAP_A);
    return (
      <>
        <button type="button" onClick={() => setBaseMap(BASE_MAP_B)}>
          switch basemap
        </button>
        <TestingComponent
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap,
            layerControl: false,
            refreshCount: 0,
          }}
        />
      </>
    );
  };

  render(
    createLoadedComponent({
      children: (
        <MapContextProvider>
          <BaseMapSwitcher />
        </MapContextProvider>
      ),
    }),
  );

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(mockGetVisualizationFeatures).toHaveBeenCalledTimes(1);
  });

  removeLayerSpy.mockClear();
  fireEvent.click(screen.getByText("switch basemap"));

  // Give the base map swap and the follow-up publish time to settle.
  await waitFor(() => {
    expect(
      removeLayerSpy.mock.calls.some(
        ([layer]) => layer?.get?.("name") === "World Light Gray Base",
      ),
    ).toBe(true);
  });

  // The runtime layer was never torn off, so nothing had to rebuild or refetch
  // it -- its features are still the ones already painted.
  expect(
    removeLayerSpy.mock.calls.some(
      ([layer]) => layer?.get?.("layerId") === layerId,
    ),
  ).toBe(false);
  expect(mockGetVisualizationFeatures).toHaveBeenCalledTimes(1);
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

  // The click itself clears the highlight before re-adding it (the
  // active-feature effect), so a bare "was clear() called" check would pass
  // without the dismiss path running at all. Snapshot the count once the click
  // has settled, then require a FURTHER clear once the runtime fetcher
  // resolves (~250ms after mount) and onBeforeSwap → dismissPopupBeforeSwap
  // fires -- that extra call is the dismiss path taking its highlight branch.
  await waitFor(() => {
    expect(vectorClearSpy).toHaveBeenCalled();
  });
  const clearsAfterClick = vectorClearSpy.mock.calls.length;
  await waitFor(() => {
    expect(vectorClearSpy.mock.calls.length).toBeGreaterThan(clearsAfterClick);
  });
  expect(setPositionSpy).toHaveBeenCalledWith(undefined);
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

describe("the basemap's early publish beside a runtime GeoTIFF", () => {
  // The basemap is held back from the early publish only when a raster will
  // own the view projection. A raster a plugin drives never does, so it must
  // not hold the basemap: with a layer's preparation stalled, the basemap is
  // on the map regardless.
  const baseMap =
    "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer";

  const rasterLayer = (extraProps) => ({
    configuration: {
      type: "WebGLTile",
      props: {
        name: "Depth",
        source: { type: "GeoTIFF", props: {} },
        ...extraProps,
      },
      // A saved style reference, so preparing the layer waits on a download
      // the test never answers.
      style: "held_style.json",
    },
  });

  const renderWith = (layers) =>
    render(
      createLoadedComponent({
        children: (
          <MapContextProvider>
            <TestingComponent
              mapProps={{
                mapConfig: {},
                viewConfig: {},
                layers,
                baseMap,
                layerControl: false,
              }}
            />
          </MapContextProvider>
        ),
      }),
    );

  const addedSources = (spy) =>
    spy.mock.calls.map((call) => call[0]?.getSource?.()?.key_);
  const baseMapUrl =
    "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";

  beforeEach(() => {
    jest
      .spyOn(appAPI, "downloadJSON")
      .mockImplementation(() => new Promise(() => {}));
    jest
      .spyOn(appAPI, "getVisualizationFeatures")
      .mockImplementation(() => new Promise(() => {}));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("publishes the basemap early when the only raster is plugin-driven", async () => {
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
    renderWith([
      rasterLayer({
        layerId: "layer-1",
        pluginSource: { source: "echo_raster", args: {} },
      }),
    ]);

    await waitFor(() => {
      expect(addedSources(addLayerSpy)).toContain(baseMapUrl);
    });
  });

  it("still holds it back for a static raster", async () => {
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
    renderWith([
      rasterLayer({
        source: { type: "GeoTIFF", props: { url: "https://h/a.tif" } },
      }),
    ]);

    expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
    // Give the early publish every chance to have happened.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(addedSources(addLayerSpy)).not.toContain(baseMapUrl);
  });
});

describe("the legend of a runtime GeoTIFF", () => {
  // A runtime raster's colorbar shows the ramp its last successful fetch drew,
  // which only the fetcher knows; the saved scaffold ramp may not be on screen.
  const runtimeRaster = (overrides = {}) => ({
    configuration: {
      type: "WebGLTile",
      props: {
        name: "Forecast Depth",
        layerId: "runtime-1",
        pluginSource: { source: "echo_raster", args: {} },
        source: { type: "GeoTIFF", props: {} },
      },
      style: { rampName: "Blues", rampMin: "100", rampMax: "200" },
    },
    legend: "default",
    ...overrides,
  });

  const staticRaster = {
    configuration: {
      type: "WebGLTile",
      props: {
        name: "Static Depth",
        source: {
          type: "GeoTIFF",
          props: { url: "https://example.com/static.tif" },
        },
      },
      style: { rampName: "viridis", rampMin: "0", rampMax: "100" },
    },
    legend: "default",
  };

  const LayerSwitcher = ({ initialLayers, nextLayers }) => {
    const [layers, setLayers] = useState(initialLayers);
    return (
      <>
        <button type="button" onClick={() => setLayers(nextLayers)}>
          Swap Layers
        </button>
        <TestingComponent
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </>
    );
  };
  LayerSwitcher.propTypes = {
    initialLayers: PropTypes.array,
    nextLayers: PropTypes.array,
  };

  const renderLayers = (initialLayers, nextLayers = []) =>
    render(
      createLoadedComponent({
        children: (
          <MapContextProvider>
            <LayerSwitcher
              initialLayers={initialLayers}
              nextLayers={nextLayers}
            />
          </MapContextProvider>
        ),
      }),
    );

  const publish = (legendByLayerId) =>
    act(() => {
      mockRasterLegendStore.set(legendByLayerId);
    });

  // The colors the most recent render gave the colorbar with this range.
  const expectRamp = (rampMin, rampMax, rampName, reverse = false) => {
    const rendered = mockRenderedLegends.filter(
      (legend) => legend?.rampMin === rampMin && legend?.rampMax === rampMax,
    );
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.at(-1).rampColors).toEqual(resolveRamp(rampName, reverse));
  };

  // Whether `first` comes before `second` in the document.
  const precedes = (first, second) =>
    Boolean(
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
    );

  beforeEach(() => {
    mockRasterLegendStore.set(null);
    mockRenderedLegends.length = 0;
    jest
      .spyOn(appAPI, "getVisualizationFeatures")
      .mockImplementation(() => new Promise(() => {}));
  });

  afterEach(() => {
    mockRasterLegendStore.set(null);
    jest.restoreAllMocks();
  });

  it("shows each fetch's ramp and range in turn", async () => {
    // Covers AE1.
    renderLayers([runtimeRaster()]);
    expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

    publish({
      "runtime-1": {
        rampName: "viridis",
        rampReverse: false,
        rampMin: 0,
        rampMax: 50,
      },
    });
    fireEvent.click(await screen.findByLabelText("Show Legend Control"));
    await screen.findByLabelText("Color ramp from 0 to 50");
    expectRamp(0, 50, "viridis");
    expect(screen.getByText("Forecast Depth")).toBeInTheDocument();

    publish({
      "runtime-1": {
        rampName: "magma",
        rampReverse: true,
        rampMin: 3,
        rampMax: 9,
      },
    });
    await screen.findByLabelText("Color ramp from 3 to 9");
    expectRamp(3, 9, "magma", true);
    expect(
      screen.queryByLabelText("Color ramp from 0 to 50"),
    ).not.toBeInTheDocument();
  });

  it("shows no colorbar and no error before the first fetch", async () => {
    renderLayers([runtimeRaster(), staticRaster]);
    fireEvent.click(await screen.findByLabelText("Show Legend Control"));
    expect(
      await screen.findByLabelText("Color ramp from 0 to 100"),
    ).toBeInTheDocument();

    // Neither the saved scaffold range nor any other colorbar stands in for
    // the ramp no fetch has drawn yet.
    expect(screen.getAllByRole("img", { name: /^Color ramp/ })).toHaveLength(1);
    expect(
      screen.queryByLabelText("Color ramp from 100 to 200"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Forecast Depth")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a class-styled fetch's swatches in place of a colorbar", async () => {
    renderLayers([runtimeRaster()]);
    publish({
      "runtime-1": {
        items: [
          { color: "#bdbdbd", label: "0.1 to 1", symbol: "square" },
          { color: "#d9ef8b", label: "1 to 2", symbol: "square" },
        ],
      },
    });
    fireEvent.click(await screen.findByLabelText("Show Legend Control"));

    expect(await screen.findByText("0.1 to 1")).toBeInTheDocument();
    expect(screen.getByText("1 to 2")).toBeInTheDocument();
    expect(screen.getByText("Forecast Depth")).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: /^Color ramp/ }),
    ).not.toBeInTheDocument();
  });

  it("shows nothing for a class-styled fetch with no swatches", async () => {
    renderLayers([runtimeRaster(), staticRaster]);
    publish({ "runtime-1": { items: [] } });
    fireEvent.click(await screen.findByLabelText("Show Legend Control"));
    expect(
      await screen.findByLabelText("Color ramp from 0 to 100"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Forecast Depth")).not.toBeInTheDocument();
  });

  it("shows no colorbar for a fetch that drew none", async () => {
    renderLayers([runtimeRaster(), staticRaster]);
    publish({ "runtime-1": null });
    fireEvent.click(await screen.findByLabelText("Show Legend Control"));
    expect(
      await screen.findByLabelText("Color ramp from 0 to 100"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /^Color ramp/ })).toHaveLength(1);
  });

  it("never replaces an author-edited legend with runtime data", async () => {
    const authored = {
      title: "Authored Legend",
      userEdited: true,
      items: [
        { label: "Deep water", color: "#0000ff", symbol: "square" },
        { label: "Shallow water", color: "#00ffff", symbol: "square" },
      ],
    };
    renderLayers([runtimeRaster({ legend: authored })]);
    publish({
      "runtime-1": {
        rampName: "viridis",
        rampReverse: false,
        rampMin: 0,
        rampMax: 50,
      },
    });
    fireEvent.click(await screen.findByLabelText("Show Legend Control"));

    expect(await screen.findByText("Authored Legend")).toBeInTheDocument();
    expect(screen.getByText("Deep water")).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: /^Color ramp/ }),
    ).not.toBeInTheDocument();
  });

  it("leaves a static GeoTIFF's colorbar as it was", async () => {
    renderLayers([staticRaster]);
    fireEvent.click(await screen.findByLabelText("Show Legend Control"));
    await screen.findByLabelText("Color ramp from 0 to 100");
    expectRamp("0", "100", "viridis");
    expect(screen.getByText("Static Depth")).toBeInTheDocument();
  });

  it("keeps the legend in layer order beside static layers", async () => {
    const authored = {
      title: "Authored Legend",
      items: [
        { label: "Deep water", color: "#0000ff", symbol: "square" },
        { label: "Shallow water", color: "#00ffff", symbol: "square" },
      ],
    };
    renderLayers([
      staticRaster,
      runtimeRaster(),
      {
        configuration: {
          type: "VectorLayer",
          props: {
            name: "Outlines",
            source: { type: "GeoJSON", geojson: exampleGeoJSON },
          },
        },
        legend: authored,
      },
    ]);
    publish({
      "runtime-1": {
        rampName: "magma",
        rampReverse: false,
        rampMin: 3,
        rampMax: 9,
      },
    });
    fireEvent.click(await screen.findByLabelText("Show Legend Control"));
    await screen.findByLabelText("Color ramp from 3 to 9");
    await screen.findByText("Authored Legend");

    const staticTitle = screen.getByText("Static Depth");
    const runtimeTitle = screen.getByText("Forecast Depth");
    const authoredTitle = screen.getByText("Authored Legend");
    expect(precedes(staticTitle, runtimeTitle)).toBe(true);
    expect(precedes(runtimeTitle, authoredTitle)).toBe(true);
    expect(
      screen
        .getAllByRole("img", { name: /^Color ramp/ })
        .map((node) => node.getAttribute("aria-label")),
    ).toEqual(["Color ramp from 0 to 100", "Color ramp from 3 to 9"]);
  });

  it("drops a removed runtime layer's colorbar", async () => {
    renderLayers([staticRaster, runtimeRaster()], [staticRaster]);
    publish({
      "runtime-1": {
        rampName: "viridis",
        rampReverse: false,
        rampMin: 0,
        rampMax: 50,
      },
    });
    fireEvent.click(await screen.findByLabelText("Show Legend Control"));
    expect(
      await screen.findByLabelText("Color ramp from 0 to 50"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Swap Layers"));
    await waitFor(() => {
      expect(
        screen.queryByLabelText("Color ramp from 0 to 50"),
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Forecast Depth")).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Color ramp from 0 to 100"),
    ).toBeInTheDocument();
  });
});
