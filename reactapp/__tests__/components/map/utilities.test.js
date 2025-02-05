import {
  createMarkerLayer,
  createHighlightLayer,
  transformCoordinates,
  queryLayerFeatures,
} from "components/map/utilities";
import { LineString, Point, MultiPolygon, Polygon } from "ol/geom";
import VectorLayer from "ol/layer/Vector.js";
import {
  layerConfigGeoJSON,
  layerConfigImageArcGISRest,
  layerConfigImageWMS,
} from "__tests__/utilities/constants";

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
  const highlightLayer = createHighlightLayer(geometries);

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
  const highlightLayer = createHighlightLayer(geometries);

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
  const highlightLayer = createHighlightLayer(geometries);

  expect(highlightLayer instanceof VectorLayer).toBe(true);
  expect(highlightLayer.getZIndex()).toBe(100);

  const highlightLayerStyleStroke = highlightLayer.getStyle().getStroke();
  expect(highlightLayerStyleStroke.getColor()).toBe("#00008b");
  expect(highlightLayerStyleStroke.getWidth()).toBe(3);
  expect(highlightLayer.getSource().getFeatures().length).toBe(1);
  const highlightLayerFeature = highlightLayer.getSource().getFeatures()[0];

  expect(highlightLayerFeature.getGeometry() instanceof MultiPolygon).toBe(
    true
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
  const highlightLayer = createHighlightLayer(geometries);

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
  const highlightLayer = createHighlightLayer(geometries);

  expect(highlightLayer instanceof VectorLayer).toBe(true);
  expect(highlightLayer.getZIndex()).toBe(100);

  const highlightLayerStyleStroke = highlightLayer.getStyle().getStroke();
  expect(highlightLayerStyleStroke.getColor()).toBe("#00008b");
  expect(highlightLayerStyleStroke.getWidth()).toBe(3);
  expect(highlightLayer.getSource().getFeatures().length).toBe(1);
  const highlightLayerFeature = highlightLayer.getSource().getFeatures()[0];

  expect(highlightLayerFeature.getGeometry() instanceof Point).toBe(true);
});

test("createHighlightLayer Point X,Y", async () => {
  const geometries = {
    x: 0,
    y: 0,
  };
  const highlightLayer = createHighlightLayer(geometries);

  expect(highlightLayer instanceof VectorLayer).toBe(true);
  expect(highlightLayer.getZIndex()).toBe(100);

  const highlightLayerStyleStroke = highlightLayer.getStyle().getStroke();
  expect(highlightLayerStyleStroke.getColor()).toBe("#00008b");
  expect(highlightLayerStyleStroke.getWidth()).toBe(3);
  expect(highlightLayer.getSource().getFeatures().length).toBe(1);
  const highlightLayerFeature = highlightLayer.getSource().getFeatures()[0];

  expect(highlightLayerFeature.getGeometry() instanceof Point).toBe(true);
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
    "Invalid coordinate structure"
  );
});

test("queryLayerFeatures No Feature Found", async () => {
  const mockMap = {
    getView: jest.fn(() => ({ getResolution: jest.fn() })),
    forEachFeatureAtPixel: jest.fn((pixel, callback) => {
      // Simulate features found at the given pixel
      const mockLayer = {
        get: jest.fn(() => "ClickHighlighterLayer"),
        getProperties: () => ({
          name: "ClickHighlighterLayer",
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
    pixel
  );

  expect(features).toStrictEqual([]);
});

test("queryLayerFeatures Highlight Layer Found", async () => {
  const mockMap = {
    getView: jest.fn(() => ({ getResolution: jest.fn() })),
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
        get: jest.fn(() => "ClickHighlighterLayer"),
        getProperties: () => ({
          name: "ClickHighlighterLayer",
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
    pixel
  );

  expect(features).toStrictEqual([]);
});

test("queryLayerFeatures Valid GeoJSON Found", async () => {
  const mockMap = {
    getView: jest.fn(() => ({ getResolution: jest.fn() })),
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
    pixel
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

test("queryLayerFeatures Valid GeoJSON GeometryCollection Found", async () => {
  const mockMap = {
    getView: jest.fn(() => ({ getResolution: jest.fn(() => 100) })),
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
    pixel
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

test("queryLayerFeatures ImageArcGISRest", async () => {
  const mockArgisResults = [
    {
      layerId: 0,
      layerName: "Max Status - Forecast Trend",
      displayFieldName: "Name",
      value: "Philadelphia",
      attributes: {
        Name: "Philadelphia",
        RFC: "LMRFC",
        WFO: "JAN",
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
    })
  );

  const mockMap = {
    getSize: jest.fn(() => [100, 200]),
    getView: jest.fn(() => ({
      calculateExtent: jest.fn(() => [1, 2, 3, 4]),
      getResolution: jest.fn(() => 500),
      getProjection: jest.fn(() => ({
        getCode: jest.fn(() => "EPSG:4326"),
      })),
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
    pixel
  );

  const params = new URLSearchParams({
    f: "json",
    tolerance: 10, // Pixel tolerance
    returnGeometry: true,
    geometryType: "esriGeometryPoint",
    sr: "EPSG:4326",
    geometry: "0,0",
    mapExtent: "1,2,3,4",
    imageDisplay: "100, 200, 500",
  });
  const featureQueryUrl =
    layerConfigImageArcGISRest.configuration.props.source.props.url +
    "/identify";
  expect(global.fetch).toHaveBeenCalledWith(
    `${featureQueryUrl}?${params.toString()}`
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
    pixel
  );

  const params = new URLSearchParams({
    f: "json",
    tolerance: 10, // Pixel tolerance
    returnGeometry: true,
    geometryType: "esriGeometryPoint",
    sr: "EPSG:4326",
    geometry: "0,0",
    mapExtent: "1,2,3,4",
    imageDisplay: "100, 200, 500",
  });
  const featureQueryUrl =
    layerConfigImageArcGISRest.configuration.props.source.props.url +
    "/identify";
  expect(global.fetch).toHaveBeenCalledWith(
    `${featureQueryUrl}?${params.toString()}`
  );
  expect(features).toStrictEqual(mockArgisResults);

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
    })
  );

  const mockMap = {
    getSize: jest.fn(() => [100, 200]),
    getView: jest.fn(() => ({
      calculateExtent: jest.fn(() => [1, 2, 3, 4]),
      getProjection: jest.fn(() => ({
        getCode: jest.fn(() => "EPSG:4326"),
      })),
    })),
  };
  const coordinate = [0, 0];
  const pixel = [639, 366];

  const features = await queryLayerFeatures(
    layerConfigImageWMS,
    mockMap,
    coordinate,
    pixel
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
    `${featureQueryUrl}?${params.toString()}`
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
    })
  );

  const mockMap = {
    getSize: jest.fn(() => [100, 200]),
    getView: jest.fn(() => ({
      calculateExtent: jest.fn(() => [1, 2, 3, 4]),
      getProjection: jest.fn(() => ({
        getCode: jest.fn(() => "EPSG:3857"),
      })),
    })),
  };
  const coordinate = [0, 0];
  const pixel = [639, 366];

  const features = await queryLayerFeatures(
    layerConfigImageWMS,
    mockMap,
    coordinate,
    pixel
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
    `${featureQueryUrl}?${params.toString()}`
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
    })),
  };
  const coordinate = [0, 0];
  const pixel = [639, 366];

  const features = await queryLayerFeatures(
    layerConfigImageWMS,
    mockMap,
    coordinate,
    pixel
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
    `${featureQueryUrl}?${params.toString()}`
  );
  expect(features).toStrictEqual(mockfetchResults);

  global.fetch.mockRestore?.();
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
  const mockMap = {};
  const coordinate = [0, 0];
  const pixel = [639, 366];

  await expect(
    queryLayerFeatures(layerConfig, mockMap, coordinate, pixel)
  ).rejects.toThrow("sdfsdfsdf is not currently configured to be queried");
});
