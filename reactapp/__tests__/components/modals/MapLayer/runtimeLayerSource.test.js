import {
  DEFAULT_DYNAMIC_LAYER_SOURCE,
  findDynamicLayerOption,
  getDynamicLayerSourceType,
} from "components/modals/MapLayer/runtimeLayerSource";

// The plugin list as AppContext holds it: grouped options, each carrying the
// plugin's `source` name and whatever layer type it declares it drives.
const rasterPlugin = {
  label: "Echo Runtime Raster",
  value: "Echo Runtime Raster",
  source: "echo_runtime_raster",
  dynamic_map_layer_source: "GeoTIFF",
};
const vectorPlugin = {
  label: "Gauges",
  value: "Gauges",
  source: "gauges",
  dynamic_map_layer_source: "GeoJSON",
};
// A plugin served by a backend old enough not to send the metadata key.
const undeclaredPlugin = {
  label: "Legacy",
  value: "Legacy",
  source: "legacy_plugin",
};

const dynamicMapLayers = [
  { label: "Dynamic Map Layers", options: [rasterPlugin, vectorPlugin] },
  { label: "Other", options: [undeclaredPlugin] },
];

describe("findDynamicLayerOption", () => {
  test("matches a saved layer by the plugin source it is bound to", () => {
    expect(
      findDynamicLayerOption(dynamicMapLayers, {
        source: "echo_runtime_raster",
      }),
    ).toBe(rasterPlugin);
  });

  test("matches a freshly picked layer by its option value", () => {
    // Picking a plugin in the Source tab sets the type before the source name
    // is filled in, so the value is all there is to match on at that moment.
    expect(findDynamicLayerOption(dynamicMapLayers, { type: "Gauges" })).toBe(
      vectorPlugin,
    );
  });

  test("prefers the source name over the type when both are present", () => {
    // A layer being switched from one plugin to another holds the new source
    // and, for a moment, the old type.
    expect(
      findDynamicLayerOption(dynamicMapLayers, {
        source: "gauges",
        type: "Echo Runtime Raster",
      }),
    ).toBe(vectorPlugin);
  });

  test("returns null for a static layer", () => {
    expect(
      findDynamicLayerOption(dynamicMapLayers, { type: "GeoTIFF" }),
    ).toBeNull();
  });

  test("returns null for a plugin that is no longer installed", () => {
    // The layer is saved against a plugin this deployment does not have. The
    // editor has to open it rather than throw, so this answers null and the
    // panes fall back to their static behavior.
    expect(
      findDynamicLayerOption(dynamicMapLayers, { source: "uninstalled" }),
    ).toBeNull();
  });

  test.each([
    ["no plugin list at all", undefined, { source: "echo_runtime_raster" }],
    ["a plugin list that is not an array", {}, { source: "gauges" }],
    ["no source props", dynamicMapLayers, undefined],
    ["null source props", dynamicMapLayers, null],
  ])("answers null for %s", (_label, layers, sourceProps) => {
    // Both arrive from context and from editor state, either of which can be
    // empty on the first render of a modal; neither is worth throwing over.
    expect(findDynamicLayerOption(layers, sourceProps)).toBeNull();
  });
});

describe("getDynamicLayerSourceType", () => {
  test("reports what the plugin declares", () => {
    expect(
      getDynamicLayerSourceType(dynamicMapLayers, {
        source: "echo_runtime_raster",
      }),
    ).toBe("GeoTIFF");
  });

  test("lets the plugin's own declaration win over a saved one", () => {
    // The plugin list is what the backend will actually serve; the type
    // restored with a saved layer is only as current as that save.
    expect(
      getDynamicLayerSourceType(dynamicMapLayers, {
        source: "echo_runtime_raster",
        dynamic_map_layer_source: "GeoJSON",
      }),
    ).toBe("GeoTIFF");
  });

  test("falls back to the saved layer's type when the plugin declares none", () => {
    expect(
      getDynamicLayerSourceType(dynamicMapLayers, {
        source: "legacy_plugin",
        dynamic_map_layer_source: "GeoTIFF",
      }),
    ).toBe("GeoTIFF");
  });

  test("a plugin that declares nothing, on a layer that saved nothing, is GeoJSON", () => {
    expect(
      getDynamicLayerSourceType(dynamicMapLayers, { source: "legacy_plugin" }),
    ).toBe(DEFAULT_DYNAMIC_LAYER_SOURCE);
    expect(DEFAULT_DYNAMIC_LAYER_SOURCE).toBe("GeoJSON");
  });

  test("answers null when the layer is not bound to an available plugin", () => {
    // Distinct from "GeoJSON": null means static (or uninstalled), and the
    // callers branch on it to decide whether a plugin drives the layer at all.
    expect(
      getDynamicLayerSourceType(dynamicMapLayers, { type: "GeoTIFF" }),
    ).toBeNull();
    expect(
      getDynamicLayerSourceType(undefined, { source: "gauges" }),
    ).toBeNull();
    expect(getDynamicLayerSourceType(dynamicMapLayers, null)).toBeNull();
  });
});
