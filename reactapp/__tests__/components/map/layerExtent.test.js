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
import XYZ from "ol/source/XYZ";
import View from "ol/View";
import { get as getProjection, transformExtent } from "ol/proj";
import {
  canZoomToLayer,
  getLayerExtent,
  zoomToLayer,
  ZOOM_TO_LAYER_MAX_ZOOM,
} from "components/map/layerExtent";

const mercator = getProjection("EPSG:3857");

const vectorLayer = (coords) =>
  new VectorLayer({
    source: new VectorSource({
      features: coords.map((c) => new Feature(new Point(c))),
    }),
  });

// A layer whose source reports its georeferencing as a GeoTIFF does.
const rasterLayer = (getView) => ({
  getExtent: () => undefined,
  getSource: () => ({ getView }),
});

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
    expect(await getLayerExtent(vectorLayer([]), mercator)).toBeNull();
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

  test("a raster whose file failed to open has no extent", async () => {
    const layer = rasterLayer(() => Promise.reject(new Error("404")));
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

  test("does nothing when the layer has no extent", async () => {
    const view = new View({ projection: "EPSG:3857" });
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
    // A raster adopting its projection calls setView while another raster's
    // header is still arriving; that extent is in the old view's coordinates.
    const oldView = new View({ projection: "EPSG:3857" });
    const newView = new View({ projection: "EPSG:4326" });
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
