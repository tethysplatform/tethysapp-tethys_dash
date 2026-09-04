import {
  CACHE_MAX_ENTRIES,
  getCachedComponents,
  setCachedComponents,
  clearComponentCache,
  cachedComponentCount,
} from "components/map/shapefile/cache";

beforeEach(() => {
  clearComponentCache();
});

describe("the parsed-shapefile cache", () => {
  it("returns what was stored under a key", () => {
    setCachedComponents("a", { shp: 1 });
    expect(getCachedComponents("a")).toEqual({ shp: 1 });
    expect(cachedComponentCount()).toBe(1);
  });

  it("re-storing a key replaces it rather than keeping both", () => {
    // The delete-then-set is what moves an existing key to the most-recent end
    // of the eviction order, so it must not leave a duplicate behind.
    setCachedComponents("a", { shp: 1 });
    setCachedComponents("a", { shp: 2 });
    expect(cachedComponentCount()).toBe(1);
    expect(getCachedComponents("a")).toEqual({ shp: 2 });
  });

  it("evicts the least recently stored entry past the limit", () => {
    for (let i = 0; i <= CACHE_MAX_ENTRIES; i += 1) {
      setCachedComponents(`k${i}`, { shp: i });
    }
    expect(cachedComponentCount()).toBe(CACHE_MAX_ENTRIES);
    expect(getCachedComponents("k0")).toBeNull();
  });

  it("reports nothing for a key never stored", () => {
    expect(getCachedComponents("missing")).toBeNull();
  });
});
