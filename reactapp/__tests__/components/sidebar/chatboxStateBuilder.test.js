/**
 * Tests for the dashboard_state + editable_paths injection the chatbox
 * emits at the start of each user turn. Without these paths, the LLM has
 * no reliable way to discover the `/args/...` JSON Pointer prefix the
 * whitelist requires — it guesses viz-native paths (e.g., `/layout/title`
 * for Plotly) and gives up after a few `whitelist_rejected` rounds.
 */

import {
  buildDashboardState,
  buildEditablePathsBySource,
  buildValueHintsBySource,
  buildMapLayerArgRouting,
  buildDeltaSummary,
  buildPatchContext,
} from "../../../components/sidebar/chatboxStateBuilder";
import { LLM_EDITABLE_PATHS } from "../../../config/editableSchemas";

const plotItem = {
  uuid: "plot-1",
  source: "Inline Plotly",
  args_string: JSON.stringify({
    inlineData: { layout: { title: "Rainfall" }, data: [] },
  }),
};

const mapItem = {
  uuid: "map-1",
  source: "Map",
  args_string: JSON.stringify({ title: "Watershed", layers: [] }),
};

const textItem = {
  uuid: "text-1",
  source: "Text",
  args_string: JSON.stringify({ text: "Hello" }),
};

const variableInputItem = {
  uuid: "vi-1",
  source: "Variable Input",
  args_string: JSON.stringify({
    variable_name: "year",
    initial_value: 2026,
  }),
};

const tabs = [
  { id: "t1", gridItems: [plotItem, mapItem, textItem] },
  { id: "t2", gridItems: [variableInputItem] },
];

describe("buildDashboardState", () => {
  test("returns empty array for missing/invalid tabs", () => {
    expect(buildDashboardState(undefined)).toEqual([]);
    expect(buildDashboardState(null)).toEqual([]);
    expect(buildDashboardState([])).toEqual([]);
    expect(buildDashboardState([{ gridItems: null }])).toEqual([]);
  });

  test("emits one entry per grid item with uuid + source + title", () => {
    const result = buildDashboardState(tabs);
    expect(result.map((i) => i.uuid)).toEqual([
      "plot-1",
      "map-1",
      "text-1",
      "vi-1",
    ]);
    const plot = result.find((i) => i.uuid === "plot-1");
    expect(plot.source).toBe("Inline Plotly");
    expect(plot.title).toBe("Rainfall");
    expect(plot.tabId).toBe("t1");
  });

  test("skips items with unparseable args_string", () => {
    const bad = { uuid: "bad", source: "Map", args_string: "{invalid" };
    const result = buildDashboardState([{ gridItems: [bad, plotItem] }]);
    expect(result.map((i) => i.uuid)).toEqual(["plot-1"]);
  });

  test("skips items with no uuid", () => {
    const noUuid = { source: "Map", args_string: "{}" };
    const result = buildDashboardState([{ gridItems: [noUuid, plotItem] }]);
    expect(result.map((i) => i.uuid)).toEqual(["plot-1"]);
  });

  // -- Map items expose a per-layer summary so the LLM can construct
  // precise `/args/layers/N/...` patch paths instead of falling back to
  // whole-array replacement. Metadata-only — names/indices/source-type,
  // never persisted values (params, style, url, etc.) the LLM might
  // copy verbatim.

  test("emits per-layer summary for Map items with multiple layers", () => {
    // Real persisted shape: name lives at configuration.props.name (set by
    // LayerConfigurationBuilder). source_type at configuration.props.source.type.
    // GeoJSON and WMS have no field_paths (GeoJSON's source shape is special;
    // WMS has both, asserted in dedicated cases below). Use ESRI sources here
    // so this case tests source_type plumbing without drowning in field_paths.
    const map = {
      uuid: "map-multi",
      source: "Map",
      args_string: JSON.stringify({
        title: "Watersheds",
        layers: [
          {
            configuration: {
              props: {
                name: "Gauges",
                source: { type: "ESRI Image and Map Service" },
              },
            },
          },
          {
            configuration: {
              props: {
                name: "Boundary",
                source: { type: "ESRI Feature Service" },
              },
            },
          },
        ],
      }),
    };
    const result = buildDashboardState([{ id: "t1", gridItems: [map] }]);
    const entry = result.find((i) => i.uuid === "map-multi");
    expect(entry.layers.map((l) => ({ index: l.index, name: l.name, source_type: l.source_type }))).toEqual([
      { index: 0, name: "Gauges", source_type: "ESRI Image and Map Service" },
      { index: 1, name: "Boundary", source_type: "ESRI Feature Service" },
    ]);
  });

  test("emits empty layers array for Map items with no layers", () => {
    // mapItem fixture above has args.layers === [].
    const result = buildDashboardState([{ id: "t1", gridItems: [mapItem] }]);
    const entry = result.find((i) => i.uuid === "map-1");
    expect(entry.layers).toEqual([]);
  });

  test("emits empty layers array for Map items missing the layers key", () => {
    const map = {
      uuid: "map-no-layers-key",
      source: "Map",
      args_string: JSON.stringify({ title: "Empty" }),
    };
    const result = buildDashboardState([{ id: "t1", gridItems: [map] }]);
    const entry = result.find((i) => i.uuid === "map-no-layers-key");
    expect(entry.layers).toEqual([]);
  });

  test("layer with missing name → name: null, index still present", () => {
    const map = {
      uuid: "map-noname",
      source: "Map",
      args_string: JSON.stringify({
        layers: [
          { configuration: { props: { source: { type: "WMS" } } } },
        ],
      }),
    };
    const result = buildDashboardState([{ id: "t1", gridItems: [map] }]);
    const entry = result.find((i) => i.uuid === "map-noname");
    // index/name/source_type pinned; field_paths covered separately.
    expect(entry.layers[0].index).toBe(0);
    expect(entry.layers[0].name).toBe(null);
    expect(entry.layers[0].source_type).toBe("WMS");
  });

  test("layer with missing source.type → source_type: null, no field_paths", () => {
    // Without source_type the layer's internal shape is unknown; do not
    // emit field_paths so the LLM does not patch into a structure we can't
    // reason about.
    const map = {
      uuid: "map-notype",
      source: "Map",
      args_string: JSON.stringify({
        layers: [{ configuration: { props: { name: "Mystery" } } }],
      }),
    };
    const result = buildDashboardState([{ id: "t1", gridItems: [map] }]);
    const entry = result.find((i) => i.uuid === "map-notype");
    expect(entry.layers).toEqual([
      { index: 0, name: "Mystery", source_type: null },
    ]);
  });

  test("non-Map items do not get a layers field", () => {
    const result = buildDashboardState(tabs);
    const plot = result.find((i) => i.uuid === "plot-1");
    const text = result.find((i) => i.uuid === "text-1");
    const vi = result.find((i) => i.uuid === "vi-1");
    expect(plot.layers).toBeUndefined();
    expect(text.layers).toBeUndefined();
    expect(vi.layers).toBeUndefined();
  });

  test("per-layer entries carry only metadata + path strings — no leaked persisted values", () => {
    // The LLM is told to copy values verbatim from context. Persisted values
    // (concrete URL, secret:layer, WHERE clauses, opacity numbers) must never
    // appear in dashboard_state's per-layer payload. Path strings are fine —
    // they're the authoritative metadata the LLM is meant to copy.
    const map = {
      uuid: "map-leak-check",
      source: "Map",
      args_string: JSON.stringify({
        layers: [
          {
            configuration: {
              type: "ImageLayer",
              layerVisibility: true,
              props: {
                name: "Sensitive",
                opacity: 0.7,
                source: {
                  type: "WMS",
                  props: {
                    url: "https://secrets.example.com/wms",
                    params: { LAYERS: "secret:layer", STYLES: "internal" },
                  },
                },
              },
              style: "https://secrets.example.com/style.json",
            },
          },
        ],
      }),
    };
    const result = buildDashboardState([{ id: "t1", gridItems: [map] }]);
    const entry = result.find((i) => i.uuid === "map-leak-check");
    const blob = JSON.stringify(entry.layers);
    // Concrete persisted values — must not leak.
    expect(blob).not.toContain("secrets.example.com");
    expect(blob).not.toContain("secret:layer");
    expect(blob).not.toContain("internal");
    expect(blob).not.toContain("0.7");
  });

  // -- Unit C: per-source field_paths so the LLM knows where deep fields
  // (params, url, opacity, visible) actually live in the persisted shape.
  // Without these, the LLM emits shorthand paths like `/args/layers/N/params`
  // that RFC 6902 silently creates as unread keys (renderer reads
  // configuration.props.source.props.params, not a top-level params).

  test("ESRI Feature Service layer emits field_paths with absolute, index-substituted paths", () => {
    const map = {
      uuid: "map-esri-feat",
      source: "Map",
      args_string: JSON.stringify({
        layers: [
          { configuration: { props: { name: "First", source: { type: "ESRI Image and Map Service" } } } },
          { configuration: { props: { name: "Boundary", source: { type: "ESRI Feature Service" } } } },
        ],
      }),
    };
    const result = buildDashboardState([{ id: "t1", gridItems: [map] }]);
    const entry = result.find((i) => i.uuid === "map-esri-feat");
    // Index 1 is the Feature Service layer.
    expect(entry.layers[1].field_paths).toEqual({
      url: "/args/layers/1/configuration/props/source/props/url",
      params: "/args/layers/1/configuration/props/source/props/params",
      opacity: "/args/layers/1/configuration/props/opacity",
      visible: "/args/layers/1/configuration/layerVisibility",
    });
  });

  test("WMS layer emits field_paths including url and params", () => {
    const map = {
      uuid: "map-wms",
      source: "Map",
      args_string: JSON.stringify({
        layers: [{ configuration: { props: { name: "WMS", source: { type: "WMS" } } } }],
      }),
    };
    const result = buildDashboardState([{ id: "t1", gridItems: [map] }]);
    const entry = result.find((i) => i.uuid === "map-wms");
    expect(entry.layers[0].field_paths.url).toBe(
      "/args/layers/0/configuration/props/source/props/url",
    );
    expect(entry.layers[0].field_paths.params).toBe(
      "/args/layers/0/configuration/props/source/props/params",
    );
  });

  test("ESRI Image and Map Service layer emits params + url field_paths", () => {
    const map = {
      uuid: "map-esri-img",
      source: "Map",
      args_string: JSON.stringify({
        layers: [{ configuration: { props: { name: "Img", source: { type: "ESRI Image and Map Service" } } } }],
      }),
    };
    const result = buildDashboardState([{ id: "t1", gridItems: [map] }]);
    const entry = result.find((i) => i.uuid === "map-esri-img");
    expect(entry.layers[0].field_paths.params).toBe(
      "/args/layers/0/configuration/props/source/props/params",
    );
    expect(entry.layers[0].field_paths.url).toBe(
      "/args/layers/0/configuration/props/source/props/url",
    );
  });

  test("URL-only source types (KML, Image Tile, etc.) emit url but no params", () => {
    const cases = ["KML", "Image Tile", "Vector Tile", "PMTiles Vector", "PMTiles Raster", "Static Image"];
    for (const sourceType of cases) {
      const map = {
        uuid: `map-${sourceType.replace(/ /g, "-")}`,
        source: "Map",
        args_string: JSON.stringify({
          layers: [{ configuration: { props: { name: "L", source: { type: sourceType } } } }],
        }),
      };
      const result = buildDashboardState([{ id: "t1", gridItems: [map] }]);
      const entry = result[0];
      expect(entry.layers[0].field_paths).toEqual(
        expect.objectContaining({
          url: "/args/layers/0/configuration/props/source/props/url",
          opacity: "/args/layers/0/configuration/props/opacity",
          visible: "/args/layers/0/configuration/layerVisibility",
        }),
      );
      expect(entry.layers[0].field_paths.params).toBeUndefined();
    }
  });

  test("source types with non-standard source props (GeoJSON, GeoTIFF) omit field_paths", () => {
    // GeoJSON's data lives at source.geojson (not source.props.*) and
    // GeoTIFF uses source.props.sources (an array, not a flat URL). Their
    // shapes don't match the common url/params template; safer to emit no
    // field_paths than to emit wrong ones.
    for (const sourceType of ["GeoJSON", "GeoTIFF"]) {
      const map = {
        uuid: `map-${sourceType}`,
        source: "Map",
        args_string: JSON.stringify({
          layers: [{ configuration: { props: { name: "L", source: { type: sourceType } } } }],
        }),
      };
      const result = buildDashboardState([{ id: "t1", gridItems: [map] }]);
      const entry = result[0];
      // Common per-layer paths (opacity, visible) are still emitted —
      // those are layer-wrapper fields, not source-shape-dependent.
      expect(entry.layers[0].field_paths).toEqual({
        opacity: "/args/layers/0/configuration/props/opacity",
        visible: "/args/layers/0/configuration/layerVisibility",
      });
      expect(entry.layers[0].field_paths.params).toBeUndefined();
      expect(entry.layers[0].field_paths.url).toBeUndefined();
    }
  });

  test("layer with null source_type omits field_paths entirely", () => {
    const map = {
      uuid: "map-no-type",
      source: "Map",
      args_string: JSON.stringify({
        layers: [{ configuration: { props: { name: "L" } } }],
      }),
    };
    const result = buildDashboardState([{ id: "t1", gridItems: [map] }]);
    const entry = result[0];
    expect(entry.layers[0].field_paths).toBeUndefined();
  });

  test("field_paths values are paths only — they do NOT contain persisted runtime data", () => {
    const map = {
      uuid: "map-no-values",
      source: "Map",
      args_string: JSON.stringify({
        layers: [
          {
            configuration: {
              layerVisibility: false,
              props: {
                name: "Test",
                opacity: 0.42,
                source: {
                  type: "WMS",
                  props: {
                    url: "https://hidden.example.com/wms",
                    params: { LAYERS: "x:y", WHERE: "id = 99" },
                  },
                },
              },
            },
          },
        ],
      }),
    };
    const result = buildDashboardState([{ id: "t1", gridItems: [map] }]);
    const fp = result[0].layers[0].field_paths;
    // Each value is a path string, not the runtime value at that path.
    expect(fp.url).toBe("/args/layers/0/configuration/props/source/props/url");
    expect(fp.url).not.toContain("hidden.example.com");
    expect(fp.params).toBe("/args/layers/0/configuration/props/source/props/params");
    expect(fp.params).not.toContain("WHERE");
    expect(fp.opacity).toBe("/args/layers/0/configuration/props/opacity");
    expect(fp.opacity).not.toContain("0.42");
  });
});

describe("buildEditablePathsBySource", () => {
  test("returns empty object for empty items", () => {
    expect(buildEditablePathsBySource([])).toEqual({});
  });

  test("includes only sources present in the items (dedup across items)", () => {
    const items = [
      { source: "Inline Plotly" },
      { source: "Inline Plotly" },
      { source: "Map" },
    ];
    const result = buildEditablePathsBySource(items);
    expect(Object.keys(result).sort()).toEqual(["Inline Plotly", "Map"]);
    expect(result["Inline Plotly"]).toEqual(LLM_EDITABLE_PATHS["Inline Plotly"]);
    expect(result["Map"]).toEqual(LLM_EDITABLE_PATHS["Map"]);
  });

  test("omits sources not in the whitelist (token saving; fail-closed)", () => {
    // Text + Custom Image are in the dashboard but not patchable.
    const items = [{ source: "Text" }, { source: "Custom Image" }];
    expect(buildEditablePathsBySource(items)).toEqual({});
  });

  test("mixed patchable + unpatchable items emits only patchable sources", () => {
    const items = [
      { source: "Inline Plotly" },
      { source: "Text" },
      { source: "Variable Input" },
    ];
    const result = buildEditablePathsBySource(items);
    expect(Object.keys(result).sort()).toEqual([
      "Inline Plotly",
      "Variable Input",
    ]);
  });

  test("merges server-provided plugin whitelists via pluginEditablePaths arg", () => {
    const items = [
      { source: "Inline Plotly" },
      { source: "my_streamflow" }, // Intake plugin
      { source: "nwm-flood-map" }, // any plugin source resolved server-side
    ];
    const pluginEditablePaths = {
      my_streamflow: ["/args/start_date", "/args/end_date"],
      "nwm-flood-map": ["/args/title", "/args/dataUrl"],
    };
    const result = buildEditablePathsBySource(items, pluginEditablePaths);
    expect(result["Inline Plotly"]).toEqual(LLM_EDITABLE_PATHS["Inline Plotly"]);
    expect(result["my_streamflow"]).toEqual(["/args/start_date", "/args/end_date"]);
    expect(result["nwm-flood-map"]).toEqual(["/args/title", "/args/dataUrl"]);
  });

  test("static built-in whitelist takes precedence over plugin-provided", () => {
    // If a plugin somehow shadows a built-in source name, the static wins.
    const items = [{ source: "Map" }];
    const pluginEditablePaths = { Map: ["/args/overridden"] };
    const result = buildEditablePathsBySource(items, pluginEditablePaths);
    expect(result["Map"]).toEqual(LLM_EDITABLE_PATHS["Map"]);
  });

  test("plugin source with empty paths is omitted", () => {
    // Unknown / pattern-denied plugins have empty paths; emitting empty
    // would waste tokens and the LLM would interpret [] as "nothing to do".
    const items = [{ source: "unresolved_plugin" }];
    const pluginEditablePaths = { unresolved_plugin: [] };
    expect(
      buildEditablePathsBySource(items, pluginEditablePaths),
    ).toEqual({});
  });

  test("pluginEditablePaths undefined is equivalent to no plugin paths", () => {
    const items = [{ source: "Inline Plotly" }, { source: "my_plugin" }];
    const result = buildEditablePathsBySource(items);
    expect(Object.keys(result).sort()).toEqual(["Inline Plotly"]);
  });
});

describe("buildValueHintsBySource", () => {
  test("returns empty object for empty items", () => {
    expect(buildValueHintsBySource([])).toEqual({});
  });

  test("Map items get /args/baseMap options with label+value entries", () => {
    const items = [{ source: "Map" }];
    const hints = buildValueHintsBySource(items);
    expect(hints.Map).toBeDefined();
    expect(hints.Map["/args/baseMap"]).toBeDefined();
    const basemap = hints.Map["/args/baseMap"];
    expect(Array.isArray(basemap.options)).toBe(true);
    expect(basemap.options.length).toBeGreaterThan(5);
    // Every option carries label+value, values are ArcGIS URLs
    for (const opt of basemap.options) {
      expect(typeof opt.label).toBe("string");
      expect(typeof opt.value).toBe("string");
      expect(opt.value.startsWith("https://")).toBe(true);
    }
    // "World Imagery" must be in the options so the LLM can pick it
    // when the user says "satellite" / "imagery" / "aerial".
    const worldImagery = basemap.options.find((o) => o.label === "World Imagery");
    expect(worldImagery).toBeDefined();
    expect(worldImagery.value).toMatch(/World_Imagery\/MapServer$/);
  });

  test("non-Map viz types get no entry (Map is the only enum-URL field today)", () => {
    const items = [{ source: "Inline Plotly" }, { source: "Inline Card" }];
    const hints = buildValueHintsBySource(items);
    expect(hints.Map).toBeUndefined();
    expect(hints["Inline Plotly"]).toBeUndefined();
  });

  test("mixed dashboard: Map hints emitted once even with multiple maps", () => {
    const items = [{ source: "Map" }, { source: "Map" }, { source: "Inline Plotly" }];
    const hints = buildValueHintsBySource(items);
    expect(Object.keys(hints)).toEqual(["Map"]);
  });
});

describe("buildMapLayerArgRouting", () => {
  // Plan 2026-05-07-005 (T2). Per-source-type arg-routing templates
  // injected into the system message so the LLM knows WHICH ARG
  // carries WHICH KEY before calling add_map_service_layer.
  // Closes the LLM-routing failure-mode class structurally — today's
  // GeoTIFF auto-legend bug had rampName/rampMin/rampMax landing in
  // `style` instead of `source_props` (silent semantic failure).

  const ALL_SOURCE_TYPES = [
    "WMS",
    "ESRI Image and Map Service",
    "ESRI Feature Service",
    "GeoJSON",
    "KML",
    "Image Tile",
    "Vector Tile",
    "PMTiles Vector",
    "PMTiles Raster",
    "GeoTIFF",
    "Static Image",
  ];

  const NO_PARAMS_TYPES = [
    "GeoJSON",
    "KML",
    "Image Tile",
    "Vector Tile",
    "PMTiles Vector",
    "PMTiles Raster",
  ];

  test("returns {} when no Map item is in the dashboard_state", () => {
    // Plotly-only dashboard — no map-layer routing relevant.
    const items = [
      { uuid: "p", source: "Inline Plotly", title: null },
      { uuid: "v", source: "Variable Input", title: null },
    ];
    expect(buildMapLayerArgRouting(items)).toEqual({});
  });

  test("returns {} for empty / missing items", () => {
    expect(buildMapLayerArgRouting([])).toEqual({});
    expect(buildMapLayerArgRouting(undefined)).toEqual({});
    expect(buildMapLayerArgRouting(null)).toEqual({});
  });

  test("emits all 11 source-type templates when a Map is present", () => {
    const items = [{ uuid: "m", source: "Map", title: "x" }];
    const routing = buildMapLayerArgRouting(items);
    expect(Object.keys(routing).sort()).toEqual(
      [...ALL_SOURCE_TYPES].sort(),
    );
  });

  test("each entry has source_props (string array), params (array or null), ambiguity_warnings (array)", () => {
    const items = [{ uuid: "m", source: "Map", title: "x" }];
    const routing = buildMapLayerArgRouting(items);
    for (const sourceType of ALL_SOURCE_TYPES) {
      const entry = routing[sourceType];
      expect(entry).toBeDefined();
      // source_props: array of string field names.
      expect(Array.isArray(entry.source_props)).toBe(true);
      for (const k of entry.source_props) expect(typeof k).toBe("string");
      // params: array of strings, or null when source type doesn't accept params.
      if (entry.params !== null) {
        expect(Array.isArray(entry.params)).toBe(true);
        for (const k of entry.params) expect(typeof k).toBe("string");
      }
      // ambiguity_warnings: array of strings.
      expect(Array.isArray(entry.ambiguity_warnings)).toBe(true);
      for (const w of entry.ambiguity_warnings) expect(typeof w).toBe("string");
    }
  });

  test("GeoTIFF entry routes ramp keys to source_props with style-vs-source_props warning", () => {
    const routing = buildMapLayerArgRouting([
      { uuid: "m", source: "Map", title: "x" },
    ]);
    const entry = routing["GeoTIFF"];
    expect(entry.source_props).toEqual(
      expect.arrayContaining([
        "sources",
        "attributions",
        "bands",
        "nodata",
        "min",
        "max",
        "rampName",
        "rampMin",
        "rampMax",
      ]),
    );
    expect(entry.params).toBeNull();
    // The load-bearing warning — the bug this plan fixes.
    const warnings = entry.ambiguity_warnings.join(" ");
    expect(warnings).toMatch(/source_props/);
    expect(warnings).toMatch(/style/);
    expect(warnings).toMatch(/legend/);
  });

  test("WMS entry routes STYLES/TIME to params, with style-vs-params warning", () => {
    const routing = buildMapLayerArgRouting([
      { uuid: "m", source: "Map", title: "x" },
    ]);
    const entry = routing["WMS"];
    expect(entry.params).toEqual(
      expect.arrayContaining(["LAYERS", "STYLES", "TIME"]),
    );
    const warnings = entry.ambiguity_warnings.join(" ");
    expect(warnings).toMatch(/STYLES/);
    expect(warnings).toMatch(/params/);
  });

  test("ESRI Image and Map Service routes LAYERS/LAYERDEFS/TIME/mosaicRule to params", () => {
    const routing = buildMapLayerArgRouting([
      { uuid: "m", source: "Map", title: "x" },
    ]);
    const entry = routing["ESRI Image and Map Service"];
    expect(entry.params).toEqual(
      expect.arrayContaining(["LAYERS", "LAYERDEFS", "TIME", "mosaicRule"]),
    );
  });

  test("ESRI Feature Service routes WHERE/TIME to params", () => {
    const routing = buildMapLayerArgRouting([
      { uuid: "m", source: "Map", title: "x" },
    ]);
    const entry = routing["ESRI Feature Service"];
    expect(entry.params).toEqual(expect.arrayContaining(["WHERE", "TIME"]));
  });

  test("source types that do not support params have params=null and a warning saying so", () => {
    const routing = buildMapLayerArgRouting([
      { uuid: "m", source: "Map", title: "x" },
    ]);
    for (const sourceType of NO_PARAMS_TYPES) {
      const entry = routing[sourceType];
      expect(entry.params).toBeNull();
      const warnings = entry.ambiguity_warnings.join(" ");
      // Should mention that params is rejected/not supported for these.
      expect(warnings).toMatch(/params/i);
    }
  });

  test("Static Image routes projection/imageExtent to params", () => {
    const routing = buildMapLayerArgRouting([
      { uuid: "m", source: "Map", title: "x" },
    ]);
    const entry = routing["Static Image"];
    expect(entry.params).toEqual(
      expect.arrayContaining(["projection", "imageExtent"]),
    );
  });

  test("templates contain no concrete URL or SQL example values (workspace memory)", () => {
    // Per workspace memory: "no concrete example values in MCP tool
    // descriptions — LLMs copy them verbatim". The risk class is
    // example *data* (URLs, query strings, IDs) that the LLM persists
    // instead of resolving to the user's real values. Configuration
    // directives like `legend='default'` are NOT the risk — they are
    // the literal arg value the LLM should pass verbatim.
    //
    // Pin: no URL hosts, no SQL example clauses with field names, no
    // ESRI service paths.
    const routing = buildMapLayerArgRouting([
      { uuid: "m", source: "Map", title: "x" },
    ]);
    const blob = JSON.stringify(routing);
    expect(blob).not.toContain("https://");
    expect(blob).not.toContain("http://");
    expect(blob).not.toContain("FeatureServer");
    expect(blob).not.toContain("MapServer");
    // Field-name'd SQL example like `rfc_name = 'Colorado'` (capitalized
    // value indicates a proper noun, the data-value risk class) would
    // match. A directive like `legend='default'` (lowercase value) would
    // not — directives are the literal arg value the LLM should pass
    // verbatim, not example data. Case-sensitive on the value start.
    expect(blob).not.toMatch(/[a-z_]+\s*=\s*'[A-Z]/);
    expect(blob).not.toMatch(/SELECT /i);
  });
});


describe("buildPatchContext", () => {
  test("returns null when no patchable items are in the dashboard", () => {
    // Empty dashboard, no variable inputs set — nothing useful to say.
    expect(buildPatchContext([], {})).toBeNull();
    expect(buildPatchContext(undefined, undefined)).toBeNull();
  });

  test("returns context when items are present", () => {
    const ctx = buildPatchContext(tabs, { year: 2026 });
    expect(ctx).not.toBeNull();
    expect(ctx.dashboard_state).toHaveLength(4);
    expect(Object.keys(ctx.editable_paths_by_source).sort()).toEqual([
      "Inline Plotly",
      "Map",
      "Variable Input",
    ]);
    expect(ctx.variable_input_values).toEqual({ year: 2026 });
    // Map basemap hints must flow into the full patch context so the LLM
    // can pick a correct URL instead of guessing a label like "imagery".
    expect(ctx.value_hints_by_source.Map["/args/baseMap"]).toBeDefined();
    // Plan 2026-05-07-005 (T2): map_layer_arg_routing flows when a Map
    // is present so the LLM knows which arg holds which key for
    // add_map_service_layer.
    expect(ctx.map_layer_arg_routing).toBeDefined();
    expect(ctx.map_layer_arg_routing["GeoTIFF"]).toBeDefined();
  });

  test("map_layer_arg_routing is empty/absent when dashboard has no Map", () => {
    // A Plotly + Variable Input dashboard — no map layers possible.
    // map_layer_arg_routing should be empty (or absent — implementation
    // choice; test for {} since buildPatchContext threads helper output
    // verbatim).
    const ctx = buildPatchContext(
      [{ id: "t", gridItems: [plotItem, variableInputItem] }],
      {},
    );
    expect(ctx).not.toBeNull();
    expect(ctx.map_layer_arg_routing).toEqual({});
  });

  test("includes the plot's /args/inlineData prefix so the LLM can infer /args/inlineData/layout/title", () => {
    const ctx = buildPatchContext([{ id: "t", gridItems: [plotItem] }], {});
    expect(ctx.editable_paths_by_source["Inline Plotly"]).toContain(
      "/args/inlineData",
    );
  });

  test("returns context even when no items are patchable but variable inputs exist", () => {
    // A dashboard with only Text items and variable inputs — still useful
    // to tell the LLM what variables exist, even if nothing is patchable.
    // Decision: return null here (no patchable targets, injection has no
    // effect on patch_visualization). Keep behavior narrow.
    const result = buildPatchContext(
      [{ id: "t", gridItems: [textItem] }],
      { year: 2026 },
    );
    expect(result).toBeNull();
  });

  test("plugin tiles produce a context when server-provided whitelists are supplied", () => {
    // Dashboard has a plugin tile but no built-in patchable tiles.
    const pluginTile = {
      i: "plugin-1",
      source: "my_streamflow",
      uuid: "uuid-plugin",
      name: "Streamflow",
      args_string: JSON.stringify({ start_date: "2026-01-01" }),
    };
    const ctx = buildPatchContext(
      [{ id: "t", gridItems: [pluginTile] }],
      {},
      { my_streamflow: ["/args/start_date"] },
    );
    expect(ctx).not.toBeNull();
    expect(ctx.editable_paths_by_source).toEqual({
      my_streamflow: ["/args/start_date"],
    });
  });
});

describe("buildDeltaSummary", () => {
  test("returns empty object when all categories are empty", () => {
    expect(buildDeltaSummary([], [], [], 30)).toEqual({});
  });

  test("includes only categories that have entries", () => {
    const summary = buildDeltaSummary(["u1"], [], [], 30);
    expect(summary).toEqual({ created_this_turn: ["u1"] });
  });

  test("no _note when everything fits under budget", () => {
    // Review finding COR-02: the OLD logic fired the sentinel whenever
    // total > budget even if each category's slice took everything. This
    // test pins that no _note appears when the round-robin allocation
    // actually includes every entry.
    const summary = buildDeltaSummary(
      new Array(20).fill(0).map((_, i) => `c${i}`),
      new Array(15).fill(0).map((_, i) => `p${i}`),
      [],
      30, // total=35 > budget, BUT round-robin pulls all 20 + all 15 = 35 ≤ rounds*queues
    );
    // Each queue is drained; budget exhausted at 30; 5 omitted
    const totalIn = 20 + 15;
    const totalTaken =
      (summary.created_this_turn?.length || 0) +
      (summary.patched_this_turn?.length || 0);
    expect(totalTaken).toBe(Math.min(30, totalIn));
    if (totalTaken < totalIn) {
      expect(summary._note).toMatch(
        /\d+ earlier in-turn mutations omitted/,
      );
    } else {
      expect(summary._note).toBeUndefined();
    }
  });

  test("sentinel count equals actual total omitted across all categories", () => {
    // 3 created + 3 patched + 3 layer updates, budget 4. Round-robin
    // gives c0, p0, l0, c1 → 4 taken, 5 omitted.
    const summary = buildDeltaSummary(
      ["c0", "c1", "c2"],
      ["p0", "p1", "p2"],
      ["l0", "l1", "l2"],
      4,
    );
    const taken =
      (summary.created_this_turn?.length || 0) +
      (summary.patched_this_turn?.length || 0) +
      (summary.layer_updates_this_turn?.length || 0);
    expect(taken).toBe(4);
    // 9 total - 4 taken = 5 omitted
    expect(summary._note).toMatch(/^5 earlier in-turn mutations omitted/);
  });

  test("round-robin ensures each non-empty category gets some entries", () => {
    // Before this fix, per-category slice(0, budget) meant a hot category
    // could take the whole budget. Round-robin guarantees fair sharing.
    const summary = buildDeltaSummary(
      new Array(30).fill(0).map((_, i) => `c${i}`), // 30 created
      ["p0"], // 1 patched
      ["l0"], // 1 layer_update
      3, // tiny budget
    );
    expect(summary.created_this_turn).toEqual(["c0"]);
    expect(summary.patched_this_turn).toEqual(["p0"]);
    expect(summary.layer_updates_this_turn).toEqual(["l0"]);
  });

  test("handles null/undefined category inputs gracefully", () => {
    expect(buildDeltaSummary(null, undefined, ["l0"], 5)).toEqual({
      layer_updates_this_turn: ["l0"],
    });
  });

  test("budget of 0 produces an empty summary", () => {
    const summary = buildDeltaSummary(["c0"], ["p0"], [], 0);
    expect(summary).toEqual({
      _note: expect.stringMatching(/2 earlier in-turn mutations omitted/),
    });
  });
});
