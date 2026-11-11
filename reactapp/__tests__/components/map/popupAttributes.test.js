import {
  orderAttributeNames,
  isClickEnabled,
  isHoverEnabled,
  hoverFieldFilter,
  buildAttributeRows,
  hoverAttributeRows,
  isTableEligible,
  hasModalPopup,
} from "components/map/popupAttributes";

describe("orderAttributeNames", () => {
  test("puts saved fields first and the rest after in their own order", () => {
    expect(
      orderAttributeNames(
        ["STATUS", "GAUGE_ID", "NAME", "FLOW"],
        ["NAME", "FLOW", "STATUS"],
      ),
    ).toEqual(["NAME", "FLOW", "STATUS", "GAUGE_ID"]);
  });

  test("skips saved fields the names do not include", () => {
    expect(
      orderAttributeNames(["FLOW", "EXTRA"], ["NAME", "FLOW", "STATUS"]),
    ).toEqual(["FLOW", "EXTRA"]);
  });

  test("appends newly discovered fields below the saved ones", () => {
    expect(orderAttributeNames(["C", "A", "B"], ["A", "B"])).toEqual([
      "A",
      "B",
      "C",
    ]);
  });

  test("places integer-like names where the saved order puts them", () => {
    expect(orderAttributeNames(["2020", "NAME"], ["NAME", "2020"])).toEqual([
      "NAME",
      "2020",
    ]);
  });

  test("returns the natural order when nothing is saved", () => {
    expect(orderAttributeNames(["b", "a"], undefined)).toEqual(["b", "a"]);
    expect(orderAttributeNames(["b", "a"], [])).toEqual(["b", "a"]);
  });

  test("lists a duplicated name once, at its first position", () => {
    expect(orderAttributeNames(["a", "b", "a"], ["b", "a", "b"])).toEqual([
      "b",
      "a",
    ]);
  });

  test("ignores a saved order that is not a list", () => {
    expect(orderAttributeNames(["b", "a"], "a,b")).toEqual(["b", "a"]);
    expect(orderAttributeNames(["b", "a"], { 0: "a" })).toEqual(["b", "a"]);
  });

  test("does not mutate its inputs", () => {
    const names = ["b", "a"];
    const saved = ["a"];
    orderAttributeNames(names, saved);
    expect(names).toEqual(["b", "a"]);
    expect(saved).toEqual(["a"]);
  });
});

describe("isClickEnabled / isHoverEnabled", () => {
  test.each([
    ["no popup settings", {}, true, false],
    ["click", { tablePopupType: "click" }, true, false],
    ["hover", { tablePopupType: "hover" }, false, true],
    ["both", { tablePopupType: "both" }, true, true],
    ["none", { tablePopupType: "none" }, false, false],
    ["legacy queryable: false", { queryable: false }, false, false],
    ["legacy queryable: true", { queryable: true }, true, false],
  ])("%s", (_label, layer, click, hover) => {
    expect(isClickEnabled(layer)).toBe(click);
    expect(isHoverEnabled(layer)).toBe(hover);
  });

  test("a missing layer reads as the click default", () => {
    expect(isClickEnabled(undefined)).toBe(true);
    expect(isHoverEnabled(undefined)).toBe(false);
  });
});

describe("hoverFieldFilter", () => {
  const fields = ["id", "name", "elevation"];
  const shown = (layer, sublayer = "stations") =>
    fields.filter(hoverFieldFilter(layer, sublayer));

  test("an allow-list shows only the fields it names", () => {
    const layer = {
      tablePopupType: "both",
      hoverPopupAttributes: { stations: ["name", "id"] },
      omittedPopupAttributes: { stations: ["name"] },
    };
    expect(shown(layer)).toEqual(["id", "name"]);
  });

  test("an allow-list that does not mention the sublayer shows nothing", () => {
    const layer = { hoverPopupAttributes: { other: ["id"] } };
    expect(shown(layer)).toEqual([]);
  });

  test("a deny-list hides only the fields it names", () => {
    const layer = {
      omittedHoverAttributes: { stations: ["elevation"] },
      omittedPopupAttributes: { stations: ["id", "name"] },
    };
    expect(shown(layer)).toEqual(["id", "name"]);
  });

  test("a deny-list with an empty list shows every field", () => {
    // What the editor saves for a layer whose fields it could not list, with
    // hover on and nothing unchecked: the key is there, so the click table's
    // omitted fields are not borrowed.
    const layer = {
      omittedHoverAttributes: { stations: [] },
      omittedPopupAttributes: { stations: ["id"] },
    };
    expect(shown(layer)).toEqual(fields);
  });

  test("a hover layer saved before hover had its own list hides the click table's omitted fields", () => {
    const layer = {
      tablePopupType: "hover",
      omittedPopupAttributes: { stations: ["elevation"] },
    };
    expect(shown(layer)).toEqual(["id", "name"]);
  });

  test("'both' with no hover key falls back the same way", () => {
    const layer = {
      tablePopupType: "both",
      omittedPopupAttributes: { stations: ["id"] },
    };
    expect(shown(layer)).toEqual(["name", "elevation"]);
  });

  test("the allow-list wins when both hover keys are present", () => {
    const layer = {
      hoverPopupAttributes: { stations: ["id"] },
      omittedHoverAttributes: { stations: ["id"] },
    };
    expect(shown(layer)).toEqual(["id"]);
  });

  test("a list that is not an array is read as empty instead of throwing", () => {
    expect(shown({ hoverPopupAttributes: { stations: "id" } })).toEqual([]);
    expect(shown({ omittedHoverAttributes: { stations: 42 } })).toEqual(fields);
    expect(shown({ omittedHoverAttributes: "bad" })).toEqual(fields);
    expect(shown(undefined)).toEqual(fields);
  });
});

describe("buildAttributeRows", () => {
  test("keeps visible fields in the author's order, labelled by alias", () => {
    const rows = buildAttributeRows(
      { id: 1, name: "A", elevation: 10 },
      {
        isVisible: (key) => key !== "elevation",
        aliases: { name: "Station" },
        order: ["name"],
      },
    );
    expect(rows).toEqual([
      { key: "name", label: "Station", value: "A" },
      { key: "id", label: "id", value: 1 },
    ]);
  });

  test("keeps an integer-like name where the order puts it, and both fields sharing an alias", () => {
    const rows = buildAttributeRows(
      { site: "X", 2020: 5, other: 6 },
      {
        isVisible: () => true,
        aliases: { 2020: "Value", other: "Value" },
        order: ["site", "2020"],
      },
    );
    expect(rows.map(({ key, label }) => [key, label])).toEqual([
      ["site", "site"],
      ["2020", "Value"],
      ["other", "Value"],
    ]);
  });

  test("returns no rows for a feature without attributes", () => {
    expect(buildAttributeRows(undefined, { isVisible: () => true })).toEqual(
      [],
    );
  });
});

describe("hoverAttributeRows", () => {
  test("reads the filter, aliases and order from the feature's own layer", () => {
    const feature = {
      layerName: "stations",
      attributes: { id: "BBY", name: "Bodega Bay", elevation: 15 },
      __wrapperLayer: {
        tablePopupType: "both",
        hoverPopupAttributes: { stations: ["id", "name"] },
        attributeAliases: { stations: { id: "CW3E ID" } },
        attributeOrder: { stations: ["name", "id"] },
      },
    };
    expect(hoverAttributeRows(feature)).toEqual([
      { key: "name", label: "name", value: "Bodega Bay" },
      { key: "id", label: "CW3E ID", value: "BBY" },
    ]);
  });

  test("an untagged feature shows every attribute", () => {
    expect(hoverAttributeRows({ attributes: { a: 1 } })).toEqual([
      { key: "a", label: "a", value: 1 },
    ]);
  });
});

describe("isTableEligible / hasModalPopup", () => {
  // The two questions asked of every feature a click turns up. A feature can
  // answer yes to both, or to exactly one -- which is what lets a single list
  // drive both popups.
  const feature = (wrapperLayer) => ({ __wrapperLayer: wrapperLayer });

  test("a layer with no popup settings is table-only", () => {
    const f = feature({ configuration: {} });
    expect(isTableEligible(f)).toBe(true);
    expect(hasModalPopup(f)).toBe(false);
  });

  test("a modal layer that also shows the click table answers yes to both", () => {
    const f = feature({ popupConfig: { mode: "modal" } });
    expect(isTableEligible(f)).toBe(true);
    expect(hasModalPopup(f)).toBe(true);
  });

  test("tablePopupType 'none' with a modal is modal-only", () => {
    const f = feature({
      tablePopupType: "none",
      popupConfig: { mode: "modal" },
    });
    expect(isTableEligible(f)).toBe(false);
    expect(hasModalPopup(f)).toBe(true);
  });

  test("tablePopupType 'hover' with a modal is modal-only on click", () => {
    // Streamflow's shape in the CW3E config.
    const f = feature({
      tablePopupType: "hover",
      popupConfig: { mode: "modal" },
    });
    expect(isTableEligible(f)).toBe(false);
    expect(hasModalPopup(f)).toBe(true);
  });

  test("popupConfig mode 'table' means no modal", () => {
    // What the layer editor writes when the modal toggle is off; its
    // gridItems are inert.
    const f = feature({ popupConfig: { mode: "table", gridItems: [{}] } });
    expect(isTableEligible(f)).toBe(true);
    expect(hasModalPopup(f)).toBe(false);
  });

  test("queryable: false is treated as table popup 'none'", () => {
    expect(isTableEligible(feature({ queryable: false }))).toBe(false);
  });

  test("tablePopupType 'both' shows the click table", () => {
    expect(isTableEligible(feature({ tablePopupType: "both" }))).toBe(true);
  });

  test("an untagged feature is table-eligible and has no modal", () => {
    // resolveTablePopupType defaults to "click", so a feature that somehow
    // arrives without a wrapper layer still reaches the table rather than
    // vanishing from both popups.
    expect(isTableEligible({})).toBe(true);
    expect(hasModalPopup({})).toBe(false);
    expect(isTableEligible(undefined)).toBe(true);
    expect(hasModalPopup(undefined)).toBe(false);
  });
});
