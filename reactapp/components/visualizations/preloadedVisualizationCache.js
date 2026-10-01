// One-shot cache of visualization responses fetched before the dashboard
// rendered. DashboardLoader preloads plugin-sourced variable inputs so the
// visualizations that depend on them can fetch with a value on their first
// render; the variable input's own tile then takes its response from here
// instead of running the plugin a second time.
//
// Deliberately module-level rather than React state: nothing renders from
// it, an entry is read exactly once and then discarded, and putting it in
// VariableInputsContext would re-render every consumer when an entry is
// taken. DashboardLoader clears it whenever a dashboard mounts or unmounts,
// so an entry can never outlive the dashboard that fetched it.
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

/** Cache key for a request: its source plus its fully resolved args. */
export function buildPreloadedVisualizationKey({ source, args }) {
  return stableStringify({ source: source ?? null, args: args ?? null });
}

export function setPreloadedVisualization(request, response) {
  preloadedVisualizations.set(
    buildPreloadedVisualizationKey(request),
    response,
  );
}

/**
 * Returns the preloaded response for this request and removes it, or
 * undefined. Removing on read is what makes a later args change refetch.
 */
export function takePreloadedVisualization(request) {
  const key = buildPreloadedVisualizationKey(request);
  if (!preloadedVisualizations.has(key)) return undefined;
  const response = preloadedVisualizations.get(key);
  preloadedVisualizations.delete(key);
  return response;
}

export function clearPreloadedVisualizations() {
  preloadedVisualizations.clear();
}
