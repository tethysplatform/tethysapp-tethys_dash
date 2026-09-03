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
  listArrays
    .mockReset()
    .mockResolvedValue({ names: ["depth", "velocity"], enumerated: true });
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

  test("a whole-file route stays quiet past the metadata threshold and speaks at its own", async () => {
    // The constant inequality above says the thresholds differ; this says the
    // route actually uses its own. A GeoPackage read is a whole-file download,
    // so calling it slow at the metadata threshold would cry wolf on every one.
    jest.useFakeTimers();
    try {
      listGeoPackageTables.mockImplementation(() => new Promise(() => {}));
      const { result } = setup({
        sourceProps: { type: "GeoPackage", props: { url: "https://h/a.gpkg" } },
      });
      act(() => {
        result.current.load("layer");
      });
      await waitFor(() =>
        expect(result.current.discoveries.layer.state).toBe("loading"),
      );

      act(() => {
        jest.advanceTimersByTime(METADATA_SLOW_MS + 1);
      });
      expect(result.current.discoveries.layer.slow).toBe(false);

      act(() => {
        jest.advanceTimersByTime(WHOLE_FILE_SLOW_MS - METADATA_SLOW_MS);
      });
      await waitFor(() =>
        expect(result.current.discoveries.layer.slow).toBe(true),
      );
    } finally {
      jest.useRealTimers();
    }
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

describe("stale and out-of-range flagging", () => {
  const parquetProps = (props = {}) => ({
    type: "GeoParquet",
    props: { url: "https://host/data.parquet", ...props },
  });

  test("a saved value absent from the fetched list is flagged, and the value is untouched", async () => {
    const sourceProps = zarrProps({ variable: "salinity" });
    const { result } = setup({ sourceProps });
    await act(async () => result.current.load("variable"));

    expect(result.current.discoveries.variable.stale).toEqual(["salinity"]);
    // Reporting only: the hook hands back no writer, and the caller's props are
    // the same object it passed in.
    expect(sourceProps.props.variable).toBe("salinity");
  });

  test("a saved value present in the list is not flagged", async () => {
    const { result } = setup({ sourceProps: zarrProps({ variable: "depth" }) });
    await act(async () => result.current.load("variable"));

    expect(result.current.discoveries.variable.stale).toEqual([]);
  });

  test("a slice position beyond the array's slice count is out of range", async () => {
    readMetadata.mockResolvedValue({
      slice_count: 2,
      slice_labels: ["t0", "t1"],
    });
    const { result } = setup({
      sourceProps: zarrProps({ variable: "depth", index: "7" }),
    });
    await act(async () => result.current.load("index"));

    expect(result.current.discoveries.index.stale).toEqual(["7"]);
    expect(result.current.discoveries.index.sliceCount).toBe(2);
  });

  test("a slice position within range is not flagged", async () => {
    const { result } = setup({
      sourceProps: zarrProps({ variable: "depth", index: "1" }),
    });
    await act(async () => result.current.load("index"));

    expect(result.current.discoveries.index.stale).toEqual([]);
  });

  test("a two-dimensional array offers only position zero, so any other saved position is flagged", async () => {
    // zarrReader collapses a 2D [y, x] array to a single slice, and refuses to
    // read any index but 0 from one - so this flag matches what a render would
    // actually do.
    readMetadata.mockResolvedValue({ slice_count: 1, slice_labels: ["0"] });
    const { result, rerender } = setup({
      sourceProps: zarrProps({ variable: "depth", index: "3" }),
    });
    await act(async () => result.current.load("index"));
    expect(result.current.discoveries.index.stale).toEqual(["3"]);

    rerender({
      sourceProps: zarrProps({ variable: "depth", index: "0" }),
      variableInputValues: {},
      variableInputDateFormats: {},
    });
    expect(result.current.discoveries.index.stale).toEqual([]);
  });

  test("changing the array leaves the slice in place, and flags only once the new list has loaded", async () => {
    readMetadata.mockResolvedValue({
      slice_count: 8,
      slice_labels: Array.from({ length: 8 }, (_, i) => `t${i}`),
    });
    const { result, rerender } = setup({
      sourceProps: zarrProps({ variable: "depth", index: "5" }),
    });
    await act(async () => result.current.load("index"));
    expect(result.current.discoveries.index.stale).toEqual([]);

    // The new array is shorter. The slice the author chose is left alone.
    let release;
    readMetadata.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ slice_count: 2, slice_labels: ["a", "b"] });
        }),
    );
    rerender({
      sourceProps: zarrProps({ variable: "velocity", index: "5" }),
      variableInputValues: {},
      variableInputDateFormats: {},
    });

    let pending;
    act(() => {
      pending = result.current.load("index");
    });
    // Mid-read there is no answer yet, so claiming the value is missing would
    // be a guess.
    expect(result.current.discoveries.index.state).toBe("loading");
    expect(result.current.discoveries.index.stale).toEqual([]);

    await act(async () => {
      release();
      await pending;
    });
    expect(result.current.discoveries.index.stale).toEqual(["5"]);
  });

  test("a templated value is never flagged, on either check", async () => {
    const { result: named } = setup({
      // eslint-disable-next-line no-template-curly-in-string
      sourceProps: zarrProps({ variable: "${Chosen Variable}" }),
      variableInputValues: { "Chosen Variable": "depth" },
    });
    await act(async () => named.current.load("variable"));
    expect(named.current.discoveries.variable.stale).toEqual([]);

    const { result: positioned } = setup({
      // eslint-disable-next-line no-template-curly-in-string
      sourceProps: zarrProps({ variable: "depth", index: "${Step}" }),
      variableInputValues: { Step: "1" },
    });
    await act(async () => positioned.current.load("index"));
    expect(positioned.current.discoveries.index.stale).toEqual([]);
  });

  test("a multi-value argument names the absent entry and leaves its siblings alone", async () => {
    listGeoParquetColumns.mockResolvedValue(["elev", "slope"]);
    const { result } = setup({
      sourceProps: parquetProps({ columns: "elev,aspect,slope" }),
    });
    await act(async () => result.current.load("columns"));

    expect(result.current.discoveries.columns.stale).toEqual(["aspect"]);
  });

  test("a multi-value argument whose entries are all present is not flagged", async () => {
    listGeoParquetColumns.mockResolvedValue(["elev", "slope"]);
    const { result } = setup({
      sourceProps: parquetProps({ columns: "elev, slope" }),
    });
    await act(async () => result.current.load("columns"));

    expect(result.current.discoveries.columns.stale).toEqual([]);
  });

  test("one templated entry among several is exempt without exempting its siblings", async () => {
    listGeoParquetColumns.mockResolvedValue(["elev"]);
    const { result } = setup({
      // eslint-disable-next-line no-template-curly-in-string
      sourceProps: parquetProps({ columns: "elev,${Extra Column},aspect" }),
      variableInputValues: { "Extra Column": "slope" },
    });
    await act(async () => result.current.load("columns"));

    expect(result.current.discoveries.columns.stale).toEqual(["aspect"]);
  });

  test("nothing is flagged before a read, or after one that failed", async () => {
    const { result } = setup({ sourceProps: zarrProps({ variable: "nope" }) });
    expect(result.current.discoveries.variable.state).toBe("idle");
    expect(result.current.discoveries.variable.stale).toEqual([]);

    listArrays.mockRejectedValue(new TypeError("Failed to fetch"));
    await act(async () => result.current.load("variable"));
    expect(result.current.discoveries.variable.state).toBe("failed");
    expect(result.current.discoveries.variable.stale).toEqual([]);
  });
});

// Every case below is a bug a reviewer found in this hook. They are kept
// together so the reasons stay attached to the behavior they pin.
describe("regressions found in review", () => {
  test("a store that cannot be enumerated does not accuse a saved value", async () => {
    // listArrays answers with no names both for a store that holds none and for
    // one without consolidated metadata. Only the first can say a name is gone;
    // treating the second the same way told authors their working variable had
    // vanished, on the most common kind of Zarr store there is.
    listArrays.mockResolvedValue({ names: [], enumerated: false });
    const { result } = setup({ sourceProps: zarrProps({ variable: "depth" }) });
    await act(async () => result.current.load("variable"));

    expect(result.current.discoveries.variable.state).toBe("empty");
    expect(result.current.discoveries.variable.enumerated).toBe(false);
    expect(result.current.discoveries.variable.stale).toEqual([]);
  });

  test("a store that was enumerated and holds nothing still flags a saved value", async () => {
    listArrays.mockResolvedValue({ names: [], enumerated: true });
    const { result } = setup({ sourceProps: zarrProps({ variable: "depth" }) });
    await act(async () => result.current.load("variable"));

    expect(result.current.discoveries.variable.state).toBe("empty");
    expect(result.current.discoveries.variable.stale).toEqual(["depth"]);
  });

  test("editing the url drops the previous store's options and its warning", async () => {
    listArrays.mockResolvedValue({ names: ["depth"], enumerated: true });
    const { result, rerender } = setup({
      sourceProps: zarrProps({ variable: "salinity" }),
    });
    await act(async () => result.current.load("variable"));
    expect(result.current.discoveries.variable.stale).toEqual(["salinity"]);

    // A url edit starts no read - the next menu open does. Until then the old
    // store's answer must not be shown against an address it never described.
    rerender({
      sourceProps: {
        type: "Zarr",
        props: { url: "https://host/other.zarr", variable: "salinity" },
      },
      variableInputValues: {},
      variableInputDateFormats: {},
    });

    expect(result.current.discoveries.variable.state).toBe("idle");
    expect(result.current.discoveries.variable.options).toEqual([]);
    expect(result.current.discoveries.variable.stale).toEqual([]);
  });

  test("a superseded read does not cancel the slow timer of the read that replaced it", async () => {
    jest.useFakeTimers();
    try {
      let settleFirst;
      listArrays.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            settleFirst = () => resolve({ names: ["depth"], enumerated: true });
          }),
      );
      listArrays.mockImplementationOnce(() => new Promise(() => {}));

      const { result, rerender } = setup();
      act(() => {
        result.current.load("variable");
      });

      // Supersede it: a new url means a new key, so the first read is abandoned.
      rerender({
        sourceProps: {
          type: "Zarr",
          props: { url: "https://host/second.zarr" },
        },
        variableInputValues: {},
        variableInputDateFormats: {},
      });
      act(() => {
        result.current.load("variable");
      });

      // The abandoned read settles. Its finally block runs, and used to clear
      // the timer belonging to the read that replaced it.
      await act(async () => {
        settleFirst();
        await Promise.resolve();
      });

      act(() => {
        jest.advanceTimersByTime(METADATA_SLOW_MS + 1);
      });
      expect(result.current.discoveries.variable.slow).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  test("a variable input holding 0 still resolves a url the renderer would resolve", async () => {
    // updateObjectWithVariableInputs substitutes with `?? ""`, so it keeps 0.
    // Testing falsiness here refused to read a url that renders perfectly well.
    const { result } = setup({
      // eslint-disable-next-line no-template-curly-in-string
      sourceProps: { type: "Zarr", props: { url: "https://host/${Run}.zarr" } },
      variableInputValues: { Run: 0 },
    });
    await act(async () => result.current.load("variable"));

    expect(listArrays).toHaveBeenCalledWith({ url: "https://host/0.zarr" });
    expect(result.current.discoveries.variable.state).toBe("ready");
  });

  test("an unresolved sibling is reported as such, not as a missing url", async () => {
    const { result } = setup({
      sourceProps: zarrProps({ variable: "" }),
    });
    await act(async () => result.current.load("index"));

    expect(result.current.discoveries.index.state).toBe("nokey");
    expect(result.current.discoveries.index.blockedBy).toEqual({
      reason: "dependency",
      missingSibling: "variable",
    });
  });

  test("a missing url is reported as a missing url", async () => {
    const { result } = setup({
      sourceProps: { type: "Zarr", props: { url: "" } },
    });
    await act(async () => result.current.load("variable"));

    expect(result.current.discoveries.variable.blockedBy).toEqual({
      reason: "url",
    });
  });

  test("a read still in flight when the hook unmounts leaves no timer behind", async () => {
    jest.useFakeTimers();
    try {
      listArrays.mockImplementation(() => new Promise(() => {}));
      const { result, unmount } = setup();
      act(() => {
        result.current.load("variable");
      });
      unmount();
      // The slow timer would otherwise fire into a hook that is gone.
      expect(() =>
        act(() => {
          jest.advanceTimersByTime(METADATA_SLOW_MS * 2);
        }),
      ).not.toThrow();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("failure classification", () => {
  test("an unregistered projection is permanent, not a transfer problem", () => {
    // The file will declare the same projection on every retry, so offering a
    // re-read (with CORS advice under it) sends the author back for an
    // identical failure.
    const failure = failureFromError(
      new Error(
        'GeoPackage layer declares projection "EPSG:9999", which is not registered.',
      ),
    );
    expect(failure.stage).toBe("input");
  });

  test("an opaque transfer failure stays retryable", () => {
    expect(failureFromError(new TypeError("Failed to fetch")).stage).toBe(
      "fetch",
    );
  });
});
