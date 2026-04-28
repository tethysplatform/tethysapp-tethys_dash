const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

const toHex = (channel) => {
  const rounded = Math.round(clamp01(channel) * 255);
  return rounded.toString(16).padStart(2, "0");
};

const rgbToHex = ([r, g, b]) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

// Interpolate an array of keystops into a `steps`-length array of hex strings.
// keystops: [{ t: number in [0,1], color: [r,g,b] in [0,1] }], sorted by t ascending.
const interpolateRamp = (keystops, steps = 256) => {
  const sorted = [...keystops].sort((a, b) => a.t - b.t);
  const out = new Array(steps);
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    // find bracketing keystops
    let lo = sorted[0];
    let hi = sorted[sorted.length - 1];
    for (let k = 0; k < sorted.length - 1; k++) {
      if (t >= sorted[k].t && t <= sorted[k + 1].t) {
        lo = sorted[k];
        hi = sorted[k + 1];
        break;
      }
    }
    const span = hi.t - lo.t;
    const localT = span === 0 ? 0 : (t - lo.t) / span;
    const r = lo.color[0] + (hi.color[0] - lo.color[0]) * localT;
    const g = lo.color[1] + (hi.color[1] - lo.color[1]) * localT;
    const b = lo.color[2] + (hi.color[2] - lo.color[2]) * localT;
    out[i] = rgbToHex([r, g, b]);
  }
  return out;
};

// Keystops expressed as [t, [r, g, b]] with all values in [0, 1].
const toKeystops = (raw) => raw.map(([t, color]) => ({ t, color }));

// Viridis keystops (matplotlib), 12 evenly-spaced samples from the canonical 256-entry table.
// Source: matplotlib._cm_listed.viridis — sampled at indices 0, 23, 46, ..., 253, 255.
const VIRIDIS_KEYSTOPS = toKeystops([
  [0.0, [0.267004, 0.004874, 0.329415]],
  [0.0909, [0.282656, 0.100196, 0.42216]],
  [0.1818, [0.278012, 0.180733, 0.486214]],
  [0.2727, [0.253935, 0.265254, 0.529983]],
  [0.3636, [0.221989, 0.339161, 0.548752]],
  [0.4545, [0.190631, 0.407061, 0.556089]],
  [0.5454, [0.163625, 0.471133, 0.558148]],
  [0.6363, [0.139147, 0.533812, 0.555298]],
  [0.7272, [0.120638, 0.596986, 0.543755]],
  [0.8181, [0.20803, 0.718701, 0.472873]],
  [0.909, [0.477504, 0.821444, 0.318195]],
  [1.0, [0.993248, 0.906157, 0.143936]],
]);

// Turbo keystops (Google / Anton Mikhailov). Sampled at 12 points from the
// canonical 256-entry table: indices 0, 23, 46, 69, 92, 115, 139, 162, 185, 208, 231, 255.
// Values from https://gist.github.com/mikhailov-work/ee72ba4191942acecc03fe6da94fc73f
const TURBO_KEYSTOPS = toKeystops([
  [0.0, [0.18995, 0.07176, 0.23217]],
  [0.0909, [0.25107, 0.25237, 0.63374]],
  [0.1818, [0.27628, 0.42118, 0.89123]],
  [0.2727, [0.25862, 0.57958, 0.99876]],
  [0.3636, [0.15844, 0.73551, 0.92305]],
  [0.4545, [0.09267, 0.86554, 0.7623]],
  [0.5454, [0.19659, 0.94901, 0.59466]],
  [0.6363, [0.42778, 0.99419, 0.38575]],
  [0.7272, [0.66449, 0.98412, 0.23288]],
  [0.8181, [0.86629, 0.8792, 0.15844]],
  [0.909, [0.98177, 0.67243, 0.1145]],
  [1.0, [0.4796, 0.01583, 0.01055]],
]);

// ColorBrewer 11-class RdYlBu. https://colorbrewer2.org
// Hex: a50026, d73027, f46d43, fdae61, fee090, ffffbf, e0f3f8, abd9e9, 74add1, 4575b4, 313695
const hexToRgb01 = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
};
const RD_YL_BU_HEXES = [
  "#a50026",
  "#d73027",
  "#f46d43",
  "#fdae61",
  "#fee090",
  "#ffffbf",
  "#e0f3f8",
  "#abd9e9",
  "#74add1",
  "#4575b4",
  "#313695",
];
const RD_YL_BU_KEYSTOPS = RD_YL_BU_HEXES.map((hex, i, arr) => ({
  t: i / (arr.length - 1),
  color: hexToRgb01(hex),
}));

// Grayscale: trivial black to white.
const GRAYSCALE_KEYSTOPS = toKeystops([
  [0.0, [0.0, 0.0, 0.0]],
  [1.0, [1.0, 1.0, 1.0]],
]);

// Shader-friendly stop count — see file-level comment for the WebGL
// fragment-shader instruction-limit constraint.
export const RAMP_STOPS = 32;

export const COLOR_RAMPS = {
  viridis: interpolateRamp(VIRIDIS_KEYSTOPS, RAMP_STOPS),
  turbo: interpolateRamp(TURBO_KEYSTOPS, RAMP_STOPS),
  RdYlBu: interpolateRamp(RD_YL_BU_KEYSTOPS, RAMP_STOPS),
  grayscale: interpolateRamp(GRAYSCALE_KEYSTOPS, RAMP_STOPS),
};

// Canonical display order in the picker UI.
export const RAMP_NAMES = ["viridis", "turbo", "RdYlBu", "grayscale"];

// Exported for unit testing.
export const _internal = { interpolateRamp, rgbToHex, hexToRgb01 };
