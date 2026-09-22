// Lifecycle and geometry edges for the rule-style engine.
//
// Separate from jsonStyle.test.js because these need a feature double the
// shared one cannot express: attributes that change between calls, and a
// missing geometry. jest.mock is hoisted and file-scoped, so a suite that
// needs different doubles belongs in its own file.
import { createJsonStyleFunction } from "components/map/jsonStyle";

// A feature whose attributes and geometry can be rewritten between calls,
// the way OpenLayers features genuinely are: runtime layers swap their
// feature sets in place, and reprojection rewrites geometries.
function mutableFeature(props, geometryType = "Point") {
  return {
    props,
    geometryType,
    getProperties() {
      return this.props;
    },
    get(key) {
      return this.props[key];
    },
    getGeometry() {
      return this.geometryType === null
        ? undefined
        : { getType: () => this.geometryType };
    },
  };
}

const byRank = {
  default: {
    point: { fill: "#cccccc", size: 4 },
    polygon: { fill: "#eeeeee" },
  },
  rules: [
    {
      geometryType: "point",
      conditionField: "rank",
      conditionType: "=",
      conditionValue: 5,
      fill: "#ff0000",
    },
  ],
};

test("a feature restyled after its attributes change gets the new style", () => {
  // The key must be computed per call. Memoizing it onto the feature would
  // pin a swapped-in feature to whatever it looked like when first drawn.
  const styleFn = createJsonStyleFunction(byRank);
  const feature = mutableFeature({ rank: 1 });
  expect(styleFn(feature).getImage().getFill().getColor()).toBe("#cccccc");

  feature.props = { rank: 5 };
  expect(styleFn(feature).getImage().getFill().getColor()).toBe("#ff0000");
});

test("a feature carrying no geometry falls into the point bucket", () => {
  const styleFn = createJsonStyleFunction(byRank);
  const style = styleFn(mutableFeature({ rank: 5 }, null));
  expect(style.getImage().getFill().getColor()).toBe("#ff0000");
});

test("a feature whose geometry type changes moves bucket", () => {
  // Geometries are mutable and get rewritten during reprojection, so the
  // bucket cannot be memoized onto the feature either.
  const styleFn = createJsonStyleFunction(byRank);
  const feature = mutableFeature({ rank: 5 }, "Point");
  expect(styleFn(feature).getImage()).toBeTruthy();

  feature.geometryType = "Polygon";
  const asPolygon = styleFn(feature);
  expect(asPolygon.getImage()).toBeFalsy();
  expect(asPolygon.getFill().getColor()).toBe("#eeeeee");
});

test("a second style function serves none of the first function's entries", () => {
  // The observable form of the lifetime claim. Reachability itself is not
  // assertable from Jest without GC introspection.
  const first = createJsonStyleFunction(byRank);
  const second = createJsonStyleFunction({
    ...byRank,
    rules: [{ ...byRank.rules[0], fill: "#0000ff" }],
  });

  const feature = mutableFeature({ rank: 5 });
  const fromFirst = first(feature);
  const fromSecond = second(feature);

  expect(fromSecond).not.toBe(fromFirst);
  expect(fromFirst.getImage().getFill().getColor()).toBe("#ff0000");
  expect(fromSecond.getImage().getFill().getColor()).toBe("#0000ff");
  expect(first.cachedStyleCount()).toBe(1);
  expect(second.cachedStyleCount()).toBe(1);
});
