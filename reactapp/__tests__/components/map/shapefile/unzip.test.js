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
