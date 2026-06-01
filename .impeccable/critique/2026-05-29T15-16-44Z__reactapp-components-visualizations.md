---
target: reactapp/components/visualizations/
total_score: 21
p0_count: 2
p1_count: 2
timestamp: 2026-05-29T15-16-44Z
slug: reactapp-components-visualizations
---
## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Base.js:128 + react-bootstrap Spinner; Map.js:339-345 reinvents rather than reusing the new LoadingAnimation. |
| 2 | Match System / Real World | 2 | Four error voices: "No Data found" / "No Data Available" / "Failed to retrieve data" / "Failed to load remote: <URL>" (URL leak). |
| 3 | User Control and Freedom | 2 | No renderer-level Retry CTA. Plotly's 12-button modebar ships on by default. |
| 4 | Consistency and Standards | 1 | Every renderer rolls its own hex (#6c757d, #f8f9fa, #1976d2, #e3f2fd, #888, #222, #fff, #ccc), its own radius (10/8/16/4px), its own spinner. DESIGN.md's 4px scale honored exactly once. Only Map.js:345 knows about Watershed Slate. |
| 5 | Error Prevention | 3 | MCP validation envelope carries the load. |
| 6 | Recognition Rather Than Recall | 3 | Card icons help. |
| 7 | Flexibility and Efficiency | 2 | No tabular-nums anywhere. No sticky table header. No Plotly hover-mode default. |
| 8 | Aesthetic and Minimalist Design | 1 | Plotly default modebar + watermark + rainbow palette + striped/bordered/hover table + colored icon chips on Card. Maximum chrome at every renderer. |
| 9 | Error Recovery | 2 | ModuleLoader.js:46 dumps a URL. Base.js:269 wall of error text. No retry CTA. |
| 10 | Help and Documentation | 2 | None at tile level. |
| **Total** | | **21 / 40** | **Visualizations are MORE fractured than chrome was. Prior PR closed chrome P0s; renderers are untouched.** |

## Anti-Patterns Verdict

**LLM assessment.** Bootstrap-era engineering demo dressed for a corporate intranet. Renderers leak react-bootstrap + Plotly defaults end-to-end: rainbow palette + 12-button modebar + watermark; DataTable striped/bordered/hover + <th> in body rows + capitalizePhrase renaming user columns; Card IS the hero-metric template (colored icon chip + 1.5rem bold value + 0.9rem gray label, border-radius 10px); LiveChat 694 lines in Material Design 2018 palette.

**Deterministic scan** (`detect.mjs` full, not --fast): exit 2, 1 finding.

- `border-accent-on-rounded` — `Map.js:345` — `border-top: 3px solid #1e6b8b` on the new CSS spinner. **Likely FP**: standard accessible spinner idiom (circular border-radius 50% + border-top accent), shipped in the prior PR. Detector pattern-matched geometry; substance is clean.

**The detector found almost nothing because the renderer surface is mostly react-bootstrap defaults and Plotly defaults — exactly the gap the LLM caught and the detector cannot.**

## What's Working

- **FeaturePendingShell** (Base.js:67-97) — title + hint + striped background + 4px radius. Only coherent renderer-state micro-pattern in the folder. Template for every other empty/error state.
- **Map.js:345 spinner** — the prior PR's Watershed Slate spinner with prefers-reduced-motion fallback. The only renderer surface that knows DESIGN.md exists.
- **Text.js** (65 lines) — DOMPurify + html-react-parser + URL-linkify, no decoration. Minimal-renderer model.

## Priority Issues

**[P0] Plotly ships with rainbow palette + 12-button modebar + watermark on every chart**

- **What**: BasePlot.js:25-26 instantiates plotly.js-strict-dist-min with zero project defaults. No colorway, template, or Plotly.setPlotConfig. Every chart inherits Plotly's default Category10 rainbow (≥5 hues, DESIGN.md one-accent violation), full modebar, watermark.
- **Why it matters**: Single biggest AI-slop vector in the renderer surface. Maya's first chart looks like a Bootstrap demo. Lin's audience sees Plotly logo. Color-blind safety unevaluable.
- **Fix**: Define forecastingDeskPlotlyTemplate once. Set config.displayModeBar:"hover", displaylogo:false. Deep-merge user layout/config OVER the template — plugin authors extend but can't break the visual system.
- **Suggested command**: `/impeccable distill`

**[P0] Card.js IS the SaaS hero-metric template DESIGN.md bans by name**

- **What**: Card.js:39-46 — StatIcon is a colored chip (bgColor prop, white icon, border-radius:10px) next to 1.5rem bold value + 0.9rem #6c757d label. The MCP plugin contract `{color, label, value, icon}` makes the LLM emit data shaped exactly to feed the template.
- **Why it matters**: Literally the hero-metric anti-reference. PRODUCT.md anti-reference #1 + DESIGN.md Don'ts list both name it.
- **Fix**: Drop the colored icon chip (or shrink to 12px monochrome leading mark). Value larger, single-color ink, tabular-mono numeric. Align cards on a baseline. 4px radius. Plugin contract stays backward-compatible — LLM-supplied `color` becomes a 12px dot, not a chip.
- **Suggested command**: `/impeccable quieter`

**[P1] DataTable.js is <Table striped bordered hover> with <th> in body rows**

- **What**: DataTable.js:52 ships Bootstrap default 3-axis treatment. :40 uses <th> for body cells (a11y regression). capitalizePhrase (:60-69) renames user columns. No tabular-nums. No sticky thead.
- **Why it matters**: Numbers don't align decimal places. Renamed columns disrespect the scientist's data.
- **Fix**: Bare <table> with subtle row separators only. Sticky thead. font-variant-numeric:tabular-nums on numeric columns (autodetect or type hint). Right-align numerics. Keep header text verbatim. Replace <th> in body rows with <td>.
- **Suggested command**: `/impeccable typeset`

**[P1] Empty/error states: four phrasings, three font sizes, no retry, one URL leak**

- **What**: Card "No Data found" inline, DataTable "<h2>No Data Available</h2>", Image "<h2>{imageError ?? 'Failed to get image.'}</h2>", ImageCollection "<h6>" in #888, ModuleLoader "<h2>Failed to load remote: {props.url}</h2>". Five renderers, five voices, three sizes, zero retry CTAs.
- **Why it matters**: One dashboard, four error voices. Remote URL leaked. No retry at renderer layer.
- **Fix**: One <EmptyState title hint onRetry/> reused from FeaturePendingShell. Forecasting Desk voice. Hide URL behind disclosure. Base.js already owns retry; surface as prop.
- **Suggested command**: `/impeccable clarify`

**[P2] LiveChat.js ships Material Design 2018 palette next to ChatSidebar**

- **What**: LiveChat.js:31,87,99,124,142 ships #e3f2fd / #f1f1f1 / #1976d2 / #b0b8c1 / #e0e0e0 plus 16px border-radius. Material Design 2018, not Forecasting Desk. Different palette from ChatSidebar.
- **Why it matters**: Two design languages in one product. Wide surface for unclear feature use.
- **Fix**: Investigate first — is LiveChat used? If for plugin-progress, Base.js:109-136 progress UI is probably enough. If real feature, reskin to share ChatSidebar primitives. Delete 694 lines if unused.
- **Suggested command**: `/impeccable adapt`

## Persona Red Flags

**Maya** — Streamflow chart in rainbow palette, reads legend to know observed vs forecast. Plotly modebar in corner of vision on every chart. capitalizePhrase mangled `comid` → `Comid`. Numbers don't align (no tabular-nums). Map popup has box-shadow Overlay (Map.js:108-110) — flat-by-default violation. Chrome at every layer + non-aligned numbers + renamed columns.

**Sam** — White card with colored icon chip, big bold number, tiny gray label. Reads: "Bootstrap admin dashboard demo." Two different products in 10 minutes.

**Lin** — Projects. Plotly watermark lower-right every chart. Modebar 12 gray icons upper-right. DataTable zebra stripes too high-contrast under projector gamma. Map swiper popup arrows in 24px Unicode #333 glyphs. Whispering "ignore the toolbar."

## Minor Observations

- Card.js:67-71 lazy-imports react-icons/bi — should be bs per the just-shipped ESLint rule.
- Card.js:75 — key={index ? index : 0} collides with fallback empty key.
- Card.js:80 — item?.label ? item?.label : 0 defaults missing label to literal 0.
- BasePlot.js:160 — color="red" literal default on vertical xref lines.
- Map.js:339-345 — spinner created on every render. Wasteful.
- ModuleLoader.js:14 — console.log shipping to production.
- ModuleLoader.js:37 — eslint-disable around conditional hook. Latent bug.
- Base.js:32-43 — react-bootstrap Spinner variant="info". Different visual language than Map.js:345 spinner.
- LiveChat.js:42 + Map.js:108-110 — box-shadow on resting surfaces. Flat-by-default violation.
- VariableInput.js:338 — refresh button variant="warning" (orange). Wrong semantic.
- DataTable.js:40 — <th> in body rows. A11y regression.

## Provocative Questions

1. Does Card need to exist, or is "stat card" a fitness-app metaphor in a forecast-ops product?
2. Renderer-layer vs plugin-layer default ownership for Plotly config — hard-override or warn-and-strip?
3. DataTable density commitment: Bloomberg-terminal or USGS-pubs?
4. Why is LiveChat in this folder at all?
5. Automated chrome-vs-data ink-percentage CI gate — feasible?
