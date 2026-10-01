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
  isAllowedLayerUrl,
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
});

const description = (url, { projection, style } = {}) => ({
  type: "GeoTIFF",
  props: { url, ...(projection ? { projection } : {}) },
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
    expect(isAllowedLayerUrl(url)).toBe(true);
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
    expect(isAllowedLayerUrl(url)).toBe(false);
    expect(normalizeLayerUrl(url)).toBeNull();
  });
});

describe("resolveEffectiveRasterConfig", () => {
  it("overlays the URL and projection onto a copy of the saved config", () => {
    const saved = savedLayer({ source: { rampName: "viridis" } });
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
      source: {
        rampName: "viridis",
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
        savedLayer({ source: { rampName: "viridis" } }),
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
      source: {
        rampName: "Blues",
        rampMin: "1",
        rampMax: "9",
        rampReverse: true,
      },
      sourceProps: { mask_below: "0.5" },
    });
    const effective = resolveEffectiveRasterConfig(
      saved,
      description("https://h/a.tif", {
        style: { rampName: "viridis", rampMin: 0, maskBelow: 2 },
      }),
    );
    const source = effective.props.source;

    expect(source.rampName).toBe("viridis");
    expect(source.rampMin).toBe(0);
    // Absent from the fetch's style, so cleared rather than inherited.
    expect(source).not.toHaveProperty("rampMax");
    expect(source).not.toHaveProperty("rampReverse");
    expect(source.props.mask_below).toBe(2);
  });

  it("clears the saved mask when the fetch's style names none", () => {
    const effective = resolveEffectiveRasterConfig(
      savedLayer({
        source: { rampName: "Blues" },
        sourceProps: { mask_below: "0.5" },
      }),
      description("https://h/a.tif", { style: { rampName: "viridis" } }),
    );
    expect(effective.props.source.props).not.toHaveProperty("mask_below");
  });

  it("drops a saved categorical style when an unpinned fetch supplies a ramp", () => {
    const effective = resolveEffectiveRasterConfig(
      savedLayer({
        source: {
          rampName: "Blues",
          styleMode: "categorical",
          classes: [{ value: 1, color: "#ff0000" }],
          fallbackColor: "#000000",
        },
        sourceProps: { normalize: false, interpolate: false },
      }),
      description("https://h/a.tif", { style: { rampName: "viridis" } }),
    );
    const source = effective.props.source;
    expect(source).not.toHaveProperty("styleMode");
    expect(source).not.toHaveProperty("classes");
    expect(source).not.toHaveProperty("fallbackColor");
    expect(source.props).not.toHaveProperty("interpolate");
  });

  it("uses the saved style when the fetch supplies none", () => {
    const effective = resolveEffectiveRasterConfig(
      savedLayer({ source: { rampName: "Blues", rampMax: "9" } }),
      description("https://h/a.tif"),
    );
    expect(effective.props.source.rampName).toBe("Blues");
    expect(effective.props.source.rampMax).toBe("9");
  });

  it("ignores a fetch style on a pinned layer, even one whose saved style has no ramp", () => {
    const effective = resolveEffectiveRasterConfig(
      savedLayer({ pluginSource: { stylePinned: true } }),
      description("https://h/a.tif", {
        style: { rampName: "viridis", rampMin: 0, rampMax: 50 },
      }),
    );
    const source = effective.props.source;
    expect(source).not.toHaveProperty("rampName");
    expect(source).not.toHaveProperty("rampMin");
    expect(source).not.toHaveProperty("rampMax");
    expect(effective).not.toHaveProperty("style");
  });

  it("compiles a starting style the way the editor's save does", () => {
    // Full range: raw values. Anything less: normalized until the file's own
    // range is resolved.
    const pinnedRange = resolveEffectiveRasterConfig(
      savedLayer(),
      description("https://h/a.tif", {
        style: { rampName: "viridis", rampMin: 0, rampMax: 50 },
      }),
    );
    expect(pinnedRange.props.source.props.normalize).toBe(false);
    expect(JSON.stringify(pinnedRange.style.color)).toContain("50");

    const open = resolveEffectiveRasterConfig(
      savedLayer(),
      description("https://h/a.tif", { style: { rampName: "magma" } }),
    );
    expect(open.props.source.props.normalize).toBe(true);
    expect(open.style.color).toBeDefined();
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
    const saved = savedLayer({ source: { rampName: "Blues" } });

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
      source: { rampName: "Blues" },
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
      savedLayer({ source: { rampName: "viridis", rampReverse: true } }),
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
      savedLayer({ source: { rampName: "viridis" } }),
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

  it("keeps a pinned categorical style and reports no colorbar for it", async () => {
    mockFiles({ "https://h/a.tif": statsFile(0, 1) });
    const built = await build(
      savedLayer({
        source: {
          rampName: "Blues",
          styleMode: "categorical",
          classes: [{ value: 1, color: "#ff0000" }],
        },
        pluginSource: { stylePinned: true },
      }),
      description("https://h/a.tif", { style: { rampName: "viridis" } }),
    );
    expect(built.legendRamp).toBeNull();
    expect(JSON.stringify(built.style.color)).toContain("match");
    expect(built.source.options.interpolate).toBe(false);
  });

  it("fails on a projection it cannot place, without building a source", async () => {
    mockFiles({ "https://h/a.tif": statsFile(0, 1) });
    await expect(
      build(
        savedLayer({ source: { rampName: "viridis" } }),
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
          savedLayer({ source: { rampName: "viridis" } }),
          description("https://h/huge.tif"),
        );
        applyRuntimeRaster(layer, built);
      })(),
    ).rejects.toThrow(GeoTIFFError);
    await expect(
      build(
        savedLayer({ source: { rampName: "viridis" } }),
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
      savedLayer({ source: { rampName: "viridis" } }),
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
        savedLayer({ source: { rampName: "viridis" } }),
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
        savedLayer({ source: { rampName: "viridis" } }),
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
