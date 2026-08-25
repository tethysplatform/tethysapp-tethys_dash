import { get as getProjection } from "ol/proj.js";
import VectorSource from "ol/source/Vector.js";
import moduleLoader, { loadShapefile } from "components/map/ModuleLoader";
import { acquireComponents } from "components/map/shapefile/acquire";
import { interpretShapefile } from "components/map/shapefile/index";

// The pipeline is covered by its own suites; what matters here is the wiring --
// which projection features land in, what drives the load events, and what the
// controller exposes.
jest.mock("components/map/shapefile/acquire", () => ({
  acquireComponents: jest.fn(),
}));
jest.mock("components/map/shapefile/index", () => ({
  interpretShapefile: jest.fn(),
}));

const FULL_EXTENT = [-Infinity, -Infinity, Infinity, Infinity];

// A single point at -105, 40 in degrees, so the projection features are read
// into is observable from the resulting coordinates.
const COLLECTION = {
  type: "FeatureCollection",
  crs: { type: "name", properties: { name: "EPSG:4326" } },
  features: [
    {
      type: "Feature",
      properties: { NAME: "basin" },
      geometry: { type: "Point", coordinates: [-105, 40] },
    },
  ],
};

function config(props = {}) {
  return {
    type: "Shapefile",
    props: { url: "https://example.org/basins.zip", ...props },
  };
}

function drive(source, projectionCode = "EPSG:3857") {
  source.loadFeatures(FULL_EXTENT, 1, getProjection(projectionCode));
}

beforeEach(() => {
  acquireComponents.mockReset();
  interpretShapefile.mockReset();
  acquireComponents.mockResolvedValue({
    components: { shp: new Uint8Array() },
  });
  interpretShapefile.mockResolvedValue({
    featureCollection: COLLECTION,
    projectionCode: "EPSG:4326",
  });
});

describe("loadShapefile — construction", () => {
  it("builds a vector source that loads through a loader, not a url", () => {
    const source = loadShapefile(config(), "EPSG:3857");
    expect(source).toBeInstanceOf(VectorSource);
    // A `url` would hand fetching to OpenLayers, which cannot decompress an
    // archive or enforce a byte ceiling.
    expect(source.getUrl()).toBeUndefined();
  });

  it("throws the empty sentinel for a source with no url", () => {
    // Mirrors the GeoTIFF sentinel: a half-authored source stays silent rather
    // than painting a failure after every keystroke.
    expect(() => loadShapefile({ type: "Shapefile", props: {} })).toThrow(
      "ShapefileEmptySources",
    );
    expect(() => loadShapefile({ type: "Shapefile" })).toThrow(
      "ShapefileEmptySources",
    );
  });

  it("exposes one controller carrying abort, status, error and reset", () => {
    const controller = loadShapefile(config(), "EPSG:3857").get(
      "shapefileController",
    );
    expect(typeof controller.abort).toBe("function");
    expect(typeof controller.getStatus).toBe("function");
    expect(typeof controller.getError).toBe("function");
    expect(typeof controller.reset).toBe("function");
    expect(controller.getStatus()).toBe("idle");
  });
});

describe("loadShapefile — projection at insertion", () => {
  it("reads features against the projection supplied when they are inserted", async () => {
    // The construction-time projection is deliberately wrong here. A shapefile
    // is the slowest-loading vector source in the app, so it is the one most
    // exposed to a sibling raster's auto-fit changing the view mid-load --
    // features parsed into the outgoing projection are drawn far off screen
    // while still reporting the right count.
    let current = "EPSG:4326";
    const source = loadShapefile(config(), "EPSG:3857", () => current);

    current = "EPSG:3857";
    drive(source, "EPSG:4326");
    await new Promise(process.nextTick);

    const [x, y] = source.getFeatures()[0].getGeometry().getCoordinates();
    // Web Mercator metres, from the getter -- not the degrees either the
    // construction argument or the loader argument would have given.
    expect(Math.abs(x)).toBeGreaterThan(1e6);
    expect(Math.abs(y)).toBeGreaterThan(1e6);
  });

  it("falls back to the loader's own projection when no getter is supplied", async () => {
    const source = loadShapefile(config(), "EPSG:3857");
    drive(source, "EPSG:4326");
    await new Promise(process.nextTick);

    const [x] = source.getFeatures()[0].getGeometry().getCoordinates();
    expect(x).toBeCloseTo(-105, 6);
  });
});

describe("loadShapefile — load events and status", () => {
  it("fires featuresloadend and reports ready on success", async () => {
    const source = loadShapefile(config(), "EPSG:3857");
    const started = jest.fn();
    const ended = jest.fn();
    source.on("featuresloadstart", started);
    source.on("featuresloadend", ended);

    drive(source);
    await new Promise(process.nextTick);

    expect(started).toHaveBeenCalled();
    expect(ended).toHaveBeenCalled();
    expect(source.get("shapefileController").getStatus()).toBe("ready");
    expect(source.getFeatures()).toHaveLength(1);
  });

  it("fires featuresloaderror and keeps the typed failure on an acquisition failure", async () => {
    acquireComponents.mockResolvedValue({
      error: { stage: "fetch", reason: "unreachable", detail: "no host" },
    });
    const source = loadShapefile(config(), "EPSG:3857");
    const errored = jest.fn();
    source.on("featuresloaderror", errored);

    drive(source);
    await new Promise(process.nextTick);

    expect(errored).toHaveBeenCalled();
    const controller = source.get("shapefileController");
    expect(controller.getStatus()).toBe("error");
    // featuresloaderror carries no payload, so the typed failure has to travel
    // on the source for anything to report a real message.
    expect(controller.getError()).toEqual({
      stage: "fetch",
      reason: "unreachable",
      detail: "no host",
    });
    expect(source.getFeatures()).toHaveLength(0);
  });

  it("keeps the typed failure on an interpretation failure", async () => {
    interpretShapefile.mockResolvedValue({
      error: {
        stage: "parse",
        reason: "missing_projection",
        detail: "no prj",
      },
    });
    const source = loadShapefile(config(), "EPSG:3857");

    drive(source);
    await new Promise(process.nextTick);

    expect(source.get("shapefileController").getError().reason).toBe(
      "missing_projection",
    );
  });

  it("returns to idle with no failure when the load is cancelled", async () => {
    acquireComponents.mockResolvedValue({ cancelled: true });
    const source = loadShapefile(config(), "EPSG:3857");

    drive(source);
    await new Promise(process.nextTick);

    const controller = source.get("shapefileController");
    expect(controller.getStatus()).toBe("idle");
    expect(controller.getError()).toBeNull();
  });

  it("passes the author's projection through as the fallback", async () => {
    const source = loadShapefile(
      config({ projection: "EPSG:5070" }),
      "EPSG:3857",
    );
    drive(source);
    await new Promise(process.nextTick);

    expect(interpretShapefile).toHaveBeenCalledWith(expect.anything(), {
      fallbackProjection: "EPSG:5070",
    });
  });
});

describe("loadShapefile — controller actions", () => {
  it("aborts an in-flight load through the controller", async () => {
    let capturedSignal;
    acquireComponents.mockImplementation((url, { signal }) => {
      capturedSignal = signal;
      return new Promise(() => {});
    });
    const source = loadShapefile(config(), "EPSG:3857");

    drive(source);
    await new Promise(process.nextTick);
    expect(capturedSignal.aborted).toBe(false);

    source.get("shapefileController").abort("removed");

    expect(capturedSignal.aborted).toBe(true);
    expect(source.get("shapefileController").getStatus()).toBe("idle");
  });

  it("aborting when nothing is in flight is a no-op", () => {
    const source = loadShapefile(config(), "EPSG:3857");
    expect(() =>
      source.get("shapefileController").abort("removed"),
    ).not.toThrow();
  });

  it("reset re-invokes the loader", async () => {
    // Asserted by invocation count rather than by whether the loaded extent was
    // cleared: clearing the extent alone leaves the loader un-invoked, so an
    // extent assertion passes while retry is broken.
    const source = loadShapefile(config(), "EPSG:3857");
    drive(source);
    await new Promise(process.nextTick);
    expect(acquireComponents).toHaveBeenCalledTimes(1);

    source.get("shapefileController").reset();
    drive(source);
    await new Promise(process.nextTick);

    expect(acquireComponents).toHaveBeenCalledTimes(2);
    expect(source.get("shapefileController").getStatus()).toBe("ready");
  });

  it("reset clears a previous failure before reloading", async () => {
    acquireComponents.mockResolvedValueOnce({
      error: { stage: "fetch", reason: "unreachable", detail: "no host" },
    });
    const source = loadShapefile(config(), "EPSG:3857");
    drive(source);
    await new Promise(process.nextTick);
    expect(source.get("shapefileController").getError()).toBeTruthy();

    source.get("shapefileController").reset();

    expect(source.get("shapefileController").getError()).toBeNull();
    expect(source.get("shapefileController").getStatus()).toBe("idle");
  });
});

describe("moduleLoader dispatch", () => {
  it("builds a shapefile source on the first call and on the second", async () => {
    // The dispatch for client-loading types is duplicated across the
    // module-cache path and the post-import path. Missing one means the first
    // layer of a type works and the second breaks.
    const first = await moduleLoader(config(), "EPSG:3857");
    const second = await moduleLoader(config(), "EPSG:3857");

    expect(first).toBeInstanceOf(VectorSource);
    expect(second).toBeInstanceOf(VectorSource);
    expect(first.get("shapefileController")).toBeTruthy();
    expect(second.get("shapefileController")).toBeTruthy();
    expect(first).not.toBe(second);
  });

  it("forwards the live projection getter through moduleLoader", async () => {
    const source = await moduleLoader(config(), "EPSG:3857", () => "EPSG:3857");
    drive(source, "EPSG:4326");
    await new Promise(process.nextTick);

    const [x] = source.getFeatures()[0].getGeometry().getCoordinates();
    expect(Math.abs(x)).toBeGreaterThan(1e6);
  });

  it("propagates the empty sentinel out of moduleLoader", async () => {
    await expect(
      moduleLoader({ type: "Shapefile", props: {} }, "EPSG:3857"),
    ).rejects.toThrow("ShapefileEmptySources");
  });
});

// A real tick boundary rather than a fixed count of microtasks: the pipeline
// awaits two mocked stages, and counting `Promise.resolve()`s to match is the
// kind of coupling that breaks the moment a stage is added.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("loadShapefile — a run that throws", () => {
  it("reports an error instead of reporting 'loading' forever", async () => {
    // Both pipeline stages report failures as return values, so nothing throws
    // by design. A dynamic import still can, when a deploy invalidates the
    // chunk a stale tab asks for -- and OpenLayers calls the loader without a
    // catch of its own, so the rejection escaped and the layer sat on
    // "loading" with no error shown and no retry offered.
    interpretShapefile.mockRejectedValue(new Error("Loading chunk 283 failed"));
    const source = loadShapefile(config(), "EPSG:3857");
    const controller = source.get("shapefileController");

    drive(source);
    await flush();

    expect(controller.getStatus()).toBe("error");
    expect(controller.getError().detail).toMatch(/Loading chunk 283 failed/);
  });

  it("offers a retry for it, since a transient import failure clears", async () => {
    const { isRetryable, errorKindFor } = require("components/map/layerStatus");
    interpretShapefile.mockRejectedValue(new Error("network"));
    const source = loadShapefile(config(), "EPSG:3857");
    const controller = source.get("shapefileController");

    drive(source);
    await flush();

    expect(isRetryable(errorKindFor(controller.getError()))).toBe(true);
  });
});

describe("loadShapefile — a run that is no longer current", () => {
  function deferred() {
    let settle;
    const promise = new Promise((resolve) => {
      settle = resolve;
    });
    return { promise, settle };
  }

  it("adds no features and writes no status once aborted", async () => {
    // Aborting stops the fetch, but the parse after it is CPU-bound and runs to
    // completion regardless. Status is kept per layer name, so a late success
    // from a discarded source lands under whichever source owns that name now.
    const parse = deferred();
    interpretShapefile.mockReturnValue(parse.promise);
    const source = loadShapefile(config(), "EPSG:3857");
    const controller = source.get("shapefileController");

    drive(source);
    await flush();

    controller.abort("removed");
    parse.settle({
      featureCollection: COLLECTION,
      projectionCode: "EPSG:4326",
    });
    await flush();

    expect(source.getFeatures()).toHaveLength(0);
    expect(controller.getStatus()).toBe("idle");
  });

  it("does not let a superseded run overwrite a newer run's outcome", async () => {
    // Nothing disables retry while a load runs, and refresh() exists to force
    // the loader to run again -- so two runs overlap, and the first must not
    // report anything when it finally finishes.
    const first = deferred();
    interpretShapefile.mockReturnValueOnce(first.promise);
    const source = loadShapefile(config(), "EPSG:3857");
    const controller = source.get("shapefileController");

    drive(source);
    await flush();
    expect(controller.getStatus()).toBe("loading");

    // In the browser, reset()'s refresh() makes the renderer re-invoke the
    // loader on its next frame. There is no renderer here, so the second run is
    // driven explicitly -- which is also what the existing suite does.
    interpretShapefile.mockResolvedValueOnce({
      error: { stage: "parse", reason: "unreadable_geometry", detail: "bad" },
    });
    controller.reset();
    drive(source);
    await flush();
    expect(controller.getStatus()).toBe("error");

    // Now the first run's parse lands. It must stay silent rather than
    // replacing the live error with a success.
    first.settle({
      featureCollection: COLLECTION,
      projectionCode: "EPSG:4326",
    });
    await flush();

    expect(controller.getStatus()).toBe("error");
    expect(controller.getError().detail).toBe("bad");
  });

  it("aborts the in-flight run when reset supersedes it", async () => {
    let captured = null;
    acquireComponents.mockImplementation((_url, { signal }) => {
      captured = signal;
      return new Promise(() => {});
    });
    const source = loadShapefile(config(), "EPSG:3857");

    drive(source);
    await flush();
    expect(captured.aborted).toBe(false);

    source.get("shapefileController").reset();
    expect(captured.aborted).toBe(true);
  });
});
