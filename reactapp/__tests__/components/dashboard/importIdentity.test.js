import {
  IDENTITY_RULES,
  applyBatchIdentityRules,
  applyItemIdentityRules,
} from "components/dashboard/importIdentity";
import { readViewGroupSettings } from "components/map/viewGroup";

// The global uuid mock in setupTests returns one constant, which makes "these
// two ids differ" unassertable. This suite owns every distinctness scenario, so
// it carries a counter-based mock of its own instead.
jest.mock("uuid", () => {
  let counter = 0;
  return { v4: () => `uuid-${++counter}` };
});

const pluginLayer = (props = {}) => ({
  configuration: {
    type: "VectorLayer",
    props: {
      name: "Gages",
      pluginSource: { source: "plugin_gages", args: {} },
      source: { type: "GeoJSON", props: {} },
      ...props,
    },
  },
});

const staticLayer = (props = {}) => ({
  configuration: {
    type: "WebGLTileLayer",
    props: {
      name: "Basemap",
      source: { type: "ImageTile", props: { url: "https://example.com/{z}" } },
      ...props,
    },
  },
});

const mapGridItem = (args, overrides = {}) => ({
  i: "1",
  source: "Map",
  args_string: JSON.stringify(args),
  metadata_string: "{}",
  ...overrides,
});

// The args of a grid item, whichever representation the applier returned them
// in.
const argsOf = (gridItem) =>
  typeof gridItem.args_string === "string"
    ? JSON.parse(gridItem.args_string)
    : gridItem.args_string;

const layerIdOf = (gridItem, index = 0) =>
  argsOf(gridItem).layers[index].configuration.props.layerId;

const flaggedMap = (viewGroup, overrides = {}) =>
  mapGridItem(
    {
      map_extent: {
        extent: "1,2,3",
        viewGroup,
        isGroupInitialExtent: true,
      },
    },
    overrides,
  );

const viewGroupSettingsOf = (gridItem) =>
  readViewGroupSettings(argsOf(gridItem).map_extent);

const ruleFor = (key, position) =>
  IDENTITY_RULES.find(
    (rule) => rule.key === key && rule.position === position,
  ) ?? null;

describe("IDENTITY_RULES", () => {
  it("declares one rule per key and position", () => {
    const seen = new Set();
    IDENTITY_RULES.forEach((rule) => {
      const signature = `${rule.key}@${rule.position}`;
      expect(seen.has(signature)).toBe(false);
      seen.add(signature);
    });
  });

  it("gives every rule a key, position, scope and action", () => {
    IDENTITY_RULES.forEach((rule) => {
      expect(typeof rule.key).toBe("string");
      expect(["item", "popup"]).toContain(rule.position);
      expect(["item", "batch"]).toContain(rule.scope);
      expect(["mint", "strip", "clearOnCollision"]).toContain(rule.action);
    });
  });

  it("carries the two rules that a name-keyed object could not hold", () => {
    expect(ruleFor("isGroupInitialExtent", "item")).toEqual({
      key: "isGroupInitialExtent",
      position: "item",
      scope: "batch",
      action: "clearOnCollision",
    });
    expect(ruleFor("isGroupInitialExtent", "popup").action).toBe("strip");
  });

  it("returns null for a key that has no rule at that position", () => {
    expect(ruleFor("viewGroup", "item")).toBeNull();
    expect(ruleFor("nonsense", "popup")).toBeNull();
  });

  it("partitions the rules by scope", () => {
    const itemRules = IDENTITY_RULES.filter((rule) => rule.scope === "item");
    const batchRules = IDENTITY_RULES.filter((rule) => rule.scope === "batch");
    expect(itemRules.length + batchRules.length).toBe(IDENTITY_RULES.length);
    expect(batchRules).toHaveLength(1);
    expect(itemRules.every((rule) => rule.scope === "item")).toBe(true);
  });
});

describe("applyItemIdentityRules -- top level layer identity", () => {
  it("mints an id for a plugin-backed layer that has none", () => {
    const gridItem = mapGridItem({ layers: [pluginLayer()] });

    const result = applyItemIdentityRules(gridItem);

    expect(layerIdOf(result)).toEqual(expect.stringMatching(/^uuid-\d+$/));
  });

  it("replaces an id a plugin-backed layer arrived with", () => {
    const gridItem = mapGridItem({
      layers: [pluginLayer({ layerId: "id-from-the-file" })],
    });

    const result = applyItemIdentityRules(gridItem);

    expect(layerIdOf(result)).not.toBe("id-from-the-file");
    expect(layerIdOf(result)).toEqual(expect.stringMatching(/^uuid-\d+$/));
  });

  it("gives two layers that shared one id two distinct ids", () => {
    const gridItem = mapGridItem({
      layers: [
        pluginLayer({ name: "A", layerId: "shared" }),
        pluginLayer({ name: "B", layerId: "shared" }),
      ],
    });

    const result = applyItemIdentityRules(gridItem);

    expect(layerIdOf(result, 0)).not.toBe(layerIdOf(result, 1));
  });

  it("leaves a layer with no pluginSource untouched", () => {
    const gridItem = mapGridItem({ layers: [staticLayer()] });

    const result = applyItemIdentityRules(gridItem);

    expect(result).toBe(gridItem);
    expect(result.args_string).toBe(gridItem.args_string);
  });

  it("leaves a layer carrying a layerId but no pluginSource untouched", () => {
    const gridItem = mapGridItem({
      layers: [staticLayer({ layerId: "not-mine-to-mint" })],
    });

    const result = applyItemIdentityRules(gridItem);

    expect(result).toBe(gridItem);
    expect(argsOf(result).layers[0].configuration.props.layerId).toBe(
      "not-mine-to-mint",
    );
  });

  it("leaves the numeric layerId in an ESRI legend payload alone", () => {
    // A different namespace: the legend renderer parses an integer index out of
    // an ESRI legend response and calls it layerId. It is never rewritten.
    const gridItem = mapGridItem({
      layers: [
        staticLayer({
          legend: { layers: [{ layerId: 3, legend: [] }] },
        }),
      ],
    });

    const result = applyItemIdentityRules(gridItem);

    expect(result).toBe(gridItem);
    expect(
      argsOf(result).layers[0].configuration.props.legend.layers[0],
    ).toEqual({ layerId: 3, legend: [] });
  });

  it("mints only for the plugin-backed layer in a mixed map", () => {
    const gridItem = mapGridItem({
      layers: [staticLayer(), pluginLayer()],
    });

    const result = applyItemIdentityRules(gridItem);

    expect(argsOf(result).layers[0]).toEqual(staticLayer());
    expect(layerIdOf(result, 1)).toEqual(expect.stringMatching(/^uuid-\d+$/));
  });

  it("returns a grid item with no layers array untouched", () => {
    const gridItem = mapGridItem({ map_extent: { extent: "1,2,3" } });

    expect(applyItemIdentityRules(gridItem)).toBe(gridItem);
  });
});

describe("applyItemIdentityRules -- popup subtrees", () => {
  const popupLayer = (gridItems) => ({
    ...pluginLayer(),
    popupConfig: { mode: "modal", gridItems },
  });

  const nested = (uuid, args = {}, overrides = {}) => ({
    i: "1",
    uuid,
    source: "Map",
    args_string: JSON.stringify(args),
    ...overrides,
  });

  it("re-mints a nested grid item uuid, distinctly from its siblings", () => {
    const gridItem = mapGridItem({
      layers: [
        popupLayer([
          nested("nested-uuid-a", {}, { source: "Text" }),
          nested("nested-uuid-b", {}, { source: "Text" }),
        ]),
      ],
    });

    const result = applyItemIdentityRules(gridItem);
    const [first, second] = argsOf(result).layers[0].popupConfig.gridItems;

    expect(first.uuid).not.toBe("nested-uuid-a");
    expect(second.uuid).not.toBe("nested-uuid-b");
    expect(first.uuid).not.toBe(second.uuid);
  });

  it("mints a layerId on a popup-nested map's plugin-backed layer", () => {
    const gridItem = mapGridItem({
      layers: [
        popupLayer([nested("nested-uuid", { layers: [pluginLayer()] })]),
      ],
    });

    const result = applyItemIdentityRules(gridItem);
    const nestedItem = argsOf(result).layers[0].popupConfig.gridItems[0];

    expect(layerIdOf(nestedItem)).toEqual(expect.stringMatching(/^uuid-\d+$/));
    // The outer plugin-backed layer is still re-minted, and to a different id.
    expect(layerIdOf(result)).not.toBe(layerIdOf(nestedItem));
  });

  it("strips both view group keys from a popup-nested map", () => {
    const gridItem = mapGridItem({
      layers: [
        popupLayer([
          nested("nested-uuid", {
            map_extent: {
              extent: "1,2,3",
              viewGroup: "Basin",
              isGroupInitialExtent: true,
            },
          }),
        ]),
      ],
    });

    const result = applyItemIdentityRules(gridItem);
    const nestedItem = argsOf(result).layers[0].popupConfig.gridItems[0];
    const mapExtent = JSON.parse(nestedItem.args_string).map_extent;

    expect(mapExtent).toEqual({ extent: "1,2,3" });
    expect("viewGroup" in mapExtent).toBe(false);
    expect("isGroupInitialExtent" in mapExtent).toBe(false);
  });

  it("returns a table-mode popupConfig with no gridItems key untouched", () => {
    const gridItem = mapGridItem({
      layers: [
        {
          ...staticLayer(),
          popupConfig: { mode: "table", titleTemplate: "{name}" },
        },
      ],
    });

    let result;
    expect(() => {
      result = applyItemIdentityRules(gridItem);
    }).not.toThrow();
    expect(result).toBe(gridItem);
  });
});

describe("applyItemIdentityRules -- descendPopups: false", () => {
  // The copy path opts out: popup-nested Live Chat history is keyed on the
  // nested grid item uuid, so re-minting it would orphan the messages.
  const gridItem = () =>
    mapGridItem({
      layers: [
        {
          ...pluginLayer({ layerId: "id-from-the-file" }),
          popupConfig: {
            mode: "modal",
            gridItems: [
              {
                i: "1",
                uuid: "nested-uuid",
                source: "Map",
                args_string: JSON.stringify({
                  layers: [pluginLayer()],
                  map_extent: {
                    extent: "1,2,3",
                    viewGroup: "Basin",
                    isGroupInitialExtent: true,
                  },
                }),
              },
            ],
          },
        },
      ],
    });

  it("still re-mints the top level layer id", () => {
    const result = applyItemIdentityRules(gridItem(), {
      descendPopups: false,
    });

    expect(layerIdOf(result)).not.toBe("id-from-the-file");
  });

  it("leaves the popup subtree exactly as it arrived", () => {
    const original = gridItem();

    const result = applyItemIdentityRules(original, { descendPopups: false });

    expect(argsOf(result).layers[0].popupConfig).toEqual(
      argsOf(original).layers[0].popupConfig,
    );
  });
});

describe("applyItemIdentityRules -- totality", () => {
  it("returns a grid item whose layers is not an array unchanged", () => {
    const gridItem = mapGridItem({ layers: "not-an-array" });

    let result;
    expect(() => {
      result = applyItemIdentityRules(gridItem);
    }).not.toThrow();
    expect(result).toBe(gridItem);
  });

  it("returns a grid item whose popupConfig.gridItems is not an array unchanged", () => {
    const gridItem = mapGridItem({
      layers: [
        { ...staticLayer(), popupConfig: { mode: "modal", gridItems: 7 } },
      ],
    });

    let result;
    expect(() => {
      result = applyItemIdentityRules(gridItem);
    }).not.toThrow();
    expect(result).toBe(gridItem);
  });

  it("leaves a nested grid item whose args do not parse otherwise intact", () => {
    const gridItem = mapGridItem({
      layers: [
        {
          ...staticLayer(),
          popupConfig: {
            mode: "modal",
            gridItems: [
              { i: "1", uuid: "nested-uuid", source: "Map", args_string: "{" },
            ],
          },
        },
      ],
    });

    let result;
    expect(() => {
      result = applyItemIdentityRules(gridItem);
    }).not.toThrow();
    const nestedItem = argsOf(result).layers[0].popupConfig.gridItems[0];
    // Only the uuid rule applies -- nothing else in the item is interpretable.
    expect(nestedItem.uuid).not.toBe("nested-uuid");
    expect(nestedItem.args_string).toBe("{");
  });

  it("returns a popup whose gridItems hold no objects unchanged", () => {
    const gridItem = mapGridItem({
      layers: [
        {
          ...staticLayer(),
          popupConfig: { mode: "modal", gridItems: [null, "item", 3] },
        },
      ],
    });

    let result;
    expect(() => {
      result = applyItemIdentityRules(gridItem);
    }).not.toThrow();
    expect(result).toBe(gridItem);
  });

  it("returns a grid item whose own args do not parse unchanged", () => {
    const gridItem = { i: "1", source: "Map", args_string: "{not json" };

    expect(applyItemIdentityRules(gridItem)).toBe(gridItem);
  });

  it("returns null, undefined and non-objects unchanged", () => {
    expect(applyItemIdentityRules(null)).toBeNull();
    expect(applyItemIdentityRules(undefined)).toBeUndefined();
    expect(applyItemIdentityRules("nope")).toBe("nope");
  });

  it("returns a grid item with a non-object args_string unchanged", () => {
    const gridItem = { i: "1", source: "Map", args_string: 42 };

    expect(applyItemIdentityRules(gridItem)).toBe(gridItem);
  });

  it("returns a layer that is not an object unchanged", () => {
    const gridItem = mapGridItem({ layers: [null, "layer", 3] });

    expect(applyItemIdentityRules(gridItem)).toBe(gridItem);
  });
});

describe("applyItemIdentityRules -- input contract", () => {
  it("accepts args_string as a JSON string and returns a string", () => {
    const gridItem = mapGridItem({ layers: [pluginLayer()] });

    const result = applyItemIdentityRules(gridItem);

    expect(typeof result.args_string).toBe("string");
    expect(
      JSON.parse(result.args_string).layers[0].configuration.props.layerId,
    ).toEqual(expect.stringMatching(/^uuid-\d+$/));
  });

  it("accepts args_string as a parsed object and returns an object", () => {
    const gridItem = {
      i: "1",
      source: "Map",
      args_string: { layers: [pluginLayer()] },
    };

    const result = applyItemIdentityRules(gridItem);

    expect(typeof result.args_string).toBe("object");
    expect(result.args_string.layers[0].configuration.props.layerId).toEqual(
      expect.stringMatching(/^uuid-\d+$/),
    );
    // The input object is not mutated -- the applier is pure.
    expect(
      gridItem.args_string.layers[0].configuration.props.layerId,
    ).toBeUndefined();
  });
});

describe("applyBatchIdentityRules", () => {
  it("keeps the first flagged member of a group and clears the second", () => {
    const items = [flaggedMap("Basin"), flaggedMap("Basin")];

    const result = applyBatchIdentityRules(items, []);

    expect(viewGroupSettingsOf(result[0]).isInitialExtent).toBe(true);
    expect(viewGroupSettingsOf(result[1]).isInitialExtent).toBe(false);
    // The loser stays in the group; only the flag is cleared.
    expect(viewGroupSettingsOf(result[1]).viewGroup).toBe("Basin");
  });

  it("keeps both flags when the groups differ", () => {
    const items = [flaggedMap("Basin"), flaggedMap("Coast")];

    const result = applyBatchIdentityRules(items, []);

    expect(viewGroupSettingsOf(result[0]).isInitialExtent).toBe(true);
    expect(viewGroupSettingsOf(result[1]).isInitialExtent).toBe(true);
    expect(result[0]).toBe(items[0]);
    expect(result[1]).toBe(items[1]);
  });

  it("clears a flag the target dashboard already supplies", () => {
    const items = [flaggedMap("Basin")];

    const result = applyBatchIdentityRules(items, ["Basin"]);

    expect(viewGroupSettingsOf(result[0]).isInitialExtent).toBe(false);
  });

  it("leaves a flag alone when the target has no member of that group", () => {
    const items = [flaggedMap("Basin")];

    const result = applyBatchIdentityRules(items, ["Coast"]);

    expect(viewGroupSettingsOf(result[0]).isInitialExtent).toBe(true);
  });

  it("reads the target names from a Set or a seed map's keys", () => {
    const seeds = new Map([["Basin", null]]);

    const fromSet = applyBatchIdentityRules(
      [flaggedMap("Basin")],
      new Set(["Basin"]),
    );
    const fromKeys = applyBatchIdentityRules(
      [flaggedMap("Basin")],
      seeds.keys(),
    );

    expect(viewGroupSettingsOf(fromSet[0]).isInitialExtent).toBe(false);
    expect(viewGroupSettingsOf(fromKeys[0]).isInitialExtent).toBe(false);
  });

  it("treats names differing only by whitespace as one group", () => {
    const items = [flaggedMap("Basin"), flaggedMap("  Basin  ")];

    const result = applyBatchIdentityRules(items, []);

    expect(viewGroupSettingsOf(result[0]).isInitialExtent).toBe(true);
    expect(viewGroupSettingsOf(result[1]).isInitialExtent).toBe(false);
  });

  it("treats names differing by case as two groups", () => {
    const items = [flaggedMap("Basin"), flaggedMap("basin")];

    const result = applyBatchIdentityRules(items, []);

    expect(viewGroupSettingsOf(result[0]).isInitialExtent).toBe(true);
    expect(viewGroupSettingsOf(result[1]).isInitialExtent).toBe(true);
  });

  it("preserves length and order, including untouched items", () => {
    const text = { i: "1", source: "Text", args_string: '{"text":"hi"}' };
    const plugin = mapGridItem(
      { map_extent: { extent: "1,2,3", viewGroup: "Basin" } },
      { source: "Plugin Map" },
    );
    const items = [
      text,
      flaggedMap("Basin"),
      plugin,
      flaggedMap("Basin"),
      text,
    ];

    const result = applyBatchIdentityRules(items, []);

    expect(result).toHaveLength(items.length);
    expect(result[0]).toBe(text);
    expect(result[2]).toBe(plugin);
    expect(result[4]).toBe(text);
    expect(viewGroupSettingsOf(result[1]).isInitialExtent).toBe(true);
    expect(viewGroupSettingsOf(result[3]).isInitialExtent).toBe(false);
  });

  it("passes an item with unparseable args through unchanged", () => {
    const broken = { i: "1", source: "Map", args_string: "{oops" };
    const items = [broken, flaggedMap("Basin")];

    let result;
    expect(() => {
      result = applyBatchIdentityRules(items, []);
    }).not.toThrow();
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(broken);
    expect(viewGroupSettingsOf(result[1]).isInitialExtent).toBe(true);
  });

  it("ignores a flag on a map with no group name", () => {
    const items = [
      mapGridItem({
        map_extent: { extent: "1,2,3", isGroupInitialExtent: true },
      }),
    ];

    const result = applyBatchIdentityRules(items, []);

    expect(result[0]).toBe(items[0]);
  });

  it("tolerates a missing or unusable target list", () => {
    expect(
      viewGroupSettingsOf(applyBatchIdentityRules([flaggedMap("Basin")])[0])
        .isInitialExtent,
    ).toBe(true);
    expect(
      viewGroupSettingsOf(
        applyBatchIdentityRules([flaggedMap("Basin")], "Basin")[0],
      ).isInitialExtent,
    ).toBe(true);
  });

  it("ignores empty and non-string target group names", () => {
    const items = [flaggedMap("Basin")];

    const result = applyBatchIdentityRules(items, ["", "   ", null, 7]);

    expect(viewGroupSettingsOf(result[0]).isInitialExtent).toBe(true);
  });

  it("returns a non-array input unchanged", () => {
    expect(applyBatchIdentityRules(null, [])).toBeNull();
    expect(applyBatchIdentityRules(undefined, [])).toBeUndefined();
  });
});
