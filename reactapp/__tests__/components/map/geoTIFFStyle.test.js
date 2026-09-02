import {
  buildGeoTIFFStyleColor,
  buildCategoricalStyleColor,
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
