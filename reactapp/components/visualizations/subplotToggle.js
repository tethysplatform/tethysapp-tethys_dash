/**
 * Pure, framework-free helpers for deriving toggleable subplots from a Plotly
 * figure and recomputing geometry when subplots are shown/hidden.
 *
 * Design contract (see docs/plans/2026-06-11-001-feat-subplot-toggle-reflow-plan.md):
 *
 *   - Visibility toggling is UNIVERSAL: any subplot arrangement can have its
 *     panes identified and their member traces + axes toggled.
 *   - Reflow (redistributing freed space) is only mathematically defined for a
 *     1-D arrangement — a vertical stack (shared x-domain, partitioned
 *     y-domains) or a horizontal strip (mirror). Grids, insets, overlapping
 *     domains, and non-cartesian subplots classify as "none" and degrade to
 *     visibility-only.
 *
 * Safety rails enforced here:
 *   - Axes are NEVER deleted, only toggled `visible` and (for the reflow
 *     dimension) given a new `domain`. This preserves `matches`/zoom-linking.
 *   - Overlay axes (those carrying `overlaying`) never receive a `domain`;
 *     they inherit position from their base axis.
 *   - Reflow always recomputes from the PRISTINE layout, so it is stateless and
 *     idempotent — callers must pass the original (unpatched) figure.
 */

const EPS = 1e-6;
const AXIS_KEY_RE = /^([xy])axis(\d*)$/;

// Transparent fill used to neutralize the plot background while subplots are
// hidden. A `visible:false` axis still keeps its domain and its `plot_bgcolor`
// rectangle; after reflow that rectangle overlaps the visible panes and —
// because Plotly draws subplots in axis-index order — a higher-index hidden
// subplot's opaque background paints over the traces of lower-index panes.
// Collapsing the domain is unreliable (Plotly resets a too-small/equal domain
// to the full default), so instead we make the background paint nothing.
const TRANSPARENT = "rgba(0,0,0,0)";

/** "y" -> "yaxis", "y3" -> "yaxis3", "x" -> "xaxis", "x2" -> "xaxis2". */
export const axisRefToLayoutKey = (ref) => {
  const letter = ref[0];
  const num = ref.slice(1);
  return (letter === "x" ? "xaxis" : "yaxis") + num;
};

/** "yaxis3" -> "y3", "xaxis" -> "x". Returns null for non-axis keys. */
export const layoutKeyToAxisRef = (key) => {
  const m = key.match(AXIS_KEY_RE);
  return m ? m[1] + m[2] : null;
};

// `layout` is always a real object here — the sole caller (`overlaysOf` in
// derivePanes) runs after `layout` has been defaulted to `{}`.
const listAxisKeys = (layout) =>
  Object.keys(layout).filter((k) => AXIS_KEY_RE.test(k));

/**
 * Follow an axis's `overlaying` chain to its base axis ref. An overlay
 * (`overlaying: "y"`) resolves to the axis it overlays; `overlaying: "free"`
 * is treated as its own base. Cycle-guarded.
 */
export const resolveBaseAxis = (ref, layout, seen) => {
  seen = seen || new Set();
  if (seen.has(ref)) return ref;
  seen.add(ref);
  const ax = (layout || {})[axisRefToLayoutKey(ref)];
  if (ax && typeof ax.overlaying === "string" && ax.overlaying !== "free") {
    return resolveBaseAxis(ax.overlaying, layout, seen);
  }
  return ref;
};

// Trace types positioned by their own `domain: {x, y}` rather than by an x/y
// axis pair or a named subplot. Left to the cartesian default they would be
// misgrouped onto the base "x"/"y" pane (see the subplot-toggle brainstorm):
// e.g. a go.Table footer would ride along with the first heatmap and get
// overlapped on reflow. Each becomes its own non-cartesian pane instead.
const DOMAIN_TRACE_TYPES = new Set([
  "table",
  "pie",
  "sunburst",
  "treemap",
  "icicle",
  "funnelarea",
  "parcoords",
  "parcats",
  "sankey",
  "indicator",
]);

/**
 * Determine which subplot a trace belongs to. Non-cartesian traces
 * (3D/polar/geo/mapbox/ternary/smith) reference a named subplot; domain-based
 * traces (table/pie/sankey/...) carry their own `domain` and share no named
 * subplot, so each gets a stable per-trace id; cartesian traces reference an
 * x/y axis pair (defaulting to "x"/"y").
 */
const getTracePlacement = (trace, traceIndex) => {
  if (trace.scene) return { kind: "nonCartesian", id: trace.scene };
  if (trace.geo) return { kind: "nonCartesian", id: trace.geo };
  if (trace.subplot) return { kind: "nonCartesian", id: trace.subplot };
  if (DOMAIN_TRACE_TYPES.has(trace.type)) {
    return {
      kind: "nonCartesian",
      id: `domain:${trace.type}:${traceIndex}`,
      domainFromTrace: true,
      traceType: trace.type,
    };
  }
  return {
    kind: "cartesian",
    xref: trace.xaxis || "x",
    yref: trace.yaxis || "y",
  };
};

const getDomain = (layout, layoutKey, fallback) =>
  (layout && layout[layoutKey] && layout[layoutKey].domain) || fallback;

/**
 * Identify the toggleable subplots ("panes") in a Plotly figure.
 *
 * Each pane groups the trace indices that share a plotting region, plus the
 * axes exclusive to that region (which is what gets its `visible` toggled).
 * An axis is "exclusive" only if no other pane uses it as a base — so a shared
 * x-axis in a vertical stack is never hidden when one row is toggled off.
 *
 * @param {Object} [options]
 * @param {Object<string,string>} [options.labels] - explicit pane labels keyed
 *   by an axis reference or layout key (e.g. "y5", "yaxis5", "x3") or a
 *   non-cartesian subplot id ("polar2"). Takes precedence over the derived
 *   label (axis title -> first trace name -> "Subplot N").
 * @returns {Array<{
 *   id: string, label: string, kind: "cartesian"|"nonCartesian",
 *   traceIndices: number[], exclusiveAxisKeys: string[],
 *   primaryXKey: string|null, primaryYKey: string|null,
 *   rect: { x: [number, number], y: [number, number] },
 * }>}
 */
export const derivePanes = (data, layout, options) => {
  data = data || [];
  layout = layout || {};
  const explicitLabels = (options && options.labels) || {};

  // Group trace indices by pane key, preserving first-seen order.
  const order = [];
  const groups = new Map();
  data.forEach((trace, i) => {
    const place = getTracePlacement(trace, i);
    let key;
    let meta;
    if (place.kind === "nonCartesian") {
      key = `np:${place.id}`;
      meta = { kind: "nonCartesian", subplotId: place.id };
      if (place.domainFromTrace) {
        // Domain-based trace: its rect comes from the trace's own `domain`
        // (there is no `layout[subplotId]`), and it is only offered as a toggle
        // when the plugin explicitly labels it (by pane id or trace type).
        meta.domain = trace.domain || {};
        meta.traceType = place.traceType;
      }
    } else {
      const baseX = resolveBaseAxis(place.xref, layout);
      const baseY = resolveBaseAxis(place.yref, layout);
      key = `${baseX}|${baseY}`;
      meta = { kind: "cartesian", baseX, baseY };
    }
    if (!groups.has(key)) {
      groups.set(key, { ...meta, traceIndices: [] });
      order.push(key);
    }
    groups.get(key).traceIndices.push(i);
  });

  // Count how many panes use each base axis ref (to detect shared axes).
  const usageX = {};
  const usageY = {};
  for (const key of order) {
    const g = groups.get(key);
    if (g.kind !== "cartesian") continue;
    usageX[g.baseX] = (usageX[g.baseX] || 0) + 1;
    usageY[g.baseY] = (usageY[g.baseY] || 0) + 1;
  }

  // Map each base axis ref to its overlay axis refs (axes overlaying it).
  const overlaysOf = (baseRef) =>
    listAxisKeys(layout)
      .map(layoutKeyToAxisRef)
      .filter((r) => r !== baseRef && resolveBaseAxis(r, layout) === baseRef);

  return order.map((key, idx) => {
    const g = groups.get(key);
    // Returns the first explicit label matching any candidate key, else null.
    const explicitLabelFor = (explicitKeys) => {
      for (const k of explicitKeys) {
        if (k != null && explicitLabels[k]) return explicitLabels[k];
      }
      return null;
    };
    const label = (explicitKeys, fallbackKey) => {
      const explicit = explicitLabelFor(explicitKeys);
      if (explicit) return explicit;
      const titled =
        layout[fallbackKey] &&
        layout[fallbackKey].title &&
        layout[fallbackKey].title.text;
      const firstTraceName = data[g.traceIndices[0]]?.name;
      return titled || firstTraceName || `Subplot ${idx + 1}`;
    };

    if (g.kind === "nonCartesian") {
      // Domain-based traces read their rect from the trace's own `domain`;
      // scene/geo/subplot panes read it from `layout[subplotId].domain`.
      const dom =
        g.domain || (layout[g.subplotId] && layout[g.subplotId].domain) || {};
      // A domain pane (table/pie/...) is only toggleable when the plugin
      // explicitly labels it (by pane id or trace type); scene/geo/subplot
      // panes stay toggleable as in v1.
      const domainLabelKeys = g.domain
        ? [g.subplotId, g.traceType]
        : [g.subplotId];
      const toggleable = g.domain
        ? explicitLabelFor(domainLabelKeys) != null
        : true;
      return {
        id: key,
        label: label(domainLabelKeys, g.subplotId),
        kind: "nonCartesian",
        toggleable,
        traceIndices: g.traceIndices,
        // Non-cartesian subplots have no simple layout-level `visible`; v1
        // toggles trace visibility only and leaves the (empty) frame.
        exclusiveAxisKeys: [],
        primaryXKey: null,
        primaryYKey: null,
        rect: {
          x: Array.isArray(dom.x) ? dom.x : [0, 1],
          y: Array.isArray(dom.y) ? dom.y : [0, 1],
        },
      };
    }

    const primaryXKey = axisRefToLayoutKey(g.baseX);
    const primaryYKey = axisRefToLayoutKey(g.baseY);

    const exclusiveRefs = [];
    if (usageY[g.baseY] === 1)
      exclusiveRefs.push(g.baseY, ...overlaysOf(g.baseY));
    if (usageX[g.baseX] === 1)
      exclusiveRefs.push(g.baseX, ...overlaysOf(g.baseX));

    return {
      id: key,
      label: label([g.baseY, primaryYKey, g.baseX, primaryXKey], primaryYKey),
      kind: "cartesian",
      toggleable: true,
      traceIndices: g.traceIndices,
      exclusiveAxisKeys: exclusiveRefs.map(axisRefToLayoutKey),
      primaryXKey,
      primaryYKey,
      rect: {
        x: getDomain(layout, primaryXKey, [0, 1]),
        y: getDomain(layout, primaryYKey, [0, 1]),
      },
    };
  });
};

const approxEqualDomain = (a, b) =>
  Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;

const domainsOverlap = (a, b) => a[0] < b[1] - EPS && b[0] < a[1] - EPS;

const allEqual = (domains) =>
  domains.every((d) => approxEqualDomain(d, domains[0]));

const pairwiseDisjoint = (domains) => {
  for (let i = 0; i < domains.length; i++) {
    for (let j = i + 1; j < domains.length; j++) {
      if (domainsOverlap(domains[i], domains[j])) return false;
    }
  }
  return true;
};

/**
 * Decide whether the panes form a 1-D arrangement reflow can act on.
 *
 * Classification looks at the CARTESIAN panes only. A non-cartesian pane (e.g. a
 * go.Table footer positioned by its own `domain`) no longer disables reflow of
 * the cartesian stack above/below it — reflow simply stays within the cartesian
 * envelope (see `reflowDomains`) so the reserved band is never overrun.
 *
 * @returns {"vertical"|"horizontal"|"none"}
 */
export const classifyArrangement = (panes) => {
  if (!panes) return "none";
  const cartesian = panes.filter((p) => p.kind === "cartesian");
  if (cartesian.length < 2) return "none";

  const xs = cartesian.map((p) => p.rect.x);
  const ys = cartesian.map((p) => p.rect.y);

  if (allEqual(xs) && pairwiseDisjoint(ys)) return "vertical";
  if (allEqual(ys) && pairwiseDisjoint(xs)) return "horizontal";
  return "none";
};

const median = (nums) => {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * Recompute base-axis domains for the visible panes along the reflow axis,
 * proportional to each pane's ORIGINAL band size and preserving the median
 * inter-pane gap. Overlay axes and the cross-axis are untouched.
 *
 * @returns {Object<string, [number, number]>} primary-axis-key -> new domain
 */
export const reflowDomains = (panes, visibleIds, axis) => {
  const dim = axis === "horizontal" ? "x" : "y";
  const keyOf = (p) => (dim === "x" ? p.primaryXKey : p.primaryYKey);

  const cartesian = panes.filter((p) => p.kind === "cartesian");

  // Median gap measured across ALL panes (sorted by band start).
  const sortedAll = [...cartesian].sort(
    (a, b) => a.rect[dim][0] - b.rect[dim][0],
  );
  const gaps = [];
  for (let i = 1; i < sortedAll.length; i++) {
    const gap = sortedAll[i].rect[dim][0] - sortedAll[i - 1].rect[dim][1];
    if (gap > EPS) gaps.push(gap);
  }
  const gap = median(gaps);

  const visibleSet = new Set(visibleIds);
  const visible = sortedAll.filter((p) => visibleSet.has(p.id));
  if (!visible.length) return {};

  // Reflow envelope: the paper band the cartesian stack may occupy — the union
  // of ALL cartesian panes' ORIGINAL bands, not the full `[0, 1]` paper. Paper
  // outside this band is reserved for domain-based traces (e.g. a go.Table
  // footer), so a lone visible pane expands to fill the cartesian region only
  // and never overlaps the reserved band. For a pure cartesian stack that
  // already spans `[0, 1]`, the envelope equals `[0, 1]` and behavior is
  // unchanged. `cartesian` is non-empty here (visible ⊆ cartesian).
  const envMin = Math.min(...cartesian.map((p) => p.rect[dim][0]));
  const envMax = Math.max(...cartesian.map((p) => p.rect[dim][1]));
  const envSpan = Math.max(0, envMax - envMin);

  const sumBands = visible.reduce(
    (acc, p) => acc + (p.rect[dim][1] - p.rect[dim][0]),
    0,
  );
  const available = Math.max(0, envSpan - gap * (visible.length - 1));

  const result = {};
  let cursor = envMin;
  visible.forEach((p) => {
    const band = p.rect[dim][1] - p.rect[dim][0];
    const size =
      sumBands > EPS
        ? available * (band / sumBands)
        : available / visible.length;
    result[keyOf(p)] = [cursor, cursor + size];
    cursor += size + gap;
  });
  return result;
};

// Tolerance for deciding a colorbar "belongs to" a pane's band (see
// `reflowColorbar`). Loose enough to absorb the small overshoot plugins leave
// between a colorbar and its subplot edge, tight enough to reject a
// figure-wide shared bar.
const CB_BAND_TOL = 0.02;

/**
 * The paper-y extent [lo, hi] a colorbar occupies, from its `len` (fraction
 * mode), `y`, and `yanchor`. Returns null when `len`/`y` are not both explicit
 * or the length is in pixels — in those cases the bar is not a rescalable
 * per-subplot bar and must be left untouched.
 */
const colorbarYExtent = (cb) => {
  if (typeof cb.len !== "number" || typeof cb.y !== "number") return null;
  if (cb.lenmode === "pixels") return null; // absolute length: don't rescale
  const anchor = cb.yanchor || "middle";
  if (anchor === "top") return [cb.y - cb.len, cb.y];
  if (anchor === "bottom") return [cb.y, cb.y + cb.len];
  return [cb.y - cb.len / 2, cb.y + cb.len / 2]; // middle
};

/**
 * Rescale/reposition a per-subplot colorbar (e.g. a heatmap's) so it tracks its
 * pane's reflowed y-band. Vertical stacks only: a horizontal strip shares the
 * y-domain, so colorbar length is unaffected by reflow.
 *
 * The colorbar's length scales with the band and its anchor `y` maps linearly
 * from the old band into the new one, preserving the plugin's chosen alignment.
 * Returns a NEW colorbar object, or null when the bar is not scoped to this
 * pane (a figure-wide shared bar, a pixel-length bar, or one anchored to
 * something other than the paper) and must be left untouched.
 *
 * @param {Object|undefined} cb - the trace's original `colorbar`
 * @param {[number, number]} oldBand - the pane's original y-domain
 * @param {[number, number]} newBand - the pane's reflowed y-domain
 */
export const reflowColorbar = (cb, oldBand, newBand) => {
  if (!cb || typeof cb !== "object") return null;
  if (cb.yref && cb.yref !== "paper") return null; // container-ref: out of scope
  const extent = colorbarYExtent(cb);
  if (!extent) return null;
  const [o0, o1] = oldBand;
  // Only touch a bar whose original extent sits within this pane's band; a
  // figure-wide shared bar (extent ~[0,1]) is left alone.
  if (extent[0] < o0 - CB_BAND_TOL || extent[1] > o1 + CB_BAND_TOL) return null;
  const oldH = o1 - o0;
  if (oldH < EPS) return null;
  const scale = (newBand[1] - newBand[0]) / oldH;
  return {
    ...cb,
    len: cb.len * scale,
    y: newBand[0] + (cb.y - o0) * scale,
  };
};

const cloneAxis = (layout, key, override) => ({
  ...(layout[key] || {}),
  ...override,
});

const CARTESIAN_REF_RE = /^[xy]\d*$/;

/**
 * Resolve an annotation/shape/image axis reference (e.g. "y5", "x3 domain",
 * "paper") to the base-axis layout key of the pane it sits in, or null when it
 * is paper-anchored or not a cartesian axis ref.
 */
const refToBaseLayoutKey = (ref, layout) => {
  if (typeof ref !== "string") return null;
  const clean = ref.replace(/ domain$/, "");
  if (!CARTESIAN_REF_RE.test(clean)) return null; // "paper", "x unified", etc.
  return axisRefToLayoutKey(resolveBaseAxis(clean, layout));
};

/**
 * Associate a layout item (annotation/shape/image) to the pane it belongs to,
 * by resolving its axis references. Ambiguous matches against a SHARED axis
 * (more than one pane) are treated as unassociated so we never hide an item
 * that spans panes. In a vertical stack the row (y) axis is authoritative; in a
 * horizontal strip the column (x) axis is.
 */
export const associateItemToPane = (item, panes, layout, arrangement) => {
  const xKey = refToBaseLayoutKey(item.xref, layout);
  const yKey = refToBaseLayoutKey(item.yref, layout);
  const unique = (key, prop) => {
    if (!key) return null;
    const matches = panes.filter((p) => p[prop] === key);
    return matches.length === 1 ? matches[0] : null;
  };
  const byY = unique(yKey, "primaryYKey");
  const byX = unique(xKey, "primaryXKey");
  return arrangement === "horizontal" ? byX || byY : byY || byX;
};

/**
 * Apply a subplot visibility selection to a figure.
 *
 * Recomputes everything from the PRISTINE figure passed in, so it is
 * idempotent — callers must always pass the original `data`/`layout`, never a
 * previously-patched result.
 *
 * @param {Array} data - original traces
 * @param {Object} layout - original layout
 * @param {Array<string>|Set<string>|null} visiblePaneIds - ids to keep visible;
 *   null/undefined means "all visible" (no-op).
 * @param {Object} [options]
 * @param {Array} [options.panes] - precomputed panes (avoids re-deriving)
 * @param {"vertical"|"horizontal"|"none"} [options.arrangement] - plugin
 *   override that takes precedence over auto-detection (the `reflow` hint).
 * @param {Object<string,string>} [options.labels] - explicit pane labels,
 *   forwarded to `derivePanes` when panes are not precomputed.
 * @returns {{ data: Array, layout: Object, panes: Array, arrangement: string }}
 */
export const applySubplotToggle = (data, layout, visiblePaneIds, options) => {
  data = data || [];
  layout = layout || {};
  const {
    panes: givenPanes,
    arrangement: arrangementOverride,
    labels,
  } = options || {};
  const panes = givenPanes || derivePanes(data, layout, { labels });
  const arrangement = arrangementOverride || classifyArrangement(panes);

  // Nothing to toggle, or everything visible -> return originals untouched so
  // the initial render is pixel-identical to what the plugin produced.
  const ids = visiblePaneIds ? Array.from(visiblePaneIds) : null;
  const visibleSet = ids ? new Set(ids) : null;
  const allVisible = !visibleSet || panes.every((p) => visibleSet.has(p.id));
  if (panes.length < 2 || allVisible) {
    return { data, layout, panes, arrangement };
  }

  const isVisible = (p) => visibleSet.has(p.id);

  // Reflow (1-D arrangements only): compute the new base-axis domains up front
  // so both the axis overrides and the colorbar reflow below can use them.
  const reflowed = arrangement === "vertical" || arrangement === "horizontal";
  const domains = reflowed
    ? reflowDomains(
        panes,
        panes.filter(isVisible).map((p) => p.id),
        arrangement,
      )
    : {};

  // Per-trace colorbar overrides: a vertically-stacked heatmap's colorbar is
  // sized/positioned to its subplot band, so when the band reflows the bar must
  // be rescaled to keep tracking the (now larger) subplot — otherwise it stays
  // at its original small height beside the expanded plot. Horizontal strips
  // share the y-domain, so colorbar length is unaffected and left alone.
  const traceColorbars = {};
  if (arrangement === "vertical") {
    panes.forEach((p) => {
      if (p.kind !== "cartesian" || !isVisible(p)) return;
      const newBand = domains[p.primaryYKey];
      if (!newBand) return;
      p.traceIndices.forEach((i) => {
        const next = reflowColorbar(
          data[i] && data[i].colorbar,
          p.rect.y,
          newBand,
        );
        if (next) traceColorbars[i] = next;
      });
    });
  }

  // Per-trace visibility (+ colorbar overrides).
  const traceVisible = {};
  panes.forEach((p) => {
    p.traceIndices.forEach((i) => {
      traceVisible[i] = isVisible(p);
    });
  });
  const newData = data.map((t, i) => {
    const flip = i in traceVisible && t.visible !== traceVisible[i];
    const cb = traceColorbars[i];
    if (!flip && !cb) return t;
    const next = { ...t };
    if (flip) next.visible = traceVisible[i];
    if (cb) next.colorbar = cb;
    return next;
  });

  // Axis overrides: visibility for exclusive axes...
  const overrides = {};
  panes.forEach((p) => {
    const vis = isVisible(p);
    p.exclusiveAxisKeys.forEach((key) => {
      overrides[key] = { ...overrides[key], visible: vis };
    });
  });

  // ...and reflowed domains for visible panes (1-D arrangements only).
  if (reflowed) {
    Object.entries(domains).forEach(([key, domain]) => {
      overrides[key] = { ...overrides[key], domain };
    });
  }

  const newLayout = { ...layout };
  Object.entries(overrides).forEach(([key, ov]) => {
    newLayout[key] = cloneAxis(layout, key, ov);
  });

  // When reflowing, the visible panes overlap the (still-present) plot
  // background rectangles of the hidden panes, which would paint over the
  // traces beneath them. Make the plot background transparent so only the
  // paper background shows through; restored automatically when all panes are
  // visible again (this function returns the pristine layout in that case).
  // Grids do not reflow and therefore never overlap, so their background is
  // left untouched.
  if (reflowed) {
    newLayout.plot_bgcolor = TRANSPARENT;
  }

  // Hide annotations/shapes/images that belong to a hidden pane. Items
  // anchored to a subplot's axis (data refs like "y5", or "y5 domain") follow
  // reflow automatically, so we only ever toggle their `visible`. The runtime
  // vertical line is never touched. Items we cannot associate (paper-anchored,
  // spanning, or on a shared axis) are left untouched.
  const hideItemsForHiddenPanes = (items) => {
    if (!Array.isArray(items)) return items;
    let changed = false;
    const out = items.map((item) => {
      if (item?.meta?.createdBy === "addVerticalLine") return item;
      const pane = associateItemToPane(item, panes, layout, arrangement);
      if (pane && !isVisible(pane) && item.visible !== false) {
        changed = true;
        return { ...item, visible: false };
      }
      return item;
    });
    return changed ? out : items;
  };

  if (layout.annotations)
    newLayout.annotations = hideItemsForHiddenPanes(layout.annotations);
  if (layout.shapes) newLayout.shapes = hideItemsForHiddenPanes(layout.shapes);
  if (layout.images) newLayout.images = hideItemsForHiddenPanes(layout.images);

  return { data: newData, layout: newLayout, panes, arrangement };
};
