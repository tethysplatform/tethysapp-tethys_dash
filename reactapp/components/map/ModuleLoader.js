import { moduleMap } from "components/map/moduleMap";
import { Vector as VectorSource } from "ol/source.js";
import MVT from "ol/format/MVT.js";
import KML from "ol/format/KML.js";
import GeoJSON from "ol/format/GeoJSON.js";
import EsriJSON from "ol/format/EsriJSON";
import { tile as tileStrategy } from "ol/loadingstrategy.js";
import { createXYZ } from "ol/tilegrid.js";
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
import { rewriteArcGISExportUrlForAntimeridian } from "components/map/utilities";
import {
  buildGeoTIFFStyleColor,
  buildCategoricalStyleColor,
  isUsableClass,
} from "components/map/geoTIFFStyle";

const moduleCache = {};
const styleCache = new Map();

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

// A "Zarr" source is sugar over the zarr/cog endpoint: the author supplies a
// store URL + variable (+ optional index/mask_below) and we assemble the COG
// URL, then render it as an ordinary GeoTIFF source. Variable inputs in the
// fields (e.g. index="${Storm}") are already substituted before this runs.
const ZARR_APP_ROOT = process.env.TETHYS_APP_ROOT_URL ?? "/apps/tethysdash/";

// Single place that turns Zarr source props into a COG URL, so the layer's
// source and the stats pre-read below can never disagree about the slice.
export function zarrCogUrl(sourceProps) {
  const { url, variable, index, mask_below } = sourceProps ?? {};
  const params = new URLSearchParams({
    src: url ?? "",
    variable: variable ?? "",
    index: index ?? "0",
  });
  if (mask_below !== undefined && mask_below !== "") {
    params.set("mask_below", mask_below);
  }
  return `${ZARR_APP_ROOT}zarr/cog/?${params.toString()}`;
}

export function zarrSourceToGeoTIFF(config) {
  const { normalize } = config.props ?? {};
  return {
    ...config,
    type: "GeoTIFF",
    props: {
      sources: [{ url: zarrCogUrl(config.props) }],
      normalize: normalize ?? true,
    },
  };
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

// Where to read STATISTICS_* for a ramp-styled raster source, or null when the
// source is not a candidate for an auto-fitted ramp.
//
// The GeoTIFF URL is author-supplied, so it is restricted to http(s):
// file:/blob:/data:/protocol-relative must not be fetched. The Zarr endpoint is
// app-relative and built by us, so it skips that check.
function autoRampStatsUrl(source) {
  if (source?.type === "Zarr") return zarrCogUrl(source.props);
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
        hasNodata: true,
        maskBelow: source.props?.mask_below,
      }),
    });

    if (isCategorical) {
      // No statistics needed: the class values are the scale. Raw band values
      // are required though, so normalization goes off unconditionally.
      source.props = { ...(source.props ?? {}), normalize: false };
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

const moduleLoader = async (config, mapProjection) => {
  if (config.type === "Zarr") {
    // Already yields OL's `sources` shape, so it skips the GeoTIFF branch below.
    config = zarrSourceToGeoTIFF(config);
  } else if (config.type === "GeoTIFF") {
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
        return new moduleCache[type](withAntimeridianFix(type, resolvedProps));
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
    } else if (type === "ESRI Feature Service") {
      return loadESRIJSON(config);
    } else {
      return new ModuleConstructor(withAntimeridianFix(type, resolvedProps));
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
