import moduleLoader from "components/map/ModuleLoader";
import WebGLTile from "ol/layer/WebGLTile.js";
import VectorTileLayer from "ol/layer/VectorTile.js";
import VectorLayer from "ol/layer/Vector.js";
import {
  layerConfigGeoJSON,
  layerConfigWebGLTile,
  layerConfigImageWMS,
  layerConfigVectorTile,
  layerConfigArcGISFeatureService,
} from "__tests__/utilities/constants";

test("WebGLTile Instance", async () => {
  const layerInstance = await moduleLoader(layerConfigWebGLTile.configuration);
  expect(layerInstance instanceof WebGLTile).toBe(true);

  const cachedLayerInstance = await moduleLoader(
    layerConfigWebGLTile.configuration
  );
  expect(cachedLayerInstance instanceof WebGLTile).toBe(true);
});

test("VectorTileLayer Instance", async () => {
  const layerInstance = await moduleLoader(layerConfigVectorTile.configuration);
  expect(layerInstance instanceof VectorTileLayer).toBe(true);

  const cachedLayerInstance = await moduleLoader(
    layerConfigVectorTile.configuration
  );
  expect(cachedLayerInstance instanceof VectorTileLayer).toBe(true);
});

test("GeoJSON Instance", async () => {
  const layerInstance = await moduleLoader(layerConfigGeoJSON.configuration);
  expect(layerInstance instanceof VectorLayer).toBe(true);
  expect(layerInstance.getOpacity()).toBe(0.5);

  const cachedLayerInstance = await moduleLoader(
    layerConfigGeoJSON.configuration
  );
  expect(cachedLayerInstance instanceof VectorLayer).toBe(true);
});

test("ArcGIS Feature Service Instance", async () => {
  const layerInstance = await moduleLoader(
    layerConfigArcGISFeatureService.configuration
  );
  expect(layerInstance instanceof VectorLayer).toBe(true);

  const cachedLayerInstance = await moduleLoader(
    layerConfigArcGISFeatureService.configuration
  );
  expect(cachedLayerInstance instanceof VectorLayer).toBe(true);
});

test("Non Constructor Error", async () => {
  jest.mock("ol/layer/Image.js", () => "non function");
  await expect(moduleLoader(layerConfigImageWMS.configuration)).rejects.toThrow(
    "Module 'ImageLayer' does not export a constructor"
  );
});

test("Non Existing OL Import", async () => {
  const layerConfig = {
    type: "BadLayer",
    props: {
      name: "ImageWMS Layer",
      source: {
        type: "WMS",
        props: {
          url: "https://ahocevar.com/geoserver/wms",
          params: { LAYERS: "topp:states" },
        },
      },
      zIndex: 1,
    },
  };
  await expect(moduleLoader(layerConfig)).rejects.toThrow(
    "No module path found for type 'BadLayer'."
  );
});

test("Missing Import in Mapper", async () => {
  const layerConfig = {
    type: "InvalidForTesting",
    props: {
      name: "ImageWMS Layer",
      source: {
        type: "WMS",
        props: {
          url: "https://ahocevar.com/geoserver/wms",
          params: { LAYERS: "topp:states" },
        },
      },
      zIndex: 1,
    },
  };
  await expect(moduleLoader(layerConfig)).rejects.toThrow(
    "No importer found for module path 'DontUseThis'."
  );
});

test("Null Props", async () => {
  const layerConfig = {
    type: "WebGLTile",
    props: {
      source: {
        type: "Image Tile",
        props: null,
      },
      name: "World Light Gray Base",
      zIndex: 0,
    },
  };
  const layerInstance = await moduleLoader(layerConfig);
  expect(layerInstance instanceof WebGLTile).toBe(true);

  const cachedLayerInstance = await moduleLoader(layerConfig);
  expect(cachedLayerInstance instanceof WebGLTile).toBe(true);
});
