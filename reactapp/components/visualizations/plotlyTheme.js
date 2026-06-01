/**
 * forecastingDeskPlotlyTheme — project-level Plotly defaults.
 *
 * Encodes DESIGN.md (Watershed Slate, Restrained color strategy, Inter +
 * JetBrains Mono type stack, flat-by-default, 4px structural radius) into
 * Plotly's layout and config defaults.
 *
 * Usage: BasePlot.js deep-merges user-supplied `layout` and `config` OVER
 * these defaults, so:
 *   - Plugin authors can extend (e.g., set a specific xaxis range).
 *   - Plugin authors CAN'T accidentally break the visual system by setting
 *     their own `colorway` or re-enabling the modebar — those would only
 *     win if a plugin explicitly fights the override, and the deep-merge
 *     order will surface that intent in code review.
 *
 * Canonical color sources (also encoded in custom-bootstrap.scss as
 * $primary, but BasePlot can't reach Sass at runtime so we mirror the hex
 * here with a comment for the next person):
 *   - Watershed Slate (#1e6b8b)  = DESIGN.md colors.watershed-slate
 *   - Watershed Slate Soft       = DESIGN.md colors.watershed-slate-soft
 *   - Ink-muted                  = DESIGN.md colors.ink-muted
 *   - Paper                      = DESIGN.md colors.paper
 *   - Rule                       = DESIGN.md colors.rule
 */

const WATERSHED_SLATE = "#1e6b8b";
const WATERSHED_SLATE_DEEP = "#185571";
const WATERSHED_SLATE_SOFT = "#3d8aa9";
const INK = "#15202a";
const INK_MUTED = "#4b5b6a";
const PAPER = "#fbfcfc";
const RULE = "#e0e5e9";

const FONT_STACK =
  "InterVariable, Inter, system-ui, -apple-system, Segoe UI, sans-serif";

/**
 * Single-accent colorway with two neutral derivatives. Restrained color
 * strategy: charts with ≥4 series degrade to one accent + neutrals, NOT
 * Plotly's default rainbow Category10.
 *
 * For categorical encodings with >3 series, the plugin author should
 * pass an explicit `marker.color` per trace (point shapes, dashes, or
 * texture are the right answer for >3 categories — see DESIGN.md
 * Color-blindness in data viz note).
 */
export const FORECASTING_DESK_COLORWAY = [
  WATERSHED_SLATE,
  WATERSHED_SLATE_DEEP,
  WATERSHED_SLATE_SOFT,
];

export const FORECASTING_DESK_LAYOUT_DEFAULTS = {
  paper_bgcolor: PAPER,
  plot_bgcolor: PAPER,
  colorway: FORECASTING_DESK_COLORWAY,
  font: {
    family: FONT_STACK,
    size: 13,
    color: INK,
  },
  margin: { l: 56, r: 16, t: 32, b: 40 },
  hoverlabel: {
    bgcolor: PAPER,
    bordercolor: WATERSHED_SLATE,
    font: { family: FONT_STACK, size: 12, color: INK },
  },
  hovermode: "closest",
  xaxis: {
    gridcolor: RULE,
    linecolor: RULE,
    zerolinecolor: RULE,
    tickcolor: RULE,
    tickfont: { family: FONT_STACK, size: 11, color: INK_MUTED },
    title: { font: { family: FONT_STACK, size: 12, color: INK_MUTED } },
  },
  yaxis: {
    gridcolor: RULE,
    linecolor: RULE,
    zerolinecolor: RULE,
    tickcolor: RULE,
    tickfont: { family: FONT_STACK, size: 11, color: INK_MUTED },
    title: { font: { family: FONT_STACK, size: 12, color: INK_MUTED } },
  },
  legend: {
    bgcolor: "rgba(0,0,0,0)",
    bordercolor: "rgba(0,0,0,0)",
    font: { family: FONT_STACK, size: 12, color: INK_MUTED },
  },
};

/**
 * Modebar: hover-only, no Plotly watermark, drop the 4 buttons that
 * confuse the daily editor without adding value (lasso/box selection
 * make sense in a stats notebook, not a streamflow dashboard;
 * autoScale2d is what double-click already does; toggleSpikelines is
 * Plotly's experimental crosshair that conflicts with the vertical-line
 * shape system this plot uses).
 */
export const FORECASTING_DESK_CONFIG_DEFAULTS = {
  displayModeBar: "hover",
  displaylogo: false,
  modeBarButtonsToRemove: [
    "lasso2d",
    "select2d",
    "autoScale2d",
    "toggleSpikelines",
  ],
  responsive: true,
};

/**
 * Token color export for non-Plotly callers (e.g., createVerticalLine's
 * default stroke). Avoids the prior `color = "red"` literal which
 * collided with the danger semantic.
 */
export const FORECASTING_DESK_TOKEN_COLORS = {
  primary: WATERSHED_SLATE,
  primaryDeep: WATERSHED_SLATE_DEEP,
  primarySoft: WATERSHED_SLATE_SOFT,
  ink: INK,
  inkMuted: INK_MUTED,
  paper: PAPER,
  rule: RULE,
};

/**
 * Deep-merge helper — like Object.assign but recurses through plain
 * objects. Plotly layout objects nest (e.g., `xaxis.tickfont.family`),
 * so a shallow spread loses the defaults below the first level.
 *
 * Arrays are replaced (Plotly's `colorway`, `shapes`, etc.), not merged.
 */
function isPlainObject(v) {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype
  );
}

export function deepMerge(base, overrides) {
  if (!isPlainObject(overrides)) return overrides ?? base;
  if (!isPlainObject(base)) return overrides;
  const out = { ...base };
  for (const k of Object.keys(overrides)) {
    out[k] = isPlainObject(overrides[k]) && isPlainObject(base[k])
      ? deepMerge(base[k], overrides[k])
      : overrides[k];
  }
  return out;
}
