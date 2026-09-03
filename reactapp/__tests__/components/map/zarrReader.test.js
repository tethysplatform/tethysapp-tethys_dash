import { readSlice, readMetadata, listArrays } from "components/map/zarrReader";

// zarrita is mocked with a synthetic in-memory store keyed by the exact URL
// zarrReader builds (group at the root, arrays at `${root}/${name}`). Node shape:
//   group: { attrs }                          array: { shape, data (full, flat) }
// `v2only` nodes throw from open.v3 so the v3->v2 fallback path is exercised.
// `mock`-prefixed so jest's mock hoisting allows the factory to close over it.
let mockNodes = {};
// What a listable store enumerates, for the listArrays suite below.
let mockContents = [];
const mockRequestFor = (url) => new Request(url);
jest.mock("zarrita", () => ({
  FetchStore: function (url, options) {
    this.url = url;
    // The real FetchStore keeps its fetch handler private. Exposing it lets the
    // consolidated wrapper below go through zarrReader's own fetch override,
    // where the timeout and the 403 -> 404 remap live, instead of stubbing past
    // them.
    this.fetch = options?.fetch;
  },
  open: {
    v3: async (store) => {
      const node = mockNodes[store.url];
      if (!node || node.v2only) throw new Error("v3 not found");
      return node;
    },
    v2: async (store) => {
      const node = mockNodes[store.url];
      if (!node) throw new Error("v2 not found");
      return node;
    },
  },
  get: async (node, selection) => {
    if (node.shape.length === 3) {
      const [index] = selection;
      const h = node.shape[1];
      const w = node.shape[2];
      const start = index * h * w;
      return { data: node.data.slice(start, start + h * w), shape: [h, w] };
    }
    return { data: node.data, shape: node.shape };
  },
  // Models the real wrapper closely enough to test what zarrReader depends on:
  // it reads the consolidated-metadata key through the store's own fetch, hands
  // back the ORIGINAL, UNWRAPPED store (no `contents()`) when that key is
  // missing, and lets any other failing status escape as a plain Error it does
  // not swallow.
  withMaybeConsolidatedMetadata: async (store) => {
    const response = await store.fetch(
      mockRequestFor(`${store.url}/.zmetadata`),
    );
    if (response.status === 404) return store;
    if (response.status !== 200) {
      throw new Error(`Unexpected response status ${response.status}`);
    }
    return { ...store, contents: () => mockContents };
  },
}));

const CRS = "EPSG:3857";
const TRANSFORM = [5, 0, -100, 0, -5, 200]; // 5m pixels, origin (-100, 200)
const ROOT = "https://x/store.zarr";

beforeEach(() => {
  mockNodes = {};
  mockContents = [];
});

function setStore(nodes) {
  mockNodes = nodes;
}

describe("readSlice", () => {
  it("slices a 3D grid, masks nodata/below-threshold, and derives extent + stats", async () => {
    const data = new Float32Array(3 * 4 * 5).fill(1); // slice 0 = mostly 1.0
    data[0] = 2.5; // [0,0] visible max
    data[6] = 0.01; // [1,1] <= extent_threshold_m -> masked
    data[12] = -9999; // [2,2] === source_nodata -> masked
    setStore({
      [ROOT]: {
        attrs: {
          crs: CRS,
          transform: TRANSFORM,
          extent_threshold_m: 0.05,
          source_nodata: -9999,
        },
      },
      [`${ROOT}/depth`]: { shape: [3, 4, 5], data },
    });

    const r = await readSlice({ url: ROOT, variable: "depth", index: 0 });

    expect(r.width).toBe(5);
    expect(r.height).toBe(4);
    expect(r.crs).toBe(CRS);
    expect(r.extent).toEqual([-100, 180, -75, 200]);
    expect(r.data).toHaveLength(5 * 4 * 2);
    expect([r.data[0], r.data[1]]).toEqual([2.5, 1]); // visible: value + alpha 1
    expect([r.data[12], r.data[13]]).toEqual([0, 0]); // below threshold -> masked
    expect([r.data[24], r.data[25]]).toEqual([0, 0]); // source nodata -> masked
    expect(r.min).toBe(1);
    expect(r.max).toBe(2.5);
  });

  it("selects the requested slice index", async () => {
    const data = new Float32Array(3 * 4 * 5).fill(1);
    data.fill(7, 20, 40); // slice 1 all 7.0
    setStore({
      [ROOT]: { attrs: { crs: CRS, transform: TRANSFORM } },
      [`${ROOT}/depth`]: { shape: [3, 4, 5], data },
    });

    const r = await readSlice({ url: ROOT, variable: "depth", index: 1 });

    expect(r.min).toBe(7);
    expect(r.max).toBe(7);
    expect(r.data[1]).toBe(1); // unmasked (no threshold/nodata declared)
  });

  it("reads a 2D grid and rejects a non-zero index", async () => {
    setStore({
      [ROOT]: { attrs: { crs: CRS, transform: TRANSFORM } },
      [`${ROOT}/depth2d`]: {
        shape: [4, 5],
        data: new Float32Array(20).fill(3),
      },
    });

    const r = await readSlice({ url: ROOT, variable: "depth2d" });
    expect(r.width).toBe(5);
    expect(r.min).toBe(3);

    await expect(
      readSlice({ url: ROOT, variable: "depth2d", index: 1 }),
    ).rejects.toThrow("single slice");
  });

  it("rejects an out-of-range 3D index", async () => {
    setStore({
      [ROOT]: { attrs: { crs: CRS, transform: TRANSFORM } },
      [`${ROOT}/depth`]: { shape: [3, 4, 5], data: new Float32Array(60) },
    });
    await expect(
      readSlice({ url: ROOT, variable: "depth", index: 5 }),
    ).rejects.toThrow("out of range");
  });

  it("throws when the store cannot be georeferenced", async () => {
    setStore({
      [ROOT]: { attrs: { crs: CRS } }, // no transform
      [`${ROOT}/depth`]: { shape: [3, 4, 5], data: new Float32Array(60) },
    });
    await expect(readSlice({ url: ROOT, variable: "depth" })).rejects.toThrow(
      "missing 'transform'",
    );
  });

  it("falls back to zarr v2 when v3 open fails", async () => {
    setStore({
      [ROOT]: { v2only: true, attrs: { crs: CRS, transform: TRANSFORM } },
      [`${ROOT}/depth`]: {
        v2only: true,
        shape: [4, 5],
        data: new Float32Array(20).fill(2),
      },
    });
    const r = await readSlice({ url: ROOT, variable: "depth" });
    expect(r.extent).toEqual([-100, 180, -75, 200]);
    expect(r.max).toBe(2);
  });
});

describe("readMetadata", () => {
  it("returns variables, slice count/labels, crs, grid shape and extent", async () => {
    setStore({
      [ROOT]: { attrs: { crs: CRS, transform: TRANSFORM } },
      [`${ROOT}/depth`]: { shape: [3, 4, 5], data: new Float32Array(60) },
      [`${ROOT}/time`]: { shape: [3], data: new Float32Array([10, 20, 30]) },
    });

    const m = await readMetadata({
      url: ROOT,
      variable: "depth",
      candidates: ["depth", "other"],
      labelVar: "time",
    });

    expect(m.variables).toEqual(["depth", "other"]);
    expect(m.slice_count).toBe(3);
    expect(m.slice_labels).toEqual(["10", "20", "30"]);
    expect(m.crs).toBe(CRS);
    expect(m.grid_shape).toEqual([4, 5]);
    expect(m.extent).toEqual([-100, 180, -75, 200]);
  });

  it("falls back to index labels when the label array length mismatches", async () => {
    setStore({
      [ROOT]: { attrs: { crs: CRS, transform: TRANSFORM } },
      [`${ROOT}/depth`]: { shape: [3, 4, 5], data: new Float32Array(60) },
      [`${ROOT}/time`]: { shape: [2], data: new Float32Array([10, 20]) },
    });
    const m = await readMetadata({
      url: ROOT,
      variable: "depth",
      labelVar: "time",
    });
    expect(m.slice_labels).toEqual(["0", "1", "2"]);
  });

  it("throws when no variable or candidates are given", async () => {
    setStore({ [ROOT]: { attrs: { crs: CRS, transform: TRANSFORM } } });
    await expect(readMetadata({ url: ROOT })).rejects.toThrow(
      "could not determine a griddable variable",
    );
  });
});

describe("grid shape validation", () => {
  it("rejects an array that is neither 2D [y, x] nor 3D [n, y, x]", async () => {
    setStore({
      [ROOT]: { attrs: { crs: CRS, transform: TRANSFORM } },
      [`${ROOT}/depth`]: {
        shape: [2, 3, 4, 5],
        data: new Float32Array(120),
      },
    });
    await expect(readSlice({ url: ROOT, variable: "depth" })).rejects.toThrow(
      /expected a 2D \[y, x\] or 3D \[n, y, x\] array, got shape \[2, 3, 4, 5\]/,
    );
  });

  it("rejects a 1D array with the same message", async () => {
    setStore({
      [ROOT]: { attrs: { crs: CRS, transform: TRANSFORM } },
      [`${ROOT}/depth`]: { shape: [4], data: new Float32Array(4) },
    });
    await expect(readSlice({ url: ROOT, variable: "depth" })).rejects.toThrow(
      /expected a 2D \[y, x\] or 3D \[n, y, x\] array/,
    );
  });
});

describe("explicit mask arguments", () => {
  // The store declares no masking attrs, so anything masked here came from the
  // caller's arguments rather than the store's own defaults.
  const bareStore = (data) => ({
    [ROOT]: { attrs: { crs: CRS, transform: TRANSFORM } },
    [`${ROOT}/depth`]: { shape: [2, 2], data },
  });

  it("masks with an explicit maskBelow when the store declares none", async () => {
    setStore(bareStore(new Float32Array([0.01, 5, 7, 9])));
    const slice = await readSlice({
      url: ROOT,
      variable: "depth",
      maskBelow: 0.05,
    });
    expect(slice.data[1]).toBe(0); // alpha of cell 0 -> masked
    expect(slice.data[3]).toBe(1); // alpha of cell 1 -> visible
    expect(slice.min).toBe(5);
    expect(slice.max).toBe(9);
  });

  it("masks with an explicit sourceNodata when the store declares none", async () => {
    setStore(bareStore(new Float32Array([-1, 5, 7, 9])));
    const slice = await readSlice({
      url: ROOT,
      variable: "depth",
      sourceNodata: -1,
    });
    expect(slice.data[1]).toBe(0);
    expect(slice.min).toBe(5);
  });

  it("lets an explicit maskBelow override the store's own attr", async () => {
    setStore({
      [ROOT]: {
        attrs: { crs: CRS, transform: TRANSFORM, extent_threshold_m: 100 },
      },
      [`${ROOT}/depth`]: {
        shape: [2, 2],
        data: new Float32Array([1, 2, 3, 4]),
      },
    });
    // The store attr would mask everything; the explicit argument masks nothing.
    const slice = await readSlice({
      url: ROOT,
      variable: "depth",
      maskBelow: 0,
    });
    expect(slice.min).toBe(1);
    expect(slice.max).toBe(4);
  });
});

describe("affine transform validation", () => {
  const storeWithTransform = (transform) => ({
    [ROOT]: { attrs: { crs: CRS, transform } },
    [`${ROOT}/depth`]: { shape: [2, 2], data: new Float32Array([1, 2, 3, 4]) },
  });

  it("rejects a rotated/skewed transform rather than drawing it north-up", async () => {
    setStore(storeWithTransform([5, 0.5, -100, 0.25, -5, 200]));
    await expect(readSlice({ url: ROOT, variable: "depth" })).rejects.toThrow(
      /rotation\/skew terms/,
    );
  });

  it("rejects a zero pixel size", async () => {
    setStore(storeWithTransform([0, 0, -100, 0, -5, 200]));
    await expect(readSlice({ url: ROOT, variable: "depth" })).rejects.toThrow(
      /zero or non-numeric pixel size/,
    );
  });

  it("keeps the extent ordered for a west-decreasing (negative a) grid", async () => {
    setStore(storeWithTransform([-5, 0, -100, 0, -5, 200]));
    const slice = await readSlice({ url: ROOT, variable: "depth" });
    const [minx, miny, maxx, maxy] = slice.extent;
    expect(minx).toBeLessThan(maxx);
    expect(miny).toBeLessThan(maxy);
    expect(minx).toBe(-110);
    expect(maxx).toBe(-100);
  });

  it("reports the x and y pixel sizes so the caller can reject non-square cells", async () => {
    setStore(storeWithTransform([5, 0, -100, 0, -12, 200]));
    const slice = await readSlice({ url: ROOT, variable: "depth" });
    expect(slice.pixelSize).toEqual({ x: 5, y: 12 });
  });
});

describe("store open errors", () => {
  it("rethrows a network/CORS failure instead of retrying it as v2", async () => {
    // A v3 open that fails for a non-format reason must surface as-is: a v2
    // retry only issues a second doomed request and hides the real cause.
    const netErr = new Error("Failed to fetch");
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockNodes = {};
    const zarrita = require("zarrita");
    const v3 = jest.spyOn(zarrita.open, "v3").mockRejectedValue(netErr);
    const v2 = jest.spyOn(zarrita.open, "v2");

    await expect(readSlice({ url: ROOT, variable: "depth" })).rejects.toThrow(
      "Failed to fetch",
    );
    expect(v2).not.toHaveBeenCalled();

    v3.mockRestore();
    v2.mockRestore();
    console.error.mockRestore();
  });

  it("reports both attempts when the store is neither v3 nor v2", async () => {
    setStore({}); // nothing at any URL -> both opens report "not found"
    await expect(readSlice({ url: ROOT, variable: "depth" })).rejects.toThrow(
      /could not open '.*' as a zarr v3 or v2 store/,
    );
  });
});

describe("listArrays", () => {
  // Listing goes through zarrReader's own fetch override, so these tests stub
  // the global fetch to stand in for the host answering the
  // consolidated-metadata key.
  let realFetch;
  let realSignalTimeout;

  beforeEach(() => {
    realFetch = global.fetch;
    realSignalTimeout = AbortSignal.timeout;
    setStore({ [ROOT]: { attrs: { crs: CRS, transform: TRANSFORM } } });
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = realFetch;
    AbortSignal.timeout = realSignalTimeout;
  });

  // The status the host answers the consolidated-metadata key with.
  function answerConsolidatedKeyWith(status) {
    global.fetch = jest.fn(async () => new Response(null, { status }));
  }

  it("lists the arrays of a store carrying consolidated metadata", async () => {
    mockContents = [
      { path: "/", kind: "group" },
      { path: "/depth", kind: "array" },
      { path: "/velocity", kind: "array" },
    ];
    answerConsolidatedKeyWith(200);

    await expect(listArrays({ url: ROOT })).resolves.toEqual({
      names: ["depth", "velocity"],
      enumerated: true,
    });
  });

  it("returns no names for a store without consolidated metadata rather than throwing", async () => {
    // The forgiving wrapper hands back the unwrapped store here, which has no
    // contents() at all. These entries must NOT surface: reaching them would
    // mean the capability check is gone and a real store would throw a
    // TypeError instead of reporting an honest empty list.
    mockContents = [{ path: "/depth", kind: "array" }];
    answerConsolidatedKeyWith(404);

    // enumerated:false is the load-bearing half. Without it the caller cannot
    // tell this apart from a store that genuinely holds no arrays, and would
    // tell the author their perfectly good variable no longer exists.
    await expect(listArrays({ url: ROOT })).resolves.toEqual({
      names: [],
      enumerated: false,
    });
  });

  it("lists nothing when the host answers the consolidated-metadata key as forbidden", async () => {
    // Object stores answer a missing key with 403 when listing is denied. The
    // wrapper only swallows not-found, so without the remap this store would be
    // reported as failed instead of simply unlistable.
    mockContents = [{ path: "/depth", kind: "array" }];
    answerConsolidatedKeyWith(403);

    await expect(listArrays({ url: ROOT })).resolves.toEqual({
      names: [],
      enumerated: false,
    });
  });

  it("excludes groups, offering only arrays", async () => {
    mockContents = [
      { path: "/", kind: "group" },
      { path: "/forcing", kind: "group" },
      { path: "/depth", kind: "array" },
    ];
    answerConsolidatedKeyWith(200);

    await expect(listArrays({ url: ROOT })).resolves.toEqual({
      names: ["depth"],
      enumerated: true,
    });
  });

  it("returns a nested array as a root-relative path, not a bare basename", async () => {
    // The caller appends the name to the store URL, so a basename would resolve
    // to the wrong place and a leading slash would escape the store root.
    mockContents = [{ path: "/forcing/depth", kind: "array" }];
    answerConsolidatedKeyWith(200);

    await expect(listArrays({ url: ROOT })).resolves.toEqual({
      names: ["forcing/depth"],
      enumerated: true,
    });
  });

  it("reports an enumerated store that holds no arrays, distinctly from an unlistable one", async () => {
    mockContents = [
      { path: "/", kind: "group" },
      { path: "/forcing", kind: "group" },
    ];
    answerConsolidatedKeyWith(200);

    await expect(listArrays({ url: ROOT })).resolves.toEqual({
      names: [],
      enumerated: true,
    });
  });

  it("offers only griddable arrays, dropping coordinate axes and the CRS holder", async () => {
    // A coordinate axis is an array like any other, but gridDims rejects it, so
    // offering one offers a choice that can only fail. Shape decides, not name.
    mockContents = [
      { path: "/", kind: "group" },
      { path: "/depth", kind: "array" },
      { path: "/x", kind: "array" },
      { path: "/y", kind: "array" },
      { path: "/time", kind: "array" },
      { path: "/spatial_ref", kind: "array" },
      { path: "/time_of_peak", kind: "array" },
    ];
    setStore({
      [ROOT]: { attrs: {} },
      [`${ROOT}/depth`]: { shape: [3, 4, 5], data: new Float32Array(60) },
      [`${ROOT}/x`]: { shape: [5], data: new Float32Array(5) },
      [`${ROOT}/y`]: { shape: [4], data: new Float32Array(4) },
      [`${ROOT}/time`]: { shape: [3], data: new Float32Array(3) },
      [`${ROOT}/spatial_ref`]: { shape: [], data: new Float32Array(1) },
      // Named like an axis, shaped like data. A name filter would hide it.
      [`${ROOT}/time_of_peak`]: { shape: [4, 5], data: new Float32Array(20) },
    });
    answerConsolidatedKeyWith(200);

    await expect(listArrays({ url: ROOT })).resolves.toEqual({
      names: ["depth", "time_of_peak"],
      enumerated: true,
    });
  });

  it("keeps an array whose shape could not be read rather than hiding it", async () => {
    // A probe that fails must not turn a reachable store into one that appears
    // to hold nothing.
    mockContents = [
      { path: "/", kind: "group" },
      { path: "/depth", kind: "array" },
    ];
    setStore({ [ROOT]: { attrs: {} } }); // no node for /depth -> probe throws
    answerConsolidatedKeyWith(200);

    await expect(listArrays({ url: ROOT })).resolves.toEqual({
      names: ["depth"],
      enumerated: true,
    });
  });

  it("fails when the store cannot be opened at all, distinctly from listing nothing", async () => {
    setStore({}); // nothing at any URL -> both opens report "not found"
    answerConsolidatedKeyWith(200);

    await expect(listArrays({ url: ROOT })).rejects.toThrow(
      /could not open '.*' as a zarr v3 or v2 store/,
    );
  });

  it("cuts off a hung listing request with the same timeout as every other read", async () => {
    // Force the AbortController branch of timeoutSignal so the cutoff runs on
    // jest's fake timers; AbortSignal.timeout, where a browser supplies it, uses
    // a real timer this test cannot advance.
    AbortSignal.timeout = undefined;
    jest.useFakeTimers();
    global.fetch = jest.fn(
      (request) =>
        new Promise((_, reject) => {
          request.signal.addEventListener("abort", () =>
            reject(new Error("the request was aborted")),
          );
        }),
    );

    // Catch immediately so the rejection is never unhandled while the clock is
    // still stopped.
    const listing = listArrays({ url: ROOT }).catch((error) => error);
    // Let the open and the consolidated read reach the stubbed fetch before the
    // clock jumps; every step in between settles on microtasks.
    for (let i = 0; i < 50 && global.fetch.mock.calls.length === 0; i++) {
      await Promise.resolve();
    }
    jest.advanceTimersByTime(30000);

    const outcome = await listing;
    expect(outcome).toBeInstanceOf(Error); // not a resolved list of arrays
    expect(outcome.message).toMatch(/aborted/);
  });

  it("leaves readMetadata's behaviour unchanged when the store is listable", async () => {
    // Listing is additive: variables still come from the caller's candidates,
    // and slice count/labels still come from the reference array.
    mockContents = [
      { path: "/depth", kind: "array" },
      { path: "/velocity", kind: "array" },
    ];
    answerConsolidatedKeyWith(200);
    setStore({
      [ROOT]: { attrs: { crs: CRS, transform: TRANSFORM } },
      [`${ROOT}/depth`]: { shape: [3, 4, 5], data: new Float32Array(60) },
    });

    const m = await readMetadata({
      url: ROOT,
      variable: "depth",
      candidates: ["depth"],
    });

    expect(m.variables).toEqual(["depth"]);
    expect(m.slice_count).toBe(3);
    expect(m.slice_labels).toEqual(["0", "1", "2"]);
  });
});
