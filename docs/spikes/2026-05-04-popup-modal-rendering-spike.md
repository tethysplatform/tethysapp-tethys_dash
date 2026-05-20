---
date: 2026-05-04
plan: docs/plans/2026-05-04-001-feat-configurable-map-popup-modal-plan.md
unit: Unit 1 (prerequisite spike)
method: static analysis
---

# Popup Modal Rendering Spike

## Question 1 — Do `plotly`, `table`, `text`, `image`, `card` viz types render correctly inside a portaled, position-fixed, constrained-size container?

### Findings (per viz type)

| Viz | File | Sizing approach | Verdict | Notes |
|---|---|---|---|---|
| `image` | [reactapp/components/visualizations/Image.js](../../reactapp/components/visualizations/Image.js) | `StyledImg` `height/width: 100%`; outer `StyledDiv` flex-centered `height: 100%` | ✓ pass | Stretches to fill; aspect ratio not preserved (existing behavior, not a spike issue) |
| `text` | [reactapp/components/visualizations/Text.js](../../reactapp/components/visualizations/Text.js) | `StyledDiv` `height: 100%; overflow-y: auto` | ✓ pass | Vertical scroll handled; no horizontal scroll if content overflows (pre-existing) |
| `card` | [reactapp/components/visualizations/Card.js](../../reactapp/components/visualizations/Card.js) | `CardContainer` `height/width: 100%; overflow-x: auto` | ✓ pass | Stat groups in flex-row may overflow on narrow tiles; existing horizontal scroll handles it |
| `table` (DataTable) | [reactapp/components/visualizations/DataTable.js](../../reactapp/components/visualizations/DataTable.js) | `StyledDiv` `height: 100%; overflow-y: auto` | ✓ pass | Wide tables can overflow horizontally with no scroll handling — existing limitation, not a spike concern |
| `plotly` (BasePlot) | [reactapp/components/visualizations/BasePlot.js](../../reactapp/components/visualizations/BasePlot.js) | `useResizeDetector` from `react-resize-detector` (ResizeObserver under the hood); 100ms debounce; outer flex `height: 100%`; inner StyledPlot `width/height: 100%` | ✓ pass with caveat | See "Plotly first-paint" below |

### Plotly first-paint caveat

`useResizeDetector` returns `width: undefined, height: undefined` on first render until the ResizeObserver callback fires after layout. Plotly's `plotLayout` state is initialized with these undefined values, then updated in a `useEffect` once width/height resolve.

**In practice this isn't a visible problem** because:
1. `StyledPlot` is `width: 100%; height: 100%` via CSS — Plotly fills the container immediately regardless of what's in its `layout.width/height` props.
2. The `width/height` values in Plotly's layout are layout hints, not the rendering primitive.
3. The 100ms debounce means subsequent resize events are smoothed, but the first measurement happens on layout completion (typically within one frame).

**Mitigation if observed in practice**: pass an initial `width`/`height` from the modal's known editor-configured size into the BasePlot layout state on mount. Defer to Unit 8 if it surfaces during integration testing.

### Conclusion (Q1)

All five viz types render correctly inside a constrained container. **No adapter work required for v1.** The Plotly first-paint case is a known minor risk with a documented mitigation; deferred until/unless observed.

---

## Question 2 — Does `react-grid-layout`'s responsive `cols` collapse to single-column produce acceptable tile heights at <768px?

### Finding

**The current `DashboardLayout` uses `RGL` (the static `GridLayout`), NOT `Responsive`.** See [reactapp/components/dashboard/DashboardLayout.js](../../reactapp/components/dashboard/DashboardLayout.js) lines 2 and 16:

```js
import RGL, { WidthProvider } from "react-grid-layout";
const ReactGridLayout = WidthProvider(RGL);
```

The `cols` prop on the static `RGL` accepts a single number (line 114: `cols={colCount}`), not the responsive `{lg: 12, sm: 1}` object the plan originally proposed for R23.

To use react-grid-layout's responsive cols collapse, the component would need to switch from `RGL` to `Responsive` from the same package — different API (requires `breakpoints`, `cols`, and per-breakpoint `layouts` props). That's a non-trivial change touching all callers of `DashboardLayout` and risks regressing the existing dashboard grid UX.

### Conclusion (Q2)

Iterated through three positions during this spike before landing on the final decision:

1. **Initial conclusion**: CSS flexbox stack fallback in the popup; no host change.
2. **First redirect (user)**: switch host `DashboardLayout` to `Responsive` so the host benefits from narrow-viewport collapse too.
3. **Second redirect (user)**: discovered that for `unrestrictedPlacement=true` dashboards (which use overlap as a layout primitive — e.g., a basemap dropdown intentionally on top of a map), the responsive collapse pile-up at narrow breakpoints is unsolvable without per-tile anchor metadata that doesn't exist today. The host's responsive problem is real but needs its own dedicated feature work.

**Final decision (Option A): host `DashboardLayout` is byte-identical to today's behavior. Add a `responsive` prop (default `false`) that opts into `Responsive`; only popup grids pass `responsive={true}`.** Popup grids in v1 are non-overlap by design, so they don't hit the `unrestrictedPlacement` collapse problem. The host responsive feature is deferred — see project memory `project_dashboard_responsive_followup.md`.

Key implementation details:
- Per-breakpoint `cols`: `lg/md=100` (preserves fine-grained placement), `sm=12`, `xs=4`, `xxs=1`.
- Layouts pre-generated explicitly for all five breakpoints rather than relying on `Responsive`'s auto-derivation. Reason: `findOrGenerateResponsiveLayout` in react-grid-layout always runs `compact()` on auto-derived layouts and does **not** pass `allowOverlap` through. Supplying every layout makes the library return them cached, skipping that compaction; the subsequent `synchronizeLayoutWithChildren` step does honor `allowOverlap`.
- Drag/resize disabled below `sm` (narrow viewports are view-only).

---

## Plan Adjustments Already Made

1. **Unit 2** — adds `rowHeight` and `responsive` props (default false) on `DashboardLayout`. Host call sites pass nothing → today's behavior. Popup call sites (Units 7, 8) pass `responsive={true}` to opt in.
2. **Unit 9** — R23 small-viewport branch: the popup's `<DashboardLayout responsive>` already degrades through breakpoints; the modal only overrides its own `size` to fullscreen below 768px.
3. **Project memory** — `project_dashboard_responsive_followup.md` captures the per-tile anchor metadata + dashboard responsive follow-up that should kick off after this PR merges.

## Decision

Proceed to Phase 1 Unit 3 (PopupModal primitive) and Unit 4 (backend) in parallel, then Unit 5 (Map.js bypass). Unit 1 spike code: **none was created** — static analysis was sufficient. No teardown required.
