import { readSlice, readMetadata } from "components/map/zarrReader";

// zarrita is mocked with a synthetic in-memory store keyed by the exact URL
// zarrReader builds (group at the root, arrays at `${root}/${name}`). Node shape:
//   group: { attrs }                          array: { shape, data (full, flat) }
// `v2only` nodes throw from open.v3 so the v3->v2 fallback path is exercised.
// `mock`-prefixed so jest's mock hoisting allows the factory to close over it.
let mockNodes = {};
jest.mock("zarrita", () => ({
  FetchStore: function (url) {
    this.url = url;
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
}));

const CRS = "EPSG:3857";
const TRANSFORM = [5, 0, -100, 0, -5, 200]; // 5m pixels, origin (-100, 200)
const ROOT = "https://x/store.zarr";

beforeEach(() => {
  mockNodes = {};
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
      [`${ROOT}/depth2d`]: { shape: [4, 5], data: new Float32Array(20).fill(3) },
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
    await expect(
      readSlice({ url: ROOT, variable: "depth" }),
    ).rejects.toThrow("missing 'transform'");
  });

  it("falls back to zarr v2 when v3 open fails", async () => {
    setStore({
      [ROOT]: { v2only: true, attrs: { crs: CRS, transform: TRANSFORM } },
      [`${ROOT}/depth`]: { v2only: true, shape: [4, 5], data: new Float32Array(20).fill(2) },
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
    const m = await readMetadata({ url: ROOT, variable: "depth", labelVar: "time" });
    expect(m.slice_labels).toEqual(["0", "1", "2"]);
  });

  it("throws when no variable or candidates are given", async () => {
    setStore({ [ROOT]: { attrs: { crs: CRS, transform: TRANSFORM } } });
    await expect(readMetadata({ url: ROOT })).rejects.toThrow(
      "could not determine a griddable variable",
    );
  });
});
