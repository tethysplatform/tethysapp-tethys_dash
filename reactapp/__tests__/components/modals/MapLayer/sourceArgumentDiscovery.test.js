import { act, renderHook, waitFor } from "@testing-library/react";
import useSourceArgumentDiscovery, {
  discoverableArguments,
  failureFromError,
  METADATA_SLOW_MS,
  WHOLE_FILE_SLOW_MS,
  TRANSFER_REMEDY,
} from "components/modals/MapLayer/sourceArgumentDiscovery";
import { listArrays, readMetadata } from "components/map/zarrReader";
import { sourcePropertiesOptions } from "components/map/utilities";
import {
  s3UrlToHttps,
  listGeoPackageTables,
  invalidateGeoPackageTables,
  listGeoParquetColumns,
  invalidateGeoParquetColumns,
} from "components/map/ModuleLoader";

// The readers are mocked at the module boundary, which is how the MapLayer
// suites mock network throughout. Nothing here should reach a real fetch.
jest.mock("components/map/zarrReader", () => ({
  listArrays: jest.fn(),
  readMetadata: jest.fn(),
}));
jest.mock("components/map/ModuleLoader", () => ({
  s3UrlToHttps: jest.fn(),
  listGeoPackageTables: jest.fn(),
  invalidateGeoPackageTables: jest.fn(),
  listGeoParquetColumns: jest.fn(),
  invalidateGeoParquetColumns: jest.fn(),
}));

const zarrProps = (props = {}) => ({
  type: "Zarr",
  props: { url: "https://host/store.zarr", ...props },
});

const setup = (overrides = {}) =>
  renderHook((props) => useSourceArgumentDiscovery(props), {
    initialProps: {
      sourceProps: zarrProps(),
      variableInputValues: {},
      variableInputDateFormats: {},
      ...overrides,
    },
  });

beforeEach(() => {
  // `resetMocks: true` is on globally, which wipes implementations installed in
  // a jest.mock factory. Every default has to be reinstalled here or the first
  // assertion in each test measures an undefined return.
  s3UrlToHttps
    .mockReset()
    .mockImplementation((url) =>
      typeof url === "string" && url.startsWith("s3://")
        ? url.replace("s3://", "https://s3.amazonaws.com/")
        : url,
    );
  listArrays.mockReset().mockResolvedValue(["depth", "velocity"]);
  readMetadata
    .mockReset()
    .mockResolvedValue({ slice_count: 2, slice_labels: ["t0", "t1"] });
  listGeoPackageTables.mockReset().mockResolvedValue(["streams"]);
  listGeoParquetColumns.mockReset().mockResolvedValue(["elev"]);
  invalidateGeoPackageTables.mockReset();
  invalidateGeoParquetColumns.mockReset();
});

describe("discoverableArguments", () => {
  test("reads declarations off the registry rather than a hardcoded list", () => {
    expect(discoverableArguments("Zarr").map((a) => a.argument)).toEqual([
      "variable",
      "index",
    ]);
    expect(discoverableArguments("GeoPackage").map((a) => a.argument)).toEqual([
      "layer",
    ]);
    expect(discoverableArguments("GeoParquet").map((a) => a.argument)).toEqual([
      "columns",
    ]);
  });

  test("a source declaring nothing discoverable yields nothing", () => {
    expect(discoverableArguments("WMS")).toEqual([]);
    expect(discoverableArguments("nope")).toEqual([]);
  });

  test("carries the declared dependency so the key rule need not hardcode it", () => {
    const index = discoverableArguments("Zarr").find(
      (a) => a.argument === "index",
    );
    expect(index.discover.dependsOn).toEqual(["variable"]);
  });
});

describe("failureFromError", () => {
  test("a missing named entry is permanent input, not a transfer problem", () => {
    expect(failureFromError(new Error("variable 'x' not found")).stage).toBe(
      "input",
    );
  });

  test("an unreadable file is a permanent parse failure", () => {
    expect(failureFromError(new Error("invalid parquet file")).stage).toBe(
      "parse",
    );
  });

  test("an opaque browser rejection falls through to the retryable kind", () => {
    expect(failureFromError(new TypeError("Failed to fetch")).stage).toBe(
      "fetch",
    );
  });
});

describe("useSourceArgumentDiscovery", () => {
  test("does not read on mount, and not when the url changes", async () => {
    const { rerender } = setup();
    rerender({
      sourceProps: zarrProps({ url: "https://host/other.zarr" }),
      variableInputValues: {},
      variableInputDateFormats: {},
    });
    expect(listArrays).not.toHaveBeenCalled();
  });

  test("reads once the control asks, and reports the values", async () => {
    const { result } = setup();
    await act(async () => result.current.load("variable"));
    expect(listArrays).toHaveBeenCalledTimes(1);
    expect(result.current.discoveries.variable.state).toBe("ready");
    expect(result.current.discoveries.variable.options).toEqual([
      { value: "depth", label: "depth" },
      { value: "velocity", label: "velocity" },
    ]);
  });

  test("a second load for the same key is served from memory", async () => {
    const { result } = setup();
    await act(async () => result.current.load("variable"));
    await act(async () => result.current.load("variable"));
    expect(listArrays).toHaveBeenCalledTimes(1);
  });

  test("changing the url makes the next load read again", async () => {
    const { result, rerender } = setup();
    await act(async () => result.current.load("variable"));
    rerender({
      sourceProps: zarrProps({ url: "https://host/other.zarr" }),
      variableInputValues: {},
      variableInputDateFormats: {},
    });
    await act(async () => result.current.load("variable"));
    expect(listArrays).toHaveBeenCalledTimes(2);
  });

  test("changing the chosen array re-reads slices though the url is unchanged", async () => {
    const { result, rerender } = setup({
      sourceProps: zarrProps({ variable: "depth" }),
    });
    await act(async () => result.current.load("index"));
    rerender({
      sourceProps: zarrProps({ variable: "velocity" }),
      variableInputValues: {},
      variableInputDateFormats: {},
    });
    await act(async () => result.current.load("index"));
    expect(readMetadata).toHaveBeenCalledTimes(2);
    expect(readMetadata.mock.calls[1][0].variable).toBe("velocity");
  });

  test("slices are offered by label while storing the position", async () => {
    const { result } = setup({ sourceProps: zarrProps({ variable: "depth" }) });
    await act(async () => result.current.load("index"));
    expect(result.current.discoveries.index.options).toEqual([
      { value: "0", label: "t0" },
      { value: "1", label: "t1" },
    ]);
  });

  test("a read superseded by a key change does not publish", async () => {
    let release;
    listArrays.mockImplementationOnce(
      () => new Promise((resolve) => (release = resolve)),
    );
    const { result, rerender } = setup();
    let pending;
    act(() => {
      pending = result.current.load("variable");
    });
    rerender({
      sourceProps: zarrProps({ url: "https://host/other.zarr" }),
      variableInputValues: {},
      variableInputDateFormats: {},
    });
    await act(async () => {
      release(["stale"]);
      await pending;
    });
    expect(result.current.discoveries.variable.options).not.toEqual([
      { value: "stale", label: "stale" },
    ]);
  });

  test("a read that settles after a source-type switch does not publish", async () => {
    let release;
    listArrays.mockImplementationOnce(
      () => new Promise((resolve) => (release = resolve)),
    );
    const { result, rerender } = setup();
    let pending;
    act(() => {
      pending = result.current.load("variable");
    });
    rerender({
      sourceProps: {
        type: "GeoPackage",
        props: { url: "https://host/a.gpkg" },
      },
      variableInputValues: {},
      variableInputDateFormats: {},
    });
    await act(async () => {
      release(["late"]);
      await pending;
    });
    expect(result.current.discoveries.variable).toBeUndefined();
    expect(result.current.discoveries.layer.state).toBe("idle");
  });

  test("a successful read with no values is empty, not failed", async () => {
    listArrays.mockResolvedValue([]);
    const { result } = setup();
    await act(async () => result.current.load("variable"));
    expect(result.current.discoveries.variable.state).toBe("empty");
    expect(result.current.discoveries.variable.failure).toBeNull();
  });

  test("a transfer failure is retryable and names both likely causes", async () => {
    listArrays.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = setup();
    await act(async () => result.current.load("variable"));
    const entry = result.current.discoveries.variable;
    expect(entry.state).toBe("failed");
    expect(entry.retryable).toBe(true);
    expect(entry.failure.remedy).toBe(TRANSFER_REMEDY);
  });

  test("a permanent failure is not offered a retry", async () => {
    listArrays.mockRejectedValue(new Error("invalid zarr store"));
    const { result } = setup();
    await act(async () => result.current.load("variable"));
    expect(result.current.discoveries.variable.retryable).toBe(false);
    expect(result.current.discoveries.variable.failure.remedy).toBeNull();
  });

  test("a read past its threshold reports slow, and the threshold differs by route", async () => {
    expect(METADATA_SLOW_MS).toBeLessThan(WHOLE_FILE_SLOW_MS);
    jest.useFakeTimers();
    listArrays.mockImplementation(() => new Promise(() => {}));
    const { result } = setup();
    act(() => {
      result.current.load("variable");
    });
    await waitFor(() =>
      expect(result.current.discoveries.variable.state).toBe("loading"),
    );
    expect(result.current.discoveries.variable.slow).toBe(false);
    act(() => {
      jest.advanceTimersByTime(METADATA_SLOW_MS + 1);
    });
    await waitFor(() =>
      expect(result.current.discoveries.variable.slow).toBe(true),
    );
    jest.useRealTimers();
  });

  test("a templated url is resolved against current values before reading", async () => {
    const { result } = setup({
      // eslint-disable-next-line no-template-curly-in-string
      sourceProps: zarrProps({ url: "https://host/${Storm}.zarr" }),
      variableInputValues: { Storm: "ida" },
    });
    await act(async () => result.current.load("variable"));
    expect(listArrays).toHaveBeenCalledWith({ url: "https://host/ida.zarr" });
  });

  test("an s3 url is normalized so discovery targets what the renderer targets", async () => {
    const { result } = setup({
      sourceProps: zarrProps({ url: "s3://bucket/store.zarr" }),
    });
    await act(async () => result.current.load("variable"));
    expect(listArrays).toHaveBeenCalledWith({
      url: "https://s3.amazonaws.com/bucket/store.zarr",
    });
  });

  test("no url means no key and no read", async () => {
    const { result } = setup({ sourceProps: { type: "Zarr", props: {} } });
    await act(async () => result.current.load("variable"));
    expect(listArrays).not.toHaveBeenCalled();
    expect(result.current.discoveries.variable.state).toBe("nokey");
  });

  test("a url whose template cannot be resolved reports no key rather than reading", async () => {
    const { result } = setup({
      // eslint-disable-next-line no-template-curly-in-string
      sourceProps: zarrProps({ url: "https://host/${Missing}.zarr" }),
    });
    await act(async () => result.current.load("variable"));
    expect(listArrays).not.toHaveBeenCalled();
    expect(result.current.discoveries.variable.state).toBe("nokey");
  });

  test("an unresolved dependency reports no key instead of reading the literal", async () => {
    const { result } = setup({
      // eslint-disable-next-line no-template-curly-in-string
      sourceProps: zarrProps({ variable: "${Layer}" }),
    });
    await act(async () => result.current.load("index"));
    expect(readMetadata).not.toHaveBeenCalled();
    expect(result.current.discoveries.index.state).toBe("nokey");
  });

  test("a forced re-read discards the memo and reads again", async () => {
    const { result } = setup();
    await act(async () => result.current.load("variable"));
    await act(async () => result.current.refresh("variable"));
    expect(listArrays).toHaveBeenCalledTimes(2);
  });

  test("a forced re-read also invalidates the reader's own cache", async () => {
    const { result } = setup({
      sourceProps: {
        type: "GeoPackage",
        props: { url: "https://host/a.gpkg" },
      },
    });
    await act(async () => result.current.load("layer"));
    await act(async () => result.current.refresh("layer"));
    expect(invalidateGeoPackageTables).toHaveBeenCalledWith(
      "https://host/a.gpkg",
    );
  });

  test("the GeoParquet route invalidates its own cache too", async () => {
    const { result } = setup({
      sourceProps: {
        type: "GeoParquet",
        props: { url: "https://host/a.parquet" },
      },
    });
    await act(async () => result.current.load("columns"));
    await act(async () => result.current.refresh("columns"));
    expect(invalidateGeoParquetColumns).toHaveBeenCalledWith(
      "https://host/a.parquet",
    );
  });

  test("an unknown route fails loudly rather than showing an empty menu", async () => {
    // A declaration naming a route nothing implements must not degrade to an
    // empty menu, which reads as "this source offers nothing" - the one state
    // it must never be confused with.
    const variable = sourcePropertiesOptions.Zarr.required.variable;
    const original = variable.discover;
    variable.discover = { route: "nope" };
    try {
      const { result } = setup();
      await expect(
        act(async () => result.current.load("variable")),
      ).rejects.toThrow(/No discovery route named "nope"/);
    } finally {
      variable.discover = original;
    }
  });
});
