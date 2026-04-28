import {
  COLOR_RAMPS,
  RAMP_NAMES,
  RAMP_STOPS,
  _internal,
} from "components/map/colorRamps";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const RAMP_KEYS = ["viridis", "turbo", "RdYlBu", "grayscale"];

describe("COLOR_RAMPS", () => {
  test.each(RAMP_KEYS)(
    `%s has exactly RAMP_STOPS (${RAMP_STOPS}) entries`,
    (rampName) => {
      expect(COLOR_RAMPS[rampName]).toHaveLength(RAMP_STOPS);
    },
  );

  test("RAMP_STOPS is shader-friendly (<= 64, the practical WebGL limit)", () => {
    expect(RAMP_STOPS).toBeGreaterThan(0);
    expect(RAMP_STOPS).toBeLessThanOrEqual(64);
  });

  test.each(RAMP_KEYS)("every %s entry is a 6-digit hex string", (rampName) => {
    const ramp = COLOR_RAMPS[rampName];
    for (const entry of ramp) {
      expect(entry).toMatch(HEX_RE);
    }
  });

  test.each(RAMP_KEYS)(
    "%s starts and ends with distinct colors (not a flat ramp)",
    (rampName) => {
      const ramp = COLOR_RAMPS[rampName];
      expect(ramp[0]).not.toEqual(ramp[ramp.length - 1]);
    },
  );

  test("RAMP_NAMES exposes the four canonical names in order", () => {
    expect(RAMP_NAMES).toEqual(["viridis", "turbo", "RdYlBu", "grayscale"]);
  });

  test("grayscale starts black and ends white", () => {
    expect(COLOR_RAMPS.grayscale[0]).toBe("#000000");
    expect(COLOR_RAMPS.grayscale[RAMP_STOPS - 1]).toBe("#ffffff");
  });

  test("grayscale midpoint is mid-gray (r == g == b)", () => {
    // The midpoint of any RAMP_STOPS-length grayscale ramp interpolates to
    // an equal-channel hex (e.g., #80808080 or thereabouts depending on
    // RAMP_STOPS). Assertion is on channel equality, not a specific value.
    const mid = COLOR_RAMPS.grayscale[Math.floor(RAMP_STOPS / 2)];
    const match = mid.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    expect(match).not.toBeNull();
    expect(match[1]).toBe(match[2]);
    expect(match[2]).toBe(match[3]);
  });

  test("viridis starts with a dark blue-purple hue (canonical viridis)", () => {
    // Canonical viridis[0] is ~(0.267, 0.005, 0.329) — a dark blue-purple.
    const first = COLOR_RAMPS.viridis[0];
    const [, r, g, b] = first.match(/^#(..)(..)(..)$/);
    const rI = parseInt(r, 16);
    const gI = parseInt(g, 16);
    const bI = parseInt(b, 16);
    // Red channel roughly mid-low, green very low, blue moderate.
    expect(rI).toBeGreaterThan(40);
    expect(rI).toBeLessThan(120);
    expect(gI).toBeLessThan(40);
    expect(bI).toBeGreaterThan(50);
  });

  test("viridis ends with a bright yellow", () => {
    const last = COLOR_RAMPS.viridis[RAMP_STOPS - 1];
    const [, r, g, b] = last.match(/^#(..)(..)(..)$/);
    const rI = parseInt(r, 16);
    const gI = parseInt(g, 16);
    const bI = parseInt(b, 16);
    expect(rI).toBeGreaterThan(200);
    expect(gI).toBeGreaterThan(200);
    expect(bI).toBeLessThan(80);
  });

  test("turbo starts with a dark blue-purple hue", () => {
    const first = COLOR_RAMPS.turbo[0];
    const [, r, g, b] = first.match(/^#(..)(..)(..)$/);
    const rI = parseInt(r, 16);
    const gI = parseInt(g, 16);
    const bI = parseInt(b, 16);
    expect(rI).toBeLessThan(80);
    expect(gI).toBeLessThan(80);
    expect(bI).toBeGreaterThan(30);
  });

  test("RdYlBu starts red-ish and ends blue-ish", () => {
    const first = COLOR_RAMPS.RdYlBu[0];
    const last = COLOR_RAMPS.RdYlBu[RAMP_STOPS - 1];
    const firstMatch = first.match(/^#(..)(..)(..)$/);
    const lastMatch = last.match(/^#(..)(..)(..)$/);
    expect(parseInt(firstMatch[1], 16)).toBeGreaterThan(
      parseInt(firstMatch[3], 16),
    );
    expect(parseInt(lastMatch[3], 16)).toBeGreaterThan(
      parseInt(lastMatch[1], 16),
    );
  });
});

describe("interpolateRamp helper", () => {
  test("returns requested number of steps", () => {
    const out = _internal.interpolateRamp(
      [
        { t: 0, color: [0, 0, 0] },
        { t: 1, color: [1, 1, 1] },
      ],
      16,
    );
    expect(out).toHaveLength(16);
  });

  test("clamps boundary stops to requested endpoints", () => {
    const out = _internal.interpolateRamp(
      [
        { t: 0, color: [0, 0, 0] },
        { t: 1, color: [1, 1, 1] },
      ],
      4,
    );
    expect(out[0]).toBe("#000000");
    expect(out[3]).toBe("#ffffff");
  });

  test("interpolates linearly between two keystops", () => {
    const out = _internal.interpolateRamp(
      [
        { t: 0, color: [0, 0, 0] },
        { t: 1, color: [1, 0, 0] },
      ],
      3,
    );
    // middle entry is half-red
    expect(out[1]).toBe("#800000");
  });

  test("uses the 256 default when steps is omitted", () => {
    // Covers the `steps = 256` default-parameter branch.
    const out = _internal.interpolateRamp([
      { t: 0, color: [0, 0, 0] },
      { t: 1, color: [1, 1, 1] },
    ]);
    expect(out).toHaveLength(256);
    expect(out[0]).toBe("#000000");
    expect(out[255]).toBe("#ffffff");
  });

  test("returns a single low-end color when steps === 1 (avoids divide-by-zero)", () => {
    // Covers the `steps === 1 ? 0 : ...` branch where the loop's `t` is
    // forced to 0 instead of computing `i / (steps - 1)`.
    const out = _internal.interpolateRamp(
      [
        { t: 0, color: [0, 0, 0] },
        { t: 1, color: [1, 1, 1] },
      ],
      1,
    );
    expect(out).toEqual(["#000000"]);
  });

  test("handles zero-span between adjacent keystops without dividing by zero", () => {
    // Two keystops share t=0. The bracket-finder loop matches the first
    // pair where `t >= sorted[k].t && t <= sorted[k+1].t`; for the i=0
    // sample (t=0) that's sorted[0]/sorted[1] — both at t=0, so span=0,
    // covering the `span === 0 ? 0 : ...` branch. localT=0 picks `lo`'s
    // color (#000000). Other samples bracket the [0, 1] pair as normal.
    const out = _internal.interpolateRamp(
      [
        { t: 0, color: [0, 0, 0] },
        { t: 0, color: [1, 0, 0] },
        { t: 1, color: [0, 0, 1] },
      ],
      3,
    );
    expect(out[0]).toBe("#000000");
    expect(out[2]).toBe("#0000ff");
  });
});

describe("rgbToHex helper", () => {
  test("encodes 0/0/0 as #000000", () => {
    expect(_internal.rgbToHex([0, 0, 0])).toBe("#000000");
  });

  test("encodes 1/1/1 as #ffffff", () => {
    expect(_internal.rgbToHex([1, 1, 1])).toBe("#ffffff");
  });

  test("clamps out-of-range values", () => {
    expect(_internal.rgbToHex([-1, 2, 0.5])).toBe("#00ff80");
  });
});
