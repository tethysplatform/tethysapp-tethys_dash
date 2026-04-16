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

const moduleCache = {};
const styleCache = new Map();

const moduleLoader = async (config, mapProjection) => {
  if (config.type === "Static Image" && typeof config.props?.imageExtent === "string") {
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
        return new moduleCache[type](resolvedProps);
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
      return new ModuleConstructor(resolvedProps);
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
  const vectorSource = new VectorSource({
    features: new GeoJSON().readFeatures(config.geojson, {
      dataProjection: config.geojson.crs.properties.name, // CRS of the GeoJSON data
      featureProjection: mapProjection, // CRS of the map
    }),
  });
  return vectorSource;
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
  const b =
    typeof conditionValue === "string" && !isNaN(conditionValue)
      ? Number(conditionValue)
      : conditionValue;

  const av = typeof a === "string" && !isNaN(a) ? Number(a) : a;

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

export function createDiamondIconStyle({ size, fill, stroke }) {
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
    }),
  });
}

export function buildPointStyle(shape, size, fill, stroke, iconUrl) {
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
          scale: [1, 0.5],
        }),
      });

    case "triangle":
      return new Style({
        image: new RegularShape({
          points: 3,
          radius: size,
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
          fill,
          stroke,
        }),
      });

    case "diamond":
      return createDiamondIconStyle({ size, fill, stroke });

    case "cross":
      return new Style({
        image: new RegularShape({
          points: 4,
          radius: size,
          radius2: 0,
          angle: 0,
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

      // Defensive: convert rule values to correct types
      const fv = properties[rule.conditionField];
      let ruleValue = rule.conditionValue;
      if (
        typeof fv === "number" &&
        typeof ruleValue === "string" &&
        !isNaN(ruleValue)
      ) {
        ruleValue = Number(ruleValue);
      }

      if (
        rule.conditionField &&
        rule.conditionType &&
        matchesCondition(fv, rule.conditionType, ruleValue)
      ) {
        merged = mergeStyleProperties(merged, rule);
      }
    }

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
