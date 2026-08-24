import {
  validateSourceUrl,
  deriveSiblingUrls,
} from "components/map/shapefile/siblings";

describe("validateSourceUrl", () => {
  it.each([
    ["https://example.org/data/basins.zip", "archive"],
    ["http://example.org/data/basins.ZIP", "archive"],
    ["https://example.org/data/basins.shp", "components"],
    ["https://example.org/data/basins.SHP", "components"],
  ])("accepts %s as %s", (url, form) => {
    expect(validateSourceUrl(url)).toEqual({ form, url });
  });

  it.each([
    "data:application/zip;base64,UEsDBA==",
    "blob:https://example.org/8f3c",
    "file:///home/user/basins.zip",
    "//example.org/basins.zip",
    "ftp://example.org/basins.zip",
  ])("rejects %s before any fetch", (url) => {
    const { error } = validateSourceUrl(url);
    expect(error.reason).toBe("unsupported_scheme");
    // The message has to name what is accepted, since the author's next action
    // is to supply a different URL.
    expect(error.detail).toMatch(/https?/);
  });

  it("rejects a path ending in neither .zip nor .shp and names both forms", () => {
    const { error } = validateSourceUrl(
      "https://example.org/data/basins.geojson",
    );
    expect(error.reason).toBe("unsupported_path");
    expect(error.detail).toContain(".zip");
    expect(error.detail).toContain(".shp");
  });

  it("classifies by the path, not the query string", () => {
    // A download endpoint whose query says "shp" is still not a .shp path, and a
    // .zip path with an unrelated query still is an archive.
    expect(
      validateSourceUrl("https://example.org/download?format=shp").error,
    ).toBeTruthy();
    expect(
      validateSourceUrl("https://example.org/basins.zip?token=abc").form,
    ).toBe("archive");
  });

  it("rejects an empty or non-string url", () => {
    expect(validateSourceUrl("").error.reason).toBe("empty");
    expect(validateSourceUrl(undefined).error.reason).toBe("empty");
  });

  it("rejects a malformed url rather than throwing", () => {
    expect(validateSourceUrl("https://").error).toBeTruthy();
  });
});

describe("deriveSiblingUrls", () => {
  it("replaces the extension for each component", () => {
    expect(deriveSiblingUrls("https://example.org/data/basins.shp")).toEqual({
      shp: "https://example.org/data/basins.shp",
      dbf: "https://example.org/data/basins.dbf",
      prj: "https://example.org/data/basins.prj",
      shx: "https://example.org/data/basins.shx",
    });
  });

  it("preserves a query string and fragment untouched", () => {
    // Presigned links carry a signature computed over the object key, and portal
    // links carry cache tokens. Replacing the extension across the whole URL
    // would corrupt both.
    const derived = deriveSiblingUrls(
      "https://bucket.s3.amazonaws.com/w/basins.shp?X-Amz-Signature=abc123&X-Amz-Expires=3600#frag",
    );
    expect(derived.dbf).toBe(
      "https://bucket.s3.amazonaws.com/w/basins.dbf?X-Amz-Signature=abc123&X-Amz-Expires=3600#frag",
    );
    expect(derived.prj).toContain("?X-Amz-Signature=abc123");
    expect(derived.prj).toContain("#frag");
  });

  it("only replaces the final path segment's extension", () => {
    // A directory named like a component must not be rewritten.
    const derived = deriveSiblingUrls(
      "https://example.org/shp.archive/basins.shp",
    );
    expect(derived.dbf).toBe("https://example.org/shp.archive/basins.dbf");
  });

  it("normalizes the derived extension to lower case from an upper-case source", () => {
    const derived = deriveSiblingUrls("https://example.org/BASINS.SHP");
    expect(derived.dbf).toBe("https://example.org/BASINS.dbf");
  });

  it("handles a filename containing dots", () => {
    const derived = deriveSiblingUrls("https://example.org/wbd.huc8.v2.shp");
    expect(derived.prj).toBe("https://example.org/wbd.huc8.v2.prj");
  });
});
