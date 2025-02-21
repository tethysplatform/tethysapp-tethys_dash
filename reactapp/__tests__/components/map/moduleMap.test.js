import { moduleMap } from "components/map/moduleMap";
import WebGLTile from "ol/layer/WebGLTile.js";
import ImageLayer from "ol/layer/Image.js";
import VectorLayer from "ol/layer/Vector.js";
import VectorTileLayer from "ol/layer/VectorTile.js";
import TileLayer from "ol/layer/Tile.js";
import ImageTile from "ol/source/ImageTile.js";
import VectorTile from "ol/source/VectorTile.js";
import ImageArcGISRest from "ol/source/ImageArcGISRest.js";
import Vector from "ol/source/Vector.js";
import ImageWMS from "ol/source/ImageWMS.js";
import Raster from "ol/source/Raster.js";
import GeoJSON from "ol/format/GeoJSON.js";
import Style from "ol/style/Style.js";
import Stroke from "ol/style/Stroke.js";
import Fill from "ol/style/Fill.js";

test("Module Map Imports", async () => {
  let modulePath, importModule, module;

  modulePath = "ol/layer/WebGLTile.js";
  importModule = moduleMap[modulePath];
  module = await importModule();
  expect(module.default).toBe(WebGLTile);

  modulePath = "ol/layer/Image.js";
  importModule = moduleMap[modulePath];
  module = await importModule();
  expect(module.default).toBe(ImageLayer);

  modulePath = "ol/layer/Vector.js";
  importModule = moduleMap[modulePath];
  module = await importModule();
  expect(module.default).toBe(VectorLayer);

  modulePath = "ol/layer/VectorTile.js";
  importModule = moduleMap[modulePath];
  module = await importModule();
  expect(module.default).toBe(VectorTileLayer);

  modulePath = "ol/layer/Tile.js";
  importModule = moduleMap[modulePath];
  module = await importModule();
  expect(module.default).toBe(TileLayer);

  modulePath = "ol/source/ImageTile.js";
  importModule = moduleMap[modulePath];
  module = await importModule();
  expect(module.default).toBe(ImageTile);

  modulePath = "ol/source/VectorTile.js";
  importModule = moduleMap[modulePath];
  module = await importModule();
  expect(module.default).toBe(VectorTile);

  modulePath = "ol/source/ImageArcGISRest.js";
  importModule = moduleMap[modulePath];
  module = await importModule();
  expect(module.default).toBe(ImageArcGISRest);

  modulePath = "ol/source/Vector.js";
  importModule = moduleMap[modulePath];
  module = await importModule();
  expect(module.default).toBe(Vector);

  modulePath = "ol/source/ImageWMS.js";
  importModule = moduleMap[modulePath];
  module = await importModule();
  expect(module.default).toBe(ImageWMS);

  modulePath = "ol/source/Raster.js";
  importModule = moduleMap[modulePath];
  module = await importModule();
  expect(module.default).toBe(Raster);

  modulePath = "ol/format/GeoJSON.js";
  importModule = moduleMap[modulePath];
  module = await importModule();
  expect(module.default).toBe(GeoJSON);

  modulePath = "ol/style/Style.js";
  importModule = moduleMap[modulePath];
  module = await importModule();
  expect(module.default).toBe(Style);

  modulePath = "ol/style/Stroke.js";
  importModule = moduleMap[modulePath];
  module = await importModule();
  expect(module.default).toBe(Stroke);

  modulePath = "ol/style/Fill.js";
  importModule = moduleMap[modulePath];
  module = await importModule();
  expect(module.default).toBe(Fill);
});
