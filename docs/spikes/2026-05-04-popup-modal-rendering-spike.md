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

**Switching `DashboardLayout` to `Responsive` is rejected for v1.** Adopt the **CSS flexbox stack fallback** for R23 instead:

- Below 768px viewport, the `PopupModalCarousel` (Unit 8) wraps its `<DashboardLayout>` in a className branch that overrides the grid's positioning with a vertical flexbox stack (e.g., a CSS rule like `.popup-modal--narrow .react-grid-layout > div { position: static !important; transform: none !important; width: 100% !important; }` paired with a flex-column parent).
- Each tile's `h` (height in grid rows) is preserved as a `min-height` in the stacked layout so authored vertical proportions roughly carry over.
- Gives editors predictable behavior at small viewports without committing to a global `Responsive` migration.

**Plan adjustment required**: Unit 9's R23 approach should commit to CSS flexbox fallback as the primary strategy rather than naming RGL responsive cols as the candidate with CSS as the fallback. I'll fold this into Unit 9 when we get there.

---

## Plan Adjustments Required Before Continuing

1. **Unit 2 (DashboardLayout parameterization)** — confirmed minimum-viable scope: `rowHeight` and `colCount` props with current defaults. The responsive `cols` object pass-through can be cut entirely (was being kept "in case" for R23; CSS fallback obviates it).
2. **Unit 9 (Failure modes)** — R23 small-viewport branch primary approach is now CSS flexbox stack via a className branch on `<DashboardLayout>`, not RGL responsive cols.

Both are simplifications relative to the plan as written. No new work surfaced.

## Decision

Proceed to Phase 1 Units 2, 3, 4 (parallel) per the plan. Unit 1 spike code: **none was created** — static analysis was sufficient. No teardown required.
