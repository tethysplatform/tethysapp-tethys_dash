import { renderHook } from "@testing-library/react";
import Feature from "ol/Feature";
import { LineString } from "ol/geom";
import VectorSource from "ol/source/Vector";
import useSnapping, {
  SNAP_PIXELS,
} from "components/visualizations/useSnapping";

// Partial module mock, mirroring Map.test.js: fetch is controllable, the
// geometry/snap math stays real.
jest.mock("components/map/snapping", () => {
  const originalModule = jest.requireActual("components/map/snapping");
  return {
    ...originalModule,
    fetchLayerVectorFeatures: jest.fn(),
  };
});

const { fetchLayerVectorFeatures: mockedFetch } = jest.requireMock(
  "components/map/snapping",
);

// Minimal OL-map stand-in. `getTargetElement` intentionally returns null —
// these tests pin the degrade paths for a map whose target element is gone
// (e.g. unmount timing), which the jsdom integration harness can't produce.
const makeDetachedMap = () => ({
  getLayers: () => ({ getArray: () => [] }),
  getView: () => ({ getZoom: () => 10, getResolution: () => 1 }),
  getPixelFromCoordinate: (c) => (c ? [...c] : null),
  getTargetElement: () => null,
  addLayer: jest.fn(),
});

const riverLayerConfig = {
  configuration: {
    props: { name: "Rivers", snapToFeatures: true },
  },
};

// A map stand-in whose OL layers array is caller-supplied — used to exercise
// the U2 live-source branch, which resolves the OL layer instance by name
// from map.getLayers().getArray().
const makeMapWithLayers = (olLayers, { zoom = 10 } = {}) => ({
  getLayers: () => ({ getArray: () => olLayers }),
  getView: () => ({ getZoom: () => zoom, getResolution: () => 1 }),
  getPixelFromCoordinate: (c) => (c ? [...c] : null),
  getTargetElement: () => null,
  addLayer: jest.fn(),
});

// Minimal stub of an OL layer instance: only the surface refreshSnapCaches'
// getOlLayerByName / getOlVisibilityMap lookups touch.
const makeStubOlLayer = (name, source, visible = true) => ({
  get: (key) => (key === "name" ? name : undefined),
  getVisible: () => visible,
  getSource: () => source,
});

const geoJsonRiverLayerConfig = {
  configuration: {
    props: {
      name: "Rivers",
      snapToFeatures: true,
      source: { type: "GeoJSON" },
    },
  },
};

const mapServiceRiverLayerConfig = {
  configuration: {
    props: {
      name: "MapServiceRivers",
      snapToFeatures: true,
      source: {
        type: "ESRI Image and Map Service",
        props: { url: "http://example.com/MapServer" },
      },
    },
  },
};

describe("useSnapping with a detached map target element", () => {
  afterEach(() => {
    mockedFetch.mockReset();
  });

  test("updateSnap with no hit clears without touching a missing target element", () => {
    const { result } = renderHook(() => useSnapping({ layers: [] }));
    const map = makeDetachedMap();

    // No caches -> the clear path runs with a null target element and a
    // never-created snap layer; neither may throw.
    expect(() => result.current.updateSnap(map, [0, 0])).not.toThrow();
    expect(map.addLayer).not.toHaveBeenCalled();
  });

  test("updateSnap draws the preview even when the target element is missing", async () => {
    const { result } = renderHook(() =>
      useSnapping({ layers: [riverLayerConfig] }),
    );
    const map = makeDetachedMap();
    mockedFetch.mockResolvedValue([
      new Feature({
        geometry: new LineString([
          [0, 0],
          [0, 100],
        ]),
      }),
    ]);

    await result.current.refreshSnapCaches(map);
    // Cursor within the snap radius of the cached line.
    result.current.updateSnap(map, [SNAP_PIXELS - 5, 50]);

    // The preview layer was created and populated (outline + snapped dot)
    // despite the cursor affordance being skipped for the null target.
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    const previewLayer = map.addLayer.mock.calls[0][0];
    expect(previewLayer.getSource().getFeatures()).toHaveLength(2);
  });
});

describe("useSnapping vector-layer live-source snap caches (U2)", () => {
  afterEach(() => {
    mockedFetch.mockReset();
  });

  test("a GeoJSON snap layer resolves to the live OL source with no fetch, and stays live after refresh", async () => {
    const liveSource = new VectorSource();
    liveSource.addFeature(
      new Feature({
        geometry: new LineString([
          [0, 0],
          [0, 100],
        ]),
      }),
    );
    const stubLayer = makeStubOlLayer("Rivers", liveSource);
    const map = makeMapWithLayers([stubLayer]);
    const { result } = renderHook(() =>
      useSnapping({ layers: [geoJsonRiverLayerConfig] }),
    );

    await result.current.refreshSnapCaches(map);
    result.current.updateSnap(map, [SNAP_PIXELS - 5, 50]);

    expect(mockedFetch).not.toHaveBeenCalled();
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    const previewLayer = map.addLayer.mock.calls[0][0];
    expect(previewLayer.getSource().getFeatures()).toHaveLength(2);

    // Mutate the live source AFTER refresh (no second refreshSnapCaches call)
    // by adding a feature far from the first one. Only the new feature is
    // within snap range of the next coordinate, so a drawn preview there
    // proves the cache entry is a live reference to `liveSource`, not a copy
    // taken at refresh time.
    liveSource.addFeature(
      new Feature({
        geometry: new LineString([
          [1000, 1000],
          [1000, 1100],
        ]),
      }),
    );
    result.current.updateSnap(map, [1000 + SNAP_PIXELS - 5, 1050]);
    const previewFeatures = previewLayer.getSource().getFeatures();
    expect(previewFeatures).toHaveLength(2);
  });

  test("does not call fetchLayerVectorFeatures for a GeoJSON snap layer", async () => {
    const liveSource = new VectorSource();
    liveSource.addFeature(
      new Feature({
        geometry: new LineString([
          [0, 0],
          [0, 100],
        ]),
      }),
    );
    const stubLayer = makeStubOlLayer("Rivers", liveSource);
    const map = makeMapWithLayers([stubLayer]);
    const { result } = renderHook(() =>
      useSnapping({ layers: [geoJsonRiverLayerConfig] }),
    );

    await result.current.refreshSnapCaches(map);

    expect(mockedFetch).not.toHaveBeenCalled();
  });

  test("mixed map: fetch runs once for the Map Service layer while the GeoJSON layer resolves live, both snappable", async () => {
    const liveSource = new VectorSource();
    liveSource.addFeature(
      new Feature({
        geometry: new LineString([
          [0, 0],
          [0, 100],
        ]),
      }),
    );
    const stubLayer = makeStubOlLayer("Rivers", liveSource);
    const map = makeMapWithLayers([stubLayer]);
    mockedFetch.mockResolvedValue([
      new Feature({
        geometry: new LineString([
          [1000, 1000],
          [1000, 1100],
        ]),
      }),
    ]);
    const { result } = renderHook(() =>
      useSnapping({
        layers: [geoJsonRiverLayerConfig, mapServiceRiverLayerConfig],
      }),
    );

    await result.current.refreshSnapCaches(map);

    expect(mockedFetch).toHaveBeenCalledTimes(1);

    // The GeoJSON layer's live feature is snappable.
    result.current.updateSnap(map, [SNAP_PIXELS - 5, 50]);
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    const previewLayer = map.addLayer.mock.calls[0][0];
    expect(previewLayer.getSource().getFeatures()).toHaveLength(2);

    // The Map Service layer's fetched feature is also snappable.
    result.current.updateSnap(map, [1000 + SNAP_PIXELS - 5, 1050]);
    expect(previewLayer.getSource().getFeatures()).toHaveLength(2);
  });

  test("a layer's clickTolerance overrides the default snap radius in both directions", async () => {
    const liveSource = new VectorSource();
    liveSource.addFeature(
      new Feature({
        geometry: new LineString([
          [0, 0],
          [0, 100],
        ]),
      }),
    );
    const stubLayer = makeStubOlLayer("Rivers", liveSource);
    const withTolerance = (clickTolerance) => ({
      configuration: {
        props: {
          name: "Rivers",
          snapToFeatures: true,
          clickTolerance,
          source: { type: "GeoJSON" },
        },
      },
    });

    // Wider than the default: a cursor 25px out (beyond SNAP_PIXELS = 15)
    // still snaps when the layer sets clickTolerance 30.
    const wideMap = makeMapWithLayers([stubLayer]);
    const wide = renderHook(() =>
      useSnapping({ layers: [withTolerance(30)] }),
    ).result;
    await wide.current.refreshSnapCaches(wideMap);
    wide.current.updateSnap(wideMap, [25, 50]);
    expect(wideMap.addLayer).toHaveBeenCalledTimes(1);

    // Tighter than the default: 10px out does NOT snap at clickTolerance 5.
    const tightMap = makeMapWithLayers([stubLayer]);
    const tight = renderHook(() =>
      useSnapping({ layers: [withTolerance(5)] }),
    ).result;
    await tight.current.refreshSnapCaches(tightMap);
    tight.current.updateSnap(tightMap, [10, 50]);
    expect(tightMap.addLayer).not.toHaveBeenCalled();
  });

  test("a clickTolerance edit takes effect immediately, without waiting for a cache refresh", async () => {
    const liveSource = new VectorSource();
    liveSource.addFeature(
      new Feature({
        geometry: new LineString([
          [0, 0],
          [0, 100],
        ]),
      }),
    );
    const stubLayer = makeStubOlLayer("Rivers", liveSource);
    const map = makeMapWithLayers([stubLayer]);
    const withTolerance = (clickTolerance) => [
      {
        configuration: {
          props: {
            name: "Rivers",
            snapToFeatures: true,
            clickTolerance,
            source: { type: "GeoJSON" },
          },
        },
      },
    ];

    const { result, rerender } = renderHook((props) => useSnapping(props), {
      initialProps: { layers: withTolerance(30) },
    });
    await result.current.refreshSnapCaches(map);

    // Baseline: 25px out snaps at tolerance 30.
    result.current.updateSnap(map, [25, 50]);
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    const previewLayer = map.addLayer.mock.calls[0][0];
    expect(previewLayer.getSource().getFeatures()).toHaveLength(2);

    // The user saves a tighter tolerance: the layers prop updates but NO
    // refreshSnapCaches runs (that only happens on moveend/prime). The new
    // radius must apply on the very next hover.
    rerender({ layers: withTolerance(5) });
    result.current.updateSnap(map, [25, 50]);
    expect(previewLayer.getSource().getFeatures()).toHaveLength(0);
  });

  test("snapping obeys the layer's min/max zoom bounds (renderer visibility, not just getVisible)", async () => {
    const liveSource = new VectorSource();
    liveSource.addFeature(
      new Feature({
        geometry: new LineString([
          [0, 0],
          [0, 100],
        ]),
      }),
    );
    // getVisible() reports true, but the layer's own minZoom hides it at the
    // current view zoom — snapping must follow the renderer, not the flag.
    const zoomBoundLayer = (minZoom) => ({
      ...makeStubOlLayer("Rivers", liveSource),
      getLayerState: () => ({
        visible: true,
        minResolution: 0,
        maxResolution: Infinity,
        minZoom,
        maxZoom: Infinity,
      }),
    });
    const mapAtZoom = (olLayer, zoom) => ({
      ...makeMapWithLayers([olLayer], { zoom }),
      getView: () => ({
        getZoom: () => zoom,
        getResolution: () => 1,
        getState: () => ({ zoom, resolution: 1 }),
      }),
    });

    // View zoom 5 is NOT above the layer's minZoom 8 -> hidden -> no snap.
    const hiddenMap = mapAtZoom(zoomBoundLayer(8), 5);
    const { result } = renderHook(() =>
      useSnapping({ layers: [geoJsonRiverLayerConfig] }),
    );
    await result.current.refreshSnapCaches(hiddenMap);
    result.current.updateSnap(hiddenMap, [SNAP_PIXELS - 5, 50]);
    expect(hiddenMap.addLayer).not.toHaveBeenCalled();

    // Same layer shape within its zoom bounds -> snaps normally.
    const shownMap = mapAtZoom(zoomBoundLayer(2), 5);
    await result.current.refreshSnapCaches(shownMap);
    result.current.updateSnap(shownMap, [SNAP_PIXELS - 5, 50]);
    expect(shownMap.addLayer).toHaveBeenCalledTimes(1);
  });

  test("a GeoJSON snap layer with no matching OL instance contributes no cache entry and does not throw", async () => {
    // No stub layer named "Rivers" — simulates a layer mid-rebuild.
    const map = makeMapWithLayers([]);
    const { result } = renderHook(() =>
      useSnapping({ layers: [geoJsonRiverLayerConfig] }),
    );

    await expect(result.current.refreshSnapCaches(map)).resolves.not.toThrow();
    expect(mockedFetch).not.toHaveBeenCalled();

    expect(() =>
      result.current.updateSnap(map, [SNAP_PIXELS - 5, 50]),
    ).not.toThrow();
    // No cache entry means nothing to snap to and no preview layer created.
    expect(map.addLayer).not.toHaveBeenCalled();
  });

  test("a GeoJSON snap layer whose OL instance's getSource() returns null is skipped without throwing", async () => {
    const stubLayer = makeStubOlLayer("Rivers", null);
    const map = makeMapWithLayers([stubLayer]);
    const { result } = renderHook(() =>
      useSnapping({ layers: [geoJsonRiverLayerConfig] }),
    );

    await expect(result.current.refreshSnapCaches(map)).resolves.not.toThrow();
    expect(mockedFetch).not.toHaveBeenCalled();

    expect(() =>
      result.current.updateSnap(map, [SNAP_PIXELS - 5, 50]),
    ).not.toThrow();
    expect(map.addLayer).not.toHaveBeenCalled();
  });

  test("zoom gate: a GeoJSON snap layer below its minZoomQuery is excluded without fetching or resolving the OL instance", async () => {
    const liveSource = new VectorSource();
    liveSource.addFeature(
      new Feature({
        geometry: new LineString([
          [0, 0],
          [0, 100],
        ]),
      }),
    );
    const stubLayer = makeStubOlLayer("Rivers", liveSource);
    // Map zoom (10, the makeMapWithLayers default) is below minZoomQuery (15).
    const map = makeMapWithLayers([stubLayer], { zoom: 10 });
    const zoomGatedConfig = {
      configuration: {
        props: {
          ...geoJsonRiverLayerConfig.configuration.props,
          minZoomQuery: 15,
        },
      },
    };
    const { result } = renderHook(() =>
      useSnapping({ layers: [zoomGatedConfig] }),
    );

    await result.current.refreshSnapCaches(map);
    expect(mockedFetch).not.toHaveBeenCalled();

    result.current.updateSnap(map, [SNAP_PIXELS - 5, 50]);
    // Excluded by the zoom gate entirely, so no snap and no preview layer.
    expect(map.addLayer).not.toHaveBeenCalled();
  });

  test("snapping follows a rebuilt OL layer without a moveend", async () => {
    // The reconciliation sweep in map/Map.js rebuilds VectorLayers on any
    // layers change: the OL instance (and its VectorSource) is replaced while
    // the configured name stays the same, and no moveend fires. Live entries
    // must resolve the OL source at use time so snapping targets the NEW
    // source immediately.
    const oldSource = new VectorSource();
    oldSource.addFeature(
      new Feature({
        geometry: new LineString([
          [0, 0],
          [0, 100],
        ]),
      }),
    );
    const olLayers = [makeStubOlLayer("Rivers", oldSource)];
    const map = makeMapWithLayers(olLayers);
    const { result } = renderHook(() =>
      useSnapping({ layers: [geoJsonRiverLayerConfig] }),
    );

    await result.current.refreshSnapCaches(map);

    // Rebuild: a NEW stub layer with the same name but a different
    // VectorSource whose only feature sits at a new position.
    const newSource = new VectorSource();
    newSource.addFeature(
      new Feature({
        geometry: new LineString([
          [500, 500],
          [500, 600],
        ]),
      }),
    );
    olLayers.splice(0, 1, makeStubOlLayer("Rivers", newSource));

    // No further refreshSnapCaches call — snap near the NEW feature.
    result.current.updateSnap(map, [500 + SNAP_PIXELS - 5, 550]);
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    const previewLayer = map.addLayer.mock.calls[0][0];
    expect(previewLayer.getSource().getFeatures()).toHaveLength(2);

    // And the OLD source's feature is no longer snappable — the stale
    // reference is gone, not merely supplemented.
    result.current.updateSnap(map, [SNAP_PIXELS - 5, 50]);
    expect(previewLayer.getSource().getFeatures()).toHaveLength(0);
  });

  test("a snap layer that mounts after the refresh becomes snappable without another refresh", async () => {
    // Late mount: the refresh (e.g. the one-shot prime) runs before the OL
    // layer exists. The live marker entry is still recorded, so once the
    // layer mounts, use-time resolution makes it snappable with no further
    // refresh.
    const olLayers = [];
    const map = makeMapWithLayers(olLayers);
    const { result } = renderHook(() =>
      useSnapping({ layers: [geoJsonRiverLayerConfig] }),
    );

    await result.current.refreshSnapCaches(map);
    expect(mockedFetch).not.toHaveBeenCalled();

    const liveSource = new VectorSource();
    liveSource.addFeature(
      new Feature({
        geometry: new LineString([
          [0, 0],
          [0, 100],
        ]),
      }),
    );
    olLayers.push(makeStubOlLayer("Rivers", liveSource));

    result.current.updateSnap(map, [SNAP_PIXELS - 5, 50]);
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    const previewLayer = map.addLayer.mock.calls[0][0];
    expect(previewLayer.getSource().getFeatures()).toHaveLength(2);
  });
});
