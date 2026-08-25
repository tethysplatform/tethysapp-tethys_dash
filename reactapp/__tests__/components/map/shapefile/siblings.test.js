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

  it("rejects a path naming a different format outright", () => {
    const { error } = validateSourceUrl(
      "https://example.org/data/basins.geojson",
    );
    expect(error.reason).toBe("unsupported_path");
    expect(error.detail).toContain("geojson");
  });

  it.each([
    "https://hub.arcgis.com/api/v3/datasets/abc_0/downloads/data?format=shp",
    "https://opendata.arcgis.com/api/v3/datasets/abc_0/downloads/data?format=shp",
    "https://example.org/download?format=shp",
    "https://example.org/export",
  ])("accepts the extensionless download endpoint %s", (url) => {
    // This is the shape most portals actually hand out: ArcGIS Hub serves
    // shapefiles from a path ending in "data", with the format in the query
    // string. Rejecting on path shape alone turned away the host class the
    // pre-implementation survey found matters most -- so an unrecognised path is
    // treated as an archive and the bytes decide.
    expect(validateSourceUrl(url).form).toBe("archive");
  });

  it("still classifies a recognised extension from the path, not the query", () => {
    expect(
      validateSourceUrl("https://example.org/basins.zip?token=abc").form,
    ).toBe("archive");
    expect(
      validateSourceUrl("https://example.org/basins.shp?token=abc").form,
    ).toBe("components");
  });

  it("marks every url rejection as an input problem, not a host problem", () => {
    // These must not suggest converting the file because the host is
    // unreachable, and must not offer a retry: the host is fine, and re-running
    // an unsupported url fails identically forever.
    [
      "data:application/zip;base64,UEs=",
      "//example.org/basins.zip",
      "https://example.org/basins.geojson",
      "",
    ].forEach((url) => {
      expect(validateSourceUrl(url).error.stage).toBe("input");
    });
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
