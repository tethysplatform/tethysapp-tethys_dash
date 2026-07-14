import { renderHook } from "@testing-library/react";
import Feature from "ol/Feature";
import { LineString } from "ol/geom";
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
