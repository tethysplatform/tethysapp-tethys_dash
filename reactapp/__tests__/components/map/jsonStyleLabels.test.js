/* eslint-disable no-template-curly-in-string */
// Tests for the label half of the JSON rule-style engine: the per-feature text
// attached to styles that the engine's two caches hand out already built, and
// the symbol-geometry invariants that let a label and its symbol survive
// decluttering together.
//
// Separate from jsonStyle.test.js, which covers rule evaluation and style
// construction. These exercise the same `createJsonStyleFunction`, but what
// they assert about is the sharing: that nothing a cached style carries from
// one feature reaches the next.

import fs from "fs";
import path from "path";

import Feature from "ol/Feature";
import { LineString, MultiPolygon, Point, Polygon } from "ol/geom";
import { Fill, Stroke } from "ol/style";

import {
  applyLabelToStyle,
  buildPointStyle,
  createJsonStyleFunction,
  effectiveSymbolRadius,
  FALLBACK_ICON_IMAGE_SIZE,
  getGeometryBucket,
  ICON_SCALE_DIVISOR,
  SYMBOL_DECLUTTER_MODE,
} from "components/map/jsonStyle";
import {
  clearLabelTextCache,
  labelAnchorPadding,
  labelGeometryBucket,
} from "components/map/labelStyle";

const NAME_LABEL = {
  template: "${feature.name}",
  anchor: "e",
  size: 12,
  color: "#112233",
};

function pointFeature(properties) {
  return new Feature({ geometry: new Point([0, 0]), ...properties });
}

function styleList(result) {
  return Array.isArray(result) ? result : [result];
}

/** The geometry style is always first, labeled or not. */
function geometryStyleOf(result) {
  return styleList(result)[0];
}

/** The text actually drawn for this feature, wherever it ended up riding. */
function labelTextOf(result) {
  for (const style of styleList(result)) {
    const text = style.getText();
    if (text) return text.getText();
  }
  return undefined;
}

function textStyleOf(result) {
  for (const style of styleList(result)) {
    if (style.getText()) return style;
  }
  return undefined;
}

beforeEach(() => {
  // The `Text` cache in labelStyle is module-level and shared across suites.
  clearLabelTextCache();
});

describe("label attachment across every return path", () => {
  const POINT_STYLE = { default: { point: { fill: "#ff0000", size: 8 } } };

  it("attaches the label to a freshly built style", () => {
    const styleFn = createJsonStyleFunction(POINT_STYLE, NAME_LABEL);

    const result = styleFn(pointFeature({ name: "Alpha" }), 10);

    expect(labelTextOf(result)).toBe("Alpha");
    // Nothing was cached before this call, so it can only have come from the
    // build path.
    expect(styleFn.cachedStyleCount()).toBe(1);
    expect(styleFn.distinctStyleCount()).toBe(1);
  });

  it("attaches this feature's label on an input-keyed cache hit", () => {
    const styleFn = createJsonStyleFunction(POINT_STYLE, NAME_LABEL);

    const first = styleFn(pointFeature({ name: "Alpha" }), 10);
    const second = styleFn(pointFeature({ name: "Beta" }), 10);

    // `name` is not read by any rule, so both features build the same cache
    // key and the second call returns the first call's style object.
    expect(styleFn.cachedStyleCount()).toBe(1);
    expect(geometryStyleOf(second)).toBe(geometryStyleOf(first));
    expect(labelTextOf(second)).toBe("Beta");
  });

  it("attaches this feature's label on a shared-instance cache hit", () => {
    const styleFn = createJsonStyleFunction(
      {
        default: { point: { fill: "#ff0000", size: 8 } },
        rules: [
          {
            geometryType: "point",
            conditionField: "rank",
            conditionType: ">",
            conditionValue: 5,
            fill: "#00ff00",
          },
        ],
      },
      NAME_LABEL,
    );

    const first = styleFn(pointFeature({ name: "Alpha", rank: 10 }), 10);
    const second = styleFn(pointFeature({ name: "Beta", rank: 20 }), 10);

    // Different inputs -- so two entries in the input-keyed cache -- that
    // resolve to one style, which is the path under test.
    expect(styleFn.cachedStyleCount()).toBe(2);
    expect(styleFn.distinctStyleCount()).toBe(1);
    expect(geometryStyleOf(second)).toBe(geometryStyleOf(first));
    expect(labelTextOf(second)).toBe("Beta");
  });

  it("draws no text for a feature whose template resolves empty, after one that drew", () => {
    const styleFn = createJsonStyleFunction(POINT_STYLE, NAME_LABEL);

    const labeled = styleFn(pointFeature({ name: "Alpha" }), 10);
    expect(labelTextOf(labeled)).toBe("Alpha");

    const unlabeled = styleFn(pointFeature({ rank: 1 }), 10);

    // Same cache entry as the labeled feature, so the clear is the only thing
    // keeping "Alpha" off it.
    expect(geometryStyleOf(unlabeled)).toBe(geometryStyleOf(labeled));
    expect(Array.isArray(unlabeled)).toBe(false);
    expect(unlabeled.getText()).toBeUndefined();
    expect(unlabeled.getGeometry()).toBeUndefined();
  });

  it("drops the label on a shared-instance hit whose template resolves empty", () => {
    const styleFn = createJsonStyleFunction(
      {
        default: { point: { size: 8 } },
        rules: [
          {
            geometryType: "point",
            conditionField: "rank",
            conditionType: ">",
            conditionValue: 5,
            fill: "#00ff00",
          },
        ],
      },
      NAME_LABEL,
    );

    const labeled = styleFn(pointFeature({ name: "Alpha", rank: 10 }), 10);
    expect(labelTextOf(labeled)).toBe("Alpha");

    const unlabeled = styleFn(pointFeature({ rank: 20 }), 10);

    expect(styleFn.distinctStyleCount()).toBe(1);
    expect(geometryStyleOf(unlabeled)).toBe(geometryStyleOf(labeled));
    expect(labelTextOf(unlabeled)).toBeUndefined();
  });

  it("hides the label below its zoom floor and shows it again above", () => {
    const styleFn = createJsonStyleFunction(POINT_STYLE, {
      ...NAME_LABEL,
      minZoomResolution: 100,
    });

    // Zoomed out past the floor: a bigger resolution is a smaller zoom.
    const far = styleFn(pointFeature({ name: "Alpha" }), 500);
    expect(labelTextOf(far)).toBeUndefined();

    const near = styleFn(pointFeature({ name: "Alpha" }), 50);
    expect(labelTextOf(near)).toBe("Alpha");
  });

  it("returns a bare style when the layer carries no label config", () => {
    const styleFn = createJsonStyleFunction(POINT_STYLE);

    const result = styleFn(pointFeature({ name: "Alpha" }), 10);

    expect(Array.isArray(result)).toBe(false);
    expect(result.getText()).toBeUndefined();
  });
});

describe("label-only layers", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    // The style function is reached with whatever the layer config held --
    // including a style URL whose fetch failed.
    ["a style URL string", "https://example.com/style.json"],
  ])("builds a style from %s styleJson and still labels it", (_name, json) => {
    const styleFn = createJsonStyleFunction(json, NAME_LABEL);

    const result = styleFn(pointFeature({ name: "Alpha" }), 10);

    expect(labelTextOf(result)).toBe("Alpha");
    // The default symbol is still drawn, so the label has something to sit by.
    expect(geometryStyleOf(result).getImage()).toBeTruthy();
  });

  it("does not throw for a line or polygon feature with no style rules", () => {
    const styleFn = createJsonStyleFunction(null, NAME_LABEL);

    const line = new Feature({
      geometry: new LineString([
        [0, 0],
        [10, 10],
      ]),
      name: "Creek",
    });
    const polygon = new Feature({
      geometry: new Polygon([
        [
          [0, 0],
          [0, 5],
          [5, 5],
          [0, 0],
        ],
      ]),
      name: "Basin",
    });

    expect(labelTextOf(styleFn(line, 10))).toBe("Creek");
    expect(labelTextOf(styleFn(polygon, 10))).toBe("Basin");
  });
});

describe("where the label rides", () => {
  it("splits a symbol and its label into two styles", () => {
    const styleFn = createJsonStyleFunction(
      { default: { point: { size: 8 } } },
      NAME_LABEL,
    );

    const result = styleFn(pointFeature({ name: "Alpha" }), 10);

    // One Style carrying both would be decluttered as a pair, and a collision
    // would drop the symbol along with the text.
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0].getImage()).toBeTruthy();
    expect(result[0].getText()).toBeUndefined();
    expect(result[1].getText().getText()).toBe("Alpha");
  });

  it("rides on the geometry style for a single-part polygon", () => {
    const styleFn = createJsonStyleFunction(
      { default: { polygon: { fill: "#ff0000" } } },
      NAME_LABEL,
    );

    const feature = new Feature({
      geometry: new Polygon([
        [
          [0, 0],
          [0, 10],
          [10, 10],
          [10, 0],
          [0, 0],
        ],
      ]),
      name: "Basin",
    });

    const result = styleFn(feature, 10);

    expect(Array.isArray(result)).toBe(false);
    expect(result.getText().getText()).toBe("Basin");
    // No override: OpenLayers picks the interior point on its own.
    expect(result.getGeometry()).toBeUndefined();
  });

  it("puts a multi-part label on a second style so the fill still draws", () => {
    const styleFn = createJsonStyleFunction(
      { default: { polygon: { fill: "#ff0000" } } },
      NAME_LABEL,
    );

    const feature = new Feature({
      geometry: new MultiPolygon([
        [
          [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
            [0, 0],
          ],
        ],
        [
          [
            [10, 10],
            [10, 20],
            [20, 20],
            [20, 10],
            [10, 10],
          ],
        ],
      ]),
      name: "Islands",
    });

    const result = styleFn(feature, 10);

    expect(Array.isArray(result)).toBe(true);
    // The single-part geometry must not land on the style that draws the fill.
    expect(result[0].getGeometry()).toBeUndefined();
    expect(result[0].getFill()).toBeTruthy();
    expect(result[1].getText().getText()).toBe("Islands");
    expect(result[1].getGeometry().getType()).toBe("Point");
  });

  it("clears the label geometry for a single-part feature sharing the entry", () => {
    const styleFn = createJsonStyleFunction(
      { default: { polygon: { fill: "#ff0000" } } },
      NAME_LABEL,
    );

    const multi = new Feature({
      geometry: new MultiPolygon([
        [
          [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
            [0, 0],
          ],
        ],
      ]),
      name: "Islands",
    });
    const single = new Feature({
      geometry: new Polygon([
        [
          [0, 0],
          [0, 5],
          [5, 5],
          [0, 0],
        ],
      ]),
      name: "Basin",
    });

    styleFn(multi, 10);
    const result = styleFn(single, 10);

    expect(Array.isArray(result)).toBe(false);
    expect(result.getGeometry()).toBeUndefined();
    expect(result.getText().getText()).toBe("Basin");
  });
});

describe("symbol declutter mode", () => {
  // The shapes `buildPointStyle` switches on, read out of the source rather
  // than listed by hand: a shape added without a declutter mode would
  // otherwise slip past this suite the way the two canvas-icon helpers slipped
  // past the previous attempt. The slice is bounded by the function's own
  // body so the other switches in the module cannot contribute cases.
  const source = fs.readFileSync(
    path.join(__dirname, "../../../components/map/jsonStyle.js"),
    "utf8",
  );
  const body = source.slice(
    source.indexOf("export function buildPointStyle("),
    source.indexOf("export const ICON_SCALE_DIVISOR"),
  );
  const shapes = [...body.matchAll(/^\s*case "([^"]+)":$/gm)].map(
    (match) => match[1],
  );

  // The canvas-drawn shapes need a 2D context jsdom does not provide.
  let restoreGetContext;

  beforeEach(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      fillStyle: null,
      strokeStyle: null,
      lineWidth: null,
      translate: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      fill: jest.fn(),
      stroke: jest.fn(),
    }));
    restoreGetContext = () => {
      HTMLCanvasElement.prototype.getContext = original;
    };
  });

  afterEach(() => {
    restoreGetContext();
  });

  it("found the shape set in the source", () => {
    expect(shapes).toEqual([
      "circle",
      "square",
      "rectangle",
      "triangle",
      "star",
      "diamond",
      "trapezoid",
      "cross",
      "x",
      "icon",
    ]);
  });

  // Plus the two fallbacks: an unknown shape, and "icon" with no URL.
  it.each([
    ...shapes.map((shape) => [shape, "https://example.com/pin.png"]),
    ["icon", null],
    ["something-unknown", null],
  ])("builds %s with declutter mode none", (shape, iconUrl) => {
    const style = buildPointStyle(
      shape,
      10,
      new Fill({ color: "#ff0000" }),
      new Stroke({ color: "#000000", width: 1 }),
      iconUrl,
    );

    // A decluttered symbol is dropped from the declutter-aware hit test as
    // well as from the canvas, so this is what keeps a labeled point layer
    // clickable.
    expect(style.getImage().getDeclutterMode()).toBe(SYMBOL_DECLUTTER_MODE);
    expect(style.getImage().getDeclutterMode()).toBe("none");
  });
});

describe("effectiveSymbolRadius", () => {
  const loadedIcon = (width, height) => ({
    getSrc: () => "https://example.com/pin.png",
    getWidth: () => width,
    getHeight: () => height,
  });

  it("returns the authored size for a shape whose size is a radius", () => {
    expect(effectiveSymbolRadius("circle", 12)).toBe(12);
    expect(effectiveSymbolRadius("star", "9")).toBe(9);
    expect(effectiveSymbolRadius("trapezoid", 20)).toBe(20);
  });

  it("returns zero for an unusable size", () => {
    expect(effectiveSymbolRadius("circle", undefined)).toBe(0);
    expect(effectiveSymbolRadius("circle", "wide")).toBe(0);
    expect(effectiveSymbolRadius("circle", -4)).toBe(0);
  });

  it("returns the authored size for an icon shape that fell back to a circle", () => {
    // No `getSrc`: `buildPointStyle` substituted a CircleStyle of that radius.
    expect(effectiveSymbolRadius("icon", 12, { getRadius: () => 12 })).toBe(12);
    expect(effectiveSymbolRadius("icon", 12, null)).toBe(12);
  });

  it("measures a loaded icon's rendered box rather than its scale factor", () => {
    // size 40 is `scale: 4`, not a 40px radius.
    expect(effectiveSymbolRadius("icon", 40, loadedIcon(128, 128))).toBe(64);
    // The larger axis, halved.
    expect(effectiveSymbolRadius("icon", 40, loadedIcon(40, 128))).toBe(64);
  });

  it("estimates from the fallback image size while the icon is loading", () => {
    const estimate = (FALLBACK_ICON_IMAGE_SIZE / 2) * (40 / ICON_SCALE_DIVISOR);

    expect(
      effectiveSymbolRadius("icon", 40, loadedIcon(undefined, undefined)),
    ).toBe(estimate);
    expect(effectiveSymbolRadius("icon", 40, loadedIcon(0, 0))).toBe(estimate);
    // Never the scale factor itself, which is what this replaces.
    expect(estimate).not.toBe(40);
  });

  it("estimates rather than throwing when the image cannot be measured", () => {
    const hostile = {
      getSrc: () => "https://example.com/pin.png",
      getWidth: () => {
        throw new Error("mid-update");
      },
      getHeight: () => 64,
    };

    expect(effectiveSymbolRadius("icon", 40, hostile)).toBe(
      (FALLBACK_ICON_IMAGE_SIZE / 2) * (40 / ICON_SCALE_DIVISOR),
    );
  });
});

describe("the anchor gap", () => {
  it("clears a circle of the feature's own resolved size", () => {
    const styleFn = createJsonStyleFunction(
      { default: { point: { shape: "circle", size: 20 } } },
      NAME_LABEL,
    );

    const result = styleFn(pointFeature({ name: "Alpha" }), 10);

    expect(textStyleOf(result).getText().getOffsetX()).toBe(
      20 + labelAnchorPadding,
    );
  });

  it("offsets an icon label by a real radius, not by the scale factor", () => {
    const styleFn = createJsonStyleFunction(
      {
        default: {
          point: {
            shape: "icon",
            size: 40,
            iconUrl: "https://example.com/pin.png",
          },
        },
      },
      NAME_LABEL,
    );

    const result = styleFn(pointFeature({ name: "Alpha" }), 10);
    const image = geometryStyleOf(result).getImage();
    const offsetX = textStyleOf(result).getText().getOffsetX();

    expect(offsetX).toBe(
      effectiveSymbolRadius("icon", 40, image) + labelAnchorPadding,
    );
    // `size: 40` means `scale: 4` here. Treating it as a 40px radius -- the
    // bug this replaces -- would park the label four icon-widths away.
    expect(offsetX).not.toBe(40 + labelAnchorPadding);
  });

  it("keeps the gap per feature when a rule drives the size", () => {
    const styleFn = createJsonStyleFunction(
      {
        default: { point: { shape: "circle", size: 5 } },
        rules: [
          {
            geometryType: "point",
            conditionField: "rank",
            conditionType: ">",
            conditionValue: 1,
            size: 30,
          },
        ],
      },
      NAME_LABEL,
    );

    // Read before the next call: the `Text` is shared across features and
    // carries only the offsets written for the feature last styled.
    const small = styleFn(pointFeature({ name: "Alpha", rank: 0 }), 10);
    const smallOffset = textStyleOf(small).getText().getOffsetX();
    const large = styleFn(pointFeature({ name: "Beta", rank: 9 }), 10);
    const largeOffset = textStyleOf(large).getText().getOffsetX();

    expect(smallOffset).toBe(5 + labelAnchorPadding);
    expect(largeOffset).toBe(30 + labelAnchorPadding);
  });

  it("resolves the same gap on a cache hit as on the build", () => {
    const styleFn = createJsonStyleFunction(
      { default: { point: { shape: "circle", size: 20 } } },
      NAME_LABEL,
    );

    const built = styleFn(pointFeature({ name: "Alpha" }), 10);
    const builtOffset = textStyleOf(built).getText().getOffsetX();
    const cached = styleFn(pointFeature({ name: "Beta" }), 10);

    expect(styleFn.cachedStyleCount()).toBe(1);
    expect(textStyleOf(cached).getText().getOffsetX()).toBe(builtOffset);
  });
});

describe("geometry bucket consolidation", () => {
  it("exports one implementation under both names", () => {
    expect(getGeometryBucket).toBe(labelGeometryBucket);
  });

  it("tolerates a feature carrying no geometry", () => {
    expect(getGeometryBucket(new Feature({}))).toBe("point");
    expect(getGeometryBucket(undefined)).toBe("point");
  });
});

describe("applyLabelToStyle", () => {
  it("clears a style it decides not to label", () => {
    const styleFn = createJsonStyleFunction(
      { default: { polygon: { fill: "#ff0000" } } },
      NAME_LABEL,
    );
    const feature = new Feature({
      geometry: new Polygon([
        [
          [0, 0],
          [0, 5],
          [5, 5],
          [0, 0],
        ],
      ]),
      name: "Basin",
    });

    const labeled = styleFn(feature, 10);
    expect(labeled.getText()).toBeTruthy();

    // Re-run the attach with no label configuration at all, as an unlabeled
    // layer sharing this style object would.
    const result = applyLabelToStyle(labeled, { feature, resolution: 10 });

    expect(result).toBe(labeled);
    expect(result.getText()).toBeUndefined();
  });
});
