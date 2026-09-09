import {
  CENTER_TOLERANCE_PIXELS,
  RESOLUTION_TOLERANCE_RATIO,
  ROTATION_TOLERANCE_RADIANS,
  centersAreEqual,
  normalizeViewGroupName,
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
