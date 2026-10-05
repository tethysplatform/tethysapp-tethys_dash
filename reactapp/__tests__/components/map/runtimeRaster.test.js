// Resolve-and-swap for a GeoTIFF layer driven by a dynamic map layer plugin.
//
// Its own file for the reason geoTIFFProjection.test.js gives: the header reads
// go through a dynamic import of geotiff, and ModuleLoader.test.js resets the
// module registry partway through, after which a file-scope mock configured
// there is not the instance the import resolves.
import {
  RUNTIME_RASTER_READY_TIMEOUT_MS,
  applyRuntimeRaster,
  attachGeoTIFFSourceErrorHandlers,
  buildRuntimeRaster,
  describeGeoTIFFSourceFailure,
  disposeRuntimeSource,
  isRuntimeRasterConfig,
  normalizeLayerUrl,
  resolveEffectiveRasterConfig,
} from "components/map/runtimeRaster";
import { GeoTIFFError, LayerSourceError } from "components/map/ModuleLoader";
import { fromUrl } from "geotiff";
import GeoTIFF from "ol/source/GeoTIFF.js";
import Source from "ol/source/Source.js";
import WebGLTileLayer from "ol/layer/WebGLTile.js";

jest.mock("geotiff", () => ({ fromUrl: jest.fn() }));

// OpenLayers' GeoTIFF source opens the file itself as it is constructed, which
// jsdom cannot do. The stand-in starts "loading" like the real one and settles
// on the next microtask the way the test asked: "ready", "error" (carrying an
// error the way the real source's getError() does), or "hang" to never settle.
jest.mock("ol/source/GeoTIFF.js", () => {
  const ActualSource = jest.requireActual("ol/source/Source.js").default;
  const spy = jest.fn();
  class MockGeoTIFFSource extends ActualSource {
    constructor(options) {
      super({ projection: null, state: "loading" });
      this.options = options;
      this.error_ = null;
      spy(options);
      const outcome = MockGeoTIFFSource.nextOutcome;
      Promise.resolve().then(() => {
        if (outcome === "ready") {
          this.setState("ready");
        } else if (outcome === "error") {
          this.error_ = new Error(MockGeoTIFFSource.nextErrorMessage);
          this.setState("error");
        } else if (outcome === "silent-error") {
          // Errored with nothing on it to say why, which the real source does
          // when the failure came from a layer it has no error object for.
          this.setState("error");
        } else if (outcome === "deferred") {
          // Still opening when the build starts waiting on it -- a large file,
          // or a slow host. The test settles it by hand.
          MockGeoTIFFSource.pending = this;
        }
      });
    }

    getError() {
      return this.error_;
    }
  }
  MockGeoTIFFSource.constructorSpy = spy;
  MockGeoTIFFSource.nextOutcome = "ready";
  MockGeoTIFFSource.nextErrorMessage = "";
  MockGeoTIFFSource.pending = null;
  return { __esModule: true, default: MockGeoTIFFSource };
});

// A file the header read answers for: its statistics, CRS keys, size, sample
// format and pixels. Keyed by URL so two fetches can return two files.
const mockFiles = (files) => {
  fromUrl.mockImplementation(async (url) => {
    const file = files[url];
    if (!file) throw new Error(`request failed: ${url}`);
    const {
      stats = {},
      geoKeys = {},
      nodata = null,
      width = 4,
      height = 4,
      sampleFormat = 3,
      pixels = null,
    } = file;
    return {
      getImage: async () => ({
        geoKeys,
        getGDALMetadata: (sample) => (sample === null ? {} : stats),
        getGDALNoData: () => nodata,
        getWidth: () => width,
        getHeight: () => height,
        getSampleFormat: () => sampleFormat,
        readRasters: async () => [
          pixels ?? new Float32Array(width * height).fill(0),
        ],
      }),
    };
  });
};

const statsFile = (min, max) => ({
  stats: { STATISTICS_MINIMUM: String(min), STATISTICS_MAXIMUM: String(max) },
});

// A saved runtime GeoTIFF layer, as the editor writes it: no URL on the source,
// ramp fields beside `props`, and the plugin binding on `pluginSource`.
const savedLayer = ({
  source = {},
  sourceProps = {},
  pluginSource = {},
  style = {},
} = {}) => ({
  type: "WebGLTile",
  props: {
    name: "Depth",
    layerId: "layer-1",
    source: {
      type: "GeoTIFF",
      props: { ...sourceProps },
      ...source,
    },
    pluginSource: {
      source: "echo_raster",
      args: { storm: "ian" },
      ...pluginSource,
    },
  },
  style: { ...style },
});

const description = (url, { projection, style, props } = {}) => ({
  type: "GeoTIFF",
  props: { url, ...(projection ? { projection } : {}), ...(props ?? {}) },
  ...(style ? { style } : {}),
});

beforeEach(() => {
  fromUrl.mockReset();
  GeoTIFF.constructorSpy.mockClear();
  GeoTIFF.nextOutcome = "ready";
  GeoTIFF.nextErrorMessage = "";
  // The statistics sidecar. A 404 is the normal case for a file that embeds its
  // statistics, which is what every file here does unless it says otherwise.
  global.fetch = jest.fn(async () => ({ ok: false }));
});

// The suite setup's request mocking owns the real one and restores it at exit.
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

describe("layer URL rule", () => {
  const origin = window.location.origin;

  it.each([
    ["https://h/x.tif", "https://h/x.tif"],
    ["http://h/x.tif", "http://h/x.tif"],
    ["HTTP://h/x.tif", "HTTP://h/x.tif"],
    ["/files/x.tif", `${origin}/files/x.tif`],
  ])("accepts %s", (url, normalized) => {
    expect(normalizeLayerUrl(url)).toBe(normalized);
  });

  it.each([
    "//host/x.tif",
    "/\\host/x.tif",
    "\\\\host",
    "https://h\\x.tif",
    " javascript:alert(1)",
    "https://h/x.tif ",
    // eslint-disable-next-line no-script-url -- the scheme under test
    "javascript:x",
    "file:///etc/passwd",
    "data:x",
    "blob:http://localhost/abc",
    "relative/x.tif",
    "http://",
    "/files/x\u0000.tif",
    "https://h/x\n.tif",
    "",
    null,
    undefined,
    42,
  ])("rejects %p", (url) => {
    expect(normalizeLayerUrl(url)).toBeNull();
  });
});

describe("resolveEffectiveRasterConfig", () => {
  it("overlays the URL and projection onto a copy of the saved config", () => {
    const saved = savedLayer({ style: { rampName: "viridis" } });
    const before = JSON.parse(JSON.stringify(saved));

    const effective = resolveEffectiveRasterConfig(
      saved,
      description("https://h/a.tif", { projection: "EPSG:32615" }),
    );

    expect(effective.props.source.props.url).toBe("https://h/a.tif");
    expect(effective.props.source.props.projection).toBe("EPSG:32615");
    // The plugin binding and identity ride along unchanged.
    expect(effective.props.layerId).toBe("layer-1");
    expect(effective.props.pluginSource).toEqual(saved.props.pluginSource);
    // Pure: the saved config is the input to every fetch, so it must never be
    // the thing that changes.
    expect(saved).toEqual(before);
  });

  it("starts from the saved config every time, never from a resolved one", () => {
    // applyAutoRamp skips a source whose resolvedRampUrl matches its URL, so a
    // copy that kept those fields would keep the previous file's style.
    const saved = savedLayer({
      style: { rampName: "viridis" },
      source: {
        resolvedRampUrl: "https://h/a.tif",
        resolvedRampMin: 1,
        resolvedRampMax: 2,
        rampRangeUnavailable: true,
        resolvedSliceKey: "k",
      },
      sourceProps: { url: "https://h/a.tif", nodata: -9999 },
    });

    const effective = resolveEffectiveRasterConfig(
      saved,
      description("https://h/a.tif"),
    );
    const source = effective.props.source;

    expect(source.resolvedRampUrl).toBeUndefined();
    expect(source.resolvedRampMin).toBeUndefined();
    expect(source.resolvedRampMax).toBeUndefined();
    expect(source.rampRangeUnavailable).toBeUndefined();
    expect(source.resolvedSliceKey).toBeUndefined();
    expect(source.props.nodata).toBeUndefined();
  });

  it("Covers AE5. fails a fetch whose source type differs from the saved one, naming both", () => {
    const run = () =>
      resolveEffectiveRasterConfig(savedLayer(), {
        type: "XYZ",
        props: { url: "https://h/a.tif" },
      });
    expect(run).toThrow(LayerSourceError);
    expect(run).toThrow(/"XYZ".*"GeoTIFF"/);
  });

  it.each([
    [null, /source description/],
    ["https://h/a.tif", /source description/],
    [{ type: "GeoTIFF" }, /no URL/],
    [{ type: "GeoTIFF", props: { url: "" } }, /no URL/],
  ])(
    "fails a malformed description %p with an actionable message",
    (bad, msg) => {
      expect(() => resolveEffectiveRasterConfig(savedLayer(), bad)).toThrow(
        msg,
      );
    },
  );

  it("rejects a javascript: URL before any network call", async () => {
    const run = () =>
      resolveEffectiveRasterConfig(
        savedLayer({ style: { rampName: "viridis" } }),
        // eslint-disable-next-line no-script-url -- the scheme under test
        description("javascript:alert(1)"),
      );
    expect(run).toThrow(LayerSourceError);
    expect(run).toThrow(/javascript:alert\(1\)/);
    expect(fromUrl).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("hands on a root-relative URL as an absolute one on this origin", () => {
    const effective = resolveEffectiveRasterConfig(
      savedLayer(),
      description("/tethysdash/files/a.tif"),
    );
    expect(effective.props.source.props.url).toBe(
      `${window.location.origin}/tethysdash/files/a.tif`,
    );
  });

  it("replaces the saved style wholesale with the fetch's when unpinned", () => {
    const saved = savedLayer({
      style: {
        rampName: "Blues",
        rampMin: "1",
        rampMax: "9",
        rampReverse: true,
      },
    });
    const effective = resolveEffectiveRasterConfig(
      saved,
      description("https://h/a.tif", {
        style: { rampName: "viridis", rampMin: 0 },
      }),
    );
    expect(effective.style.rampName).toBe("viridis");
    expect(effective.style.rampMin).toBe(0);
    // Absent from the fetch's style, so cleared rather than inherited.
    expect(effective.style).not.toHaveProperty("rampMax");
    expect(effective.style).not.toHaveProperty("rampReverse");
  });

  it("leaves the saved mask alone when a fetch does not mention it", () => {
    // The mask is a source property, not part of the style a fetch replaces
    // wholesale: it decides which values the file publishes as data. A fetch
    // that says nothing about it leaves the author's setting standing.
    const effective = resolveEffectiveRasterConfig(
      savedLayer({
        style: { rampName: "Blues" },
        sourceProps: { mask_below: "0.5" },
      }),
      description("https://h/a.tif", { style: { rampName: "viridis" } }),
    );
    expect(effective.props.source.props.mask_below).toBe("0.5");
  });

  it("applies a fetched mask even when the author pinned the style", () => {
    // Pinning governs styling. The mask is not styling, so it follows the
    // plugin regardless.
    const effective = resolveEffectiveRasterConfig(
      savedLayer({
        style: { rampName: "Blues" },
        sourceProps: { mask_below: "0.5" },
        pluginSource: { stylePinned: true },
      }),
      description("https://h/a.tif", { props: { mask_below: "-9999" } }),
    );
    expect(effective.props.source.props.mask_below).toBe("-9999");
  });

  it("clears the saved mask when a fetch sends an empty one", () => {
    const effective = resolveEffectiveRasterConfig(
      savedLayer({
        style: { rampName: "Blues" },
        sourceProps: { mask_below: "0.5" },
      }),
      description("https://h/a.tif", { props: { mask_below: "" } }),
    );
    expect(effective.props.source.props).not.toHaveProperty("mask_below");
  });

  it("drops a saved categorical style when an unpinned fetch supplies a ramp", () => {
    const effective = resolveEffectiveRasterConfig(
      savedLayer({
        style: {
          rampName: "Blues",
          styleMode: "categorical",
          classes: [{ value: 1, color: "#ff0000" }],
          fallbackColor: "#000000",
        },
        sourceProps: { normalize: false, interpolate: false },
      }),
      description("https://h/a.tif", { style: { rampName: "viridis" } }),
    );
    expect(effective.style).not.toHaveProperty("styleMode");
    expect(effective.style).not.toHaveProperty("classes");
    expect(effective.style).not.toHaveProperty("fallbackColor");
    expect(effective.props.source.props).not.toHaveProperty("interpolate");
  });

  it("drops a saved ranges style when an unpinned fetch supplies a ramp", () => {
    const effective = resolveEffectiveRasterConfig(
      savedLayer({
        style: {
          rampName: "Blues",
          styleMode: "ranges",
          classes: [{ value: 1, color: "#ff0000" }],
        },
        sourceProps: { normalize: false, interpolate: false },
      }),
      description("https://h/a.tif", { style: { rampName: "viridis" } }),
    );
    expect(effective.style).not.toHaveProperty("styleMode");
    expect(effective.style).not.toHaveProperty("classes");
    expect(effective.props.source.props).not.toHaveProperty("interpolate");
    expect(effective.style.rampName).toBe("viridis");
  });

  it("uses the saved style when the fetch supplies none", () => {
    const effective = resolveEffectiveRasterConfig(
      savedLayer({ style: { rampName: "Blues", rampMax: "9" } }),
      description("https://h/a.tif"),
    );
    expect(effective.style.rampName).toBe("Blues");
    expect(effective.style.rampMax).toBe("9");
  });

  it("ignores a fetch style on a pinned layer, even one whose saved style has no ramp", () => {
    const effective = resolveEffectiveRasterConfig(
      savedLayer({ pluginSource: { stylePinned: true } }),
      description("https://h/a.tif", {
        style: { rampName: "viridis", rampMin: 0, rampMax: 50 },
      }),
    );
    expect(effective.style).toEqual({});
  });

  it("hands the fetch's settings on as settings, compiling nothing", () => {
    // The compiled style depends on the file -- its nodata, its value range --
    // so it is built by applyAutoRamp once the file is open, not here. What
    // this returns is the settings, and the source behavior that goes with
    // them is derived from those at load.
    const pinnedRange = resolveEffectiveRasterConfig(
      savedLayer(),
      description("https://h/a.tif", {
        style: { rampName: "viridis", rampMin: 0, rampMax: 50 },
      }),
    );
    expect(pinnedRange.style).toEqual({
      rampName: "viridis",
      rampMin: 0,
      rampMax: 50,
    });
    expect(pinnedRange.style).not.toHaveProperty("color");
    expect(pinnedRange.props.source.props).not.toHaveProperty("normalize");

    const open = resolveEffectiveRasterConfig(
      savedLayer(),
      description("https://h/a.tif", { style: { rampName: "magma" } }),
    );
    expect(open.style).toEqual({ rampName: "magma" });
  });

  it("fails a fetch naming a ramp that does not exist", () => {
    expect(() =>
      resolveEffectiveRasterConfig(
        savedLayer(),
        description("https://h/a.tif", { style: { rampName: "nope" } }),
      ),
    ).toThrow(/nope/);
  });
});

describe("buildRuntimeRaster", () => {
  const build = (saved, desc) =>
    buildRuntimeRaster(resolveEffectiveRasterConfig(saved, desc), "EPSG:3857");

  it("Covers AE1. follows the plugin's ramp, and auto-ranges one that names no bounds", async () => {
    mockFiles({
      "https://h/a.tif": statsFile(10, 20),
      "https://h/b.tif": statsFile(3, 9),
    });
    const saved = savedLayer({ style: { rampName: "Blues" } });

    const first = await build(
      saved,
      description("https://h/a.tif", {
        style: { rampName: "viridis", rampMin: 0, rampMax: 50 },
      }),
    );
    expect(first.legendRamp).toEqual({
      rampName: "viridis",
      rampReverse: false,
      rampMin: 0,
      rampMax: 50,
    });
    expect(first.source.options.sources[0].url).toBe("https://h/a.tif");

    const second = await build(
      saved,
      description("https://h/b.tif", { style: { rampName: "magma" } }),
    );
    expect(second.legendRamp).toEqual({
      rampName: "magma",
      rampReverse: false,
      rampMin: 3,
      rampMax: 9,
    });
    expect(second.source.options.sources[0].url).toBe("https://h/b.tif");
    // Raw values once the range is known, so a click reports real units.
    expect(second.source.options.normalize).toBe(false);
    expect(second.style).not.toEqual(first.style);
  });

  it("Covers AE2. keeps the author's pinned style while following the plugin's URL", async () => {
    mockFiles({ "https://h/a.tif": statsFile(0, 5) });
    const saved = savedLayer({
      style: { rampName: "Blues" },
      pluginSource: { stylePinned: true },
    });

    const built = await build(
      saved,
      description("https://h/a.tif", {
        style: { rampName: "viridis", rampMin: 0, rampMax: 50 },
      }),
    );
    expect(built.legendRamp).toEqual({
      rampName: "Blues",
      rampReverse: false,
      rampMin: 0,
      rampMax: 5,
    });
    expect(built.source.options.sources[0].url).toBe("https://h/a.tif");
  });

  it("Covers AE6. a URL-only fetch draws with the saved ramp, ranged to the returned file", async () => {
    mockFiles({ "https://h/c.tif": statsFile(-2, 7.5) });
    const built = await build(
      savedLayer({ style: { rampName: "viridis", rampReverse: true } }),
      description("https://h/c.tif"),
    );
    expect(built.legendRamp).toEqual({
      rampName: "viridis",
      rampReverse: true,
      rampMin: -2,
      rampMax: 7.5,
    });
  });

  it("rebuilds for the same URL, so a style change is not skipped", async () => {
    mockFiles({ "https://h/a.tif": statsFile(0, 10) });
    const saved = savedLayer();

    const first = await build(
      saved,
      description("https://h/a.tif", { style: { rampName: "viridis" } }),
    );
    const second = await build(
      saved,
      description("https://h/a.tif", { style: { rampName: "magma" } }),
    );
    expect(first.legendRamp.rampName).toBe("viridis");
    expect(second.legendRamp.rampName).toBe("magma");
    expect(second.legendRamp.rampMax).toBe(10);
    expect(second.source).not.toBe(first.source);
  });

  it("labels a ramp left on the normalized scale 0..1", async () => {
    // Read, but holding a single value: no range to fit, so the raster stays
    // normalized and the legend says so rather than vanishing.
    mockFiles({ "https://h/flat.tif": {} });
    const built = await build(
      savedLayer({ style: { rampName: "viridis" } }),
      description("https://h/flat.tif"),
    );
    expect(built.legendRamp).toEqual({
      rampName: "viridis",
      rampReverse: false,
      rampMin: 0,
      rampMax: 1,
    });
  });

  it("returns no legend ramp for a layer with no ramp", async () => {
    mockFiles({ "https://h/a.tif": statsFile(0, 1) });
    const built = await build(savedLayer(), description("https://h/a.tif"));
    expect(built.legendRamp).toBeNull();
    expect(built.source).toBeInstanceOf(GeoTIFF);
  });

  it("keeps a pinned categorical style and reports its swatches, not a colorbar", async () => {
    mockFiles({ "https://h/a.tif": statsFile(0, 1) });
    const built = await build(
      savedLayer({
        style: {
          rampName: "Blues",
          styleMode: "categorical",
          classes: [{ value: 1, color: "#ff0000" }],
        },
        pluginSource: { stylePinned: true },
      }),
      description("https://h/a.tif", { style: { rampName: "viridis" } }),
    );
    expect(built.legendRamp).toEqual({
      items: [{ color: "#ff0000", label: "1", symbol: "square" }],
    });
    expect(JSON.stringify(built.style.color)).toContain("match");
    expect(built.source.options.interpolate).toBe(false);
  });

  it("keeps a pinned ranges style, drawn by interval with ascending swatches", async () => {
    mockFiles({ "https://h/a.tif": statsFile(0, 1) });
    const built = await build(
      savedLayer({
        style: {
          rampName: "Blues",
          styleMode: "ranges",
          classes: [
            { value: "10", color: "#0000ff", label: "1 to 10" },
            { value: "1", color: "#ff0000" },
          ],
        },
        pluginSource: { stylePinned: true },
      }),
      description("https://h/a.tif", { style: { rampName: "viridis" } }),
    );
    expect(built.legendRamp).toEqual({
      items: [
        { color: "#ff0000", label: "Up to 1", symbol: "square" },
        { color: "#0000ff", label: "1 to 10", symbol: "square" },
      ],
    });
    const color = built.style.color;
    expect(color[0]).toBe("case");
    expect(color).toContainEqual(["<=", ["band", 1], 1]);
    expect(color).toContainEqual(["<=", ["band", 1], 10]);
    expect(JSON.stringify(color)).not.toContain("match");
    expect(built.source.options.interpolate).toBe(false);
  });

  it("fails on a projection it cannot place, without building a source", async () => {
    mockFiles({ "https://h/a.tif": statsFile(0, 1) });
    await expect(
      build(
        savedLayer({ style: { rampName: "viridis" } }),
        description("https://h/a.tif", { projection: "EPSG:999999" }),
      ),
    ).rejects.toThrow(/EPSG:999999/);
    expect(GeoTIFF.constructorSpy).not.toHaveBeenCalled();
  });

  it("fails a float raster too large to range, before any layer changes", async () => {
    mockFiles({ "https://h/huge.tif": { width: 4000, height: 4000 } });
    const layer = new WebGLTileLayer({});
    const previous = new Source({ state: "ready" });
    layer.setSource(previous);

    let built;
    await expect(
      (async () => {
        built = await build(
          savedLayer({ style: { rampName: "viridis" } }),
          description("https://h/huge.tif"),
        );
        applyRuntimeRaster(layer, built);
      })(),
    ).rejects.toThrow(GeoTIFFError);
    await expect(
      build(
        savedLayer({ style: { rampName: "viridis" } }),
        description("https://h/huge.tif"),
      ),
    ).rejects.toThrow(/Set the ramp's Min and Max/);
    expect(built).toBeUndefined();
    expect(GeoTIFF.constructorSpy).not.toHaveBeenCalled();
    expect(layer.getSource()).toBe(previous);
  });

  it("fails an unreachable file at the pre-flight, leaving the layer as it was", async () => {
    // The header readers swallow this failure, so what catches it is the
    // source refusing to become ready.
    mockFiles({});
    GeoTIFF.nextOutcome = "error";
    GeoTIFF.nextErrorMessage = "request failed with status 404";
    const layer = new WebGLTileLayer({});
    const previous = new Source({ state: "ready" });
    layer.setSource(previous);
    const apply = jest.fn(applyRuntimeRaster);

    const attempt = build(
      savedLayer({ style: { rampName: "viridis" } }),
      description("https://h/gone.tif"),
    ).then((built) => apply(layer, built));

    await expect(attempt).rejects.toThrow(GeoTIFFError);
    await expect(attempt).rejects.toThrow(
      'GeoTIFF layer "Depth" failed to fetch the file.',
    );
    await expect(attempt).rejects.toThrow(/request failed with status 404/);
    expect(apply).not.toHaveBeenCalled();
    expect(layer.getSource()).toBe(previous);
  });

  it("fails a file that is reachable but not readable as a GeoTIFF", async () => {
    mockFiles({ "https://h/odd.tif": statsFile(0, 1) });
    GeoTIFF.nextOutcome = "error";
    GeoTIFF.nextErrorMessage = "Invalid byte order value.";
    await expect(
      build(
        savedLayer({ style: { rampName: "viridis" } }),
        description("https://h/odd.tif"),
      ),
    ).rejects.toThrow(/may not be a Cloud Optimized GeoTIFF/);
  });

  it("gives up on a source that never leaves loading", async () => {
    // Thirty seconds by default; shortened here rather than faked, because the
    // header reads it follows are a chain of real awaits.
    expect(RUNTIME_RASTER_READY_TIMEOUT_MS).toBe(30_000);
    mockFiles({ "https://h/slow.tif": statsFile(0, 1) });
    GeoTIFF.nextOutcome = "hang";
    const attempt = buildRuntimeRaster(
      resolveEffectiveRasterConfig(
        savedLayer({ style: { rampName: "viridis" } }),
        description("https://h/slow.tif"),
      ),
      "EPSG:3857",
      { timeoutMs: 20 },
    );
    await expect(attempt).rejects.toThrow(GeoTIFFError);
    await expect(attempt).rejects.toThrow(
      'GeoTIFF layer "Depth" timed out opening the file',
    );
    expect(GeoTIFF.constructorSpy).toHaveBeenCalled();
  });

  it("disposes a source that times out opening, detaching its listeners", async () => {
    mockFiles({ "https://h/slow.tif": statsFile(0, 1) });
    GeoTIFF.nextOutcome = "hang";
    const dispose = jest.spyOn(Source.prototype, "dispose");
    try {
      await expect(
        buildRuntimeRaster(
          resolveEffectiveRasterConfig(
            savedLayer({ style: { rampName: "viridis" } }),
            description("https://h/slow.tif"),
          ),
          "EPSG:3857",
          { timeoutMs: 20 },
        ),
      ).rejects.toThrow(/timed out/);
      expect(dispose).toHaveBeenCalledTimes(1);
      const [source] = dispose.mock.instances;
      expect(source).toBeInstanceOf(GeoTIFF);
      expect(source.hasListener("change")).toBe(false);
    } finally {
      dispose.mockRestore();
    }
  });

  it("gives up on a header read that never answers, before building a source", async () => {
    // The statistics read hangs, so applyAutoRamp never settles: the deadline
    // covers the whole build, not only the source's own open.
    fromUrl.mockImplementation(() => new Promise(() => {}));
    const attempt = buildRuntimeRaster(
      resolveEffectiveRasterConfig(
        savedLayer({ style: { rampName: "viridis" } }),
        description("https://h/hung.tif"),
      ),
      "EPSG:3857",
      { timeoutMs: 20 },
    );
    await expect(attempt).rejects.toThrow(GeoTIFFError);
    await expect(attempt).rejects.toThrow(
      'GeoTIFF layer "Depth" timed out opening the file',
    );
    expect(GeoTIFF.constructorSpy).not.toHaveBeenCalled();
  });

  it("disposes a source that fails to open", async () => {
    mockFiles({ "https://h/odd.tif": statsFile(0, 1) });
    GeoTIFF.nextOutcome = "error";
    GeoTIFF.nextErrorMessage = "Invalid byte order value.";
    const dispose = jest.spyOn(Source.prototype, "dispose");
    try {
      await expect(
        build(
          savedLayer({ style: { rampName: "viridis" } }),
          description("https://h/odd.tif"),
        ),
      ).rejects.toThrow(GeoTIFFError);
      expect(dispose).toHaveBeenCalledTimes(1);
    } finally {
      dispose.mockRestore();
    }
  });
});

describe("disposeRuntimeSource", () => {
  it("disposes a source, and tolerates none or one without dispose", () => {
    const source = new Source({ state: "ready" });
    source.on("change", () => {});
    disposeRuntimeSource(source);
    expect(source.hasListener("change")).toBe(false);
    expect(() => disposeRuntimeSource(null)).not.toThrow();
    expect(() => disposeRuntimeSource({})).not.toThrow();
  });
});

describe("applyRuntimeRaster", () => {
  it("repoints a real WebGLTile layer in place, keeping its identity", async () => {
    mockFiles({ "https://h/b.tif": statsFile(3, 9) });
    const layer = new WebGLTileLayer({ opacity: 0.6 });
    layer.set("name", "Depth");
    layer.set("layerId", "layer-1");
    layer.set("pluginSource", { source: "echo_raster", args: {} });
    const previous = new Source({ state: "ready" });
    layer.setSource(previous);
    const setStyle = jest.spyOn(layer, "setStyle");

    const built = await buildRuntimeRaster(
      resolveEffectiveRasterConfig(
        savedLayer(),
        description("https://h/b.tif", { style: { rampName: "magma" } }),
      ),
      "EPSG:3857",
    );
    applyRuntimeRaster(layer, built);

    expect(layer.getSource()).toBe(built.source);
    expect(layer.getSource()).not.toBe(previous);
    expect(setStyle).toHaveBeenLastCalledWith(built.style);
    expect(layer.get("layerId")).toBe("layer-1");
    expect(layer.get("pluginSource")).toEqual({
      source: "echo_raster",
      args: {},
    });
    expect(layer.get("name")).toBe("Depth");
    expect(layer.getOpacity()).toBe(0.6);
  });

  it("hands the layer an empty style when the build carries none", () => {
    // OpenLayers' setStyle reads `style.variables`, so undefined would throw.
    const layer = new WebGLTileLayer({});
    const source = new Source({ state: "ready" });
    applyRuntimeRaster(layer, { source, style: undefined, legendRamp: null });
    expect(layer.getSource()).toBe(source);
  });
});

describe("attachGeoTIFFSourceErrorHandlers", () => {
  const fire = (source, type, message) =>
    source.dispatchEvent({ type, error: new Error(message) });

  let warn;
  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it("reports a fetch failure with the hosting checklist", () => {
    const source = new Source({});
    const onError = jest.fn();
    attachGeoTIFFSourceErrorHandlers(source, "Depth", onError);

    fire(source, "error", "Failed to fetch");

    expect(onError).toHaveBeenCalledWith(
      `GeoTIFF layer "Depth" failed to fetch the file. ` +
        `Check the Network tab — likely causes: CORS headers ` +
        `missing on the hosting server, no HTTP Range support, ` +
        `or the URL is unreachable. Detail: Failed to fetch.`,
    );
    expect(warn).toHaveBeenCalled();
  });

  it("reports anything else as a possible non-COG, naming the phase", () => {
    const source = new Source({});
    const onError = jest.fn();
    attachGeoTIFFSourceErrorHandlers(source, "Depth", onError);

    fire(source, "tileloaderror", "bad tile");

    expect(onError).toHaveBeenCalledWith(
      `GeoTIFF layer "Depth" failed (tile load error). Detail: bad tile. ` +
        `The file may not be a Cloud Optimized GeoTIFF. Try converting with ` +
        "`gdal_translate -of COG -co COMPRESS=DEFLATE -co PREDICTOR=YES input.tif output.tif`.",
    );
  });

  it("surfaces only the first failure, and detaches on request", () => {
    const source = new Source({});
    const onError = jest.fn();
    const detach = attachGeoTIFFSourceErrorHandlers(source, "Depth", onError);
    fire(source, "error", "one");
    fire(source, "tileloaderror", "two");
    expect(onError).toHaveBeenCalledTimes(1);

    const other = new Source({});
    const onOther = jest.fn();
    attachGeoTIFFSourceErrorHandlers(other, "Depth", onOther)();
    fire(other, "error", "late");
    expect(onOther).not.toHaveBeenCalled();
    expect(typeof detach).toBe("function");
  });

  it("reports a source that fails by changing state, with its error", () => {
    // OpenLayers' GeoTIFF source dispatches no "error" event; a file it cannot
    // open moves it to the "error" state and leaves the cause on getError().
    const source = new Source({ state: "loading" });
    source.getError = () => new Error("Failed to fetch");
    const onError = jest.fn();
    attachGeoTIFFSourceErrorHandlers(source, "Depth", onError);

    source.setState("ready");
    expect(onError).not.toHaveBeenCalled();
    source.setState("error");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toMatch(
      /GeoTIFF layer "Depth" failed to fetch the file/,
    );
  });

  it("reports a source that had already failed when it was attached", () => {
    // Its "change" has fired already, so no listener would ever hear it.
    const source = new Source({ state: "error" });
    const onError = jest.fn();
    attachGeoTIFFSourceErrorHandlers(source, "Depth", onError);

    expect(onError).toHaveBeenCalledWith(
      expect.stringMatching(/GeoTIFF layer "Depth" failed \(source error\)/),
    );
    source.changed();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("stops watching the state once detached", () => {
    const source = new Source({ state: "ready" });
    const onError = jest.fn();
    attachGeoTIFFSourceErrorHandlers(source, "Depth", onError)();
    source.setState("error");
    expect(onError).not.toHaveBeenCalled();
  });

  it("omits the detail clause when the event carries none", () => {
    expect(describeGeoTIFFSourceFailure("Depth", "source error", "")).toBe(
      `GeoTIFF layer "Depth" failed (source error). ` +
        `The file may not be a Cloud Optimized GeoTIFF. Try converting with ` +
        "`gdal_translate -of COG -co COMPRESS=DEFLATE -co PREDICTOR=YES input.tif output.tif`.",
    );
  });
});

describe("isRuntimeRasterConfig", () => {
  it("is a WebGLTile GeoTIFF bound to a plugin, with an id", () => {
    expect(isRuntimeRasterConfig(savedLayer())).toBe(true);
  });

  it.each([
    ["a static GeoTIFF", { pluginSource: undefined }],
    ["one with no layerId", { layerId: undefined }],
  ])("is not %s", (_label, props) => {
    const config = savedLayer();
    Object.assign(config.props, props);
    expect(isRuntimeRasterConfig(config)).toBe(false);
  });

  it("is not a vector runtime layer, nor another raster source", () => {
    expect(
      isRuntimeRasterConfig({ ...savedLayer(), type: "VectorLayer" }),
    ).toBe(false);
    const zarr = savedLayer();
    zarr.props.source.type = "Zarr";
    expect(isRuntimeRasterConfig(zarr)).toBe(false);
    expect(isRuntimeRasterConfig(undefined)).toBe(false);
  });
});

describe("resolveEffectiveRasterConfig style and source edges", () => {
  it("ignores a fetch style whose ramp name is empty", () => {
    // "No opinion" and "" mean the same thing from a plugin: the style is
    // still replaced wholesale, but with nothing to name a palette, so the
    // layer draws grayscale rather than taking "" as a ramp and failing.
    const effective = resolveEffectiveRasterConfig(
      savedLayer({ style: { rampName: "Blues", rampMin: "1" } }),
      description("https://h/a.tif", { style: { rampName: "", rampMax: 9 } }),
    );
    expect(effective.style).toEqual({ rampMax: 9 });
  });

  it("carries a fetch's reversed ramp, and only when it is set", () => {
    const reversed = resolveEffectiveRasterConfig(
      savedLayer(),
      description("https://h/a.tif", {
        style: { rampName: "viridis", rampReverse: true },
      }),
    );
    expect(reversed.style).toEqual({ rampName: "viridis", rampReverse: true });

    // Saved only when true, as the editor saves it, so an unreversed layer's
    // config is unchanged from before the option existed.
    const plain = resolveEffectiveRasterConfig(
      savedLayer(),
      description("https://h/a.tif", {
        style: { rampName: "viridis", rampReverse: false },
      }),
    );
    expect(plain.style).toEqual({ rampName: "viridis" });
  });

  it("builds the props of a saved source that has none", () => {
    // A layer saved before a source prop existed carries no `props` key at
    // all; the URL still has to land somewhere.
    const saved = savedLayer();
    delete saved.props.source.props;

    const effective = resolveEffectiveRasterConfig(
      saved,
      description("https://h/a.tif"),
    );
    expect(effective.props.source.props).toEqual({ url: "https://h/a.tif" });
  });
});

describe("the legend a runtime raster reports", () => {
  it("labels a ramp left on the normalized scale 0..1", async () => {
    // No bounds set and none resolvable from the file, so OpenLayers scales
    // band 1 to 0..1 and the colorbar says so -- rather than being dropped,
    // which would leave a drawn raster with no legend at all.
    fromUrl.mockRejectedValue(new Error("no header"));
    const built = await buildRuntimeRaster(
      resolveEffectiveRasterConfig(
        savedLayer({ style: { rampName: "viridis" } }),
        description("https://h/a.tif"),
      ),
      "EPSG:3857",
    );
    expect(built.legendRamp).toEqual({
      rampName: "viridis",
      rampReverse: false,
      rampMin: 0,
      rampMax: 1,
    });
  });
});

describe("describeGeoTIFFSourceFailure", () => {
  it("names the phase when nothing else is known", () => {
    // Called with no detail at all: a source that moved to the error state
    // without an error object on it.
    const message = describeGeoTIFFSourceFailure("Depth", "source error");
    expect(message).toContain('GeoTIFF layer "Depth" failed (source error)');
    expect(message).toContain("Cloud Optimized GeoTIFF");
    expect(message).not.toContain("Detail:");
  });
});

describe("awaiting a source that fails without saying why", () => {
  it("still reports the failure", async () => {
    // A source that errors with no error object on it must not make the
    // message-building throw; the layer still has to report that it failed,
    // with the generic advice rather than a detail it does not have.
    GeoTIFF.nextOutcome = "silent-error";
    mockFiles({ "https://h/a.tif": statsFile(0, 1) });

    await expect(
      buildRuntimeRaster(
        resolveEffectiveRasterConfig(
          savedLayer({ style: { rampName: "viridis" } }),
          description("https://h/a.tif"),
        ),
        "EPSG:3857",
      ),
    ).rejects.toThrow(/GeoTIFF layer "Depth" failed/);
  });
});

describe("a build the deadline has already given up on", () => {
  it("stops instead of opening a file nothing will draw", async () => {
    // The steps before the deadline cannot be cancelled, only outlived. A
    // header read that lands after the timeout must not go on to construct an
    // OpenLayers source: nothing would ever draw it, and nothing would dispose
    // it either, so it would sit open holding its listeners.
    mockFiles({ "https://h/a.tif": statsFile(0, 1) });
    const readHeader = fromUrl.getMockImplementation();
    let releaseHeader;
    const held = new Promise((resolve) => {
      releaseHeader = resolve;
    });
    fromUrl.mockImplementation(async (url) => {
      await held;
      return readHeader(url);
    });

    const effective = resolveEffectiveRasterConfig(
      savedLayer({ style: { rampName: "viridis" } }),
      description("https://h/a.tif"),
    );
    const build = buildRuntimeRaster(effective, "EPSG:3857", { timeoutMs: 1 });

    await expect(build).rejects.toThrow(/timed out opening the file/);
    expect(GeoTIFF.constructorSpy).not.toHaveBeenCalled();

    releaseHeader();
    for (let i = 0; i < 50; i += 1) await Promise.resolve();

    // Still nothing built, now that the read it was waiting on has landed.
    expect(GeoTIFF.constructorSpy).not.toHaveBeenCalled();
  });
});

describe("a source still opening when the build waits on it", () => {
  // Every other test's source is ready by the time the build gets to it: the
  // statistics and header reads take enough microtasks that it has settled
  // already. This is the path where the build actually waits -- the listener
  // it attaches, and what that listener does when the state finally changes.
  const buildAgainst = () =>
    buildRuntimeRaster(
      resolveEffectiveRasterConfig(
        savedLayer({ style: { rampName: "viridis" } }),
        description("https://h/a.tif"),
      ),
      "EPSG:3857",
    );

  const waitForPendingSource = async () => {
    for (let i = 0; i < 50 && !GeoTIFF.pending; i += 1) {
      await Promise.resolve();
    }
    return GeoTIFF.pending;
  };

  beforeEach(() => {
    mockFiles({ "https://h/a.tif": statsFile(0, 1) });
    GeoTIFF.nextOutcome = "deferred";
    GeoTIFF.pending = null;
  });

  it("resolves once the file opens", async () => {
    const build = buildAgainst();
    const source = await waitForPendingSource();
    expect(source).toBeTruthy();

    source.setState("ready");
    const built = await build;
    expect(built.source).toBe(source);
    expect(built.legendRamp).toEqual({
      rampName: "viridis",
      rampReverse: false,
      rampMin: 0,
      rampMax: 1,
    });
  });

  it("rejects once the file fails to open", async () => {
    const build = buildAgainst();
    const source = await waitForPendingSource();

    source.error_ = new Error("request failed: https://h/a.tif");
    source.setState("error");

    await expect(build).rejects.toThrow(/failed to fetch the file/i);
  });
});
