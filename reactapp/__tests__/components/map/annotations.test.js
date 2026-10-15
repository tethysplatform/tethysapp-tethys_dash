import Feature from "ol/Feature.js";
import LineString from "ol/geom/LineString.js";
import Point from "ol/geom/Point.js";
import { get as getProjection } from "ol/proj.js";
import { register } from "ol/proj/proj4.js";
import proj4 from "proj4";
import {
  annotationLabel,
  defaultAnnotationStyle,
  featuresToItems,
  isArrowItem,
  isDrawableItem,
  itemsToFeatures,
  newAnnotationItem,
  nextAnnotationId,
  normalizeAnnotations,
  reprojectAnnotationFeatures,
  resetAnnotationOverride,
  resolveAnnotationDefaults,
  resolveAnnotationStyle,
  normalizeRotation,
} from "components/map/annotations";

// A real, non-3857 projected CRS: Oregon North state plane (ft).
proj4.defs(
  "EPSG:2269",
  "+proj=lcc +lat_0=43.6666666666667 +lon_0=-120.5 +lat_1=46 +lat_2=44.3333333333333 +x_0=2500000.0001424 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=ft +no_defs",
);
register(proj4);

const line = {
  id: "a1",
  kind: "line",
  coordinates: [
    [-123.1, 44.05],
    [-123.0, 44.1],
    [-122.9, 44.12],
  ],
};
const text = {
  id: "a2",
  kind: "text",
  coordinates: [-123.05, 44.0],
  text: "Gauge 1",
};

describe("resolveAnnotationStyle", () => {
  it("lets an override win while the default changes underneath it", () => {
    const override = { lineColor: "red" };
    expect(
      resolveAnnotationStyle({ lineColor: "black" }, override).lineColor,
    ).toBe("red");
    expect(
      resolveAnnotationStyle({ lineColor: "black" }, undefined).lineColor,
    ).toBe("black");

    // The default changes: un-overridden items follow, the override holds.
    expect(
      resolveAnnotationStyle({ lineColor: "blue" }, undefined).lineColor,
    ).toBe("blue");
    expect(
      resolveAnnotationStyle({ lineColor: "blue" }, override).lineColor,
    ).toBe("red");
  });

  it("overrides only the properties an item sets", () => {
    const resolved = resolveAnnotationStyle(
      { lineColor: "black", lineWidth: 4, textColor: "green" },
      { textSize: 20 },
    );
    expect(resolved).toEqual({
      ...defaultAnnotationStyle,
      lineColor: "black",
      lineWidth: 4,
      textColor: "green",
      textSize: 20,
    });
  });

  it("fills a missing or partial default from the built-in defaults", () => {
    expect(resolveAnnotationDefaults(undefined)).toEqual(
      defaultAnnotationStyle,
    );
    expect(resolveAnnotationDefaults({ lineWidth: 5 })).toEqual({
      ...defaultAnnotationStyle,
      lineWidth: 5,
    });
  });

  it("treats invalid values as unset", () => {
    const resolved = resolveAnnotationStyle(
      {
        lineWidth: -2,
        lineColor: "",
        textAnchor: "upward",
        arrowheads: "sideways",
      },
      { textSize: "big", arrowheads: "both" },
    );
    expect(resolved.lineWidth).toBe(defaultAnnotationStyle.lineWidth);
    expect(resolved.lineColor).toBe(defaultAnnotationStyle.lineColor);
    expect(resolved.textAnchor).toBe(defaultAnnotationStyle.textAnchor);
    expect(resolved.textSize).toBe(defaultAnnotationStyle.textSize);
    expect(resolved.arrowheads).toBe("both");
  });

  it("does not accept 'none' as a layer default, only as an item override", () => {
    expect(resolveAnnotationDefaults({ arrowheads: "none" }).arrowheads).toBe(
      "end",
    );
    expect(resolveAnnotationStyle({}, { arrowheads: "none" }).arrowheads).toBe(
      "none",
    );
  });
});

describe("newAnnotationItem (lines stay lines)", () => {
  it("pins a Line tool item to no arrowheads", () => {
    const item = newAnnotationItem("line", line.coordinates, []);
    expect(item).toEqual({
      id: "a1",
      kind: "line",
      coordinates: line.coordinates,
      style: { arrowheads: "none" },
    });
  });

  it("leaves an Arrow tool item to follow the layer default", () => {
    const item = newAnnotationItem("arrow", line.coordinates, []);
    expect(item.style).toBeUndefined();
    expect(isArrowItem(item, { arrowheads: "both" })).toBe(true);
  });

  it("keeps a plain line a line when the default arrowheads change", () => {
    const plain = newAnnotationItem("line", line.coordinates, []);
    for (const arrowheads of ["start", "end", "both"]) {
      expect(isArrowItem(plain, { arrowheads })).toBe(false);
    }
  });

  it("creates a text item with its text", () => {
    expect(newAnnotationItem("text", [1, 2], [line], "Hi")).toEqual({
      id: "a2",
      kind: "text",
      coordinates: [1, 2],
      text: "Hi",
    });
  });
});

describe("ids, labels and override reset", () => {
  it("numbers ids past the highest existing one", () => {
    expect(nextAnnotationId([])).toBe("a1");
    expect(
      nextAnnotationId([{ id: "a3" }, { id: "a1" }, { id: "other" }]),
    ).toBe("a4");
  });

  it("labels lines and arrows by creation order within their kind", () => {
    const items = [
      { id: "a1", kind: "line", coordinates: line.coordinates },
      {
        id: "a2",
        kind: "line",
        coordinates: line.coordinates,
        style: { arrowheads: "none" },
      },
      { id: "a3", kind: "line", coordinates: line.coordinates },
      text,
    ];
    expect(annotationLabel(items[0], items, {})).toBe("Arrow 1");
    expect(annotationLabel(items[1], items, {})).toBe("Line 1");
    expect(annotationLabel(items[2], items, {})).toBe("Arrow 2");
    expect(annotationLabel(text, items, {})).toBe("Text: Gauge 1");
    expect(annotationLabel({ ...text, text: "  " }, items, {})).toBe(
      "Text (empty)",
    );
  });

  it("removes one override and drops an empty style", () => {
    const item = { ...line, style: { lineColor: "red", lineWidth: 5 } };
    expect(resetAnnotationOverride(item, "lineColor").style).toEqual({
      lineWidth: 5,
    });
    const cleared = resetAnnotationOverride(
      { ...line, style: { lineColor: "red" } },
      "lineColor",
    );
    expect(cleared).not.toHaveProperty("style");
    expect(resetAnnotationOverride(line, "lineColor")).toBe(line);
  });
});

describe("normalizeAnnotations and isDrawableItem", () => {
  it("fills missing keys", () => {
    expect(normalizeAnnotations(undefined)).toEqual({
      defaults: {},
      items: [],
    });
    expect(normalizeAnnotations({ items: "nope" })).toEqual({
      defaults: {},
      items: [],
    });
  });

  it("rejects items without enough geometry", () => {
    expect(isDrawableItem(line)).toBe(true);
    expect(isDrawableItem(text)).toBe(true);
    expect(isDrawableItem({ kind: "line", coordinates: [[1, 2]] })).toBe(false);
    expect(isDrawableItem({ kind: "line", coordinates: null })).toBe(false);
    expect(isDrawableItem({ kind: "text", coordinates: [1] })).toBe(false);
    expect(isDrawableItem({ kind: "circle", coordinates: [1, 2] })).toBe(false);
    expect(isDrawableItem(null)).toBe(false);
  });
});

describe("itemsToFeatures / featuresToItems", () => {
  it.each(["EPSG:3857", "EPSG:2269"])(
    "round-trips edited geometry through %s within precision",
    (viewProjection) => {
      expect(getProjection(viewProjection)).toBeTruthy();
      const features = itemsToFeatures([line, text], viewProjection);
      expect(features).toHaveLength(2);

      // Touch every geometry so the write-back goes through the projection.
      features.forEach((f) => f.getGeometry().changed());
      const items = featuresToItems(features, viewProjection);

      expect(items[0].id).toBe("a1");
      items[0].coordinates.forEach((c, i) => {
        expect(c[0]).toBeCloseTo(line.coordinates[i][0], 6);
        expect(c[1]).toBeCloseTo(line.coordinates[i][1], 6);
      });
      expect(items[1].coordinates[0]).toBeCloseTo(text.coordinates[0], 6);
      expect(items[1].text).toBe("Gauge 1");
    },
  );

  it("writes untouched items back exactly as stored", () => {
    const stored = { ...line, style: { lineColor: "red" } };
    const features = itemsToFeatures([stored, text], "EPSG:2269");
    expect(featuresToItems(features, "EPSG:2269")).toEqual([stored, text]);
  });

  it("keeps untouched items exact across a view projection swap", () => {
    const features = itemsToFeatures([line], "EPSG:3857");
    reprojectAnnotationFeatures(features, "EPSG:3857", "EPSG:2269");
    expect(featuresToItems(features, "EPSG:2269")).toEqual([line]);
  });

  it("writes an edit made after a projection swap in the new projection", () => {
    const features = itemsToFeatures([text], "EPSG:3857");
    reprojectAnnotationFeatures(features, "EPSG:3857", "EPSG:2269");
    const point = features[0].getGeometry();
    const [x, y] = point.getCoordinates();
    point.setCoordinates([x + 5280, y]); // one mile east
    const [item] = featuresToItems(features, "EPSG:2269");
    expect(item.coordinates[0]).toBeGreaterThan(text.coordinates[0]);
    expect(item.coordinates[1]).toBeCloseTo(text.coordinates[1], 3);
  });

  it("skips items that cannot be drawn", () => {
    const features = itemsToFeatures(
      [line, { id: "bad", kind: "line", coordinates: [[0, 0]] }],
      "EPSG:3857",
    );
    expect(features.map((f) => f.getId())).toEqual(["a1"]);
  });

  it("carries the id, kind, text and overrides on the feature", () => {
    const [feature] = itemsToFeatures(
      [{ ...text, style: { textSize: 18 } }],
      "EPSG:3857",
    );
    expect(feature.get("annotationId")).toBe("a2");
    expect(feature.get("annotationKind")).toBe("text");
    expect(feature.get("annotationText")).toBe("Gauge 1");
    expect(feature.get("annotationStyle")).toEqual({ textSize: 18 });
  });
});

describe("malformed-input fallbacks", () => {
  it("ignores a non-object defaults value and keeps an object one", () => {
    expect(normalizeAnnotations({ defaults: "red", items: [line] })).toEqual({
      defaults: {},
      items: [line],
    });
    const defaults = { lineColor: "red" };
    expect(normalizeAnnotations({ defaults }).defaults).toBe(defaults);
  });

  it("starts ids at a1 with no item list and skips null or id-less items", () => {
    expect(nextAnnotationId(undefined)).toBe("a1");
    expect(nextAnnotationId([null, {}, { id: "a2" }])).toBe("a3");
  });

  it("never treats a text or missing item as an arrow", () => {
    expect(isArrowItem(text, { arrowheads: "both" })).toBe(false);
    expect(isArrowItem(null, { arrowheads: "both" })).toBe(false);
  });

  it("labels a text item with no text as empty", () => {
    expect(annotationLabel({ id: "a9", kind: "text" }, [], {})).toBe(
      "Text (empty)",
    );
  });

  it("numbers an item found by id even when the list holds a copy", () => {
    const items = [
      null,
      { id: "a1", kind: "line", coordinates: line.coordinates },
      text,
      { id: "a3", kind: "line", coordinates: line.coordinates },
    ];
    // A fresh object with the same id still stops the count at its slot.
    expect(annotationLabel({ ...items[3] }, items, {})).toBe("Arrow 2");
  });

  it("gives an item with no list a zero position rather than throwing", () => {
    expect(annotationLabel(line, undefined, {})).toBe("Arrow 0");
    expect(
      annotationLabel({ ...line, style: { arrowheads: "none" } }, null, {}),
    ).toBe("Line 0");
  });

  it("returns an item with no style unchanged when resetting an override", () => {
    expect(resetAnnotationOverride(text, "textColor")).toBe(text);
    expect(resetAnnotationOverride(undefined, "textColor")).toBeUndefined();
  });

  it("returns no features for a missing item list", () => {
    expect(itemsToFeatures(undefined, "EPSG:3857")).toEqual([]);
  });

  it("gives a text item with no text an empty text property", () => {
    const [feature] = itemsToFeatures(
      [{ id: "a1", kind: "text", coordinates: [-123, 44] }],
      "EPSG:3857",
    );
    expect(feature.get("annotationText")).toBe("");
    expect(feature.get("annotationStyle")).toBeNull();
    expect(featuresToItems([feature], "EPSG:3857")).toEqual([
      { id: "a1", kind: "text", coordinates: [-123, 44], text: "" },
    ]);
  });
});

describe("reprojectAnnotationFeatures edge cases", () => {
  it("tolerates a missing list and skips features with no geometry", () => {
    expect(() =>
      reprojectAnnotationFeatures(undefined, "EPSG:3857", "EPSG:2269"),
    ).not.toThrow();
    const empty = new Feature();
    reprojectAnnotationFeatures([empty], "EPSG:3857", "EPSG:2269");
    expect(empty.getGeometry()).toBeUndefined();
  });

  it("keeps an edit made before the swap marked as edited", () => {
    const features = itemsToFeatures([text], "EPSG:3857");
    const point = features[0].getGeometry();
    const [x, y] = point.getCoordinates();
    point.setCoordinates([x + 1000, y]); // ~1 km east, in Web Mercator
    reprojectAnnotationFeatures(features, "EPSG:3857", "EPSG:2269");
    const [item] = featuresToItems(features, "EPSG:2269");
    // Written from the moved geometry, not the stored coordinates.
    expect(item.coordinates).not.toEqual(text.coordinates);
    expect(item.coordinates[0]).toBeGreaterThan(text.coordinates[0]);
    expect(item.coordinates[1]).toBeCloseTo(text.coordinates[1], 4);
  });
});

describe("featuresToItems edge cases", () => {
  it("returns no items for a missing feature list", () => {
    expect(featuresToItems(undefined, "EPSG:3857")).toEqual([]);
  });

  it("skips features with no geometry or an unknown kind", () => {
    const [kept] = itemsToFeatures([line], "EPSG:3857");
    const noGeometry = new Feature();
    noGeometry.set("annotationKind", "line");
    noGeometry.set("annotationId", "x1");
    const unknownKind = new Feature({ geometry: new Point([0, 0]) });
    unknownKind.set("annotationKind", "circle");
    unknownKind.set("annotationId", "x2");
    expect(
      featuresToItems([noGeometry, unknownKind, kept], "EPSG:3857"),
    ).toEqual([line]);
  });

  it("writes a freshly drawn feature with no stored coordinates through the projection", () => {
    const feature = new Feature({
      geometry: new LineString([
        [0, 0],
        [1000, 0],
      ]),
    });
    feature.set("annotationKind", "line");
    feature.set("annotationId", "a5");
    feature.set("annotationStyle", {});
    const [item] = featuresToItems([feature], "EPSG:3857");
    expect(item).toEqual({
      id: "a5",
      kind: "line",
      coordinates: [
        [0, 0],
        [0.0089832, 0],
      ],
    });
    // An empty override object is not written back.
    expect(item).not.toHaveProperty("style");
  });

  it("writes a text feature with no text property as empty text", () => {
    const feature = new Feature({ geometry: new Point([0, 0]) });
    feature.set("annotationKind", "text");
    feature.set("annotationId", "a7");
    expect(featuresToItems([feature], "EPSG:3857")).toEqual([
      { id: "a7", kind: "text", coordinates: [0, 0], text: "" },
    ]);
  });

  it("drops a feature whose geometry reads back as non-finite", () => {
    const feature = new Feature({ geometry: new Point([NaN, 0]) });
    feature.set("annotationKind", "text");
    feature.set("annotationId", "a1");
    feature.set("annotationText", "Lost");
    expect(featuresToItems([feature], "EPSG:3857")).toEqual([]);
  });
});

describe("text rotation", () => {
  it("defaults to unrotated", () => {
    expect(resolveAnnotationDefaults({}).textRotation).toBe(0);
  });

  it("accepts zero and negative angles, and rejects non-numbers", () => {
    expect(
      resolveAnnotationStyle({ textRotation: 30 }, { textRotation: 0 })
        .textRotation,
    ).toBe(0);
    expect(resolveAnnotationStyle({}, { textRotation: -45 }).textRotation).toBe(
      -45,
    );
    expect(
      resolveAnnotationStyle({ textRotation: 30 }, { textRotation: "90" })
        .textRotation,
    ).toBe(30);
    expect(resolveAnnotationDefaults({ textRotation: NaN }).textRotation).toBe(
      0,
    );
  });

  it("normalizes an angle to a whole number of degrees in [0, 360)", () => {
    expect(normalizeRotation(-45)).toBe(315);
    expect(normalizeRotation(370)).toBe(10);
    expect(normalizeRotation(359.6)).toBe(0);
    expect(normalizeRotation(0)).toBe(0);
  });
});
