// MapVisualization: snapping, linked view groups and the linked cursor.
import {
  mockedQueryLayerFeatures,
  mockedFetchLayerVectorFeatures,
} from "__tests__/utilities/mapVisualizationHarness";
import { useRef, useEffect } from "react";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";
import createLoadedComponent from "__tests__/utilities/customRender";
import PropTypes from "prop-types";
import { Map, View } from "ol";
import {
  AppContext,
  DataViewerModeContext,
  GridItemContext,
  LayoutContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import LineString from "ol/geom/LineString.js";
import Feature from "ol/Feature.js";
import Overlay from "ol/Overlay";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import MapVisualization, {
  LINKED_CURSOR_OVERLAY_ID,
} from "components/visualizations/Map";
import { clearClientSourceCaches } from "components/map/ModuleLoader";

// The GeoParquet/Zarr read caches are module-scoped and live for the page's
// lifetime by design, so each test must start from an empty one.
beforeEach(() => {
  clearClientSourceCaches();
});

describe("snap pipeline integration", () => {
  // The real findBestSnap/findSnapFeatures implementations compare
  // screen-pixel distances via map.getPixelFromCoordinate, which returns null
  // in jsdom (the map div has no size, so OL never builds a frameState).
  // Mapping coordinates 1:1 to pixels keeps the genuine snap math running:
  // distances in map units ARE the pixel distances the thresholds compare
  // against (SNAP_PIXELS = 15, GATHER_PIXELS = 35).
  let pixelSpy;

  beforeEach(() => {
    pixelSpy = jest
      .spyOn(Map.prototype, "getPixelFromCoordinate")
      .mockImplementation((coordinate) =>
        coordinate ? [coordinate[0], coordinate[1]] : null,
      );
  });

  afterEach(() => {
    pixelSpy.mockRestore();
  });

  const riversLayer = () => ({
    configuration: {
      type: "ImageLayer",
      props: {
        name: "Rivers",
        snapToFeatures: true,
        source: {
          type: "ESRI Image and Map Service",
          props: { url: "rivers_url" },
        },
      },
    },
  });

  const otherLayer = () => ({
    configuration: {
      type: "ImageLayer",
      props: {
        name: "Other Layer",
        source: {
          type: "ESRI Image and Map Service",
          props: { url: "other_url" },
        },
      },
    },
  });

  const makeRiver = (name, coords) =>
    new Feature({ geometry: new LineString(coords), river_name: name });

  // A GeoJSON/VectorLayer fixture whose features live in a real OL
  // VectorSource (built by the component's normal ModuleLoader path from an
  // empty FeatureCollection, then populated directly via
  // findOlLayer(...).getSource().addFeatures(...) once mounted). Covers U2's
  // live-source snap-cache branch (source.type "GeoJSON") and U1's
  // clickTolerance-on-vector-layers branch, as opposed to riversLayer()'s
  // ESRI Image and Map Service fetch-based cache.
  const geoJsonRiversLayer = ({
    name = "GeoJSON Rivers",
    snapToFeatures = true,
    clickTolerance,
  } = {}) => ({
    configuration: {
      type: "VectorLayer",
      props: {
        name,
        ...(snapToFeatures ? { snapToFeatures } : {}),
        ...(clickTolerance !== undefined ? { clickTolerance } : {}),
        source: {
          type: "GeoJSON",
          props: {},
          geojson: {
            type: "FeatureCollection",
            features: [],
            crs: { type: "name", properties: { name: "EPSG:3857" } },
          },
        },
      },
    },
  });

  const SnapHarness = ({ mapRef, layers }) => {
    const { mapReady } = useMapContext();
    return (
      <div>
        <MapVisualization
          visualizationRef={mapRef}
          mapConfig={{}}
          viewConfig={{}}
          layers={layers}
          baseMap={null}
          layerControl={false}
        />
        <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
      </div>
    );
  };
  SnapHarness.propTypes = {
    mapRef: PropTypes.object,
    layers: PropTypes.array,
  };

  // Mount the map and wait for the mount-time moveend prime to build the
  // snap cache (registration in map/Map.js invokes the handler once, so no
  // moveend dispatch is needed for the initial view — review #17).
  const mountSnapMap = async (layers, { expectedFetches = 1 } = {}) => {
    const mapRef = { current: null };
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <SnapHarness mapRef={mapRef} layers={layers} />
        </MapContextProvider>
      ),
    });
    render(LoadedComponent);
    expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    await waitFor(() =>
      expect(mockedFetchLayerVectorFeatures).toHaveBeenCalledTimes(
        expectedFetches,
      ),
    );
    // Flush the refreshSnapCaches continuation that stores the cache (a
    // macrotask runs after all pending microtasks).
    await new Promise((resolve) => setTimeout(resolve, 0));
    return mapRef;
  };

  const dispatch = (mapRef, evt) =>
    act(async () => {
      mapRef.current.dispatchEvent(evt);
    });

  const findOlLayer = (mapRef, name) =>
    mapRef.current
      .getLayers()
      .getArray()
      .find((olLayer) => olLayer.get("name") === name);

  test("singleclick near a cached feature snap-selects locally; non-snap layers still identify at the true click coordinate", async () => {
    mockedFetchLayerVectorFeatures.mockResolvedValue([
      makeRiver("Test River", [
        [0, 20],
        [30, 20],
      ]),
    ]);
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { other_field: "other value" },
        geometry: {
          paths: [
            [
              [0, 0],
              [0, 1],
            ],
          ],
        },
        layerName: "Other Layer",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

    const mapRef = await mountSnapMap([riversLayer(), otherLayer()]);

    // Click 4 "pixels" off the river line (within SNAP_PIXELS = 15).
    await dispatch(mapRef, {
      type: "singleclick",
      coordinate: [12, 24],
      pixel: [12, 24],
    });

    // The popup anchors at the SNAPPED coordinate on the line, not the raw
    // click — proof the click resolved through the snap cache.
    await waitFor(() => expect(popSetPosition).toHaveBeenCalledWith([12, 20]));

    // /identify ran ONLY for the non-snap layer, at the TRUE click coordinate
    // (evt.coordinate), so the snap cannot shift its identify results.
    expect(mockedQueryLayerFeatures).toHaveBeenCalledTimes(1);
    const [identifiedLayer, , identifyCoordinate] =
      mockedQueryLayerFeatures.mock.calls[0];
    expect(identifiedLayer.configuration.props.name).toBe("Other Layer");
    expect(identifyCoordinate).toEqual([12, 24]);

    // The popup contains the locally-snapped river's attributes AND the
    // identified feature from the sibling layer.
    expect(await screen.findByText("Rivers")).toBeInTheDocument();
    expect(await screen.findByText("Test River")).toBeInTheDocument();
    expect(await screen.findByText("other value")).toBeInTheDocument();
  });

  test("a snapped river keeps slot 1 even when a gauge point is nearer the click", async () => {
    // AE8. A snap is a deliberate selection, so the snapped feature is pinned
    // ahead of the point-beats-line sub-ranking. Without the pin, any gauge
    // inside the gather radius would steal slot 1 and the popup would open on
    // a feature the user explicitly did not snap to.
    mockedFetchLayerVectorFeatures.mockResolvedValue([
      makeRiver("Test River", [
        [0, 20],
        [30, 20],
      ]),
    ]);
    // A gauge ~1.4 "pixels" from the click, versus 4 to the river line.
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { gauge_id: "NEARBY" },
        geometry: { x: 13, y: 23 },
        layerName: "Other Layer",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

    const mapRef = await mountSnapMap([riversLayer(), otherLayer()]);

    await dispatch(mapRef, {
      type: "singleclick",
      coordinate: [12, 24],
      pixel: [12, 24],
    });

    // The overlay settles on the river's extent centre ([15, 20]), not the
    // gauge at [13, 23] -- proof the snapped feature took slot 0.
    await waitFor(() =>
      expect(popSetPosition).toHaveBeenLastCalledWith([15, 20]),
    );
    expect(await screen.findByText("Test River")).toBeInTheDocument();
  });

  test("snap tagging pins only the clicked feature; a gathered sibling in the same layer is not pinned", async () => {
    // Two rivers in one snap layer: the click is within SNAP_PIXELS (15) of the
    // near one and within GATHER_PIXELS (35) of the far one. Only the snapped
    // (near) feature is tagged __snapped; the gathered sibling keeps its plain
    // result -- the `!== clickSnap.feature` branch of the snap-tagging map.
    mockedFetchLayerVectorFeatures.mockResolvedValue([
      makeRiver("Near River", [
        [0, 20],
        [30, 20],
      ]),
      makeRiver("Far River", [
        [0, 40],
        [30, 40],
      ]),
    ]);
    mockedQueryLayerFeatures.mockResolvedValue([]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const mapRef = await mountSnapMap([riversLayer()]);

    // Click 4 "pixels" from Near River (snapped) and 16 from Far River (gathered).
    await dispatch(mapRef, {
      type: "singleclick",
      coordinate: [12, 24],
      pixel: [12, 24],
    });

    // Both gathered rivers make it into the popup; the sibling was not dropped.
    expect(await screen.findByText("Near River")).toBeInTheDocument();
    expect(await screen.findByText("Far River")).toBeInTheDocument();
  });

  test("singleclick with an empty snap cache falls back to /identify for the snap layer", async () => {
    mockedFetchLayerVectorFeatures.mockResolvedValue([]);
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { field1: "identified value" },
        geometry: {
          paths: [
            [
              [0, 0],
              [0, 1],
            ],
          ],
        },
        layerName: "Rivers Sub",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const mapRef = await mountSnapMap([riversLayer()]);

    await dispatch(mapRef, {
      type: "singleclick",
      coordinate: [12, 24],
      pixel: [12, 24],
    });

    await waitFor(() =>
      expect(mockedQueryLayerFeatures).toHaveBeenCalledTimes(1),
    );
    const [identifiedLayer, , identifyCoordinate] =
      mockedQueryLayerFeatures.mock.calls[0];
    expect(identifiedLayer.configuration.props.name).toBe("Rivers");
    expect(identifyCoordinate).toEqual([12, 24]);
    expect(await screen.findByText("identified value")).toBeInTheDocument();
  });

  test("a stale snap-cache fetch resolving after a newer one is discarded (generation token)", async () => {
    let resolveFirst;
    let resolveSecond;
    mockedFetchLayerVectorFeatures
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );
    mockedQueryLayerFeatures.mockResolvedValue([]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const mapRef = { current: null };
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <SnapHarness mapRef={mapRef} layers={[riversLayer()]} />
        </MapContextProvider>
      ),
    });
    render(LoadedComponent);
    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    // Refresh #1: the mount-time prime (fetch left pending).
    await waitFor(() =>
      expect(mockedFetchLayerVectorFeatures).toHaveBeenCalledTimes(1),
    );
    // Refresh #2: a pan/zoom moveend while refresh #1 is still in flight.
    await dispatch(mapRef, { type: "moveend" });
    await waitFor(() =>
      expect(mockedFetchLayerVectorFeatures).toHaveBeenCalledTimes(2),
    );

    // Resolve OUT OF ORDER: the newer view's fetch lands first, then the
    // stale one. Without the generation token, River A (the stale view)
    // would overwrite River B in the cache.
    await act(async () => {
      resolveSecond([
        makeRiver("River B", [
          [0, 20],
          [30, 20],
        ]),
      ]);
    });
    await act(async () => {
      resolveFirst([
        makeRiver("River A", [
          [0, 1000],
          [30, 1000],
        ]),
      ]);
    });

    // Click on River B's geometry: the cache reflects the SECOND view, so
    // the click snap-selects River B locally with no /identify at all.
    await dispatch(mapRef, {
      type: "singleclick",
      coordinate: [12, 24],
      pixel: [12, 24],
    });
    expect(await screen.findByText("River B")).toBeInTheDocument();
    expect(mockedQueryLayerFeatures).not.toHaveBeenCalled();
  });

  test("hiding a snap layer's OL layer stops the hover preview and pointer cursor", async () => {
    mockedFetchLayerVectorFeatures.mockResolvedValue([
      makeRiver("Test River", [
        [0, 20],
        [30, 20],
      ]),
    ]);

    const mapRef = await mountSnapMap([riversLayer()]);
    // The visibility filter reads the mounted OL layer, so wait for it.
    await waitFor(() => expect(findOlLayer(mapRef, "Rivers")).toBeDefined());

    // Positive control: hovering near the river draws the preview (feature
    // outline + snapped-point dot) and sets the pointer-cursor affordance.
    await dispatch(mapRef, {
      type: "pointermove",
      coordinate: [12, 24],
      pixel: [12, 24],
    });
    const previewLayer = findOlLayer(mapRef, "Snap Preview");
    expect(previewLayer).toBeDefined();
    expect(previewLayer.getSource().getFeatures()).toHaveLength(2);
    expect(mapRef.current.getTargetElement().style.cursor).toBe("pointer");

    // Hide the layer the way LayersControl does: OL visibility only, no
    // moveend — the stale cache entry must be filtered out at use time.
    findOlLayer(mapRef, "Rivers").setVisible(false);

    await dispatch(mapRef, {
      type: "pointermove",
      coordinate: [12, 24],
      pixel: [12, 24],
    });
    expect(previewLayer.getSource().getFeatures()).toHaveLength(0);
    expect(mapRef.current.getTargetElement().style.cursor).toBe("");
  });

  test("a hidden snap layer is excluded from the cache refresh itself (no refetch on moveend)", async () => {
    mockedFetchLayerVectorFeatures.mockResolvedValue([
      makeRiver("Test River", [
        [0, 20],
        [30, 20],
      ]),
    ]);

    const mapRef = await mountSnapMap([riversLayer()]);
    await waitFor(() => expect(findOlLayer(mapRef, "Rivers")).toBeDefined());
    const fetchesAfterPrime = mockedFetchLayerVectorFeatures.mock.calls.length;

    // Hide the layer, then complete a pan: refreshSnapCaches must filter the
    // layer out at refresh time and issue no /query fetch for it.
    findOlLayer(mapRef, "Rivers").setVisible(false);
    await dispatch(mapRef, { type: "moveend" });

    expect(mockedFetchLayerVectorFeatures.mock.calls.length).toBe(
      fetchesAfterPrime,
    );
  });

  test("snap preview re-attaches after being removed from the map (reconciliation sweep)", async () => {
    mockedFetchLayerVectorFeatures.mockResolvedValue([
      makeRiver("Test River", [
        [0, 20],
        [30, 20],
      ]),
    ]);

    const mapRef = await mountSnapMap([riversLayer()]);

    await dispatch(mapRef, {
      type: "pointermove",
      coordinate: [12, 24],
      pixel: [12, 24],
    });
    const previewLayer = findOlLayer(mapRef, "Snap Preview");
    expect(previewLayer).toBeDefined();

    // Simulate the layer-reconciliation sweep in map/Map.js detaching the
    // preview layer while the component ref still holds it.
    mapRef.current.removeLayer(previewLayer);
    expect(findOlLayer(mapRef, "Snap Preview")).toBeUndefined();

    await dispatch(mapRef, {
      type: "pointermove",
      coordinate: [14, 24],
      pixel: [14, 24],
    });
    const reattached = findOlLayer(mapRef, "Snap Preview");
    // Same instance re-added (not a duplicate layer), with the preview drawn.
    expect(reattached).toBe(previewLayer);
    expect(reattached.getSource().getFeatures()).toHaveLength(2);
  });

  test("repeated hovers while the preview layer is attached never add a duplicate layer", async () => {
    mockedFetchLayerVectorFeatures.mockResolvedValue([
      makeRiver("Test River", [
        [0, 20],
        [30, 20],
      ]),
    ]);

    const mapRef = await mountSnapMap([riversLayer()]);

    for (const x of [12, 14, 16]) {
      await dispatch(mapRef, {
        type: "pointermove",
        coordinate: [x, 24],
        pixel: [x, 24],
      });
    }

    const previewLayers = mapRef.current
      .getLayers()
      .getArray()
      .filter((olLayer) => olLayer.get("name") === "Snap Preview");
    expect(previewLayers).toHaveLength(1);
  });

  // --- Vector (GeoJSON) snap layers — U3 integration coverage -------------
  // These mirror the ESRI-cache tests above but exercise the U2 live-source
  // branch: the snap cache entry IS the GeoJSON layer's own live OL
  // VectorSource, populated directly here (no fetchLayerVectorFeatures
  // network fetch involved for this layer at all).
  // The mount-time prime in map/Map.js waits for the first layers-bearing
  // effect run, so by the time the OL layers are mounted the live-source
  // cache entry exists — no moveend is required before snapping works.
  // (The hover assertions re-dispatch inside waitFor because the prime runs
  // in the same async effect that mounted the layer.)
  test("R2: hover near a GeoJSON river draws the cyan preview and pointer cursor; singleclick snap-selects it locally without querying the layer", async () => {
    const layerName = "GeoJSON Rivers";
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

    const mapRef = await mountSnapMap(
      [geoJsonRiversLayer({ name: layerName })],
      {
        expectedFetches: 0,
      },
    );
    await waitFor(() => expect(findOlLayer(mapRef, layerName)).toBeDefined());

    // Populate the layer's real, live OL VectorSource directly — the cache
    // entry built by the mount-time prime IS this same source object, so it
    // already reflects whatever features live on it.
    findOlLayer(mapRef, layerName)
      .getSource()
      .addFeatures([
        makeRiver("Test River", [
          [0, 20],
          [30, 20],
        ]),
      ]);

    // Hover near the river: cyan preview (feature outline + snapped-point
    // dot = 2 features) and the pointer-cursor affordance.
    await waitFor(async () => {
      await dispatch(mapRef, {
        type: "pointermove",
        coordinate: [12, 24],
        pixel: [12, 24],
      });
      expect(
        findOlLayer(mapRef, "Snap Preview")?.getSource().getFeatures(),
      ).toHaveLength(2);
    });
    expect(mapRef.current.getTargetElement().style.cursor).toBe("pointer");

    // Click 4 "pixels" off the river line (within SNAP_PIXELS = 15): local
    // snapped selection, popup anchored at the SNAPPED coordinate.
    await dispatch(mapRef, {
      type: "singleclick",
      coordinate: [12, 24],
      pixel: [12, 24],
    });
    await waitFor(() => expect(popSetPosition).toHaveBeenCalledWith([12, 20]));

    // The click resolved entirely from the local live source — no /identify
    // (queryLayerFeatures) call for this (or any) layer.
    expect(mockedQueryLayerFeatures).not.toHaveBeenCalled();
    expect(await screen.findByText(layerName)).toBeInTheDocument();
    expect(await screen.findByText("Test River")).toBeInTheDocument();
  });

  test("R3: fetchLayerVectorFeatures is never invoked for a GeoJSON snap layer across prime, moveend, hover, and click", async () => {
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    const layerName = "GeoJSON Rivers";

    const mapRef = await mountSnapMap(
      [geoJsonRiversLayer({ name: layerName })],
      {
        expectedFetches: 0,
      },
    );
    await waitFor(() => expect(findOlLayer(mapRef, layerName)).toBeDefined());
    // Mount-time prime already ran above; confirm it issued no fetch.
    expect(mockedFetchLayerVectorFeatures).not.toHaveBeenCalled();

    findOlLayer(mapRef, layerName)
      .getSource()
      .addFeatures([
        makeRiver("Test River", [
          [0, 20],
          [30, 20],
        ]),
      ]);

    await dispatch(mapRef, { type: "moveend" });
    await dispatch(mapRef, {
      type: "pointermove",
      coordinate: [12, 24],
      pixel: [12, 24],
    });
    await dispatch(mapRef, {
      type: "singleclick",
      coordinate: [12, 24],
      pixel: [12, 24],
    });

    expect(mockedFetchLayerVectorFeatures).not.toHaveBeenCalled();
  });

  test("R1 (integration): clickTolerance on a non-snap GeoJSON layer widens forEachFeatureAtPixel's hitTolerance during the click pipeline", async () => {
    // queryLayerFeatures is module-mocked at the top of this file; restore
    // the REAL implementation for this test only so getGeoJSONLayerFeatures'
    // forEachFeatureAtPixel({ hitTolerance }) call actually runs.
    mockedQueryLayerFeatures.mockImplementation(
      jest.requireActual("components/map/utilities").queryLayerFeatures,
    );
    const forEachSpy = jest.spyOn(Map.prototype, "forEachFeatureAtPixel");
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const layerName = "GeoJSON Other (tolerant)";
    const layer = geoJsonRiversLayer({
      name: layerName,
      snapToFeatures: false,
      clickTolerance: 20,
    });

    try {
      const mapRef = await mountSnapMap([layer], { expectedFetches: 0 });
      await waitFor(() => expect(findOlLayer(mapRef, layerName)).toBeDefined());

      await dispatch(mapRef, {
        type: "singleclick",
        coordinate: [12, 24],
        pixel: [12, 24],
      });

      await waitFor(() => expect(forEachSpy).toHaveBeenCalled());
      const callWithTolerance = forEachSpy.mock.calls.find(
        (call) => call[2]?.hitTolerance === 20,
      );
      expect(callWithTolerance).toBeDefined();
    } finally {
      forEachSpy.mockRestore();
      mockedQueryLayerFeatures.mockReset();
    }
  });

  test("features added to the live GeoJSON source after mount are snappable on the next hover without any moveend", async () => {
    const layerName = "GeoJSON Rivers";
    const mapRef = await mountSnapMap(
      [geoJsonRiversLayer({ name: layerName })],
      {
        expectedFetches: 0,
      },
    );
    await waitFor(() => expect(findOlLayer(mapRef, layerName)).toBeDefined());

    // First hover: the live source is still empty (simulating features that
    // haven't loaded yet), so nothing snaps and the preview layer is never
    // even created. No moveend is dispatched anywhere in this test — the
    // mount-time prime created the live-source cache entry.
    await dispatch(mapRef, {
      type: "pointermove",
      coordinate: [12, 24],
      pixel: [12, 24],
    });
    expect(findOlLayer(mapRef, "Snap Preview")).toBeUndefined();

    // Simulate async feature loading landing directly on the live OL source
    // — the cache entry IS this source object (U2), so NO moveend is needed
    // for the new features to become snappable.
    findOlLayer(mapRef, layerName)
      .getSource()
      .addFeatures([
        makeRiver("Late River", [
          [0, 20],
          [30, 20],
        ]),
      ]);

    await waitFor(async () => {
      await dispatch(mapRef, {
        type: "pointermove",
        coordinate: [12, 24],
        pixel: [12, 24],
      });
      expect(
        findOlLayer(mapRef, "Snap Preview")?.getSource().getFeatures(),
      ).toHaveLength(2);
    });
    expect(mapRef.current.getTargetElement().style.cursor).toBe("pointer");
  });

  test("hiding a GeoJSON snap layer's OL layer stops the hover preview (visibleSnapCaches extends to live vector sources)", async () => {
    const layerName = "GeoJSON Rivers";
    const mapRef = await mountSnapMap(
      [geoJsonRiversLayer({ name: layerName })],
      {
        expectedFetches: 0,
      },
    );
    await waitFor(() => expect(findOlLayer(mapRef, layerName)).toBeDefined());
    await dispatch(mapRef, { type: "moveend" });
    findOlLayer(mapRef, layerName)
      .getSource()
      .addFeatures([
        makeRiver("Test River", [
          [0, 20],
          [30, 20],
        ]),
      ]);

    // Positive control: hovering near the river draws the preview and sets
    // the pointer-cursor affordance.
    await dispatch(mapRef, {
      type: "pointermove",
      coordinate: [12, 24],
      pixel: [12, 24],
    });
    const previewLayer = findOlLayer(mapRef, "Snap Preview");
    expect(previewLayer).toBeDefined();
    expect(previewLayer.getSource().getFeatures()).toHaveLength(2);
    expect(mapRef.current.getTargetElement().style.cursor).toBe("pointer");

    // Hide the layer the way LayersControl does: OL visibility only, no
    // moveend — the stale cache entry must be filtered out at use time.
    findOlLayer(mapRef, layerName).setVisible(false);

    await dispatch(mapRef, {
      type: "pointermove",
      coordinate: [12, 24],
      pixel: [12, 24],
    });
    expect(previewLayer.getSource().getFeatures()).toHaveLength(0);
    expect(mapRef.current.getTargetElement().style.cursor).toBe("");
  });

  test("snapping obeys the layer's min/max zoom: a zoom-hidden layer stops snapping without a refresh", async () => {
    const layerName = "GeoJSON Rivers";
    const mapRef = await mountSnapMap(
      [geoJsonRiversLayer({ name: layerName })],
      {
        expectedFetches: 0,
      },
    );
    await waitFor(() => expect(findOlLayer(mapRef, layerName)).toBeDefined());
    await dispatch(mapRef, { type: "moveend" });
    findOlLayer(mapRef, layerName)
      .getSource()
      .addFeatures([
        makeRiver("Test River", [
          [0, 20],
          [30, 20],
        ]),
      ]);

    // Positive control at the current view zoom.
    await dispatch(mapRef, {
      type: "pointermove",
      coordinate: [12, 24],
      pixel: [12, 24],
    });
    const previewLayer = findOlLayer(mapRef, "Snap Preview");
    expect(previewLayer.getSource().getFeatures()).toHaveLength(2);

    // Constrain the layer's maxZoom below the current view zoom: the layer
    // stops rendering while getVisible() stays true — snapping must follow
    // the renderer's visibility, immediately, with no cache refresh.
    const viewZoom = mapRef.current.getView().getZoom();
    findOlLayer(mapRef, layerName).setMaxZoom(viewZoom - 1);
    await dispatch(mapRef, {
      type: "pointermove",
      coordinate: [12, 24],
      pixel: [12, 24],
    });
    expect(previewLayer.getSource().getFeatures()).toHaveLength(0);
    expect(mapRef.current.getTargetElement().style.cursor).toBe("");

    // Lifting the constraint restores snapping, again with no refresh.
    findOlLayer(mapRef, layerName).setMaxZoom(Infinity);
    await dispatch(mapRef, {
      type: "pointermove",
      coordinate: [12, 24],
      pixel: [12, 24],
    });
    expect(previewLayer.getSource().getFeatures()).toHaveLength(2);
  });
});

describe("linked map view groups", () => {
  const groupedLayers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "Gauges",
          minZoomQuery: 6,
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "some_url" },
          },
        },
      },
    },
  ];

  const GroupedMapMember = ({ uuid, maps }) => {
    const visualizationRef = useRef();
    const { mapReady } = useMapContext();
    useEffect(() => {
      maps[uuid] = visualizationRef;
    }, [maps, uuid]);
    return (
      <GridItemContext.Provider
        value={{ gridItemUUID: uuid, shouldLoad: true, gridItemI: uuid }}
      >
        <MapVisualization
          visualizationRef={visualizationRef}
          mapConfig={{}}
          layers={groupedLayers}
          baseMap={null}
          layerControl={false}
          mapExtent={{ extent: "0,0,5", viewGroup: "Basin" }}
        />
        <p>{mapReady ? `${uuid} ready` : `${uuid} loading`}</p>
        <button
          type="button"
          onClick={() =>
            visualizationRef.current?.dispatchEvent({
              type: "singleclick",
              coordinate: [1000, 2000],
              pixel: [5, 5],
            })
          }
        >
          {`click-${uuid}`}
        </button>
        <button
          type="button"
          onClick={() =>
            visualizationRef.current?.dispatchEvent({ type: "postrender" })
          }
        >
          {`frame-${uuid}`}
        </button>
      </GridItemContext.Provider>
    );
  };
  GroupedMapMember.propTypes = {
    uuid: PropTypes.string,
    maps: PropTypes.object,
  };

  test("a below-minZoomQuery click moves the whole group, and only the clicked map opens a popup", async () => {
    // `queryLayerFeatures` mutates the clicked map's view IN PLACE when the
    // click lands below a layer's minZoomQuery -- the third programmatic path
    // that moves a view, and the only one that does not replace the View
    // object. Under the identity rule it reads as a user action, which is the
    // intended treatment: the viewer did act on that map. Pinned here because
    // a click moving every member of a group is the kind of thing R16 is read
    // to forbid, so the boundary belongs in a test rather than in a comment.
    // The popup overlay auto-pans, and its rect measurement throws in jsdom.
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    const actualUtilities = jest.requireActual("components/map/utilities");
    mockedQueryLayerFeatures.mockImplementation(
      async (layerInfo, map, coordinate, pixel) => {
        if (
          layerInfo.configuration.props.minZoomQuery >= map.getView().getZoom()
        ) {
          return actualUtilities.queryLayerFeatures(
            layerInfo,
            map,
            coordinate,
            pixel,
          );
        }
        return [{ layerName: "Gauges", attributes: { gauge: "Feature A" } }];
      },
    );

    const maps = {};
    const LoadedComponent = createLoadedComponent({
      children: (
        <>
          <MapContextProvider>
            <GroupedMapMember uuid="a" maps={maps} />
          </MapContextProvider>
          <MapContextProvider>
            <GroupedMapMember uuid="b" maps={maps} />
          </MapContextProvider>
        </>
      ),
    });
    render(LoadedComponent);

    expect(await screen.findByText("a ready")).toBeInTheDocument();
    expect(await screen.findByText("b ready")).toBeInTheDocument();

    // Both members record a baseline from their own opening view first.
    fireEvent.click(screen.getByText("frame-a"));
    fireEvent.click(screen.getByText("frame-b"));

    // The click lands below minZoomQuery, so the layer query zooms the clicked
    // map in place instead of identifying anything.
    fireEvent.click(screen.getByText("click-a"));
    await waitFor(() =>
      expect(maps.a.current.getView().getZoom()).toBeCloseTo(6.1, 5),
    );
    expect(maps.a.current.getView().getCenter()).toEqual([1000, 2000]);

    fireEvent.click(screen.getByText("frame-a"));

    // The group follows the auto-zoom.
    await waitFor(() =>
      expect(maps.b.current.getView().getCenter()).toEqual([1000, 2000]),
    );
    expect(maps.b.current.getView().getResolution()).toBe(
      maps.a.current.getView().getResolution(),
    );

    // Only the clicked map was queried -- the follower moved, it did not click.
    expect(
      mockedQueryLayerFeatures.mock.calls.every(
        (call) => call[1] === maps.a.current,
      ),
    ).toBe(true);
    // ...and nothing opened a popup on either map: the query zoomed instead.
    expect(screen.queryByText("Feature A")).not.toBeInTheDocument();

    // Now above minZoomQuery, the same click identifies a feature. Exactly one
    // of the two popups shows it.
    fireEvent.click(screen.getByText("click-a"));
    expect(await screen.findByText("Feature A")).toBeInTheDocument();
    expect(screen.getAllByText("Feature A")).toHaveLength(1);
    expect(screen.getAllByLabelText("Map Popup Content")).toHaveLength(2);
    expect(
      mockedQueryLayerFeatures.mock.calls.every(
        (call) => call[1] === maps.a.current,
      ),
    ).toBe(true);
  });
});

describe("linked cursor", () => {
  const cursorLayers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "Gauges",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "some_url" },
          },
        },
      },
    },
  ];

  const CursorMember = ({ uuid, maps, viewGroup = "Basin", mapDrawing }) => {
    const visualizationRef = useRef();
    const { mapReady } = useMapContext();
    useEffect(() => {
      maps[uuid] = visualizationRef;
    }, [maps, uuid]);
    return (
      <GridItemContext.Provider
        value={{ gridItemUUID: uuid, shouldLoad: true, gridItemI: uuid }}
      >
        <MapVisualization
          visualizationRef={visualizationRef}
          mapConfig={{}}
          layers={cursorLayers}
          baseMap={null}
          layerControl={false}
          mapDrawing={mapDrawing}
          mapExtent={
            viewGroup ? { extent: "0,0,5", viewGroup } : { extent: "0,0,5" }
          }
        />
        <p>{mapReady ? `${uuid} ready` : `${uuid} loading`}</p>
      </GridItemContext.Provider>
    );
  };
  CursorMember.propTypes = {
    uuid: PropTypes.string,
    maps: PropTypes.object,
    viewGroup: PropTypes.string,
    mapDrawing: PropTypes.object,
  };

  const dashboardOf = (members, maps) => (
    <>
      {members.map((member) => (
        <MapContextProvider key={member.uuid}>
          <CursorMember maps={maps} {...member} />
        </MapContextProvider>
      ))}
    </>
  );

  const renderCursorDashboard = async (members) => {
    const maps = {};
    const utils = render(
      createLoadedComponent({ children: dashboardOf(members, maps) }),
    );
    for (const member of members) {
      expect(
        await screen.findByText(`${member.uuid} ready`),
      ).toBeInTheDocument();
    }
    return { maps, ...utils };
  };

  // The marker carries a stable overlay id precisely so a test (and a browser
  // debugging session) can find it without walking the overlay collection.
  const cursorMarker = (mapRef) =>
    mapRef.current.getOverlayById(LINKED_CURSOR_OVERLAY_ID);

  // The popup overlay carries no id, so it is found by the element its own
  // React root renders into. Reaching for the node directly is the point here:
  // the assertion is about an OpenLayers overlay, not about rendered output.
  const popupOverlayOf = (mapRef) =>
    mapRef.current
      .getOverlays()
      .getArray()
      // eslint-disable-next-line testing-library/no-node-access
      .find((overlay) => overlay.getElement()?.querySelector?.("#map-popup"));

  const movePointer = async (mapRef, coordinate, originalEvent) => {
    await act(async () => {
      mapRef.current.dispatchEvent({
        type: "pointermove",
        coordinate,
        pixel: [5, 5],
        originalEvent,
      });
    });
  };

  // Publishes are coalesced onto an animation frame, so a test that asserts an
  // ABSENCE has to let a real frame go by first -- otherwise it would pass
  // against an implementation that simply had not flushed yet.
  const letAFramePass = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  };

  test("a pointermove on one member marks the same coordinate on the other", async () => {
    const { maps } = await renderCursorDashboard([
      { uuid: "a" },
      { uuid: "b" },
    ]);

    await movePointer(maps.a, [1000, 2000]);

    await waitFor(() =>
      expect(cursorMarker(maps.b).getPosition()).toEqual([1000, 2000]),
    );
    // The publisher is excluded from its own fan-out: a map never marks the
    // position of its own pointer.
    expect(cursorMarker(maps.a).getPosition()).toBeUndefined();
  });

  test("a peer's pointermove opens no popup, selects nothing and fires no click handler on the receiver", async () => {
    const { maps } = await renderCursorDashboard([
      { uuid: "a" },
      { uuid: "b" },
    ]);
    const receiverClick = jest.fn();
    maps.b.current.on("singleclick", receiverClick);

    await movePointer(maps.a, [1000, 2000]);
    await waitFor(() =>
      expect(cursorMarker(maps.b).getPosition()).toEqual([1000, 2000]),
    );
    await letAFramePass();

    expect(receiverClick).not.toHaveBeenCalled();
    expect(popupOverlayOf(maps.b).getPosition()).toBeUndefined();
    // No layer on either map was identified, so no feature was selected.
    expect(mockedQueryLayerFeatures).not.toHaveBeenCalled();
  });

  test("a pointerleave on the source viewport clears the marker on every other member", async () => {
    const { maps } = await renderCursorDashboard([
      { uuid: "a" },
      { uuid: "b" },
      { uuid: "c" },
    ]);

    await movePointer(maps.a, [1000, 2000]);
    await waitFor(() =>
      expect(cursorMarker(maps.b).getPosition()).toEqual([1000, 2000]),
    );
    expect(cursorMarker(maps.c).getPosition()).toEqual([1000, 2000]);

    fireEvent.pointerLeave(maps.a.current.getViewport());

    expect(cursorMarker(maps.b).getPosition()).toBeUndefined();
    expect(cursorMarker(maps.c).getPosition()).toBeUndefined();
  });

  test("unmounting the source clears the marker on the remaining members", async () => {
    const maps = {};
    const { rerender } = render(
      createLoadedComponent({
        children: dashboardOf([{ uuid: "a" }, { uuid: "b" }], maps),
      }),
    );
    expect(await screen.findByText("a ready")).toBeInTheDocument();
    expect(await screen.findByText("b ready")).toBeInTheDocument();

    await movePointer(maps.a, [1000, 2000]);
    await waitFor(() =>
      expect(cursorMarker(maps.b).getPosition()).toEqual([1000, 2000]),
    );

    const survivor = maps.b;
    rerender(
      createLoadedComponent({ children: dashboardOf([{ uuid: "b" }], maps) }),
    );

    expect(
      survivor.current.getOverlayById(LINKED_CURSOR_OVERLAY_ID).getPosition(),
    ).toBe(undefined);
  });

  test("a member whose projection differs from the group's pin receives no marker", async () => {
    const { maps } = await renderCursorDashboard([
      { uuid: "a" },
      { uuid: "b" },
      { uuid: "c" },
    ]);

    await act(async () => {
      maps.b.current.setView(
        new View({ projection: "EPSG:4326", center: [10, 20], zoom: 4 }),
      );
    });

    await movePointer(maps.a, [1000, 2000]);

    // `c` proves the publish actually landed, so `b`'s empty marker is the
    // projection guard rather than a frame that never flushed.
    await waitFor(() =>
      expect(cursorMarker(maps.c).getPosition()).toEqual([1000, 2000]),
    );
    expect(cursorMarker(maps.b).getPosition()).toBeUndefined();
  });

  test("a member whose projection differs from the group's pin publishes no coordinate", async () => {
    const { maps } = await renderCursorDashboard([
      { uuid: "a" },
      { uuid: "b" },
      { uuid: "c" },
    ]);

    // `a` marks its peers while it is still in step. That is what makes the
    // silence afterwards a retraction rather than a map that never published.
    await movePointer(maps.a, [1000, 2000]);
    await waitFor(() =>
      expect(cursorMarker(maps.b).getPosition()).toEqual([1000, 2000]),
    );
    expect(cursorMarker(maps.c).getPosition()).toEqual([1000, 2000]);

    // `b` and `c` keep the group pinned to the map projection, so `a` is now
    // the odd one out.
    await act(async () => {
      maps.a.current.setView(
        new View({ projection: "EPSG:4326", center: [10, 20], zoom: 4 }),
      );
    });

    // Its coordinates are lon/lat now. Publishing them would draw a mark
    // somewhere the pointer never was, so the move takes `a`'s mark down
    // instead -- the receive-side guard is a separate gate and cannot do this.
    await movePointer(maps.a, [11, 21]);
    await letAFramePass();

    expect(cursorMarker(maps.b).getPosition()).toBeUndefined();
    expect(cursorMarker(maps.c).getPosition()).toBeUndefined();
  });

  test("several pointermoves inside one frame produce a single position update", async () => {
    const { maps } = await renderCursorDashboard([
      { uuid: "a" },
      { uuid: "b" },
    ]);
    const setPosition = jest.spyOn(cursorMarker(maps.b), "setPosition");

    // Three synchronous dispatches cannot be separated by an animation frame.
    await act(async () => {
      maps.a.current.dispatchEvent({
        type: "pointermove",
        coordinate: [1, 2],
        pixel: [1, 1],
      });
      maps.a.current.dispatchEvent({
        type: "pointermove",
        coordinate: [3, 4],
        pixel: [2, 2],
      });
      maps.a.current.dispatchEvent({
        type: "pointermove",
        coordinate: [5, 6],
        pixel: [3, 3],
      });
    });

    await waitFor(() => expect(setPosition).toHaveBeenCalledTimes(1));
    await letAFramePass();
    // Only the last position of the frame is published.
    expect(setPosition.mock.calls).toEqual([[[5, 6]]]);
  });

  test("an ungrouped map on the same dashboard is never marked", async () => {
    const { maps } = await renderCursorDashboard([
      { uuid: "a" },
      { uuid: "b" },
      { uuid: "c", viewGroup: null },
    ]);

    await movePointer(maps.a, [1000, 2000]);
    await waitFor(() =>
      expect(cursorMarker(maps.b).getPosition()).toEqual([1000, 2000]),
    );
    await letAFramePass();

    expect(cursorMarker(maps.c).getPosition()).toBeUndefined();
  });

  test("entering draw mode on the source clears peers' markers rather than freezing them", async () => {
    const { maps } = await renderCursorDashboard([
      { uuid: "a", mapDrawing: { options: ["Point"] } },
      { uuid: "b" },
    ]);

    await movePointer(maps.a, [1000, 2000]);
    await waitFor(() =>
      expect(cursorMarker(maps.b).getPosition()).toEqual([1000, 2000]),
    );

    fireEvent.click(screen.getByTitle("Draw Point"));
    await movePointer(maps.a, [3000, 4000]);

    // The hover handler returns early while drawing; the cursor publisher must
    // actively retract instead, or the peer would sit on [1000, 2000] forever.
    expect(cursorMarker(maps.b).getPosition()).toBeUndefined();
    await letAFramePass();
    expect(cursorMarker(maps.b).getPosition()).toBeUndefined();
  });

  test("moving the pointer onto an open popup clears peers' markers rather than freezing them", async () => {
    const { maps } = await renderCursorDashboard([
      { uuid: "a" },
      { uuid: "b" },
    ]);

    await movePointer(maps.a, [1000, 2000]);
    await waitFor(() =>
      expect(cursorMarker(maps.b).getPosition()).toEqual([1000, 2000]),
    );

    const popupElement = popupOverlayOf(maps.a).getElement();
    await movePointer(maps.a, [3000, 4000], { target: popupElement });

    expect(cursorMarker(maps.b).getPosition()).toBeUndefined();
    await letAFramePass();
    expect(cursorMarker(maps.b).getPosition()).toBeUndefined();
  });

  test("a pointermove that carries no coordinate marks nothing on the peer", async () => {
    const { maps } = await renderCursorDashboard([
      { uuid: "a" },
      { uuid: "b" },
    ]);

    // OpenLayers computes `coordinate` from the frame state, so a map that has
    // not painted a frame yet hands the handler a null one. There is nothing
    // to mark, and the frame queued for it must flush without publishing.
    await movePointer(maps.a, null);
    await letAFramePass();

    expect(cursorMarker(maps.b).getPosition()).toBeUndefined();

    // ...and it left nothing wedged behind it: the next real move still marks.
    await movePointer(maps.a, [1000, 2000]);
    await waitFor(() =>
      expect(cursorMarker(maps.b).getPosition()).toEqual([1000, 2000]),
    );
  });

  test("a map rendered outside the dashboard's tab and view-group providers still works", async () => {
    // `Base` renders this component wherever a `map` visualization is asked
    // for. Only the dashboard tree carries a TabContext and a view-group
    // provider, so a map mounted outside one has to read the active tab off a
    // context that is not there -- and join no group.
    const maps = {};
    render(
      <AppContext.Provider value={{ sessionNonce: "test-nonce" }}>
        <LayoutContext.Provider value={{ uuid: "dashboard-uuid" }}>
          <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
            <VariableInputsContext.Provider
              value={{
                variableInputValues: {},
                variableInputDateFormats: {},
                setVariableInputValues: jest.fn(),
              }}
            >
              <MapContextProvider>
                <CursorMember uuid="solo" maps={maps} />
              </MapContextProvider>
            </VariableInputsContext.Provider>
          </DataViewerModeContext.Provider>
        </LayoutContext.Provider>
      </AppContext.Provider>,
    );

    expect(await screen.findByText("solo ready")).toBeInTheDocument();

    // The map is named a group, but with no provider above it there is no
    // group to join -- so the pointer publishes nowhere and marks nothing.
    await movePointer(maps.solo, [1000, 2000]);
    await letAFramePass();

    expect(cursorMarker(maps.solo).getPosition()).toBeUndefined();
  });

  test("a pointerleave arriving with a frame flush already queued leaves the marker hidden", async () => {
    const { maps } = await renderCursorDashboard([
      { uuid: "a" },
      { uuid: "b" },
    ]);

    await movePointer(maps.a, [1000, 2000]);
    await waitFor(() =>
      expect(cursorMarker(maps.b).getPosition()).toEqual([1000, 2000]),
    );

    // The move and the leave land in the same frame, so the leave has to cancel
    // the queued flush as well as publish the clear.
    act(() => {
      maps.a.current.dispatchEvent({
        type: "pointermove",
        coordinate: [9000, 9000],
        pixel: [9, 9],
      });
    });
    fireEvent.pointerLeave(maps.a.current.getViewport());

    expect(cursorMarker(maps.b).getPosition()).toBeUndefined();
    await letAFramePass();
    expect(cursorMarker(maps.b).getPosition()).toBeUndefined();
  });
});
