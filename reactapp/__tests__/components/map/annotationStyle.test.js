import Feature from "ol/Feature.js";
import LineString from "ol/geom/LineString.js";
import Point from "ol/geom/Point.js";
import RegularShape from "ol/style/RegularShape.js";
import {
  annotationFeatureStyles,
  arrowheadRadius,
  arrowheadRotation,
  createAnnotationStyleFunction,
} from "components/map/annotationStyle";
import { itemsToFeatures } from "components/map/annotations";

function lineFeature(coordinates, style) {
  const feature = new Feature({ geometry: new LineString(coordinates) });
  feature.set("annotationKind", "line");
  feature.set("annotationStyle", style ?? null);
  return feature;
}

function textFeature(text, style) {
  const feature = new Feature({ geometry: new Point([0, 0]) });
  feature.set("annotationKind", "text");
  feature.set("annotationText", text);
  feature.set("annotationStyle", style ?? null);
  return feature;
}

const arrowheads = (styles) =>
  styles.filter((s) => s.getImage() instanceof RegularShape);

describe("arrowheads", () => {
  it("draws none on a line pinned to no arrowheads", () => {
    const styles = annotationFeatureStyles(
      lineFeature(
        [
          [0, 0],
          [10, 0],
        ],
        { arrowheads: "none" },
      ),
      { arrowheads: "both" },
    );
    expect(styles).toHaveLength(1);
    expect(styles[0].getStroke()).toBeTruthy();
  });

  it("points the end arrowhead of a west-to-east line east", () => {
    const styles = annotationFeatureStyles(
      lineFeature([
        [0, 0],
        [10, 0],
      ]),
      { arrowheads: "end" },
    );
    const [head] = arrowheads(styles);
    expect(head.getGeometry().getCoordinates()).toEqual([10, 0]);
    expect(head.getImage().getRotation()).toBeCloseTo(Math.PI / 2);
    expect(head.getImage().getRotateWithView()).toBe(true);
  });

  it("draws both ends, each pointing outward along its terminal segment", () => {
    const styles = annotationFeatureStyles(
      lineFeature([
        [0, 0],
        [0, 10],
        [10, 10],
      ]),
      { arrowheads: "both" },
    );
    const [start, end] = arrowheads(styles);
    expect(start.getGeometry().getCoordinates()).toEqual([0, 0]);
    expect(start.getImage().getRotation()).toBeCloseTo(Math.PI); // south
    expect(end.getGeometry().getCoordinates()).toEqual([10, 10]);
    expect(end.getImage().getRotation()).toBeCloseTo(Math.PI / 2); // east
  });

  it("ignores a duplicated end vertex when orienting the arrowhead", () => {
    const styles = annotationFeatureStyles(
      lineFeature([
        [0, 0],
        [10, 0],
        [10, 0],
      ]),
      { arrowheads: "end" },
    );
    expect(arrowheads(styles)[0].getImage().getRotation()).toBeCloseTo(
      Math.PI / 2,
    );
  });

  it("scales the arrowhead with line width", () => {
    expect(arrowheadRadius(6)).toBeGreaterThan(arrowheadRadius(2));
    const styles = annotationFeatureStyles(
      lineFeature(
        [
          [0, 0],
          [10, 0],
        ],
        { lineWidth: 6 },
      ),
      { arrowheads: "end" },
    );
    expect(arrowheads(styles)[0].getImage().getRadius()).toBe(
      arrowheadRadius(6),
    );
  });

  it("computes rotation clockwise from north", () => {
    expect(arrowheadRotation([0, 0], [0, 1])).toBeCloseTo(0);
    expect(arrowheadRotation([0, 0], [-1, 0])).toBeCloseTo(-Math.PI / 2);
  });
});

describe("text", () => {
  it("styles text with size, color, halo and anchor", () => {
    const [style] = annotationFeatureStyles(
      textFeature("Gauge 1", { textSize: 18, textAnchor: "e" }),
      { textColor: "#112233", haloColor: "white" },
    );
    const text = style.getText();
    expect(text.getText()).toBe("Gauge 1");
    expect(text.getFont()).toBe("18px sans-serif");
    expect(text.getFill().getColor()).toBe("#112233");
    expect(text.getStroke().getColor()).toBe("white");
    expect(text.getTextAlign()).toBe("left");
    expect(text.getOffsetX()).toBeGreaterThan(0);
    expect(text.getOverflow()).toBe(true);
  });

  it("draws nothing for empty text", () => {
    expect(annotationFeatureStyles(textFeature("   "), {})).toEqual([]);
  });
});

describe("robustness", () => {
  it("returns no styles instead of throwing on malformed input", () => {
    expect(annotationFeatureStyles(null, {})).toEqual([]);
    expect(annotationFeatureStyles(new Feature(), {})).toEqual([]);
    expect(annotationFeatureStyles(lineFeature([[0, 0]]), {})).toEqual([]);
    const unknown = new Feature({ geometry: new Point([0, 0]) });
    unknown.set("annotationKind", "circle");
    expect(annotationFeatureStyles(unknown, {})).toEqual([]);
  });

  it("styles features built from saved items", () => {
    const fn = createAnnotationStyleFunction({ arrowheads: "end" });
    const [line] = itemsToFeatures(
      [
        {
          id: "a1",
          kind: "line",
          coordinates: [
            [-123, 44],
            [-122, 44],
          ],
        },
      ],
      "EPSG:3857",
    );
    expect(arrowheads(fn(line))).toHaveLength(1);
  });
});
