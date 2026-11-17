import {
  ANNOTATION_GROUP_KEY,
  ANNOTATIONS_METADATA_KEY,
  buildAnnotationGroupLayers,
  migrateGridItemAnnotationLayers,
  migrateMapAnnotationLayers,
  migrateTabsAnnotationLayers,
  normalizeAnnotationGroups,
  uniqueGroupName,
} from "components/map/annotationGroups";

const lineItem = {
  id: "a1",
  kind: "line",
  coordinates: [
    [-105, 40],
    [-104, 40],
  ],
};

const annotationLayer = ({
  name = "Callouts",
  props = {},
  annotations = { defaults: { lineColor: "#ff0000" }, items: [lineItem] },
  layerVisibility,
} = {}) => ({
  configuration: {
    type: "VectorLayer",
    props: {
      name,
      zIndex: 3,
      ...props,
      source: { type: "Annotations", props: {} },
    },
    annotations,
    ...(layerVisibility === undefined ? {} : { layerVisibility }),
  },
  tablePopupType: "none",
});

const geojsonLayer = (name = "Stations") => ({
  configuration: {
    type: "VectorLayer",
    props: { name, source: { type: "GeoJSON", props: {}, geojson: "a.json" } },
  },
});

describe("uniqueGroupName", () => {
  it("keeps a free name and suffixes a taken one", () => {
    expect(uniqueGroupName("Notes", new Set())).toBe("Notes");
    expect(uniqueGroupName("Notes", new Set(["Notes"]))).toBe("Notes (2)");
    expect(uniqueGroupName("Notes", new Set(["Notes", "Notes (2)"]))).toBe(
      "Notes (3)",
    );
  });
});

describe("normalizeAnnotationGroups", () => {
  it("returns no groups for a missing or malformed setting", () => {
    expect(normalizeAnnotationGroups(undefined)).toEqual([]);
    expect(normalizeAnnotationGroups({ name: "x" })).toEqual([]);
  });

  it("drops unnamed entries, trims names and fills defaults and items", () => {
    expect(
      normalizeAnnotationGroups([
        null,
        "Notes",
        { name: "   " },
        { items: [lineItem] },
        { name: "  Notes ", future: 1 },
      ]),
    ).toEqual([{ name: "Notes", defaults: {}, items: [], future: 1 }]);
  });
});

describe("buildAnnotationGroupLayers", () => {
  it("builds one Annotations decoration entry per group, in order", () => {
    const entries = buildAnnotationGroupLayers([
      {
        name: "Flood notes",
        defaults: { lineColor: "#00f" },
        items: [lineItem],
      },
      { name: "Site visits", items: [] },
    ]);

    expect(entries).toHaveLength(2);
    const [first, second] = entries;
    expect(first.tablePopupType).toBe("none");
    expect(first.configuration.props.source.type).toBe("Annotations");
    expect(first.configuration.props.title).toBe("Flood notes");
    expect(first.configuration.props[ANNOTATION_GROUP_KEY]).toBe("Flood notes");
    expect(first.configuration.annotations).toEqual({
      defaults: { lineColor: "#00f" },
      items: [lineItem],
    });
    expect(second.configuration.props.title).toBe("Site visits");
  });

  it("names each layer apart from the map's own layer names", () => {
    const [entry] = buildAnnotationGroupLayers([{ name: "Stations" }]);
    expect(entry.configuration.props.name).not.toBe("Stations");
    expect(entry.configuration.props.title).toBe("Stations");
  });

  it("keeps duplicate group names apart in the internal name", () => {
    const entries = buildAnnotationGroupLayers([
      { name: "Notes" },
      { name: "Notes" },
    ]);
    const names = entries.map((entry) => entry.configuration.props.name);
    expect(new Set(names).size).toBe(2);
    expect(entries.map((entry) => entry.configuration.props.title)).toEqual([
      "Notes",
      "Notes",
    ]);
  });

  it("applies a migrated group's visibility and layer props", () => {
    const [entry] = buildAnnotationGroupLayers([
      { name: "Notes", layerVisibility: false, layerProps: { opacity: 0.5 } },
    ]);
    expect(entry.configuration.layerVisibility).toBe(false);
    expect(entry.configuration.props.opacity).toBe(0.5);
  });

  it("builds nothing for no groups", () => {
    expect(buildAnnotationGroupLayers(undefined)).toEqual([]);
  });
});

describe("migrateMapAnnotationLayers", () => {
  it("leaves a map with no Annotations layers untouched", () => {
    const args = { layers: [geojsonLayer()] };
    const metadata = { refreshRate: 0 };
    const result = migrateMapAnnotationLayers(args, metadata);
    expect(result.migrated).toBe(false);
    expect(result.args).toBe(args);
    expect(result.metadata).toBe(metadata);
  });

  it("moves each Annotations layer into a group and keeps the other layers", () => {
    const { args, metadata, migrated } = migrateMapAnnotationLayers(
      {
        baseMap: "OpenStreetMap",
        layers: [annotationLayer(), geojsonLayer()],
      },
      { refreshRate: 0 },
    );

    expect(migrated).toBe(true);
    expect(args).toEqual({
      baseMap: "OpenStreetMap",
      layers: [geojsonLayer()],
    });
    expect(metadata).toEqual({
      refreshRate: 0,
      [ANNOTATIONS_METADATA_KEY]: [
        {
          name: "Callouts",
          defaults: { lineColor: "#ff0000" },
          items: [lineItem],
        },
      ],
    });
  });

  it("carries visibility and layer props, but not identity or stacking", () => {
    const { metadata } = migrateMapAnnotationLayers(
      {
        layers: [
          annotationLayer({
            props: { opacity: 0.4, minZoom: 3 },
            layerVisibility: false,
          }),
        ],
      },
      {},
    );
    expect(metadata.annotations[0]).toEqual({
      name: "Callouts",
      defaults: { lineColor: "#ff0000" },
      items: [lineItem],
      layerProps: { opacity: 0.4, minZoom: 3 },
      layerVisibility: false,
    });
  });

  it("suffixes names already taken, by existing groups or each other", () => {
    const { metadata } = migrateMapAnnotationLayers(
      {
        layers: [
          annotationLayer({ name: "Notes" }),
          annotationLayer({ name: "Notes" }),
        ],
      },
      { annotations: [{ name: "Notes", items: [] }] },
    );
    expect(metadata.annotations.map((group) => group.name)).toEqual([
      "Notes",
      "Notes (2)",
      "Notes (3)",
    ]);
  });

  it("names unnamed layers with the first free numbers", () => {
    const { metadata } = migrateMapAnnotationLayers(
      {
        layers: [
          annotationLayer({ name: "" }),
          annotationLayer({ name: "" }),
          annotationLayer({ name: "" }),
        ],
      },
      { annotations: [{ name: "Annotations 2", items: [] }] },
    );
    expect(metadata.annotations.map((group) => group.name)).toEqual([
      "Annotations 2",
      "Annotations 1",
      "Annotations 3",
      "Annotations 4",
    ]);
  });

  it("keeps keys of the old annotations config beyond defaults and items", () => {
    const { metadata } = migrateMapAnnotationLayers(
      {
        layers: [
          annotationLayer({
            annotations: { defaults: {}, items: [], future: { a: 1 } },
          }),
        ],
      },
      {},
    );
    expect(metadata.annotations[0]).toEqual({
      name: "Callouts",
      defaults: {},
      items: [],
      future: { a: 1 },
    });
  });

  it("gives a layer with a missing annotations config an empty group", () => {
    const { metadata } = migrateMapAnnotationLayers(
      { layers: [annotationLayer({ annotations: null })] },
      {},
    );
    expect(metadata.annotations[0]).toEqual({
      name: "Callouts",
      defaults: {},
      items: [],
    });
  });
});

describe("migrateGridItemAnnotationLayers", () => {
  const mapItem = (fields = {}) => ({
    i: "1",
    source: "Map",
    args_string: JSON.stringify({
      layers: [annotationLayer(), geojsonLayer()],
    }),
    metadata_string: JSON.stringify({ refreshRate: 0 }),
    ...fields,
  });

  it("rewrites a loaded built-in map's string fields as strings", () => {
    const migrated = migrateGridItemAnnotationLayers(mapItem());
    expect(typeof migrated.args_string).toBe("string");
    expect(JSON.parse(migrated.args_string).layers).toEqual([geojsonLayer()]);
    expect(JSON.parse(migrated.metadata_string).annotations).toHaveLength(1);
    expect(migrated.i).toBe("1");
  });

  it("rewrites an import's object fields as objects", () => {
    const migrated = migrateGridItemAnnotationLayers(
      mapItem({
        args_string: { layers: [annotationLayer()] },
        metadata_string: { refreshRate: 0 },
      }),
    );
    expect(migrated.args_string).toEqual({ layers: [] });
    expect(migrated.metadata_string.annotations[0].name).toBe("Callouts");
  });

  it("treats empty or missing settings as no settings", () => {
    const migrated = migrateGridItemAnnotationLayers(
      mapItem({ metadata_string: "" }),
    );
    expect(JSON.parse(migrated.metadata_string)).toEqual({
      annotations: [expect.objectContaining({ name: "Callouts" })],
    });
    const withoutSettings = mapItem();
    delete withoutSettings.metadata_string;
    expect(
      JSON.parse(
        migrateGridItemAnnotationLayers(withoutSettings).metadata_string,
      ).annotations,
    ).toHaveLength(1);
  });

  it("writes missing settings the way the args are written", () => {
    // Mid-import: args already an object, and a settings value of "null"
    // already parsed to null. The importer stringifies both once afterwards,
    // so the settings must come back an object, not a string.
    const migrated = migrateGridItemAnnotationLayers(
      mapItem({
        args_string: { layers: [annotationLayer()] },
        metadata_string: null,
      }),
    );
    expect(migrated.metadata_string).toEqual({
      annotations: [expect.objectContaining({ name: "Callouts" })],
    });
  });

  it("returns the same item when there is nothing to do", () => {
    const pluginMap = mapItem({ source: "some_plugin_map" });
    expect(migrateGridItemAnnotationLayers(pluginMap)).toBe(pluginMap);
    const plain = mapItem({ args_string: JSON.stringify({ layers: [] }) });
    expect(migrateGridItemAnnotationLayers(plain)).toBe(plain);
    expect(migrateGridItemAnnotationLayers(null)).toBe(null);
  });

  it("leaves an item it cannot parse alone", () => {
    const badArgs = mapItem({ args_string: "{not json" });
    expect(migrateGridItemAnnotationLayers(badArgs)).toBe(badArgs);
    const badSettings = mapItem({ metadata_string: "[1, 2]" });
    expect(migrateGridItemAnnotationLayers(badSettings)).toBe(badSettings);
    const numericSettings = mapItem({ metadata_string: 7 });
    expect(migrateGridItemAnnotationLayers(numericSettings)).toBe(
      numericSettings,
    );
  });
});

describe("migrateTabsAnnotationLayers", () => {
  it("rewrites only the tabs and items that held Annotations layers", () => {
    const untouchedItem = {
      i: "2",
      source: "Map",
      args_string: JSON.stringify({ layers: [geojsonLayer()] }),
      metadata_string: "{}",
    };
    const quietTab = { id: 1, gridItems: [untouchedItem] };
    const busyTab = {
      id: 2,
      gridItems: [
        untouchedItem,
        {
          i: "3",
          source: "Map",
          args_string: JSON.stringify({ layers: [annotationLayer()] }),
          metadata_string: "{}",
        },
      ],
    };
    const noItemsTab = { id: 3 };

    const [quiet, busy, noItems] = migrateTabsAnnotationLayers([
      quietTab,
      busyTab,
      noItemsTab,
    ]);

    expect(quiet).toBe(quietTab);
    expect(noItems).toBe(noItemsTab);
    expect(busy).not.toBe(busyTab);
    expect(busy.gridItems[0]).toBe(untouchedItem);
    expect(JSON.parse(busy.gridItems[1].metadata_string).annotations).toEqual([
      expect.objectContaining({ name: "Callouts" }),
    ]);
  });

  it("passes a non-list through", () => {
    expect(migrateTabsAnnotationLayers(undefined)).toBe(undefined);
  });
});
