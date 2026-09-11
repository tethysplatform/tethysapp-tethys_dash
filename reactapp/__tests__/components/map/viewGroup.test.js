import {
  CENTER_TOLERANCE_PIXELS,
  RESOLUTION_TOLERANCE_RATIO,
  ROTATION_TOLERANCE_RADIANS,
  centersAreEqual,
  clearGridItemGroupInitialExtent,
  clearGroupInitialExtent,
  clearViewGroupSettings,
  containsVariableToken,
  enforceSingleGroupInitialExtent,
  normalizeViewGroupName,
  discoverGroupSeeds,
  parseSeedExtent,
  readViewGroupSettings,
  resolutionsAreEqual,
  rotationsAreEqual,
  viewsAreEqual,
} from "components/map/viewGroup";

describe("normalizeViewGroupName", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeViewGroupName(" Basin ")).toBe("Basin");
    expect(normalizeViewGroupName("Basin")).toBe("Basin");
    expect(normalizeViewGroupName("\tBasin\n")).toBe("Basin");
  });

  it("compares case sensitively", () => {
    expect(normalizeViewGroupName("basin")).not.toBe(
      normalizeViewGroupName("Basin"),
    );
  });

  it("treats an empty or whitespace-only name as no group", () => {
    expect(normalizeViewGroupName("")).toBeNull();
    expect(normalizeViewGroupName("   ")).toBeNull();
    expect(normalizeViewGroupName("\t\n ")).toBeNull();
  });

  it("treats a non-string as no group", () => {
    expect(normalizeViewGroupName(undefined)).toBeNull();
    expect(normalizeViewGroupName(null)).toBeNull();
    expect(normalizeViewGroupName(5)).toBeNull();
    expect(normalizeViewGroupName({ name: "Basin" })).toBeNull();
  });
});

describe("centersAreEqual", () => {
  const resolution = 10; // 10 map units per pixel -> 5 unit tolerance

  it("treats a delta below half a pixel as equal", () => {
    expect(centersAreEqual([1000, 2000], [1004, 2004], resolution)).toBe(true);
  });

  it("treats a delta above half a pixel as unequal", () => {
    expect(centersAreEqual([1000, 2000], [1006, 2000], resolution)).toBe(false);
    expect(centersAreEqual([1000, 2000], [1000, 2006], resolution)).toBe(false);
  });

  it("scales the tolerance with the resolution", () => {
    const delta = 4;
    // Zoomed in far enough, the same 4 unit delta is more than half a pixel.
    expect(centersAreEqual([0, 0], [delta, 0], 1)).toBe(false);
    expect(centersAreEqual([0, 0], [delta, 0], 100)).toBe(true);
    expect(CENTER_TOLERANCE_PIXELS).toBe(0.5);
  });

  it("handles missing or malformed centers", () => {
    expect(centersAreEqual(null, null, resolution)).toBe(true);
    expect(centersAreEqual([0, 0], null, resolution)).toBe(false);
    expect(centersAreEqual([0, NaN], [0, 0], resolution)).toBe(false);
  });

  it("treats two absent centers as equal however they are absent", () => {
    expect(centersAreEqual(undefined, undefined, resolution)).toBe(true);
    expect(centersAreEqual(null, undefined, resolution)).toBe(true);
    expect(centersAreEqual(undefined, null, resolution)).toBe(true);
  });

  it("treats one absent center as unequal", () => {
    expect(centersAreEqual(null, [1, 2], resolution)).toBe(false);
    expect(centersAreEqual([1, 2], undefined, resolution)).toBe(false);
  });

  it("collapses the tolerance to zero without a positive resolution", () => {
    // A non-positive resolution sizes no pixel, so nothing but an exact match
    // may compare equal -- the tolerance must not silently become 0 * 0.5 of
    // some other number.
    expect(centersAreEqual([1000, 2000], [1000, 2000], 0)).toBe(true);
    expect(centersAreEqual([1000, 2000], [1000.0001, 2000], 0)).toBe(false);
    expect(centersAreEqual([1000, 2000], [1000, 2000], -10)).toBe(true);
    expect(centersAreEqual([1000, 2000], [1000, 2000.0001], -10)).toBe(false);
  });
});

describe("resolutionsAreEqual", () => {
  it("treats a delta below 0.1% as equal", () => {
    expect(resolutionsAreEqual(1000, 1000.5)).toBe(true);
    expect(RESOLUTION_TOLERANCE_RATIO).toBe(0.001);
  });

  it("treats a delta above 0.1% as unequal", () => {
    expect(resolutionsAreEqual(1000, 1002)).toBe(false);
  });

  it("handles missing resolutions", () => {
    expect(resolutionsAreEqual(undefined, undefined)).toBe(true);
    expect(resolutionsAreEqual(1000, undefined)).toBe(false);
  });
});

describe("rotationsAreEqual", () => {
  it("treats a delta below 1e-6 radians as equal", () => {
    expect(rotationsAreEqual(0.5, 0.5 + 1e-7)).toBe(true);
    expect(ROTATION_TOLERANCE_RADIANS).toBe(1e-6);
  });

  it("treats a delta above 1e-6 radians as unequal", () => {
    expect(rotationsAreEqual(0.5, 0.5 + 1e-5)).toBe(false);
  });

  it("reads a missing rotation as zero", () => {
    expect(rotationsAreEqual(undefined, 0)).toBe(true);
    expect(rotationsAreEqual(undefined, 1)).toBe(false);
  });

  it("reads a missing rotation as zero on either side", () => {
    expect(rotationsAreEqual(0, undefined)).toBe(true);
    expect(rotationsAreEqual(1, undefined)).toBe(false);
    // Anything that is not a finite number reads as unrotated.
    expect(rotationsAreEqual(0, NaN)).toBe(true);
    expect(rotationsAreEqual(0, "0.5")).toBe(true);
  });
});

describe("viewsAreEqual", () => {
  const view = { center: [1000, 2000], resolution: 10, rotation: 0 };

  it("is true within every tolerance at once", () => {
    expect(
      viewsAreEqual(view, {
        center: [1004, 1996],
        resolution: 10.005,
        rotation: 5e-7,
      }),
    ).toBe(true);
  });

  it("is false when any single component is out of tolerance", () => {
    expect(viewsAreEqual(view, { ...view, center: [1006, 2000] })).toBe(false);
    expect(viewsAreEqual(view, { ...view, resolution: 10.5 })).toBe(false);
    expect(viewsAreEqual(view, { ...view, rotation: 1e-4 })).toBe(false);
  });

  it("handles null views", () => {
    expect(viewsAreEqual(null, null)).toBe(true);
    expect(viewsAreEqual(view, null)).toBe(false);
    expect(viewsAreEqual(null, view)).toBe(false);
  });

  it("falls back to the first view's resolution to size the tolerance", () => {
    // Neither view carries a usable resolution, so the fallback is taken and
    // the center tolerance collapses to zero: only an exact center matches.
    const a = { center: [1000, 2000], rotation: 0 };
    expect(viewsAreEqual(a, { center: [1000, 2000], rotation: 0 })).toBe(true);
    expect(viewsAreEqual(a, { center: [1000.5, 2000], rotation: 0 })).toBe(
      false,
    );
    // The same pair at a resolution wide enough to swallow that delta is
    // equal, which is what the missing resolution costs the comparison.
    expect(
      viewsAreEqual(
        { ...a, resolution: 10 },
        { center: [1000.5, 2000], rotation: 0, resolution: 10 },
      ),
    ).toBe(true);
  });
});

describe("readViewGroupSettings", () => {
  it("reads a legacy bare extent string", () => {
    expect(readViewGroupSettings("-100,40,5")).toEqual({
      extent: "-100,40,5",
      variable: null,
      viewGroup: null,
      isInitialExtent: false,
    });
  });

  it("reads the {extent} shape", () => {
    expect(readViewGroupSettings({ extent: "-100,40,5" })).toEqual({
      extent: "-100,40,5",
      variable: null,
      viewGroup: null,
      isInitialExtent: false,
    });
  });

  it("reads the {extent, variable} shape", () => {
    expect(
      readViewGroupSettings({ extent: "-100,40,5", variable: "Zoom To" }),
    ).toEqual({
      extent: "-100,40,5",
      variable: "Zoom To",
      viewGroup: null,
      isInitialExtent: false,
    });
  });

  it("reads the group name and initial-extent flag, normalized", () => {
    expect(
      readViewGroupSettings({
        extent: "-100,40,5",
        variable: "Zoom To",
        viewGroup: " Basin ",
        isGroupInitialExtent: true,
      }),
    ).toEqual({
      extent: "-100,40,5",
      variable: "Zoom To",
      viewGroup: "Basin",
      isInitialExtent: true,
    });
  });

  it("ignores an initial-extent flag with no group name", () => {
    expect(
      readViewGroupSettings({
        extent: "-100,40,5",
        viewGroup: "   ",
        isGroupInitialExtent: true,
      }),
    ).toEqual({
      extent: "-100,40,5",
      variable: null,
      viewGroup: null,
      isInitialExtent: false,
    });
  });

  it("unwraps the doubly nested extent shape", () => {
    expect(
      readViewGroupSettings({
        extent: {
          extent: "-100,40,5",
          variable: "Zoom To",
          viewGroup: "Basin",
          isGroupInitialExtent: true,
        },
      }),
    ).toEqual({
      extent: "-100,40,5",
      variable: "Zoom To",
      viewGroup: "Basin",
      isInitialExtent: true,
    });
  });

  it("returns empty settings for an absent or unusable value", () => {
    const empty = {
      extent: null,
      variable: null,
      viewGroup: null,
      isInitialExtent: false,
    };
    expect(readViewGroupSettings(undefined)).toEqual(empty);
    expect(readViewGroupSettings(null)).toEqual(empty);
    expect(readViewGroupSettings("")).toEqual(empty);
    expect(readViewGroupSettings(42)).toEqual(empty);
    expect(readViewGroupSettings({})).toEqual(empty);
  });
});

describe("parseSeedExtent", () => {
  it("reads the three-part form as a center and a zoom", () => {
    expect(parseSeedExtent("-105.5,40.2,7")).toEqual({
      type: "center",
      center: [-105.5, 40.2],
      zoom: 7,
    });
  });

  it("reads the four-part form as a bounding box", () => {
    expect(parseSeedExtent("-10,-20,30,40")).toEqual({
      type: "bbox",
      bbox: [-10, -20, 30, 40],
    });
  });

  it("tolerates surrounding and interior whitespace", () => {
    expect(parseSeedExtent("  0 , 0 , 5 ")).toEqual({
      type: "center",
      center: [0, 0],
      zoom: 5,
    });
  });

  it("seeds nothing from an extent still carrying a variable token", () => {
    // eslint-disable-next-line no-template-curly-in-string
    expect(parseSeedExtent("${SomeVariable}")).toBeNull();
    // eslint-disable-next-line no-template-curly-in-string
    expect(parseSeedExtent("${MinX},${MinY},${MaxX},${MaxY}")).toBeNull();
  });

  it("seeds nothing from an unusable extent", () => {
    expect(parseSeedExtent("")).toBeNull();
    expect(parseSeedExtent("   ")).toBeNull();
    expect(parseSeedExtent("0,0")).toBeNull();
    expect(parseSeedExtent("0,0,1,2,3")).toBeNull();
    expect(parseSeedExtent("0,0,nope")).toBeNull();
    expect(parseSeedExtent(null)).toBeNull();
    expect(parseSeedExtent(["0,0,5"])).toBeNull();
  });
});

describe("discoverGroupSeeds", () => {
  const gridItem = (overrides = {}) => ({
    source: "Map",
    args_string: JSON.stringify({
      map_extent: {
        extent: "0,0,5",
        viewGroup: "Basin",
        isGroupInitialExtent: true,
      },
    }),
    ...overrides,
  });

  const mapExtentItem = (mapExtent, overrides = {}) =>
    gridItem({
      args_string: JSON.stringify({ map_extent: mapExtent }),
      ...overrides,
    });

  it("finds the flagged member's seed on any tab", () => {
    const seeds = discoverGroupSeeds([
      { gridItems: [mapExtentItem({ extent: "1,2,3", viewGroup: "Other" })] },
      { gridItems: [gridItem()] },
    ]);
    expect(Array.from(seeds.keys())).toEqual(["Basin"]);
    expect(seeds.get("Basin")).toEqual({
      type: "center",
      center: [0, 0],
      zoom: 5,
    });
  });

  it("keeps the first flagged member in tab-then-grid order", () => {
    const seeds = discoverGroupSeeds([
      {
        gridItems: [
          mapExtentItem({
            extent: "10,20,6",
            viewGroup: "Basin",
            isGroupInitialExtent: true,
          }),
          mapExtentItem({
            extent: "30,40,7",
            viewGroup: "Basin",
            isGroupInitialExtent: true,
          }),
        ],
      },
      {
        gridItems: [
          mapExtentItem({
            extent: "50,60,8",
            viewGroup: "Basin",
            isGroupInitialExtent: true,
          }),
        ],
      },
    ]);
    expect(seeds.get("Basin")).toEqual({
      type: "center",
      center: [10, 20],
      zoom: 6,
    });
  });

  it("lets the winner claim the group even when its own extent seeds nothing", () => {
    // Otherwise which member seeds would depend on which one happens to be
    // parseable, which is not stable across an edit.
    const seeds = discoverGroupSeeds([
      {
        gridItems: [
          mapExtentItem({
            // eslint-disable-next-line no-template-curly-in-string
            extent: "${SomeVariable}",
            viewGroup: "Basin",
            isGroupInitialExtent: true,
          }),
          mapExtentItem({
            extent: "30,40,7",
            viewGroup: "Basin",
            isGroupInitialExtent: true,
          }),
        ],
      },
    ]);
    expect(seeds.has("Basin")).toBe(true);
    expect(seeds.get("Basin")).toBeNull();
  });

  it("ignores a plugin-supplied map carrying the flag", () => {
    const seeds = discoverGroupSeeds([
      { gridItems: [gridItem({ source: "my_plugin_map" })] },
    ]);
    expect(seeds.size).toBe(0);
  });

  it("ignores an unflagged or ungrouped member", () => {
    const seeds = discoverGroupSeeds([
      {
        gridItems: [
          mapExtentItem({ extent: "0,0,5", viewGroup: "Basin" }),
          mapExtentItem({ extent: "0,0,5", isGroupInitialExtent: true }),
        ],
      },
    ]);
    expect(seeds.size).toBe(0);
  });

  it("skips grid items whose args do not parse or carry no extent", () => {
    const seeds = discoverGroupSeeds([
      {
        gridItems: [
          null,
          gridItem({ args_string: "{not json" }),
          gridItem({ args_string: "" }),
          gridItem({ args_string: JSON.stringify({}) }),
          gridItem({ args_string: "42" }),
        ],
      },
    ]);
    expect(seeds.size).toBe(0);
  });

  it("returns an empty map for a missing or malformed tab list", () => {
    expect(discoverGroupSeeds(undefined).size).toBe(0);
    expect(discoverGroupSeeds([]).size).toBe(0);
    expect(discoverGroupSeeds([{}, { gridItems: null }]).size).toBe(0);
  });
});

describe("containsVariableToken", () => {
  it.each([
    // eslint-disable-next-line no-template-curly-in-string
    ["${bbox}", true],
    // A variable input name with spaces is the documented form, and used to
    // read as a literal extent to the editor's own `\\w+` tokenizer.
    // eslint-disable-next-line no-template-curly-in-string
    ["${Basin Extent}", true],
    // eslint-disable-next-line no-template-curly-in-string
    ["-1,2,${Basin Extent}", true],
    ["-1,2,3", false],
    ["", false],
    ["${}", false],
  ])("reads %s as templated: %s", (value, expected) => {
    expect(containsVariableToken(value)).toBe(expected);
  });

  it("is false for anything that is not a string", () => {
    expect(containsVariableToken(null)).toBe(false);
    expect(containsVariableToken(undefined)).toBe(false);
    // eslint-disable-next-line no-template-curly-in-string
    expect(containsVariableToken(["${x}"])).toBe(false);
  });
});

describe("clearViewGroupSettings", () => {
  it("hands back values that carry no group keys", () => {
    expect(clearViewGroupSettings("1,2,3")).toBe("1,2,3");
    expect(clearViewGroupSettings(null)).toBe(null);
    const plain = { extent: "1,2,3", variable: "Extent" };
    expect(clearViewGroupSettings(plain)).toBe(plain);
  });

  it("strips the group name and the flag off the flat shape", () => {
    expect(
      clearViewGroupSettings({
        extent: "1,2,3",
        variable: "Extent",
        viewGroup: "Basin",
        isGroupInitialExtent: true,
      }),
    ).toEqual({ extent: "1,2,3", variable: "Extent" });
  });

  it("strips them off the doubly nested legacy shape", () => {
    expect(
      clearViewGroupSettings({
        extent: {
          extent: "1,2,3",
          viewGroup: "Basin",
          isGroupInitialExtent: true,
        },
      }),
    ).toEqual({ extent: { extent: "1,2,3" } });
  });
});

// The reader tolerates the doubly nested `{extent: {extent, ...}}` shape, so
// the writers on the losing side of the single-flag rule have to as well: a
// member stored that way must actually give its flag up.
describe("the legacy doubly nested shape on a member losing its flag", () => {
  const nestedFlagged = () => ({
    extent: {
      extent: "-10686671.12,4721671.57,4.5",
      viewGroup: "Basin",
      isGroupInitialExtent: true,
    },
  });

  const nestedGridItem = (i) => ({
    i,
    source: "Map",
    args_string: JSON.stringify({
      map_extent: nestedFlagged(),
      baseMap: "OpenStreetMap",
    }),
  });

  it("clearGroupInitialExtent drops the nested flag and keeps the group", () => {
    expect(clearGroupInitialExtent(nestedFlagged())).toEqual({
      extent: {
        extent: "-10686671.12,4721671.57,4.5",
        viewGroup: "Basin",
      },
    });
  });

  it("clearGridItemGroupInitialExtent rewrites only the nested flag", () => {
    const gridItem = nestedGridItem("2");
    const cleared = clearGridItemGroupInitialExtent(gridItem);

    expect(cleared).not.toBe(gridItem);
    const args = JSON.parse(cleared.args_string);
    expect(args.baseMap).toBe("OpenStreetMap");
    expect(args.map_extent).toEqual({
      extent: {
        extent: "-10686671.12,4721671.57,4.5",
        viewGroup: "Basin",
      },
    });
    // Still a member of the group, just no longer its seed.
    expect(readViewGroupSettings(args.map_extent)).toEqual({
      extent: "-10686671.12,4721671.57,4.5",
      variable: null,
      viewGroup: "Basin",
      isInitialExtent: false,
    });
  });

  it("enforceSingleGroupInitialExtent clears a nested-shape loser", () => {
    const saved = {
      i: "1",
      source: "Map",
      args_string: JSON.stringify({
        map_extent: {
          extent: "-10686671.12,4721671.57,4.5",
          viewGroup: "Basin",
          isGroupInitialExtent: true,
        },
      }),
    };
    const loser = nestedGridItem("2");
    const tabs = [{ id: 1, name: "Tab 1", gridItems: [saved, loser] }];

    const result = enforceSingleGroupInitialExtent(tabs, "Basin", saved);
    const updatedLoser = result[0].gridItems[1];

    expect(updatedLoser).not.toBe(loser);
    expect(
      readViewGroupSettings(JSON.parse(updatedLoser.args_string).map_extent),
    ).toEqual({
      extent: "-10686671.12,4721671.57,4.5",
      variable: null,
      viewGroup: "Basin",
      isInitialExtent: false,
    });
    // The winner is untouched, by identity.
    expect(result[0].gridItems[0]).toBe(saved);
  });
});

describe("enforceSingleGroupInitialExtent", () => {
  const flaggedItem = (i) => ({
    i,
    source: "Map",
    args_string: JSON.stringify({
      map_extent: {
        extent: "0,0,5",
        viewGroup: "Basin",
        isGroupInitialExtent: true,
      },
    }),
  });

  it("leaves a tab carrying no grid items alone and sweeps the others", () => {
    const saved = flaggedItem("1");
    const loser = flaggedItem("2");
    // A tab may carry no `gridItems` at all, and a malformed one may carry
    // something that is not a list. Neither may throw, and neither may be
    // rewritten -- an untouched tab is handed back by identity.
    const missingTab = { id: 1, name: "Tab 1" };
    const malformedTab = { id: 2, name: "Tab 2", gridItems: null };
    const populatedTab = { id: 3, name: "Tab 3", gridItems: [saved, loser] };

    const result = enforceSingleGroupInitialExtent(
      [missingTab, malformedTab, populatedTab],
      "Basin",
      saved,
    );

    expect(result[0]).toBe(missingTab);
    expect(result[1]).toBe(malformedTab);
    expect(result[2].gridItems[0]).toBe(saved);
    expect(
      readViewGroupSettings(
        JSON.parse(result[2].gridItems[1].args_string).map_extent,
      ),
    ).toEqual({
      extent: "0,0,5",
      variable: null,
      viewGroup: "Basin",
      isInitialExtent: false,
    });
  });
});
