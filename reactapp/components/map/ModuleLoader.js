import { moduleMap } from "components/map/moduleMap";
import { Vector as VectorSource } from "ol/source.js";
import MVT from "ol/format/MVT.js";
import GeoJSON from "ol/format/GeoJSON.js";

const moduleCache = {};

const moduleLoader = async (config, mapProjection) => {
  const { type, props } = config;

  try {
    if (moduleCache[type]) {
      if (type === "GeoJSON") {
        return loadGeoJSON(config, mapProjection);
      } else {
        const resolvedProps = await resolveProps(props, mapProjection);
        if (type === "VectorTile") {
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
    if (type === "VectorTile") {
      resolvedProps.format = new MVT();
    }

    if (type === "GeoJSON") {
      return loadGeoJSON(config, mapProjection);
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
    ImageTile: "ol/source/ImageTile.js",
    VectorTile: "ol/source/VectorTile.js",
    ImageArcGISRest: "ol/source/ImageArcGISRest.js",
    Vector: "ol/source/Vector.js",
    ImageWMS: "ol/source/ImageWMS.js",
    Raster: "ol/source/Raster.js",
    GeoJSON: "ol/format/GeoJSON.js",
    Style: "ol/style/Style.js",
    Stroke: "ol/style/Stroke.js",
    Fill: "ol/style/Fill.js",
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

export default moduleLoader;
