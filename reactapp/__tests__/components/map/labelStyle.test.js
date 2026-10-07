/* eslint-disable no-template-curly-in-string */
import Text from "ol/style/Text.js";
import Feature from "ol/Feature.js";
import Point from "ol/geom/Point.js";
import MultiPoint from "ol/geom/MultiPoint.js";
import LineString from "ol/geom/LineString.js";
import MultiLineString from "ol/geom/MultiLineString.js";
import Polygon from "ol/geom/Polygon.js";
import MultiPolygon from "ol/geom/MultiPolygon.js";
import {
  buildLabelStyle,
  resolveAnchor,
  resolveLabelText,
  resolveLabelGeometry,
  labelGeometryBucket,
  composeLabelFont,
  haloWidthForSize,
  LABEL_ANCHORS,
  LABEL_ANCHOR_OPTIONS,
  defaultLabelAnchor,
  defaultLabelColor,
  defaultLabelSize,
  defaultLabelHaloColor,
  defaultLabelHaloWidth,
  defaultLabelPadding,
  labelAnchorPadding,
  clearLabelTextCache,
  LABEL_TEXT_CACHE_LIMIT,
} from "components/map/labelStyle";

// Same shape as the helper in ModuleLoader.test.js -- OpenLayers is not mocked
// in this repo, so the style itself is real and asserted through real getters.
function mockFeature(props, geometryType = "Point") {
  return {
    getProperties: () => props,
    get: (key) => props[key],
    getGeometry: () => ({ getType: () => geometryType }),
  };
}

const labelOf = (overrides = {}) => ({
  template: "${feature.name}",
  ...overrides,
});

describe("resolveLabelText", () => {
  it("substitutes a single feature reference with that feature's value", () => {
    const feature = mockFeature({ name: "Station 12" });
    expect(resolveLabelText("${feature.name}", feature)).toBe("Station 12");
  });

  it("renders the literal remainder when the referenced key is missing", () => {
    const feature = mockFeature({ name: "Station 12" });
    expect(resolveLabelText("Gage ${feature.gage_id} (m)", feature)).toBe(
      "Gage  (m)",
    );
  });

  it("renders the present reference when a second reference is missing", () => {
    const feature = mockFeature({ name: "Station 12" });
    expect(resolveLabelText("${feature.name}${feature.missing}", feature)).toBe(
      "Station 12",
    );
  });

  it("preserves 0 and false rather than treating them as empty", () => {
    const feature = mockFeature({ stage: 0, active: false });
    expect(resolveLabelText("${feature.stage}", feature)).toBe("0");
    expect(resolveLabelText("${feature.active}", feature)).toBe("false");
  });

  it("renders a null value as empty, not as the string null", () => {
    const feature = mockFeature({ name: null });
    expect(resolveLabelText("[${feature.name}]", feature)).toBe("[]");
  });

  it("serializes an object or array value instead of throwing", () => {
    const feature = mockFeature({ meta: { a: 1 }, tags: ["x", "y"] });
    expect(resolveLabelText("${feature.meta}", feature)).toBe('{"a":1}');
    expect(resolveLabelText("${feature.tags}", feature)).toBe('["x","y"]');
  });

  it("coerces a template that arrived as a number", () => {
    const feature = mockFeature({ name: "Station 12" });
    expect(resolveLabelText(2024, feature)).toBe("2024");
  });

  it("returns empty for a feature that cannot answer getProperties", () => {
    expect(resolveLabelText("${feature.name}", {})).toBe("");
    expect(resolveLabelText("${feature.name}", null)).toBe("");
  });

  it("keeps a newline inside a value", () => {
    const feature = mockFeature({ name: "Upper\nBasin" });
    expect(resolveLabelText("${feature.name}", feature)).toBe("Upper\nBasin");
  });
});

describe("buildLabelStyle text resolution", () => {
  it("returns a Text whose text is the referenced attribute value", () => {
    const style = buildLabelStyle({
      labelConfig: labelOf(),
      feature: mockFeature({ name: "Station 12" }),
      resolution: 10,
    });
    expect(style).toBeInstanceOf(Text);
    expect(style.getText()).toBe("Station 12");
  });

  it("mixes literal text with a feature reference", () => {
    const style = buildLabelStyle({
      labelConfig: labelOf({ template: "Gage ${feature.gage_id}" }),
      feature: mockFeature({ gage_id: "11446500" }),
      resolution: 10,
    });
    expect(style.getText()).toBe("Gage 11446500");
  });

  it("returns a Text for a numeric template rather than throwing", () => {
    let style;
    expect(() => {
      style = buildLabelStyle({
        labelConfig: labelOf({ template: 2024 }),
        feature: mockFeature({ name: "Station 12" }),
        resolution: 10,
      });
    }).not.toThrow();
    expect(style).toBeInstanceOf(Text);
    expect(style.getText()).toBe("2024");
  });

  it("renders a very long value without truncating it", () => {
    const long = "A".repeat(500);
    const style = buildLabelStyle({
      labelConfig: labelOf(),
      feature: mockFeature({ name: long }),
      resolution: 10,
    });
    expect(style.getText()).toBe(long);
  });

  it("returns a label whose only resolvable reference is 0", () => {
    const style = buildLabelStyle({
      labelConfig: labelOf({ template: "${feature.stage}" }),
      feature: mockFeature({ stage: 0 }),
      resolution: 10,
    });
    expect(style).toBeInstanceOf(Text);
    expect(style.getText()).toBe("0");
  });
});

describe("buildLabelStyle returns nothing", () => {
  it("returns null for an absent label config", () => {
    const feature = mockFeature({ name: "Station 12" });
    expect(buildLabelStyle({ feature, resolution: 10 })).toBeNull();
    expect(
      buildLabelStyle({ labelConfig: null, feature, resolution: 10 }),
    ).toBeNull();
    expect(buildLabelStyle()).toBeNull();
  });

  it("returns null for an empty or whitespace-only template", () => {
    const feature = mockFeature({ name: "Station 12" });
    expect(
      buildLabelStyle({ labelConfig: labelOf({ template: "" }), feature }),
    ).toBeNull();
    expect(
      buildLabelStyle({ labelConfig: labelOf({ template: "   " }), feature }),
    ).toBeNull();
    expect(
      buildLabelStyle({ labelConfig: labelOf({ template: "\n\t" }), feature }),
    ).toBeNull();
  });

  it("returns null when every reference in the template resolves empty", () => {
    const style = buildLabelStyle({
      labelConfig: labelOf({ template: "${feature.missing}" }),
      feature: mockFeature({ name: "Station 12" }),
      resolution: 10,
    });
    expect(style).toBeNull();
  });

  it("returns null when a null-valued attribute is the whole template", () => {
    const style = buildLabelStyle({
      labelConfig: labelOf(),
      feature: mockFeature({ name: null }),
      resolution: 10,
    });
    expect(style).toBeNull();
  });
});

describe("buildLabelStyle zoom floor", () => {
  const feature = mockFeature({ name: "Station 12" });

  it("returns nothing when the resolution is above the floor", () => {
    const style = buildLabelStyle({
      labelConfig: labelOf(),
      feature,
      resolution: 100.1,
      minZoomResolution: 100,
    });
    expect(style).toBeNull();
  });

  it("returns a Text at the floor and below it", () => {
    const at = buildLabelStyle({
      labelConfig: labelOf(),
      feature,
      resolution: 100,
      minZoomResolution: 100,
    });
    expect(at).toBeInstanceOf(Text);
    const below = buildLabelStyle({
      labelConfig: labelOf(),
      feature,
      resolution: 9.5,
      minZoomResolution: 100,
    });
    expect(below).toBeInstanceOf(Text);
  });

  it("reads the floor only from the explicit resolution argument", () => {
    // `minZoom` is a zoom level; this function compares resolutions and never
    // converts. A zoom left on the config is not a floor here -- reading it
    // would compare a zoom level against a resolution.
    expect(
      buildLabelStyle({
        labelConfig: labelOf({ minZoom: 10 }),
        feature,
        resolution: 1e6,
      }),
    ).toBeInstanceOf(Text);
    expect(
      buildLabelStyle({
        labelConfig: labelOf({ minZoom: 10 }),
        feature,
        resolution: 50,
        minZoomResolution: 10,
      }),
    ).toBeNull();
  });

  it("ignores a floor that is not a finite number", () => {
    expect(
      buildLabelStyle({
        labelConfig: labelOf(),
        feature,
        resolution: 1e6,
        minZoomResolution: "",
      }),
    ).toBeInstanceOf(Text);
    expect(
      buildLabelStyle({
        labelConfig: labelOf(),
        feature,
        resolution: 1e6,
        minZoomResolution: "not a number",
      }),
    ).toBeInstanceOf(Text);
  });

  it("ignores the floor when no resolution was supplied", () => {
    expect(
      buildLabelStyle({
        labelConfig: labelOf(),
        feature,
        minZoomResolution: 10,
      }),
    ).toBeInstanceOf(Text);
  });
});

describe("resolveAnchor", () => {
  const expected = {
    center: ["center", "middle", 0, 0],
    n: ["center", "bottom", 0, -1],
    ne: ["left", "bottom", 1, -1],
    e: ["left", "middle", 1, 0],
    se: ["left", "top", 1, 1],
    s: ["center", "top", 0, 1],
    sw: ["right", "top", -1, 1],
    w: ["right", "middle", -1, 0],
    nw: ["right", "bottom", -1, -1],
  };

  it.each(Object.entries(expected))(
    "anchor %s resolves to the documented alignment, baseline and offsets",
    (anchor, [textAlign, textBaseline, signX, signY]) => {
      const resolved = resolveAnchor(anchor, 8);
      expect(resolved.textAlign).toBe(textAlign);
      expect(resolved.textBaseline).toBe(textBaseline);
      expect(resolved.offsetX).toBe(signX * 8);
      expect(resolved.offsetY).toBe(signY * 8);
    },
  );

  it("center returns zero offsets whatever the gap", () => {
    expect(resolveAnchor("center", 40)).toMatchObject({
      offsetX: 0,
      offsetY: 0,
    });
  });

  it("never uses the alphabetic or hanging baselines", () => {
    for (const spec of Object.values(LABEL_ANCHORS)) {
      expect(["top", "middle", "bottom"]).toContain(spec.textBaseline);
    }
    expect(LABEL_ANCHOR_OPTIONS).toHaveLength(9);
  });

  it("falls back to the default anchor for an unrecognized name", () => {
    expect(resolveAnchor("north-east", 8)).toEqual(
      resolveAnchor(defaultLabelAnchor, 8),
    );
    expect(resolveAnchor(undefined, 8)).toEqual(
      resolveAnchor(defaultLabelAnchor, 8),
    );
  });

  it("normalizes case and surrounding whitespace", () => {
    expect(resolveAnchor("  NE ", 8)).toEqual(resolveAnchor("ne", 8));
  });
});

describe("buildLabelStyle anchoring and symbol size", () => {
  const feature = mockFeature({ name: "Station 12" });

  it("applies the anchor to a point label", () => {
    const style = buildLabelStyle({
      labelConfig: labelOf({ anchor: "ne" }),
      feature,
      resolution: 10,
      symbolSize: 5,
    });
    expect(style.getTextAlign()).toBe("left");
    expect(style.getTextBaseline()).toBe("bottom");
    expect(style.getOffsetX()).toBe(5 + labelAnchorPadding);
    expect(style.getOffsetY()).toBe(-(5 + labelAnchorPadding));
  });

  it("gives a larger symbol a larger offset for the same anchor", () => {
    // One label configuration is served by one cached `Text`, so each result
    // is read before the next call overwrites the per-feature offsets on it.
    const small = buildLabelStyle({
      labelConfig: labelOf({ anchor: "e" }),
      feature,
      resolution: 10,
      symbolSize: 5,
    });
    const smallOffset = small.getOffsetX();
    const large = buildLabelStyle({
      labelConfig: labelOf({ anchor: "e" }),
      feature,
      resolution: 10,
      symbolSize: 20,
    });
    const largeOffset = large.getOffsetX();
    expect(smallOffset).toBe(5 + labelAnchorPadding);
    expect(largeOffset).toBe(20 + labelAnchorPadding);
    expect(largeOffset).toBeGreaterThan(smallOffset);
  });

  it("treats an absent, negative or non-numeric symbol size as zero", () => {
    for (const symbolSize of [undefined, -10, NaN, "wide"]) {
      const style = buildLabelStyle({
        labelConfig: labelOf({ anchor: "s" }),
        feature,
        resolution: 10,
        symbolSize,
      });
      expect(style.getOffsetY()).toBe(labelAnchorPadding);
    }
  });

  it("pads the point label box so decluttering has room to work", () => {
    const style = buildLabelStyle({
      labelConfig: labelOf(),
      feature,
      resolution: 10,
    });
    expect(style.getPadding()).toEqual(defaultLabelPadding);
  });
});

describe("buildLabelStyle placement by geometry", () => {
  it("uses line placement for a linestring and sets no point-only options", () => {
    const style = buildLabelStyle({
      labelConfig: labelOf({ anchor: "ne" }),
      feature: mockFeature({ name: "Reach 4" }, "LineString"),
      resolution: 10,
      symbolSize: 12,
    });
    expect(style.getPlacement()).toBe("line");
    // OpenLayers repurposes/ignores these under line placement.
    expect(style.getTextAlign()).toBeUndefined();
    expect(style.getOffsetX()).toBe(0);
    expect(style.getPadding()).toBeNull();
    expect(style.getOverflow()).toBe(false);
    // `offsetY` is the exception -- line placement honors it, and the label is
    // lifted clear of the stroke it would otherwise be drawn through. The lift
    // carries the caller's clearance (half the line's width) plus the padding.
    expect(style.getOffsetY()).toBe(-(12 + labelAnchorPadding));
  });

  it("uses line placement for a multilinestring", () => {
    const style = buildLabelStyle({
      labelConfig: labelOf(),
      feature: mockFeature({ name: "Reach 4" }, "MultiLineString"),
      resolution: 10,
    });
    expect(style.getPlacement()).toBe("line");
  });

  it("uses point placement with overflow for a polygon", () => {
    const style = buildLabelStyle({
      labelConfig: labelOf({ anchor: "center" }),
      feature: mockFeature({ name: "Basin A" }, "Polygon"),
      resolution: 10,
    });
    expect(style.getPlacement()).toBe("point");
    expect(style.getOverflow()).toBe(true);
    expect(style.getTextAlign()).toBe("center");
  });

  it("uses point placement with overflow for a multipolygon", () => {
    const style = buildLabelStyle({
      labelConfig: labelOf(),
      feature: mockFeature({ name: "Basin A" }, "MultiPolygon"),
      resolution: 10,
    });
    expect(style.getPlacement()).toBe("point");
    expect(style.getOverflow()).toBe(true);
  });

  it("uses point placement without overflow for a point", () => {
    const style = buildLabelStyle({
      labelConfig: labelOf(),
      feature: mockFeature({ name: "Station 12" }, "Point"),
      resolution: 10,
    });
    expect(style.getPlacement()).toBe("point");
    expect(style.getOverflow()).toBe(false);
  });

  it("falls back to point placement for an unrecognized geometry", () => {
    const style = buildLabelStyle({
      labelConfig: labelOf(),
      feature: mockFeature({ name: "Odd" }, "GeometryCollection"),
      resolution: 10,
    });
    expect(style.getPlacement()).toBe("point");
    expect(labelGeometryBucket(mockFeature({}, "Circle"))).toBe("point");
    expect(labelGeometryBucket({ getGeometry: () => null })).toBe("point");
    expect(labelGeometryBucket(null)).toBe("point");
  });

  it("honors an explicitly supplied geometry bucket over the feature's", () => {
    const style = buildLabelStyle({
      labelConfig: labelOf(),
      feature: mockFeature({ name: "Reach 4" }, "Point"),
      resolution: 10,
      geometryBucket: "linestring",
    });
    expect(style.getPlacement()).toBe("line");
  });
});

describe("buildLabelStyle font, color and halo", () => {
  const feature = mockFeature({ name: "Station 12" });

  it("composes the size into the font shorthand", () => {
    expect(composeLabelFont(20)).toBe("20px sans-serif");
    const style = buildLabelStyle({
      labelConfig: labelOf({ size: 20 }),
      feature,
      resolution: 10,
    });
    expect(style.getFont()).toBe("20px sans-serif");
  });

  it("falls back to the default size for a missing or unusable size", () => {
    for (const size of [undefined, null, "", 0, -4, "wide"]) {
      const style = buildLabelStyle({
        labelConfig: labelOf({ size }),
        feature,
        resolution: 10,
      });
      expect(style.getFont()).toBe(`${defaultLabelSize}px sans-serif`);
    }
  });

  it("accepts a size that arrived as a numeric string", () => {
    const style = buildLabelStyle({
      labelConfig: labelOf({ size: "18" }),
      feature,
      resolution: 10,
    });
    expect(style.getFont()).toBe("18px sans-serif");
  });

  it("uses the configured color and falls back to the default", () => {
    const configured = buildLabelStyle({
      labelConfig: labelOf({ color: "#ff0000" }),
      feature,
      resolution: 10,
    });
    expect(configured.getFill().getColor()).toBe("#ff0000");

    for (const color of [undefined, "", "   ", 5]) {
      const style = buildLabelStyle({
        labelConfig: labelOf({ color }),
        feature,
        resolution: 10,
      });
      expect(style.getFill().getColor()).toBe(defaultLabelColor);
    }
  });

  it("always draws a halo stroke behind the text", () => {
    for (const bucket of ["point", "linestring", "polygon"]) {
      const style = buildLabelStyle({
        labelConfig: labelOf(),
        feature,
        resolution: 10,
        geometryBucket: bucket,
      });
      expect(style.getStroke()).not.toBeNull();
      expect(style.getStroke().getColor()).toBe(defaultLabelHaloColor);
      expect(style.getStroke().getWidth()).toBeGreaterThan(0);
    }
  });

  it("scales the halo width with the font size", () => {
    expect(haloWidthForSize(defaultLabelSize)).toBe(defaultLabelHaloWidth);
    expect(haloWidthForSize(defaultLabelSize * 2)).toBeGreaterThan(
      defaultLabelHaloWidth,
    );
    // Never thinner than a pixel, or a small label has no outline at all.
    expect(haloWidthForSize(1)).toBe(1);
    expect(haloWidthForSize("nope")).toBe(defaultLabelHaloWidth);

    const big = buildLabelStyle({
      labelConfig: labelOf({ size: 30 }),
      feature,
      resolution: 10,
    });
    expect(big.getStroke().getWidth()).toBe(haloWidthForSize(30));
  });
});

describe("buildLabelStyle and the allow-overlap option", () => {
  // Whether a layer hides colliding labels is a layer-level decision made in
  // `map/Map.js`, which declines to declutter the layer at all. Nothing about
  // the option reaches the rendered Text; these pin that, so a future change
  // cannot quietly start shaping the label here without a test saying so.
  const base = { template: "${feature.name}", anchor: "ne", size: 14 };

  it("renders a point label identically with and without the option", () => {
    const without = buildLabelStyle({
      labelConfig: base,
      feature: mockFeature({ name: "Alpha" }),
      geometryBucket: "point",
    });
    const snapshot = {
      text: without.getText(),
      font: without.getFont(),
      align: without.getTextAlign(),
      baseline: without.getTextBaseline(),
      fill: without.getFill().getColor(),
      halo: without.getStroke().getColor(),
    };

    const withOverlap = buildLabelStyle({
      labelConfig: { ...base, allowOverlap: true },
      feature: mockFeature({ name: "Alpha" }),
      geometryBucket: "point",
    });

    expect({
      text: withOverlap.getText(),
      font: withOverlap.getFont(),
      align: withOverlap.getTextAlign(),
      baseline: withOverlap.getTextBaseline(),
      fill: withOverlap.getFill().getColor(),
      halo: withOverlap.getStroke().getColor(),
    }).toEqual(snapshot);
  });

  it("draws no background box either way", () => {
    // A box behind the text was tried as a way to keep the front label of a
    // colliding pair readable, and read worse than the halo alone.
    for (const allowOverlap of [true, false, undefined]) {
      const style = buildLabelStyle({
        labelConfig: { ...base, allowOverlap },
        feature: mockFeature({ name: "Alpha" }),
        geometryBucket: "point",
      });
      expect(style.getBackgroundFill()).toBeFalsy();
      expect(style.getBackgroundStroke()).toBeFalsy();
    }
  });
});

describe("resolveLabelGeometry", () => {
  it("returns undefined for single-part geometries", () => {
    expect(
      resolveLabelGeometry(new Feature({ geometry: new Point([0, 0]) })),
    ).toBeUndefined();
    expect(
      resolveLabelGeometry(
        new Feature({
          geometry: new LineString([
            [0, 0],
            [1, 1],
          ]),
        }),
      ),
    ).toBeUndefined();
    expect(
      resolveLabelGeometry(
        new Feature({
          geometry: new Polygon([
            [
              [0, 0],
              [0, 1],
              [1, 1],
              [1, 0],
              [0, 0],
            ],
          ]),
        }),
      ),
    ).toBeUndefined();
  });

  it("gives a multipolygon one label, on the largest part's interior point", () => {
    const small = [
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ],
    ];
    const large = [
      [
        [10, 10],
        [10, 20],
        [20, 20],
        [20, 10],
        [10, 10],
      ],
    ];
    const feature = new Feature({
      geometry: new MultiPolygon([small, large]),
    });

    const geometry = resolveLabelGeometry(feature);
    expect(geometry).toBeInstanceOf(Point);
    const [x, y] = geometry.getCoordinates();
    // Inside the large part, not the small one -- one label per feature.
    expect(x).toBeGreaterThan(10);
    expect(x).toBeLessThan(20);
    expect(y).toBeGreaterThan(10);
    expect(y).toBeLessThan(20);
  });

  it("gives a multilinestring one label, on its longest part", () => {
    const short = [
      [0, 0],
      [0, 1],
    ];
    const long = [
      [0, 0],
      [0, 100],
    ];
    const feature = new Feature({
      geometry: new MultiLineString([short, long]),
    });

    const geometry = resolveLabelGeometry(feature);
    expect(geometry).toBeInstanceOf(LineString);
    expect(geometry.getCoordinates()).toEqual(long);
  });

  it("gives a multipoint one label", () => {
    const feature = new Feature({
      geometry: new MultiPoint([
        [0, 0],
        [5, 5],
      ]),
    });
    const geometry = resolveLabelGeometry(feature);
    expect(geometry).toBeInstanceOf(Point);
    expect(geometry.getCoordinates()).toEqual([0, 0]);
  });

  it("returns undefined rather than throwing for empty or odd geometries", () => {
    expect(
      resolveLabelGeometry(new Feature({ geometry: new MultiPolygon([]) })),
    ).toBeUndefined();
    expect(
      resolveLabelGeometry(new Feature({ geometry: new MultiLineString([]) })),
    ).toBeUndefined();
    expect(
      resolveLabelGeometry(mockFeature({}, "MultiPolygon")),
    ).toBeUndefined();
    expect(resolveLabelGeometry(null)).toBeUndefined();
    expect(
      resolveLabelGeometry({
        getGeometry: () => {
          throw new Error("no geometry");
        },
      }),
    ).toBeUndefined();
  });
});

describe("buildLabelStyle never throws", () => {
  it("tolerates malformed configs and features", () => {
    const cases = [
      { labelConfig: "a string", feature: mockFeature({}) },
      { labelConfig: 7, feature: mockFeature({}) },
      { labelConfig: labelOf(), feature: undefined },
      { labelConfig: labelOf(), feature: {} },
      { labelConfig: labelOf({ template: {} }), feature: mockFeature({}) },
      {
        labelConfig: labelOf({ anchor: 42 }),
        feature: mockFeature({ name: "x" }),
      },
      {
        labelConfig: labelOf(),
        feature: {
          getProperties: () => {
            throw new Error("boom");
          },
          getGeometry: () => null,
        },
      },
    ];
    for (const args of cases) {
      expect(() => buildLabelStyle({ ...args, resolution: 10 })).not.toThrow();
    }
  });
});

// The style function this feeds runs for every feature in the viewport on every
// rebuild, so the `Text` and its `Fill`/`Stroke` are cached per label
// configuration and only the per-feature parts are written onto them.
describe("buildLabelStyle caches the Text per label configuration", () => {
  beforeEach(() => {
    clearLabelTextCache();
  });

  const build = (labelConfig, feature, symbolSize = 0) =>
    buildLabelStyle({ labelConfig, feature, resolution: 10, symbolSize });

  it("reuses one Text across features styled by the same configuration", () => {
    const labelConfig = labelOf();

    const first = build(labelConfig, mockFeature({ name: "Alpha" }));
    const second = build(labelConfig, mockFeature({ name: "Bravo" }));
    // A third call with a config object the author never re-created -- a
    // preserved layer restyled from a fresh render -- still lands on the same
    // entry, because the key is the configuration's values, not its identity.
    const third = build(labelOf(), mockFeature({ name: "Charlie" }));

    expect(second).toBe(first);
    expect(third).toBe(first);
    // Each call leaves the shared object holding that feature's own text.
    expect(third.getText()).toBe("Charlie");
  });

  it("does not share one Text between different label configurations", () => {
    const feature = mockFeature({ name: "Alpha", other: "Bravo" });
    const base = build(labelOf(), feature);

    const variants = [
      labelOf({ color: "#ff0000" }),
      labelOf({ size: 24 }),
      labelOf({ anchor: "ne" }),
      labelOf({ template: "${feature.other}" }),
    ];

    for (const labelConfig of variants) {
      expect(build(labelConfig, feature)).not.toBe(base);
    }
  });

  it("does not share one Text between geometry buckets", () => {
    const labelConfig = labelOf();
    const point = build(labelConfig, mockFeature({ name: "Alpha" }, "Point"));
    const line = build(
      labelConfig,
      mockFeature({ name: "Alpha" }, "LineString"),
    );
    const polygon = build(
      labelConfig,
      mockFeature({ name: "Alpha" }, "Polygon"),
    );

    // Line placement builds different options than point placement, and only
    // a polygon sets overflow, so one object cannot serve all three.
    expect(line).not.toBe(point);
    expect(polygon).not.toBe(point);
    expect(line.getPlacement()).toBe("line");
    expect(polygon.getOverflow()).toBe(true);
  });

  it("rewrites the per-feature parts on every call rather than leaving the last feature's", () => {
    const labelConfig = labelOf({ anchor: "e" });

    const large = build(labelConfig, mockFeature({ name: "Alpha" }), 20);
    expect(large.getText()).toBe("Alpha");
    expect(large.getOffsetX()).toBe(20 + labelAnchorPadding);

    const small = build(labelConfig, mockFeature({ name: "Bravo" }), 2);
    expect(small).toBe(large);
    expect(small.getText()).toBe("Bravo");
    expect(small.getOffsetX()).toBe(2 + labelAnchorPadding);
  });

  it("leaves no point offsets on a line label from an earlier point call", () => {
    // Buckets key separately, so this is belt and braces: the shared object is
    // left fully defined on every path rather than carrying a stale offset.
    const labelConfig = labelOf({ anchor: "ne" });
    const point = build(labelConfig, mockFeature({ name: "Alpha" }), 20);
    const pointOffsetY = point.getOffsetY();

    const line = build(
      labelConfig,
      mockFeature({ name: "Creek" }, "LineString"),
    );

    // The horizontal half of the anchor is dropped outright, and the vertical
    // half is replaced by the line's own lift rather than inherited.
    expect(line.getOffsetX()).toBe(0);
    expect(line.getOffsetY()).toBe(-labelAnchorPadding);
    expect(line.getOffsetY()).not.toBe(pointOffsetY);
  });

  it("returns null without disturbing the cached Text when a feature draws no label", () => {
    const labelConfig = labelOf();
    const drawn = build(labelConfig, mockFeature({ name: "Alpha" }));

    expect(build(labelConfig, mockFeature({}))).toBeNull();
    expect(
      buildLabelStyle({
        labelConfig,
        feature: mockFeature({ name: "Alpha" }),
        resolution: 500,
        minZoomResolution: 10,
      }),
    ).toBeNull();
    // The caller clears the text it attached on those paths -- nothing here
    // hands the empty feature the previous feature's object.
    expect(drawn.getText()).toBe("Alpha");
  });
});

describe("buildLabelStyle outline color", () => {
  const feature = () => mockFeature({ name: "Alpha" });

  it("uses the authored outline color", () => {
    const style = buildLabelStyle({
      labelConfig: { template: "${feature.name}", haloColor: "#102030" },
      feature: feature(),
      geometryBucket: "point",
    });

    expect(style.getStroke().getColor()).toBe("#102030");
  });

  it("falls back to the default when unset or blank", () => {
    for (const haloColor of [undefined, "", "   ", null, 42]) {
      const style = buildLabelStyle({
        labelConfig: { template: "${feature.name}", haloColor },
        feature: feature(),
        geometryBucket: "point",
      });
      expect(style.getStroke().getColor()).toBe(defaultLabelHaloColor);
    }
  });

  it("does not share one cached Text between two outline colors", () => {
    const dark = buildLabelStyle({
      labelConfig: { template: "${feature.name}", haloColor: "#000000" },
      feature: feature(),
      geometryBucket: "point",
    });
    const light = buildLabelStyle({
      labelConfig: { template: "${feature.name}", haloColor: "#ffffff" },
      feature: feature(),
      geometryBucket: "point",
    });

    expect(dark).not.toBe(light);
    expect(dark.getStroke().getColor()).toBe("#000000");
    expect(light.getStroke().getColor()).toBe("#ffffff");
  });

  it("still scales the outline width with the font size", () => {
    const small = buildLabelStyle({
      labelConfig: {
        template: "${feature.name}",
        haloColor: "#000000",
        size: 9,
      },
      feature: feature(),
      geometryBucket: "point",
    });
    const large = buildLabelStyle({
      labelConfig: {
        template: "${feature.name}",
        haloColor: "#000000",
        size: 26,
      },
      feature: feature(),
      geometryBucket: "point",
    });

    expect(large.getStroke().getWidth()).toBeGreaterThan(
      small.getStroke().getWidth(),
    );
  });
});

describe("line labels clear the stroke they are drawn along", () => {
  const lineLabel = (symbolSize, anchor = "n") =>
    buildLabelStyle({
      labelConfig: { template: "${feature.name}", anchor },
      feature: mockFeature({ name: "North Santiam" }, "LineString"),
      geometryBucket: "linestring",
      symbolSize,
    });

  it("lifts the label by the caller's clearance plus the padding", () => {
    expect(lineLabel(0).getOffsetY()).toBe(-labelAnchorPadding);
    expect(lineLabel(4).getOffsetY()).toBe(-(4 + labelAnchorPadding));
  });

  it("lifts a thicker line's label further", () => {
    // The symptom this exists for: text drawn centred on the path has the
    // stroke running through the glyphs, and a wider stroke covers more of
    // them. The lift has to track the width, not be a constant.
    expect(lineLabel(8).getOffsetY()).toBeLessThan(lineLabel(2).getOffsetY());
  });

  it("tolerates a missing or nonsense clearance", () => {
    for (const bad of [undefined, null, NaN, -5, "wide"]) {
      expect(lineLabel(bad).getOffsetY()).toBe(-labelAnchorPadding);
    }
  });
});

describe("a line label's side comes from the anchor", () => {
  const sideFor = (anchor) =>
    buildLabelStyle({
      labelConfig: { template: "${feature.name}", anchor },
      feature: mockFeature({ name: "North Santiam" }, "LineString"),
      geometryBucket: "linestring",
      symbolSize: 4,
    }).getOffsetY();

  const lift = 4 + labelAnchorPadding;

  it("puts a bottom-row anchor below the line", () => {
    for (const anchor of ["s", "se", "sw"]) {
      expect(sideFor(anchor)).toBe(lift);
    }
  });

  it("puts a top-row anchor above the line", () => {
    for (const anchor of ["n", "ne", "nw"]) {
      expect(sideFor(anchor)).toBe(-lift);
    }
  });

  it("draws the middle row along the line itself", () => {
    // Taken literally rather than rounded to a side: centred on the line is a
    // real style, the way a street map labels a road. `center` is the default
    // anchor, so a line layer starts here until its author picks a row.
    for (const anchor of ["center", "e", "w", undefined, "nonsense"]) {
      expect(sideFor(anchor)).toBe(0);
    }
  });

  it("keeps the horizontal half of the anchor out of it", () => {
    // OpenLayers drops offsetX under line placement; a left/right anchor must
    // not leak in as a horizontal shift that silently does nothing.
    for (const anchor of ["ne", "nw", "se", "sw"]) {
      const style = buildLabelStyle({
        labelConfig: { template: "${feature.name}", anchor },
        feature: mockFeature({ name: "Creek" }, "LineString"),
        geometryBucket: "linestring",
        symbolSize: 4,
      });
      expect(style.getOffsetX()).toBe(0);
    }
  });
});

describe("the render path never throws out of a feature", () => {
  // Both catches below exist for the same reason: these run inside the
  // OpenLayers style function, so an exception does not lose one label, it
  // takes down the whole layer's render.

  it("buckets a feature whose getGeometry throws as a point", () => {
    const hostile = {
      getGeometry() {
        throw new Error("geometry unavailable");
      },
    };

    expect(labelGeometryBucket(hostile)).toBe("point");
  });

  it("resolves empty text when the substituter throws", () => {
    // A template and a property bag that make substitution itself throw --
    // a getter that blows up when the substituter reads it.
    const hostile = {
      getProperties() {
        return Object.defineProperty({}, "name", {
          enumerable: true,
          get() {
            throw new Error("attribute unavailable");
          },
        });
      },
    };

    expect(resolveLabelText("${feature.name}", hostile)).toBe("");
  });

  it("resolves empty text when reading the properties throws", () => {
    const hostile = {
      getProperties() {
        throw new Error("properties unavailable");
      },
    };

    // The property read has its own catch: it falls through with undefined
    // properties, which the substituter then renders as an empty match.
    expect(typeof resolveLabelText("${feature.name}", hostile)).toBe("string");
  });
});

describe("resolveLabelGeometry picks one part of a multi-geometry", () => {
  const polygonOfArea = (area) => ({
    getArea: () => area,
    getInteriorPoint: () => `interior-${area}`,
  });

  it("takes the largest polygon, whichever order the parts arrive in", () => {
    // The label belongs on the mainland, not on whichever island the
    // coordinate list happens to start with.
    const firstBiggest = {
      getType: () => "MultiPolygon",
      getPolygons: () => [polygonOfArea(90), polygonOfArea(10)],
    };
    const lastBiggest = {
      getType: () => "MultiPolygon",
      getPolygons: () => [polygonOfArea(10), polygonOfArea(90)],
    };

    expect(resolveLabelGeometry({ getGeometry: () => firstBiggest })).toBe(
      "interior-90",
    );
    expect(resolveLabelGeometry({ getGeometry: () => lastBiggest })).toBe(
      "interior-90",
    );
  });

  it("takes the longest line, whichever order the parts arrive in", () => {
    const line = (length) => ({ getLength: () => length, id: length });
    const firstLongest = {
      getType: () => "MultiLineString",
      getLineStrings: () => [line(500), line(5)],
    };
    const lastLongest = {
      getType: () => "MultiLineString",
      getLineStrings: () => [line(5), line(500)],
    };

    // The shortest stub cannot fit the text under line placement, so labeling
    // it would drop the label entirely.
    expect(resolveLabelGeometry({ getGeometry: () => firstLongest }).id).toBe(
      500,
    );
    expect(resolveLabelGeometry({ getGeometry: () => lastLongest }).id).toBe(
      500,
    );
  });

  it("takes the first point of a multi-point", () => {
    const geometry = {
      getType: () => "MultiPoint",
      getPoint: (i) => `point-${i}`,
    };
    expect(resolveLabelGeometry({ getGeometry: () => geometry })).toBe(
      "point-0",
    );
  });

  it("returns undefined for an empty multi-geometry", () => {
    for (const geometry of [
      { getType: () => "MultiPolygon", getPolygons: () => [] },
      { getType: () => "MultiLineString", getLineStrings: () => [] },
    ]) {
      expect(
        resolveLabelGeometry({ getGeometry: () => geometry }),
      ).toBeUndefined();
    }
  });

  it("tolerates parts that do not answer the measurement calls", () => {
    // A RenderFeature from a vector tile source answers a narrower API than an
    // ol/geom instance; this must degrade rather than throw into the render.
    const geometry = {
      getType: () => "MultiPolygon",
      getPolygons: () => [{}, {}],
    };
    expect(
      resolveLabelGeometry({ getGeometry: () => geometry }),
    ).toBeUndefined();

    const lines = {
      getType: () => "MultiLineString",
      getLineStrings: () => [{ id: "a" }, { id: "b" }],
    };
    expect(resolveLabelGeometry({ getGeometry: () => lines }).id).toBe("a");
  });

  it("returns undefined when a multi-geometry cannot list its parts", () => {
    for (const type of ["MultiPolygon", "MultiLineString", "MultiPoint"]) {
      const geometry = { getType: () => type };
      expect(
        resolveLabelGeometry({ getGeometry: () => geometry }),
      ).toBeUndefined();
    }
  });
});

describe("resolveAnchor's distance guard", () => {
  it("treats a non-finite gap as no gap", () => {
    for (const distance of [NaN, Infinity, undefined, "wide"]) {
      // toBeCloseTo rather than toBe: a negative anchor sign times a zero gap
      // is -0, which Object.is separates from 0 and OpenLayers does not.
      expect(resolveAnchor("ne", distance).offsetX).toBeCloseTo(0);
      expect(resolveAnchor("ne", distance).offsetY).toBeCloseTo(0);
    }
  });
});

describe("the label text cache is bounded", () => {
  it("empties wholesale once it passes its cap", () => {
    // Key space is bounded by the configurations on screen, but a plugin that
    // rewrites its layer config on every fetch could walk it upward -- so the
    // cache is cleared rather than grown, unlike the geometry style cache
    // which is per style function and dies with it.
    clearLabelTextCache();
    const feature = mockFeature({ name: "Alpha" });

    const styleFor = (i) =>
      buildLabelStyle({
        labelConfig: { template: `label ${i} \${feature.name}` },
        feature,
        geometryBucket: "point",
      });

    const first = styleFor(0);
    // Re-asking for the same configuration hands back the same object, which
    // is what the cache is for.
    expect(styleFor(0)).toBe(first);

    for (let i = 1; i <= LABEL_TEXT_CACHE_LIMIT + 1; i += 1) styleFor(i);

    // Past the cap the cache was emptied, so the first configuration is built
    // afresh rather than served.
    expect(styleFor(0)).not.toBe(first);
  });

  it("keys a template that arrived as a non-string", () => {
    clearLabelTextCache();
    const feature = mockFeature({ name: "Alpha" });
    const numeric = buildLabelStyle({
      labelConfig: { template: 2026 },
      feature,
      geometryBucket: "point",
    });
    const absent = buildLabelStyle({
      labelConfig: { template: "2026" },
      feature,
      geometryBucket: "point",
    });

    // Both render the same literal, and String() keys them to one entry rather
    // than throwing on a template the layer props coerced to a number.
    expect(numeric.getText()).toBe("2026");
    expect(absent).toBe(numeric);
  });
});
