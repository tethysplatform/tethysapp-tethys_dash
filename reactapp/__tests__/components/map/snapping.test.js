import {
  layerDefsToWhere,
  resolveQuerySublayer,
  fetchLayerVectorFeatures,
  findSnapFeature,
  findBestSnap,
  findSnapFeatures,
  createSnapLayer,
  addSnapPreview,
  buildSnapFeatureResult,
  shouldSnapSelect,
} from "components/map/snapping";
import Feature from "ol/Feature";
import VectorSource from "ol/source/Vector.js";
import { LineString, MultiLineString } from "ol/geom";
import VectorLayer from "ol/layer/Vector.js";

describe("layerDefsToWhere", () => {
  test("extracts the where clause for the matching sublayer", () => {
    expect(layerDefsToWhere("0: rivercountry='Peru'", 0)).toBe(
      "rivercountry='Peru'",
    );
  });

  test("defaults to sublayer 0", () => {
    expect(layerDefsToWhere("0: x=1")).toBe("x=1");
  });

  test("picks the matching entry from a multi-entry definition", () => {
    expect(layerDefsToWhere("1: a=1;0: b=2", 0)).toBe("b=2");
  });

  test("skips malformed entries with no colon", () => {
    expect(layerDefsToWhere("garbage;0: c=3", 0)).toBe("c=3");
  });

  test("returns 1=1 when the sublayer has no filter", () => {
    expect(layerDefsToWhere("1: x=1", 0)).toBe("1=1");
  });

  test("returns 1=1 for empty / non-string input", () => {
    expect(layerDefsToWhere("")).toBe("1=1");
    expect(layerDefsToWhere(null)).toBe("1=1");
    expect(layerDefsToWhere(undefined)).toBe("1=1");
    expect(layerDefsToWhere(123)).toBe("1=1");
  });

  test("still parses the simple 'id: clause' form (not valid JSON5)", () => {
    expect(layerDefsToWhere("0: x=1")).toBe("x=1");
  });

  test("parses JSON-form LAYERDEFS", () => {
    expect(layerDefsToWhere('{"0": "rivercountry=\'Peru\'"}', 0)).toBe(
      "rivercountry='Peru'",
    );
  });

  test("parses JSON5 single-quoted JSON-form LAYERDEFS", () => {
    expect(layerDefsToWhere("{'0': 'x=1'}", 0)).toBe("x=1");
  });

  test("returns 1=1 for JSON-form LAYERDEFS with no matching sublayer key", () => {
    expect(layerDefsToWhere('{"1": "x=1"}', 0)).toBe("1=1");
  });

  test("returns 1=1 for a JSON array input", () => {
    expect(layerDefsToWhere("[1,2]", 0)).toBe("1=1");
  });
});

describe("resolveQuerySublayer", () => {
  test("explicit querySublayer wins over LAYERS show:N", () => {
    const props = {
      querySublayer: 1,
      source: { props: { params: { LAYERS: "show:3" } } },
    };
    expect(resolveQuerySublayer(props)).toBe(1);
  });

  test("explicit querySublayer of 0 is respected (not treated as unset)", () => {
    const props = {
      querySublayer: 0,
      source: { props: { params: { LAYERS: "show:3" } } },
    };
    expect(resolveQuerySublayer(props)).toBe(0);
  });

  test("derives the sublayer from LAYERS show:N when querySublayer is absent", () => {
    const props = { source: { props: { params: { LAYERS: "show:3" } } } };
    expect(resolveQuerySublayer(props)).toBe(3);
  });

  test("takes the first id from a multi-id LAYERS show list", () => {
    const props = { source: { props: { params: { LAYERS: "show:2,4" } } } };
    expect(resolveQuerySublayer(props)).toBe(2);
  });

  test("derives the sublayer from LAYERS include:N", () => {
    const props = { source: { props: { params: { LAYERS: "include: 5" } } } };
    expect(resolveQuerySublayer(props)).toBe(5);
  });

  test("defaults to 0 for a non-show/include LAYERS directive", () => {
    const props = { source: { props: { params: { LAYERS: "visible" } } } };
    expect(resolveQuerySublayer(props)).toBe(0);
  });

  test("defaults to 0 for garbage LAYERS", () => {
    const props = { source: { props: { params: { LAYERS: "garbage" } } } };
    expect(resolveQuerySublayer(props)).toBe(0);
  });

  test("defaults to 0 when there is no LAYERS or querySublayer", () => {
    expect(resolveQuerySublayer({})).toBe(0);
    expect(resolveQuerySublayer(undefined)).toBe(0);
  });
});

describe("fetchLayerVectorFeatures", () => {
  const geojsonOneLine = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { comid: 123, rivercountry: "Peru" },
        geometry: {
          type: "LineString",
          coordinates: [
            [0, 0],
            [0, 1],
          ],
        },
      },
    ],
  };

  const layerInfo = {
    configuration: {
      props: {
        querySublayer: 0,
        source: {
          props: {
            url: "https://svc/MapServer",
            params: { LAYERDEFS: "0: rivercountry='Peru'" },
          },
        },
      },
    },
  };

  afterEach(() => {
    global.fetch?.mockRestore?.();
  });

  test("queries the sublayer /query endpoint and parses features (4326)", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ json: () => Promise.resolve(geojsonOneLine) }),
    );
    const map = {
      getView: jest.fn(() => ({
        getProjection: jest.fn(() => ({ getCode: jest.fn(() => "EPSG:4326") })),
        calculateExtent: jest.fn(() => [-10, -10, 10, 10]),
      })),
    };

    const features = await fetchLayerVectorFeatures(layerInfo, map);

    const params = new URLSearchParams({
      f: "geojson",
      where: "rivercountry='Peru'",
      geometry: "-10,-10,10,10",
      geometryType: "esriGeometryEnvelope",
      spatialRel: "esriSpatialRelIntersects",
      inSR: "4326",
      outSR: "4326",
      outFields: "*",
      returnGeometry: "true",
    });
    expect(global.fetch).toHaveBeenCalledWith(
      `https://svc/MapServer/0/query?${params}`,
    );
    expect(features).toHaveLength(1);
    expect(features[0].getGeometry().getType()).toBe("LineString");
    expect(features[0].get("comid")).toBe(123);
  });

  test("uses the map projection SR and extent for a 3857 view", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ json: () => Promise.resolve(geojsonOneLine) }),
    );
    const map = {
      getView: jest.fn(() => ({
        getProjection: jest.fn(() => ({ getCode: jest.fn(() => "EPSG:3857") })),
        calculateExtent: jest.fn(() => [1, 2, 3, 4]),
      })),
    };

    await fetchLayerVectorFeatures(layerInfo, map);

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain("inSR=3857");
    expect(calledUrl).toContain("geometry=1%2C2%2C3%2C4");
  });

  test("returns [] and skips fetch when the source url is missing", async () => {
    global.fetch = jest.fn();
    const result = await fetchLayerVectorFeatures(
      { configuration: { props: {} } },
      { getView: jest.fn() },
    );
    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("returns [] when the fetch rejects", async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error("network")));
    const map = {
      getView: jest.fn(() => ({
        getProjection: jest.fn(() => ({ getCode: jest.fn(() => "EPSG:4326") })),
        calculateExtent: jest.fn(() => [-1, -1, 1, 1]),
      })),
    };
    expect(await fetchLayerVectorFeatures(layerInfo, map)).toEqual([]);
  });

  test("returns [] when the response has no features array", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({}) }),
    );
    const map = {
      getView: jest.fn(() => ({
        getProjection: jest.fn(() => ({ getCode: jest.fn(() => "EPSG:4326") })),
        calculateExtent: jest.fn(() => [-1, -1, 1, 1]),
      })),
    };
    expect(await fetchLayerVectorFeatures(layerInfo, map)).toEqual([]);
  });

  test("derives the sublayer from LAYERS show:N when querySublayer is not set", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ json: () => Promise.resolve(geojsonOneLine) }),
    );
    const map = {
      getView: jest.fn(() => ({
        getProjection: jest.fn(() => ({ getCode: jest.fn(() => "EPSG:4326") })),
        calculateExtent: jest.fn(() => [-10, -10, 10, 10]),
      })),
    };
    const layerInfoWithShow = {
      configuration: {
        props: {
          source: {
            props: {
              url: "https://svc/MapServer",
              params: {
                LAYERS: "show:3",
                LAYERDEFS: "3: rivercountry='Peru'",
              },
            },
          },
        },
      },
    };

    await fetchLayerVectorFeatures(layerInfoWithShow, map);

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain("https://svc/MapServer/3/query?");
    expect(calledUrl).toContain(
      `where=${new URLSearchParams({ where: "rivercountry='Peru'" }).toString().slice("where=".length)}`,
    );
  });

  test("an explicit querySublayer overrides LAYERS show:N", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ json: () => Promise.resolve(geojsonOneLine) }),
    );
    const map = {
      getView: jest.fn(() => ({
        getProjection: jest.fn(() => ({ getCode: jest.fn(() => "EPSG:4326") })),
        calculateExtent: jest.fn(() => [-10, -10, 10, 10]),
      })),
    };
    const layerInfoOverride = {
      configuration: {
        props: {
          querySublayer: 1,
          source: {
            props: {
              url: "https://svc/MapServer",
              params: { LAYERS: "show:3" },
            },
          },
        },
      },
    };

    await fetchLayerVectorFeatures(layerInfoOverride, map);

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain("https://svc/MapServer/1/query?");
  });

  test("returns [] and warns when the top-level exceededTransferLimit flag is set", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({ ...geojsonOneLine, exceededTransferLimit: true }),
      }),
    );
    const map = {
      getView: jest.fn(() => ({
        getProjection: jest.fn(() => ({ getCode: jest.fn(() => "EPSG:4326") })),
        calculateExtent: jest.fn(() => [-10, -10, 10, 10]),
      })),
    };

    const features = await fetchLayerVectorFeatures(layerInfo, map);

    expect(features).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("https://svc/MapServer");
    warnSpy.mockRestore();
  });

  test("returns [] and warns when properties.exceededTransferLimit is set", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            ...geojsonOneLine,
            properties: { exceededTransferLimit: true },
          }),
      }),
    );
    const map = {
      getView: jest.fn(() => ({
        getProjection: jest.fn(() => ({ getCode: jest.fn(() => "EPSG:4326") })),
        calculateExtent: jest.fn(() => [-10, -10, 10, 10]),
      })),
    };

    const features = await fetchLayerVectorFeatures(layerInfo, map);

    expect(features).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("https://svc/MapServer");
    warnSpy.mockRestore();
  });

  test("parses features as before when exceededTransferLimit is absent", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    global.fetch = jest.fn(() =>
      Promise.resolve({ json: () => Promise.resolve(geojsonOneLine) }),
    );
    const map = {
      getView: jest.fn(() => ({
        getProjection: jest.fn(() => ({ getCode: jest.fn(() => "EPSG:4326") })),
        calculateExtent: jest.fn(() => [-10, -10, 10, 10]),
      })),
    };

    const features = await fetchLayerVectorFeatures(layerInfo, map);

    expect(features).toHaveLength(1);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("findSnapFeature", () => {
  // Identity pixel mapping: pixel distance == map-coordinate distance, so the
  // snap radius is deterministic in these tests. Plain function (not jest.fn)
  // so the suite's mock reset can't wipe the implementation.
  const identityMap = { getPixelFromCoordinate: (c) => (c ? [...c] : null) };

  const sourceWithVerticalLine = () => {
    const source = new VectorSource({});
    source.addFeature(
      new Feature({
        geometry: new LineString([
          [0, 0],
          [0, 100],
        ]),
      }),
    );
    return source;
  };

  test("returns the nearest feature when within the pixel radius", () => {
    const source = sourceWithVerticalLine();
    const result = findSnapFeature(source, [5, 50], identityMap, 15);
    expect(result).not.toBeNull();
    expect(result.pixelDistance).toBeCloseTo(5);
    expect(result.coordinate[0]).toBeCloseTo(0);
    expect(result.coordinate[1]).toBeCloseTo(50);
  });

  test("returns null when the nearest feature is beyond the radius", () => {
    const source = sourceWithVerticalLine();
    expect(findSnapFeature(source, [50, 50], identityMap, 15)).toBeNull();
    // same cursor, tighter radius
    expect(findSnapFeature(source, [5, 50], identityMap, 3)).toBeNull();
  });

  test("returns null when the source is empty or missing", () => {
    expect(
      findSnapFeature(new VectorSource({}), [5, 50], identityMap),
    ).toBeNull();
    expect(findSnapFeature(null, [5, 50], identityMap)).toBeNull();
    expect(
      findSnapFeature(sourceWithVerticalLine(), null, identityMap),
    ).toBeNull();
  });

  test("returns null when a coordinate cannot be projected to a pixel", () => {
    const source = sourceWithVerticalLine();
    const map = { getPixelFromCoordinate: jest.fn(() => null) };
    expect(findSnapFeature(source, [5, 50], map)).toBeNull();
  });
});

describe("findBestSnap", () => {
  const identityMap = { getPixelFromCoordinate: (c) => (c ? [...c] : null) };
  const makeCache = (layerName, x) => {
    const source = new VectorSource({});
    source.addFeature(
      new Feature({
        geometry: new LineString([
          [x, 0],
          [x, 100],
        ]),
      }),
    );
    return { layerName, source };
  };

  test("returns the closest qualifying feature across caches", () => {
    const caches = [makeCache("A", 0), makeCache("B", 10)];
    const best = findBestSnap(caches, [4, 50], identityMap, 15);
    expect(best).not.toBeNull();
    expect(best.layerName).toBe("A");
    expect(best.pixelDistance).toBeCloseTo(4);
  });

  test("compares distances regardless of cache order", () => {
    const caches = [makeCache("B", 10), makeCache("A", 0)];
    const best = findBestSnap(caches, [4, 50], identityMap, 15);
    expect(best.layerName).toBe("A");
  });

  test("returns null when nothing is within the radius", () => {
    const caches = [makeCache("A", 0), makeCache("B", 10)];
    expect(findBestSnap(caches, [50, 50], identityMap, 15)).toBeNull();
  });

  test("returns null for empty / missing caches", () => {
    expect(findBestSnap([], [4, 50], identityMap)).toBeNull();
    expect(findBestSnap(null, [4, 50], identityMap)).toBeNull();
    expect(findBestSnap(undefined, [4, 50], identityMap)).toBeNull();
  });
});

describe("findSnapFeatures", () => {
  // Identity pixels + unit resolution → pixel distance == map distance.
  const gatherMap = {
    getPixelFromCoordinate: (c) => (c ? [...c] : null),
    getView: () => ({ getResolution: () => 1 }),
  };
  const cacheWithLine = (layerName, x) => {
    const source = new VectorSource({});
    source.addFeature(
      new Feature({
        geometry: new LineString([
          [x, 0],
          [x, 100],
        ]),
      }),
    );
    return { layerName, source };
  };

  test("returns every feature within the radius, nearest first", () => {
    const caches = [cacheWithLine("A", 0), cacheWithLine("B", 20)];
    const hits = findSnapFeatures(caches, [5, 50], gatherMap, 35);
    expect(hits).toHaveLength(2);
    expect(hits.map((h) => h.layerName)).toEqual(["A", "B"]);
    expect(hits[0].pixelDistance).toBeCloseTo(5);
    expect(hits[1].pixelDistance).toBeCloseTo(15);
  });

  test("excludes features beyond the gather radius", () => {
    const caches = [cacheWithLine("A", 0), cacheWithLine("B", 20)];
    const hits = findSnapFeatures(caches, [5, 50], gatherMap, 10);
    expect(hits).toHaveLength(1);
    expect(hits[0].layerName).toBe("A");
  });

  test("returns [] for empty caches or an unprojectable coordinate", () => {
    expect(findSnapFeatures([], [5, 50], gatherMap, 35)).toEqual([]);
    expect(findSnapFeatures(null, [5, 50], gatherMap, 35)).toEqual([]);
    expect(
      findSnapFeatures([cacheWithLine("A", 0)], null, gatherMap, 35),
    ).toEqual([]);
    const nullPixelMap = {
      getPixelFromCoordinate: () => null,
      getView: () => ({ getResolution: () => 1 }),
    };
    expect(
      findSnapFeatures([cacheWithLine("A", 0)], [5, 50], nullPixelMap, 35),
    ).toEqual([]);
  });
});

describe("createSnapLayer", () => {
  test("returns a named vector layer with an empty source", () => {
    const layer = createSnapLayer();
    expect(layer).toBeInstanceOf(VectorLayer);
    expect(layer.get("name")).toBe("Snap Preview");
    expect(layer.getSource().getFeatures()).toHaveLength(0);
  });
});

describe("shouldSnapSelect", () => {
  const snapLayer = {
    configuration: {
      props: { name: "Geoglows Streamflow", snapToFeatures: true },
    },
  };
  const clickSnap = { feature: {}, layerName: "Geoglows Streamflow" };

  test("true when snap active and layer is the snap source", () => {
    expect(shouldSnapSelect(snapLayer, clickSnap)).toBe(true);
  });

  test("false when there is no active snap", () => {
    expect(shouldSnapSelect(snapLayer, null)).toBe(false);
    expect(
      shouldSnapSelect(snapLayer, { layerName: "Geoglows Streamflow" }),
    ).toBe(false);
  });

  test("false when the layer is not snap-enabled", () => {
    const plain = { configuration: { props: { name: "Geoglows Streamflow" } } };
    expect(shouldSnapSelect(plain, clickSnap)).toBe(false);
  });

  test("false when the layer name does not match the snap source", () => {
    const other = {
      configuration: { props: { name: "Other Layer", snapToFeatures: true } },
    };
    expect(shouldSnapSelect(other, clickSnap)).toBe(false);
  });
});

describe("buildSnapFeatureResult", () => {
  const geoglowsLayer = {
    attributeVariables: { "Flow Forecast (m³/sec)": { comid: "River ID" } },
    configuration: { props: { name: "Geoglows Streamflow" } },
  };

  test("maps layerName from the attributeVariables key and strips geometry from attributes", () => {
    const feature = new Feature({
      geometry: new LineString([
        [0, 0],
        [0, 10],
      ]),
      comid: 12345,
      rivercountry: "Peru",
    });
    const result = buildSnapFeatureResult(feature, geoglowsLayer);
    expect(result.layerName).toBe("Flow Forecast (m³/sec)");
    expect(result.attributes).toEqual({ comid: 12345, rivercountry: "Peru" });
    expect(result.attributes.geometry).toBeUndefined();
    expect(result.geometry).toEqual({
      type: "LineString",
      coordinates: [
        [0, 0],
        [0, 10],
      ],
    });
  });

  test("falls back to the configured layer name when no attributeVariables", () => {
    const feature = new Feature({
      geometry: new LineString([
        [0, 0],
        [1, 1],
      ]),
      comid: 7,
    });
    const result = buildSnapFeatureResult(feature, {
      configuration: { props: { name: "Geoglows Streamflow" } },
    });
    expect(result.layerName).toBe("Geoglows Streamflow");
    expect(result.attributes).toEqual({ comid: 7 });
  });

  test("preserves MultiLineString geometry type", () => {
    const feature = new Feature({
      geometry: new MultiLineString([
        [
          [0, 0],
          [0, 1],
        ],
        [
          [2, 2],
          [2, 3],
        ],
      ]),
      comid: 9,
    });
    const result = buildSnapFeatureResult(feature, geoglowsLayer);
    expect(result.geometry.type).toBe("MultiLineString");
    expect(result.geometry.coordinates).toHaveLength(2);
  });
});

describe("addSnapPreview", () => {
  const lineFeature = () =>
    new Feature({
      geometry: new LineString([
        [0, 0],
        [0, 10],
      ]),
    });

  test("draws the feature outline and a dot at the snapped point", () => {
    const layer = createSnapLayer();
    addSnapPreview(layer, lineFeature(), [3, 4]);
    const feats = layer.getSource().getFeatures();
    expect(feats).toHaveLength(2);
    const types = feats.map((f) => f.getGeometry().getType()).sort();
    expect(types).toEqual(["LineString", "Point"]);
    const point = feats.find((f) => f.getGeometry().getType() === "Point");
    expect(point.getGeometry().getCoordinates()).toEqual([3, 4]);
  });

  test("clears any previous preview before drawing", () => {
    const layer = createSnapLayer();
    addSnapPreview(layer, lineFeature(), [3, 4]);
    addSnapPreview(layer, lineFeature(), [5, 6]);
    expect(layer.getSource().getFeatures()).toHaveLength(2);
  });

  test("draws only the dot when there is no feature", () => {
    const layer = createSnapLayer();
    addSnapPreview(layer, null, [3, 4]);
    const feats = layer.getSource().getFeatures();
    expect(feats).toHaveLength(1);
    expect(feats[0].getGeometry().getType()).toBe("Point");
  });

  test("draws only the outline when there is no coordinate", () => {
    const layer = createSnapLayer();
    addSnapPreview(layer, lineFeature(), null);
    const feats = layer.getSource().getFeatures();
    expect(feats).toHaveLength(1);
    expect(feats[0].getGeometry().getType()).toBe("LineString");
  });

  test("clears the preview when given nothing", () => {
    const layer = createSnapLayer();
    addSnapPreview(layer, lineFeature(), [3, 4]);
    addSnapPreview(layer, null, null);
    expect(layer.getSource().getFeatures()).toHaveLength(0);
  });
});
