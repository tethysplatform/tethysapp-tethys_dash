import {
  createMarkerLayer,
  createHighlightLayer,
  addHighlightFeatures,
  transformCoordinates,
  queryLayerFeatures,
  getLayerAttributes,
  loadLayerJSONs,
  loadGeoJSON,
  saveLayerJSON,
  checkForCRS,
  getStyleFields,
} from "components/map/utilities";
import { LineString, Point, MultiPolygon, Polygon } from "ol/geom";
import VectorLayer from "ol/layer/Vector.js";
import {
  layerConfigGeoJSON,
  layerConfigImageArcGISRest,
  layerConfigImageWMS,
  layerConfigArcGISFeatureService,
  layerConfigPMTilesVector,
  layerConfigKML,
} from "__tests__/utilities/constants";
import appAPI from "services/api/app";
import { PMTiles } from "pmtiles";

jest.mock("uuid", () => ({
  v4: () => 12345678,
}));

test("getStyleFields GeoJSON", async () => {
  const sourceProps = layerConfigGeoJSON.configuration.props.source;
  const layerName = layerConfigGeoJSON.configuration.props.name;
  const styleFields = await getStyleFields({
    sourceProps,
    layerProps: { name: layerName },
    dashboard_uuid: "some-uuid",
  });

  expect(styleFields).toStrictEqual(["Some Field"]);
});

test("getStyleFields  fails", async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: false,
      statusText: "missing",
    }),
  );

  const updatedlayerConfigGeoJSON = JSON.parse(
    JSON.stringify(layerConfigGeoJSON),
  );
  const sourceProps = updatedlayerConfigGeoJSON.configuration.props.source;
  sourceProps.geojson = "some/url.json";
  const layerName = updatedlayerConfigGeoJSON.configuration.props.name;

  const styleFields = await getStyleFields({
    sourceProps,
    layerProps: { name: layerName },
    dashboard_uuid: "some-uuid",
  });

  expect(styleFields).toStrictEqual([]);
});

test("getStyleFields ESRI Feature Service", async () => {
  const mockServiceResults = {
    id: 0,
    name: "Max Status - Forecast Trend",
    parentLayerId: -1,
    defaultVisibility: true,
    subLayerIds: null,
    minScale: 0,
    maxScale: 0,
    type: "Feature Layer",
    geometryType: "esriGeometryPoint",
    supportsDynamicLegends: true,
    fields: [
      {
        name: "nws_name",
        type: "esriFieldTypeString",
        alias: "Name",
        length: 60000,
        domain: null,
      },
      {
        name: "producer",
        type: "esriFieldTypeString",
        alias: "RFC",
        length: 60000,
        domain: null,
      },
    ],
  };

  const mockFetch = jest.fn();
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: mockFetch,
    }),
  );
  mockFetch.mockResolvedValueOnce(mockServiceResults);

  const sourceProps =
    layerConfigArcGISFeatureService.configuration.props.source;
  const layerName = layerConfigArcGISFeatureService.configuration.props.name;

  const styleFields = await getStyleFields({
    sourceProps,
    layerProps: { name: layerName },
    dashboard_uuid: "some-uuid",
  });

  expect(styleFields).toStrictEqual(["nws_name", "producer"]);
});

test("getStyleFields Other Type", async () => {
  const sourceProps = { type: "Other" };
  const layerName = "Some Layer";
  const styleFields = await getStyleFields({
    sourceProps,
    layerProps: { name: layerName },
    dashboard_uuid: "some-uuid",
  });

  expect(styleFields).toStrictEqual([]);
});

test("createMarkerLayer", async () => {
  const markerLayer = createMarkerLayer([0, 0]);

  expect(markerLayer instanceof VectorLayer).toBe(true);
  expect(markerLayer.getSource().getFeatures().length).toBe(1);
  const markerLayerFeature = markerLayer.getSource().getFeatures()[0];

  expect(markerLayerFeature.getGeometry() instanceof Point).toBe(true);
});

test("createHighlightLayer MultiLineString", async () => {
  const geometries = {
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
  };
  const highlightLayer = createHighlightLayer();
  addHighlightFeatures(highlightLayer, geometries);

  expect(highlightLayer instanceof VectorLayer).toBe(true);
  expect(highlightLayer.getZIndex()).toBe(100);

  const highlightLayerStyleStroke = highlightLayer.getStyle().getStroke();
  expect(highlightLayerStyleStroke.getColor()).toBe("#00008b");
  expect(highlightLayerStyleStroke.getWidth()).toBe(3);
  expect(highlightLayer.getSource().getFeatures().length).toBe(2);
  const highlightLayerFeature = highlightLayer.getSource().getFeatures()[0];

  expect(highlightLayerFeature.getGeometry() instanceof LineString).toBe(true);
});

test("createHighlightLayer MultiLineString 2", async () => {
  const geometries = {
    type: "MultiLineString",
    coordinates: [
      [
        [0, 0],
        [0, 1],
      ],
      [
        [1, 0],
        [1, 1],
      ],
    ],
  };
  const highlightLayer = createHighlightLayer();
  addHighlightFeatures(highlightLayer, geometries);

  expect(highlightLayer instanceof VectorLayer).toBe(true);
  expect(highlightLayer.getZIndex()).toBe(100);

  const highlightLayerStyleStroke = highlightLayer.getStyle().getStroke();
  expect(highlightLayerStyleStroke.getColor()).toBe("#00008b");
  expect(highlightLayerStyleStroke.getWidth()).toBe(3);
  expect(highlightLayer.getSource().getFeatures().length).toBe(2);
  const highlightLayerFeature = highlightLayer.getSource().getFeatures()[0];

  expect(highlightLayerFeature.getGeometry() instanceof LineString).toBe(true);
});

test("createHighlightLayer LineString", async () => {
  const geometries = {
    type: "LineString",
    coordinates: [
      [0, 0],
      [0, 1],
    ],
  };
  const highlightLayer = createHighlightLayer();
  addHighlightFeatures(highlightLayer, geometries);

  expect(highlightLayer instanceof VectorLayer).toBe(true);
  expect(highlightLayer.getZIndex()).toBe(100);

  const highlightLayerStyleStroke = highlightLayer.getStyle().getStroke();
  expect(highlightLayerStyleStroke.getColor()).toBe("#00008b");
  expect(highlightLayerStyleStroke.getWidth()).toBe(3);
  expect(highlightLayer.getSource().getFeatures().length).toBe(1);
  const highlightLayerFeature = highlightLayer.getSource().getFeatures()[0];

  expect(highlightLayerFeature.getGeometry() instanceof LineString).toBe(true);
});

test("createHighlightLayer MultiPolygon", async () => {
  const geometries = {
    type: "MultiPolygon",
    coordinates: [
      [
        [0, 0],
        [0, 1],
      ],
      [
        [1, 0],
        [1, 1],
      ],
    ],
  };
  const highlightLayer = createHighlightLayer();
  addHighlightFeatures(highlightLayer, geometries);

  expect(highlightLayer instanceof VectorLayer).toBe(true);
  expect(highlightLayer.getZIndex()).toBe(100);

  const highlightLayerStyleStroke = highlightLayer.getStyle().getStroke();
  expect(highlightLayerStyleStroke.getColor()).toBe("#00008b");
  expect(highlightLayerStyleStroke.getWidth()).toBe(3);
  expect(highlightLayer.getSource().getFeatures().length).toBe(1);
  const highlightLayerFeature = highlightLayer.getSource().getFeatures()[0];

  expect(highlightLayerFeature.getGeometry() instanceof MultiPolygon).toBe(
    true,
  );
});

test("createHighlightLayer Polygon", async () => {
  const geometries = {
    type: "Polygon",
    coordinates: [
      [0, 0],
      [0, 1],
    ],
  };
  const highlightLayer = createHighlightLayer();
  addHighlightFeatures(highlightLayer, geometries);

  expect(highlightLayer instanceof VectorLayer).toBe(true);
  expect(highlightLayer.getZIndex()).toBe(100);

  const highlightLayerStyleStroke = highlightLayer.getStyle().getStroke();
  expect(highlightLayerStyleStroke.getColor()).toBe("#00008b");
  expect(highlightLayerStyleStroke.getWidth()).toBe(3);
  expect(highlightLayer.getSource().getFeatures().length).toBe(1);
  const highlightLayerFeature = highlightLayer.getSource().getFeatures()[0];

  expect(highlightLayerFeature.getGeometry() instanceof Polygon).toBe(true);
});

test("createHighlightLayer Point Coords", async () => {
  const geometries = {
    type: "Point",
    coordinates: [0, 0],
  };
  const highlightLayer = createHighlightLayer();

  expect(highlightLayer instanceof VectorLayer).toBe(true);
  expect(highlightLayer.getZIndex()).toBe(100);

  const highlightLayerStyleStroke = highlightLayer.getStyle().getStroke();
  expect(highlightLayerStyleStroke.getColor()).toBe("#00008b");
  expect(highlightLayerStyleStroke.getWidth()).toBe(3);
  expect(highlightLayer.getSource().getFeatures().length).toBe(0);

  addHighlightFeatures(highlightLayer, geometries);

  expect(highlightLayer.getSource().getFeatures().length).toBe(1);
  const highlightLayerFeature = highlightLayer.getSource().getFeatures()[0];

  expect(highlightLayerFeature.getGeometry() instanceof Point).toBe(true);
});

test("createHighlightLayer Point X,Y", async () => {
  const geometries = {
    x: 0,
    y: 0,
  };
  const highlightLayer = createHighlightLayer();
  addHighlightFeatures(highlightLayer, geometries);

  expect(highlightLayer instanceof VectorLayer).toBe(true);
  expect(highlightLayer.getZIndex()).toBe(100);

  const highlightLayerStyleStroke = highlightLayer.getStyle().getStroke();
  expect(highlightLayerStyleStroke.getColor()).toBe("#00008b");
  expect(highlightLayerStyleStroke.getWidth()).toBe(3);
  expect(highlightLayer.getSource().getFeatures().length).toBe(1);
  const highlightLayerFeature = highlightLayer.getSource().getFeatures()[0];

  expect(highlightLayerFeature.getGeometry() instanceof Point).toBe(true);
});

test("addHighlightFeatures no-ops when geometries is undefined", () => {
  // Regression: `"paths" in undefined` used to throw; the guard short-
  // circuits silently so callers (e.g., GeoTIFF pixel-value features that
  // omit a geometry) don't crash the click pipeline.
  const highlightLayer = createHighlightLayer();
  expect(() => addHighlightFeatures(highlightLayer, undefined)).not.toThrow();
  expect(highlightLayer.getSource().getFeatures().length).toBe(0);
});

test("addHighlightFeatures no-ops when geometries is a non-object primitive", () => {
  const highlightLayer = createHighlightLayer();
  expect(() => addHighlightFeatures(highlightLayer, null)).not.toThrow();
  expect(() => addHighlightFeatures(highlightLayer, 0)).not.toThrow();
  expect(() => addHighlightFeatures(highlightLayer, "")).not.toThrow();
  expect(highlightLayer.getSource().getFeatures().length).toBe(0);
});

test("transformCoordinates", async () => {
  const coords = [[[[2.294364273602696, 48.85882287559042]]]];
  const sourceProj = "EPSG:4326";
  const destProj = "EPSG:3857";

  const newCoords = transformCoordinates(coords, sourceProj, destProj);

  expect(newCoords).toStrictEqual([
    [[[255407.46263173112, 6250940.451723791]]],
  ]);
});

test("transformCoordinates 2", async () => {
  const coords = [
    [
      [2.294364273602696, 48.85882287559042],
      [3.294364273602696, 49.85882287559042],
    ],
  ];
  const sourceProj = "EPSG:4326";
  const destProj = "EPSG:3857";

  const newCoords = transformCoordinates(coords, sourceProj, destProj);

  expect(newCoords).toStrictEqual([
    [
      [255407.46263173112, 6250940.451723791],
      [366726.9534250047, 6421862.25291049],
    ],
  ]);
});

test("transformCoordinates error", async () => {
  const coords = [[[2.294364273602696, "asdasd"]]];
  const sourceProj = "EPSG:4326";
  const destProj = "EPSG:3857";

  expect(() => transformCoordinates(coords, sourceProj, destProj)).toThrow(
    "Invalid coordinate structure",
  );
});

test("queryLayerFeatures No Feature Found", async () => {
  const mockMap = {
    getView: jest.fn(() => ({
      getResolution: jest.fn(),
      getZoom: jest.fn(() => 10),
    })),
    forEachFeatureAtPixel: jest.fn((pixel, callback) => {
      // Simulate features found at the given pixel
      const mockLayer = {
        get: jest.fn(() => "Highlighted Layer"),
        getProperties: () => ({
          name: "Highlighted Layer",
        }),
      };
      callback(null, mockLayer); // Call the callback with the mock feature
    }),
  };
  const coordinate = [0, 0];
  const pixel = [639, 366];

  const features = await queryLayerFeatures(
    layerConfigGeoJSON,
    mockMap,
    coordinate,
    pixel,
  );

  expect(features).toStrictEqual([]);
});

test("queryLayerFeatures Highlight Layer Found", async () => {
  const mockMap = {
    getView: jest.fn(() => ({
      getResolution: jest.fn(),
      getZoom: jest.fn(() => 10),
    })),
    forEachFeatureAtPixel: jest.fn((pixel, callback) => {
      // Simulate features found at the given pixel
      const mockFeature = {
        getId: () => "feature-123",
        getProperties: () => ({
          geometry: {
            getType: jest.fn(() => "LineString"),
            getCoordinates: jest.fn(() => [
              [0, 0],
              [0, 1],
            ]),
          },
        }),
      }; // Mocked feature object
      const mockLayer = {
        get: jest.fn(() => "Highlighted Layer"),
        getProperties: () => ({
          name: "Highlighted Layer",
        }),
      };
      callback(mockFeature, mockLayer); // Call the callback with the mock feature
    }),
  };
  const coordinate = [0, 0];
  const pixel = [639, 366];

  const features = await queryLayerFeatures(
    layerConfigGeoJSON,
    mockMap,
    coordinate,
    pixel,
  );

  expect(features).toStrictEqual([]);
});

test("queryLayerFeatures Valid GeoJSON Found", async () => {
  const mockMap = {
    getView: jest.fn(() => ({
      getResolution: jest.fn(),
      getZoom: jest.fn(() => 10),
    })),
    forEachFeatureAtPixel: jest.fn((pixel, callback) => {
      // Simulate features found at the given pixel
      const mockFeature = {
        getId: () => "feature-123",
        getProperties: () => ({
          geometry: {
            getType: jest.fn(() => "LineString"),
            getCoordinates: jest.fn(() => [
              [0, 0],
              [0, 1],
            ]),
          },
        }),
      }; // Mocked feature object
      const mockLayer = {
        get: jest.fn(() => "GeoJSON Layer"),
        getProperties: () => ({
          name: "GeoJSON Layer",
        }),
      };
      callback(mockFeature, mockLayer); // Call the callback with the mock feature
    }),
  };
  const coordinate = [0, 0];
  const pixel = [639, 366];

  const features = await queryLayerFeatures(
    layerConfigGeoJSON,
    mockMap,
    coordinate,
    pixel,
  );

  expect(features).toStrictEqual([
    {
      layerName: "GeoJSON Layer",
      attributes: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [0, 0],
          [0, 1],
        ],
      },
    },
  ]);
});

test("queryLayerFeatures Valid GeoJSON No Features Found", async () => {
  const mockMap = {
    getView: jest.fn(() => ({
      getResolution: jest.fn(),
      getZoom: jest.fn(() => 10),
    })),
    forEachFeatureAtPixel: jest.fn((pixel, callback) => {
      // Simulate features found at the given pixel
      const mockFeature = null;
      const mockLayer = {
        get: jest.fn(() => "GeoJSON Layer"),
        getProperties: () => ({
          name: "GeoJSON Layer",
        }),
      };
      callback(mockFeature, mockLayer); // Call the callback with the mock feature
    }),
  };
  const coordinate = [0, 0];
  const pixel = [639, 366];

  const features = await queryLayerFeatures(
    layerConfigGeoJSON,
    mockMap,
    coordinate,
    pixel,
  );

  expect(features).toStrictEqual([]);
});

test("queryLayerFeatures Valid GeoJSON GeometryCollection Found", async () => {
  const mockMap = {
    getView: jest.fn(() => ({
      getResolution: jest.fn(() => 100),
      getZoom: jest.fn(() => 10),
    })),
    forEachFeatureAtPixel: jest.fn((pixel, callback) => {
      // Simulate features found at the given pixel
      const mockFeature = {
        getId: () => "feature-123",
        getProperties: () => ({
          geometry: {
            getType: jest.fn(() => "GeometryCollection"),
            getGeometries: jest.fn(() => [
              {
                getType: jest.fn(() => "LineString"),
                getCoordinates: jest.fn(() => [
                  [1, 2],
                  [3, 4],
                ]),
                getClosestPoint: jest.fn(() => [0, 0]),
              },
              {
                getType: jest.fn(() => "LineString"),
                getCoordinates: jest.fn(() => [
                  [5, 6],
                  [7, 8],
                ]),
                getClosestPoint: jest.fn(() => [100000000, 0]),
              },
              {
                getType: jest.fn(() => "Polygon"),
                intersectsCoordinate: jest.fn(() => true),
                getCoordinates: jest.fn(() => [
                  [9, 10],
                  [11, 12],
                ]),
                getClosestPoint: jest.fn(() => [0, 0]),
              },
              {
                getType: jest.fn(() => "Polygon"),
                intersectsCoordinate: jest.fn(() => false),
                getCoordinates: jest.fn(() => [
                  [13, 14],
                  [15, 16],
                ]),
                getClosestPoint: jest.fn(() => [0, 0]),
              },
            ]),
          },
        }),
      }; // Mocked feature object
      const mockLayer = {
        get: jest.fn(() => "GeoJSON Layer"),
        getProperties: () => ({
          name: "GeoJSON Layer",
        }),
      };
      callback(mockFeature, mockLayer); // Call the callback with the mock feature
    }),
  };
  const coordinate = [0, 0];
  const pixel = [639, 366];

  const features = await queryLayerFeatures(
    layerConfigGeoJSON,
    mockMap,
    coordinate,
    pixel,
  );

  expect(features).toStrictEqual([
    {
      layerName: "GeoJSON Layer",
      attributes: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [1, 2],
          [3, 4],
        ],
      },
    },
    {
      layerName: "GeoJSON Layer",
      attributes: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [9, 10],
          [11, 12],
        ],
      },
    },
  ]);
});

test("queryLayerFeatures Valid GeoJSON GeometryCollection Found No Points Close Enough", async () => {
  const mockMap = {
    getView: jest.fn(() => ({
      getResolution: jest.fn(() => 100),
      getZoom: jest.fn(() => 10),
    })),
    forEachFeatureAtPixel: jest.fn((pixel, callback) => {
      // Simulate features found at the given pixel
      const mockFeature = {
        getId: () => "feature-123",
        getProperties: () => ({
          geometry: {
            getType: jest.fn(() => "GeometryCollection"),
            getGeometries: jest.fn(() => [
              {
                getType: jest.fn(() => "LineString"),
                getCoordinates: jest.fn(() => [
                  [5, 6],
                  [7, 8],
                ]),
                getClosestPoint: jest.fn(() => [100000000, 0]),
              },
            ]),
          },
        }),
      }; // Mocked feature object
      const mockLayer = {
        get: jest.fn(() => "GeoJSON Layer"),
        getProperties: () => ({
          name: "GeoJSON Layer",
        }),
      };
      callback(mockFeature, mockLayer); // Call the callback with the mock feature
    }),
  };
  const coordinate = [0, 0];
  const pixel = [639, 366];

  const features = await queryLayerFeatures(
    layerConfigGeoJSON,
    mockMap,
    coordinate,
    pixel,
  );

  expect(features).toStrictEqual([]);
});

test("queryLayerFeatures ImageArcGISRest", async () => {
  const mockArgisResults = [
    {
      layerId: 0,
      layerName: "Max Status - Forecast Trend",
      displayFieldName: "Name",
      value: "Philadelphia",
      attributes: {
        nws_name: "Philadelphia",
        producer: "LMRFC",
        issuer: "JAN",
        "NWS LID": "PLAM6",
        "USGS Site Code": "02481880",
        "USGS Name": "PEARL RIVER AT BURNSIDE, MS",
        "NWM Feature ID": "15785080",
        "Forecast/Threshold Unit": "FT",
        "Threshold - Record": "23.6",
        "Threshold - Major": "23",
        "Threshold - Moderate": "16",
        "Threshold - Minor": "13",
        "Threshold - Action": "12",
        "Forecast Issue Time": "2025-02-05 14:32:00 UTC",
        "Forecast Generation Time": "2025-02-05 14:39:34 UTC",
        "Forecast Initial Value": "12.4",
        "Forecast Initial Status": "action",
        "Forecast Initial Value Timestep": "2025-02-06 00:00:00 UTC",
        "Forecast Min Value": "12.1",
        "Forecast Min Status": "action",
        "Forecast Min Value Timestep": "2025-02-10 06:00:00 UTC",
        "Forecast Initial Flood Value": "12.4",
        "Forecast Initial Flood Status": "action",
        "Forecast Initial Flood Value Timestep": "2025-02-06 00:00:00 UTC",
        "Forecast Max Value": "12.4",
        "Forecast Max Status": "action",
        "Forecast Max Value Timestep": "2025-02-06 00:00:00 UTC",
        "Forecast Trend": "constant",
        "Record Forecast": "false",
        geom: "Point",
        "Hydrograph Link":
          "https://water.noaa.gov/resources/hydrographs/plam6_hg.png",
        "HEFS Link":
          "https://water.noaa.gov/resources/probabilistic/short_term/PLAM6.shortrange.hefs.png",
        "Update Time": "2025-02-05 21:25:18 UTC",
        oid: "51",
      },
      geometryType: "esriGeometryPoint",
      geometry: {
        x: -9918321.7268,
        y: 3874271.337899998,
        spatialReference: {
          wkid: 102100,
          latestWkid: 3857,
        },
      },
    },
  ];

  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () =>
        Promise.resolve({
          results: mockArgisResults,
        }),
    }),
  );

  const mockMap = {
    getSize: jest.fn(() => [100, 200]),
    getView: jest.fn(() => ({
      calculateExtent: jest.fn(() => [1, 2, 3, 4]),
      getResolution: jest.fn(() => 500),
      getProjection: jest.fn(() => ({
        getCode: jest.fn(() => "EPSG:4326"),
      })),
      getZoom: jest.fn(() => 10),
    })),
    forEachFeatureAtPixel: jest.fn((pixel, callback) => {
      // Simulate features found at the given pixel
      const mockFeature = {
        getId: () => "feature-123",
        getProperties: () => ({
          geometry: {
            getType: jest.fn(() => "LineString"),
            getCoordinates: jest.fn(() => [
              [0, 0],
              [0, 1],
            ]),
          },
        }),
      }; // Mocked feature object
      const mockLayer = {
        get: jest.fn(() => "ImageArcGISRest Layer"),
        getProperties: () => ({
          name: "ImageArcGISRest Layer",
        }),
      };
      callback(mockFeature, mockLayer); // Call the callback with the mock feature
    }),
  };
  const coordinate = [0, 0];
  const pixel = [639, 366];

  const features = await queryLayerFeatures(
    layerConfigImageArcGISRest,
    mockMap,
    coordinate,
    pixel,
  );

  const params = new URLSearchParams({
    f: "json",
    tolerance: 10, // Pixel tolerance
    returnGeometry: true,
    geometryType: "esriGeometryPoint",
    sr: "4326",
    geometry: "0,0",
    mapExtent: "1,2,3,4",
    returnFieldName: true,
    imageDisplay: "100, 200, 500",
    layers: "visible",
  });
  const featureQueryUrl =
    layerConfigImageArcGISRest.configuration.props.source.props.url +
    "/identify";
  expect(global.fetch).toHaveBeenCalledWith(
    `${featureQueryUrl}?${params.toString()}`,
  );
  expect(features).toStrictEqual(mockArgisResults);

  global.fetch.mockRestore?.();
});

test("queryLayerFeatures ImageArcGISRest, show layer", async () => {
  const mockArgisResults = [
    {
      layerId: 0,
      layerName: "Max Status - Forecast Trend",
      displayFieldName: "Name",
      value: "Philadelphia",
      attributes: {
        nws_name: "Philadelphia",
        producer: "LMRFC",
        issuer: "JAN",
        "NWS LID": "PLAM6",
        "USGS Site Code": "02481880",
        "USGS Name": "PEARL RIVER AT BURNSIDE, MS",
        "NWM Feature ID": "15785080",
        "Forecast/Threshold Unit": "FT",
        "Threshold - Record": "23.6",
        "Threshold - Major": "23",
        "Threshold - Moderate": "16",
        "Threshold - Minor": "13",
        "Threshold - Action": "12",
        "Forecast Issue Time": "2025-02-05 14:32:00 UTC",
        "Forecast Generation Time": "2025-02-05 14:39:34 UTC",
        "Forecast Initial Value": "12.4",
        "Forecast Initial Status": "action",
        "Forecast Initial Value Timestep": "2025-02-06 00:00:00 UTC",
        "Forecast Min Value": "12.1",
        "Forecast Min Status": "action",
        "Forecast Min Value Timestep": "2025-02-10 06:00:00 UTC",
        "Forecast Initial Flood Value": "12.4",
        "Forecast Initial Flood Status": "action",
        "Forecast Initial Flood Value Timestep": "2025-02-06 00:00:00 UTC",
        "Forecast Max Value": "12.4",
        "Forecast Max Status": "action",
        "Forecast Max Value Timestep": "2025-02-06 00:00:00 UTC",
        "Forecast Trend": "constant",
        "Record Forecast": "false",
        geom: "Point",
        "Hydrograph Link":
          "https://water.noaa.gov/resources/hydrographs/plam6_hg.png",
        "HEFS Link":
          "https://water.noaa.gov/resources/probabilistic/short_term/PLAM6.shortrange.hefs.png",
        "Update Time": "2025-02-05 21:25:18 UTC",
        oid: "51",
      },
      geometryType: "esriGeometryPoint",
      geometry: {
        x: -9918321.7268,
        y: 3874271.337899998,
        spatialReference: {
          wkid: 102100,
          latestWkid: 3857,
        },
      },
    },
  ];

  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () =>
        Promise.resolve({
          results: mockArgisResults,
        }),
    }),
  );

  const mockMap = {
    getSize: jest.fn(() => [100, 200]),
    getView: jest.fn(() => ({
      calculateExtent: jest.fn(() => [1, 2, 3, 4]),
      getResolution: jest.fn(() => 500),
      getProjection: jest.fn(() => ({
        getCode: jest.fn(() => "EPSG:4326"),
      })),
      getZoom: jest.fn(() => 10),
    })),
    forEachFeatureAtPixel: jest.fn((pixel, callback) => {
      // Simulate features found at the given pixel
      const mockFeature = {
        getId: () => "feature-123",
        getProperties: () => ({
          geometry: {
            getType: jest.fn(() => "LineString"),
            getCoordinates: jest.fn(() => [
              [0, 0],
              [0, 1],
            ]),
          },
        }),
      }; // Mocked feature object
      const mockLayer = {
        get: jest.fn(() => "ImageArcGISRest Layer"),
        getProperties: () => ({
          name: "ImageArcGISRest Layer",
        }),
      };
      callback(mockFeature, mockLayer); // Call the callback with the mock feature
    }),
  };
  const coordinate = [0, 0];
  const pixel = [639, 366];

  const copiedLayerConfig = JSON.parse(
    JSON.stringify(layerConfigImageArcGISRest),
  );
  copiedLayerConfig.configuration.props.source.props.params = {
    LAYERS: "show:0,2",
  };

  const features = await queryLayerFeatures(
    copiedLayerConfig,
    mockMap,
    coordinate,
    pixel,
  );

  const params = new URLSearchParams({
    f: "json",
    tolerance: 10, // Pixel tolerance
    returnGeometry: true,
    geometryType: "esriGeometryPoint",
    sr: "4326",
    geometry: "0,0",
    mapExtent: "1,2,3,4",
    returnFieldName: true,
    imageDisplay: "100, 200, 500",
    layers: "visible:0,2",
  });
  const featureQueryUrl =
    layerConfigImageArcGISRest.configuration.props.source.props.url +
    "/identify";
  expect(global.fetch).toHaveBeenCalledWith(
    `${featureQueryUrl}?${params.toString()}`,
  );
  expect(features).toStrictEqual(mockArgisResults);

  global.fetch.mockRestore?.();
});

test("queryLayerFeatures ImageArcGISRest Bad Request", async () => {
  const mockArgisResults = null;

  global.fetch = jest.fn(() => Promise.reject(new Error("Network error")));

  const mockMap = {
    getSize: jest.fn(() => [100, 200]),
    getView: jest.fn(() => ({
      calculateExtent: jest.fn(() => [1, 2, 3, 4]),
      getResolution: jest.fn(() => 500),
      getProjection: jest.fn(() => ({
        getCode: jest.fn(() => "EPSG:4326"),
      })),
      getZoom: jest.fn(() => 10),
    })),
    forEachFeatureAtPixel: jest.fn((pixel, callback) => {
      // Simulate features found at the given pixel
      const mockFeature = {
        getId: () => "feature-123",
        getProperties: () => ({
          geometry: {
            getType: jest.fn(() => "LineString"),
            getCoordinates: jest.fn(() => [
              [0, 0],
              [0, 1],
            ]),
          },
        }),
      }; // Mocked feature object
      const mockLayer = {
        get: jest.fn(() => "ImageArcGISRest Layer"),
        getProperties: () => ({
          name: "ImageArcGISRest Layer",
        }),
      };
      callback(mockFeature, mockLayer); // Call the callback with the mock feature
    }),
  };
  const coordinate = [0, 0];
  const pixel = [639, 366];

  const features = await queryLayerFeatures(
    layerConfigImageArcGISRest,
    mockMap,
    coordinate,
    pixel,
  );

  const params = new URLSearchParams({
    f: "json",
    tolerance: 10, // Pixel tolerance
    returnGeometry: true,
    geometryType: "esriGeometryPoint",
    sr: "4326",
    geometry: "0,0",
    mapExtent: "1,2,3,4",
    returnFieldName: true,
    imageDisplay: "100, 200, 500",
    layers: "visible",
  });
  const featureQueryUrl =
    layerConfigImageArcGISRest.configuration.props.source.props.url +
    "/identify";
  expect(global.fetch).toHaveBeenCalledWith(
    `${featureQueryUrl}?${params.toString()}`,
  );
  expect(features).toStrictEqual(mockArgisResults);

  global.fetch.mockRestore?.();
});

test("queryLayerFeatures ImageArcGISRest with minZoomQuery", async () => {
  global.fetch = jest.fn();

  const mockSetCenter = jest.fn();
  const mockSetZoom = jest.fn();
  const mockMap = {
    getSize: jest.fn(() => [100, 200]),
    getView: jest.fn(() => ({
      setCenter: mockSetCenter,
      setZoom: mockSetZoom,
      getZoom: jest.fn(() => 10),
    })),
  };
  const coordinate = [0, 0];
  const pixel = [639, 366];
  layerConfigImageArcGISRest.configuration.props.minZoomQuery = 12;

  const features = await queryLayerFeatures(
    layerConfigImageArcGISRest,
    mockMap,
    coordinate,
    pixel,
  );

  expect(global.fetch).toHaveBeenCalledTimes(0);
  expect(mockSetCenter).toHaveBeenCalledWith([0, 0]);
  expect(mockSetZoom).toHaveBeenCalledWith(12.1);
  expect(features).toStrictEqual("zoomed");

  global.fetch.mockRestore?.();
});

test("queryLayerFeatures ImageWMS", async () => {
  const mockfetchResults = {
    type: "FeatureCollection",
    totalFeatures: "unknown",
    features: [
      {
        type: "Feature",
        id: "tiger_roads.251",
        geometry: {
          type: "MultiLineString",
          coordinates: [
            [
              [-73.989342, 40.748117],
              [-73.992129, 40.749344],
            ],
          ],
        },
        geometry_name: "the_geom",
        properties: {
          CFCC: "A41",
          NAME: "W 31st St",
        },
      },
    ],
    crs: {
      type: "name",
      properties: {
        name: "urn:ogc:def:crs:EPSG::4326",
      },
    },
  };

  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve(mockfetchResults),
    }),
  );

  const mockMap = {
    getSize: jest.fn(() => [100, 200]),
    getView: jest.fn(() => ({
      calculateExtent: jest.fn(() => [1, 2, 3, 4]),
      getProjection: jest.fn(() => ({
        getCode: jest.fn(() => "EPSG:4326"),
      })),
      getZoom: jest.fn(() => 10),
    })),
  };
  const coordinate = [0, 0];
  const pixel = [639, 366];

  const features = await queryLayerFeatures(
    layerConfigImageWMS,
    mockMap,
    coordinate,
    pixel,
  );

  const params = new URLSearchParams({
    INFO_FORMAT: "application/json",
    LAYERS: "topp:states",
    QUERY_LAYERS: "topp:states",
    X: 639,
    Y: 366,
    SRS: "EPSG:4326",
    BBOX: "1,2,3,4",
    HEIGHT: 200,
    WIDTH: 100,
    REQUEST: "GetFeatureInfo",
    VERSION: "1.1.1",
  });
  const featureQueryUrl =
    layerConfigImageWMS.configuration.props.source.props.url;
  expect(global.fetch).toHaveBeenCalledWith(
    `${featureQueryUrl}?${params.toString()}`,
  );

  const expectedFeatures = [
    {
      attributes: { CFCC: "A41", NAME: "W 31st St" },
      geometry: {
        coordinates: [
          [
            [-73.989342, 40.748117],
            [-73.992129, 40.749344],
          ],
        ],
        type: "MultiLineString",
      },
      layerName: "tiger_roads",
    },
  ];
  expect(features).toStrictEqual(expectedFeatures);

  global.fetch.mockRestore?.();
});

test("queryLayerFeatures ImageWMS Different Projection", async () => {
  const mockfetchResults = {
    type: "FeatureCollection",
    totalFeatures: "unknown",
    features: [
      {
        type: "Feature",
        id: "tiger_roads.251",
        geometry: {
          type: "MultiLineString",
          coordinates: [
            [
              [2.294364273602696, 48.85882287559042],
              [3.294364273602696, 49.85882287559042],
            ],
          ],
        },
        geometry_name: "the_geom",
        properties: {
          CFCC: "A41",
          NAME: "W 31st St",
        },
      },
    ],
    crs: {
      type: "name",
      properties: {
        name: "urn:ogc:def:crs:EPSG::4326",
      },
    },
  };

  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve(mockfetchResults),
    }),
  );

  const mockMap = {
    getSize: jest.fn(() => [100, 200]),
    getView: jest.fn(() => ({
      calculateExtent: jest.fn(() => [1, 2, 3, 4]),
      getProjection: jest.fn(() => ({
        getCode: jest.fn(() => "EPSG:3857"),
      })),
      getZoom: jest.fn(() => 10),
    })),
  };
  const coordinate = [0, 0];
  const pixel = [639, 366];

  const features = await queryLayerFeatures(
    layerConfigImageWMS,
    mockMap,
    coordinate,
    pixel,
  );

  const params = new URLSearchParams({
    INFO_FORMAT: "application/json",
    LAYERS: "topp:states",
    QUERY_LAYERS: "topp:states",
    X: 639,
    Y: 366,
    SRS: "EPSG:3857",
    BBOX: "1,2,3,4",
    HEIGHT: 200,
    WIDTH: 100,
    REQUEST: "GetFeatureInfo",
    VERSION: "1.1.1",
  });
  const featureQueryUrl =
    layerConfigImageWMS.configuration.props.source.props.url;
  expect(global.fetch).toHaveBeenCalledWith(
    `${featureQueryUrl}?${params.toString()}`,
  );

  const expectedFeatures = [
    {
      attributes: { CFCC: "A41", NAME: "W 31st St" },
      geometry: {
        coordinates: [
          [
            [255407.46263173112, 6250940.451723791],
            [366726.9534250047, 6421862.25291049],
          ],
        ],
        type: "MultiLineString",
      },
      layerName: "tiger_roads",
    },
  ];
  expect(features).toStrictEqual(expectedFeatures);

  global.fetch.mockRestore?.();
});

test("queryLayerFeatures ImageWMS Bad Request", async () => {
  const mockfetchResults = null;

  global.fetch = jest.fn(() => Promise.reject(new Error("Network error")));

  const mockMap = {
    getSize: jest.fn(() => [100, 200]),
    getView: jest.fn(() => ({
      calculateExtent: jest.fn(() => [1, 2, 3, 4]),
      getProjection: jest.fn(() => ({
        getCode: jest.fn(() => "EPSG:3857"),
      })),
      getZoom: jest.fn(() => 10),
    })),
  };
  const coordinate = [0, 0];
  const pixel = [639, 366];

  const features = await queryLayerFeatures(
    layerConfigImageWMS,
    mockMap,
    coordinate,
    pixel,
  );

  const params = new URLSearchParams({
    INFO_FORMAT: "application/json",
    LAYERS: "topp:states",
    QUERY_LAYERS: "topp:states",
    X: 639,
    Y: 366,
    SRS: "EPSG:3857",
    BBOX: "1,2,3,4",
    HEIGHT: 200,
    WIDTH: 100,
    REQUEST: "GetFeatureInfo",
    VERSION: "1.1.1",
  });
  const featureQueryUrl =
    layerConfigImageWMS.configuration.props.source.props.url;
  expect(global.fetch).toHaveBeenCalledWith(
    `${featureQueryUrl}?${params.toString()}`,
  );
  expect(features).toStrictEqual(mockfetchResults);

  global.fetch.mockRestore?.();
});

test("queryLayerFeatures PMTiles Vector", async () => {
  const coordinate = [0, 0];
  const pixel = [639, 366];

  const mockFeature = {
    getType: () => "LineString",
    getFlatCoordinates: () => [0, 0, 0, 1],
    getProperties: () => ({
      id: "feature-123",
      prop1: "value1",
    }),
    get: () => "PMTiles Vector Layer",
  };

  const mockMap = {
    getView: jest.fn(() => ({
      getZoom: jest.fn(() => 10),
    })),
    forEachFeatureAtPixel: jest.fn((pixelArg, callback) => {
      callback(mockFeature, {});
    }),
  };

  const features = await queryLayerFeatures(
    layerConfigPMTilesVector,
    mockMap,
    coordinate,
    pixel,
  );

  expect(mockMap.forEachFeatureAtPixel).toHaveBeenCalledWith(
    pixel,
    expect.any(Function),
  );
  expect(features).toStrictEqual([
    {
      layerName: "PMTiles Vector Layer",
      attributes: {
        id: "feature-123",
        prop1: "value1",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [0, 0],
          [0, 1],
        ],
      },
    },
  ]);
});

test("queryLayerFeatures PMTiles Vector Layer Name Mismatch", async () => {
  const coordinate = [0, 0];
  const pixel = [639, 366];

  const highlightLayer = {
    get: jest.fn(() => "Highlighted Layer"),
  };

  const mockMap = {
    getView: jest.fn(() => ({
      getZoom: jest.fn(() => 10),
    })),
    forEachFeatureAtPixel: jest.fn((pixelArg, callback) => {
      // this should be filtered out by the layer name check
      callback(null, highlightLayer);
    }),
  };

  const features = await queryLayerFeatures(
    layerConfigPMTilesVector,
    mockMap,
    coordinate,
    pixel,
  );

  expect(mockMap.forEachFeatureAtPixel).toHaveBeenCalledWith(
    pixel,
    expect.any(Function),
  );
  expect(features).toStrictEqual([]);
});

test("queryLayerFeatures PMTiles Vector No Features Found", async () => {
  const coordinate = [0, 0];
  const pixel = [639, 366];

  const mockLayer = {
    get: jest.fn(() => "PMTiles Vector Layer"),
  };

  const mockMap = {
    getView: jest.fn(() => ({
      getZoom: jest.fn(() => 10),
    })),
    forEachFeatureAtPixel: jest.fn((pixelArg, callback) => {
      callback(null, mockLayer);
    }),
  };

  const features = await queryLayerFeatures(
    layerConfigPMTilesVector,
    mockMap,
    coordinate,
    pixel,
  );

  expect(mockMap.forEachFeatureAtPixel).toHaveBeenCalledWith(
    pixel,
    expect.any(Function),
  );
  expect(features).toStrictEqual([]);
});

test("queryLayerFeatures KML", async () => {
  const mockMap = {
    getView: jest.fn(() => ({
      getResolution: jest.fn(),
      getZoom: jest.fn(() => 10),
    })),
    forEachFeatureAtPixel: jest.fn((pixel, callback) => {
      // Simulate features found at the given pixel
      const mockFeature = {
        getId: () => "feature-123",
        getProperties: () => ({
          geometry: {
            getType: jest.fn(() => "LineString"),
            getCoordinates: jest.fn(() => [
              [0, 0],
              [0, 1],
            ]),
          },
          attr1: "value1",
          styleUrl: "someStyle",
        }),
      }; // Mocked feature object
      const mockLayer = {
        get: jest.fn(() => "KML Layer"),
        getProperties: () => ({
          name: "KML Layer",
        }),
      };
      callback(mockFeature, mockLayer); // Call the callback with the mock feature
    }),
  };
  const coordinate = [0, 0];
  const pixel = [639, 366];

  const features = await queryLayerFeatures(
    layerConfigKML,
    mockMap,
    coordinate,
    pixel,
  );

  expect(features).toStrictEqual([
    {
      layerName: "KML Layer",
      attributes: { attr1: "value1" },
      geometry: {
        type: "LineString",
        coordinates: [
          [0, 0],
          [0, 1],
        ],
      },
    },
  ]);
});

// --- GeoTIFF queryLayerFeatures (pixel-value extraction via layer.getData) -

const geoTIFFLayerConfig = ({ nodata } = {}) => ({
  configuration: {
    type: "WebGLTile",
    props: {
      name: "Test GeoTIFF Layer",
      source: {
        type: "GeoTIFF",
        props: {
          sources: [
            {
              url: "https://example.com/test.tif",
              ...(nodata !== undefined ? { nodata } : {}),
            },
          ],
        },
      },
    },
  },
});

const mockGeoTIFFMap = ({ getDataReturn, layerName = "Test GeoTIFF Layer" }) => {
  const targetLayer = {
    get: jest.fn((key) => (key === "name" ? layerName : undefined)),
    getData: jest.fn(() => getDataReturn),
  };
  return {
    map: {
      getView: jest.fn(() => ({
        getResolution: jest.fn(),
        getZoom: jest.fn(() => 10),
      })),
      getLayers: jest.fn(() => ({
        getArray: jest.fn(() => [targetLayer]),
      })),
    },
    targetLayer,
  };
};

test("queryLayerFeatures GeoTIFF returns band values at pixel", async () => {
  const { map } = mockGeoTIFFMap({ getDataReturn: new Float32Array([285.3]) });
  const features = await queryLayerFeatures(
    geoTIFFLayerConfig(),
    map,
    [0, 0],
    [400, 300],
  );

  expect(features).toHaveLength(1);
  expect(features[0].layerName).toBe("Test GeoTIFF Layer");
  expect(features[0].attributes["Band 1"]).toBeCloseTo(285.3, 4);
  expect(features[0].geometry).toEqual({ type: "Point", coordinates: [0, 0] });
});

test("queryLayerFeatures GeoTIFF reports multi-band values", async () => {
  const { map } = mockGeoTIFFMap({
    getDataReturn: new Uint8Array([12, 34, 56]),
  });
  const features = await queryLayerFeatures(
    geoTIFFLayerConfig(),
    map,
    [0, 0],
    [400, 300],
  );

  expect(features[0].attributes).toEqual({
    "Band 1": 12,
    "Band 2": 34,
    "Band 3": 56,
  });
});

test("queryLayerFeatures GeoTIFF returns empty when getData returns null", async () => {
  // Pixel outside the raster's footprint, or tile not loaded yet.
  const { map } = mockGeoTIFFMap({ getDataReturn: null });
  const features = await queryLayerFeatures(
    geoTIFFLayerConfig(),
    map,
    [0, 0],
    [400, 300],
  );
  expect(features).toEqual([]);
});

test("queryLayerFeatures GeoTIFF returns empty when no matching layer on map", async () => {
  // No layer with the configured name exists on the map (layer not yet
  // instantiated, or name mismatch). Function should return [] rather than
  // crash on `targetLayer.getData(...)`.
  const map = {
    getView: jest.fn(() => ({
      getResolution: jest.fn(),
      getZoom: jest.fn(() => 10),
    })),
    getLayers: jest.fn(() => ({ getArray: jest.fn(() => []) })),
  };
  const features = await queryLayerFeatures(
    geoTIFFLayerConfig(),
    map,
    [0, 0],
    [400, 300],
  );
  expect(features).toEqual([]);
});

test("queryLayerFeatures GeoTIFF reports 'No data' when alpha band is 0", async () => {
  // OL nodata behavior: when a SourceInfo declares `nodata`, OL adds an
  // alpha band. data = [value, alpha]. Alpha === 0 means nodata regardless
  // of the substituted value (typically 0).
  const { map } = mockGeoTIFFMap({
    getDataReturn: new Float32Array([0, 0]),
  });
  const features = await queryLayerFeatures(
    geoTIFFLayerConfig({ nodata: -9999 }),
    map,
    [0, 0],
    [400, 300],
  );
  expect(features[0].attributes).toEqual({ "Band 1": "No data" });
});

test("queryLayerFeatures GeoTIFF strips the alpha band from reported attrs when nodata declared and alpha != 0", async () => {
  // Single band with declared nodata: getData = [value, alpha=non-zero].
  // The alpha band is plumbing — it should not be reported as "Band 2".
  const { map } = mockGeoTIFFMap({
    getDataReturn: new Float32Array([285.3, 1]),
  });
  const features = await queryLayerFeatures(
    geoTIFFLayerConfig({ nodata: -9999 }),
    map,
    [0, 0],
    [400, 300],
  );
  expect(Object.keys(features[0].attributes)).toEqual(["Band 1"]);
  expect(features[0].attributes["Band 1"]).toBeCloseTo(285.3, 4);
});

test("queryLayerFeatures SourceType Not Configured", async () => {
  const layerConfig = {
    configuration: {
      type: "ImageLayer",
      props: {
        name: "Bad Type",
        source: {
          type: "sdfsdfsdf",
          props: {
            url: "https://ahocevar.com/geoserver/wms",
            params: { LAYERS: "topp:states" },
          },
        },
        zIndex: 1,
      },
    },
  };
  const getZoomMock = jest.fn(() => 10); // or whatever zoom level you want

  const mockMap = {
    getView: jest.fn(() => ({
      getZoom: getZoomMock,
    })),
  };
  const coordinate = [0, 0];
  const pixel = [639, 366];

  await expect(
    queryLayerFeatures(layerConfig, mockMap, coordinate, pixel),
  ).rejects.toThrow("sdfsdfsdf is not currently configured to be queried");
});

test("getLayerAttributes ImageArcGISRest", async () => {
  const mockServiceResults = {
    layers: [
      {
        id: 0,
        name: "Max Status - Forecast Trend",
        parentLayerId: -1,
        defaultVisibility: true,
        subLayerIds: null,
        minScale: 0,
        maxScale: 0,
        type: "Feature Layer",
        geometryType: "esriGeometryPoint",
        supportsDynamicLegends: true,
      },
    ],
  };

  const mockLayerResults = {
    fields: [
      {
        name: "nws_name",
        type: "esriFieldTypeString",
        alias: "Name",
        length: 60000,
        domain: null,
      },
      {
        name: "producer",
        type: "esriFieldTypeString",
        alias: "RFC",
        length: 60000,
        domain: null,
      },
    ],
  };

  const mockFetch = jest.fn();
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: mockFetch,
    }),
  );
  mockFetch.mockResolvedValueOnce(mockServiceResults);
  mockFetch.mockResolvedValueOnce(mockLayerResults);

  const sourceProps = layerConfigImageArcGISRest.configuration.props.source;
  const layerName = layerConfigImageArcGISRest.configuration.props.name;
  const attributes = await getLayerAttributes(sourceProps, layerName);

  expect(attributes).toStrictEqual({
    "Max Status - Forecast Trend": [
      { name: "nws_name", alias: "Name" },
      { name: "producer", alias: "RFC" },
    ],
  });
});

test("getLayerAttributes ImageArcGISRest, param layers show", async () => {
  const mockServiceResults = {
    layers: [
      {
        id: 0,
        name: "Max Status - Forecast Trend",
        parentLayerId: -1,
        defaultVisibility: true,
        subLayerIds: null,
        minScale: 0,
        maxScale: 0,
        type: "Feature Layer",
        geometryType: "esriGeometryPoint",
        supportsDynamicLegends: true,
      },
      {
        id: 1,
        name: "Max Status - Forecast Trend (1)",
        parentLayerId: -1,
        defaultVisibility: true,
        subLayerIds: null,
        minScale: 0,
        maxScale: 0,
        type: "Feature Layer",
        geometryType: "esriGeometryPoint",
        supportsDynamicLegends: true,
      },
      {
        id: 2,
        name: "Max Status - Forecast Trend (2)",
        parentLayerId: -1,
        defaultVisibility: true,
        subLayerIds: null,
        minScale: 0,
        maxScale: 0,
        type: "Feature Layer",
        geometryType: "esriGeometryPoint",
        supportsDynamicLegends: true,
      },
    ],
  };

  const mockLayerResults = {
    fields: [
      {
        name: "nws_name",
        type: "esriFieldTypeString",
        alias: "Name",
        length: 60000,
        domain: null,
      },
    ],
  };

  const mockLayerResults3 = {
    fields: [
      {
        name: "nws_name3",
        type: "esriFieldTypeString",
        alias: "Name3",
        length: 60000,
        domain: null,
      },
    ],
  };

  const mockFetch = jest.fn();
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: mockFetch,
    }),
  );
  mockFetch.mockResolvedValueOnce(mockServiceResults);
  mockFetch.mockResolvedValueOnce(mockLayerResults);
  mockFetch.mockResolvedValueOnce(mockLayerResults3);

  const sourceProps = layerConfigImageArcGISRest.configuration.props.source;
  const layerName = layerConfigImageArcGISRest.configuration.props.name;

  sourceProps.props.params = {
    LAYERS: "show:0,2",
  };

  const attributes = await getLayerAttributes(sourceProps, layerName);

  expect(attributes).toStrictEqual({
    "Max Status - Forecast Trend": [{ name: "nws_name", alias: "Name" }],
    "Max Status - Forecast Trend (2)": [{ name: "nws_name3", alias: "Name3" }],
  });
});

test("getLayerAttributes ImageArcGISRest, param layers hide", async () => {
  const mockServiceResults = {
    layers: [
      {
        id: 0,
        name: "Max Status - Forecast Trend",
        parentLayerId: -1,
        defaultVisibility: true,
        subLayerIds: null,
        minScale: 0,
        maxScale: 0,
        type: "Feature Layer",
        geometryType: "esriGeometryPoint",
        supportsDynamicLegends: true,
      },
      {
        id: 1,
        name: "Max Status - Forecast Trend (1)",
        parentLayerId: -1,
        defaultVisibility: true,
        subLayerIds: null,
        minScale: 0,
        maxScale: 0,
        type: "Feature Layer",
        geometryType: "esriGeometryPoint",
        supportsDynamicLegends: true,
      },
      {
        id: 2,
        name: "Max Status - Forecast Trend (2)",
        parentLayerId: -1,
        defaultVisibility: true,
        subLayerIds: null,
        minScale: 0,
        maxScale: 0,
        type: "Feature Layer",
        geometryType: "esriGeometryPoint",
        supportsDynamicLegends: true,
      },
    ],
  };

  const mockLayerResults = {
    fields: [
      {
        name: "nws_name2",
        type: "esriFieldTypeString",
        alias: "Name2",
        length: 60000,
        domain: null,
      },
    ],
  };

  const mockFetch = jest.fn();
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: mockFetch,
    }),
  );
  mockFetch.mockResolvedValueOnce(mockServiceResults);
  mockFetch.mockResolvedValueOnce(mockLayerResults);

  const sourceProps = layerConfigImageArcGISRest.configuration.props.source;
  const layerName = layerConfigImageArcGISRest.configuration.props.name;

  sourceProps.props.params = {
    LAYERS: "hide:0,2",
  };

  const attributes = await getLayerAttributes(sourceProps, layerName);

  expect(attributes).toStrictEqual({
    "Max Status - Forecast Trend (1)": [{ name: "nws_name2", alias: "Name2" }],
  });
});

test("getLayerAttributes ImageArcGISRest, param layers include", async () => {
  const mockServiceResults = {
    layers: [
      {
        id: 0,
        name: "Max Status - Forecast Trend",
        parentLayerId: -1,
        defaultVisibility: true,
        subLayerIds: null,
        minScale: 0,
        maxScale: 0,
        type: "Feature Layer",
        geometryType: "esriGeometryPoint",
        supportsDynamicLegends: true,
      },
      {
        id: 1,
        name: "Max Status - Forecast Trend (1)",
        parentLayerId: -1,
        defaultVisibility: false,
        subLayerIds: null,
        minScale: 0,
        maxScale: 0,
        type: "Feature Layer",
        geometryType: "esriGeometryPoint",
        supportsDynamicLegends: true,
      },
      {
        id: 2,
        name: "Max Status - Forecast Trend (2)",
        parentLayerId: -1,
        defaultVisibility: false,
        subLayerIds: null,
        minScale: 0,
        maxScale: 0,
        type: "Feature Layer",
        geometryType: "esriGeometryPoint",
        supportsDynamicLegends: true,
      },
    ],
  };

  const mockLayerResults = {
    fields: [
      {
        name: "nws_name",
        type: "esriFieldTypeString",
        alias: "Name",
        length: 60000,
        domain: null,
      },
    ],
  };

  const mockLayerResults3 = {
    fields: [
      {
        name: "nws_name3",
        type: "esriFieldTypeString",
        alias: "Name3",
        length: 60000,
        domain: null,
      },
    ],
  };

  const mockFetch = jest.fn();
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: mockFetch,
    }),
  );
  mockFetch.mockResolvedValueOnce(mockServiceResults);
  mockFetch.mockResolvedValueOnce(mockLayerResults);
  mockFetch.mockResolvedValueOnce(mockLayerResults3);

  const sourceProps = layerConfigImageArcGISRest.configuration.props.source;
  const layerName = layerConfigImageArcGISRest.configuration.props.name;

  sourceProps.props.params = {
    LAYERS: "include:2",
  };

  const attributes = await getLayerAttributes(sourceProps, layerName);

  expect(attributes).toStrictEqual({
    "Max Status - Forecast Trend": [{ name: "nws_name", alias: "Name" }],
    "Max Status - Forecast Trend (2)": [{ name: "nws_name3", alias: "Name3" }],
  });
});

test("getLayerAttributes ImageArcGISRest, param layers exclude", async () => {
  const mockServiceResults = {
    layers: [
      {
        id: 0,
        name: "Max Status - Forecast Trend",
        parentLayerId: -1,
        defaultVisibility: true,
        subLayerIds: null,
        minScale: 0,
        maxScale: 0,
        type: "Feature Layer",
        geometryType: "esriGeometryPoint",
        supportsDynamicLegends: true,
      },
      {
        id: 1,
        name: "Max Status - Forecast Trend (1)",
        parentLayerId: -1,
        defaultVisibility: true,
        subLayerIds: null,
        minScale: 0,
        maxScale: 0,
        type: "Feature Layer",
        geometryType: "esriGeometryPoint",
        supportsDynamicLegends: true,
      },
      {
        id: 2,
        name: "Max Status - Forecast Trend (2)",
        parentLayerId: -1,
        defaultVisibility: true,
        subLayerIds: null,
        minScale: 0,
        maxScale: 0,
        type: "Feature Layer",
        geometryType: "esriGeometryPoint",
        supportsDynamicLegends: true,
      },
    ],
  };

  const mockLayerResults = {
    fields: [
      {
        name: "nws_name",
        type: "esriFieldTypeString",
        alias: "Name",
        length: 60000,
        domain: null,
      },
    ],
  };

  const mockLayerResults3 = {
    fields: [
      {
        name: "nws_name3",
        type: "esriFieldTypeString",
        alias: "Name3",
        length: 60000,
        domain: null,
      },
    ],
  };

  const mockFetch = jest.fn();
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: mockFetch,
    }),
  );
  mockFetch.mockResolvedValueOnce(mockServiceResults);
  mockFetch.mockResolvedValueOnce(mockLayerResults);
  mockFetch.mockResolvedValueOnce(mockLayerResults3);

  const sourceProps = layerConfigImageArcGISRest.configuration.props.source;
  const layerName = layerConfigImageArcGISRest.configuration.props.name;

  sourceProps.props.params = {
    LAYERS: "exclude:1",
  };

  const attributes = await getLayerAttributes(sourceProps, layerName);

  expect(attributes).toStrictEqual({
    "Max Status - Forecast Trend": [{ name: "nws_name", alias: "Name" }],
    "Max Status - Forecast Trend (2)": [{ name: "nws_name3", alias: "Name3" }],
  });
});

test("getLayerAttributes ImageArcGISRest, param layers nonsense, missing fields", async () => {
  const mockServiceResults = {
    layers: [
      {
        id: 0,
        name: "Max Status - Forecast Trend",
        parentLayerId: -1,
        defaultVisibility: true,
        subLayerIds: null,
        minScale: 0,
        maxScale: 0,
        type: "Feature Layer",
        geometryType: "esriGeometryPoint",
        supportsDynamicLegends: true,
      },
      {
        id: 1,
        name: "Max Status - Forecast Trend (1)",
        parentLayerId: -1,
        defaultVisibility: false,
        subLayerIds: null,
        minScale: 0,
        maxScale: 0,
        type: "Feature Layer",
        geometryType: "esriGeometryPoint",
        supportsDynamicLegends: true,
      },
      {
        id: 2,
        name: "Max Status - Forecast Trend (2)",
        parentLayerId: -1,
        defaultVisibility: true,
        subLayerIds: null,
        minScale: 0,
        maxScale: 0,
        type: "Feature Layer",
        geometryType: "esriGeometryPoint",
        supportsDynamicLegends: true,
      },
    ],
  };

  const mockLayerResults = {};

  const mockLayerResults3 = {
    fields: [
      {
        name: "nws_name3",
        type: "esriFieldTypeString",
        alias: "Name3",
        length: 60000,
        domain: null,
      },
    ],
  };

  const mockFetch = jest.fn();
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: mockFetch,
    }),
  );
  mockFetch.mockResolvedValueOnce(mockServiceResults);
  mockFetch.mockResolvedValueOnce(mockLayerResults);
  mockFetch.mockResolvedValueOnce(mockLayerResults3);

  const sourceProps = layerConfigImageArcGISRest.configuration.props.source;
  const layerName = layerConfigImageArcGISRest.configuration.props.name;

  sourceProps.props.params = {
    LAYERS: "nonsense:1",
  };

  const attributes = await getLayerAttributes(sourceProps, layerName);

  expect(attributes).toStrictEqual({
    "Max Status - Forecast Trend": [],
    "Max Status - Forecast Trend (2)": [{ name: "nws_name3", alias: "Name3" }],
  });
});

test("getLayerAttributes ArcGISFeatureService", async () => {
  const mockServiceResults = {
    id: 0,
    name: "Max Status - Forecast Trend",
    parentLayerId: -1,
    defaultVisibility: true,
    subLayerIds: null,
    minScale: 0,
    maxScale: 0,
    type: "Feature Layer",
    geometryType: "esriGeometryPoint",
    supportsDynamicLegends: true,
    fields: [
      {
        name: "nws_name",
        type: "esriFieldTypeString",
        alias: "Name",
        length: 60000,
        domain: null,
      },
      {
        name: "producer",
        type: "esriFieldTypeString",
        alias: "RFC",
        length: 60000,
        domain: null,
      },
    ],
  };

  const mockFetch = jest.fn();
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: mockFetch,
    }),
  );
  mockFetch.mockResolvedValueOnce(mockServiceResults);

  const sourceProps =
    layerConfigArcGISFeatureService.configuration.props.source;
  const layerName = layerConfigArcGISFeatureService.configuration.props.name;
  const attributes = await getLayerAttributes(sourceProps, layerName);

  expect(attributes).toStrictEqual({
    "Some ArcGISFeatureService Layer": [
      { name: "nws_name", alias: "Name" },
      { name: "producer", alias: "RFC" },
    ],
  });

  const params = new URLSearchParams({
    f: "json",
  });

  const featureQueryUrl =
    layerConfigArcGISFeatureService.configuration.props.source.props.url +
    "/" +
    layerConfigArcGISFeatureService.configuration.props.source.props.layer;
  expect(global.fetch).toHaveBeenCalledWith(
    `${featureQueryUrl}?${params.toString()}`,
  );
});

test("getLayerAttributes ArcGISFeatureService with slash", async () => {
  const mockServiceResults = {
    id: 0,
    name: "Max Status - Forecast Trend",
    parentLayerId: -1,
    defaultVisibility: true,
    subLayerIds: null,
    minScale: 0,
    maxScale: 0,
    type: "Feature Layer",
    geometryType: "esriGeometryPoint",
    supportsDynamicLegends: true,
    fields: [
      {
        name: "nws_name",
        type: "esriFieldTypeString",
        alias: "Name",
        length: 60000,
        domain: null,
      },
      {
        name: "producer",
        type: "esriFieldTypeString",
        alias: "RFC",
        length: 60000,
        domain: null,
      },
    ],
  };

  const mockFetch = jest.fn();
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: mockFetch,
    }),
  );
  mockFetch.mockResolvedValueOnce(mockServiceResults);

  layerConfigArcGISFeatureService.configuration.props.source.props.url += "/";
  const sourceProps =
    layerConfigArcGISFeatureService.configuration.props.source;
  const layerName = layerConfigArcGISFeatureService.configuration.props.name;
  const attributes = await getLayerAttributes(sourceProps, layerName);

  expect(attributes).toStrictEqual({
    "Some ArcGISFeatureService Layer": [
      { name: "nws_name", alias: "Name" },
      { name: "producer", alias: "RFC" },
    ],
  });

  const params = new URLSearchParams({
    f: "json",
  });

  const featureQueryUrl =
    layerConfigArcGISFeatureService.configuration.props.source.props.url +
    layerConfigArcGISFeatureService.configuration.props.source.props.layer;
  expect(global.fetch).toHaveBeenCalledWith(
    `${featureQueryUrl}?${params.toString()}`,
  );
});

test("getLayerAttributes ImageWMS", async () => {
  const mockInfoResults =
    '<?xml version="1.0" encoding="UTF-8"?><xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:topp="http://www.openplans.org/topp" xmlns:wfs="http://www.opengis.net/wfs/2.0" elementFormDefault="qualified" targetNamespace="http://www.openplans.org/topp"><xsd:import namespace="http://www.opengis.net/gml/3.2" schemaLocation="https://ahocevar.com/geoserver/schemas/gml/3.2.1/gml.xsd"/><xsd:complexType name="statesType"><xsd:complexContent><xsd:extension base="gml:AbstractFeatureType"><xsd:sequence><xsd:element maxOccurs="1" minOccurs="0" name="the_geom" nillable="true" type="gml:MultiSurfacePropertyType"/><xsd:element maxOccurs="1" minOccurs="0" name="STATE_NAME" nillable="true" type="xsd:string"/></xsd:sequence></xsd:extension></xsd:complexContent></xsd:complexType><xsd:element name="states" substitutionGroup="gml:AbstractFeature" type="topp:statesType"/></xsd:schema>';

  const mockFetch = jest.fn();
  global.fetch = jest.fn(() =>
    Promise.resolve({
      text: mockFetch,
    }),
  );
  mockFetch.mockResolvedValueOnce(mockInfoResults);

  const sourceProps = layerConfigImageWMS.configuration.props.source;
  const layerName = layerConfigImageWMS.configuration.props.name;
  const attributes = await getLayerAttributes(sourceProps, layerName);

  expect(attributes).toStrictEqual({
    states: [
      { name: "the_geom", alias: "the_geom" },
      { name: "STATE_NAME", alias: "STATE_NAME" },
    ],
  });
});

test("getLayerAttributes ImageWMS Bad Fetch", async () => {
  global.fetch = jest.fn(() => Promise.reject(new Error("Network error")));

  const sourceProps = layerConfigImageWMS.configuration.props.source;
  const layerName = layerConfigImageWMS.configuration.props.name;

  await expect(getLayerAttributes(sourceProps, layerName)).rejects.toThrow(
    "Failed to fetch attribute data for layer 'topp:states'. Check if the layer exists.",
  );
});

test("getLayerAttributes ImageWMS XML Error", async () => {
  const mockInfoResults =
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE ServiceExceptionReport SYSTEM "https://ahocevar.com/geoserver/schemas/wms/1.1.1/WMS_exception_1_1_1.dtd"> <ServiceExceptionReport version="1.1.1" >   <ServiceException code="LayerNotDefined" locator="MapLayerInfoKvpParser">topp:tasmania_cities: no such layer on this server</ServiceException></ServiceExceptionReport>';

  const mockFetch = jest.fn();
  global.fetch = jest.fn(() =>
    Promise.resolve({
      text: mockFetch,
    }),
  );
  mockFetch.mockResolvedValueOnce(mockInfoResults);

  const sourceProps = layerConfigImageWMS.configuration.props.source;
  const layerName = layerConfigImageWMS.configuration.props.name;

  await expect(getLayerAttributes(sourceProps, layerName)).rejects.toThrow(
    "WFS DescribeFeatureType request failed for layer 'topp:states'. Ensure WFS is enabled and the layer name is correct.",
  );
});

test("getLayerAttributes ImageWMS XML Schema Error", async () => {
  const mockInfoResults =
    '<?xml version="1.0" encoding="UTF-8"?><xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:topp="http://www.openplans.org/topp" xmlns:wfs="http://www.opengis.net/wfs/2.0" elementFormDefault="qualified" targetNamespace="http://www.openplans.org/topp"></xsd:schema>';

  const mockFetch = jest.fn();
  global.fetch = jest.fn(() =>
    Promise.resolve({
      text: mockFetch,
    }),
  );
  mockFetch.mockResolvedValueOnce(mockInfoResults);

  const sourceProps = layerConfigImageWMS.configuration.props.source;
  const layerName = layerConfigImageWMS.configuration.props.name;

  await expect(getLayerAttributes(sourceProps, layerName)).rejects.toThrow(
    "Unexpected DescribeFeatureType format for layer 'topp:states'.",
  );
});

test("getLayerAttributes ImageWMS XML Bad Fields", async () => {
  const mockInfoResults =
    '<?xml version="1.0" encoding="UTF-8"?><xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:topp="http://www.openplans.org/topp" xmlns:wfs="http://www.opengis.net/wfs/2.0" elementFormDefault="qualified" targetNamespace="http://www.openplans.org/topp"><xsd:import namespace="http://www.opengis.net/gml/3.2" schemaLocation="https://ahocevar.com/geoserver/schemas/gml/3.2.1/gml.xsd"/><xsd:complexType name="statesType"><xsd:complexContent></xsd:complexContent></xsd:complexType><xsd:element name="states" substitutionGroup="gml:AbstractFeature" type="topp:statesType"/></xsd:schema>';

  const mockFetch = jest.fn();
  global.fetch = jest.fn(() =>
    Promise.resolve({
      text: mockFetch,
    }),
  );
  mockFetch.mockResolvedValueOnce(mockInfoResults);

  const sourceProps = layerConfigImageWMS.configuration.props.source;
  const layerName = layerConfigImageWMS.configuration.props.name;
  const attributes = await getLayerAttributes(sourceProps, layerName);

  expect(attributes).toStrictEqual({});
});

test("getLayerAttributes ImageWMS No complexType Type and No element Name", async () => {
  const mockInfoResults =
    '<?xml version="1.0" encoding="UTF-8"?><xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:topp="http://www.openplans.org/topp" xmlns:wfs="http://www.opengis.net/wfs/2.0" elementFormDefault="qualified" targetNamespace="http://www.openplans.org/topp"><xsd:import namespace="http://www.opengis.net/gml/3.2" schemaLocation="https://ahocevar.com/geoserver/schemas/gml/3.2.1/gml.xsd"/><xsd:complexType><xsd:complexContent><xsd:extension base="gml:AbstractFeatureType"><xsd:sequence><xsd:element maxOccurs="1" minOccurs="0" name="the_geom" nillable="true" type="gml:MultiSurfacePropertyType"/><xsd:element maxOccurs="1" minOccurs="0" nillable="true" type="xsd:string"/></xsd:sequence></xsd:extension></xsd:complexContent></xsd:complexType><xsd:element name="states" substitutionGroup="gml:AbstractFeature" type="topp:statesType"/></xsd:schema>';

  const mockFetch = jest.fn();
  global.fetch = jest.fn(() =>
    Promise.resolve({
      text: mockFetch,
    }),
  );
  mockFetch.mockResolvedValueOnce(mockInfoResults);

  const sourceProps = layerConfigImageWMS.configuration.props.source;
  const layerName = layerConfigImageWMS.configuration.props.name;
  const attributes = await getLayerAttributes(sourceProps, layerName);

  expect(attributes).toStrictEqual({
    "topp:states": [{ name: "the_geom", alias: "the_geom" }],
  });
});

test("getLayerAttributes ImageWMS no layers", async () => {
  const sourceProps = layerConfigImageWMS.configuration.props.source;
  sourceProps.props.params.LAYERS = undefined;
  const layerName = layerConfigImageWMS.configuration.props.name;

  await expect(getLayerAttributes(sourceProps, layerName)).rejects.toThrow(
    "No layers specified in source parameters.",
  );
});

test("getLayerAttributes GEOJSON", async () => {
  const sourceProps = layerConfigGeoJSON.configuration.props.source;
  const layerName = layerConfigGeoJSON.configuration.props.name;
  const attributes = await getLayerAttributes(sourceProps, layerName);

  expect(attributes).toStrictEqual({
    "GeoJSON Layer": [{ name: "Some Field", alias: "Some Field" }],
  });
});

test("getLayerAttributes GEOJSON 2", async () => {
  const updatedlayerConfigGeoJSON = JSON.parse(
    JSON.stringify(layerConfigGeoJSON),
  );
  const sourceProps = updatedlayerConfigGeoJSON.configuration.props.source;
  sourceProps.geojson = JSON.stringify(sourceProps.geojson);
  const layerName = updatedlayerConfigGeoJSON.configuration.props.name;
  const attributes = await getLayerAttributes(sourceProps, layerName);

  expect(attributes).toStrictEqual({
    "GeoJSON Layer": [{ name: "Some Field", alias: "Some Field" }],
  });
});

test("getLayerAttributes GEOJSON URL", async () => {
  const mockfetchResults = {
    type: "FeatureCollection",
    totalFeatures: "unknown",
    features: [
      {
        type: "Feature",
        id: "tiger_roads.251",
        geometry: {
          type: "MultiLineString",
          coordinates: [
            [
              [-73.989342, 40.748117],
              [-73.992129, 40.749344],
            ],
          ],
        },
        geometry_name: "the_geom",
        properties: {
          CFCC: "A41",
          NAME: "W 31st St",
        },
      },
    ],
    crs: {
      type: "name",
      properties: {
        name: "urn:ogc:def:crs:EPSG::4326",
      },
    },
  };

  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockfetchResults)),
    }),
  );

  const updatedlayerConfigGeoJSON = JSON.parse(
    JSON.stringify(layerConfigGeoJSON),
  );
  const sourceProps = updatedlayerConfigGeoJSON.configuration.props.source;
  sourceProps.geojson = "some/url.json";
  const layerName = updatedlayerConfigGeoJSON.configuration.props.name;
  const attributes = await getLayerAttributes(sourceProps, layerName);

  expect(attributes).toStrictEqual({
    "GeoJSON Layer": [
      { name: "CFCC", alias: "CFCC" },
      { name: "NAME", alias: "NAME" },
    ],
  });
});

test("getLayerAttributes GEOJSON Missing URL", async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: false,
      statusText: "missing",
    }),
  );

  const updatedlayerConfigGeoJSON = JSON.parse(
    JSON.stringify(layerConfigGeoJSON),
  );
  const sourceProps = updatedlayerConfigGeoJSON.configuration.props.source;
  sourceProps.geojson = "some/url.json";
  const layerName = updatedlayerConfigGeoJSON.configuration.props.name;

  await expect(getLayerAttributes(sourceProps, layerName)).rejects.toThrow(
    "Failed to fetch: missing",
  );
});

test("getLayerAttributes GEOJSON no features", async () => {
  const updatedlayerConfigGeoJSON = JSON.parse(
    JSON.stringify(layerConfigGeoJSON),
  );
  const sourceProps = updatedlayerConfigGeoJSON.configuration.props.source;
  delete sourceProps.geojson.features;
  const layerName = updatedlayerConfigGeoJSON.configuration.props.name;
  const attributes = await getLayerAttributes(sourceProps, layerName);

  expect(attributes).toStrictEqual({ "GeoJSON Layer": [] });
});

test("getLayerAttributes GEOJSON no feature properties", async () => {
  const updatedlayerConfigGeoJSON = JSON.parse(
    JSON.stringify(layerConfigGeoJSON),
  );
  const sourceProps = updatedlayerConfigGeoJSON.configuration.props.source;
  sourceProps.geojson.features = [
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [0, 0],
      },
    },
  ];
  const layerName = updatedlayerConfigGeoJSON.configuration.props.name;
  const attributes = await getLayerAttributes(sourceProps, layerName);

  expect(attributes).toStrictEqual({ "GeoJSON Layer": [] });
});

test("getLayerAttributes KML", async () => {
  const sourceProps = layerConfigKML.configuration.props.source;
  const layerName = layerConfigKML.configuration.props.name;

  const mockKMLText = `<?xml version="1.0" encoding="UTF-8"?>
  <kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
      <Placemark>
        <name>Test Placemark</name>
        <description>Test Description</description>
        <styleUrl>#testStyle</styleUrl>
        <Point>
          <coordinates>0,0,0</coordinates>
        </Point>
      </Placemark>
    </Document>
  </kml>`;

  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      text: () => Promise.resolve(mockKMLText),
    }),
  );

  const attributes = await getLayerAttributes(sourceProps, layerName);

  expect(attributes).toStrictEqual({
    "KML Layer": [{ name: "name", alias: "name" }],
  });
});

test("getLayerAttributes PM Tiles Vector", async () => {
  // Mock PMTiles, VectorTile, and Protobuf
  jest
    .spyOn(PMTiles.prototype, "getZxy")
    .mockResolvedValue({ data: "some data" });
  jest
    .spyOn(require("@mapbox/vector-tile"), "VectorTile")
    .mockImplementation(() => ({
      layers: {
        "PMTiles Vector Layer": {
          length: 2,
          feature: (i) => ({
            properties:
              i === 0
                ? { id: 1 }
                : i === 1
                  ? { prop1: "foo" }
                  : { prop1: "foo" },
          }),
        },
      },
    }));
  jest.mock("pbf", () => jest.fn());

  const sourceProps = layerConfigPMTilesVector.configuration.props.source;
  const layerName = layerConfigPMTilesVector.configuration.props.name;
  sourceProps.props.url = "some/url.pmtiles";

  const attributes = await getLayerAttributes(sourceProps, layerName);

  expect(attributes).toStrictEqual({
    "PMTiles Vector Layer": [
      { name: "id", alias: "id" },
      { name: "prop1", alias: "prop1" },
    ],
  });
});

test("getLayerAttributes Error", async () => {
  const sourceProps = { type: "bad type", props: {} };
  const layerName = "test";
  await expect(getLayerAttributes(sourceProps, layerName)).rejects.toThrow(
    "bad type is not currently configured to be queried",
  );
});

test("loadLayerJSONs Object", async () => {
  const style = {
    type: "Style",
    props: {
      stroke: {
        type: "Stroke",
        props: {
          color: "#501020",
          width: 1,
        },
      },
    },
  };

  const geojson = {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [0, 0],
    },
  };

  const mapLayer = {
    configuration: {
      type: "VectorLayer",
      props: {
        name: "GeoJSON Layer",
        source: {
          type: "GeoJSON",
          props: {},
          geojson: geojson,
        },
      },
      style: style,
    },
  };

  const response = await loadLayerJSONs(mapLayer, "123", true);

  expect(mapLayer.configuration.style).toStrictEqual(style);
  expect(mapLayer.configuration.props.source.geojson).toStrictEqual(geojson);
  expect(response.success).toBe(true);
});

test("loadLayerJSONs files", async () => {
  const style = {
    type: "Style",
    props: {
      stroke: {
        type: "Stroke",
        props: {
          color: "#501020",
          width: 1,
        },
      },
    },
  };

  const geojson = {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [0, 0],
    },
  };

  const mockDownloadJSON = jest.fn();
  jest.spyOn(appAPI, "downloadJSON").mockImplementation(mockDownloadJSON);
  mockDownloadJSON.mockResolvedValueOnce({
    success: true,
    data: style,
  });
  mockDownloadJSON.mockResolvedValueOnce({
    success: true,
    data: geojson,
  });

  const styleFile = "some_geojson.geojson";
  const geojsonFile = "some_style.json";

  const mapLayer = {
    configuration: {
      type: "VectorLayer",
      props: {
        name: "GeoJSON Layer",
        source: {
          type: "GeoJSON",
          props: {},
          geojson: geojsonFile,
        },
      },
      style: styleFile,
    },
  };

  const response = await loadLayerJSONs(mapLayer, "123", false);

  expect(mapLayer.configuration.style).toStrictEqual(style);
  expect(mapLayer.configuration.props.source.geojson).toStrictEqual(geojson);
  expect(response.success).toBe(true);
});

test("loadLayerJSONs files keep_urls shouldn't affect it", async () => {
  const style = {
    type: "Style",
    props: {
      stroke: {
        type: "Stroke",
        props: {
          color: "#501020",
          width: 1,
        },
      },
    },
  };

  const geojson = {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [0, 0],
    },
  };

  const mockDownloadJSON = jest.fn();
  jest.spyOn(appAPI, "downloadJSON").mockImplementation(mockDownloadJSON);
  mockDownloadJSON.mockResolvedValueOnce({
    success: true,
    data: style,
  });
  mockDownloadJSON.mockResolvedValueOnce({
    success: true,
    data: geojson,
  });

  const styleFile = "some_geojson.geojson";
  const geojsonFile = "some_style.json";

  const mapLayer = {
    configuration: {
      type: "VectorLayer",
      props: {
        name: "GeoJSON Layer",
        source: {
          type: "GeoJSON",
          props: {},
          geojson: geojsonFile,
        },
      },
      style: styleFile,
    },
  };

  const response = await loadLayerJSONs(mapLayer, "123", true);

  expect(mapLayer.configuration.style).toStrictEqual(style);
  expect(mapLayer.configuration.props.source.geojson).toStrictEqual(geojson);
  expect(response.success).toBe(true);
});

test("loadLayerJSONs urls", async () => {
  // URL-based GeoJSON is intentionally left as a URL string on
  // source.geojson so OL's VectorSource can fetch+parse it directly
  // (the `url:` shortcut), rather than going through this function's
  // intermediate JS object. Style URLs are still fetched here.
  const style = {
    type: "Style",
    props: {
      stroke: {
        type: "Stroke",
        props: {
          color: "#501020",
          width: 1,
        },
      },
    },
  };

  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(style)),
  });

  const styleFile = "some/file/some_geojson.geojson";
  const geojsonFile = "https://some/url/some_style.json";

  const mapLayer = {
    configuration: {
      type: "VectorLayer",
      props: {
        name: "GeoJSON Layer",
        source: {
          type: "GeoJSON",
          props: {},
          geojson: geojsonFile,
        },
      },
      style: styleFile,
    },
  };

  const response = await loadLayerJSONs(mapLayer, "123", false);

  // Style is fetched + parsed; geojson URL is preserved as-is.
  expect(mapLayer.configuration.style).toStrictEqual(style);
  expect(mapLayer.configuration.props.source.geojson).toBe(geojsonFile);
  expect(response.success).toBe(true);
  // Only the style URL was fetched; no fetch for the geojson URL.
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("loadLayerJSONs filename without CRS triggers fetch failure", async () => {
  // Filename-based GeoJSON (no slash, looks up via appAPI) goes through
  // the fetch+parse path. CRS-missing branch fires here because we DO
  // parse the body. URL geojson skips this path entirely (URL stays as
  // URL, no parse, no CRS check).
  const style = {
    type: "Style",
    props: {
      stroke: {
        type: "Stroke",
        props: {
          color: "#501020",
          width: 1,
        },
      },
    },
  };

  const geojsonNoCRS = {
    type: "Feature",
  };

  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(style)),
  });
  appAPI.downloadJSON = jest.fn(() =>
    Promise.resolve({ success: true, data: geojsonNoCRS }),
  );

  const mapLayer = {
    configuration: {
      type: "VectorLayer",
      props: {
        name: "GeoJSON Layer",
        source: {
          type: "GeoJSON",
          props: {},
          geojson: "stored_geojson_filename.json",
        },
      },
      style: "some/file/some_style.json",
    },
  };

  const response = await loadLayerJSONs(mapLayer, "123", false);

  expect(mapLayer.configuration.style).toStrictEqual(style);
  expect(mapLayer.configuration.props.source.geojson).toStrictEqual(undefined);
  expect(response.success).toBe(false);
  expect(response.message).toBe(
    "Failed to fetch: GeoJSON does include a crs key and CRS could not be inferred from the data. Must be a valid geojson.",
  );
});

test("loadLayerJSONs urls keep urls", async () => {
  const styleFile = "some/file/some_geojson.geojson";
  const geojsonFile = "https://some/url/some_style.json";

  const mapLayer = {
    configuration: {
      type: "VectorLayer",
      props: {
        name: "GeoJSON Layer",
        source: {
          type: "GeoJSON",
          props: {},
          geojson: geojsonFile,
        },
      },
      style: styleFile,
    },
  };

  const response = await loadLayerJSONs(mapLayer, "123", true);

  expect(mapLayer.configuration.style).toStrictEqual(styleFile);
  expect(mapLayer.configuration.props.source.geojson).toStrictEqual(
    geojsonFile,
  );
  expect(response.success).toBe(true);
});

test("loadLayerJSONs urls failed", async () => {
  // Only the style URL fetch can fail in the URL-based geojson scenario —
  // the geojson URL is no longer fetched here (it's left as a string for
  // OL's VectorSource to resolve). When the style fetch fails, the style
  // gets cleared from the config; the geojson URL stays untouched. The
  // overall response is still success=true because URL-geojson handling
  // doesn't have a fetch step that can fail.
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: false,
  });

  const styleFile = "some/file/some_geojson.geojson";
  const geojsonFile = "https://some/url/some_style.json";

  const mapLayer = {
    configuration: {
      type: "VectorLayer",
      props: {
        name: "GeoJSON Layer",
        source: {
          type: "GeoJSON",
          props: {},
          geojson: geojsonFile,
        },
      },
      style: styleFile,
    },
  };

  const response = await loadLayerJSONs(mapLayer, "123", false);

  // Style fetch failed → style cleared. URL geojson untouched.
  expect(mapLayer.configuration.style).toStrictEqual(undefined);
  expect(mapLayer.configuration.props.source.geojson).toBe(geojsonFile);
  // No fetch failure on the geojson side, so overall success.
  expect(response.success).toBe(true);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("checkForCRS", async () => {
  let CRS = await checkForCRS({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [0, 0],
    },
  });
  expect(CRS).toBe("EPSG:4326");

  CRS = await checkForCRS({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [123456789, 123456789],
    },
  });
  expect(CRS).toBe("EPSG:3857");

  CRS = await checkForCRS({
    type: "Feature",
    crs: { properties: { name: "EPSG:12345" } },
    geometry: {
      type: "Point",
      coordinates: [123456789, 123456789],
    },
  });
  expect(CRS).toBe("EPSG:12345");

  CRS = await checkForCRS({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [0, 0],
        },
      },
    ],
  });
  expect(CRS).toBe("EPSG:4326");

  CRS = await checkForCRS({
    type: "Point",
    coordinates: [0, 0],
  });
  expect(CRS).toBe("EPSG:4326");

  CRS = await checkForCRS({
    type: "MultiLineString",
    coordinates: [[0, 0]],
  });
  expect(CRS).toBe("EPSG:4326");

  CRS = await checkForCRS({
    type: "Point",
    coordinates: ["a", "a"],
  });
  expect(CRS).toBe(null);

  CRS = await checkForCRS({
    type: "Point",
  });
  expect(CRS).toBe(null);

  CRS = await checkForCRS({
    type: "Point",
    coordinates: [NaN, NaN],
  });
  expect(CRS).toBe(undefined);
});

test("saveLayerJSON stringified Object", async () => {
  const mockUploadJSON = jest.fn();
  jest.spyOn(appAPI, "uploadJSON").mockImplementation(mockUploadJSON);
  mockUploadJSON.mockResolvedValueOnce({
    success: true,
    filename: "some_file.json",
  });

  const style = JSON.stringify({
    type: "Style",
    props: {
      stroke: {
        type: "Stroke",
        props: {
          color: "#501020",
          width: 1,
        },
      },
    },
  });

  const response = await saveLayerJSON({
    stringJSON: style,
    csrf: "12345",
    check_crs: false,
  });

  expect(response.success).toBe(true);
  expect(response.filename).toBe("some_file.json");
});

test("saveLayerJSON double quote url", async () => {
  const style = '"some/url/file.json"';

  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: true,
    text: () => Promise.resolve(JSON.stringify({})),
  });

  const response = await saveLayerJSON({
    stringJSON: style,
    csrf: "12345",
    check_crs: false,
  });

  expect(response.success).toBe(true);
  expect(response.filename).toBe("some/url/file.json");
});

test("saveLayerJSON url", async () => {
  const style = "some/url/file.json";

  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: true,
    text: () => Promise.resolve(JSON.stringify({})),
  });

  const response = await saveLayerJSON({
    stringJSON: style,
    csrf: "12345",
    check_crs: false,
  });

  expect(response.success).toBe(true);
  expect(response.filename).toBe("some/url/file.json");
});

test("saveLayerJSON url fail", async () => {
  const style = "some/url/file.json";

  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: false,
  });

  const response = await saveLayerJSON({
    stringJSON: style,
    csrf: "12345",
    check_crs: false,
  });

  expect(response.success).toBe(false);
  expect(response.message).toBe(
    "Invalid JSON or failed to fetch/parse the file.",
  );
});

test("saveLayerJSON geojson crs null", async () => {
  const geojson = JSON.stringify({
    type: "Point",
    coordinates: ["a", "a"],
  });

  const response = await saveLayerJSON({
    stringJSON: geojson,
    csrf: "12345",
    check_crs: true,
  });

  expect(response.success).toBe(false);
  expect(response.message).toBe(
    "GeoJSON does include a crs key and CRS could not be inferred from the data. Must be a valid geojson.",
  );
});

test("saveLayerJSON geojson", async () => {
  const mockUploadJSON = jest.fn();
  jest.spyOn(appAPI, "uploadJSON").mockImplementation(mockUploadJSON);
  mockUploadJSON.mockResolvedValueOnce({
    success: true,
    filename: "some_file.json",
  });

  const geojson = JSON.stringify({
    type: "Point",
    coordinates: [0, 0],
  });

  const response = await saveLayerJSON({
    stringJSON: geojson,
    csrf: "12345",
    check_crs: true,
  });

  expect(response.success).toBe(true);
  expect(response.filename).toBe("some_file.json");
});

test("queryLayerFeatures GeoTIFF tolerates missing source.props.sources (covers `?? []` fallback)", async () => {
  // The configuredSources expression in getGeoTIFFPixelValues uses
  // `layerInfo?.configuration?.props?.source?.props?.sources ?? []` —
  // when the optional chain returns undefined (e.g. an in-progress
  // authoring state where `sources` hasn't been written yet), the
  // fallback `[]` should kick in instead of throwing.
  const layerName = "Sourceless GeoTIFF";
  const targetLayer = {
    get: jest.fn((key) => (key === "name" ? layerName : undefined)),
    getData: jest.fn(() => new Float32Array([42])),
  };
  const map = {
    getView: jest.fn(() => ({
      getResolution: jest.fn(),
      getZoom: jest.fn(() => 10),
    })),
    getLayers: jest.fn(() => ({ getArray: jest.fn(() => [targetLayer]) })),
  };

  const layerInfo = {
    configuration: {
      type: "WebGLTile",
      props: {
        name: layerName,
        source: {
          type: "GeoTIFF",
          props: {
            // No `sources` key — the optional chain resolves to undefined
            // and the `?? []` branch fires.
          },
        },
      },
    },
  };

  const features = await queryLayerFeatures(layerInfo, map, [0, 0], [10, 10]);
  expect(features).toHaveLength(1);
  expect(features[0].layerName).toBe(layerName);
  expect(features[0].attributes["Band 1"]).toBeCloseTo(42, 4);
});

test("loadGeoJSON returns the URL untouched when keep_urls is true", async () => {
  // Covers the `if (keep_urls) return geojson;` short-circuit. Without
  // keep_urls=true, the function would fetch the URL — but with it, the
  // string is returned as-is so the caller can defer fetching.
  const url = "https://example.com/data.geojson";
  const fetchSpy = jest.spyOn(global, "fetch");

  const result = await loadGeoJSON(url, undefined, true);

  expect(result).toBe(url);
  // No network round-trip — the early return must skip fetch entirely.
  expect(fetchSpy).not.toHaveBeenCalled();

  fetchSpy.mockRestore();
});
