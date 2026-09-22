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
  rewriteArcGISExportUrlForAntimeridian,
  readFeatureCollection,
  coerceOptionalBoolean,
  coerceOptionalNumber,
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
import { register as registerProj4 } from "ol/proj/proj4.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm";
import { readSlice } from "components/map/zarrReader";

const moduleCache = {};

// The rule-style engine moved to its own module so its coverage is measured
// against a module no suite mocks (see the header there). Re-exported so every
// existing importer keeps working through the path it already uses -- Map.js
// in particular, which the visualizations Map suite stubs by this module path.
export {
  matchesCondition,
  resolveAllStyleValues,
  ruleMatches,
  resolveSize,
  createTrapezoidIconStyle,
  createDiamondIconStyle,
  buildPointStyle,
  getGeometryBucket,
  buildPolygonFill,
  createJsonStyleFunction,
} from "components/map/jsonStyle";

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

// Base class for a source failure whose message is written for the dashboard's
// author rather than for the console: a store's CRS, a file that could not be
// read, a projection nothing can place. Map.js shows these verbatim alongside
// the layer name, so anything thrown as one has to say what went wrong in terms
// the author can act on.
export class LayerSourceError extends Error {}

export class ZarrError extends LayerSourceError {}

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
// on read counts needs to start from empty. Every client-side read cache must
// be listed here -- one left out leaks a parsed file from whichever test read
// it first into every later test that asserts a read happened.
export function clearClientSourceCaches() {
  zarrSliceCache.clear();
  geoPackageCache.clear();
  geoParquetCache.clear();
  geoPackageContents.invalidate();
  geoParquetColumns.invalidate();
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
    ? await resolveProjectionOrThrow(crs, {
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

export class GeoTIFFError extends LayerSourceError {}

// The CRS a GeoTIFF names for its own coordinates, read from the file's GeoKeys,
// or null when it names none.
//
// A GeoTIFF names its CRS by code and carries no definition of it, so this is
// the code to go looking for a definition with -- not something that can be
// answered from the layer config.
async function readGeoTIFFProjectionCode(url) {
  // Author-supplied URL, same restriction the statistics read applies:
  // file:/blob:/data:/protocol-relative must not be fetched.
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
  try {
    const image = await readGeoTIFFHeader(url);
    const geoKeys = image.geoKeys ?? {};
    // 32767 is GeoTIFF's "user-defined": the file carries the projection's
    // parameters itself instead of naming a code, so there is nothing to look
    // up. OpenLayers does not read those parameters either, so such a file
    // renders in the view projection exactly as it did before.
    const projected = geoKeys.ProjectedCSTypeGeoKey;
    if (projected && projected !== 32767) return `EPSG:${projected}`;
    const geographic = geoKeys.GeographicTypeGeoKey;
    if (geographic && geographic !== 32767) return `EPSG:${geographic}`;
  } catch {
    // Unreachable, or not a GeoTIFF at all. Both are about to happen again to
    // OpenLayers on the same URL, where the source's own error handler reports
    // them with more to go on than anything that could be said here.
  }
  return null;
}

// Register the CRS an author named on a source, whatever its type.
//
// A code typed into a layer's `projection` field is handed straight to
// OpenLayers, which resolves it by exact string and, finding nothing, quietly
// falls back to the view projection -- so a WMS or a static image in a CRS
// nothing registered draws at the wrong place rather than failing. Resolving it
// here turns that into a layer error naming the code.
//
// Shapefiles are excluded: their `projection` field takes a WKT or proj4
// definition as well as a code, for a .prj-less file in a CRS no table carries,
// and their own reader already handles all three.
async function ensureAuthoredProjection(config) {
  const authored = config.props?.projection;
  if (typeof authored !== "string" || authored.trim() === "") return false;

  const registered = await resolveProjectionOrThrow(authored.trim(), {
    ErrorType: LayerSourceError,
    what: `This ${config.type} source`,
  });
  // OpenLayers looks a projection up by exact string, so it is handed the code
  // as registered rather than as typed.
  if (registered !== authored) config.props.projection = registered;
  return true;
}

// Put a GeoTIFF's CRS definition on hand before OpenLayers goes looking for it.
//
// OL resolves a GeoTIFF's projection from the file's GeoKeys as it opens the
// file, and when the code resolves to nothing it builds a projection carrying
// no transforms rather than failing. The layer then throws "No transform
// available between EPSG:3857 and EPSG:xxxx" from inside the renderer, on every
// frame, and never draws -- with nothing said to the author, because the throw
// is neither a source error nor a tile load error.
//
// An author-supplied `projection` wins, as it does in OpenLayers, which skips
// the GeoKeys entirely when the source is given one. It is resolved rather than
// trusted: an override naming a code we cannot place is the author's mistake to
// hear about, not something to silently fall back from.
async function ensureGeoTIFFProjection(config) {
  // An author-supplied projection wins, as it does in OpenLayers, which skips
  // the GeoKeys entirely when the source is given one.
  if (await ensureAuthoredProjection(config)) return;

  const code = await readGeoTIFFProjectionCode(config.props?.url);
  if (!code) return;
  // Not written back into the config: the file's own code reaches OpenLayers
  // through the file, and setting it here would override the GeoKey reading it
  // does itself -- which takes the linear units into account and can rightly
  // decline a code this has already resolved.
  await resolveProjectionOrThrow(code, {
    // "file", against the authored helper's "source": which of the two named
    // the code is the first thing an author needs to know, because only one of
    // them is theirs to change.
    ErrorType: GeoTIFFError,
    what: "This GeoTIFF file",
  });
}

// Where to read STATISTICS_* for a ramp-styled GeoTIFF source, or null when the
// source is not a candidate for an auto-fitted ramp.
//
// The GeoTIFF URL is author-supplied, so it is restricted to http(s):
// file:/blob:/data:/protocol-relative must not be fetched.
function autoRampStatsUrl(source) {
  // Only called once a ramp name has been read off the source, so it is there.
  if (source.type !== "GeoTIFF") return null;

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
    (source.classes ?? []).some(isUsableClass);
  // With no ramp and no classes there is still a style to build. A DataTile
  // carries raw values with no normalization (unlike the GeoTIFF source this
  // replaced, which rendered `normalize: true` grayscale), so leaving the layer
  // unstyled paints raw floats straight into the color channels. Fit grayscale
  // to the slice instead, which is what the old backend path effectively did.
  // Never empty for a non-categorical layer: the grayscale fallback covers it,
  // so there is always either a ramp to fit or a class list to match.
  const effectiveRamp = rampName || (isCategorical ? null : "grayscale");

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

// Concurrent readers of the same file share one header read. The `resolved`
// flag below only guards callers that arrive *after* a resolution finished, and
// three now arrive together: the legend resolves a raster's range to label its
// colorbar, the map resolves the same range to build the layer, and the layer's
// CRS is read from the same header before the source is constructed. Dropped on
// settle rather than kept, so this dedupes in-flight reads without holding a
// decoder open for every file a time-slider has ever visited. A reader arriving
// after the drop re-reads, which the browser serves from its own cache -- the
// bytes are the same range of the same URL OpenLayers is about to ask for.
const geoTIFFHeaderReads = new Map();

// The decoder, not the image: a reader that only wants the header calls
// getImage() on it, and one that wants pixels can ask the image how big it is
// before deciding to read any. Both share the byte ranges the decoder has
// already fetched.
function openGeoTIFF(url) {
  const inFlight = geoTIFFHeaderReads.get(url);
  if (inFlight) return inFlight;
  const read = (async () => {
    const { fromUrl } = await import("geotiff");
    return fromUrl(url);
  })().finally(() => geoTIFFHeaderReads.delete(url));
  geoTIFFHeaderReads.set(url, read);
  return read;
}

async function readGeoTIFFHeader(url) {
  return (await openGeoTIFF(url)).getImage();
}

// The most cells this will scan to find a raster's range. Four million is a
// 2000x2000 raster: ~16 MiB of float32 once decoded, and a few hundred
// milliseconds to walk. Past that the read stops being a detail of drawing the
// layer and becomes a download of its own, so the author is asked for the range
// instead of being made to wait for it.
const RANGE_SCAN_CELL_LIMIT = 4_000_000;

// TIFF's sample format for IEEE floating point.
const SAMPLE_FORMAT_FLOAT = 3;

/**
 * The real minimum and maximum of a raster's first band, read from its pixels.
 *
 * For the files that need this there is nothing else to go on: they carry no
 * STATISTICS_* tags and no PAM sidecar, and OpenLayers' fallback -- normalizing
 * by the range of the *data type* -- turns every float value into zero, because
 * a probability of 1.0 against a float32 ceiling of 3.4e38 rounds to nothing.
 *
 * Deliberately reads full resolution rather than an overview. Overview pixels
 * are averages, so they lose exactly the extremes a color ramp is defined by:
 * measured on a 4000x4000 raster spanning -3.5 to 123.75, the 500x500 overview
 * reports 18.7 to 31.5 and even the 2000x2000 level reports 1.3 to 49.7. A ramp
 * fitted to those would clip its own data and a legend built from them would
 * claim a maximum the raster exceeds.
 *
 * The outcome is reported separately from the range, because three things that
 * all leave the ramp unfitted call for three different responses:
 *
 *   "too-large"  The pixels were not read. The author can answer this, by
 *                pinning the ramp or publishing the file's statistics, so they
 *                are asked to.
 *   "unreadable" The read was attempted and failed. The file is broken or
 *                unreachable, which OpenLayers is about to discover for itself
 *                on the same URL and report with more to go on.
 *   "read"       The pixels were read. If no range came back, the raster holds
 *                one value or none, and no author input would change that.
 *
 * @param {string} url GeoTIFF URL.
 * @param {number} nodata The value standing for "no data", or NaN.
 * @returns {Promise<{outcome: string, min?: number, max?: number}>}
 */
async function readRasterRange(url, nodata) {
  try {
    const image = await readGeoTIFFHeader(url);
    if (image.getWidth() * image.getHeight() > RANGE_SCAN_CELL_LIMIT) {
      return { outcome: "too-large" };
    }

    const [band] = await image.readRasters({ samples: [0] });
    let min = Infinity;
    let max = -Infinity;
    for (let index = 0; index < band.length; index += 1) {
      const value = band[index];
      // NaN fails every comparison, so nodata cells written as NaN drop out
      // here rather than needing a test of their own.
      if (!Number.isFinite(value) || value === nodata) continue;
      if (value < min) min = value;
      if (value > max) max = value;
    }
    // min > max only when nothing was counted. Equal bounds are returned as
    // they are: a single-valued raster was read successfully, and it is the
    // ramp builder's business that such a range cannot be interpolated over.
    return min > max ? { outcome: "read" } : { outcome: "read", min, max };
  } catch {
    return { outcome: "unreadable" };
  }
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
  // Cleared before anything is resolved, so the flag only ever describes the
  // resolution that just ran. An author who drops the ramp, or points the layer
  // at a file that publishes its statistics, must not go on failing on a verdict
  // reached about an earlier one.
  //
  // Deleted rather than set false, and this matters: layer preservation decides
  // whether to rebuild by comparing configs, so writing a key onto every source
  // that passes through here -- shapefiles included -- makes each of them look
  // changed, and every layer reloads on every render.
  if (source) delete source.rampRangeUnavailable;
  const { rampName, rampMin, rampMax } = source ?? {};
  const hasMin = (rampMin ?? "") !== "";
  const hasMax = (rampMax ?? "") !== "";
  // A categorical layer colors by exact class value, so it needs no range at
  // all — but it still needs the header read to settle nodata, and it must
  // style raw values rather than OL's normalized bytes for the match to line up.
  const isCategorical =
    source?.styleMode === "categorical" &&
    (source.classes ?? []).some(isUsableClass);
  // The header is read even when both bounds are pinned, because it also
  // settles nodata — a pinned layer still needs its transparency right.
  if (!rampName && !isCategorical) return layerConfig;

  // Keyed on the URL so this is safe to call from more than one place per
  // render, while still re-resolving when the source points at another file.
  const statsUrl = autoRampStatsUrl(source);
  if (!statsUrl || source.resolvedRampUrl === statsUrl) return layerConfig;

  try {
    const image = await readGeoTIFFHeader(statsUrl);
    // getGDALMetadata(0) returns items tagged for sample 0 only; passing null
    // returns the dataset-level items. Writers differ -- rio-cogeo attaches
    // STATISTICS_* to the band, while GDAL and MATLAB's Mapping Toolbox write
    // them at dataset level -- so check the band first, then fall back.
    const meta = image.getGDALMetadata(0) ?? {};
    const dataset = image.getGDALMetadata(null) ?? {};

    // Settle nodata first: it is independent of the ramp range, and a file with
    // nodata but no statistics still needs its transparency handled. Zarr COGs
    // are built by us and always carry the -9999 sentinel already.
    // Zarr never reaches here: applyAutoRamp hands it to applyZarrRamp first.
    source.props = {
      ...source.props,
      nodata: resolveNodata(image.getGDALNoData()),
    };
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
        ...source.props,
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

    // Nothing published a range, so read one out of the raster itself. Last
    // because it is the only step that touches pixels: a file that carries its
    // statistics, in its tags or its sidecar, is never scanned.
    let tooLargeToScan = false;
    if (
      source.type === "GeoTIFF" &&
      ((!hasMin && statsMin === undefined) ||
        (!hasMax && statsMax === undefined))
    ) {
      const range = await readRasterRange(statsUrl, source.props.nodata);
      tooLargeToScan = range.outcome === "too-large";
      statsMin = statsMin ?? range.min;
      statsMax = statsMax ?? range.max;
    }

    // A pinned bound wins; only the empty one comes from the statistics.
    let lo = hasMin ? Number(rampMin) : parseFloat(statsMin);
    const hi = hasMax ? Number(rampMax) : parseFloat(statsMax);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) {
      // No usable range, so rendering stays normalized — but rebuild the style
      // anyway so nodata cells are transparent rather than painted at band 1 = 0,
      // which is what the zero-filled tile array leaves them as.
      layerConfig.style = styleFor("", "");
      // For float data, staying normalized is not a degraded rendering, it is a
      // blank one: OpenLayers scales by the range of the data type, and against
      // a float32 ceiling of 3.4e38 every real value rounds to zero. Raised only
      // when the pixels were never read -- a raster that was read and holds one
      // value has no range to find, and telling the author to go and find one
      // would send them after something that does not exist.
      //
      // Recorded rather than thrown: the legend build calls this too, and it has
      // no business failing over a raster it only wanted to label. moduleLoader
      // raises it when the layer is built, where a failure is already handled.
      // Set only when true, for the same reason it is deleted above.
      if (tooLargeToScan && image.getSampleFormat() === SAMPLE_FORMAT_FLOAT) {
        source.rampRangeUnavailable = true;
      }
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

    source.props = { ...source.props, normalize: false };
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

export class GeoPackageError extends LayerSourceError {}

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

// A table whose SRS OpenLayers could not resolve: 1 is "kept but not
// reprojected", 2 is "discarded", and which of the two comes back depends on
// the MissingDataSrsAction below. Both mean the same thing here.
const GEOPACKAGE_MISSING_SRS_CODES = [1, 2];

// Report a table whose SRS is unresolvable instead of throwing the whole load
// away, so the SRS it names can be read back off the status. Genuine load
// failures are left on their default, which is to throw.
//
// camelCase deliberately: ol-load-geopackage's API.md documents this option as
// `MissingDataSrsAction`, but the shipped code reads `missingDataSrsAction` and
// silently ignores anything else -- leaving the default in place, which throws
// the whole load away and takes the SRS id with it.
const GEOPACKAGE_OPTIONS = { missingDataSrsAction: "discard" };

/**
 * Load a GeoPackage's tables, registering any CRS the loader could not resolve.
 *
 * A GeoPackage names its CRS inside the file, in a SQLite table, so there is
 * nothing in the layer config to register from and no cheap way to look before
 * the loader opens it. Instead the loader is asked to report rather than throw:
 * a table it could not place comes back with the numeric SRS id it wanted, that
 * code is registered, and the file is loaded once more -- by which time the
 * browser has the bytes, so the second pass is parsing, not downloading.
 */
async function loadGeoPackageTables(loadGpkg, url, mapProjection) {
  const loaded = await loadGpkg(url, mapProjection, GEOPACKAGE_OPTIONS);

  const missing = new Set();
  for (const status of Object.values(loaded[2] ?? {})) {
    if (
      GEOPACKAGE_MISSING_SRS_CODES.includes(status?.statusCode) &&
      status?.origSrsId
    ) {
      missing.add(`EPSG:${status.origSrsId}`);
    }
  }
  if (missing.size === 0) return loaded;

  const { ensureProjectionAsync } = await import("components/map/projections");
  for (const code of missing) {
    const resolved = await ensureProjectionAsync(code);
    if (resolved.error) {
      throw new GeoPackageError(
        `This GeoPackage holds a table in projection "${code}". ` +
          resolved.error.detail,
      );
    }
  }
  return loadGpkg(url, mapProjection, GEOPACKAGE_OPTIONS);
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
    geoPackageCache.set(
      cacheKey,
      loadGeoPackageTables(loadGpkg, url, mapProjection),
    );
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

// The display projection a discovery read reprojects into. loadGpkg takes one
// and throws *synchronously* when it is not registered, so discovery cannot
// simply pass nothing. The value is not observable in the result -- only
// Object.keys(dataByTable) is read and every reprojected geometry is discarded
// -- so it only has to be a projection that resolves.
const GEOPACKAGE_DISCOVERY_PROJECTION = "EPSG:3857";

/**
 * A single-flight promise cache keyed by resolved URL, for the discovery reads
 * that answer "what does this file contain?".
 *
 * The entry is planted synchronously, before the reader's first await, so a
 * second caller arriving in the same tick joins the in-flight read instead of
 * starting its own. A rejection is evicted so a transient network or CORS
 * failure can be retried rather than pinning the menu to that error forever.
 *
 * `invalidate` exists because these caches sit behind the discovery hook's own
 * memo: a forced re-read that cleared only the memo would land here and be
 * handed the same list straight back, so the control would spin and nothing on
 * screen would change. Called with no url, it clears every entry.
 */
function createUrlKeyedCache({ read, missingUrl }) {
  const cache = new Map();

  const get = (rawUrl) => {
    if (!rawUrl) return Promise.reject(missingUrl());
    const url = s3UrlToHttps(rawUrl);
    if (!cache.has(url)) {
      cache.set(
        url,
        read(url).catch((error) => {
          cache.delete(url);
          throw error;
        }),
      );
    }
    return cache.get(url);
  };

  const invalidate = (rawUrl) => {
    if (rawUrl === undefined) {
      cache.clear();
      return;
    }
    cache.delete(s3UrlToHttps(rawUrl));
  };

  return { get, invalidate };
}

// Discovery's own parsed-gpkg cache, keyed by resolved URL alone. Deliberately
// not geoPackageCache above, which is keyed `${url}::${mapProjection}`: the
// editor has no map projection to key with (MapContext exposes only
// map-readiness and extent-draw state), and a forced re-read from the editor
// must not evict an entry a rendered layer is still awaiting. The cost is one
// download not shared with the render path.
const geoPackageContents = createUrlKeyedCache({
  read: (url) => readGeoPackageContents(url),
  missingUrl: () =>
    new GeoPackageError("GeoPackage source requires a file URL"),
});

// List the table names in a GeoPackage file. loadGeoPackage above needs a table
// name and throws without one, which is exactly the state an author picking a
// table is in; this reads the same file and answers with the names instead.
export const listGeoPackageTables = (rawUrl) =>
  geoPackageContents.get(rawUrl).then((contents) => contents.tables);
export const invalidateGeoPackageTables = geoPackageContents.invalidate;

// The attribute names of one table, for the style rule editor. Shares the cache
// -- and therefore the download -- with the table listing above: parsing a
// GeoPackage means reading the whole file, so doing it twice for one url would
// be the expensive half of this feature done twice.
export const listGeoPackageFields = (rawUrl, table) =>
  geoPackageContents
    .get(rawUrl)
    .then((contents) => contents.fieldsByTable[table] ?? []);

// Attribute names on a parsed table, geometry excluded: it is the shape of the
// feature, not something a rule can test.
function geoPackageTableFields(source) {
  const feature = source?.getFeatures?.()?.[0];
  if (!feature) return [];
  const geometryName = feature.getGeometryName?.();
  return Object.keys(feature.getProperties?.() ?? {}).filter(
    (name) => name !== geometryName,
  );
}

async function readGeoPackageContents(url) {
  // Register before loadGpkg rather than relying on the render path having run
  // first: discovery can run before any GeoPackage layer has ever rendered, and
  // an unregistered display projection makes loadGpkg throw.
  registerGeoPackageProjections();
  const { loadGpkg } = await getGeoPackageLib();
  try {
    // Through the same two-phase load the render path uses. Discovery is where
    // an author first meets the file, so a table in a CRS that needs
    // registering has to appear in the list here too -- listing nothing reads
    // as "this file is empty", which is a different and wrong answer.
    const [dataByTable] = await loadGeoPackageTables(
      loadGpkg,
      url,
      GEOPACKAGE_DISCOVERY_PROJECTION,
    );
    const tables = Object.keys(dataByTable ?? {});
    const fieldsByTable = {};
    for (const table of tables) {
      fieldsByTable[table] = geoPackageTableFields(dataByTable[table]);
    }
    return { tables, fieldsByTable };
  } catch (error) {
    // Surface why the read failed. Returning an empty list here would be read
    // as "this file has no tables", which is a different and wrong answer.
    throw new GeoPackageError(
      `Could not read the GeoPackage file: ${error?.message ?? error}`,
    );
  }
}

export class GeoParquetError extends LayerSourceError {}

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
//
// Async because most codes resolve out of the generated EPSG table, which is a
// chunk fetched on first use; every caller is inside a source loader that is
// already awaiting its data. The projection module is imported here rather than
// at the top of this file so that a dashboard with no such layer pays for
// neither it nor the table.
async function resolveProjectionOrThrow(code, { ErrorType, what }) {
  const { ensureProjectionAsync } = await import("components/map/projections");
  const resolved = await ensureProjectionAsync(code);
  if (resolved.error) {
    throw new ErrorType(
      `${what} declares projection "${code}". ${resolved.error.detail}`,
    );
  }
  // The registered code, not the one that was asked for. OpenLayers looks a
  // projection up by exact string, so handing back "epsg:5629" as written would
  // resolve to nothing and put the data at raw coordinates -- the silent
  // failure this function exists to prevent.
  return resolved.projection.getCode();
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
  const column = geo.columns?.[geometryColumn];
  const dataProjection = geoParquetCRSToProjection(column?.crs);
  return {
    geometryColumn,
    dataProjection,
    // GeoParquet 1.1 optionally names a "covering" struct column holding each
    // row's bounding box. Its per-row-group min/max statistics are what let a
    // bbox filter skip whole row groups without fetching their pages.
    bboxColumn: readCoveringBBoxPaths(column?.covering),
  };
}

// covering.bbox maps each side to a physical column path, e.g.
// { xmin: ["bbox", "xmin"], ... }. Returns dotted paths hyparquet can filter
// on, or null when the file declares no covering.
export function readCoveringBBoxPaths(covering) {
  const bbox = covering?.bbox;
  if (!bbox) return null;
  const sides = ["xmin", "ymin", "xmax", "ymax"];
  const paths = {};
  for (const side of sides) {
    const path = bbox[side];
    if (!Array.isArray(path) || path.length === 0) return null;
    paths[side] = path.join(".");
  }
  return paths;
}

// Parse a "minx,miny,maxx,maxy" author-supplied bbox in the file's own CRS.
export function parseBBox(value) {
  if (value === null || value === undefined || value === "") return null;
  const parts = String(value)
    .split(",")
    .map((n) => Number(n.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new GeoParquetError(
      `bbox must be four comma-separated numbers ` +
        `"minx,miny,maxx,maxy"; got "${value}"`,
    );
  }
  const [minx, miny, maxx, maxy] = parts;
  if (maxx < minx || maxy < miny) {
    throw new GeoParquetError(
      `bbox "${value}" is inverted; expected minx,miny,maxx,maxy`,
    );
  }
  return { minx, miny, maxx, maxy };
}

// Intersection test as a hyparquet filter over the covering bbox columns: two
// boxes overlap unless one is strictly beyond the other on some axis. Row
// groups whose statistics cannot satisfy this are skipped without being read.
export function bboxIntersectsFilter(bboxColumn, box) {
  return {
    $and: [
      { [bboxColumn.xmin]: { $lte: box.maxx } },
      { [bboxColumn.xmax]: { $gte: box.minx } },
      { [bboxColumn.ymin]: { $lte: box.maxy } },
      { [bboxColumn.ymax]: { $gte: box.miny } },
    ],
  };
}

// Author-supplied column list -> the physical columns to decode. The geometry
// column is always included, and so are the covering bbox columns when a bbox
// filter needs them. Returns undefined to mean "all columns".
export function resolveReadColumns({
  columns,
  geometryColumn,
  bboxColumn,
  usingBBoxFilter,
}) {
  const requested = String(columns ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (requested.length === 0) return undefined;
  const needed = new Set([geometryColumn, ...requested]);
  if (usingBBoxFilter && bboxColumn) {
    // hyparquet needs the filter's own columns available to evaluate it.
    for (const path of Object.values(bboxColumn)) {
      needed.add(path.split(".")[0]);
    }
  }
  return [...needed];
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

  // These change what is read, so they belong in the cache key.
  const readOptions = {
    columns: config.props?.columns ?? "",
    bbox: config.props?.bbox ?? "",
    maxFeatures: coerceOptionalNumber(config.props?.maxFeatures),
  };
  const cacheKey = JSON.stringify([url, readOptions]);

  if (!geoParquetCache.has(cacheKey)) {
    geoParquetCache.set(
      cacheKey,
      readGeoParquetFile(url, readOptions).catch((error) => {
        geoParquetCache.delete(cacheKey);
        throw error;
      }),
    );
  }
  const { featureCollection, dataProjection } =
    await geoParquetCache.get(cacheKey);

  return new VectorSource({
    features: new GeoJSON().readFeatures(featureCollection, {
      dataProjection,
      featureProjection: mapProjection,
    }),
  });
}

async function readGeoParquetFile(url, readOptions) {
  const {
    asyncBufferFromUrl,
    parquetMetadataAsync,
    parquetReadObjects,
    compressors,
  } = await getHyparquet();

  const box = parseBBox(readOptions.bbox);
  let metadata;
  let rows;
  let geometryColumn;
  let dataProjection;
  let bboxColumn;
  try {
    const file = await asyncBufferFromUrl({ url });
    metadata = await parquetMetadataAsync(file);
    ({ geometryColumn, dataProjection, bboxColumn } =
      readGeoParquetGeoMetadata(metadata));

    // Only push the bbox down when the file declares a covering column;
    // otherwise there is nothing with per-row-group statistics to prune on and
    // the box is applied to the decoded geometries instead.
    const usingBBoxFilter = Boolean(box && bboxColumn);
    const columns = resolveReadColumns({
      columns: readOptions.columns,
      geometryColumn,
      bboxColumn,
      usingBBoxFilter,
    });

    rows = await parquetReadObjects({
      file,
      compressors,
      geoparquet: true,
      ...(columns ? { columns } : {}),
      ...(usingBBoxFilter
        ? {
            filter: bboxIntersectsFilter(bboxColumn, box),
            // Prune at page granularity too, not just row-group.
            usePageIndex: true,
          }
        : {}),
      ...(readOptions.maxFeatures > 0
        ? { rowStart: 0, rowEnd: readOptions.maxFeatures }
        : {}),
    });
  } catch (error) {
    if (error instanceof GeoParquetError) throw error;
    // The browser makes this fetch, so a CORS-less host is the likeliest cause
    // and reports only an opaque network failure. Name both possibilities.
    throw new GeoParquetError(
      `Could not read the GeoParquet file at ${url}: ${error?.message ?? error}. ` +
        `Check the URL is reachable and that the host sends CORS headers ` +
        `(Access-Control-Allow-Origin) and supports range requests.`,
    );
  }

  await resolveProjectionOrThrow(dataProjection, {
    ErrorType: GeoParquetError,
    what: "This GeoParquet file",
  });

  // With no covering column the bbox could not be pushed down, so apply it to
  // the decoded geometries. Same visible result, no I/O saved.
  const needsGeometryBBoxFilter = Boolean(box && !bboxColumn);

  const features = rows
    .map((row) => {
      const { [geometryColumn]: geometry, ...rest } = row;
      const properties = {};
      for (const [key, value] of Object.entries(rest)) {
        // ol/format/GeoJSON applies properties after the geometry, so a
        // residual column literally named "geometry" would overwrite it.
        if (key === "geometry") continue;
        // Covering bbox columns are plumbing, not attributes; hide them from
        // the popup, which shows every property it is given.
        if (bboxColumn && key === bboxColumn.xmin.split(".")[0]) continue;
        properties[key] = coerceParquetValue(value);
      }
      return { type: "Feature", geometry: geometry ?? null, properties };
    })
    .filter((feature) => feature.geometry != null)
    .filter(
      (feature) =>
        !needsGeometryBBoxFilter ||
        geometryIntersectsBBox(feature.geometry, box),
    );

  return {
    featureCollection: { type: "FeatureCollection", features },
    dataProjection,
  };
}

// Discovery's own metadata cache, keyed by resolved URL alone. Separate from
// geoParquetCache because that one keys on the read options (columns/bbox/
// maxFeatures) an author has not chosen yet.
const geoParquetColumns = createUrlKeyedCache({
  read: (url) => readGeoParquetColumns(url),
  missingUrl: () =>
    new GeoParquetError("GeoParquet source requires a file URL"),
});

// List a GeoParquet file's selectable attribute columns. Unlike the GeoPackage
// read this touches only the file footer, since hyparquet ranges into it.
export const listGeoParquetColumns = geoParquetColumns.get;
export const invalidateGeoParquetColumns = geoParquetColumns.invalidate;

// A parquet schema arrives as a flat, depth-first list: the root element,
// followed by each of its children with that child's own subtree inlined
// straight after it. Walking every element would offer nested leaves, so skip
// whole subtrees and return only the root's direct children.
//
// Top-level names are the only correct answer here. hyparquet matches a
// requested column against `pathInSchema[0]` (read.js), so a leaf or dotted
// path is silently ignored at read time -- the author would pick a column,
// save, and get a layer rendered without it and no error anywhere.
function topLevelParquetColumns(schema) {
  if (!Array.isArray(schema) || schema.length < 2) return [];
  const subtreeSize = (index) => {
    let size = 1;
    let child = index + 1;
    // num_children comes out of the file. A corrupt or hostile footer can
    // declare more children than the schema actually holds, and counting down a
    // file-supplied number with no floor spins this loop until the tab dies --
    // so the end of the list is the real bound.
    for (
      let n = schema[index]?.num_children ?? 0;
      n > 0 && child < schema.length;
      n--
    ) {
      const childSize = subtreeSize(child);
      child += childSize;
      size += childSize;
    }
    return size;
  };
  const names = [];
  // A root that declares no child count is malformed rather than empty, so walk
  // to the end of the list instead of returning nothing.
  let remaining = schema[0]?.num_children ?? Infinity;
  let index = 1;
  while (index < schema.length && remaining > 0) {
    names.push(schema[index].name);
    index += subtreeSize(index);
    remaining -= 1;
  }
  return names;
}

async function readGeoParquetColumns(url) {
  const { asyncBufferFromUrl, parquetMetadataAsync } = await getHyparquet();
  try {
    const file = await asyncBufferFromUrl({ url });
    const metadata = await parquetMetadataAsync(file);
    const { geometryColumn, bboxColumn } = readGeoParquetGeoMetadata(metadata);

    const hidden = new Set([geometryColumn]);
    if (bboxColumn) {
      // readCoveringBBoxPaths returns dotted physical paths ("bbox.xmin"), and
      // the offered names are top-level, so reduce to the first segment -- the
      // same reduction resolveReadColumns makes when it adds them to a read.
      for (const path of Object.values(bboxColumn)) {
        hidden.add(path.split(".")[0]);
      }
    }
    // The geometry and covering columns are machinery the reader consumes on
    // its own: the reader always includes the geometry column and hides the
    // covering one from the popup, so offering either invites a selection that
    // changes nothing the author can see.
    return topLevelParquetColumns(metadata?.schema).filter(
      (name) => !hidden.has(name),
    );
  } catch (error) {
    // Fail with a reason. An empty list would read as "this file has no
    // attribute columns", which is a different and wrong answer.
    if (error instanceof GeoParquetError) throw error;
    throw new GeoParquetError(
      // The remedy is the presentation layer's job -- the discovery note already
      // appends TRANSFER_REMEDY for a transfer-stage failure, so repeating it
      // here printed the same sentence twice. The range-request half is
      // format-specific, so only that stays.
      `Could not read the GeoParquet file: ${error?.message ?? error}. ` +
        `The host must also support range requests.`,
    );
  }
}

// Bounding-box overlap for a GeoJSON geometry, used only when the file has no
// covering column to push the filter down to.
export function geometryIntersectsBBox(geometry, box) {
  if (!geometry || !box) return true;
  let minx = Infinity;
  let miny = Infinity;
  let maxx = -Infinity;
  let maxy = -Infinity;
  const visit = (coords) => {
    if (typeof coords[0] === "number") {
      const [x, y] = coords;
      if (x < minx) minx = x;
      if (x > maxx) maxx = x;
      if (y < miny) miny = y;
      if (y > maxy) maxy = y;
      return;
    }
    for (const part of coords) visit(part);
  };
  if (geometry.type === "GeometryCollection") {
    return (geometry.geometries ?? []).some((g) =>
      geometryIntersectsBBox(g, box),
    );
  }
  if (!geometry.coordinates) return true;
  visit(geometry.coordinates);
  return (
    minx <= box.maxx && maxx >= box.minx && miny <= box.maxy && maxy >= box.miny
  );
}

const moduleLoader = async (config, mapProjection, getMapProjection) => {
  // Before anything is constructed, and before the type-specific branches:
  // every source type accepts a `projection`, and an unregistered one is worse
  // than useless at every one of them. GeoTIFF resolves its own below, because
  // it has the file's GeoKeys to fall back on, and Shapefile because its field
  // accepts a definition as well as a code.
  if (config.type !== "GeoTIFF" && config.type !== "Shapefile") {
    await ensureAuthoredProjection(config);
  }

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
    await ensureGeoTIFFProjection(config);
    if (config.rampRangeUnavailable) {
      throw new GeoTIFFError(
        `This GeoTIFF publishes no statistics and is too large to scan for ` +
          `its own value range, so its color ramp cannot be fitted and every ` +
          `cell would render as zero. Set the ramp's Min and Max on the ` +
          `layer's Style tab, or publish the file's statistics alongside it ` +
          `(gdal_edit.py -stats, or its .aux.xml sidecar).`,
      );
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
        const resolvedProps = await resolveProps(
          props,
          mapProjection,
          getMapProjection,
        );
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

    const resolvedProps = await resolveProps(
      props,
      mapProjection,
      getMapProjection,
    );
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

// Helper function to resolve nested props.
//
// `getMapProjection` is threaded through every recursion because a layer's
// source is a nested module config: a shapefile arrives as
// `{type: "VectorLayer", props: {source: {type: "Shapefile"}}}`, so the source
// is loaded from here rather than by the top-level dispatch. Dropping the
// callback here left the shapefile loader with no way to reread the view, which
// is the whole point of it.
const resolveProps = async (props, mapProjection, getMapProjection) => {
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
        resolvedProps[key] = await moduleLoader(
          value,
          mapProjection,
          getMapProjection,
        );
      } else if (Array.isArray(value)) {
        // It's an array; resolve each item
        resolvedProps[key] = await Promise.all(
          value.map(async (item) => {
            if (item && typeof item === "object") {
              return await resolveProps(item, mapProjection, getMapProjection);
            } else {
              return item;
            }
          }),
        );
      } else {
        // It's a regular object; recursively resolve its properties
        resolvedProps[key] = await resolveProps(
          value,
          mapProjection,
          getMapProjection,
        );
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
    VectorImageLayer: "ol/layer/VectorImage.js",
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
      // Whoever wires a retry affordance to this must also empty the layer's
      // style cache -- `refresh` clears and reloads the features, but it does
      // not go through swapVectorLayerFeatures, which is the only thing
      // calling resetStyleCache today. Without that the previous dataset's
      // entries stay in the map for the life of the layer.
      source.refresh();
    },
  });

  return source;
};

const loadGeoJSON = async (config, mapProjection) => {
  const geojson = config.geojson;

  if (typeof geojson === "string") {
    return new VectorSource({
      url: geojson,
      format: new GeoJSON({ featureProjection: mapProjection }),
    });
  }

  // A GeoJSON naming its own CRS -- the pre-2016 spelling, still written by
  // plenty of exporters -- hands the reader a code it may not know, and an
  // unknown one silently means "already WGS 84", which drops projected
  // coordinates onto the map as degrees. Resolve it, or say why not.
  const named = geojson.crs?.properties?.name;
  const dataProjection = named
    ? await resolveProjectionOrThrow(named, {
        ErrorType: LayerSourceError,
        what: "This GeoJSON's `crs`",
      })
    : undefined;

  return new VectorSource({
    features: new GeoJSON().readFeatures(geojson, {
      dataProjection,
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

export default moduleLoader;
