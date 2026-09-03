import { moduleMap } from "components/map/moduleMap";
import { Vector as VectorSource } from "ol/source.js";
import MVT from "ol/format/MVT.js";
import KML from "ol/format/KML.js";
import GeoJSON from "ol/format/GeoJSON.js";
import EsriJSON from "ol/format/EsriJSON";
import { tile as tileStrategy } from "ol/loadingstrategy.js";
import { createXYZ } from "ol/tilegrid.js";
import DataTile from "ol/source/DataTile.js";
import TileGrid from "ol/tilegrid/TileGrid.js";
import {
  Style,
  Circle as CircleStyle,
  RegularShape,
  Icon,
  Fill,
  Stroke,
} from "ol/style";
import {
  defaultFill,
  defaultStroke,
  defaultStrokeWidth,
  defaultSize,
  defaultZIndex,
  defaultShape,
  defaultHatchSpacing,
  defaultHatchDirection,
  defaultDotSpacing,
  defaultDotRadius,
} from "components/inputs/RuleEditor.js";
import {
  rewriteArcGISExportUrlForAntimeridian,
  readFeatureCollection,
  coerceOptionalBoolean,
} from "components/map/utilities";
import { acquireComponents } from "components/map/shapefile/acquire";
import { interpretShapefile } from "components/map/shapefile/index";
import { CANCEL_REASON } from "components/map/layerStatus";
import {
  buildGeoTIFFStyleColor,
  buildCategoricalStyleColor,
  isUsableClass,
} from "components/map/geoTIFFStyle";
import proj4 from "proj4";
import { get as getProjection } from "ol/proj.js";
import { register as registerProj4 } from "ol/proj/proj4.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm";
import { readSlice } from "components/map/zarrReader";

const moduleCache = {};
const styleCache = new Map();

const ISOLATED_LAYER_TYPES = new Set(["ImageLayer", "TileLayer"]);
let isolatedLayerCount = 0;

// Inject an OpenLayers `imageLoadFunction` for ESRI Image and Map Service
// sources that rewrites out-of-range BBOX requests to use a shifted Web
// Mercator central meridian. Without this, panning past the antimeridian
// produces a blank layer because the ArcGIS /export endpoint can't render an
// out-of-range BBOX. Leave any user-supplied imageLoadFunction untouched.
export function withAntimeridianFix(type, props) {
  if (type !== "ESRI Image and Map Service") return props;
  if (props?.imageLoadFunction != null) return props;
  return {
    ...props,
    imageLoadFunction: (image, src) => {
      image.getImage().src = rewriteArcGISExportUrlForAntimeridian(src);
    },
  };
}

export function withIsolatedCanvas(type, props) {
  if (!ISOLATED_LAYER_TYPES.has(type)) return props;
  if (props?.className) return props;
  isolatedLayerCount += 1;
  return {
    ...props,
    className: `ol-layer tethysdash-layer-${isolatedLayerCount}`,
  };
}

const CORS_PROBED_SOURCE_TYPES = new Set([
  "ESRI Image and Map Service",
  "WMS",
  "Static Image",
]);

const CORS_PROBE_TIMEOUT_MS = 4000;
const corsSupportByOrigin = new Map();

async function serverAllowsCors(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CORS_PROBE_TIMEOUT_MS);
  try {
    await fetch(url, {
      method: "HEAD",
      mode: "cors",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function cachedCorsSupport(url) {
  let origin;
  try {
    origin = new URL(url, window.location.href).origin;
  } catch {
    return Promise.resolve(false);
  }
  if (!corsSupportByOrigin.has(origin)) {
    corsSupportByOrigin.set(origin, serverAllowsCors(url));
  }
  return corsSupportByOrigin.get(origin);
}

export async function withAutoCrossOrigin(type, props) {
  if (!CORS_PROBED_SOURCE_TYPES.has(type)) return props;
  // An explicit choice in the layer editor wins over detection.
  if (props?.crossOrigin !== undefined) return props;
  if (typeof props?.url !== "string" || props.url === "") return props;
  return (await cachedCorsSupport(props.url))
    ? { ...props, crossOrigin: "anonymous" }
    : props;
}

async function prepareProps(type, props) {
  return withIsolatedCanvas(
    type,
    await withAutoCrossOrigin(type, withAntimeridianFix(type, props)),
  );
}

// A "Zarr" source reads a public store directly in the browser (see zarrReader):
// one 2-D slice becomes an ol/source/DataTile with band 1 = value and band 2 =
// alpha/nodata mask. Variable inputs in the fields (e.g. index="${Storm}") are
// already substituted before this runs.

export class ZarrError extends Error {}

// The whole slice becomes one WebGL texture, so the grid cannot exceed the
// driver's max texture dimension. OpenLayers does not check this on the
// DataTile upload path — an oversized tile fails with GL_INVALID_VALUE and
// renders blank with no error — so check it here and say what went wrong.
// 4096 is the floor guaranteed by WebGL2 implementations; probe for the real
// limit when a context is available.
const MIN_GUARANTEED_TEXTURE_SIZE = 4096;
let maxTextureSize = null;

export function getMaxTextureSize() {
  if (maxTextureSize !== null) return maxTextureSize;
  maxTextureSize = MIN_GUARANTEED_TEXTURE_SIZE;
  try {
    const gl = document
      .createElement("canvas")
      .getContext("webgl2", { failIfMajorPerformanceCaveat: false });
    const probed = gl?.getParameter(gl.MAX_TEXTURE_SIZE);
    if (Number.isFinite(probed) && probed > 0) maxTextureSize = probed;
  } catch {
    // No WebGL context available (headless/test): keep the guaranteed floor.
  }
  return maxTextureSize;
}

// The tile grid carries a single resolution derived from the x axis, so a store
// whose cells are not square would be drawn stretched along y. Tolerate the
// rounding a float transform introduces; reject a real mismatch rather than
// render the raster at the wrong vertical scale.
const PIXEL_ASPECT_TOLERANCE = 1e-6;

function assertSquarePixels(pixelSize) {
  if (!pixelSize) return; // reader predates pixelSize; nothing to check
  const { x, y } = pixelSize;
  if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y <= 0) return;
  if (Math.abs(x - y) / Math.max(x, y) > PIXEL_ASPECT_TOLERANCE) {
    throw new ZarrError(
      `This Zarr store has non-square cells (${x} x ${y}), which would be ` +
        `drawn at the wrong vertical scale. Resample the store to square ` +
        `cells or publish it as a GeoTIFF.`,
    );
  }
}

function assertRenderableTileSize(width, height) {
  const limit = getMaxTextureSize();
  if (width > limit || height > limit) {
    throw new ZarrError(
      `This Zarr slice is ${width}x${height} cells, which exceeds this ` +
        `browser's maximum texture size of ${limit}. The whole slice is ` +
        `rendered as a single tile, so it cannot be drawn. Downsample the ` +
        `store or publish it as a tiled GeoTIFF instead.`,
    );
  }
}

// The slice a Zarr source currently points at, as readSlice args. Used both to
// key the single slice read and to gate applyZarrRamp from restyling an
// unchanged slice.
function zarrSliceParams(source) {
  const { url, variable, index, mask_below } = source?.props ?? {};
  return {
    // s3:// is accepted here for parity with the GeoParquet and GeoPackage
    // sources; the browser can only fetch the public https form.
    url: s3UrlToHttps(url),
    variable,
    index: Number(index ?? 0),
    maskBelow:
      mask_below === "" || mask_below == null ? undefined : Number(mask_below),
  };
}

export function zarrSliceKey(source) {
  return JSON.stringify(zarrSliceParams(source));
}

// Read the slice once per distinct slice, shared across layer rebuilds and
// across applyZarrRamp/loadZarr — so the ramp and the tile data never re-read
// or disagree about the slice. Module-scoped rather than stashed on the source
// config: a config object is rebuilt on every variable-input change (so a memo
// held there never survives to serve a revisited slice) and is persisted state
// that should hold no promises. Rejections are evicted so a transient network
// or CORS failure can retry instead of pinning the layer to that error.
const zarrSliceCache = new Map();
// Revisiting slices is the common case (a variable input stepping through an
// index), so keep a few rather than one, but bound the retained decoded arrays.
const ZARR_SLICE_CACHE_MAX = 8;

// Test seam: these caches are module-scoped by design, so a suite that asserts
// on read counts needs to start from empty.
export function clearClientSourceCaches() {
  zarrSliceCache.clear();
  geoParquetCache.clear();
}

function getZarrSlice(source) {
  const key = zarrSliceKey(source);
  if (!zarrSliceCache.has(key)) {
    if (zarrSliceCache.size >= ZARR_SLICE_CACHE_MAX) {
      zarrSliceCache.delete(zarrSliceCache.keys().next().value);
    }
    zarrSliceCache.set(
      key,
      readSlice(zarrSliceParams(source)).catch((error) => {
        zarrSliceCache.delete(key);
        throw error;
      }),
    );
  }
  return zarrSliceCache.get(key);
}

// Build the DataTile source for a Zarr layer from its slice. The map adopts the
// store's CRS via the getView() shim, so the single tile needs no per-tile
// reprojection.
export async function loadZarr(config, mapProjection) {
  let slice;
  try {
    slice = await getZarrSlice(config);
  } catch (error) {
    // The browser makes this fetch, so a store without CORS headers reports
    // only an opaque network failure. Name the likely causes rather than
    // letting the raw error reach the generic "failed to load" banner.
    throw new ZarrError(
      `Could not read the Zarr store at ${zarrSliceParams(config).url}: ` +
        `${error?.message ?? error}. Check the store URL and variable name, ` +
        `and that the host sends CORS headers (Access-Control-Allow-Origin).`,
    );
  }
  const { data, width, height, extent, crs, pixelSize } = slice;
  registerGeoPackageProjections(); // resolve UTM store CRSs
  const projection = crs
    ? resolveProjectionOrThrow(crs, {
        ErrorType: ZarrError,
        what: "This Zarr store's `crs` attr",
      })
    : mapProjection;
  assertRenderableTileSize(width, height);
  assertSquarePixels(pixelSize);
  const resolution = (extent[2] - extent[0]) / width;

  const source = new DataTile({
    loader: () => data, // one tile holds the whole slice
    bandCount: 2, // band 1 = value, band 2 = alpha/nodata mask
    // GUI inputs emit strings, and the string "false" is truthy.
    interpolate: coerceOptionalBoolean(config.props?.interpolate) ?? false,
    projection,
    tileGrid: new TileGrid({
      extent,
      origin: [extent[0], extent[3]],
      tileSizes: [[width, height]],
      resolutions: [resolution],
    }),
  });
  // Map.js auto-fits raster layers by calling getView() on the source; expose a
  // compatible shim so the map fits to the slice extent and adopts the store CRS.
  source.getView = async () => ({
    projection,
    extent,
    center: [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2],
    zoom: 0,
  });
  return source;
}

// A GeoTIFF source is authored as flat fields (url + optional projection),
// like every other source type. OpenLayers wants a `sources` array with the
// per-file options inside it and the projection alongside, so assemble that here
// rather than making authors write it. `nodata` is not authored — applyAutoRamp
// puts the raster's own value here before this runs.
export function geotiffSourceToOL(config) {
  const { url, nodata, projection, mask_below, ...rest } = config.props ?? {};
  const sourceInfo = { url };
  if (nodata !== undefined) sourceInfo.nodata = nodata;
  const props = { ...rest, sources: [sourceInfo] };
  if (projection !== undefined && projection !== "") {
    props.projection = projection;
  }
  return { ...config, props };
}

// Where to read STATISTICS_* for a ramp-styled GeoTIFF source, or null when the
// source is not a candidate for an auto-fitted ramp.
//
// The GeoTIFF URL is author-supplied, so it is restricted to http(s):
// file:/blob:/data:/protocol-relative must not be fetched.
function autoRampStatsUrl(source) {
  if (source?.type !== "GeoTIFF") return null;

  const url = source.props?.url;
  return typeof url === "string" && /^https?:\/\//i.test(url) ? url : null;
}

// Settle which nodata value a GeoTIFF renders with. Authors do not set this:
// the value is the raster's own business, read from its GDAL_NODATA tag. To hide
// a range of real values, `mask_below` is the control.
//
// When the file declares nothing, default to NaN: OL has a dedicated NaN branch
// (plain equality would never match, since NaN !== NaN), and NaN is never
// meaningful data, so masking it cannot hide a real value. Returning a value in
// every case means OL always appends an alpha band, so the style always has a
// band 2 to guard.
function resolveNodata(fileNodata) {
  return fileNodata === null || fileNodata === undefined ? NaN : fileNodata;
}

// GDAL often keeps statistics in a PAM sidecar (`<file>.aux.xml`) instead of the
// TIFF -- `gdalinfo -stats` writes there by default. geotiff.js only reads the
// TIFF, so those files look statistics-less and get no fitted ramp or legend.
// Read the sidecar as a fallback. A 404 is the normal case for files that embed
// their statistics, so every failure here is silent.
async function fetchSidecarStats(url) {
  try {
    const response = await fetch(`${url}.aux.xml`);
    if (!response.ok) return {};
    const doc = new DOMParser().parseFromString(
      await response.text(),
      "application/xml",
    );
    // Scope to the first band; a multi-band PAM file repeats these keys.
    const band = doc.querySelector("PAMRasterBand") ?? doc;
    const stats = {};
    band.querySelectorAll("MDI").forEach((item) => {
      const key = item.getAttribute("key");
      if (key) stats[key] = item.textContent;
    });
    return stats;
  } catch {
    return {};
  }
}

// Fit a Zarr layer's ramp to its slice's real value range. min/max come from the
// decoded slice (via the shared getZarrSlice); masking already lives in the
// slice's alpha band, so nodata is not re-derived here. Gated on the slice key so
// it restyles only when the slice changes (e.g. a variable input swaps it).
export async function applyZarrRamp(layerConfig) {
  const source = layerConfig?.props?.source;
  const { rampName, rampMin, rampMax } = source ?? {};
  const hasMin = (rampMin ?? "") !== "";
  const hasMax = (rampMax ?? "") !== "";
  const isCategorical =
    source?.styleMode === "categorical" &&
    (source?.classes ?? []).some(isUsableClass);
  // With no ramp and no classes there is still a style to build. A DataTile
  // carries raw values with no normalization (unlike the GeoTIFF source this
  // replaced, which rendered `normalize: true` grayscale), so leaving the layer
  // unstyled paints raw floats straight into the color channels. Fit grayscale
  // to the slice instead, which is what the old backend path effectively did.
  const effectiveRamp = rampName || (isCategorical ? null : "grayscale");
  if (!effectiveRamp && !isCategorical) return layerConfig;

  // Gates the slice read, not the style: ramp settings are not part of the
  // slice key, so the style is rebuilt on every call from the resolved slice.
  const key = zarrSliceKey(source);

  try {
    if (isCategorical) {
      layerConfig.style = {
        ...(layerConfig.style ?? {}),
        color: buildCategoricalStyleColor({
          classes: source.classes,
          hasNodata: true,
          maskBelow: source.props?.mask_below,
          fallbackColor: source.fallbackColor,
        }),
      };
      source.resolvedSliceKey = key;
      return layerConfig;
    }

    const slice = await getZarrSlice(source);
    // A pinned bound wins; the empty one comes from the slice's real range.
    let lo = hasMin ? Number(rampMin) : slice.min;
    let hi = hasMax ? Number(rampMax) : slice.max;
    if (!Number.isFinite(lo)) lo = slice.min;
    if (!Number.isFinite(hi)) hi = slice.max;

    // A degenerate range compiles to an `interpolate` whose GPU form divides by
    // (stop2 - stop1), so equal stops yield NaN colors and an inverted pair a
    // broken ramp. The GeoTIFF path falls back to normalized mode here, but a
    // Zarr DataTile carries raw values with no normalization, so widen to a
    // valid ascending span instead: a uniform slice then renders at the ramp's
    // low end rather than as NaN.
    if (hi <= lo) hi = lo + 1;

    layerConfig.style = {
      ...(layerConfig.style ?? {}),
      color: buildGeoTIFFStyleColor({
        rampName: effectiveRamp,
        rampMin: lo,
        rampMax: hi,
        rampReverse: source.rampReverse === true,
        hasNodata: true,
        maskBelow: source.props?.mask_below,
      }),
    };
    source.resolvedSliceKey = key;
    source.resolvedRampMin = lo;
    source.resolvedRampMax = hi;
  } catch {
    // Slice unreadable: leave the style; loadZarr surfaces the error on build.
  }
  return layerConfig;
}

// Fit a ramp-styled raster layer's color ramp to the file's real value range.
//
// Left alone, such a layer renders with `normalize: true`, which makes OL scale
// the band into a Uint8Array from the file's STATISTICS_* tags (min -> 0,
// max -> 255). The ramp auto-fits, but `layer.getData()` hands back those
// normalized bytes, so a click reports 0-255 instead of a real value.
//
// Reading the same tags here lets us style raw values instead: `normalize` goes
// off (tile data stays float32) and the ramp is rebuilt over the file's actual
// [min, max]. Same auto-fit behavior, true values on click, and a legend that
// can label real units.
//
// This matters most when the URL carries a variable input — a new storm or
// timestep is a different file with a different range, and the ramp refits to
// each one. The stats live in the header of the very URL the source is about to
// fetch, so the browser serves OL's own header read from cache. Any failure is
// non-fatal: the config is left untouched and rendering falls back to
// normalized mode.
//
// Each bound is independent: whichever the author left empty is resolved from
// the file, and whichever they set is honored as a pinned end of the ramp. So a
// min of 0 with an empty max gives a ramp anchored at 0 that still grows to fit
// each file's peak.
export async function applyAutoRamp(layerConfig) {
  const source = layerConfig?.props?.source;
  if (source?.type === "Zarr") return applyZarrRamp(layerConfig);
  const { rampName, rampMin, rampMax } = source ?? {};
  const hasMin = (rampMin ?? "") !== "";
  const hasMax = (rampMax ?? "") !== "";
  // A categorical layer colors by exact class value, so it needs no range at
  // all — but it still needs the header read to settle nodata, and it must
  // style raw values rather than OL's normalized bytes for the match to line up.
  const isCategorical =
    source?.styleMode === "categorical" &&
    (source?.classes ?? []).some(isUsableClass);
  // The header is read even when both bounds are pinned, because it also
  // settles nodata — a pinned layer still needs its transparency right.
  if (!rampName && !isCategorical) return layerConfig;

  // Keyed on the URL so this is safe to call from more than one place per
  // render, while still re-resolving when the source points at another file.
  const statsUrl = autoRampStatsUrl(source);
  if (!statsUrl || source.resolvedRampUrl === statsUrl) return layerConfig;

  try {
    const { fromUrl } = await import("geotiff");
    const image = await (await fromUrl(statsUrl)).getImage();
    // getGDALMetadata(0) returns items tagged for sample 0 only; passing null
    // returns the dataset-level items. Writers differ -- rio-cogeo attaches
    // STATISTICS_* to the band, while GDAL and MATLAB's Mapping Toolbox write
    // them at dataset level -- so check the band first, then fall back.
    const meta = image.getGDALMetadata(0) ?? {};
    const dataset = image.getGDALMetadata(null) ?? {};

    // Settle nodata first: it is independent of the ramp range, and a file with
    // nodata but no statistics still needs its transparency handled. Zarr COGs
    // are built by us and always carry the -9999 sentinel already.
    if (source.type !== "Zarr") {
      source.props = {
        ...(source.props ?? {}),
        nodata: resolveNodata(image.getGDALNoData()),
      };
    }
    // Every path below leaves the source with a nodata value, so OL appends an
    // alpha band and the style always has a band 2 to guard.
    const styleFor = (rampMinValue, rampMaxValue) => ({
      ...(layerConfig.style ?? {}),
      color: buildGeoTIFFStyleColor({
        rampName,
        rampMin: rampMinValue,
        rampMax: rampMaxValue,
        rampReverse: source.rampReverse === true,
        hasNodata: true,
        maskBelow: source.props?.mask_below,
      }),
    });

    if (isCategorical) {
      // No statistics needed: the class values are the scale. Raw band values
      // are required though, so normalization goes off unconditionally.
      //
      // Nearest-neighbor resampling too. OL interpolates by default, which is
      // meaningless for class labels -- halfway between class 1 and 2 is not a
      // class -- and it fringes every nodata boundary: band 1 blends into a
      // value matching no class (so it takes the fallback color) while band 2
      // blends off 0 (so the nodata guard stops firing).
      source.props = {
        ...(source.props ?? {}),
        normalize: false,
        interpolate: false,
      };
      layerConfig.style = {
        ...(layerConfig.style ?? {}),
        color: buildCategoricalStyleColor({
          classes: source.classes,
          hasNodata: true,
          maskBelow: source.props?.mask_below,
          fallbackColor: source.fallbackColor,
        }),
      };
      source.resolvedRampUrl = statsUrl;
      return layerConfig;
    }

    let statsMin = meta.STATISTICS_MINIMUM ?? dataset.STATISTICS_MINIMUM;
    let statsMax = meta.STATISTICS_MAXIMUM ?? dataset.STATISTICS_MAXIMUM;
    // Only worth a sidecar request when a bound actually needs resolving and the
    // file embedded nothing. A Zarr COG is built by us and always embeds its
    // statistics, and its URL carries a query string, so it never applies.
    const needsStats =
      (!hasMin && statsMin === undefined) ||
      (!hasMax && statsMax === undefined);
    if (needsStats && source.type === "GeoTIFF") {
      const sidecar = await fetchSidecarStats(statsUrl);
      statsMin = statsMin ?? sidecar.STATISTICS_MINIMUM;
      statsMax = statsMax ?? sidecar.STATISTICS_MAXIMUM;
    }

    // A pinned bound wins; only the empty one comes from the statistics.
    let lo = hasMin ? Number(rampMin) : parseFloat(statsMin);
    const hi = hasMax ? Number(rampMax) : parseFloat(statsMax);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) {
      // No usable range, so rendering stays normalized — but rebuild the style
      // anyway so nodata cells are transparent rather than painted at band 1 = 0,
      // which is what the zero-filled tile array leaves them as.
      layerConfig.style = styleFor("", "");
      return layerConfig;
    }

    // Lift a resolved min to the mask threshold so the visible data spans the
    // whole ramp. A GeoTIFF is masked in the style, after the statistics were
    // written, so its stats still describe the values the mask hides. Zarr masks
    // server-side before writing stats, so its min already clears the threshold
    // and this is a no-op. A pinned min is the author's call and is left alone.
    // Skipped when the threshold covers the whole range: clamping there would
    // invert it, and the mask alone correctly renders everything transparent.
    const maskValue = Number(source.props?.mask_below);
    if (
      !hasMin &&
      Number.isFinite(maskValue) &&
      maskValue > lo &&
      maskValue < hi
    ) {
      lo = maskValue;
    }

    source.props = { ...(source.props ?? {}), normalize: false };
    layerConfig.style = styleFor(lo, hi);
    // Published for the colorbar legend. Kept in separate fields so the
    // author's own (empty) rampMin/rampMax keep meaning "auto" — writing back
    // onto those would read as a pinned range and freeze the ramp.
    source.resolvedRampUrl = statsUrl;
    source.resolvedRampMin = lo;
    source.resolvedRampMax = hi;
  } catch {
    // No stats, unreachable file, or an unreadable header: keep normalized mode.
  }
  return layerConfig;
}

export class GeoPackageError extends Error {}

// s3://bucket/key -> virtual-hosted https so the browser can fetch it directly.
export function s3UrlToHttps(url, defaultRegion = "us-east-1") {
  if (typeof url !== "string" || !url.startsWith("s3://")) return url;
  const rest = url.slice(5);
  const slash = rest.indexOf("/");
  const bucket = slash === -1 ? rest : rest.slice(0, slash);
  const key = slash === -1 ? "" : rest.slice(slash + 1);
  const region =
    bucket.match(/(us|eu|ap|sa|ca|me|af)-[a-z]+-\d+/)?.[0] ?? defaultRegion;
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

// Register proj4 + all WGS84 UTM zones so ol can reproject projected GeoPackages.
let projectionsRegistered = false;
export function registerGeoPackageProjections() {
  if (projectionsRegistered) return;
  for (let zone = 1; zone <= 60; zone++) {
    proj4.defs(
      `EPSG:${32600 + zone}`,
      `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs +type=crs`,
    );
    proj4.defs(
      `EPSG:${32700 + zone}`,
      `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs +type=crs`,
    );
  }
  registerProj4(proj4);
  projectionsRegistered = true;
}

// Lazy-load ol-load-geopackage and init the sql.js wasm loader once.
let geoPackageLib = null;
async function getGeoPackageLib() {
  if (!geoPackageLib) {
    const lib = await import("ol-load-geopackage");
    lib.initSqlJsWasm(sqlWasmUrl.replace(/\/sql-wasm\.wasm$/, ""));
    geoPackageLib = lib;
  }
  return geoPackageLib;
}

// Cache parsed gpkg per url+projection; one file often backs several layers.
const geoPackageCache = new Map();

// Read one GeoPackage table in-browser as a reprojected OL vector source.
export async function loadGeoPackage(config, mapProjection) {
  const rawUrl = config.props?.url;
  const table = config.props?.layer;
  if (!rawUrl) {
    throw new GeoPackageError("GeoPackage source requires a file URL");
  }
  if (!table) {
    throw new GeoPackageError("GeoPackage source requires a table name");
  }

  const url = s3UrlToHttps(rawUrl);
  registerGeoPackageProjections();
  const { loadGpkg } = await getGeoPackageLib();

  const cacheKey = `${url}::${mapProjection}`;
  if (!geoPackageCache.has(cacheKey)) {
    geoPackageCache.set(cacheKey, loadGpkg(url, mapProjection));
  }
  let dataByTable;
  try {
    [dataByTable] = await geoPackageCache.get(cacheKey);
  } catch (error) {
    geoPackageCache.delete(cacheKey);
    throw error;
  }

  const source = dataByTable[table];
  if (!source) {
    throw new GeoPackageError(
      `Table "${table}" not found in GeoPackage. Available tables: ` +
        Object.keys(dataByTable).join(", "),
    );
  }
  return source;
}

export class GeoParquetError extends Error {}

// OGC's lon/lat WGS84 authority code, spelled several ways across PROJJSON
// writers. OpenLayers registers "CRS:84" and the urn:/http: URI forms but not
// the bare "OGC:CRS84" that `${authority}:${code}` assembles, so normalize the
// whole family to EPSG:4326 rather than handing OL a code it silently cannot
// resolve.
const CRS84_ALIASES = /^(?:OGC:CRS84|CRS:84|CRS84)$/i;

// Map a GeoParquet column CRS (PROJJSON) to an OL projection code. A null/absent
// CRS means OGC:CRS84 (lon/lat WGS84) per the GeoParquet spec.
export function geoParquetCRSToProjection(crs) {
  if (crs === null || crs === undefined) return "EPSG:4326";
  const id = crs.id ?? crs.ids?.[0];
  if (!id) return "EPSG:4326";
  const code = `${id.authority}:${id.code}`;
  return CRS84_ALIASES.test(code) ? "EPSG:4326" : code;
}

// Resolve an author- or file-supplied projection code, or throw. Reprojection
// helpers treat an unknown code as "no transform" rather than an error, which
// renders the data at raw coordinates in the view's units — visibly wrong but
// silent. Failing here instead puts the layer in failedLayers with a message
// naming the code.
function resolveProjectionOrThrow(code, { ErrorType = Error, what }) {
  const projection = getProjection(code);
  if (!projection) {
    throw new ErrorType(
      `${what} declares projection "${code}", which is not registered. ` +
        `Add its definition to components/map/projections, or republish the ` +
        `data in a supported CRS (e.g. EPSG:4326).`,
    );
  }
  return code;
}

// Read the GeoParquet "geo" file metadata: primary geometry column + its CRS.
export function readGeoParquetGeoMetadata(metadata) {
  const geoValue = metadata?.key_value_metadata?.find(
    (kv) => kv.key === "geo",
  )?.value;
  if (!geoValue) {
    return { geometryColumn: "geometry", dataProjection: "EPSG:4326" };
  }
  const geo = JSON.parse(geoValue);
  const geometryColumn = geo.primary_column || "geometry";
  const dataProjection = geoParquetCRSToProjection(
    geo.columns?.[geometryColumn]?.crs,
  );
  return { geometryColumn, dataProjection };
}

// Lazy-load hyparquet + its codec pack; only needed when a GeoParquet renders.
let hyparquetLib = null;
async function getHyparquet() {
  if (!hyparquetLib) {
    const [hp, comp] = await Promise.all([
      import("hyparquet"),
      import("hyparquet-compressors"),
    ]);
    hyparquetLib = { ...hp, compressors: comp.compressors };
  }
  return hyparquetLib;
}

// Parquet INT64 columns arrive as BigInt, which throws on the JSON round-trip
// the popup/click and variable-input paths perform. Coerce recursively, since a
// list or struct column nests its BigInts out of reach of a flat pass, and fall
// back to a string past the safe-integer range so a 64-bit id (OSM, H3,
// snowflake) is preserved exactly rather than silently rounded.
export function coerceParquetValue(value) {
  if (typeof value === "bigint") {
    // Literals rather than BigInt(Number.MAX_SAFE_INTEGER): the BigInt global
    // is outside the configured eslint env, and these bounds are fixed anyway.
    return value >= -9007199254740991n && value <= 9007199254740991n
      ? Number(value)
      : value.toString();
  }
  if (Array.isArray(value)) return value.map(coerceParquetValue);
  // Plain objects only: a Date or other class instance is left as-is.
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    const proto = Object.getPrototypeOf(value);
    if (proto === Object.prototype || proto === null) {
      const out = {};
      for (const [key, nested] of Object.entries(value)) {
        out[key] = coerceParquetValue(nested);
      }
      return out;
    }
  }
  return value;
}

// One download+decode per file URL, shared across layer rebuilds. GeoParquet
// layers are VectorLayers, which the map's keep fast-path excludes, so the
// loader re-runs whenever any layer in the array changes — without this the
// whole file is re-fetched and re-decoded each time. Only the expensive,
// projection-independent half is cached: features are built per call so no two
// layers share mutable ol/Feature instances. Mirrors geoPackageCache above,
// including dropping the entry on failure so a transient error can retry.
const geoParquetCache = new Map();

// Read a GeoParquet file in-browser as a reprojected OL vector source. hyparquet
// decodes the WKB geometry column to GeoJSON (geoparquet:true); features are then
// reprojected from the file's declared CRS to the map projection.
export async function loadGeoParquet(config, mapProjection) {
  const rawUrl = config.props?.url;
  if (!rawUrl) {
    throw new GeoParquetError("GeoParquet source requires a file URL");
  }
  const url = s3UrlToHttps(rawUrl);
  registerGeoPackageProjections();

  if (!geoParquetCache.has(url)) {
    geoParquetCache.set(
      url,
      readGeoParquetFile(url).catch((error) => {
        geoParquetCache.delete(url);
        throw error;
      }),
    );
  }
  const { featureCollection, dataProjection } = await geoParquetCache.get(url);

  return new VectorSource({
    features: new GeoJSON().readFeatures(featureCollection, {
      dataProjection,
      featureProjection: mapProjection,
    }),
  });
}

async function readGeoParquetFile(url) {
  const {
    asyncBufferFromUrl,
    parquetMetadataAsync,
    parquetReadObjects,
    compressors,
  } = await getHyparquet();

  let metadata;
  let rows;
  try {
    const file = await asyncBufferFromUrl({ url });
    metadata = await parquetMetadataAsync(file);
    rows = await parquetReadObjects({ file, compressors, geoparquet: true });
  } catch (error) {
    // The browser makes this fetch, so a CORS-less host is the likeliest cause
    // and reports only an opaque network failure. Name both possibilities.
    throw new GeoParquetError(
      `Could not read the GeoParquet file at ${url}: ${error?.message ?? error}. ` +
        `Check the URL is reachable and that the host sends CORS headers ` +
        `(Access-Control-Allow-Origin) and supports range requests.`,
    );
  }

  const { geometryColumn, dataProjection } =
    readGeoParquetGeoMetadata(metadata);
  resolveProjectionOrThrow(dataProjection, {
    ErrorType: GeoParquetError,
    what: "This GeoParquet file",
  });

  const features = rows
    .map((row) => {
      const { [geometryColumn]: geometry, ...rest } = row;
      const properties = {};
      for (const [key, value] of Object.entries(rest)) {
        // ol/format/GeoJSON applies properties after the geometry, so a
        // residual column literally named "geometry" would overwrite it.
        if (key === "geometry") continue;
        properties[key] = coerceParquetValue(value);
      }
      return { type: "Feature", geometry: geometry ?? null, properties };
    })
    .filter((feature) => feature.geometry != null);

  return {
    featureCollection: { type: "FeatureCollection", features },
    dataProjection,
  };
}

const moduleLoader = async (config, mapProjection, getMapProjection) => {
  if (config.type === "GeoPackage") {
    return loadGeoPackage(config, mapProjection);
  }
  if (config.type === "GeoParquet") {
    return loadGeoParquet(config, mapProjection);
  }
  if (config.type === "Zarr") {
    // Reads the store client-side and returns a ready DataTile source.
    return loadZarr(config, mapProjection);
  }
  if (config.type === "GeoTIFF") {
    if (!config.props?.url) {
      throw new Error("GeoTIFFEmptySources");
    }
    config = geotiffSourceToOL(config);
  }
  if (
    config.type === "Static Image" &&
    typeof config.props?.imageExtent === "string"
  ) {
    config.props.imageExtent = config.props.imageExtent
      .split(",")
      .map((v) => parseFloat(v.trim()));
  }

  if (config.type.includes("ESRI")) {
    if (config.props?.params?.TIME) {
      config.props.params.TIME = config.props.params.TIME.split(",")
        .map((dateStr) => {
          const d = new Date(dateStr.trim());
          return isNaN(d) ? dateStr.trim() : d.getTime();
        })
        .join(",");
    }
  }

  const { type, props } = config;

  try {
    if (moduleCache[type]) {
      if (type === "GeoJSON") {
        return loadGeoJSON(config, mapProjection);
      } else if (type === "Shapefile") {
        return loadShapefile(config, mapProjection, getMapProjection);
      } else if (type === "ESRI Feature Service") {
        return loadESRIJSON(config);
      } else {
        const resolvedProps = await resolveProps(props, mapProjection);
        if (type === "Vector Tile") {
          resolvedProps.format = new MVT();
        }
        if (type === "KML") {
          resolvedProps.format = new KML();
        }
        return new moduleCache[type](await prepareProps(type, resolvedProps));
      }
    }
    const importModule = getModuleImporter(type);
    const module = await importModule();

    // Handle both default exports and named exports
    let ModuleConstructor = module.default;
    if (!ModuleConstructor) {
      ModuleConstructor =
        type === "PMTiles Vector"
          ? module.PMTilesVectorSource
          : module.PMTilesRasterSource;
    }

    if (typeof ModuleConstructor !== "function") {
      throw new Error(`Module '${type}' does not export a constructor.`);
    }

    moduleCache[type] = ModuleConstructor;

    const resolvedProps = await resolveProps(props, mapProjection);
    if (type === "Vector Tile") {
      resolvedProps.format = new MVT();
    }
    if (type === "KML") {
      resolvedProps.format = new KML();
    }

    if (type === "GeoJSON") {
      return loadGeoJSON(config, mapProjection);
    } else if (type === "Shapefile") {
      return loadShapefile(config, mapProjection, getMapProjection);
    } else if (type === "ESRI Feature Service") {
      return loadESRIJSON(config);
    } else {
      return new ModuleConstructor(await prepareProps(type, resolvedProps));
    }
  } catch (error) {
    console.error(`Failed to load module '${type}':`, error);
    throw error;
  }
};

// Helper function to resolve nested props
const resolveProps = async (props, mapProjection) => {
  if (!props) return {};

  const resolvedProps = {};

  for (const key of Object.keys(props)) {
    const value = props[key];

    if (key === "bands" && typeof value === "string") {
      const parsed = value
        .split(",")
        .map((b) => b.trim())
        .filter((s) => s !== "")
        .map(Number)
        .filter((n) => Number.isFinite(n));
      if (parsed.length > 0) {
        resolvedProps[key] = parsed;
      }
      continue;
    }
    if (key === "projection" && value === "") {
      continue;
    }

    if (key === "crossOrigin") {
      if (value === true || value === "true" || value === "anonymous") {
        resolvedProps[key] = "anonymous";
      }
      continue;
    }
    if (key === "overviews" && Array.isArray(value) && value.length === 0) {
      continue;
    }

    if (value && typeof value === "object") {
      if ("type" in value && "props" in value) {
        // It's a module configuration; process with moduleLoader
        resolvedProps[key] = await moduleLoader(value, mapProjection);
      } else if (Array.isArray(value)) {
        // It's an array; resolve each item
        resolvedProps[key] = await Promise.all(
          value.map(async (item) => {
            if (item && typeof item === "object") {
              return await resolveProps(item, mapProjection);
            } else {
              return item;
            }
          }),
        );
      } else {
        // It's a regular object; recursively resolve its properties
        resolvedProps[key] = await resolveProps(value, mapProjection);
      }
    } else {
      // It's a primitive value; assign as is
      resolvedProps[key] = convertType(value);
    }
  }

  if (
    props.sources &&
    Array.isArray(props.sources) &&
    props.normalize === undefined
  ) {
    // Default raw band values unless the layer explicitly asked to normalize.
    resolvedProps.normalize = false;
  }

  return resolvedProps;
};

function convertType(input) {
  let value = input;

  // If value is a string that starts with ".", prepend "0"
  if (typeof value === "string" && value.startsWith(".")) {
    value = "0" + value;
  }

  // Try converting to an integer
  const intVal = parseInt(value, 10);
  if (!isNaN(intVal) && intVal.toString() === value.toString()) {
    return intVal; // Return as an integer if it converts cleanly
  }

  // Try converting to a float
  const floatVal = parseFloat(value);
  if (!isNaN(floatVal) && floatVal.toString() === value.toString()) {
    return floatVal; // Return as a float if it converts cleanly
  }

  // If neither works, return the original value
  return input;
}

// Helper function to map type strings to module paths
const getModuleImporter = (type) => {
  const typeMapping = {
    // Map type strings to module paths
    WebGLTile: "ol/layer/WebGLTile.js",
    ImageLayer: "ol/layer/Image.js",
    VectorLayer: "ol/layer/Vector.js",
    VectorTileLayer: "ol/layer/VectorTile.js",
    TileLayer: "ol/layer/Tile.js",
    "Image Tile": "ol/source/ImageTile.js",
    "Vector Tile": "ol/source/VectorTile.js",
    "ESRI Image and Map Service": "ol/source/ImageArcGISRest.js",
    Vector: "ol/source/Vector.js",
    WMS: "ol/source/ImageWMS.js",
    Raster: "ol/source/Raster.js",
    GeoJSON: "ol/format/GeoJSON.js",
    Shapefile: "ol/source/Vector.js",
    KML: "ol/source/Vector.js",
    Style: "ol/style/Style.js",
    Stroke: "ol/style/Stroke.js",
    Fill: "ol/style/Fill.js",
    "ESRI Feature Service": "ol/format/EsriJSON.js",
    InvalidForTesting: "DontUseThis",
    "PMTiles Vector": "ol-pmtiles",
    "PMTiles Raster": "ol-pmtiles",
    "Static Image": "ol/source/ImageStatic.js",
    GeoTIFF: "ol/source/GeoTIFF.js",
    "bad-module": "bad-module",
    // Add other mappings as needed
  };

  const modulePath = typeMapping[type];

  if (!modulePath) {
    throw new Error(`No module path found for type '${type}'.`);
  }

  const importer = moduleMap[modulePath];

  if (!importer) {
    throw new Error(`No importer found for module path '${modulePath}'.`);
  }

  return importer;
};

/**
 * Build the vector source for a `Shapefile` layer.
 *
 * Features load through OpenLayers' own loader hook rather than being fetched
 * ahead of construction, which buys three things: the loader is handed the live
 * view projection when it runs, its success/failure callbacks drive the
 * `featuresloadstart` / `featuresloadend` / `featuresloaderror` events, and it
 * is not called at all until the layer is actually mounted and rendering.
 *
 * `getMapProjection`, when supplied, is read at the moment features are inserted
 * rather than when the load began. A shapefile is the slowest-loading vector
 * source in the app, so it is the one most exposed to a sibling raster's auto-fit
 * changing the view mid-load -- and features parsed into a projection the map has
 * already left are drawn thousands of kilometres off screen while still reporting
 * the right feature count.
 *
 * The single `shapefileController` set on the source is the whole channel between
 * this module and the map: abort, status, error and reset. Hanging those on the
 * source as loose properties would give two modules an undocumented surface each
 * discovered by reaching into the other's object.
 */
export const loadShapefile = (config, mapProjection, getMapProjection) => {
  const { url, projection: fallbackProjection } = config.props ?? {};
  // Mirrors the GeoTIFF sentinel: a half-authored source is silent rather than
  // an error, so typing a URL does not paint a failure after every keystroke.
  if (!url) throw new Error("ShapefileEmptySources");

  let abortController = null;
  let status = "idle";
  let failure = null;

  const source = new VectorSource();

  source.setLoader(async (extent, resolution, projection, success, onError) => {
    // Held locally as well as on the closure. The closure slot is what `abort`
    // and a second invocation write to, so comparing the two is how this run
    // learns it is no longer the current one.
    const controller = new AbortController();
    abortController = controller;
    status = "loading";
    failure = null;

    const finish = (nextStatus, nextFailure) => {
      status = nextStatus;
      failure = nextFailure ?? null;
      abortController = null;
    };

    // Aborting stops the fetch, but the parse that follows it is CPU-bound and
    // runs to completion regardless. A run that is no longer current must write
    // nothing at all: its layer may already be gone, and because status is kept
    // per layer *name*, a late success would land under whichever source owns
    // that name now -- erasing a live error and leaving a blank layer that
    // reports nothing. Staying silent is also why neither callback fires here:
    // the events they raise are still wired to this dead source.
    const superseded = () => abortController !== controller;

    try {
      const acquired = await acquireComponents(url, {
        signal: controller.signal,
      });
      if (superseded()) return;
      if (acquired.cancelled) {
        finish("idle");
        onError?.();
        return;
      }
      if (acquired.error) {
        finish("error", acquired.error);
        onError?.();
        return;
      }

      const interpreted = await interpretShapefile(acquired.components, {
        fallbackProjection,
      });
      if (superseded()) return;
      if (interpreted.error) {
        finish("error", interpreted.error);
        onError?.();
        return;
      }

      // Read against the view as it stands now, not as it stood when the fetch
      // was issued.
      const targetProjection =
        getMapProjection?.() ?? projection?.getCode?.() ?? mapProjection;
      const features = readFeatureCollection(
        interpreted.featureCollection,
        targetProjection,
      );
      source.addFeatures(features);
      finish("ready");
      success?.(features);
    } catch (error) {
      // Both stages above report failures as values, so nothing here throws by
      // design. A dynamic import still can -- a deploy invalidates the chunk a
      // stale tab asks for -- and OpenLayers calls the loader without a catch of
      // its own, so an escaping rejection would leave the layer reporting
      // "loading" forever, with no error shown and no retry offered.
      if (superseded()) return;
      finish("error", {
        stage: "fetch",
        reason: "unexpected",
        detail: `The shapefile could not be loaded: ${error?.message ?? error}`,
      });
      onError?.();
    }
  });

  source.set("shapefileController", {
    getStatus: () => status,
    getError: () => failure,
    abort: (reason) => {
      if (abortController) {
        abortController.abort(reason);
        abortController = null;
        status = "idle";
      }
    },
    // `refresh` is the only primitive that actually causes the loader to run
    // again. Removing the loaded extent alone leaves it un-invoked, because the
    // renderer short-circuits its frame on an unchanged layer revision -- which
    // is how a retry button ends up doing nothing while its test passes.
    reset: () => {
      // Abort first. Nothing disables the retry affordance while a load runs,
      // and `refresh` exists to force the loader to run again, so two runs can
      // otherwise overlap -- the second replacing the first's controller and
      // leaving it uncancellable.
      if (abortController) {
        abortController.abort(CANCEL_REASON.SUPERSEDED);
        abortController = null;
      }
      status = "idle";
      failure = null;
      source.refresh();
    },
  });

  return source;
};

const loadGeoJSON = (config, mapProjection) => {
  const geojson = config.geojson;

  if (typeof geojson === "string") {
    return new VectorSource({
      url: geojson,
      format: new GeoJSON({ featureProjection: mapProjection }),
    });
  }

  return new VectorSource({
    features: new GeoJSON().readFeatures(geojson, {
      dataProjection: geojson.crs?.properties?.name,
      featureProjection: mapProjection,
    }),
  });
};

export const loadESRIJSON = (config) => {
  const vectorSource = new VectorSource({
    format: new EsriJSON(),
    url: function (extent, resolution, projection) {
      // ArcGIS Server only wants the numeric portion of the projection ID.
      const srid = projection
        .getCode()
        .split(/:(?=\d+$)/)
        .pop();

      let serviceUrl = config.props.url;
      serviceUrl += serviceUrl.endsWith("/")
        ? config.props.layer
        : `/${config.props.layer}`;

      let url =
        serviceUrl +
        "/query/?f=json&" +
        "returnGeometry=true&spatialRel=esriSpatialRelIntersects&geometry=" +
        encodeURIComponent(
          '{"xmin":' +
            extent[0] +
            ',"ymin":' +
            extent[1] +
            ',"xmax":' +
            extent[2] +
            ',"ymax":' +
            extent[3] +
            ',"spatialReference":{"wkid":' +
            srid +
            "}}",
        ) +
        "&geometryType=esriGeometryEnvelope&inSR=" +
        srid +
        "&outFields=*" +
        "&outSR=" +
        srid;

      if (config.props.params?.WHERE) {
        url += "&where=" + config.props.params.WHERE;
      }

      if (config.props.params?.TIME) {
        url += "&time=" + config.props.params.TIME;
      }

      return url;
    },

    strategy: tileStrategy(
      createXYZ({
        tileSize: 512,
      }),
    ),
    attributions: config.props.attributions,
  });
  return vectorSource;
};

function createDotFill({ color, radius, spacing }) {
  const canvas = document.createElement("canvas");
  canvas.width = spacing;
  canvas.height = spacing;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.arc(spacing / 2, spacing / 2, radius, 0, Math.PI * 2);
  ctx.fill();

  const pattern = ctx.createPattern(canvas, "repeat");

  return new Fill({
    color: pattern,
  });
}

function createHatchFill({ color, spacing, direction }) {
  const canvas = document.createElement("canvas");
  canvas.width = spacing;
  canvas.height = spacing;

  const ctx = canvas.getContext("2d");
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;

  if (direction === "horizontal" || direction === "cross") {
    ctx.beginPath();
    ctx.moveTo(0, spacing / 2);
    ctx.lineTo(spacing, spacing / 2);
    ctx.stroke();
  }

  if (direction === "vertical" || direction === "cross") {
    ctx.beginPath();
    ctx.moveTo(spacing / 2, 0);
    ctx.lineTo(spacing / 2, spacing);
    ctx.stroke();
  }

  if (direction === "diagonal") {
    ctx.beginPath();
    ctx.moveTo(0, spacing);
    ctx.lineTo(spacing, 0);
    ctx.stroke();
  }

  const pattern = ctx.createPattern(canvas, "repeat");

  return new Fill({
    color: pattern,
  });
}

function mergeStyleProperties(base, override) {
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(override).filter(([, v]) => v !== undefined),
    ),
  };
}

export function matchesCondition(featureValue, type, conditionValue) {
  const a = featureValue;

  // Presence checks must operate on the raw value: Number("") is 0, which would
  // defeat the empty-string check after numeric coercion.
  if (type === "isNull") {
    return a === null || a === undefined || a === "";
  }
  if (type === "isNotNull") {
    return a !== null && a !== undefined && a !== "";
  }

  // A field the feature does not carry cannot satisfy a comparison. Without this
  // the negated operators invert into a match: `!=` becomes `undefined !== x`,
  // and `notIn` becomes "not in the list", both true -- so one saved rule
  // repaints every feature of a layer whose .dbf is missing or whose schema
  // drifted upstream. The layer still renders, so nothing fails and nobody is
  // told. The presence checks above deliberately run first: asking whether an
  // absent field is null is a question with a real answer.
  if (a === null || a === undefined) return false;

  const coerce = (v) => (typeof v === "string" && !isNaN(v) ? Number(v) : v);

  const av = coerce(a);

  // List membership: conditionValue is a comma-separated list of literals.
  if (type === "in" || type === "notIn") {
    const list =
      typeof conditionValue === "string"
        ? conditionValue
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s !== "")
            .map(coerce)
        : [];
    if (list.length === 0) return false;
    const found = list.includes(av);
    return type === "in" ? found : !found;
  }

  const b = coerce(conditionValue);

  switch (type) {
    case "=":
      return av === b;
    case "!=":
      return av !== b;
    case "<":
      return av < b;
    case "<=":
      return av <= b;
    case ">":
      return av > b;
    case ">=":
      return av >= b;
    default:
      return false;
  }
}

export function resolveAllStyleValues(merged, properties) {
  if (!merged.propertyRefs || typeof merged.propertyRefs !== "object") {
    return merged;
  }
  const resolved = { ...merged };
  for (const [key, fieldName] of Object.entries(merged.propertyRefs)) {
    if (typeof fieldName !== "string" || !fieldName) continue;
    const fv = properties[fieldName];
    if (fv !== undefined && fv !== null && fv !== "") {
      resolved[key] = fv;
    }
  }
  return resolved;
}

function evaluateCondition({ field, type, value, valueIsField }, properties) {
  const fv = properties[field];
  let ruleValue = valueIsField ? properties[value] : value;
  if (
    typeof fv === "number" &&
    typeof ruleValue === "string" &&
    !isNaN(ruleValue)
  ) {
    ruleValue = Number(ruleValue);
  }
  return matchesCondition(fv, type, ruleValue);
}

export function ruleMatches(rule, properties) {
  const conditions = [];

  if (rule.conditionField && rule.conditionType) {
    conditions.push({
      field: rule.conditionField,
      type: rule.conditionType,
      value: rule.conditionValue,
      valueIsField: !!rule.conditionValueIsField,
    });
  }

  if (Array.isArray(rule.conditions)) {
    for (const c of rule.conditions) {
      if (c && c.field && c.type) {
        conditions.push(c);
      }
    }
  }

  if (conditions.length === 0) return false;

  const combinator = rule.conditionCombinator === "OR" ? "OR" : "AND";
  return combinator === "OR"
    ? conditions.some((c) => evaluateCondition(c, properties))
    : conditions.every((c) => evaluateCondition(c, properties));
}

export function resolveSize(feature, rules, defaultSize) {
  let size = defaultSize;
  let bestThreshold = null;

  for (const rule of rules) {
    if (rule.size == null) continue;

    const featureValue = feature.get(rule.conditionField);
    if (featureValue == null) continue;

    const ruleValue = Number(rule.conditionValue);
    const fv = Number(featureValue);

    if (isNaN(ruleValue) || isNaN(fv)) continue;

    const matches = matchesCondition(fv, rule.conditionType, ruleValue);
    if (!matches) continue;

    if (bestThreshold === null || ruleValue > bestThreshold) {
      bestThreshold = ruleValue;
      size = Number(rule.size);
    }
  }

  return size;
}

export function createTrapezoidIconStyle({ size, fill, stroke, rotation = 0 }) {
  const canvasSize = size * 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;

  const ctx = canvas.getContext("2d");
  ctx.translate(canvasSize / 2, canvasSize / 2);

  ctx.fillStyle = fill.getColor();
  ctx.strokeStyle = stroke.getColor();
  ctx.lineWidth = stroke.getWidth();

  const topHalfWidth = size * 0.5;
  const baseHalfWidth = size;
  const halfHeight = size * 0.5;

  ctx.beginPath();
  ctx.moveTo(-topHalfWidth, -halfHeight);
  ctx.lineTo(topHalfWidth, -halfHeight);
  ctx.lineTo(baseHalfWidth, halfHeight);
  ctx.lineTo(-baseHalfWidth, halfHeight);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  return new Style({
    image: new Icon({
      img: canvas,
      imgSize: [canvasSize, canvasSize],
      anchor: [0.5, 0.5],
      rotation,
    }),
  });
}

export function createDiamondIconStyle({ size, fill, stroke, rotation = 0 }) {
  const canvasSize = size * 2;

  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;

  const ctx = canvas.getContext("2d");
  ctx.translate(canvasSize / 2, canvasSize / 2);

  const horizontalScale = 0.6; // controls how pointy the diamond is

  ctx.fillStyle = fill.getColor();
  ctx.strokeStyle = stroke.getColor();
  ctx.lineWidth = stroke.getWidth();

  // --- Top triangle ---
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * horizontalScale, 0);
  ctx.lineTo(-size * horizontalScale, 0);
  ctx.closePath();
  ctx.fill();

  // Stroke only outer edges
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * horizontalScale, 0);
  ctx.moveTo(0, -size);
  ctx.lineTo(-size * horizontalScale, 0);
  ctx.stroke();

  // --- Bottom triangle ---
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(size * horizontalScale, 0);
  ctx.lineTo(-size * horizontalScale, 0);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(size * horizontalScale, 0);
  ctx.moveTo(0, size);
  ctx.lineTo(-size * horizontalScale, 0);
  ctx.stroke();

  return new Style({
    image: new Icon({
      img: canvas,
      imgSize: [canvasSize, canvasSize],
      anchor: [0.5, 0.5],
      rotation,
    }),
  });
}

export function buildPointStyle(
  shape,
  size,
  fill,
  stroke,
  iconUrl,
  rotation = 0,
) {
  const rotationRad = (Number(rotation) || 0) * (Math.PI / 180);

  switch (shape) {
    case "circle":
      return new Style({
        image: new CircleStyle({ radius: size, fill, stroke }),
      });

    case "square":
      return new Style({
        image: new RegularShape({
          points: 4,
          radius: size,
          angle: Math.PI / 4,
          rotation: rotationRad,
          fill,
          stroke,
        }),
      });

    case "rectangle":
      return new Style({
        image: new RegularShape({
          fill: fill,
          stroke: stroke,
          radius: size / Math.SQRT2,
          radius2: size,
          points: 4,
          angle: 0,
          rotation: rotationRad,
          scale: [1, 0.5],
        }),
      });

    case "triangle":
      return new Style({
        image: new RegularShape({
          points: 3,
          radius: size,
          rotation: rotationRad,
          fill,
          stroke,
        }),
      });

    case "star":
      return new Style({
        image: new RegularShape({
          points: 5,
          radius: size,
          radius2: size / 2,
          rotation: rotationRad,
          fill,
          stroke,
        }),
      });

    case "diamond":
      return createDiamondIconStyle({
        size,
        fill,
        stroke,
        rotation: rotationRad,
      });

    case "trapezoid":
      return createTrapezoidIconStyle({
        size,
        fill,
        stroke,
        rotation: rotationRad,
      });

    case "cross":
      return new Style({
        image: new RegularShape({
          points: 4,
          radius: size,
          radius2: 0,
          angle: 0,
          rotation: rotationRad,
          fill,
          stroke,
        }),
      });

    case "x":
      return new Style({
        image: new RegularShape({
          points: 4,
          radius: size,
          radius2: 0,
          angle: Math.PI / 4,
          rotation: rotationRad,
          fill,
          stroke,
        }),
      });

    case "icon":
      if (iconUrl) {
        return new Style({
          image: new Icon({
            src: iconUrl,
            scale: size / 10, // optional scaling
            rotation: rotationRad,
          }),
        });
      }
      // fallback to circle if no iconUrl
      return new Style({
        image: new CircleStyle({ radius: size, fill, stroke }),
      });

    default:
      // fallback to circle
      return new Style({
        image: new CircleStyle({ radius: size, fill, stroke }),
      });
  }
}

export function getGeometryBucket(feature) {
  const type = feature.getGeometry()?.getType().toLowerCase();
  if (type === "point" || type === "multipoint") return "point";
  if (type === "linestring" || type === "multilinestring") return "linestring";
  if (type === "polygon" || type === "multipolygon") return "polygon";
  return "point";
}

export function buildPolygonFill(merged) {
  if (merged.polygonFillType === "hatch") {
    return createHatchFill({
      color: merged.fill || defaultFill,
      spacing: merged.hatchSpacing || defaultHatchSpacing,
      direction: merged.hatchDirection || defaultHatchDirection,
    });
  }

  if (merged.polygonFillType === "dot") {
    return createDotFill({
      color: merged.fill || defaultFill,
      radius: merged.dotRadius || defaultDotRadius,
      spacing: merged.dotSpacing || defaultDotSpacing,
    });
  }

  // solid default
  return new Fill({ color: merged.fill || defaultFill });
}

export function createJsonStyleFunction(styleJson) {
  return function (feature) {
    let properties = feature.getProperties();
    const geometryBucket = getGeometryBucket(feature); // 'point', 'line', 'polygon'

    // --- Defaults (geometry-specific) ---
    let merged = styleJson.default?.[geometryBucket] || {};

    // --- Apply matching rules ---
    for (const rule of styleJson.rules || []) {
      // Only apply rule if it matches this geometry type
      const ruleGeom = rule.geometryType || geometryBucket;
      if (ruleGeom !== geometryBucket) continue;

      if (ruleMatches(rule, properties)) {
        merged = mergeStyleProperties(merged, rule);
      }
    }

    // --- Resolve any field references against this feature's properties ---
    merged = resolveAllStyleValues(merged, properties);

    // --- Set sensible defaults for points ---
    if (geometryBucket === "point") {
      if (merged.size == null) merged.size = defaultSize;
      if (!merged.shape) merged.shape = defaultShape;
      merged.size = resolveSize(feature, styleJson.rules || [], merged.size);
    }

    // --- Cache lookup ---
    const cacheKey = `${geometryBucket}:${JSON.stringify(merged)}`;
    if (styleCache.has(cacheKey)) {
      return styleCache.get(cacheKey);
    }

    // --- Build style ---
    // Ensure strokeDash is an array of numbers or undefined
    let lineDash = undefined;
    if (merged.strokeDash && typeof merged.strokeDash === "string") {
      // Accept empty string as solid
      if (merged.strokeDash.trim() !== "") {
        lineDash = merged.strokeDash
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => !isNaN(n));
        if (lineDash.length === 0) lineDash = undefined;
      }
    } else if (Array.isArray(merged.strokeDash)) {
      lineDash = merged.strokeDash.map(Number).filter((n) => !isNaN(n));
      if (lineDash.length === 0) lineDash = undefined;
    }

    const stroke = lineDash
      ? new Stroke({
          color: merged.stroke || defaultStroke,
          width: merged.strokeWidth ?? defaultStrokeWidth,
          lineDash,
        })
      : new Stroke({
          color: merged.stroke || defaultStroke,
          width: merged.strokeWidth ?? defaultStrokeWidth,
        });

    const zIndex = merged.zIndex ?? defaultZIndex;
    let style;

    // --- POINT ---
    if (geometryBucket === "point") {
      const fill = new Fill({ color: merged.fill || defaultFill });
      style = buildPointStyle(
        merged.shape,
        merged.size,
        fill,
        stroke,
        merged.iconUrl,
        merged.rotation,
      );
    }
    // --- LINE ---
    else if (geometryBucket === "linestring") {
      style = new Style({ stroke, zIndex });
    }
    // --- POLYGON ---
    else {
      const fill = buildPolygonFill(merged);
      style = new Style({ fill, stroke, zIndex });
    }

    // --- Cache & return ---
    styleCache.set(cacheKey, style);
    return style;
  };
}

export default moduleLoader;
