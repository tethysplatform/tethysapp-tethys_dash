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

// The ramps below were sampled from matplotlib 3.10 at 12 evenly spaced points,
// the same convention as viridis and turbo above, rather than transcribed by
// hand. matplotlib's Blues/YlGnBu/YlOrRd/RdBu/Spectral/BrBG are the ColorBrewer
// maps of those names.

// magma, inferno, plasma, cividis — the perceptually uniform family that ships
// alongside viridis. cividis is additionally optimized for red-green color
// vision deficiency.
const MAGMA_KEYSTOPS = toKeystops([
  [0.0, [0.001462, 0.000466, 0.013866]],
  [0.0909, [0.069764, 0.049726, 0.193735]],
  [0.1818, [0.198177, 0.063862, 0.404009]],
  [0.2727, [0.347636, 0.082946, 0.494121]],
  [0.3636, [0.494258, 0.141462, 0.507988]],
  [0.4545, [0.639216, 0.189921, 0.49415]],
  [0.5455, [0.786212, 0.241514, 0.450184]],
  [0.6364, [0.913354, 0.330052, 0.382563]],
  [0.7273, [0.979645, 0.491014, 0.367783]],
  [0.8182, [0.996341, 0.660969, 0.45116]],
  [0.9091, [0.995131, 0.827052, 0.585701]],
  [1.0, [0.987053, 0.991438, 0.749504]],
]);

const INFERNO_KEYSTOPS = toKeystops([
  [0.0, [0.001462, 0.000466, 0.013866]],
  [0.0909, [0.076637, 0.041905, 0.205799]],
  [0.1818, [0.224763, 0.036405, 0.388129]],
  [0.2727, [0.372768, 0.073915, 0.4324]],
  [0.3636, [0.522206, 0.12815, 0.419549]],
  [0.4545, [0.66454, 0.181539, 0.369846]],
  [0.5455, [0.796607, 0.254728, 0.287264]],
  [0.6364, [0.902003, 0.364492, 0.184116]],
  [0.7273, [0.969163, 0.515946, 0.063488]],
  [0.8182, [0.987714, 0.682807, 0.072489]],
  [0.9091, [0.960626, 0.859069, 0.29801]],
  [1.0, [0.988362, 0.998364, 0.644924]],
]);

const PLASMA_KEYSTOPS = toKeystops([
  [0.0, [0.050383, 0.029803, 0.527975]],
  [0.0909, [0.241396, 0.014979, 0.610259]],
  [0.1818, [0.387183, 0.001434, 0.654177]],
  [0.2727, [0.523633, 0.024532, 0.652901]],
  [0.3636, [0.650746, 0.125309, 0.595617]],
  [0.4545, [0.752312, 0.227133, 0.513149]],
  [0.5455, [0.836801, 0.329105, 0.430905]],
  [0.6364, [0.907365, 0.434524, 0.35297]],
  [0.7273, [0.963203, 0.553865, 0.271909]],
  [0.8182, [0.991985, 0.681179, 0.195295]],
  [0.9091, [0.986509, 0.822401, 0.143557]],
  [1.0, [0.940015, 0.975158, 0.131326]],
]);

const CIVIDIS_KEYSTOPS = toKeystops([
  [0.0, [0.0, 0.135112, 0.304751]],
  [0.0909, [0.003602, 0.195911, 0.441564]],
  [0.1818, [0.185453, 0.258914, 0.426788]],
  [0.2727, [0.28324, 0.32139, 0.423211]],
  [0.3636, [0.37043, 0.38689, 0.433428]],
  [0.4545, [0.448447, 0.451053, 0.456264]],
  [0.5455, [0.529086, 0.517207, 0.472543]],
  [0.6364, [0.616852, 0.585913, 0.462237]],
  [0.7273, [0.712105, 0.66116, 0.434117]],
  [0.8182, [0.806859, 0.737385, 0.387684]],
  [0.9091, [0.905589, 0.818257, 0.312889]],
  [1.0, [0.995737, 0.909344, 0.217772]],
]);

// Single- and multi-hue sequential maps. Blues suits depth and water extent,
// YlGnBu precipitation, YlOrRd heat and risk.
const BLUES_KEYSTOPS = toKeystops([
  [0.0, [0.968627, 0.984314, 1.0]],
  [0.0909, [0.897885, 0.939039, 0.977363]],
  [0.1818, [0.828881, 0.893764, 0.954725]],
  [0.2727, [0.750634, 0.847843, 0.928212]],
  [0.3636, [0.632526, 0.797647, 0.886874]],
  [0.4545, [0.491765, 0.721968, 0.854779]],
  [0.5455, [0.361599, 0.642737, 0.816578]],
  [0.6364, [0.248166, 0.561892, 0.77098]],
  [0.7273, [0.150727, 0.464452, 0.720784]],
  [0.8182, [0.074817, 0.373256, 0.65521]],
  [0.9091, [0.031373, 0.281615, 0.558262]],
  [1.0, [0.031373, 0.188235, 0.419608]],
]);

const YL_GN_BU_KEYSTOPS = toKeystops([
  [0.0, [1.0, 1.0, 0.85098]],
  [0.0909, [0.949066, 0.980192, 0.737793]],
  [0.1818, [0.863376, 0.946482, 0.699331]],
  [0.2727, [0.733887, 0.89564, 0.710404]],
  [0.3636, [0.521292, 0.812964, 0.731073]],
  [0.4545, [0.342622, 0.746267, 0.755894]],
  [0.5455, [0.203968, 0.661376, 0.762968]],
  [0.6364, [0.11534, 0.552157, 0.74519]],
  [0.7273, [0.130104, 0.401569, 0.674325]],
  [0.8182, [0.139885, 0.276909, 0.615148]],
  [0.9091, [0.113433, 0.178808, 0.514879]],
  [1.0, [0.031373, 0.113725, 0.345098]],
]);

const YL_OR_RD_KEYSTOPS = toKeystops([
  [0.0, [1.0, 1.0, 0.8]],
  [0.0909, [1.0, 0.949066, 0.675494]],
  [0.1818, [0.998262, 0.894656, 0.554464]],
  [0.2727, [0.996078, 0.82579, 0.435617]],
  [0.3636, [0.996078, 0.710634, 0.311603]],
  [0.4545, [0.993572, 0.60529, 0.257932]],
  [0.5455, [0.990742, 0.463806, 0.209827]],
  [0.6364, [0.980161, 0.289089, 0.160185]],
  [0.7273, [0.906344, 0.135548, 0.118847]],
  [0.8182, [0.807213, 0.045183, 0.131642]],
  [0.9091, [0.674571, 0.0, 0.14902]],
  [1.0, [0.501961, 0.0, 0.14902]],
]);

// Diverging maps, for values read against a meaningful midpoint -- anomalies,
// differences, change between two dates.
const RD_BU_KEYSTOPS = toKeystops([
  [0.0, [0.403922, 0.0, 0.121569]],
  [0.0909, [0.669204, 0.08489, 0.164014]],
  [0.1818, [0.811534, 0.321107, 0.275817]],
  [0.2727, [0.922261, 0.567474, 0.448674]],
  [0.3636, [0.9797, 0.784083, 0.68489]],
  [0.4545, [0.979239, 0.919108, 0.883737]],
  [0.5455, [0.901423, 0.936794, 0.956248]],
  [0.6364, [0.732411, 0.853749, 0.916263]],
  [0.7273, [0.48143, 0.714879, 0.839446]],
  [0.8182, [0.236601, 0.541869, 0.74702]],
  [0.9091, [0.118647, 0.379239, 0.645675]],
  [1.0, [0.019608, 0.188235, 0.380392]],
]);

const SPECTRAL_KEYSTOPS = toKeystops([
  [0.0, [0.619608, 0.003922, 0.258824]],
  [0.0909, [0.814148, 0.219685, 0.304806]],
  [0.1818, [0.933026, 0.391311, 0.271972]],
  [0.2727, [0.981776, 0.607382, 0.34579]],
  [0.3636, [0.994694, 0.809227, 0.486967]],
  [0.4545, [0.998231, 0.945175, 0.657055]],
  [0.5455, [0.955786, 0.982314, 0.680046]],
  [0.6364, [0.8203, 0.927566, 0.612687]],
  [0.7273, [0.591003, 0.835525, 0.644291]],
  [0.8182, [0.360015, 0.716186, 0.665513]],
  [0.9091, [0.212995, 0.511419, 0.730796]],
  [1.0, [0.368627, 0.309804, 0.635294]],
]);

const BR_BG_KEYSTOPS = toKeystops([
  [0.0, [0.329412, 0.188235, 0.019608]],
  [0.0909, [0.527489, 0.30496, 0.037293]],
  [0.1818, [0.709804, 0.468973, 0.149558]],
  [0.2727, [0.837601, 0.685813, 0.397924]],
  [0.3636, [0.932872, 0.857209, 0.66782]],
  [0.4545, [0.962553, 0.937793, 0.872357]],
  [0.5455, [0.879431, 0.94133, 0.932488]],
  [0.6364, [0.682122, 0.877509, 0.848212]],
  [0.7273, [0.415456, 0.741638, 0.699193]],
  [0.8182, [0.167859, 0.554479, 0.523106]],
  [0.9091, [0.003537, 0.383852, 0.350942]],
  [1.0, [0.0, 0.235294, 0.188235]],
]);

// Shader-friendly stop count — see file-level comment for the WebGL
// fragment-shader instruction-limit constraint.
export const RAMP_STOPS = 32;

export const COLOR_RAMPS = {
  viridis: interpolateRamp(VIRIDIS_KEYSTOPS, RAMP_STOPS),
  magma: interpolateRamp(MAGMA_KEYSTOPS, RAMP_STOPS),
  inferno: interpolateRamp(INFERNO_KEYSTOPS, RAMP_STOPS),
  plasma: interpolateRamp(PLASMA_KEYSTOPS, RAMP_STOPS),
  cividis: interpolateRamp(CIVIDIS_KEYSTOPS, RAMP_STOPS),
  turbo: interpolateRamp(TURBO_KEYSTOPS, RAMP_STOPS),
  Blues: interpolateRamp(BLUES_KEYSTOPS, RAMP_STOPS),
  YlGnBu: interpolateRamp(YL_GN_BU_KEYSTOPS, RAMP_STOPS),
  YlOrRd: interpolateRamp(YL_OR_RD_KEYSTOPS, RAMP_STOPS),
  grayscale: interpolateRamp(GRAYSCALE_KEYSTOPS, RAMP_STOPS),
  RdYlBu: interpolateRamp(RD_YL_BU_KEYSTOPS, RAMP_STOPS),
  RdBu: interpolateRamp(RD_BU_KEYSTOPS, RAMP_STOPS),
  Spectral: interpolateRamp(SPECTRAL_KEYSTOPS, RAMP_STOPS),
  BrBG: interpolateRamp(BR_BG_KEYSTOPS, RAMP_STOPS),
};

// Grouped for the picker, which would otherwise be an unlabelled column of
// swatches. Sequential maps read low-to-high; diverging maps read against a
// midpoint and are wrong for data that has no meaningful centre.
export const RAMP_GROUPS = [
  {
    label: "Perceptually uniform",
    names: ["viridis", "magma", "inferno", "plasma", "cividis"],
  },
  {
    // turbo is a rainbow rather than perceptually uniform -- high contrast and
    // popular, but it invents edges that are not in the data.
    label: "Sequential",
    names: ["turbo", "Blues", "YlGnBu", "YlOrRd", "grayscale"],
  },
  {
    label: "Diverging",
    names: ["RdYlBu", "RdBu", "Spectral", "BrBG"],
  },
];

// Canonical display order in the picker UI.
export const RAMP_NAMES = RAMP_GROUPS.flatMap((group) => group.names);

/**
 * A ramp's colors, optionally reversed.
 *
 * The single place reversal happens, so the raster style, the editor preview and
 * the map legend cannot disagree about which end is which. Returns a copy when
 * reversed and the shared array otherwise, so callers must not mutate it.
 *
 * Returns undefined for an unknown name; callers decide whether that throws.
 */
export function resolveRamp(rampName, reverse = false) {
  const colors = COLOR_RAMPS[rampName];
  if (!colors) return undefined;
  return reverse ? [...colors].reverse() : colors;
}

// Exported for unit testing.
export const _internal = { interpolateRamp, rgbToHex, hexToRgb01 };
