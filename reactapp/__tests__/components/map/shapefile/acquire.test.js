import { zipSync } from "fflate";
import { bytes } from "../../../utilities/bytes";
import {
  acquireComponents,
  DEFAULT_MAX_BYTES,
} from "components/map/shapefile/acquire";
import {
  clearComponentCache,
  cachedComponentCount,
  CACHE_MAX_ENTRIES,
} from "components/map/shapefile/cache";

const MB = 1024 * 1024;
const ARCHIVE = zipSync({
  "basins.shp": bytes("SHPBODY"),
  "basins.dbf": bytes("DBFBODY"),
  "basins.prj": bytes('PROJCS["NAD_1983_Albers"]'),
  "basins.shx": bytes("SHXBODY"),
});

// Minimal Response stand-in. The configured environment exposes no response
// stream, so the implementation reads whole bodies and only arrayBuffer is
// needed here.
function respond({ status = 200, contentType = "application/zip", body } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name === "content-type" ? contentType : null) },
    arrayBuffer: async () => (body ?? new Uint8Array()).buffer,
  };
}

let fetchMock;

beforeEach(() => {
  clearComponentCache();
  fetchMock = jest.fn();
  global.fetch = fetchMock;
});

describe("acquireComponents — validation happens before any request", () => {
  it.each([
    "data:application/zip;base64,UEsDBA==",
    "blob:https://example.org/8f3c",
    "file:///tmp/basins.zip",
  ])("rejects %s without fetching", async (url) => {
    const result = await acquireComponents(url);
    expect(result.error.reason).toBe("unsupported_scheme");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an unsupported path without fetching", async () => {
    const result = await acquireComponents(
      "https://example.org/basins.geojson",
    );
    expect(result.error.reason).toBe("unsupported_path");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("acquireComponents — archive form", () => {
  it("returns the four components from one request", async () => {
    fetchMock.mockResolvedValue(respond({ body: ARCHIVE }));

    const result = await acquireComponents("https://example.org/basins.zip");

    expect(result.error).toBeUndefined();
    expect(Object.keys(result.components).sort()).toEqual([
      "dbf",
      "prj",
      "shp",
      "shx",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports a markup response as the wrong content type, naming what came back", async () => {
    fetchMock.mockResolvedValue(
      respond({
        contentType: "text/html; charset=utf-8",
        body: bytes("<html>"),
      }),
    );

    const result = await acquireComponents("https://example.org/basins.zip");

    expect(result.error.stage).toBe("parse");
    expect(result.error.reason).toBe("wrong_content_type");
    expect(result.error.detail).toContain("text/html");
  });

  it("reports a non-success status and names the candidate causes together", async () => {
    fetchMock.mockResolvedValue(respond({ status: 403 }));

    const result = await acquireComponents("https://example.org/basins.zip");

    expect(result.error.stage).toBe("fetch");
    expect(result.error.status).toBe(403);
    // A browser cannot distinguish these, so the message must not claim one.
    expect(result.error.detail).toMatch(/cross-origin/i);
    expect(result.error.detail).toMatch(/expired signature/i);
  });

  it("reports a network rejection as unreachable rather than throwing", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await acquireComponents("https://example.org/basins.zip");

    expect(result.error.reason).toBe("unreachable");
    expect(result.error.detail).toMatch(/cross-origin/i);
  });

  it("refuses an archive that expands past the ceiling", async () => {
    const bomb = zipSync({
      "basins.shp": new Uint8Array(8 * MB),
      "basins.prj": bytes('PROJCS["x"]'),
    });
    fetchMock.mockResolvedValue(respond({ body: bomb }));

    const result = await acquireComponents("https://example.org/basins.zip", {
      maxBytes: 1 * MB,
    });

    expect(result.error.reason).toBe("too_large");
    expect(result.error.permitted).toBe(1 * MB);
  });
});

describe("acquireComponents — sibling form", () => {
  function siblingResponder(overrides = {}) {
    return (url) => {
      const extension = url.split("?")[0].split(".").pop();
      if (overrides[extension]) return Promise.resolve(overrides[extension]);
      return Promise.resolve(
        respond({
          contentType: "application/octet-stream",
          body: bytes(`${extension.toUpperCase()}BODY`),
        }),
      );
    };
  }

  it("derives and fetches every component", async () => {
    fetchMock.mockImplementation(siblingResponder());

    const result = await acquireComponents("https://example.org/basins.shp");

    expect(result.error).toBeUndefined();
    expect(Object.keys(result.components).sort()).toEqual([
      "dbf",
      "prj",
      "shp",
      "shx",
    ]);
    const requested = fetchMock.mock.calls.map(([u]) => u);
    expect(requested).toEqual([
      "https://example.org/basins.shp",
      "https://example.org/basins.dbf",
      "https://example.org/basins.prj",
      "https://example.org/basins.shx",
    ]);
  });

  it("preserves a signed query string on every derived request", async () => {
    fetchMock.mockImplementation(siblingResponder());

    await acquireComponents(
      "https://bucket.s3.amazonaws.com/basins.shp?X-Amz-Signature=abc",
    );

    fetchMock.mock.calls.forEach(([url]) => {
      expect(url).toContain("X-Amz-Signature=abc");
    });
  });

  it("treats a 404 on an optional component as absent", async () => {
    fetchMock.mockImplementation(
      siblingResponder({ dbf: respond({ status: 404 }) }),
    );

    const result = await acquireComponents("https://example.org/basins.shp");

    expect(result.error).toBeUndefined();
    expect(result.components.dbf).toBeUndefined();
    expect(result.components.shp).toBeTruthy();
  });

  it("treats any other status on an optional component as a reported failure", async () => {
    // This is the distinction that matters: a transient 403 routed into the
    // absent path would fall back to the author-supplied projection and draw the
    // features somewhere else entirely, with no error.
    fetchMock.mockImplementation(
      siblingResponder({ prj: respond({ status: 403 }) }),
    );

    const result = await acquireComponents("https://example.org/basins.shp");

    expect(result.error.reason).toBe("component_status");
    expect(result.error.component).toBe("prj");
    expect(result.error.status).toBe(403);
  });

  it("reports a missing .shp rather than continuing", async () => {
    fetchMock.mockImplementation(
      siblingResponder({ shp: respond({ status: 404 }) }),
    );

    const result = await acquireComponents("https://example.org/basins.shp");

    expect(result.error.stage).toBe("fetch");
    expect(result.error.status).toBe(404);
    // Stops at the first component rather than paying for the other three.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses once the components total past the ceiling", async () => {
    const half = new Uint8Array(600 * 1024);
    fetchMock.mockImplementation(
      siblingResponder({
        shp: respond({ body: half }),
        dbf: respond({ body: half }),
      }),
    );

    const result = await acquireComponents("https://example.org/basins.shp", {
      maxBytes: 1 * MB,
    });

    expect(result.error.reason).toBe("too_large");
  });
});

describe("acquireComponents — cancellation", () => {
  it("resolves as cancelled when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await acquireComponents("https://example.org/basins.zip", {
      signal: controller.signal,
    });

    expect(result.cancelled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves as cancelled with no failure message when the body read aborts", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(() => {
      controller.abort();
      const error = new Error("aborted");
      error.name = "AbortError";
      return Promise.reject(error);
    });

    const result = await acquireComponents("https://example.org/basins.zip", {
      signal: controller.signal,
    });

    expect(result.cancelled).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

describe("acquireComponents — caching", () => {
  it("serves a repeat of the same resolved URL without fetching", async () => {
    fetchMock.mockResolvedValue(respond({ body: ARCHIVE }));

    const first = await acquireComponents("https://example.org/basins.zip");
    const second = await acquireComponents("https://example.org/basins.zip");

    expect(first.fromCache).toBeUndefined();
    expect(second.fromCache).toBe(true);
    expect(second.components.shp).toEqual(first.components.shp);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches a different resolved URL", async () => {
    fetchMock.mockResolvedValue(respond({ body: ARCHIVE }));

    await acquireComponents("https://example.org/a.zip");
    await acquireComponents("https://example.org/b.zip");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("evicts the least recently used entry once full", async () => {
    fetchMock.mockResolvedValue(respond({ body: ARCHIVE }));

    for (let i = 0; i <= CACHE_MAX_ENTRIES; i += 1) {
      await acquireComponents(`https://example.org/${i}.zip`);
    }
    expect(cachedComponentCount()).toBe(CACHE_MAX_ENTRIES);

    // The first URL was evicted, so it fetches again.
    fetchMock.mockClear();
    await acquireComponents("https://example.org/0.zip");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failure, so a retry retries", async () => {
    fetchMock.mockResolvedValueOnce(respond({ status: 503 }));
    const failed = await acquireComponents("https://example.org/basins.zip");
    expect(failed.error).toBeTruthy();

    fetchMock.mockResolvedValueOnce(respond({ body: ARCHIVE }));
    const retried = await acquireComponents("https://example.org/basins.zip");

    expect(retried.error).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("acquireComponents — defaults", () => {
  it("defaults the ceiling to 25 MB", () => {
    expect(DEFAULT_MAX_BYTES).toBe(25 * MB);
  });
});
