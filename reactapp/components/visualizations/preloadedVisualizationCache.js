// One-shot cache of visualization requests DashboardLoader started before the
// dashboard rendered. It preloads plugin-sourced variable inputs so the
// visualizations that depend on them can fetch with a value on their first
// render; the variable input's own tile then awaits the same request instead
// of running the plugin a second time -- whether that request has already
// settled or is still running past the preload's budget.
//
// Deliberately module-level rather than React state: nothing renders from
// it, an entry is read exactly once and then discarded, and putting it in
// VariableInputsContext would re-render every consumer when an entry is
// taken. DashboardLoader clears it whenever a dashboard mounts or unmounts,
// so an entry can never outlive the dashboard that fetched it.
//
// requestId (the grid item's uuid) -> { key, promise, settled }
const preloadedVisualizations = new Map();

// Key order is normalized so the key does not depend on how the args object
// happened to be assembled.
function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * What a request is built from, rather than the request itself: the source,
 * the grid item's raw (unresolved) args, and the value and date format of
 * every variable input those args reference (`tokens`).
 *
 * Built from the inputs to substitution, not its output, on purpose.
 * Resolving the same args twice is not guaranteed to give the same request:
 * relative date math ("now-1D") resolves against the clock, so the preload
 * and the tile, a few seconds apart, would build different requests for the
 * same configuration and the plugin would run twice. Equal inputs can differ
 * in their resolution only by when they were resolved, so they may share a
 * response; any genuine difference -- an edited arg, a changed variable
 * value -- changes the key.
 */
export function buildPreloadedVisualizationKey({
  source,
  args,
  variableInputValues = {},
  variableInputDateFormats = {},
  tokens = [],
}) {
  const values = {};
  const dateFormats = {};
  for (const token of tokens) {
    values[token] = variableInputValues?.[token] ?? null;
    dateFormats[token] = variableInputDateFormats?.[token] ?? null;
  }
  return stableStringify({
    source: source ?? null,
    args: args ?? null,
    values,
    dateFormats,
  });
}

/**
 * Records a preload request for the grid item `requestId`, while it is still
 * in flight. `key` is the request's buildPreloadedVisualizationKey.
 */
export function setPreloadedVisualization(requestId, key, promise) {
  if (requestId === undefined || requestId === null) return;
  const entry = { key, promise, settled: false };
  const markSettled = () => {
    entry.settled = true;
  };
  promise.then(markSettled, markSettled);
  preloadedVisualizations.set(requestId, entry);
}

/**
 * Returns `{ promise, settled }` for the grid item's preloaded request when
 * it was built from the same `key`, or undefined. The entry is removed either
 * way: removing on read is what makes a later args change or a refresh fetch
 * normally, and an entry that did not match is for a configuration the tile
 * no longer has.
 */
export function takePreloadedVisualization(requestId, key) {
  if (requestId === undefined || requestId === null) return undefined;
  const entry = preloadedVisualizations.get(requestId);
  if (!entry) return undefined;
  preloadedVisualizations.delete(requestId);
  if (entry.key !== key) return undefined;
  return { promise: entry.promise, settled: entry.settled };
}

export function clearPreloadedVisualizations() {
  preloadedVisualizations.clear();
}
