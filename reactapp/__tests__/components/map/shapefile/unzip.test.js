import { zipSync } from "fflate";
import { bytes, text } from "../../../utilities/bytes";
import {
  unzipShapefileComponents,
  createByteBudget,
} from "components/map/shapefile/unzip";

const MB = 1024 * 1024;

function archive(entries) {
  return zipSync(entries);
}

const MINIMAL = {
  "basins.shp": bytes("SHPBODY"),
  "basins.dbf": bytes("DBFBODY"),
  "basins.prj": bytes('PROJCS["NAD_1983_Albers"]'),
  "basins.shx": bytes("SHXBODY"),
};

describe("createByteBudget", () => {
  // The accounting is tested directly because the archives fflate can build
  // always declare their sizes. A streamed archive that declares none takes the
  // byte-counting path instead, and this is where that arithmetic lives.
  it("accepts a total exactly at the ceiling", () => {
    const budget = createByteBudget(100);
    expect(budget.add(60)).toBe(true);
    expect(budget.add(40)).toBe(true);
    expect(budget.exceeded).toBe(false);
    expect(budget.observed).toBe(100);
  });

  it("rejects the byte that crosses the ceiling and stays rejected", () => {
    const budget = createByteBudget(100);
    expect(budget.add(60)).toBe(true);
    expect(budget.add(41)).toBe(false);
    expect(budget.exceeded).toBe(true);
    expect(budget.observed).toBe(101);
    // Once over, it does not recover even if nothing more is added.
    expect(budget.add(0)).toBe(false);
  });

  it("rejects a single addition larger than the whole ceiling", () => {
    const budget = createByteBudget(100);
    expect(budget.add(1000)).toBe(false);
    expect(budget.observed).toBe(1000);
  });

  it("treats an unknown size as zero rather than NaN", () => {
    const budget = createByteBudget(100);
    expect(budget.add(undefined)).toBe(true);
    expect(budget.observed).toBe(0);
  });
});

describe("unzipShapefileComponents", () => {
  it("extracts the four components and decodes nothing", () => {
    const result = unzipShapefileComponents(archive(MINIMAL), {
      maxBytes: 10 * MB,
    });
    expect(result.error).toBeUndefined();
    expect(Object.keys(result.components).sort()).toEqual([
      "dbf",
      "prj",
      "shp",
      "shx",
    ]);
    // Buffers come back raw; decoding the .prj is the interpretation step's job.
    expect(result.components.shp).toBeInstanceOf(Uint8Array);
    expect(text(result.components.prj)).toContain("PROJCS");
  });

  it("decompresses a deflate-compressed archive at all", () => {
    // Without registering the inflate decoder, fflate's Unzip carries only a
    // pass-through and every member of a real archive throws on start. This is
    // the regression guard for that.
    const compressible = {
      "basins.shp": new Uint8Array(64 * 1024),
      "basins.prj": bytes('PROJCS["x"]'),
    };
    const zipped = archive(compressible);
    expect(zipped.length).toBeLessThan(64 * 1024);

    const result = unzipShapefileComponents(zipped, { maxBytes: 10 * MB });
    expect(result.error).toBeUndefined();
    expect(result.components.shp.length).toBe(64 * 1024);
  });

  it("tolerates components nested in a directory", () => {
    const result = unzipShapefileComponents(
      archive({
        "wbd/basins.shp": bytes("SHPBODY"),
        "wbd/basins.prj": bytes('PROJCS["x"]'),
      }),
      { maxBytes: 10 * MB },
    );
    expect(result.error).toBeUndefined();
    expect(result.components.shp).toBeTruthy();
  });

  it("ignores members that are not shapefile components", () => {
    const result = unzipShapefileComponents(
      archive({
        ...MINIMAL,
        "readme.txt": bytes("notes"),
        "metadata.xml": bytes("<x/>"),
      }),
      { maxBytes: 10 * MB },
    );
    expect(result.error).toBeUndefined();
    expect(Object.keys(result.components).sort()).toEqual([
      "dbf",
      "prj",
      "shp",
      "shx",
    ]);
  });

  it("refuses an archive whose declared component size exceeds the ceiling, before expanding it", () => {
    // 8 MiB of zeros compresses to a few KB, so this is a real bomb ratio: the
    // ceiling has to bind on the declared expansion, not on the transfer.
    const zipped = archive({
      "basins.shp": new Uint8Array(8 * MB),
      "basins.prj": bytes('PROJCS["x"]'),
    });
    expect(zipped.length).toBeLessThan(64 * 1024);

    const result = unzipShapefileComponents(zipped, { maxBytes: 1 * MB });

    expect(result.components).toBeUndefined();
    expect(result.error.reason).toBe("too_large");
    expect(result.error.observed).toBeGreaterThanOrEqual(8 * MB);
    expect(result.error.permitted).toBe(1 * MB);
    // The message states both numbers, since the author's next move depends on
    // how far over the source is.
    expect(result.error.detail).toMatch(/8|permitted|MB/i);
  });

  it("refuses on the sum of components, not on any single one", () => {
    const half = 600 * 1024;
    const zipped = archive({
      "basins.shp": new Uint8Array(half),
      "basins.dbf": new Uint8Array(half),
      "basins.prj": bytes('PROJCS["x"]'),
    });
    const result = unzipShapefileComponents(zipped, { maxBytes: 1 * MB });
    expect(result.error.reason).toBe("too_large");
  });

  it("does not expand a bomb hidden in an irrelevant member", () => {
    // Members that are not shapefile components are never started, so a bomb
    // parked in one costs nothing and must not fail the archive either.
    const zipped = archive({
      ...MINIMAL,
      "bomb.bin": new Uint8Array(64 * MB),
    });
    const result = unzipShapefileComponents(zipped, { maxBytes: 1 * MB });
    expect(result.error).toBeUndefined();
    expect(result.components.shp).toBeTruthy();
  });

  it("reports an archive carrying more than one .shp rather than choosing", () => {
    const result = unzipShapefileComponents(
      archive({
        "basins.shp": bytes("A"),
        "gages.shp": bytes("B"),
        "basins.prj": bytes('PROJCS["x"]'),
      }),
      { maxBytes: 10 * MB },
    );
    expect(result.components).toBeUndefined();
    expect(result.error.reason).toBe("ambiguous_archive");
    expect(result.error.detail).toContain("basins.shp");
    expect(result.error.detail).toContain("gages.shp");
  });

  it("reports an archive with no .shp at all", () => {
    const result = unzipShapefileComponents(
      archive({ "readme.txt": bytes("nothing here") }),
      { maxBytes: 10 * MB },
    );
    expect(result.error.reason).toBe("no_shapefile");
  });

  it("reports a buffer that is not an archive rather than throwing", () => {
    const result = unzipShapefileComponents(bytes("<html>404</html>"), {
      maxBytes: 10 * MB,
    });
    expect(result.components).toBeUndefined();
    expect(result.error.reason).toBe("unreadable_archive");
    expect(result.error.stage).toBe("parse");
  });
});

describe("unzipShapefileComponents — a declared size is a hint, not a bound", () => {
  // The ceiling is the safety property that justifies fetching an arbitrary
  // remote archive into a viewer's browser at all. It was applied to the size
  // the local header declares, and fflate's inflater ignores that number
  // entirely -- so a member that under-declared expanded without limit.
  function lieAboutUncompressedSize(zipped, claimed) {
    const lying = zipped.slice();
    // Local file header: uncompressed size is a 32-bit LE field at offset 22.
    new DataView(lying.buffer, lying.byteOffset, lying.byteLength).setUint32(
      22,
      claimed,
      true,
    );
    return lying;
  }

  it("refuses an oversized member that declares its real size", () => {
    const honest = zipSync({ "basins.shp": new Uint8Array(40 * MB) });
    const result = unzipShapefileComponents(honest, { maxBytes: 25 * MB });
    expect(result.error.reason).toBe("too_large");
  });

  it("still refuses it when the header under-declares", () => {
    const zipped = zipSync({ "basins.shp": new Uint8Array(40 * MB) });
    const result = unzipShapefileComponents(
      lieAboutUncompressedSize(zipped, 100),
      { maxBytes: 25 * MB },
    );

    expect(result.error).toBeDefined();
    expect(result.error.reason).toBe("too_large");
    // And the refusal reflects what actually arrived, not the claim.
    expect(result.error.observed).toBeGreaterThan(25 * MB);
  });

  it("does not double-charge an honest member", () => {
    // The declared size is charged up front as a fast path; the arriving bytes
    // must reconcile against it rather than adding to it, or a legitimate
    // archive at half the ceiling would be refused.
    const body = new Uint8Array(4 * MB).fill(7);
    const result = unzipShapefileComponents(zipSync({ "basins.shp": body }), {
      maxBytes: 6 * MB,
    });
    expect(result.error).toBeUndefined();
    expect(result.components.shp).toHaveLength(4 * MB);
  });
});

describe("unzipShapefileComponents — selecting the shapefile's own parts", () => {
  it("reads a shapefile zipped on macOS", () => {
    // Finder writes an AppleDouble twin beside every file. "._basins.shp" ends
    // in ".shp", so it was counted as a second shapefile and the archive was
    // rejected as ambiguous -- telling the author to point at a single
    // shapefile, which is what they had done.
    const result = unzipShapefileComponents(
      archive({
        ...MINIMAL,
        "__MACOSX/._basins.shp": bytes("APPLEDOUBLE"),
        "__MACOSX/._basins.dbf": bytes("APPLEDOUBLE"),
      }),
      { maxBytes: MB },
    );

    expect(result.error).toBeUndefined();
    expect(text(result.components.shp)).toBe("SHPBODY");
    expect(text(result.components.dbf)).toBe("DBFBODY");
  });

  it("ignores a bare ._ twin outside a __MACOSX directory", () => {
    const result = unzipShapefileComponents(
      archive({ ...MINIMAL, "._basins.shp": bytes("APPLEDOUBLE") }),
      { maxBytes: MB },
    );
    expect(result.error).toBeUndefined();
    expect(text(result.components.shp)).toBe("SHPBODY");
  });

  it("does not let an unrelated .dbf become the attribute table", () => {
    // Components were keyed by extension alone, so whichever .dbf appeared last
    // in the archive won -- silently drawing the geometry with another
    // dataset's attributes rather than failing.
    const result = unzipShapefileComponents(
      archive({ ...MINIMAL, "extra/other.dbf": bytes("WRONGDBF") }),
      { maxBytes: MB },
    );

    expect(result.error).toBeUndefined();
    expect(text(result.components.dbf)).toBe("DBFBODY");
  });

  it("does not let an unrelated .dbf win by appearing first either", () => {
    const result = unzipShapefileComponents(
      archive({ "extra/other.dbf": bytes("WRONGDBF"), ...MINIMAL }),
      { maxBytes: MB },
    );
    expect(text(result.components.dbf)).toBe("DBFBODY");
  });

  it("takes the parts sharing the .shp's directory and stem", () => {
    const result = unzipShapefileComponents(
      archive({
        "nested/basins.shp": bytes("SHPBODY"),
        "nested/basins.dbf": bytes("DBFBODY"),
        "nested/basins.cpg": bytes("UTF-8"),
        "basins.dbf": bytes("WRONGDBF"),
      }),
      { maxBytes: MB },
    );

    expect(text(result.components.shp)).toBe("SHPBODY");
    expect(text(result.components.dbf)).toBe("DBFBODY");
    expect(text(result.components.cpg)).toBe("UTF-8");
  });

  it("still reports two genuinely different shapefiles as ambiguous", () => {
    const result = unzipShapefileComponents(
      archive({ ...MINIMAL, "gages.shp": bytes("OTHERSHP") }),
      { maxBytes: MB },
    );
    expect(result.error.reason).toBe("ambiguous_archive");
  });

  it("ignores directory entries", () => {
    const result = unzipShapefileComponents(
      archive({ "layers/": bytes(""), ...MINIMAL }),
      { maxBytes: MB },
    );
    expect(result.error).toBeUndefined();
  });
});

describe("unzipShapefileComponents — a transfer that did not finish", () => {
  it("distinguishes a truncated archive from a file that is not one", () => {
    // A dropped connection is the most retryable failure there is, and it was
    // reported with the same reason as "this is not a zip" -- permanent, no
    // retry offered, and worded as though the author had picked the wrong URL.
    // The body has to be big enough that the cut lands inside the .shp's own
    // stream. MINIMAL's members are a few bytes each and .shp comes first, so a
    // cut past it leaves a complete .shp with its optional siblings merely
    // absent -- which is a success, correctly.
    const body = new Uint8Array(200 * 1024);
    for (let i = 0; i < body.length; i += 1) body[i] = (i * 31) % 251;
    const full = zipSync({ "basins.shp": body, "basins.dbf": body });
    const truncated = full.slice(0, Math.floor(full.length * 0.5));

    const result = unzipShapefileComponents(truncated, { maxBytes: MB });

    expect(result.error.reason).toBe("incomplete_archive");
    expect(result.error.detail).toMatch(/did not arrive completely/);
  });

  it("still reports a payload that never was an archive as unreadable", () => {
    const html = bytes("<!doctype html><title>404</title>");
    const result = unzipShapefileComponents(html, { maxBytes: MB });
    expect(result.error.reason).toBe("unreadable_archive");
  });
});
