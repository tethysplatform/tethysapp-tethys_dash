import { unByKey } from "ol/Observable";
import moduleLoader, {
  applyAutoRamp,
  GeoTIFFError,
  LayerSourceError,
} from "components/map/ModuleLoader";
import {
  buildGeoTIFFStyleColor,
  isUsableClass,
} from "components/map/geoTIFFStyle";
import { resolveRamp } from "components/map/colorRamps";

// A GeoTIFF layer whose file is chosen by a dynamic map layer plugin.
//
// The saved layer is a WebGLTile with a GeoTIFF source that has no URL: each
// plugin fetch returns a *source description* naming the file, and optionally
// how to color it, and the layer is repointed at it in place. Everything here is
// independent of React and of the fetcher, so the fetcher decides when to call
// it and this module decides only what the result is.
//
// The work is split in three so a failure can never reach the map:
//
//   resolveEffectiveRasterConfig  pure: saved config + description -> config
//   buildRuntimeRaster            async: config -> a source that is ready
//   applyRuntimeRaster            sync: hand the built source to the layer
//
// Only the last touches the layer, and it is only reached once the file has been
// opened. An unreachable URL, an unplaceable CRS or an unrangeable float raster
// fails the build, and the layer goes on drawing the previous file.

/**
 * How long a newly built source may stay "loading" before the build gives up.
 *
 * OpenLayers' GeoTIFF source has no timeout of its own: a host that accepts the
 * connection and never answers leaves it loading forever, and the fetch that
 * asked for it with it. Thirty seconds is long enough for a slow header read
 * over a poor connection and short enough that a stalled one is reported.
 */
export const RUNTIME_RASTER_READY_TIMEOUT_MS = 30_000;

// Fields applyAutoRamp writes back onto a source. They describe one file, so
// carrying them into the next fetch's config would describe the wrong one -- and
// resolvedRampUrl in particular short-circuits the resolve when the URL repeats,
// keeping the previous style on a same-URL fetch whose style changed.
const RUNTIME_SOURCE_FIELDS = [
  "resolvedRampUrl",
  "resolvedRampMin",
  "resolvedRampMax",
  "resolvedSliceKey",
  "rampRangeUnavailable",
];

// The ramp fields a fetch's style replaces as a set. The categorical fields are
// cleared with them: a fetch only ever carries a continuous ramp, and a saved
// class table left beside it would win over the ramp it sent.
const STYLE_SOURCE_FIELDS = [
  "rampName",
  "rampMin",
  "rampMax",
  "rampReverse",
  "styleMode",
  "classes",
  "fallbackColor",
];

// ASCII control characters, DEL included. A URL carrying one is either broken or
// built to read differently to two parsers, and neither is worth fetching.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * Normalize a plugin-supplied layer URL, or refuse it.
 *
 * Accepted: an absolute http(s) URL, handed on as given, or a root-relative path
 * on this app's own server ("/files/a.tif"), handed on as an absolute URL on
 * this origin. Everything downstream -- the statistics read, the CRS read --
 * fetches only absolute http(s) URLs and silently skips anything else, so a
 * relative path left as it was would draw without its range or its CRS.
 *
 * Refused: other schemes (javascript:, file:, data:, blob:), protocol-relative
 * "//host" and its backslash spellings, which browsers read as another host,
 * paths relative to the current page, and anything with surrounding whitespace
 * or control characters, which different URL parsers disagree about.
 *
 * @param {*} url The URL as the plugin returned it.
 * @returns {string|null} The URL to fetch, or null when it must not be fetched.
 */
export function normalizeLayerUrl(url) {
  if (typeof url !== "string" || url === "") return null;
  if (url !== url.trim()) return null;
  if (url.includes("\\") || CONTROL_CHARACTERS.test(url)) return null;

  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:"
        ? url
        : null;
    } catch {
      return null;
    }
  }

  // Exactly one leading slash: "//host" is another server entirely.
  if (url[0] !== "/" || url[1] === "/") return null;
  const origin = window.location.origin;
  let parsed;
  try {
    parsed = new URL(url, origin);
  } catch {
    // istanbul ignore next -- every string passing the checks above parses
    // against an http(s) origin; kept so a parser change fails closed.
    return null;
  }
  // Re-checked after resolution rather than trusted from the string: what
  // matters is where the browser will actually send the request.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.origin !== origin) return null;
  return parsed.href;
}

/**
 * Whether a plugin-supplied layer URL may be fetched. See normalizeLayerUrl.
 *
 * @param {*} url
 * @returns {boolean}
 */
export function isAllowedLayerUrl(url) {
  return normalizeLayerUrl(url) !== null;
}

// A bound the author or the plugin set, as a number, or undefined when it is
// empty -- which means "resolve it from the file", not zero.
function boundValue(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function isCategorical(source) {
  return (
    source.styleMode === "categorical" &&
    (source.classes ?? []).some(isUsableClass)
  );
}

// Overlay a fetch's style onto the source, replacing every ramp field the saved
// style had. No field-by-field merge: a plugin that sends a ramp and no bounds
// means "auto-range this one", which inheriting the saved bounds would undo.
function overlayFetchStyle(source, style) {
  const wasCategorical = source.styleMode === "categorical";
  STYLE_SOURCE_FIELDS.forEach((field) => delete source[field]);
  delete source.props.mask_below;
  // Written by a categorical save so class labels are not blended. Meaningless
  // for the ramp that replaces it, and it would blur nothing but nodata edges.
  if (wasCategorical && source.props.interpolate === false) {
    delete source.props.interpolate;
  }

  const { rampName, rampMin, rampMax, rampReverse, maskBelow } = style;
  if (typeof rampName === "string" && rampName !== "") {
    source.rampName = rampName;
  }
  if (rampMin !== undefined && rampMin !== null) source.rampMin = rampMin;
  if (rampMax !== undefined && rampMax !== null) source.rampMax = rampMax;
  // Persisted only when set, as the editor does.
  if (rampReverse === true) source.rampReverse = true;
  // `maskBelow` on the wire, `mask_below` on the source: the wire groups it with
  // the styling it is, the source keeps it where the static layer has it.
  if (maskBelow !== undefined && maskBelow !== null) {
    source.props.mask_below = maskBelow;
  }
}

// The style to start from, compiled the way the editor's save compiles a static
// layer's, so the layer has something correct to draw if the resolve that
// follows cannot read the file's statistics. A full range styles raw values; any
// less normalizes until applyAutoRamp has resolved the missing bound.
//
// Compiled here rather than saved because the saved one belongs to whichever
// style was in effect when the author last saved, which a fetch may replace.
function compileStartingStyle(config) {
  const source = config.props.source;
  // A class table's style needs no range, and applyAutoRamp compiles it with the
  // file's nodata once the header is read. The saved one stands until then.
  if (isCategorical(source)) return;

  const { rampName } = source;
  if (typeof rampName !== "string" || rampName.trim() === "") {
    // Nothing to color by. Any style left from a saved ramp would color by a
    // ramp that is no longer in effect.
    delete config.style;
    return;
  }
  if (!resolveRamp(rampName)) {
    throw new LayerSourceError(
      `Layer "${config.props.name}" was given the color ramp "${rampName}", ` +
        `which does not exist.`,
    );
  }

  const hasRange =
    boundValue(source.rampMin) !== undefined &&
    boundValue(source.rampMax) !== undefined;
  config.style = {
    color: buildGeoTIFFStyleColor({
      rampName,
      rampMin: hasRange ? source.rampMin : "",
      rampMax: hasRange ? source.rampMax : "",
      rampReverse: source.rampReverse === true,
      hasNodata: true,
      maskBelow: source.props.mask_below,
    }),
  };
  source.props.normalize = !hasRange;
}

/**
 * The layer config one fetch draws with: the saved layer, pointed at the file
 * the fetch named and colored by whichever style is in effect.
 *
 * Pure. The saved config is copied, never changed, and the copy is always taken
 * from the *saved* config, not from a previous fetch's result: what one fetch
 * resolved about its file says nothing about the next one's.
 *
 * Style precedence:
 *
 *   pinned (`pluginSource.stylePinned`)   the saved style, whatever the fetch sent
 *   unpinned, fetch sent a style          the fetch's style, replacing the saved
 *                                         one as a whole
 *   unpinned, fetch sent none             the saved style
 *
 * In every case an empty min or max is resolved from the returned file when the
 * config is built.
 *
 * @param {object} savedConfig The layer's saved `configuration`: a WebGLTile
 *   whose `props.source` is a GeoTIFF with no URL.
 * @param {object} description The fetch's source description,
 *   `{type, props: {url, projection?}, style?: {rampName?, rampMin?, rampMax?,
 *   rampReverse?, maskBelow?}}`.
 * @returns {object} A new layer config, ready for buildRuntimeRaster.
 * @throws {LayerSourceError} When the description is malformed, names another
 *   source type than the layer's, carries a URL that must not be fetched, or
 *   names a ramp that does not exist.
 */
export function resolveEffectiveRasterConfig(savedConfig, description) {
  const name = savedConfig?.props?.name;
  if (
    !description ||
    typeof description !== "object" ||
    Array.isArray(description)
  ) {
    throw new LayerSourceError(
      `The plugin for layer "${name}" did not return a source description. ` +
        `A GeoTIFF plugin's fetch_source() must return ` +
        `{"type": "GeoTIFF", "props": {"url": ...}}; geotiff_source() builds one.`,
    );
  }

  // JSON is enough: a saved config is JSON by construction, and the one value in
  // it that JSON cannot carry -- a NaN nodata -- is resolved, so it is dropped
  // below anyway.
  const config = JSON.parse(JSON.stringify(savedConfig));
  const source = config.props.source;
  const savedType = source?.type;
  if (description.type !== savedType) {
    throw new LayerSourceError(
      `The plugin for layer "${name}" returned a "${description.type}" source, ` +
        `but the layer is saved as "${savedType}". A dynamic layer cannot ` +
        `change its source type between fetches.`,
    );
  }

  const rawUrl = description.props?.url;
  if (rawUrl === undefined || rawUrl === null || rawUrl === "") {
    throw new LayerSourceError(
      `The plugin for layer "${name}" returned a source description with no URL.`,
    );
  }
  const url = normalizeLayerUrl(rawUrl);
  if (!url) {
    throw new LayerSourceError(
      `The plugin for layer "${name}" returned the URL "${rawUrl}", which ` +
        `cannot be loaded. Layer URLs must be http(s), or a path on this ` +
        `server starting with "/".`,
    );
  }

  RUNTIME_SOURCE_FIELDS.forEach((field) => delete source[field]);
  source.props = { ...(source.props ?? {}) };
  // The file's own value, read by applyAutoRamp; never authored.
  delete source.props.nodata;
  source.props.url = url;
  // Overlaid only when sent: without one, the file's own GeoKeys decide, or an
  // author-set override on the saved layer does.
  const { projection } = description.props;
  if (typeof projection === "string" && projection.trim() !== "") {
    source.props.projection = projection;
  }

  const pinned = config.props.pluginSource?.stylePinned === true;
  if (!pinned && description.style && typeof description.style === "object") {
    overlayFetchStyle(source, description.style);
  }
  compileStartingStyle(config);

  return config;
}

/**
 * The message a GeoTIFF source failure is reported with.
 *
 * Two kinds of failure look alike from the event and call for different fixes:
 * a fetch that never got the bytes (CORS, no range requests, a dead host) and a
 * file that arrived but could not be read as a tiled GeoTIFF.
 *
 * @param {string} name The layer's name.
 * @param {string} phase Where it failed, e.g. "source error".
 * @param {string} [detail] The underlying error's message.
 * @returns {string}
 */
export function describeGeoTIFFSourceFailure(name, phase, detail = "") {
  const looksLikeFetchFailure =
    /request failed|AggregateError|CORS|blocked|Failed to fetch/i.test(detail);
  return looksLikeFetchFailure
    ? `GeoTIFF layer "${name}" failed to fetch the file. ` +
        `Check the Network tab — likely causes: CORS headers ` +
        `missing on the hosting server, no HTTP Range support, ` +
        `or the URL is unreachable. Detail: ${detail}.`
    : `GeoTIFF layer "${name}" failed (${phase}). ` +
        (detail ? `Detail: ${detail}. ` : "") +
        `The file may not be a Cloud Optimized GeoTIFF. ` +
        `Try converting with ` +
        `\`gdal_translate -of COG -co COMPRESS=DEFLATE -co PREDICTOR=YES input.tif output.tif\`.`;
}

/**
 * Report a mounted GeoTIFF (or Zarr) source's first failure.
 *
 * Only the first: a broken file fails every tile, and one message says it.
 *
 * @param {import("ol/source/Source.js").default} source
 * @param {string} name The layer's name, for the message.
 * @param {(message: string) => void} onError Called once with the message.
 * @returns {() => void} Detaches the listeners.
 */
export function attachGeoTIFFSourceErrorHandlers(source, name, onError) {
  let errorSurfaced = false;
  const surface = (phase) => (evt) => {
    if (errorSurfaced) return;
    errorSurfaced = true;
    const detail = evt?.error?.message || evt?.message || "";
    onError(describeGeoTIFFSourceFailure(name, phase, detail));
    console.warn(`GeoTIFF layer "${name}" (${phase}):`, evt?.error ?? evt);
  };
  const keys = [
    source.on("error", surface("source error")),
    source.on("tileloaderror", surface("tile load error")),
  ];
  return () => unByKey(keys);
}

// Settle once the source has opened its file, or failed to.
//
// This is the pre-flight's real check. The header reads that run before the
// source is built swallow their failures -- they leave the error to the source,
// which reports it with more to go on -- so a dead URL gets this far, and only
// the source's own state says so.
function awaitSourceReady(source, name, timeoutMs) {
  return new Promise((resolve, reject) => {
    let timer;
    const settle = () => {
      const state = source.getState();
      if (state === "loading") return false;
      source.removeEventListener("change", onChange);
      clearTimeout(timer);
      if (state === "ready") {
        resolve(source);
      } else {
        const detail = source.getError?.()?.message ?? "";
        reject(
          new GeoTIFFError(
            describeGeoTIFFSourceFailure(name, "source error", detail),
          ),
        );
      }
      return true;
    };
    const onChange = () => settle();
    if (settle()) return;
    source.addEventListener("change", onChange);
    timer = setTimeout(() => {
      source.removeEventListener("change", onChange);
      reject(
        new GeoTIFFError(
          `GeoTIFF layer "${name}" timed out opening the file after ` +
            `${Math.round(timeoutMs / 1000)} seconds.`,
        ),
      );
    }, timeoutMs);
  });
}

// The ramp the legend should label, chosen the way the static default legend
// chooses it: a set bound, then the resolved one, then 0..1 for a raster left
// on OpenLayers' normalized scale. Null when there is no colorbar to draw.
function legendRampFor(source) {
  if (isCategorical(source)) return null;
  const { rampName } = source;
  if (typeof rampName !== "string" || !resolveRamp(rampName)) return null;

  const normalized = source.props?.normalize === true;
  const rampMin =
    boundValue(source.rampMin) ??
    source.resolvedRampMin ??
    (normalized ? 0 : undefined);
  const rampMax =
    boundValue(source.rampMax) ??
    source.resolvedRampMax ??
    (normalized ? 1 : undefined);
  if (rampMin === undefined || rampMax === undefined) return null;
  return {
    rampName,
    rampReverse: source.rampReverse === true,
    rampMin,
    rampMax,
  };
}

/**
 * Build the source and style a runtime GeoTIFF layer will draw, off the map.
 *
 * Resolves the ramp's range from the file, places its CRS, and opens it. Any
 * failure rejects before the layer is touched, so a caller that applies only on
 * success keeps the previous file drawn.
 *
 * @param {object} effectiveConfig From resolveEffectiveRasterConfig. Mutated:
 *   applyAutoRamp writes the resolved range and style onto it.
 * @param {string} viewProjCode The map view's projection code.
 * @param {{timeoutMs?: number}} [options]
 * @returns {Promise<{source: object, style: object|undefined,
 *   legendRamp: {rampName: string, rampReverse: boolean, rampMin: number,
 *   rampMax: number}|null}>}
 * @throws {GeoTIFFError|LayerSourceError} On an unplaceable CRS, a float raster
 *   with no range to fit, an unreadable or unreachable file, or a timeout.
 */
export async function buildRuntimeRaster(
  effectiveConfig,
  viewProjCode,
  { timeoutMs = RUNTIME_RASTER_READY_TIMEOUT_MS } = {},
) {
  await applyAutoRamp(effectiveConfig);
  const sourceConfig = effectiveConfig.props.source;
  // moduleLoader's GeoTIFF branch places the CRS and raises the unrangeable
  // float raster applyAutoRamp recorded, so neither is repeated here. It
  // rewrites the props it is given, which is why it gets a copy: the config's
  // own source stays in the saved shape the legend reads.
  const source = await moduleLoader(
    { ...sourceConfig, props: { ...sourceConfig.props } },
    viewProjCode,
  );
  await awaitSourceReady(source, effectiveConfig.props.name, timeoutMs);
  return {
    source,
    style: effectiveConfig.style,
    legendRamp: legendRampFor(sourceConfig),
  };
}

/**
 * Repoint a runtime GeoTIFF layer at a built source, in place.
 *
 * The OpenLayers layer is kept, and with it its identity tags (`layerId`,
 * `pluginSource`), z-order, opacity and popups -- as swapVectorLayerFeatures
 * keeps a vector layer. OpenLayers clears the renderer's cache on a source
 * change and re-applies the style once the new source is ready.
 *
 * @param {import("ol/layer/WebGLTile.js").default} olLayer
 * @param {{source: object, style?: object}} built From buildRuntimeRaster.
 */
export function applyRuntimeRaster(olLayer, built) {
  olLayer.setSource(built.source);
  // OpenLayers reads `style.variables` unguarded, and an unstyled WebGLTile is
  // constructed with an empty style, so an empty one is what "none" means.
  olLayer.setStyle(built.style ?? {});
}
