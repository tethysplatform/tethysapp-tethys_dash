import {
  buildAddItems,
  buildPatchItems,
  buildSlashItems,
  caretForInsert,
  filterSlashItems,
} from "components/chatbot/slashTemplates";

describe("buildAddItems", () => {
  it("prefills the plugin name and arg keys with empty values", () => {
    const [item] = buildAddItems([
      { source: "nwmp_reaches_series", label: "NWMP Reaches Time Series", args: ["reach_id"] },
    ]);
    expect(item.insert).toBe("Add NWMP Reaches Time Series with reach_id = ");
    expect(item.subtitle).toBe("reach_id");
    expect(item.group).toBe("Add a plugin");
  });

  it("joins multiple args and omits the clause when there are none", () => {
    const items = buildAddItems([
      { source: "a", label: "A", args: ["x", "y"] },
      { source: "b", label: "B", args: [] },
    ]);
    expect(items[0].insert).toBe("Add A with x = , y = ");
    expect(items[1].insert).toBe("Add B");
    expect(items[1].subtitle).toBe("no arguments");
  });
});

describe("buildPatchItems", () => {
  it("pins the tile with a current value and blanks only the new value", () => {
    const [item] = buildPatchItems([
      { source: "geoglows_forecast_viewer", args_string: '{"river_id":"8075804"}' },
    ]);
    expect(item.insert).toBe(
      "Change geoglows_forecast_viewer where river_id is 8075804 to river_id = ",
    );
    expect(item.subtitle).toBe("river_id (now 8075804)");
    expect(item.group).toBe("Change a tile");
  });

  it("uses a non-empty arg as the where-anchor when changing another arg", () => {
    const items = buildPatchItems([
      { source: "viz", args_string: '{"river_id":"111","color":""}' },
    ]);
    const colorItem = items.find((i) => i.subtitle.startsWith("color"));
    expect(colorItem.insert).toBe("Change viz where river_id is 111 to color = ");
  });

  it("skips tiles with no args", () => {
    expect(buildPatchItems([{ source: "x", args_string: "{}" }])).toEqual([]);
  });
});

describe("filterSlashItems", () => {
  const items = buildSlashItems({
    catalog: [
      { source: "nwmp_reaches_series", label: "NWMP Reaches Time Series", args: ["reach_id"] },
      { source: "nwmp_gauges_series", label: "NWMP Gauges Time Series", args: ["gauge_id"] },
    ],
    tiles: [],
  });

  it("puts the static list command first", () => {
    expect(items[0].key).toBe("list");
  });

  it("matches every whitespace-separated token as a substring", () => {
    const hits = filterSlashItems(items, "nwmp reaches");
    expect(hits).toHaveLength(1);
    expect(hits[0].title).toBe("NWMP Reaches Time Series");
  });

  it("returns all items for an empty query", () => {
    expect(filterSlashItems(items, "")).toHaveLength(items.length);
  });
});

describe("caretForInsert", () => {
  it("lands right after the first '= '", () => {
    const text = "Add A with x = , y = ";
    expect(caretForInsert(text)).toBe(text.indexOf("= ") + 2);
  });

  it("falls back to the end when there is nothing to fill", () => {
    expect(caretForInsert("What plugins are available?")).toBe(
      "What plugins are available?".length,
    );
  });
});
