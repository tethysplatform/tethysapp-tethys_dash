import Feature from "ol/Feature";
import { Point } from "ol/geom";
import VectorLayer from "ol/layer/Vector";
import ImageLayer from "ol/layer/Image";
import TileLayer from "ol/layer/Tile";
import LayerGroup from "ol/layer/Group";
import VectorSource from "ol/source/Vector";
import ImageStatic from "ol/source/ImageStatic";
import ImageWMS from "ol/source/ImageWMS";
import ImageArcGISRest from "ol/source/ImageArcGISRest";
import GeoTIFFSource from "ol/source/GeoTIFF";
import XYZ from "ol/source/XYZ";
import View from "ol/View";
import { containsCoordinate, getWidth } from "ol/extent";
import { fromLonLat, get as getProjection, transformExtent } from "ol/proj";
import {
  canZoomToLayer,
  getLayerExtent,
  zoomToLayer,
  ZOOM_TO_LAYER_MAX_ZOOM,
} from "components/map/layerExtent";
import { ensureProjection } from "components/map/projections";

const mercator = getProjection("EPSG:3857");

// The current view a lazily loading vector source is asked to load for.
const frame = { extent: mercator.getExtent(), resolution: 1000 };

const vectorLayer = (coords) =>
  new VectorLayer({
    source: new VectorSource({
      features: coords.map((c) => new Feature(new Point(c))),
    }),
  });

// A source that fetches its own features, as a GeoJSON URL or a Shapefile
// does: it loads only when asked, and reports back when it is done.
const lazySource = (coords, { fail = false } = {}) =>
  new VectorSource({
    loader(extent, resolution, projection, success, failure) {
      Promise.resolve().then(() => {
        if (fail) return failure();
        const features = coords.map((c) => new Feature(new Point(c)));
        this.addFeatures(features);
        success(features);
      });
    },
  });

// A layer whose source reports its georeferencing the way the Zarr loader's
// does, with a getView() of its own.
const rasterLayer = (getView) => ({
  getExtent: () => undefined,
  getSource: () => ({ getView }),
});

// A layer over a real GeoTIFF source, built without its constructor, which
// would fetch the file. Its getView() is inherited, as a real one's is, so
// only the GeoTIFF's own methods identify it.
const geotiffLayer = ({ state, view }) => {
  const proto = Object.create(GeoTIFFSource.prototype);
  proto.getState = () => state;
  proto.getView = () => view;
  const source = Object.create(proto);
  return { getExtent: () => undefined, getSource: () => source };
};

const expectExtentClose = (actual, expected) => {
  expect(actual).toHaveLength(4);
  actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 3));
};

describe("getLayerExtent", () => {
  test("a vector layer reports its features' extent", async () => {
    const layer = vectorLayer([
      [0, 0],
      [100, 200],
    ]);
    expect(await getLayerExtent(layer, mercator)).toEqual([0, 0, 100, 200]);
  });

  test("a vector layer with no features has no extent", async () => {
    expect(await getLayerExtent(vectorLayer([]), mercator, frame)).toBeNull();
  });

  test("a vector layer that has never been drawn loads its features first", async () => {
    // Hidden, so OpenLayers has never asked its source to load.
    const layer = new VectorLayer({
      source: lazySource([
        [30, 40],
        [60, 80],
      ]),
      visible: false,
    });
    expect(await getLayerExtent(layer, mercator, frame)).toEqual([
      30, 40, 60, 80,
    ]);
  });

  test("a vector layer whose features failed to load has no extent", async () => {
    const layer = new VectorLayer({
      source: lazySource([[30, 40]], { fail: true }),
      visible: false,
    });
    expect(await getLayerExtent(layer, mercator, frame)).toBeNull();
  });

  test("an authored layer extent wins over the source", async () => {
    const layer = vectorLayer([[0, 0]]);
    layer.setExtent([10, 10, 20, 20]);
    expect(await getLayerExtent(layer, mercator)).toEqual([10, 10, 20, 20]);
  });

  test("a raster's extent is moved into the view projection", async () => {
    const layer = rasterLayer(async () => ({
      extent: [-10, -5, 10, 5],
      projection: "EPSG:4326",
    }));
    expectExtentClose(
      await getLayerExtent(layer, mercator),
      transformExtent([-10, -5, 10, 5], "EPSG:4326", "EPSG:3857"),
    );
  });

  test("a global lon/lat raster is clipped to what Web Mercator can show", async () => {
    const layer = rasterLayer(async () => ({
      extent: [-180, -90, 180, 90],
      projection: getProjection("EPSG:4326"),
    }));
    const extent = await getLayerExtent(layer, mercator);
    expect(extent.every(Number.isFinite)).toBe(true);
    expectExtentClose(extent, mercator.getExtent());
  });

  test.each([
    // Los Angeles and Denver, a box around each.
    [
      "UTM zone 11N",
      "EPSG:32611",
      [370000, 3740000, 400000, 3780000],
      [-118.25, 34.05],
    ],
    [
      "Conus Albers",
      "EPSG:5070",
      [-800000, 1800000, -700000, 1900000],
      [-104.99, 39.74],
    ],
  ])(
    "a raster in %s lands where it is on a Web Mercator map",
    async (_, code, extent, lonLat) => {
      ensureProjection(code);
      const layer = rasterLayer(async () => ({ extent, projection: code }));
      const result = await getLayerExtent(layer, mercator);
      expect(containsCoordinate(result, fromLonLat(lonLat))).toBe(true);
      expect(getWidth(result)).toBeLessThan(500000);
    },
  );

  test("a raster whose view cannot be built has no extent", async () => {
    // OpenLayers rejects the view of a GeoTIFF whose files disagree on their
    // grid.
    const layer = rasterLayer(() => Promise.reject(new Error("mismatch")));
    expect(await getLayerExtent(layer, mercator)).toBeNull();
  });

  test("a GeoTIFF reports the extent from its file's header", async () => {
    const layer = geotiffLayer({
      state: "ready",
      view: Promise.resolve({
        extent: [-10, -5, 10, 5],
        projection: getProjection("EPSG:4326"),
      }),
    });
    expect(canZoomToLayer(layer)).toBe(true);
    expectExtentClose(
      await getLayerExtent(layer, mercator),
      transformExtent([-10, -5, 10, 5], "EPSG:4326", "EPSG:3857"),
    );
  });

  test("a GeoTIFF whose file failed to open has no extent, rather than waiting forever", async () => {
    // OpenLayers moves the source to "error" and never settles its view.
    const layer = geotiffLayer({ state: "error", view: new Promise(() => {}) });
    expect(canZoomToLayer(layer)).toBe(false);
    expect(await getLayerExtent(layer, mercator)).toBeNull();
  });

  test("a static image reports its image extent", async () => {
    const layer = new ImageLayer({
      source: new ImageStatic({
        url: "https://example.com/a.png",
        imageExtent: [1, 2, 3, 4],
        projection: "EPSG:3857",
      }),
    });
    expect(await getLayerExtent(layer, mercator)).toEqual([1, 2, 3, 4]);
  });

  test("a tile layer reports its tile grid's extent", async () => {
    const layer = new TileLayer({
      source: new XYZ({ url: "https://example.com/{z}/{x}/{y}.png" }),
    });
    expectExtentClose(
      await getLayerExtent(layer, mercator),
      mercator.getExtent(),
    );
  });

  test("a server-rendered image layer has no extent", async () => {
    const layer = new ImageLayer({
      source: new ImageWMS({ url: "https://example.com/wms", params: {} }),
    });
    expect(await getLayerExtent(layer, mercator)).toBeNull();
  });

  test("an ESRI image layer has no extent, rather than waiting forever", async () => {
    // Every OL source inherits a getView() that only GeoTIFF ever resolves;
    // awaiting it on this source hung the click with nothing happening.
    const layer = new ImageLayer({
      source: new ImageArcGISRest({ url: "https://example.com/MapServer" }),
    });
    expect(canZoomToLayer(layer)).toBe(false);
    expect(await getLayerExtent(layer, mercator)).toBeNull();
  });

  test("a layer group reports the union of its members", async () => {
    const group = new LayerGroup({
      layers: [
        vectorLayer([[0, 0]]),
        vectorLayer([[50, -50]]),
        vectorLayer([]),
      ],
    });
    expect(await getLayerExtent(group, mercator)).toEqual([0, -50, 50, 0]);
  });
});

describe("canZoomToLayer", () => {
  test("offers vector, raster and static image layers", () => {
    expect(canZoomToLayer(vectorLayer([]))).toBe(true);
    expect(canZoomToLayer(rasterLayer(jest.fn()))).toBe(true);
    expect(
      canZoomToLayer(
        new ImageLayer({
          source: new ImageStatic({
            url: "https://example.com/a.png",
            imageExtent: [1, 2, 3, 4],
          }),
        }),
      ),
    ).toBe(true);
  });

  test("declines layers with no way to report an extent", () => {
    expect(canZoomToLayer(undefined)).toBe(false);
    // A runtime raster between fetches is taken down to a null source.
    expect(canZoomToLayer({ getSource: () => null })).toBe(false);
    expect(
      canZoomToLayer(
        new ImageLayer({
          source: new ImageWMS({ url: "https://example.com/wms", params: {} }),
        }),
      ),
    ).toBe(false);
    // A bare object, as older callers mock layers.
    expect(canZoomToLayer({ get: () => "x" })).toBe(false);
  });
});

describe("zoomToLayer", () => {
  const makeMap = (view, size = [400, 300]) => ({
    getView: () => view,
    getSize: () => size,
  });

  test("fits the view to the layer, capped for a lone point", async () => {
    const view = new View({
      projection: "EPSG:3857",
      center: [0, 0],
      zoom: 2,
    });
    const fit = jest.spyOn(view, "fit");
    const moved = await zoomToLayer(makeMap(view), vectorLayer([[5, 5]]));
    expect(moved).toBe(true);
    expect(fit).toHaveBeenCalledWith(
      [5, 5, 5, 5],
      expect.objectContaining({
        size: [400, 300],
        maxZoom: ZOOM_TO_LAYER_MAX_ZOOM,
        padding: [24, 24, 24, 24],
      }),
    );
  });

  test("loads a hidden layer's features, then fits to them", async () => {
    const view = new View({
      projection: "EPSG:3857",
      center: [0, 0],
      zoom: 2,
    });
    const fit = jest.spyOn(view, "fit");
    const layer = new VectorLayer({
      source: lazySource([
        [1000, 2000],
        [3000, 4000],
      ]),
      visible: false,
    });
    expect(await zoomToLayer(makeMap(view), layer)).toBe(true);
    expect(fit).toHaveBeenCalledWith(
      [1000, 2000, 3000, 4000],
      expect.anything(),
    );
  });

  test("narrows the margin on a map too small for it", async () => {
    const view = new View({
      projection: "EPSG:3857",
      center: [0, 0],
      zoom: 2,
    });
    const fit = jest.spyOn(view, "fit");
    await zoomToLayer(makeMap(view, [60, 200]), vectorLayer([[5, 5]]));
    expect(fit).toHaveBeenCalledWith(
      [5, 5, 5, 5],
      expect.objectContaining({ padding: [15, 15, 15, 15] }),
    );
  });

  test("does nothing when the layer has no extent", async () => {
    const view = new View({
      projection: "EPSG:3857",
      center: [0, 0],
      zoom: 2,
    });
    const fit = jest.spyOn(view, "fit");
    expect(await zoomToLayer(makeMap(view), vectorLayer([]))).toBe(false);
    expect(fit).not.toHaveBeenCalled();
  });

  test("does nothing before the map is sized", async () => {
    const view = new View({ projection: "EPSG:3857" });
    const fit = jest.spyOn(view, "fit");
    expect(
      await zoomToLayer(makeMap(view, [0, 0]), vectorLayer([[1, 1]])),
    ).toBe(false);
    expect(fit).not.toHaveBeenCalled();
  });

  test("re-reads the extent when the view is replaced mid-read", async () => {
    // A new saved extent calls setView while a raster's header is still
    // arriving; that extent was read against the old view.
    const oldView = new View({
      projection: "EPSG:3857",
      center: [0, 0],
      zoom: 2,
    });
    const newView = new View({
      projection: "EPSG:4326",
      center: [0, 0],
      zoom: 2,
    });
    const map = { getView: jest.fn(), getSize: () => [400, 300] };
    map.getView
      .mockReturnValueOnce(oldView) // read before the header arrives
      .mockReturnValue(newView); // ...and the view has changed since
    const fitOld = jest.spyOn(oldView, "fit");
    const fitNew = jest.spyOn(newView, "fit");
    const layer = rasterLayer(async () => ({
      extent: [-10, -5, 10, 5],
      projection: "EPSG:4326",
    }));

    expect(await zoomToLayer(map, layer)).toBe(true);
    expect(fitOld).not.toHaveBeenCalled();
    expect(fitNew).toHaveBeenCalledWith([-10, -5, 10, 5], expect.anything());
  });
});
