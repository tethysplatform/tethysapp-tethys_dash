import {
  buildGeoTIFFStyleColor,
  buildCategoricalStyleColor,
  buildClassStyleColor,
  buildRangesStyleColor,
  classLegendItems,
  hasClassStyle,
  isClassStyleMode,
  isUsableClass,
  sortedRangeClasses,
} from "components/map/geoTIFFStyle";
import { COLOR_RAMPS, RAMP_STOPS } from "components/map/colorRamps";

afterEach(() => {
  jest.restoreAllMocks();
});

describe("buildGeoTIFFStyleColor", () => {
  test("returns an interpolate expression with correct header + value/color pairs", () => {
    const expr = buildGeoTIFFStyleColor({
      rampName: "viridis",
      rampMin: 0,
      rampMax: 100,
    });

    // Header: 'interpolate', ['linear'], ['band', 1], then min stop immediately.
    expect(expr[0]).toBe("interpolate");
    expect(expr[1]).toEqual(["linear"]);
    expect(expr[2]).toEqual(["band", 1]);
    expect(expr[3]).toBe(0);

    // Length: 3 operator-header elements + RAMP_STOPS (value, color) pairs.
    //   3 (header) + RAMP_STOPS values + RAMP_STOPS colors
    expect(expr).toHaveLength(3 + RAMP_STOPS * 2);
  });

  describe("rampReverse", () => {
    const stopsOf = (expr) => {
      // Strip the 3-element operator header, then take every other entry.
      const body = expr.slice(3);
      return body.filter((_, i) => i % 2 === 1);
    };

    test("flips the colors while leaving the value stops in place", () => {
      const forward = buildGeoTIFFStyleColor({
        rampName: "viridis",
        rampMin: 0,
        rampMax: 100,
      });
      const reversed = buildGeoTIFFStyleColor({
        rampName: "viridis",
        rampMin: 0,
        rampMax: 100,
        rampReverse: true,
      });

      // Same length and same numeric breakpoints -- only the palette turns around.
      expect(reversed).toHaveLength(forward.length);
      const values = (expr) => expr.slice(3).filter((_, i) => i % 2 === 0);
      expect(values(reversed)).toEqual(values(forward));
      expect(stopsOf(reversed)).toEqual([...stopsOf(forward)].reverse());
    });

    test("the low end of the range takes the ramp's last color", () => {
      const reversed = buildGeoTIFFStyleColor({
        rampName: "viridis",
        rampMin: 0,
        rampMax: 100,
        rampReverse: true,
      });
      expect(reversed[3]).toBe(0);
      expect(reversed[4]).toBe(
        COLOR_RAMPS.viridis[COLOR_RAMPS.viridis.length - 1],
      );
      expect(reversed[reversed.length - 1]).toBe(COLOR_RAMPS.viridis[0]);
    });

    test("omitting rampReverse matches passing false", () => {
      const args = { rampName: "turbo", rampMin: -5, rampMax: 5 };
      expect(buildGeoTIFFStyleColor(args)).toEqual(
        buildGeoTIFFStyleColor({ ...args, rampReverse: false }),
      );
    });

    test("reversing survives the transparency guards being prepended", () => {
      const reversed = buildGeoTIFFStyleColor({
        rampName: "Blues",
        rampMin: 0,
        rampMax: 1,
        rampReverse: true,
        hasNodata: true,
      });
      expect(reversed[0]).toBe("case");
      const interpolateExpr = reversed[reversed.length - 1];
      expect(interpolateExpr[0]).toBe("interpolate");
      expect(interpolateExpr[4]).toBe(
        COLOR_RAMPS.Blues[COLOR_RAMPS.Blues.length - 1],
      );
    });
  });

  test("starts with the first ramp color and ends with the last", () => {
    const expr = buildGeoTIFFStyleColor({
      rampName: "viridis",
      rampMin: 0,
      rampMax: 100,
    });

    // Position 3 is the first value (0), position 4 is the first color.
    expect(expr[4]).toBe(COLOR_RAMPS.viridis[0]);

    // Last pair: value at length-2, color at length-1.
    expect(expr[expr.length - 2]).toBe(100);
    expect(expr[expr.length - 1]).toBe(
      COLOR_RAMPS.viridis[COLOR_RAMPS.viridis.length - 1],
    );
  });

  test("distributes stops evenly across [rampMin, rampMax]", () => {
    const rampMax = RAMP_STOPS - 1; // step size = 1 for easy arithmetic
    const expr = buildGeoTIFFStyleColor({
      rampName: "viridis",
      rampMin: 0,
      rampMax,
    });

    // Value at pair N is at index 3 + N*2. With rampMax = RAMP_STOPS - 1 and
    // steps evenly distributed, value at pair N = N.
    expect(expr[3 + 2]).toBeCloseTo(1, 6);
    const mid = Math.floor(RAMP_STOPS / 2);
    expect(expr[3 + mid * 2]).toBeCloseTo(mid, 6);
    expect(expr[3 + (RAMP_STOPS - 1) * 2]).toBe(rampMax);
  });

  test("coerces string-numeric rampMin and rampMax via Number()", () => {
    const exprNum = buildGeoTIFFStyleColor({
      rampName: "viridis",
      rampMin: 0,
      rampMax: 100,
    });
    const exprStr = buildGeoTIFFStyleColor({
      rampName: "viridis",
      rampMin: "0",
      rampMax: "100",
    });

    expect(exprStr).toEqual(exprNum);
  });

  test("degenerate case: rampMin === rampMax returns a valid expression", () => {
    expect(() =>
      buildGeoTIFFStyleColor({
        rampName: "viridis",
        rampMin: 50,
        rampMax: 50,
      }),
    ).not.toThrow();

    const expr = buildGeoTIFFStyleColor({
      rampName: "viridis",
      rampMin: 50,
      rampMax: 50,
    });

    // All stop values should collapse to the same number.
    for (let i = 0; i < RAMP_STOPS; i++) {
      expect(expr[3 + i * 2]).toBe(50);
    }
    // Colors still vary — first and last differ.
    expect(expr[4]).not.toBe(expr[expr.length - 1]);
  });

  test("works with all supported ramp names", () => {
    for (const name of ["viridis", "turbo", "RdYlBu", "grayscale"]) {
      const expr = buildGeoTIFFStyleColor({
        rampName: name,
        rampMin: 0,
        rampMax: 1,
      });
      expect(expr[0]).toBe("interpolate");
      expect(expr).toHaveLength(3 + RAMP_STOPS * 2);
      expect(expr[4]).toBe(COLOR_RAMPS[name][0]);
    }
  });

  test("throws when rampName is not a recognized ramp", () => {
    expect(() =>
      buildGeoTIFFStyleColor({
        rampName: "not-a-real-ramp",
        rampMin: 0,
        rampMax: 100,
      }),
    ).toThrow(/Unknown color ramp/);
  });

  test("throws when rampMin is not parseable as a finite number", () => {
    expect(() =>
      buildGeoTIFFStyleColor({
        rampName: "viridis",
        rampMin: "not-a-number",
        rampMax: 100,
      }),
    ).toThrow(/both be set or both empty/);
  });

  test("empty rampMin and rampMax build a normalized [0,1] interpolate", () => {
    const expr = buildGeoTIFFStyleColor({
      rampName: "viridis",
      rampMin: "",
      rampMax: "",
    });
    expect(expr[0]).toBe("interpolate");
    expect(expr[3]).toBe(0); // first stop at 0
    expect(expr[expr.length - 2]).toBe(1); // last stop at 1
  });

  test("maskBelow adds a transparent branch for cells at or below the threshold", () => {
    const expr = buildGeoTIFFStyleColor({
      rampName: "viridis",
      rampMin: 0,
      rampMax: 10,
      maskBelow: "0.05",
    });

    expect(expr[0]).toBe("case");
    expect(expr[1]).toEqual(["<=", ["band", 1], 0.05]);
    expect(expr[2]).toEqual([0, 0, 0, 0]);
    expect(expr[3][0]).toBe("interpolate");
  });

  test("maskBelow and hasNodata produce both guards, nodata first", () => {
    const expr = buildGeoTIFFStyleColor({
      rampName: "viridis",
      rampMin: 0,
      rampMax: 10,
      hasNodata: true,
      maskBelow: 2,
    });

    expect(expr[0]).toBe("case");
    expect(expr[1]).toEqual(["==", ["band", 2], 0]);
    expect(expr[3]).toEqual(["<=", ["band", 1], 2]);
    expect(expr[5][0]).toBe("interpolate");
  });

  test("a maskBelow of 0 still masks, rather than reading as unset", () => {
    const expr = buildGeoTIFFStyleColor({
      rampName: "viridis",
      rampMin: 0,
      rampMax: 10,
      maskBelow: 0,
    });

    expect(expr[0]).toBe("case");
    expect(expr[1]).toEqual(["<=", ["band", 1], 0]);
  });

  test.each([
    ["undefined", undefined],
    ["null", null],
    ["empty string", ""],
    ["non-numeric", "abc"],
  ])("ignores a maskBelow of %s", (_label, maskBelow) => {
    const expr = buildGeoTIFFStyleColor({
      rampName: "viridis",
      rampMin: 0,
      rampMax: 10,
      maskBelow,
    });

    expect(expr[0]).toBe("interpolate");
  });

  test("skips maskBelow in normalized mode, where band 1 is not a raw value", () => {
    // Both bounds empty means OL scales band 1 to 0-1, so a raw threshold
    // cannot be compared against it and there is no range to convert with.
    const expr = buildGeoTIFFStyleColor({
      rampName: "viridis",
      rampMin: "",
      rampMax: "",
      maskBelow: 0.05,
    });

    expect(expr[0]).toBe("interpolate");
  });

  test("hasNodata wraps the interpolate in a `case` against band 2 with a transparent fallback", () => {
    // Covers the nodata branch: instead of returning the bare interpolate
    // expression, the function returns a `case` expression that returns a
    // transparent color when alpha (band 2) is 0.
    const expr = buildGeoTIFFStyleColor({
      rampName: "viridis",
      rampMin: 0,
      rampMax: 100,
      hasNodata: true,
    });

    expect(expr[0]).toBe("case");
    expect(expr[1]).toEqual(["==", ["band", 2], 0]);
    expect(expr[2]).toEqual([0, 0, 0, 0]);
    // Last element is the wrapped interpolate expression.
    const inner = expr[3];
    expect(inner[0]).toBe("interpolate");
    expect(inner[1]).toEqual(["linear"]);
    expect(inner[2]).toEqual(["band", 1]);
    expect(inner).toHaveLength(3 + RAMP_STOPS * 2);
  });

  test("throws when rampMax is not parseable as a finite number", () => {
    expect(() =>
      buildGeoTIFFStyleColor({
        rampName: "viridis",
        rampMin: 0,
        rampMax: "",
      }),
    ).toThrow(/both be set or both empty/);
  });

  test("treats an empty-string rampMin as NaN (covers the minIsEmpty true branch)", () => {
    // The existing rampMin failure test uses "not-a-number" which has
    // minIsEmpty=false; this case forces minIsEmpty=true so the ternary's
    // NaN branch is taken before Number("") would otherwise coerce to 0.
    expect(() =>
      buildGeoTIFFStyleColor({
        rampName: "viridis",
        rampMin: "",
        rampMax: 100,
      }),
    ).toThrow(/both be set or both empty/);
  });

  test("steps === 1 short-circuits to t=0 (single-entry ramp covers the steps===1 branch)", () => {
    // Temporarily stub a length-1 ramp into COLOR_RAMPS. The const binding
    // can't be reassigned, but the object's properties can be mutated —
    // and that's the same `COLOR_RAMPS` object the implementation reads.
    const original = COLOR_RAMPS.viridis;
    COLOR_RAMPS.viridis = ["#abcdef"];
    try {
      const expr = buildGeoTIFFStyleColor({
        rampName: "viridis",
        rampMin: 10,
        rampMax: 20,
      });

      // Header + a single (value, color) pair = 5 elements.
      expect(expr).toHaveLength(5);
      // With steps === 1 the loop emits one stop at t=0, so value === rampMin.
      expect(expr[3]).toBe(10);
      expect(expr[4]).toBe("#abcdef");
    } finally {
      COLOR_RAMPS.viridis = original;
    }
  });
});

describe("buildCategoricalStyleColor", () => {
  const classes = [
    { value: 0, color: "#aaa", label: "Bare" },
    { value: 1, color: "#bbb", label: "Crop" },
    { value: 2, color: "#ccc", label: "Urban" },
  ];

  test("matches each class value to its color", () => {
    const expr = buildCategoricalStyleColor({ classes });

    expect(expr).toEqual([
      "match",
      ["band", 1],
      0,
      "#aaa",
      1,
      "#bbb",
      2,
      "#ccc",
      [0, 0, 0, 0],
    ]);
  });

  test("unmatched values take the fallback color when given", () => {
    const expr = buildCategoricalStyleColor({
      classes,
      fallbackColor: "#999999",
    });

    expect(expr[expr.length - 1]).toBe("#999999");
  });

  test("unmatched values are transparent without a fallback", () => {
    const expr = buildCategoricalStyleColor({ classes });

    expect(expr[expr.length - 1]).toEqual([0, 0, 0, 0]);
  });

  test("nodata and mask guards run before the class lookup", () => {
    // Order matters: a masked cell must never reach the match, which is how a
    // listed class gets hidden once a fallback color makes omission moot.
    const expr = buildCategoricalStyleColor({
      classes,
      hasNodata: true,
      maskBelow: 0,
    });

    expect(expr[0]).toBe("case");
    expect(expr[1]).toEqual(["==", ["band", 2], 0]);
    expect(expr[3]).toEqual(["<=", ["band", 1], 0]);
    expect(expr[5][0]).toBe("match");
  });

  test("string class values are coerced to numbers for the match", () => {
    // The GUI emits strings; OL compares against the raw band value.
    const expr = buildCategoricalStyleColor({
      classes: [{ value: "2", color: "#ccc" }],
    });

    expect(expr[2]).toBe(2);
  });

  test("drops rows with no value or no color", () => {
    const expr = buildCategoricalStyleColor({
      classes: [
        { value: 0, color: "#aaa" },
        { value: "", color: "#bbb" },
        { value: 5 },
        { value: "nope", color: "#ccc" },
      ],
    });

    expect(expr).toEqual(["match", ["band", 1], 0, "#aaa", [0, 0, 0, 0]]);
  });

  test("throws when no class is usable", () => {
    expect(() => buildCategoricalStyleColor({ classes: [] })).toThrow(
      /at least one class/i,
    );
    expect(() => buildCategoricalStyleColor({})).toThrow(/at least one class/i);
  });
});

describe("isUsableClass", () => {
  it("rejects an entry with no value at all", () => {
    expect(isUsableClass(undefined)).toBe(false);
    expect(isUsableClass({})).toBe(false);
    expect(isUsableClass({ value: null })).toBe(false);
  });

  it("rejects a value that is only whitespace", () => {
    expect(isUsableClass({ value: "   " })).toBe(false);
  });

  it("accepts a numeric class that carries a color, including zero", () => {
    expect(isUsableClass({ value: 0, color: "#fff" })).toBe(true);
    expect(isUsableClass({ value: "3", color: "#fff" })).toBe(true);
  });

  it("rejects a class that is not numeric, or has no color to draw with", () => {
    expect(isUsableClass({ value: "forest", color: "#fff" })).toBe(false);
    expect(isUsableClass({ value: 3 })).toBe(false);
  });
});

// Evaluates the subset of OL's WebGL expression language these styles compile
// to, so a ranges style can be checked against the pixels it colors rather
// than only against its shape. `band2` is the alpha band OL appends for nodata.
function evaluate(expr, band1, band2 = 1) {
  if (!Array.isArray(expr) || typeof expr[0] !== "string") return expr;
  const [op, ...args] = expr;
  switch (op) {
    case "band":
      return args[0] === 1 ? band1 : band2;
    case "<=":
      return evaluate(args[0], band1, band2) <= evaluate(args[1], band1, band2);
    case "==":
      return (
        evaluate(args[0], band1, band2) === evaluate(args[1], band1, band2)
      );
    case "case": {
      for (let i = 0; i < args.length - 1; i += 2) {
        if (evaluate(args[i], band1, band2)) return args[i + 1];
      }
      return args[args.length - 1];
    }
    // istanbul ignore next -- guards the evaluator itself
    default:
      throw new Error(`Unsupported operator in test evaluator: ${op}`);
  }
}

const TRANSPARENT = [0, 0, 0, 0];

// The streamflow classes from a real dashboard, as saved: string values.
const STREAMFLOW_CLASSES = [
  { value: "1", color: "#bdbdbd", label: "0.1 to 1" },
  { value: "2", color: "#d9ef8b", label: "1 to 2" },
  { value: "4", color: "#fdae61", label: "2 to 4" },
  { value: "6", color: "#d73027", label: "4 to 6" },
  { value: "10", color: "#c51b7d", label: "6 to 10" },
  { value: "20", color: "#2c7bb6", label: "10 to 20" },
  { value: "100000000", color: "#08306b", label: "20+" },
];

describe("buildRangesStyleColor", () => {
  test("compiles an ascending case chain of <= tests", () => {
    const expr = buildRangesStyleColor({
      classes: [
        { value: 1, color: "#a" },
        { value: 2, color: "#b" },
      ],
    });

    expect(expr).toEqual([
      "case",
      ["<=", ["band", 1], 1],
      "#a",
      ["<=", ["band", 1], 2],
      "#b",
      TRANSPARENT,
    ]);
  });

  test("compiles the streamflow classes behind the nodata and mask guards", () => {
    const expr = buildRangesStyleColor({
      classes: STREAMFLOW_CLASSES,
      hasNodata: true,
      maskBelow: "0",
    });

    expect(expr).toEqual([
      "case",
      ["==", ["band", 2], 0],
      TRANSPARENT,
      ["<=", ["band", 1], 0],
      TRANSPARENT,
      ["<=", ["band", 1], 1],
      "#bdbdbd",
      ["<=", ["band", 1], 2],
      "#d9ef8b",
      ["<=", ["band", 1], 4],
      "#fdae61",
      ["<=", ["band", 1], 6],
      "#d73027",
      ["<=", ["band", 1], 10],
      "#c51b7d",
      ["<=", ["band", 1], 20],
      "#2c7bb6",
      ["<=", ["band", 1], 100000000],
      "#08306b",
      TRANSPARENT,
    ]);
  });

  describe("colors each value by the interval it falls in", () => {
    const expr = buildRangesStyleColor({
      classes: STREAMFLOW_CLASSES,
      hasNodata: true,
      maskBelow: "0",
      fallbackColor: "#ff00ff",
    });

    test("a value exactly at a bound takes that bound's class", () => {
      // Upper-inclusive: 2.0 closes "1 to 2", it does not open "2 to 4".
      expect(evaluate(expr, 2)).toBe("#d9ef8b");
      expect(evaluate(expr, 1)).toBe("#bdbdbd");
      expect(evaluate(expr, 20)).toBe("#2c7bb6");
    });

    test("a value between bounds takes the class above it", () => {
      expect(evaluate(expr, 1.37)).toBe("#d9ef8b");
      expect(evaluate(expr, 2.0001)).toBe("#fdae61");
      expect(evaluate(expr, 15)).toBe("#2c7bb6");
    });

    test("a value below the first bound but above the mask takes the first class", () => {
      expect(evaluate(expr, 0.05)).toBe("#bdbdbd");
    });

    test("a value at or below the mask is transparent", () => {
      expect(evaluate(expr, 0)).toEqual(TRANSPARENT);
      expect(evaluate(expr, -3)).toEqual(TRANSPARENT);
    });

    test("a nodata cell is transparent whatever its value", () => {
      expect(evaluate(expr, 5, 0)).toEqual(TRANSPARENT);
    });

    test("a value above the last bound takes the fallback color", () => {
      expect(evaluate(expr, 1e9)).toBe("#ff00ff");
    });
  });

  test("a value above the last bound is transparent without a fallback", () => {
    const expr = buildRangesStyleColor({
      classes: [{ value: 10, color: "#a" }],
    });

    expect(evaluate(expr, 11)).toEqual(TRANSPARENT);
    expect(evaluate(expr, -50)).toBe("#a");
  });

  test("sorts classes numerically, whatever the entry order", () => {
    // A string sort would put "10" ahead of "2" and "4".
    const expr = buildRangesStyleColor({
      classes: [
        { value: "10", color: "#ten" },
        { value: "2", color: "#two" },
        { value: "4", color: "#four" },
      ],
    });

    expect(expr).toEqual([
      "case",
      ["<=", ["band", 1], 2],
      "#two",
      ["<=", ["band", 1], 4],
      "#four",
      ["<=", ["band", 1], 10],
      "#ten",
      TRANSPARENT,
    ]);
    expect(evaluate(expr, 3)).toBe("#four");
  });

  test("drops a class whose bound repeats a lower one", () => {
    const expr = buildRangesStyleColor({
      classes: [
        { value: "2", color: "#first" },
        { value: 2, color: "#duplicate" },
        { value: "1", color: "#low" },
      ],
    });

    expect(expr).toEqual([
      "case",
      ["<=", ["band", 1], 1],
      "#low",
      ["<=", ["band", 1], 2],
      "#first",
      TRANSPARENT,
    ]);
  });

  test("drops rows with no value, no color, or a non-numeric value", () => {
    const expr = buildRangesStyleColor({
      classes: [
        { value: 5, color: "#a" },
        { value: "", color: "#b" },
        { value: 7 },
        { value: "nope", color: "#c" },
      ],
    });

    expect(expr).toEqual(["case", ["<=", ["band", 1], 5], "#a", TRANSPARENT]);
  });

  test("throws when no class is usable", () => {
    expect(() => buildRangesStyleColor({ classes: [{ value: "" }] })).toThrow(
      /at least one class/i,
    );
    expect(() => buildRangesStyleColor({})).toThrow(/at least one class/i);
  });
});

describe("class style mode helpers", () => {
  test("isClassStyleMode names categorical and ranges only", () => {
    expect(isClassStyleMode("categorical")).toBe(true);
    expect(isClassStyleMode("ranges")).toBe(true);
    expect(isClassStyleMode("continuous")).toBe(false);
    expect(isClassStyleMode(undefined)).toBe(false);
  });

  test("hasClassStyle needs a class mode and a usable class", () => {
    const usable = [{ value: 1, color: "#a" }];
    expect(hasClassStyle({ styleMode: "ranges", classes: usable })).toBe(true);
    expect(hasClassStyle({ styleMode: "categorical", classes: usable })).toBe(
      true,
    );
    expect(
      hasClassStyle({ styleMode: "ranges", classes: [{ value: "" }] }),
    ).toBe(false);
    expect(hasClassStyle({ styleMode: "continuous", classes: usable })).toBe(
      false,
    );
    expect(hasClassStyle(undefined)).toBe(false);
  });

  test("buildClassStyleColor dispatches on the mode", () => {
    const classes = [{ value: 1, color: "#a" }];
    expect(buildClassStyleColor({ styleMode: "ranges", classes })[0]).toBe(
      "case",
    );
    expect(buildClassStyleColor({ styleMode: "categorical", classes })[0]).toBe(
      "match",
    );
  });

  test("sortedRangeClasses keeps the entries themselves, ascending", () => {
    const low = { value: "1", color: "#a" };
    const high = { value: "10", color: "#b" };
    expect(sortedRangeClasses([high, low])).toEqual([low, high]);
    expect(sortedRangeClasses(undefined)).toEqual([]);
  });

  test("classLegendItems lists ranges ascending with an up-to fallback", () => {
    expect(
      classLegendItems({
        styleMode: "ranges",
        classes: [
          { value: "10", color: "#b" },
          { value: "2", color: "#a", label: "Low" },
          { value: "", color: "#c" },
        ],
      }),
    ).toEqual([
      { color: "#a", label: "Low", symbol: "square" },
      { color: "#b", label: "Up to 10", symbol: "square" },
    ]);
  });

  test("classLegendItems keeps categorical entries in their saved order", () => {
    expect(
      classLegendItems({
        styleMode: "categorical",
        classes: [
          { value: 3, color: "#b" },
          { value: 1, color: "#a", label: "One" },
        ],
      }),
    ).toEqual([
      { color: "#b", label: "3", symbol: "square" },
      { color: "#a", label: "One", symbol: "square" },
    ]);
    expect(classLegendItems({ styleMode: "categorical" })).toEqual([]);
  });
});
