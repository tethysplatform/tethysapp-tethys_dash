import { moduleMap } from "components/map/moduleMap";
import { Vector as VectorSource } from "ol/source.js";
import MVT from "ol/format/MVT.js";
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

const moduleCache = {};

const moduleLoader = async (config, mapProjection) => {
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
        return new moduleCache[type](resolvedProps);
      }
    }
    const importModule = getModuleImporter(type);
    const module = await importModule();

    const ModuleConstructor = module.default;

    if (typeof ModuleConstructor !== "function") {
      throw new Error(`Module '${type}' does not export a constructor.`);
    }

    moduleCache[type] = ModuleConstructor;

    const resolvedProps = await resolveProps(props, mapProjection);
    if (type === "Vector Tile") {
      resolvedProps.format = new MVT();
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
          })
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
    Style: "ol/style/Style.js",
    Stroke: "ol/style/Stroke.js",
    Fill: "ol/style/Fill.js",
    "ESRI Feature Service": "ol/format/EsriJSON.js",
    InvalidForTesting: "DontUseThis",
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

const loadESRIJSON = (config) => {
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
            "}}"
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
      })
    ),
    attributions: config.props.attributions,
  });
  return vectorSource;
};

function getSizeFromData(value, sizeRanges = []) {
  const val = parseFloat(value);
  if (isNaN(val)) return 5; // default size

  for (const range of sizeRanges) {
    const min = range.min ?? -Infinity;
    const max = range.max ?? Infinity;
    if (val >= min && val < max) {
      return range.size;
    }
  }

  return 5; // fallback default
}

export function createJsonStyleFunction(styleJson) {
  return function styleFunction(feature) {
    const properties = feature.getProperties();

    for (const rule of styleJson.rules || []) {
      const conditions = rule.conditions || {};
      const matches = Object.keys(conditions).every(
        (key) => properties[key] === conditions[key]
      );

      if (!matches) continue;

      // Determine size
      let size = 5; // default
      if (rule.size) {
        if (typeof rule.size === "string" && properties[rule.size] != null) {
          size = getSizeFromData(properties[rule.size], styleJson.sizeRanges);
        } else {
          size = rule.size;
        }
      }

      const fill = new Fill({ color: rule.fill || "gray" });
      const stroke = new Stroke({
        color: rule.stroke || "black",
        width: rule.strokeWidth || 1,
      });

      // Shape handling
      switch (rule.shape) {
        case "circle":
          return new Style({
            image: new CircleStyle({ radius: size, fill, stroke }),
          });

        case "square":
          return new Style({
            image: new RegularShape({
              fill: fill,
              stroke: stroke,
              points: 4,
              radius: size,
              angle: Math.PI / 4,
            }),
          });

        case "rectangle":
          return new Style({
            image: new RegularShape({
              fill: fill,
              stroke: stroke,
              radius: 10 / Math.SQRT2,
              radius2: 10,
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
              rotation: 0,
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
          return new Style({
            image: new Icon({
              anchor: [0.5, 0.5],
              img: (() => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                const s = size * 2;
                canvas.width = s;
                canvas.height = s;
                ctx.translate(s / 2, s / 2);

                const horizontalScale = 0.6; // makes diamond more pointy

                ctx.fillStyle = fill.getColor();
                ctx.strokeStyle = stroke.getColor();
                ctx.lineWidth = stroke.getWidth();

                // Top triangle
                ctx.beginPath();
                ctx.moveTo(0, -size); // top vertex
                ctx.lineTo(size * horizontalScale, 0); // right vertex
                ctx.lineTo(-size * horizontalScale, 0); // left vertex
                ctx.closePath();
                ctx.fill();
                // Stroke only left and right edges
                ctx.beginPath();
                ctx.moveTo(0, -size);
                ctx.lineTo(size * horizontalScale, 0);
                ctx.moveTo(0, -size);
                ctx.lineTo(-size * horizontalScale, 0);
                ctx.stroke();

                // Bottom triangle
                ctx.beginPath();
                ctx.moveTo(0, size); // bottom vertex
                ctx.lineTo(size * horizontalScale, 0); // right vertex
                ctx.lineTo(-size * horizontalScale, 0); // left vertex
                ctx.closePath();
                ctx.fill();
                // Stroke only left and right edges
                ctx.beginPath();
                ctx.moveTo(0, size);
                ctx.lineTo(size * horizontalScale, 0);
                ctx.moveTo(0, size);
                ctx.lineTo(-size * horizontalScale, 0);
                ctx.stroke();

                return canvas;
              })(),
              imgSize: [size * 2, size * 2],
            }),
          });

        case "cross":
          return new Style({
            image: new RegularShape({
              fill: fill,
              stroke: stroke,
              points: 4,
              radius: size,
              radius2: 0,
              angle: 0,
            }),
          });

        case "x":
          return new Style({
            image: new RegularShape({
              fill: fill,
              stroke: stroke,
              points: 4,
              radius: size,
              radius2: 0,
              angle: Math.PI / 4,
            }),
          });

        case "icon":
          if (rule.iconUrl) {
            return new Style({
              image: new Icon({
                src: rule.iconUrl,
                scale: size / 10, // adjust icon scale if needed
              }),
            });
          }
          break;

        default:
          // fallback to circle
          return new Style({
            image: new CircleStyle({ radius: size, fill, stroke }),
          });
      }
    }

    // default style if no rules match
    return new Style({
      image: new CircleStyle({
        radius: 5,
        fill: new Fill({ color: "gray" }),
        stroke: new Stroke({ color: "black", width: 1 }),
      }),
    });
  };
}

export default moduleLoader;
