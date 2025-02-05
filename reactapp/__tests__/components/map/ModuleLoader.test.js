import moduleLoader from "components/map/ModuleLoader";
import WebGLTile from "ol/layer/WebGLTile.js";
import VectorTileLayer from "ol/layer/VectorTile.js";
import VectorLayer from "ol/layer/Vector.js";

test("WebGLTile Instance", async () => {
  const layerConfig = {
    type: "WebGLTile",
    props: {
      source: {
        type: "ImageTile",
        props: {
          url: "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        },
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

test("VectorTileLayer Instance", async () => {
  const layerConfig = {
    type: "VectorTileLayer",
    props: {
      source: {
        type: "VectorTile",
        props: {
          urls: [
            "https://ahocevar.com/geoserver/gwc/service/tms/1.0.0/ne:ne_10m_admin_0_countries@EPSG%3A900913@pbf/{z}/{x}/{-y}.pbf",
          ],
          someProp: [{ randomProp: "someValue" }],
          someOtherProp: { randomProp: "someValue" },
        },
      },
      name: "Vector Tile Layer",
      zIndex: 0,
    },
  };
  const layerInstance = await moduleLoader(layerConfig);
  expect(layerInstance instanceof VectorTileLayer).toBe(true);

  const cachedLayerInstance = await moduleLoader(layerConfig);
  expect(cachedLayerInstance instanceof VectorTileLayer).toBe(true);
});

test("GeoJSON Instance", async () => {
  const layerConfig = {
    type: "VectorLayer",
    props: {
      opacity: ".5",
      name: "GeoJSON Layer",
      source: {
        type: "GeoJSON",
        props: {},
        features: {
          type: "FeatureCollection",
          crs: {
            type: "name",
            properties: {
              name: "EPSG:3857",
            },
          },
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [0, 0],
              },
            },
          ],
        },
      },
      zIndex: 1,
    },
  };
  const layerInstance = await moduleLoader(layerConfig);
  expect(layerInstance instanceof VectorLayer).toBe(true);
  expect(layerInstance.getOpacity()).toBe(0.5);

  const cachedLayerInstance = await moduleLoader(layerConfig);
  expect(cachedLayerInstance instanceof VectorLayer).toBe(true);
});

test("Non Constructor Error", async () => {
  jest.mock("ol/layer/Image.js", () => "non function");
  const layerConfig = {
    type: "ImageLayer",
    props: {
      name: "ImageWMS Layer",
      source: {
        type: "ImageWMS",
        props: {
          url: "https://ahocevar.com/geoserver/wms",
          params: { LAYERS: "topp:states" },
        },
      },
      zIndex: 1,
    },
  };
  await expect(moduleLoader(layerConfig)).rejects.toThrow(
    "Module 'ImageLayer' does not export a constructor"
  );
});

test("Non Existing OL Import", async () => {
  const layerConfig = {
    type: "BadLayer",
    props: {
      name: "ImageWMS Layer",
      source: {
        type: "ImageWMS",
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
        type: "ImageWMS",
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
        type: "ImageTile",
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
