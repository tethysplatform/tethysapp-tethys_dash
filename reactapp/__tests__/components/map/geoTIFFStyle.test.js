import { buildGeoTIFFStyleColor } from "components/map/geoTIFFStyle";
import { COLOR_RAMPS } from "components/map/colorRamps";

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

    // Length: 3 operator-header elements + 256 (value, color) pairs = 3 + 512 = 515.
    // Plan called this out as 4 + 256*2 = 516 — the 4 counts the min stop value
    // as part of the header; our implementation treats it as the first pair's
    // value, which is equivalent either way. The concrete arithmetic:
    //   3 (header) + 256 values + 256 colors = 515.
    expect(expr).toHaveLength(3 + 256 * 2);
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
    expect(expr[expr.length - 1]).toBe(COLOR_RAMPS.viridis[255]);
  });

  test("distributes stops evenly across [rampMin, rampMax]", () => {
    const expr = buildGeoTIFFStyleColor({
      rampName: "viridis",
      rampMin: 0,
      rampMax: 255,
    });

    // Value at pair N is at index 3 + N*2. For rampMin=0, rampMax=255, N=1
    // should be exactly 1 (because 255 * 1/255 = 1).
    expect(expr[3 + 2]).toBeCloseTo(1, 6);
    // Midpoint value should be 127.5 at pair N=127 (since 255 * 127/255 = 127).
    expect(expr[3 + 127 * 2]).toBeCloseTo(127, 6);
    // Last value should be exactly 255.
    expect(expr[3 + 255 * 2]).toBe(255);
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
    for (let i = 0; i < 256; i++) {
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
      expect(expr).toHaveLength(3 + 256 * 2);
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

  test("throws when rampMax is not parseable as a finite number", () => {
    expect(() =>
      buildGeoTIFFStyleColor({
        rampName: "viridis",
        rampMin: 0,
        rampMax: "",
      }),
    ).toThrow(/finite numbers/);
  });
});
