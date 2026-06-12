import {
  axisRefToLayoutKey,
  layoutKeyToAxisRef,
  resolveBaseAxis,
  derivePanes,
  classifyArrangement,
  reflowDomains,
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
