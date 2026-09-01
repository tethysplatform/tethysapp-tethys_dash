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

export function FetchStore(url) {
  this.url = url;
}
export const open = { v2: notMocked, v3: notMocked };
export const get = notMocked;
