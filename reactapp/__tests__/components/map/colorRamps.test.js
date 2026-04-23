import {
  COLOR_RAMPS,
  RAMP_NAMES,
  _internal,
} from "components/map/colorRamps";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const RAMP_KEYS = ["viridis", "turbo", "RdYlBu", "grayscale"];

describe("COLOR_RAMPS", () => {
  test.each(RAMP_KEYS)(
    "%s has exactly 256 entries",
    (rampName) => {
      expect(COLOR_RAMPS[rampName]).toHaveLength(256);
    },
  );

  test.each(RAMP_KEYS)(
    "every %s entry is a 6-digit hex string",
    (rampName) => {
      const ramp = COLOR_RAMPS[rampName];
      for (const entry of ramp) {
        expect(entry).toMatch(HEX_RE);
      }
    },
  );

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
    expect(COLOR_RAMPS.grayscale[255]).toBe("#ffffff");
  });

  test("grayscale midpoint is ~mid-gray (r == g == b)", () => {
    // entry 127 interpolates to ~0.498 channel value → #7f7f7f
    const mid = COLOR_RAMPS.grayscale[127];
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
    const last = COLOR_RAMPS.viridis[255];
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
    const last = COLOR_RAMPS.RdYlBu[255];
    const [, r1, g1, b1] = first.match(/^#(..)(..)(..)$/);
    const [, r2, g2, b2] = last.match(/^#(..)(..)(..)$/);
    expect(parseInt(r1, 16)).toBeGreaterThan(parseInt(b1, 16));
    expect(parseInt(b2, 16)).toBeGreaterThan(parseInt(r2, 16));
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
