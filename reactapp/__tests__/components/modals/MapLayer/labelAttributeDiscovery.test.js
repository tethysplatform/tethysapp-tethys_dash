import { act, renderHook, waitFor } from "@testing-library/react";
import {
  useLabelAttributeDiscovery,
  DISCOVERY_TIMEOUT_MS,
} from "components/modals/MapLayer/labelAttributeDiscovery";
import { getLayerAttributes } from "components/map/utilities";

// Mocked at the module boundary, the way the other MapLayer discovery tests
// mock their readers.
jest.mock("components/map/utilities", () => ({
  ...jest.requireActual("components/map/utilities"),
  getLayerAttributes: jest.fn(),
}));

const geojsonSource = {
  type: "GeoJSON",
  props: { url: "https://example.org/gauges.geojson" },
};

beforeEach(() => {
  jest.clearAllMocks();
});

const setup = (overrides = {}) =>
  renderHook((props) => useLabelAttributeDiscovery(props), {
    initialProps: {
      sourceProps: geojsonSource,
      layerName: "Gauges",
      dynamicMapLayers: [],
      shapefileDiscovery: null,
      ...overrides,
    },
  });

test("does not read anything until the author opens the list", () => {
  const { result } = setup();

  expect(getLayerAttributes).not.toHaveBeenCalled();
  expect(result.current.state).toBe("idle");
});

test("opening twice against the same source reads once", async () => {
  getLayerAttributes.mockResolvedValue({
    Gauges: [{ name: "station", alias: "Station" }],
  });
  const { result } = setup();

  act(() => result.current.open());
  await waitFor(() => expect(result.current.state).toBe("ready"));

  act(() => result.current.open());
  await waitFor(() => expect(result.current.state).toBe("ready"));

  expect(getLayerAttributes).toHaveBeenCalledTimes(1);
  expect(result.current.fields).toEqual([
    { name: "station", alias: "Station" },
  ]);
});

test("changing the source invalidates the previous read", async () => {
  getLayerAttributes.mockResolvedValue({ Gauges: [{ name: "a", alias: "a" }] });
  const { result, rerender } = setup();

  act(() => result.current.open());
  await waitFor(() => expect(result.current.state).toBe("ready"));

  rerender({
    sourceProps: {
      type: "GeoJSON",
      props: { url: "https://example.org/other.geojson" },
    },
    layerName: "Gauges",
    dynamicMapLayers: [],
    shapefileDiscovery: null,
  });

  await waitFor(() => expect(result.current.state).toBe("idle"));
  act(() => result.current.open());
  await waitFor(() => expect(getLayerAttributes).toHaveBeenCalledTimes(2));
});

test("a read failure reports the reason and can be retried", async () => {
  getLayerAttributes.mockRejectedValueOnce(
    new Error("GeoPackage is not currently configured to be queried"),
  );
  const { result } = setup();

  act(() => result.current.open());
  await waitFor(() => expect(result.current.state).toBe("failed"));
  expect(result.current.error).toMatch(/not currently configured/);
  expect(result.current.fields).toEqual([]);

  // A failure is not cached -- reopening retries rather than repeating the
  // error forever.
  getLayerAttributes.mockResolvedValueOnce({ Gauges: [{ name: "b" }] });
  act(() => result.current.open());
  await waitFor(() => expect(result.current.state).toBe("ready"));
  expect(getLayerAttributes).toHaveBeenCalledTimes(2);
});

test("an empty attribute list is a ready state, not a failure", async () => {
  getLayerAttributes.mockResolvedValue({ Gauges: [] });
  const { result } = setup();

  act(() => result.current.open());
  await waitFor(() => expect(result.current.state).toBe("ready"));
  expect(result.current.fields).toEqual([]);
  expect(result.current.error).toBeNull();
});

test("a shapefile source delegates to the shapefile reader instead", () => {
  const load = jest.fn();
  const { result } = setup({
    shapefileDiscovery: {
      isShapefile: true,
      state: "ready",
      fields: ["station", "elevation"],
      failure: null,
      load,
    },
  });

  act(() => result.current.open());

  // getLayerAttributes throws for shapefiles, which is why the separate reader
  // exists -- this path must never reach it.
  expect(getLayerAttributes).not.toHaveBeenCalled();
  expect(load).toHaveBeenCalledTimes(1);
  expect(result.current.state).toBe("ready");
  expect(result.current.fields).toEqual([
    { name: "station", alias: "station" },
    { name: "elevation", alias: "elevation" },
  ]);
});

test("a shapefile failure is surfaced as a string, not the reader's failure object", () => {
  // The pane renders this value as text. Handing it `{detail, remedy}` throws
  // "Objects are not valid as a React child" and takes down the editor.
  const { result } = setup({
    shapefileDiscovery: {
      isShapefile: true,
      state: "error",
      fields: [],
      failure: { detail: "Could not fetch the .dbf sidecar.", remedy: null },
      load: jest.fn(),
    },
  });

  expect(result.current.state).toBe("failed");
  expect(typeof result.current.error).toBe("string");
  expect(result.current.error).toBe("Could not fetch the .dbf sidecar.");
});

test("a shapefile failure with no detail still yields a renderable string", () => {
  const { result } = setup({
    shapefileDiscovery: {
      isShapefile: true,
      state: "error",
      fields: [],
      failure: { remedy: null },
      load: jest.fn(),
    },
  });

  expect(typeof result.current.error).toBe("string");
  expect(result.current.error).toMatch(/Could not read/);
});

test("a read that never settles times out and becomes retryable", async () => {
  jest.useFakeTimers();
  try {
    // Never resolves -- the hang this guard exists for.
    getLayerAttributes.mockImplementation(() => new Promise(() => {}));
    const { result } = setup();

    act(() => result.current.open());
    expect(result.current.state).toBe("loading");

    await act(async () => {
      jest.advanceTimersByTime(DISCOVERY_TIMEOUT_MS + 1);
    });

    expect(result.current.state).toBe("failed");
    expect(result.current.error).toMatch(/Timed out/);
  } finally {
    jest.useRealTimers();
  }
});

test("a source change mid-flight discards the in-flight result", async () => {
  let resolveFirst;
  getLayerAttributes.mockImplementationOnce(
    () => new Promise((resolve) => (resolveFirst = resolve)),
  );
  const { result, rerender } = setup();

  act(() => result.current.open());
  expect(result.current.state).toBe("loading");

  rerender({
    sourceProps: {
      type: "GeoJSON",
      props: { url: "https://example.org/different.geojson" },
    },
    layerName: "Gauges",
    dynamicMapLayers: [],
    shapefileDiscovery: null,
  });

  // The first request resolves after the source already changed. Its result
  // belongs to a source the author is no longer editing.
  await act(async () => {
    resolveFirst({ Gauges: [{ name: "stale", alias: "stale" }] });
  });

  expect(result.current.state).toBe("idle");
  expect(result.current.fields).toEqual([]);
});
