import { buildGeoTIFFStyleColor } from "components/map/geoTIFFStyle";
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
    ).toThrow(/finite numbers/);
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
    ).toThrow(/finite numbers/);
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
    ).toThrow(/finite numbers/);
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
