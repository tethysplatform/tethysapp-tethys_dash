// Test stub for zarrita, wired in via jest `moduleNameMapper`. zarrita is
// ESM-only and jest's resolver can't load it, yet ModuleLoader imports it
// transitively through zarrReader. Suites that actually exercise the zarr path
// mock `components/map/zarrReader` (or `zarrita`) with real behavior; for every
// other suite this stub just satisfies the import and throws if invoked.
const notMocked = () => {
  throw new Error(
    "zarrita is stubbed in tests; mock zarrReader to exercise it",
  );
};

export function FetchStore(url, options) {
  this.url = url;
  // The real FetchStore keeps its fetch handler private. Exposing it lets the
  // consolidated-metadata wrapper below reach zarrReader's own fetch override,
  // which is where the timeout and the 403 -> 404 remap live.
  this.fetch = options?.fetch;
}
export const open = { v2: notMocked, v3: notMocked };
export const get = notMocked;

// Location helper. listArrays opens each array against the consolidated store
// through this, so the stub has to carry the same `url` the openers key on.
export const root = (store) => ({
  resolve: (path) => ({ url: `${store?.url ?? ""}/${path}` }),
});

// Consolidated-metadata wrapper. It has two shapes and zarrReader depends on
// telling them apart: a store WITH consolidated metadata comes back wrapped and
// carries `contents()`, a store WITHOUT it comes back as the ORIGINAL, UNWRAPPED
// store and has no `contents()` at all. That second shape is how "nothing to
// list" stays distinct from "the read failed", so the stub must model it rather
// than always looking listable — a stub that always carried `contents()` would
// let a missing capability check pass here and throw a TypeError in the browser.
//
// Default to the unwrapped shape (the common case: no consolidated metadata).
// Module state survives `resetMocks`, so a suite that opts into the listable
// shape must reset it itself.
let consolidatedContents = null;

/** Opt a suite into the listable shape; pass null for the unwrapped one. */
export function setZarritaContents(entries) {
  consolidatedContents = entries;
}

export async function withMaybeConsolidatedMetadata(store) {
  if (!consolidatedContents) return store;
  return { ...store, contents: () => consolidatedContents };
}
