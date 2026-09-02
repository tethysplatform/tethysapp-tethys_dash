// Cache of decompressed shapefile components, keyed on resolved URL.
//
// Layer preservation keeps a layer from refetching when nothing about it
// changed, but it only helps while the resolved URL stays the same. A variable
// input driving the URL refetches the whole archive even when toggling back to a
// value loaded seconds earlier, which is a common interaction on a
// variable-input dashboard -- and that is what this covers.
//
// It caches component buffers rather than parsed features deliberately. Buffers
// are already under the size ceiling by construction, so a small entry count has
// an exact memory bound; parsed GeoJSON runs several times the archive size, and
// any honest byte cap on that would hold about one entry. A hit skips the
// network hop and the decompression -- the slow, failure-prone part -- and still
// re-parses, which is fast and deterministic.
//
// Scope is the browser session. Entries persist across dashboards visited in one
// tab, which is correct: the bytes at a URL do not depend on which dashboard
// asked for them. A host that changes content mid-session serves the cached copy
// until eviction.
export const CACHE_MAX_ENTRIES = 3;

// Insertion-ordered, so the first key is the least recently used.
const entries = new Map();

/**
 * Look up cached components, marking the entry as most recently used.
 *
 * @param {string} key Resolved source URL.
 * @returns {Record<string, Uint8Array>|null}
 */
export function getCachedComponents(key) {
  if (!entries.has(key)) return null;
  const components = entries.get(key);
  // Re-insert to move it to the end of the eviction order.
  entries.delete(key);
  entries.set(key, components);
  return components;
}

/**
 * Store components against a resolved URL, evicting the least recently used
 * entry once the cache is full.
 *
 * @param {string} key Resolved source URL.
 * @param {Record<string, Uint8Array>} components
 */
export function setCachedComponents(key, components) {
  if (entries.has(key)) entries.delete(key);
  entries.set(key, components);
  while (entries.size > CACHE_MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    entries.delete(oldest);
  }
}

/** Empty the cache. Exists for tests; nothing in the app needs it. */
export function clearComponentCache() {
  entries.clear();
}

/** Current entry count. Exists for tests. */
export function cachedComponentCount() {
  return entries.size;
}
