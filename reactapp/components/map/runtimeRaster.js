import { unByKey } from "ol/Observable";
import moduleLoader, {
  applyAutoRamp,
  GeoTIFFError,
  LayerSourceError,
} from "components/map/ModuleLoader";
import {
  classLegendItems,
  hasClassStyle,
  isRampBoundSet,
  rasterStyleSettings,
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
 * Whether a layer config is a runtime GeoTIFF: a WebGLTile over a GeoTIFF
 * source whose file is chosen by a dynamic map layer plugin.
 *
 * Such a layer is built with no source at all, and the runtime fetcher hands it
 * one per fetch. Takes the layer `configuration`, not the grid-item wrapper.
 *
 * @param {object} config
 * @returns {boolean}
 */
export function isRuntimeRasterConfig(config) {
  return Boolean(
    config?.type === "WebGLTile" &&
    config.props?.source?.type === "GeoTIFF" &&
    config.props.pluginSource &&
    config.props.layerId,
  );
}

/**
 * How long building a runtime raster may take before the build gives up.
 *
 * The deadline covers the whole build -- the statistics and header reads as well
 * as the source opening its file -- because none of them has a timeout of its
 * own: a host that accepts the connection and never answers would otherwise
 * leave the layer loading forever, and the fetch that asked for it with it.
 * Thirty seconds is long enough for a slow header read over a poor connection
 * and short enough that a stalled one is reported.
 */
export const RUNTIME_RASTER_READY_TIMEOUT_MS = 30_000;

/**
 * Release a built source that will never be drawn.
 *
 * Detaches every listener on it -- OpenLayers' dispose clears them -- so a
 * source abandoned mid-open cannot report into a layer it never reached.
 * Tolerates a missing source, and one without a dispose.
 *
 * @param {import("ol/source/Source.js").default|null|undefined} source
 */
export function disposeRuntimeSource(source) {
  source?.dispose?.();
}

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
      // The regex has already matched the scheme, so this agrees with it by
      // construction; it is the same fail-closed re-check as below.
      // istanbul ignore next -- unreachable; see above
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
  // matters is where the browser will actually send the request. Neither can
  // fail for a single-slash path resolved against this page's own origin, so
  // these are fail-closed guards against a URL parser that normalizes
  // differently to the one these rules were written against -- the same reason
  // the catch above exists.
  // istanbul ignore next -- unreachable; see above
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  // istanbul ignore next -- unreachable; see above
  if (parsed.origin !== origin) return null;
  return parsed.href;
}

// A bound the author or the plugin set, as a number, or undefined when it is
// empty -- which means "resolve it from the file", not zero.
function boundValue(value) {
  return isRampBoundSet(value) ? Number(value) : undefined;
}

// Replace the saved style with a fetch's. The wire's style keys are the saved
// style's, so this is a key-for-key copy -- but of the fetch's keys only, with
// nothing kept from the saved style: a plugin that sends a ramp and no bounds
// means "auto-range this one", which inheriting the saved bounds would undo.
function overlayFetchStyle(config, fetchStyle) {
  const wasClassStyled = hasClassStyle(rasterStyleSettings(config.style));
  const { rampName, rampMin, rampMax, rampReverse } = fetchStyle;
  const style = {};
  if (typeof rampName === "string" && rampName !== "") {
    style.rampName = rampName;
  }
  if (rampMin !== undefined && rampMin !== null) style.rampMin = rampMin;
  if (rampMax !== undefined && rampMax !== null) style.rampMax = rampMax;
  // Kept only when set, as the editor saves it.
  if (rampReverse === true) style.rampReverse = true;
  config.style = style;
  // Nearest-neighbor resampling is written onto the source by a class-table
  // (Categorical or Ranges) style, and is meaningless for the ramp replacing
  // it -- it would blur nothing but nodata edges. The source behavior is
  // derived from the style at load, but only ever set there, never cleared, so
  // a layer that stops being class-styled has to be cleaned up here.
  const sourceProps = config.props.source.props;
  if (wasClassStyled && sourceProps?.interpolate === false) {
    delete sourceProps.interpolate;
  }
}

// Check the style in effect before anything is read: a ramp name that does not
// exist is the plugin's or the author's mistake, and is reported as such rather
// than leaving the layer to draw without a style. applyAutoRamp compiles the
// style itself -- a starting style before the file is read, refined once its
// range is known -- so nothing is compiled here.
function checkEffectiveStyle(config) {
  const style = rasterStyleSettings(config.style);
  if (hasClassStyle(style)) return;
  const { rampName } = style;
  if (typeof rampName !== "string" || rampName.trim() === "") return;
  if (!resolveRamp(rampName)) {
    throw new LayerSourceError(
      `Layer "${config.props.name}" was given the color ramp "${rampName}", ` +
        `which does not exist.`,
    );
  }
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
 * The style in effect is the config's `style`: ramp settings, in the same keys
 * the fetch's `style` uses. It is compiled for the returned file by
 * buildRuntimeRaster, never here and never into the saved config.
 *
 * @param {object} savedConfig The layer's saved `configuration`: a WebGLTile
 *   whose `props.source` is a GeoTIFF with no URL, and whose `style` holds its
 *   ramp settings.
 * @param {object} description The fetch's source description,
 *   `{type, props: {url, projection?, mask_below?}, style?: {rampName?,
 *   rampMin?, rampMax?, rampReverse?}}`.
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
  // A source property, so it arrives with the props and is applied whether or
  // not the author pinned the style: the mask describes which values the file
  // publishes as real data, not how they are coloured. An omitted one leaves
  // the author's setting standing; an explicit empty clears it.
  const { mask_below: maskBelow } = description.props;
  if (maskBelow !== undefined) {
    if (maskBelow === null || maskBelow === "") {
      delete source.props.mask_below;
    } else {
      source.props.mask_below = maskBelow;
    }
  }

  const pinned = config.props.pluginSource?.stylePinned === true;
  if (!pinned && description.style && typeof description.style === "object") {
    overlayFetchStyle(config, description.style);
  }
  checkEffectiveStyle(config);

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
 * OpenLayers' GeoTIFF source never dispatches an "error" event: a file it cannot
 * open moves the source to the "error" state, which only a "change" listener
 * sees, with the cause on getError(). The "error" listener stays for a source
 * that does dispatch one. A source already in the error state when this is
 * attached is reported at once, since its "change" has already fired.
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
  const surfaceStateError = surface("source error");
  const checkState = () => {
    if (source.getState?.() !== "error") return;
    surfaceStateError({ error: source.getError?.() });
  };
  const keys = [
    source.on("error", surface("source error")),
    source.on("tileloaderror", surface("tile load error")),
    source.on("change", checkState),
  ];
  checkState();
  return () => unByKey(keys);
}

// Settle once the source has opened its file, or failed to.
//
// This is the pre-flight's real check. The header reads that run before the
// source is built swallow their failures -- they leave the error to the source,
// which reports it with more to go on -- so a dead URL gets this far, and only
// the source's own state says so. Unbounded: buildRuntimeRaster's deadline
// covers it, and disposing the source on that deadline drops the listener.
function awaitSourceReady(source, name) {
  return new Promise((resolve, reject) => {
    const settle = () => {
      const state = source.getState();
      if (state === "loading") return false;
      source.removeEventListener("change", onChange);
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
  });
}

// The ramp the legend should label, chosen the way the static default legend
// chooses it: a set bound, then the resolved one, then 0..1 for a raster left
// on OpenLayers' normalized scale. A class-table style (Categorical or Ranges)
// has no colorbar; it gets the static legend's per-class swatches instead, as
// `{items}`. Null when there is nothing to draw.
//
// The settings come from the config's style; what was resolved about the file
// -- its range, whether it stayed normalized -- from its source.
function legendRampFor(config) {
  const style = rasterStyleSettings(config.style);
  const source = config.props.source;
  if (hasClassStyle(style)) return { items: classLegendItems(style) };
  const { rampName } = style;
  if (typeof rampName !== "string" || !resolveRamp(rampName)) return null;

  const rampReverse = style.rampReverse === true;
  const rampMin = boundValue(style.rampMin) ?? source.resolvedRampMin;
  const rampMax = boundValue(style.rampMax) ?? source.resolvedRampMax;
  if (rampMin !== undefined && rampMax !== undefined) {
    return { rampName, rampReverse, rampMin, rampMax };
  }
  // Nothing pinned and nothing resolved: the raster is drawing on OpenLayers'
  // normalized 0..1 scale, and the colorbar says so rather than being dropped
  // -- a drawn raster with no legend reads as a bug.
  //
  // applyAutoRamp writes `normalize` on every build and leaves it true exactly
  // when it had no range to pin, so for a runtime raster the other case cannot
  // arise. The guard is kept so this stays in step with the static default
  // legend in visualizations/Map.js, which reads author-written source props
  // and does meet a raster with neither a range nor normalization.
  // istanbul ignore next -- unreachable here; see above
  if (!source.props?.normalize) return null;
  return { rampName, rampReverse, rampMin: 0, rampMax: 1 };
}

/**
 * Build the source and style a runtime GeoTIFF layer will draw, off the map.
 *
 * Resolves the ramp's range from the file, places its CRS, and opens it. Any
 * failure rejects before the layer is touched, so a caller that applies only on
 * success keeps the previous file drawn.
 *
 * @param {object} effectiveConfig From resolveEffectiveRasterConfig. Mutated:
 *   applyAutoRamp writes the resolved range onto its source and the compiled
 *   style onto its (non-enumerable) `compiledStyle`.
 * @param {string} viewProjCode The map view's projection code.
 * @param {{timeoutMs?: number}} [options]
 * @returns {Promise<{source: object, style: object|undefined,
 *   legendRamp: {rampName: string, rampReverse: boolean, rampMin: number,
 *   rampMax: number}|{items: object[]}|null}>}
 * @throws {GeoTIFFError|LayerSourceError} On an unplaceable CRS, a float raster
 *   with no range to fit, an unreadable or unreachable file, or a timeout.
 */
export async function buildRuntimeRaster(
  effectiveConfig,
  viewProjCode,
  { timeoutMs = RUNTIME_RASTER_READY_TIMEOUT_MS } = {},
) {
  const name = effectiveConfig.props.name;
  // Once the deadline has passed, whatever the build goes on to make is thrown
  // away: the steps before it cannot be cancelled, only outlived.
  let abandoned = false;
  let openingSource = null;
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      abandoned = true;
      disposeRuntimeSource(openingSource);
      reject(
        new GeoTIFFError(
          `GeoTIFF layer "${name}" timed out opening the file after ` +
            `${Math.round(timeoutMs / 1000)} seconds.`,
        ),
      );
    }, timeoutMs);
  });

  const build = async () => {
    await applyAutoRamp(effectiveConfig);
    if (abandoned) return null;
    const sourceConfig = effectiveConfig.props.source;
    // moduleLoader's GeoTIFF branch places the CRS and raises the unrangeable
    // float raster applyAutoRamp recorded, so neither is repeated here. It
    // rewrites the props it is given, which is why it gets a copy: the config's
    // own source stays in the saved shape the legend reads.
    const source = await moduleLoader(
      { ...sourceConfig, props: { ...sourceConfig.props } },
      viewProjCode,
    );
    // istanbul ignore next -- the deadline landing inside moduleLoader's own
    // header reads; not schedulable from the suite, which cannot hold those
    // reads open past a deadline and then release them.
    if (abandoned) {
      disposeRuntimeSource(source);
      return null;
    }
    openingSource = source;
    try {
      await awaitSourceReady(source, name);
    } catch (err) {
      disposeRuntimeSource(source);
      throw err;
    }
    return {
      source,
      // The style compiled for this file. Never the saved style, which is
      // settings OpenLayers cannot draw.
      style: effectiveConfig.compiledStyle,
      legendRamp: legendRampFor(effectiveConfig),
    };
  };

  try {
    return await Promise.race([build(), deadline]);
  } finally {
    clearTimeout(timer);
  }
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
