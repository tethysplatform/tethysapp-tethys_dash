/**
 * Landing-page dashboard filtering.
 *
 * Names and descriptions are matched differently on purpose:
 *
 * - A name is matched as a plain substring of the whole query, stopwords and
 *   all, because a dashboard called "The Basin" has to be findable by typing
 *   "the".
 * - A description is matched by its significant words only. Requiring "the" to
 *   appear would make it match nearly every dashboard in the app, which is
 *   noise rather than a filter.
 *
 * A query made up entirely of stopwords therefore contributes no description
 * terms, and falls back to name matching alone.
 */

// Common English function words. Deliberately short: an aggressive list starts
// discarding words people search on ("no data", "not started").
export const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "if",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "than",
  "that",
  "the",
  "then",
  "this",
  "to",
  "was",
  "were",
  "with",
]);

/**
 * Casefold and strip accents so "clasificacion" finds "Clasificación".
 *
 * NFD splits an accented character into its base letter plus a combining mark,
 * which the Diacritic property then removes.
 */
export function normalizeForSearch(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * The words of a query that are worth matching a description against.
 *
 * Splits on anything that is not a letter or a digit, so punctuation in either
 * the query or the description ("Exercise #2", "flood-depth") does not prevent
 * a match.
 */
export function significantTokens(query) {
  return normalizeForSearch(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token !== "" && !STOPWORDS.has(token));
}

/**
 * True when a dashboard should stay visible for the given query.
 *
 * An empty or whitespace-only query matches everything, so clearing the box
 * restores the full list.
 */
export function matchesDashboardSearch({ name, description }, query) {
  const normalizedQuery = normalizeForSearch(query).trim();
  if (normalizedQuery === "") return true;

  if (normalizeForSearch(name).includes(normalizedQuery)) return true;

  const tokens = significantTokens(query);
  if (tokens.length === 0) return false;

  const normalizedDescription = normalizeForSearch(description);
  return tokens.every((token) => normalizedDescription.includes(token));
}

/** Dashboards matching the query, in their original order. */
export function filterDashboards(dashboards, query) {
  return (dashboards ?? []).filter((dashboard) =>
    matchesDashboardSearch(dashboard, query),
  );
}
