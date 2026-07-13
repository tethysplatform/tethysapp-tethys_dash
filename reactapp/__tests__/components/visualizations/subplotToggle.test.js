import {
  axisRefToLayoutKey,
  layoutKeyToAxisRef,
  resolveBaseAxis,
  derivePanes,
  classifyArrangement,
  reflowDomains,
  reflowColorbar,
  applySubplotToggle,
  associateItemToPane,
} from "components/visualizations/subplotToggle";

// --- Fixtures ------------------------------------------------------------

// Vertical stack of 3 rows, each with a right-side secondary-y overlay and its
// own x-axis (all sharing the same x-domain), mirroring tethysapp .../data.json.
const verticalStackWithOverlays = () => ({
  data: [
    { name: "Temp", xaxis: "x", yaxis: "y" }, // 0 row1 primary
    { name: "RH", xaxis: "x", yaxis: "y2" }, // 1 row1 overlay
    { name: "MSLP", xaxis: "x2", yaxis: "y3" }, // 2 row2 primary
    { name: "Solar", xaxis: "x2", yaxis: "y4" }, // 3 row2 overlay
    { name: "Wind", xaxis: "x3", yaxis: "y5" }, // 4 row3 primary
    { name: "Soil", xaxis: "x3", yaxis: "y5" }, // 5 row3 primary (2nd trace)
  ],
  layout: {
    xaxis: { domain: [0, 0.94], anchor: "y", matches: "x3" },
    xaxis2: { domain: [0, 0.94], anchor: "y3", matches: "x3" },
    xaxis3: { domain: [0, 0.94], anchor: "y5" },
    yaxis: { domain: [0.7, 1.0], anchor: "x", title: { text: "Temperature" } },
    yaxis2: { anchor: "x", overlaying: "y", side: "right" },
    yaxis3: { domain: [0.35, 0.65], anchor: "x2", title: { text: "Pressure" } },
    yaxis4: { anchor: "x2", overlaying: "y3", side: "right" },
    yaxis5: { domain: [0, 0.3], anchor: "x3", title: { text: "Wind" } },
  },
});

// Two columns side by side, shared y-domain.
const horizontalStrip = () => ({
  data: [
    { name: "A", xaxis: "x", yaxis: "y" },
    { name: "B", xaxis: "x2", yaxis: "y2" },
  ],
  layout: {
    xaxis: { domain: [0, 0.45] },
    xaxis2: { domain: [0.55, 1.0] },
    yaxis: { domain: [0, 1], anchor: "x" },
    yaxis2: { domain: [0, 1], anchor: "x2" },
  },
});

// 2x2 grid -> no canonical reflow.
const grid2x2 = () => ({
  data: [
    { name: "TL", xaxis: "x", yaxis: "y" },
    { name: "TR", xaxis: "x2", yaxis: "y2" },
    { name: "BL", xaxis: "x3", yaxis: "y3" },
    { name: "BR", xaxis: "x4", yaxis: "y4" },
  ],
  layout: {
    xaxis: { domain: [0, 0.45] },
    xaxis2: { domain: [0.55, 1] },
    xaxis3: { domain: [0, 0.45] },
    xaxis4: { domain: [0.55, 1] },
    yaxis: { domain: [0.55, 1] },
    yaxis2: { domain: [0.55, 1] },
    yaxis3: { domain: [0, 0.45] },
    yaxis4: { domain: [0, 0.45] },
  },
});

// Two vertically-stacked heatmaps (shared x-domain) + a go.Table footer that
// positions itself with its own `domain`, mirroring the CW3E "MRR" figure.
const verticalStackWithTable = () => ({
  data: [
    {
      name: "Reflectivity",
      type: "heatmap",
      xaxis: "x",
      yaxis: "y",
      // Colorbar sized/positioned to the row-1 band [0.63, 1.0].
      colorbar: { len: 0.37, y: 0.815, yanchor: "middle" },
    }, // 0
    {
      name: "Vertical Velocity",
      type: "heatmap",
      xaxis: "x",
      yaxis: "y3",
      // Colorbar sized/positioned to the row-2 band [0.25, 0.6].
      colorbar: { len: 0.35, y: 0.425, yanchor: "middle" },
    }, // 1
    {
      name: "MRR Table",
      type: "table",
      domain: { x: [0, 1], y: [0, 0.16] }, // footer band
      header: {},
      cells: {},
    }, // 2
  ],
  layout: {
    xaxis: { domain: [0, 1], anchor: "y" },
    yaxis: {
      domain: [0.63, 1.0],
      anchor: "x",
      title: { text: "Reflectivity" },
    },
    yaxis3: {
      domain: [0.25, 0.6],
      anchor: "x",
      title: { text: "Vertical Velocity" },
    },
  },
});

// --- Tests ---------------------------------------------------------------

describe("axis ref helpers", () => {
  it("converts refs to layout keys and back", () => {
    expect(axisRefToLayoutKey("y")).toBe("yaxis");
    expect(axisRefToLayoutKey("y3")).toBe("yaxis3");
    expect(axisRefToLayoutKey("x")).toBe("xaxis");
    expect(axisRefToLayoutKey("x2")).toBe("xaxis2");
    expect(layoutKeyToAxisRef("yaxis")).toBe("y");
    expect(layoutKeyToAxisRef("yaxis3")).toBe("y3");
    expect(layoutKeyToAxisRef("title")).toBeNull();
  });

  it("resolves overlay chains to the base axis", () => {
    const { layout } = verticalStackWithOverlays();
    expect(resolveBaseAxis("y2", layout)).toBe("y"); // overlay -> base
    expect(resolveBaseAxis("y", layout)).toBe("y"); // base -> itself
    expect(resolveBaseAxis("y4", layout)).toBe("y3");
  });

  it("treats overlaying:'free' as its own base and guards cycles", () => {
    const layout = {
      yaxis: { overlaying: "y2" },
      yaxis2: { overlaying: "y" }, // cycle
      yaxis3: { overlaying: "free" },
    };
    expect(resolveBaseAxis("y3", layout)).toBe("y3");
    expect(() => resolveBaseAxis("y", layout)).not.toThrow();
  });
});

describe("derivePanes", () => {
  it("groups overlays into one pane per row and assigns member traces", () => {
    const { data, layout } = verticalStackWithOverlays();
    const panes = derivePanes(data, layout);
    expect(panes).toHaveLength(3);

    expect(panes[0].label).toBe("Temperature");
    expect(panes[0].traceIndices).toEqual([0, 1]); // primary + overlay traces
    expect(panes[2].traceIndices).toEqual([4, 5]);

    // Row 1 owns yaxis (primary) + yaxis2 (overlay) + its dedicated xaxis.
    expect(panes[0].exclusiveAxisKeys.sort()).toEqual(
      ["xaxis", "yaxis", "yaxis2"].sort(),
    );
    expect(panes[0].primaryYKey).toBe("yaxis");
    expect(panes[0].rect.y).toEqual([0.7, 1.0]);
  });

  it("falls back to trace name then Subplot N for labels", () => {
    const { data, layout } = horizontalStrip();
    delete layout.yaxis.title;
    const panes = derivePanes(data, layout);
    expect(panes[0].label).toBe("A"); // first trace name
  });

  it("uses explicit labels (by axis ref or layout key) over derived labels", () => {
    const { data, layout } = verticalStackWithOverlays();
    const panes = derivePanes(data, layout, {
      labels: { y: "Air Temp", yaxis3: "Pressure (units)" },
    });
    expect(panes[0].label).toBe("Air Temp"); // matched by ref "y"
    expect(panes[1].label).toBe("Pressure (units)"); // matched by layout key
    expect(panes[2].label).toBe("Wind"); // no explicit -> axis title fallback
  });

  it("ignores empty explicit labels and falls back", () => {
    const { data, layout } = verticalStackWithOverlays();
    const panes = derivePanes(data, layout, { labels: { y: "" } });
    expect(panes[0].label).toBe("Temperature"); // axis title, not the empty override
  });

  it("does not mark a shared x-axis as exclusive to any single row", () => {
    // Vertical stack where all rows share a single x-axis.
    const data = [{ yaxis: "y" }, { yaxis: "y2" }];
    const layout = {
      xaxis: { domain: [0, 1] },
      yaxis: { domain: [0.55, 1], anchor: "x" },
      yaxis2: { domain: [0, 0.45], anchor: "x" },
    };
    const panes = derivePanes(data, layout);
    // Neither pane should claim the shared xaxis.
    panes.forEach((p) => expect(p.exclusiveAxisKeys).not.toContain("xaxis"));
    expect(panes[0].exclusiveAxisKeys).toEqual(["yaxis"]);
  });

  it("treats non-cartesian traces as one pane each, no exclusive axes", () => {
    const data = [
      { type: "scatterpolar", subplot: "polar" },
      { type: "scatterpolar", subplot: "polar2" },
    ];
    const layout = {
      polar: { domain: { x: [0, 0.45], y: [0, 1] } },
      polar2: { domain: { x: [0.55, 1], y: [0, 1] } },
    };
    const panes = derivePanes(data, layout);
    expect(panes).toHaveLength(2);
    expect(panes[0].kind).toBe("nonCartesian");
    expect(panes[0].exclusiveAxisKeys).toEqual([]);
    expect(panes[0].rect.x).toEqual([0, 0.45]);
  });
});

describe("classifyArrangement", () => {
  it("detects a vertical stack", () => {
    const { data, layout } = verticalStackWithOverlays();
    expect(classifyArrangement(derivePanes(data, layout))).toBe("vertical");
  });

  it("detects a horizontal strip", () => {
    const { data, layout } = horizontalStrip();
    expect(classifyArrangement(derivePanes(data, layout))).toBe("horizontal");
  });

  it("returns none for a grid", () => {
    const { data, layout } = grid2x2();
    expect(classifyArrangement(derivePanes(data, layout))).toBe("none");
  });

  it("returns none for non-cartesian and for single-pane figures", () => {
    const polar = derivePanes([{ subplot: "polar" }, { subplot: "polar2" }], {
      polar: { domain: { x: [0, 0.45], y: [0, 1] } },
      polar2: { domain: { x: [0.55, 1], y: [0, 1] } },
    });
    expect(classifyArrangement(polar)).toBe("none");
    expect(classifyArrangement([{ rect: { x: [0, 1], y: [0, 1] } }])).toBe(
      "none",
    );
  });
});

describe("reflowDomains", () => {
  it("redistributes equal bands to fill the space with preserved gap", () => {
    const { data, layout } = verticalStackWithOverlays();
    const panes = derivePanes(data, layout);
    // Hide the middle row; keep rows 1 and 3.
    const visible = [panes[0].id, panes[2].id];
    const domains = reflowDomains(panes, visible, "vertical");

    const keys = Object.keys(domains);
    expect(keys.sort()).toEqual(["yaxis", "yaxis5"].sort());
    // Two equal bands + one ~0.05 gap fill [0,1].
    const bottom = domains.yaxis5;
    const top = domains.yaxis;
    expect(bottom[0]).toBeCloseTo(0, 6);
    expect(top[1]).toBeCloseTo(1, 6);
    expect(bottom[1]).toBeLessThan(top[0]); // bottom below top, gap between
    // Bands equal size.
    expect(top[1] - top[0]).toBeCloseTo(bottom[1] - bottom[0], 6);
  });

  it("preserves relative proportions for unequal bands", () => {
    // Tall top (0.75 high) + short bottom (0.25 high), adjacent (no gap).
    const panes = [
      {
        id: "p1",
        kind: "cartesian",
        primaryYKey: "yaxis",
        primaryXKey: "xaxis",
        rect: { x: [0, 1], y: [0.25, 1.0] },
      },
      {
        id: "p2",
        kind: "cartesian",
        primaryYKey: "yaxis2",
        primaryXKey: "xaxis2",
        rect: { x: [0, 1], y: [0, 0.25] },
      },
    ];
    const domains = reflowDomains(panes, ["p1", "p2"], "vertical");
    const topSize = domains.yaxis[1] - domains.yaxis[0];
    const botSize = domains.yaxis2[1] - domains.yaxis2[0];
    // Original ratio 0.6 : 0.2 == 3 : 1 preserved.
    expect(topSize / botSize).toBeCloseTo(3, 5);
    // No gap -> they fill [0,1] exactly.
    expect(topSize + botSize).toBeCloseTo(1, 6);
  });

  it("expands a single visible pane to the full range", () => {
    const { data, layout } = verticalStackWithOverlays();
    const panes = derivePanes(data, layout);
    const domains = reflowDomains(panes, [panes[1].id], "vertical");
    expect(domains.yaxis3).toEqual([0, 1]);
  });
});

describe("reflowColorbar", () => {
  it("scales len and maps y for a per-subplot bar (middle anchor)", () => {
    // Row-1 band [0.63, 1.0] (h 0.37) expands to the full envelope [0.25, 1.0].
    const cb = { len: 0.37, y: 0.815, yanchor: "middle" };
    const out = reflowColorbar(cb, [0.63, 1.0], [0.25, 1.0]);
    expect(out.len).toBeCloseTo(0.75, 6); // fills the new band
    expect(out.y).toBeCloseTo(0.625, 6); // recentred on [0.25, 1.0]
    // Original untouched (new object).
    expect(cb.len).toBe(0.37);
  });

  it("respects top and bottom anchors when testing containment", () => {
    const top = reflowColorbar(
      { len: 0.3, y: 1.0, yanchor: "top" }, // extent [0.7, 1.0]
      [0.7, 1.0],
      [0.5, 1.0],
    );
    expect(top.len).toBeCloseTo(0.5, 6); // 0.3 * (0.5 / 0.3) = 0.5
    expect(top.y).toBeCloseTo(1.0, 6); // top edge maps to new top

    const bottom = reflowColorbar(
      { len: 0.3, y: 0.0, yanchor: "bottom" }, // extent [0, 0.3]
      [0, 0.3],
      [0, 0.6],
    );
    expect(bottom.len).toBeCloseTo(0.6, 6);
    expect(bottom.y).toBeCloseTo(0.0, 6);
  });

  it("leaves a figure-wide shared bar alone (extent not within the band)", () => {
    // Full-height bar (len 1, centred) doesn't belong to a 0.37-tall subplot.
    expect(
      reflowColorbar({ len: 1, y: 0.5 }, [0.63, 1.0], [0.25, 1.0]),
    ).toBeNull();
  });

  it("ignores bars without both len and y, pixel lengths, and non-paper refs", () => {
    expect(reflowColorbar({ len: 0.3 }, [0.63, 1], [0.25, 1])).toBeNull();
    expect(reflowColorbar({ y: 0.8 }, [0.63, 1], [0.25, 1])).toBeNull();
    expect(
      reflowColorbar(
        { len: 0.37, y: 0.815, lenmode: "pixels" },
        [0.63, 1],
        [0.25, 1],
      ),
    ).toBeNull();
    expect(
      reflowColorbar(
        { len: 0.37, y: 0.815, yref: "container" },
        [0.63, 1],
        [0.25, 1],
      ),
    ).toBeNull();
    expect(reflowColorbar(undefined, [0.63, 1], [0.25, 1])).toBeNull();
  });
});

describe("applySubplotToggle", () => {
  it("is a no-op when all panes are visible", () => {
    const { data, layout } = verticalStackWithOverlays();
    const out = applySubplotToggle(data, layout, null);
    expect(out.data).toBe(data); // same reference
    expect(out.layout).toBe(layout);
    expect(out.arrangement).toBe("vertical");
  });

  it("hides member traces and exclusive axes, and reflows the rest", () => {
    const { data, layout } = verticalStackWithOverlays();
    const panes = derivePanes(data, layout);
    const out = applySubplotToggle(data, layout, [panes[0].id, panes[2].id]);

    // Middle row hidden.
    expect(out.data[2].visible).toBe(false); // MSLP
    expect(out.data[3].visible).toBe(false); // Solar overlay
    expect(out.layout.yaxis3.visible).toBe(false);
    expect(out.layout.yaxis4.visible).toBe(false);
    expect(out.layout.xaxis2.visible).toBe(false);

    // Kept rows visible and reflowed.
    expect(out.data[0].visible).toBe(true);
    expect(out.layout.yaxis.visible).toBe(true);
    expect(out.layout.yaxis.domain[1]).toBeCloseTo(1, 6);
    expect(out.layout.yaxis5.domain[0]).toBeCloseTo(0, 6);
  });

  it("makes the plot background transparent while reflowing so leftover hidden backgrounds can't cover traces", () => {
    const { data, layout } = verticalStackWithOverlays();
    layout.plot_bgcolor = "white";
    const panes = derivePanes(data, layout);
    // Keep only the top row; hide rows 2 and 3.
    const out = applySubplotToggle(data, layout, [panes[0].id]);
    expect(out.layout.plot_bgcolor).toBe("rgba(0,0,0,0)");
    // Visible row still fills the space and stays visible.
    expect(out.layout.yaxis.domain).toEqual([0, 1]);
    expect(out.layout.yaxis.visible).not.toBe(false);
  });

  it("neutralizes the background for a horizontal strip too", () => {
    const { data, layout } = horizontalStrip();
    layout.plot_bgcolor = "white";
    const panes = derivePanes(data, layout);
    const out = applySubplotToggle(data, layout, [panes[0].id]);
    expect(out.layout.plot_bgcolor).toBe("rgba(0,0,0,0)");
  });

  it("leaves the background untouched for a grid (no reflow, no overlap)", () => {
    const { data, layout } = grid2x2();
    layout.plot_bgcolor = "white";
    const panes = derivePanes(data, layout);
    const out = applySubplotToggle(data, layout, [
      panes[0].id,
      panes[1].id,
      panes[2].id,
    ]);
    expect(out.layout.plot_bgcolor).toBe("white");
    expect(out.layout.yaxis4.visible).toBe(false); // BR still hidden
  });

  it("preserves the original background when all panes are visible", () => {
    const { data, layout } = verticalStackWithOverlays();
    layout.plot_bgcolor = "white";
    const out = applySubplotToggle(data, layout, null);
    expect(out.layout.plot_bgcolor).toBe("white"); // pristine
  });

  it("never assigns a domain to overlay axes", () => {
    const { data, layout } = verticalStackWithOverlays();
    const panes = derivePanes(data, layout);
    const out = applySubplotToggle(data, layout, [panes[0].id]);
    expect(out.layout.yaxis2.domain).toBeUndefined(); // overlay stays domain-less
  });

  it("does not mutate the input figure", () => {
    const { data, layout } = verticalStackWithOverlays();
    const out = applySubplotToggle(data, layout, [
      derivePanes(data, layout)[0].id,
    ]);
    expect(data[2].visible).toBeUndefined();
    expect(layout.yaxis3.visible).toBeUndefined();
    expect(out.layout).not.toBe(layout);
  });

  it("degrades to visibility-only for a grid (no domain rewrite)", () => {
    const { data, layout } = grid2x2();
    const panes = derivePanes(data, layout);
    const out = applySubplotToggle(data, layout, [
      panes[0].id,
      panes[1].id,
      panes[2].id,
    ]);
    expect(out.arrangement).toBe("none");
    expect(out.data[3].visible).toBe(false); // BR hidden
    expect(out.layout.yaxis4.visible).toBe(false);
    // Visible panes keep their original domains (no reflow).
    expect(out.layout.yaxis.domain).toEqual([0.55, 1]);
  });

  it("honors an explicit arrangement override (reflow: none)", () => {
    const { data, layout } = verticalStackWithOverlays();
    const panes = derivePanes(data, layout);
    const out = applySubplotToggle(data, layout, [panes[0].id, panes[2].id], {
      arrangement: "none",
    });
    expect(out.arrangement).toBe("none");
    // Visible panes keep original domains despite being a stack.
    expect(out.layout.yaxis.domain).toEqual([0.7, 1.0]);
    expect(out.layout.yaxis5.domain).toEqual([0, 0.3]);
  });
});

describe("domain-based traces (go.Table etc.)", () => {
  it("classifies a go.Table as its own non-cartesian pane with the trace's domain", () => {
    const { data, layout } = verticalStackWithTable();
    const panes = derivePanes(data, layout);
    expect(panes).toHaveLength(3);

    const table = panes.find((p) => p.kind === "nonCartesian");
    expect(table).toBeDefined();
    // Its own pane — not grouped with the row-1 Reflectivity heatmap.
    expect(table.traceIndices).toEqual([2]);
    expect(table.id).toBe("np:domain:table:2");
    // Rect read from the trace's own `domain`, not from `layout`.
    expect(table.rect.y).toEqual([0, 0.16]);
    // The Reflectivity pane keeps only its own trace.
    const reflectivity = panes.find((p) => p.primaryYKey === "yaxis");
    expect(reflectivity.traceIndices).toEqual([0]);
  });

  it("does not offer an unlabeled domain pane as a toggle, but labeled ones are", () => {
    const { data, layout } = verticalStackWithTable();
    const unlabeled = derivePanes(data, layout).find(
      (p) => p.kind === "nonCartesian",
    );
    expect(unlabeled.toggleable).toBe(false);
    // Cartesian panes stay toggleable.
    expect(
      derivePanes(data, layout)
        .filter((p) => p.kind === "cartesian")
        .every((p) => p.toggleable),
    ).toBe(true);

    // Labelled by trace type...
    const byType = derivePanes(data, layout, {
      labels: { table: "MRR Table" },
    }).find((p) => p.kind === "nonCartesian");
    expect(byType.toggleable).toBe(true);
    expect(byType.label).toBe("MRR Table");

    // ...or by pane id.
    const byId = derivePanes(data, layout, {
      labels: { "domain:table:2": "Footer" },
    }).find((p) => p.kind === "nonCartesian");
    expect(byId.toggleable).toBe(true);
    expect(byId.label).toBe("Footer");
  });

  it("scene/geo panes stay toggleable regardless of labels", () => {
    const panes = derivePanes([
      { type: "scatter3d", scene: "scene" },
      { type: "scattergeo", geo: "geo2" },
    ]);
    expect(panes.every((p) => p.toggleable)).toBe(true);
  });

  it("still classifies the cartesian stack as vertical, ignoring the table", () => {
    const { data, layout } = verticalStackWithTable();
    expect(classifyArrangement(derivePanes(data, layout))).toBe("vertical");
  });

  it("reflows only within the cartesian envelope, preserving the table band", () => {
    const { data, layout } = verticalStackWithTable();
    const panes = derivePanes(data, layout);
    const reflectivity = panes.find((p) => p.primaryYKey === "yaxis");
    const table = panes.find((p) => p.kind === "nonCartesian");
    const tableTop = table.rect.y[1]; // 0.16

    // Hide Vertical Velocity; keep Reflectivity (+ the always-visible table).
    const domains = reflowDomains(
      panes,
      [reflectivity.id, table.id],
      "vertical",
    );
    // The lone visible heatmap fills the cartesian envelope [0.25, 1.0], NOT
    // [0, 1] — its bottom stays above the table band.
    expect(domains.yaxis[0]).toBeCloseTo(0.25, 6);
    expect(domains.yaxis[1]).toBeCloseTo(1.0, 6);
    expect(domains.yaxis[0]).toBeGreaterThanOrEqual(tableTop);
  });

  it("keeps the table visible and unoverlapped when a heatmap is toggled off", () => {
    const { data, layout } = verticalStackWithTable();
    const panes = derivePanes(data, layout);
    const reflectivity = panes.find((p) => p.primaryYKey === "yaxis");
    const table = panes.find((p) => p.kind === "nonCartesian");

    const out = applySubplotToggle(data, layout, [reflectivity.id, table.id]);
    // Vertical Velocity hidden, Reflectivity + table still visible.
    expect(out.data[1].visible).toBe(false);
    expect(out.data[0].visible).toBe(true);
    expect(out.data[2].visible).not.toBe(false); // table trace untouched
    // Reflectivity expanded but not over the table.
    expect(out.layout.yaxis.domain[0]).toBeCloseTo(0.25, 6);
    expect(out.layout.yaxis.domain[0]).toBeGreaterThanOrEqual(table.rect.y[1]);
    // The visible heatmap's colorbar grows to track the expanded band, and the
    // table (no colorbar) is untouched.
    expect(out.data[0].colorbar.len).toBeCloseTo(0.75, 6);
    expect(out.data[0].colorbar.y).toBeCloseTo(0.625, 6);
    expect(out.data[2].colorbar).toBeUndefined();
  });

  it("leaves colorbars untouched when the figure is not reflowed (all visible)", () => {
    const { data, layout } = verticalStackWithTable();
    const out = applySubplotToggle(data, layout, null);
    expect(out.data).toBe(data); // pristine reference
    expect(out.data[0].colorbar.len).toBe(0.37);
  });

  it("unions the bands of multiple domain traces", () => {
    const data = [
      { name: "H", type: "heatmap", xaxis: "x", yaxis: "y" },
      { name: "T1", type: "table", domain: { x: [0, 0.5], y: [0, 0.15] } },
      { name: "T2", type: "table", domain: { x: [0.5, 1], y: [0, 0.15] } },
    ];
    const layout = { xaxis: { domain: [0, 1] }, yaxis: { domain: [0.25, 1] } };
    const panes = derivePanes(data, layout);
    const tables = panes.filter((p) => p.kind === "nonCartesian");
    expect(tables).toHaveLength(2); // distinct panes, distinct ids
    expect(tables.map((p) => p.id)).toEqual([
      "np:domain:table:1",
      "np:domain:table:2",
    ]);
  });
});

describe("annotation / shape / image association", () => {
  // verticalStackWithOverlays + layout items anchored various ways.
  const withItems = () => {
    const { data, layout } = verticalStackWithOverlays();
    layout.annotations = [
      { text: "Temp title", xref: "x domain", yref: "y domain", x: 0, y: 1 }, // row1
      { text: "Wind title", xref: "x3 domain", yref: "y5 domain", x: 0, y: 1 }, // row3
      { text: "RH (overlay)", xref: "x", yref: "y2" }, // overlay -> row1
      { text: "global", xref: "paper", yref: "paper", x: 0.5, y: 1.05 }, // unassoc
    ];
    layout.shapes = [
      { type: "line", xref: "x3", yref: "y5", x0: 0, x1: 1, y0: 2, y1: 3 }, // row3 drawing
      {
        type: "line",
        xref: "paper",
        yref: "paper",
        y0: 0,
        y1: 1,
        meta: { createdBy: "addVerticalLine" }, // runtime vline -> never touched
      },
    ];
    layout.images = [
      { xref: "paper", yref: "paper", x: 0, y: 1.04 }, // logo -> unassoc
    ];
    return { data, layout };
  };

  it("associates items to panes by axis ref (incl. overlays and domain refs)", () => {
    const { data, layout } = withItems();
    const panes = derivePanes(data, layout);
    const [row1, , row3] = panes;
    const assoc = (item) =>
      associateItemToPane(item, panes, layout, "vertical")?.id;

    expect(assoc(layout.annotations[0])).toBe(row1.id); // x/y domain
    expect(assoc(layout.annotations[1])).toBe(row3.id); // x3/y5 domain
    expect(assoc(layout.annotations[2])).toBe(row1.id); // overlay y2 -> y
    expect(assoc(layout.annotations[3])).toBeUndefined(); // paper
    expect(assoc(layout.shapes[0])).toBe(row3.id); // x3/y5 data ref
  });

  it("hides annotations/shapes of a hidden pane and leaves the rest", () => {
    const { data, layout } = withItems();
    const panes = derivePanes(data, layout);
    // Hide row 3 (Wind).
    const out = applySubplotToggle(data, layout, [panes[0].id, panes[1].id]);

    expect(out.layout.annotations[1].visible).toBe(false); // Wind title
    expect(out.layout.shapes[0].visible).toBe(false); // Wind drawing
    // Row 1 items stay visible.
    expect(out.layout.annotations[0].visible).toBeUndefined();
    expect(out.layout.annotations[2].visible).toBeUndefined();
    // Unassociated paper items untouched.
    expect(out.layout.annotations[3].visible).toBeUndefined();
    expect(out.layout.images[0].visible).toBeUndefined();
  });

  it("never hides the runtime vertical line", () => {
    const { data, layout } = withItems();
    const panes = derivePanes(data, layout);
    const out = applySubplotToggle(data, layout, [panes[0].id]); // hide rows 2 & 3
    const vline = out.layout.shapes.find(
      (s) => s.meta?.createdBy === "addVerticalLine",
    );
    expect(vline.visible).toBeUndefined();
  });

  it("does not associate items anchored only to a shared axis", () => {
    // All rows share one x-axis; an item anchored to that x (paper y) is
    // ambiguous and must not be hidden.
    const data = [{ yaxis: "y" }, { yaxis: "y2" }];
    const layout = {
      xaxis: { domain: [0, 1] },
      yaxis: { domain: [0.55, 1], anchor: "x" },
      yaxis2: { domain: [0, 0.45], anchor: "x" },
      annotations: [{ text: "shared", xref: "x", yref: "paper", x: 0.5 }],
    };
    const panes = derivePanes(data, layout);
    expect(
      associateItemToPane(layout.annotations[0], panes, layout, "vertical"),
    ).toBeNull();
  });

  it("does not mutate the input layout items", () => {
    const { data, layout } = withItems();
    const panes = derivePanes(data, layout);
    applySubplotToggle(data, layout, [panes[0].id]);
    expect(layout.annotations[1].visible).toBeUndefined();
    expect(layout.shapes[0].visible).toBeUndefined();
  });
});

describe("branch coverage", () => {
  it("resolveBaseAxis tolerates a missing layout (line 61)", () => {
    expect(resolveBaseAxis("y")).toBe("y");
    expect(resolveBaseAxis("x3", undefined)).toBe("x3");
  });

  it("derivePanes returns [] with no arguments (lines 107-110)", () => {
    expect(derivePanes()).toEqual([]);
  });

  it("places scene and geo traces as non-cartesian panes (lines 74-75)", () => {
    const panes = derivePanes([
      { type: "scatter3d", scene: "scene" },
      { type: "scattergeo", geo: "geo2" },
      { type: "scatterpolar", subplot: "polar" },
    ]);
    expect(panes.map((p) => p.id)).toEqual(["np:scene", "np:geo2", "np:polar"]);
    expect(panes.every((p) => p.kind === "nonCartesian")).toBe(true);
  });

  it("defaults cartesian refs and axis domains when absent (lines 80-85)", () => {
    // Trace with no xaxis/yaxis -> defaults to x/y; empty layout -> [0,1] rects.
    const panes = derivePanes([{}], {});
    expect(panes[0].id).toBe("x|y");
    expect(panes[0].rect.x).toEqual([0, 1]);
    expect(panes[0].rect.y).toEqual([0, 1]);
    expect(panes[0].primaryYKey).toBe("yaxis");
  });

  it("non-cartesian pane without a domain defaults its rect (lines 166-180)", () => {
    const panes = derivePanes([{ scene: "scene" }], {}); // no layout.scene
    expect(panes[0].kind).toBe("nonCartesian");
    expect(panes[0].rect).toEqual({ x: [0, 1], y: [0, 1] });
    expect(panes[0].exclusiveAxisKeys).toEqual([]);
  });

  it("listAxisKeys skips non-axis layout keys (line 50 filter)", () => {
    // A non-axis top-level key ("title") must be filtered out of overlay scan.
    const layout = {
      title: "ignored",
      xaxis: { domain: [0, 1] },
      yaxis: { domain: [0.6, 1], anchor: "x" },
      yaxis2: { domain: [0, 0.4], anchor: "x" },
    };
    const panes = derivePanes([{ yaxis: "y" }, { yaxis: "y2" }], layout);
    expect(panes).toHaveLength(2);
  });

  it("classifyArrangement returns none for overlapping bands (line 220)", () => {
    const layout = {
      xaxis: { domain: [0, 1] },
      yaxis: { domain: [0, 0.6], anchor: "x" },
      yaxis2: { domain: [0.4, 1], anchor: "x" }, // overlaps yaxis
    };
    const panes = derivePanes([{ yaxis: "y" }, { yaxis: "y2" }], layout);
    expect(classifyArrangement(panes)).toBe("none");
  });

  it("reflowDomains returns {} when nothing is visible (line 275)", () => {
    const { data, layout } = verticalStackWithOverlays();
    const panes = derivePanes(data, layout);
    expect(reflowDomains(panes, [], "vertical")).toEqual({});
  });

  it("reflowDomains splits evenly when bands sum to ~0 (lines 287-290)", () => {
    // Zero-width bands => zero-width cartesian envelope, so the even-split
    // branch runs but there is no space to distribute; both collapse to the
    // envelope point (here 0).
    const panes = [
      { id: "a", kind: "cartesian", primaryYKey: "yaxis", rect: { y: [0, 0] } },
      {
        id: "b",
        kind: "cartesian",
        primaryYKey: "yaxis3",
        rect: { y: [0, 0] },
      },
    ];
    const out = reflowDomains(panes, ["a", "b"], "vertical");
    expect(out.yaxis).toEqual([0, 0]);
    expect(out.yaxis3).toEqual([0, 0]);
  });

  it("associateItemToPane prefers the x-axis for a horizontal strip (line 333)", () => {
    const { data, layout } = horizontalStrip();
    const panes = derivePanes(data, layout);
    const item = { xref: "x2", yref: "paper" };
    expect(associateItemToPane(item, panes, layout, "horizontal").id).toBe(
      panes[1].id,
    );
  });

  it("associateItemToPane returns null for items with no axis refs (lines 309-310)", () => {
    const { data, layout } = verticalStackWithOverlays();
    const panes = derivePanes(data, layout);
    expect(associateItemToPane({}, panes, layout, "vertical")).toBeNull();
  });

  it("applySubplotToggle no-ops with no arguments (lines 355-372)", () => {
    const out = applySubplotToggle();
    expect(out).toEqual({
      data: [],
      layout: {},
      panes: [],
      arrangement: "none",
    });
  });

  it("applySubplotToggle forwards labels when deriving internally (lines 358-363)", () => {
    const { data, layout } = verticalStackWithOverlays();
    const panes = derivePanes(data, layout);
    const out = applySubplotToggle(data, layout, [panes[0].id], {
      labels: { y: "Air Temp" },
    });
    expect(out.panes[0].label).toBe("Air Temp");
  });

  it("leaves a trace already at the target visibility untouched (line 385)", () => {
    const { data, layout } = verticalStackWithOverlays();
    data[2].visible = false; // MSLP already hidden
    const out = applySubplotToggle(data, layout, [panes0Ids(data, layout)]);
    // Unchanged trace keeps its identity (no needless clone).
    expect(out.data[2]).toBe(data[2]);
    expect(out.data[2].visible).toBe(false);
    // A sibling that did need flipping is a new object.
    expect(out.data[3]).not.toBe(data[3]);
    expect(out.data[3].visible).toBe(false);
  });

  it("leaves a non-array annotations/images container untouched (line 431)", () => {
    const { data, layout } = verticalStackWithOverlays();
    const notArray = { text: "oops, not wrapped in a list" };
    layout.images = notArray;
    const panes = derivePanes(data, layout);
    const out = applySubplotToggle(data, layout, [panes[0].id]);
    expect(out.layout.images).toBe(notArray); // returned as-is
  });

  it("does not mark a shared y-axis exclusive in a horizontal strip (line 188)", () => {
    // Two columns sharing one y-axis -> usageY[y] === 2, so y is not exclusive.
    const layout = {
      xaxis: { domain: [0, 0.45] },
      xaxis2: { domain: [0.55, 1] },
      yaxis: { domain: [0, 1], anchor: "x" },
    };
    const panes = derivePanes(
      [
        { xaxis: "x", yaxis: "y" },
        { xaxis: "x2", yaxis: "y" },
      ],
      layout,
    );
    expect(panes[0].exclusiveAxisKeys).toEqual(["xaxis"]); // y omitted (shared)
    expect(panes[1].exclusiveAxisKeys).toEqual(["xaxis2"]);
  });

  it("clones an override target absent from the layout (line 298)", () => {
    // Axes referenced by traces but not declared in layout.
    const data = [
      { xaxis: "x", yaxis: "y" },
      { xaxis: "x2", yaxis: "y2" },
    ];
    const panes = derivePanes(data, {});
    const out = applySubplotToggle(data, {}, [panes[0].id]);
    expect(out.layout.yaxis2.visible).toBe(false); // built from {}
    expect(out.layout.xaxis2.visible).toBe(false);
  });

  it("associateItemToPane falls through to the other axis (line 333)", () => {
    const horiz = horizontalStrip();
    const hPanes = derivePanes(horiz.data, horiz.layout);
    // Horizontal but only the y-ref resolves -> byX null, falls back to byY.
    expect(
      associateItemToPane(
        { xref: "paper", yref: "y2" },
        hPanes,
        horiz.layout,
        "horizontal",
      )?.id,
    ).toBe(hPanes[1].id);

    const vert = verticalStackWithOverlays();
    const vPanes = derivePanes(vert.data, vert.layout);
    // Vertical but only the x-ref resolves -> byY null, falls back to byX.
    expect(
      associateItemToPane(
        { xref: "x2", yref: "paper" },
        vPanes,
        vert.layout,
        "vertical",
      )?.id,
    ).toBe(vPanes[1].id);
  });

  it("defaults a domain-based trace's missing `domain` to the full paper (line 156)", () => {
    // A go.Table with no explicit domain: `trace.domain || {}` falls back and
    // the pane rect defaults to the whole paper.
    const panes = derivePanes(
      [{ type: "table" }],
      {},
      {
        labels: { table: "Stats" },
      },
    );
    expect(panes).toHaveLength(1);
    expect(panes[0].kind).toBe("nonCartesian");
    expect(panes[0].toggleable).toBe(true); // labeled by trace type
    expect(panes[0].rect).toEqual({ x: [0, 1], y: [0, 1] });
  });

  it("classifyArrangement returns none for a missing panes list (line 294)", () => {
    expect(classifyArrangement(null)).toBe("none");
    expect(classifyArrangement(undefined)).toBe("none");
  });

  it("reflowColorbar leaves a bar on a zero-height band untouched (line 418)", () => {
    // Degenerate original band [0.5, 0.5]: a tiny bar passes the band-tolerance
    // check, but the scale factor is undefined (0/0) -> null, bar untouched.
    expect(
      reflowColorbar({ len: 0.02, y: 0.5 }, [0.5, 0.5], [0.2, 0.8]),
    ).toBeNull();
  });

  it("applies a colorbar override without flipping an explicitly-visible trace (line 552)", () => {
    // Vertical stack where the surviving pane's trace already carries
    // `visible: true`: its visibility must NOT be rewritten (flip=false) while
    // its colorbar still reflows with the expanded band (cb truthy).
    const data = [
      {
        xaxis: "x",
        yaxis: "y",
        visible: true,
        colorbar: { len: 0.28, y: 0.85 },
      },
      { xaxis: "x", yaxis: "y2" },
    ];
    const layout = {
      xaxis: { domain: [0, 1] },
      yaxis: { domain: [0.7, 1], anchor: "x" },
      yaxis2: { domain: [0, 0.3], anchor: "x" },
    };
    const panes = derivePanes(data, layout);
    const out = applySubplotToggle(data, layout, [panes[0].id]);
    expect(out.data[0]).not.toBe(data[0]); // cloned for the colorbar override
    expect(out.data[0].visible).toBe(true); // not flipped
    // Band [0.7, 1] expands to the full envelope [0, 1] -> scale 1/0.3.
    expect(out.data[0].colorbar.len).toBeCloseTo(0.28 / 0.3, 10);
    expect(out.data[1].visible).toBe(false);
  });
});

// Helper: id of the first pane for a figure (keeps the line-385 test terse).
function panes0Ids(data, layout) {
  return derivePanes(data, layout)[0].id;
}
