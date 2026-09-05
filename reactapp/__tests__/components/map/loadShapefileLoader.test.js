import { loadShapefile } from "components/map/ModuleLoader";
import { acquireComponents } from "components/map/shapefile/acquire";
import { interpretShapefile } from "components/map/shapefile/index";

// OpenLayers only runs a vector source's loader when it needs features for an
// extent, which never happens in jsdom -- so the loader is invoked directly
// here. That is the only way to reach the projection reread and the
// supersession guards inside it.
jest.mock("components/map/shapefile/acquire", () => ({
  acquireComponents: jest.fn(),
}));
jest.mock("components/map/shapefile/index", () => ({
  interpretShapefile: jest.fn(),
}));

const CONFIG = {
  type: "Shapefile",
  props: { url: "https://example.org/basins.zip" },
};

const COLLECTION = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { HUC8: "10190005" },
      geometry: { type: "Point", coordinates: [-105, 40] },
    },
  ],
};

const runLoader = (source, projection) => {
  const success = jest.fn();
  const onError = jest.fn();
  // OL keeps the loader private; loader_ is the only handle on it, and calling
  // it directly is the point -- loadFeatures would need a real tile request.
  // eslint-disable-next-line no-underscore-dangle
  const done = source.loader_(
    [-180, -90, 180, 90],
    1,
    projection,
    success,
    onError,
  );
  return { done, success, onError };
};

beforeEach(() => {
  acquireComponents.mockReset().mockResolvedValue({
    components: { shp: new Uint8Array() },
  });
  interpretShapefile.mockReset().mockReturnValue({
    featureCollection: COLLECTION,
    projectionCode: "EPSG:4326",
  });
});

it("reads the view projection again when the features are inserted", async () => {
  // A long shapefile load can finish after a sibling raster's auto-fit has
  // already moved the view; features parsed into the outgoing projection are
  // drawn far off screen while still reporting the right count.
  const getMapProjection = jest.fn(() => "EPSG:3857");
  const source = loadShapefile(CONFIG, "EPSG:4326", getMapProjection);

  const { done, success } = runLoader(source, { getCode: () => "EPSG:4326" });
  await done;

  expect(getMapProjection).toHaveBeenCalled();
  expect(success).toHaveBeenCalled();
});

it("falls back to the projection OL handed the loader", async () => {
  const source = loadShapefile(CONFIG, "EPSG:4326", undefined);

  const { done, success } = runLoader(source, { getCode: () => "EPSG:3857" });
  await done;

  expect(success).toHaveBeenCalled();
});

it("falls back to the map projection when the loader is given none", async () => {
  const source = loadShapefile(CONFIG, "EPSG:4326", undefined);

  const { done, success } = runLoader(source, undefined);
  await done;

  expect(success).toHaveBeenCalled();
});

it("refuses a source with no url rather than fetching nothing", () => {
  // Mirrors the GeoTIFF sentinel: a half-authored source is silent rather than
  // painting a failure after every keystroke.
  expect(() => loadShapefile({ type: "Shapefile" }, "EPSG:4326")).toThrow(
    "ShapefileEmptySources",
  );
});

it("says nothing when a run is superseded before it finishes", async () => {
  // A second run takes over; the first must write nothing at all, or a late
  // success lands under whichever source owns that layer name now.
  let releaseFirst;
  acquireComponents.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        releaseFirst = () => resolve({ components: { shp: new Uint8Array() } });
      }),
  );
  const source = loadShapefile(CONFIG, "EPSG:4326");

  const first = runLoader(source, { getCode: () => "EPSG:4326" });
  const second = runLoader(source, { getCode: () => "EPSG:4326" });
  await second.done;

  releaseFirst();
  await first.done;

  expect(first.success).not.toHaveBeenCalled();
  expect(first.onError).not.toHaveBeenCalled();
});

it("reports a loader that throws rather than leaving the layer loading forever", async () => {
  // A deploy invalidates the chunk a stale tab asks for; OL calls the loader
  // without a catch of its own.
  acquireComponents.mockRejectedValue(new Error("chunk gone"));
  const source = loadShapefile(CONFIG, "EPSG:4326");

  const { done, onError } = runLoader(source, { getCode: () => "EPSG:4326" });
  await done;

  expect(onError).toHaveBeenCalled();
  expect(source.get("shapefileController").getStatus()).toBe("error");
});

it("says nothing when a superseded run then fails", async () => {
  // Aborting stops the fetch, but a rejection can still arrive afterwards. A
  // run that is no longer current must write nothing at all: its layer may be
  // gone, and a late error would land under whichever source owns that name.
  let rejectFirst;
  acquireComponents.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejectFirst = () => reject(new Error("late failure"));
      }),
  );

  const source = loadShapefile(CONFIG, "EPSG:4326");
  const first = runLoader(source, { getCode: () => "EPSG:4326" });
  const second = runLoader(source, { getCode: () => "EPSG:4326" });
  await second.done;

  rejectFirst();
  await first.done;

  expect(first.onError).not.toHaveBeenCalled();
  expect(source.get("shapefileController").getStatus()).toBe("ready");
});

it("reports an unexpected failure that carries no message", async () => {
  // eslint-disable-next-line prefer-promise-reject-errors
  acquireComponents.mockRejectedValue("bare rejection");
  const source = loadShapefile(CONFIG, "EPSG:4326");

  const { done } = runLoader(source, { getCode: () => "EPSG:4326" });
  await done;

  const controller = source.get("shapefileController");
  expect(controller.getStatus()).toBe("error");
  expect(controller.getError().detail).toMatch(/bare rejection/);
});
