// Vocabulary shared by the two vector paths that load features asynchronously:
// the plugin-layer fetcher and the shapefile source's loader.
//
// They are deliberately not unified -- one pushes on its own schedule and paints
// into a preserved layer, the other is pulled by OpenLayers only when a layer is
// mounted and rendering, and forcing one abstraction over both would mean
// parameterizing five axes for two implementations. What they do share is these
// names. Keeping them in one place turns a future divergence into a visible edit
// rather than two string literals drifting apart.

/** Why an in-flight load stopped. */
export const CANCEL_REASON = {
  // A newer load for the same layer started.
  SUPERSEDED: "superseded",
  // The layer was removed from the map.
  REMOVED: "removed",
  // The map itself went away.
  UNMOUNT: "unmount",
};

/**
 * What kind of failure a layer is in.
 *
 * The distinction that carries weight is whether re-running the same request
 * could succeed. A fetch-stage failure might: the host could come back, a
 * signature could be refreshed. The rest cannot -- a missing projection, an
 * unresolvable coordinate system, a malformed component and a source over the
 * size ceiling all need the author to change something, so offering a viewer a
 * retry button for them invites them to re-download megabytes to fail the same
 * way.
 */
export const ERROR_KIND = {
  // Something wrong with the configured URL itself. Distinct from FETCH because
  // the host is not the problem: suggesting the file be converted because the
  // host is unreachable would be misleading, and a retry would fail identically.
  INPUT: "input",
  FETCH: "fetch",
  PARSE: "parse",
  TOO_LARGE: "too_large",
  PROJECTION: "projection",
  // The plugin path's own kind, for a layer whose plugin is not installed.
  UNAVAILABLE: "unavailable",
};

/** Failure kinds where re-running the same request could plausibly succeed. */
const RETRYABLE = [ERROR_KIND.FETCH];

// Failures that surface at the parse stage but are really about the transfer.
// A portal that answers with an HTML error page under a success status, and an
// archive whose bytes stopped arriving partway through, are both transient
// conditions of the host or the connection -- the most retryable things that
// can happen. Classifying them by the stage they were noticed at reported them
// as the author's file being wrong and withheld the retry that would have
// fixed them.
const TRANSFER_REASONS = ["wrong_content_type", "incomplete_archive"];

/**
 * Whether a retry affordance should be offered for a failure of this kind.
 *
 * @param {string} kind One of ERROR_KIND.
 * @returns {boolean}
 */
export function isRetryable(kind) {
  return RETRYABLE.includes(kind);
}

/**
 * Map a typed failure from the shapefile pipeline onto a status error kind.
 *
 * The pipeline reports a stage and a reason; the status surface cares about
 * whether the failure is worth retrying and what to call it.
 *
 * @param {{stage?: string, reason?: string}} failure
 * @returns {string} One of ERROR_KIND.
 */
export function errorKindFor(failure) {
  if (failure?.stage === "input") return ERROR_KIND.INPUT;
  if (failure?.reason === "too_large") return ERROR_KIND.TOO_LARGE;
  if (
    failure?.reason === "missing_projection" ||
    failure?.reason === "unresolvable_projection"
  ) {
    return ERROR_KIND.PROJECTION;
  }
  if (TRANSFER_REASONS.includes(failure?.reason)) return ERROR_KIND.FETCH;
  return failure?.stage === "parse" ? ERROR_KIND.PARSE : ERROR_KIND.FETCH;
}
