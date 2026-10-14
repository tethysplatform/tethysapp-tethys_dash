import { getForViewAndSize } from "ol/extent.js";
import { transform } from "ol/proj.js";
import { register } from "ol/proj/proj4.js";
import proj4 from "proj4";
import {
  EDGE_DENSITY,
  densifyRing,
  footprintInProjection,
  footprintKey,
  outlinesToDraw,
  unwrapLongitudes,
  viewCorners,
  viewFootprint,
} from "components/map/linkedExtent";

// Oregon North state plane (ft) and an Antarctic polar stereographic CRS.
proj4.defs(
  "EPSG:2269",
  "+proj=lcc +lat_0=43.6666666666667 +lon_0=-120.5 +lat_1=46 +lat_2=44.3333333333333 +x_0=2500000.0001424 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=ft +no_defs",
);
proj4.defs(
  "EPSG:3031",
  "+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs",
);
register(proj4);

const eugene = transform([-123.09, 44.05], "EPSG:4326", "EPSG:3857");
const view = {
  center: eugene,
  resolution: 20,
  rotation: 0,
  size: [400, 300],
  projection: "EPSG:3857",
};

describe("viewCorners", () => {
  it("spans the same area OpenLayers reports for an unrotated view", () => {
    const corners = viewCorners(view);
    const [minX, minY, maxX, maxY] = getForViewAndSize(
      view.center,
      view.resolution,
      0,
      view.size,
    );
    expect(corners).toEqual([
      [minX, minY],
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
    ]);
  });

  it("rotates the rectangle with the view, inside OL's bounding extent", () => {
    const rotated = { ...view, rotation: Math.PI / 6 };
    const corners = viewCorners(rotated);
    const [minX, minY, maxX, maxY] = getForViewAndSize(
      rotated.center,
      rotated.resolution,
      rotated.rotation,
      rotated.size,
    );
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    expect(Math.min(...xs)).toBeCloseTo(minX);
    expect(Math.max(...xs)).toBeCloseTo(maxX);
    expect(Math.min(...ys)).toBeCloseTo(minY);
    expect(Math.max(...ys)).toBeCloseTo(maxY);
    // Not axis-aligned any more.
    expect(corners[0][1]).not.toBeCloseTo(corners[1][1]);
  });

  it("returns null for a view with no area", () => {
    expect(viewCorners({ ...view, size: [0, 300] })).toBeNull();
    expect(viewCorners({ ...view, size: undefined })).toBeNull();
    expect(viewCorners({ ...view, resolution: undefined })).toBeNull();
    expect(viewCorners({ ...view, center: null })).toBeNull();
  });
});

describe("densifyRing", () => {
  it("closes the ring and adds points along each edge", () => {
    const ring = densifyRing([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]);
    expect(ring).toHaveLength(4 * (EDGE_DENSITY + 1) + 1);
    expect(ring[ring.length - 1]).toEqual(ring[0]);
    expect(ring[1][1]).toBe(0);
    expect(ring[1][0]).toBeGreaterThan(0);
    expect(ring[1][0]).toBeLessThan(10);
  });
});

describe("viewFootprint", () => {
  it("publishes a Web Mercator view's corners in lon/lat", () => {
    const ring = viewFootprint(view);
    const [minX, minY] = getForViewAndSize(
      view.center,
      view.resolution,
      0,
      view.size,
    );
    const [lon, lat] = transform([minX, minY], "EPSG:3857", "EPSG:4326");
    expect(ring[0][0]).toBeCloseTo(lon, 9);
    expect(ring[0][1]).toBeCloseTo(lat, 9);
    expect(ring[ring.length - 1]).toEqual(ring[0]);
  });

  it("draws as a non-rectangular quadrilateral in another projection", () => {
    const ring = viewFootprint({ ...view, resolution: 2000 });
    const projected = footprintInProjection(ring, "EPSG:2269");
    // Each point matches its own transform.
    projected.forEach((point, i) => {
      const expected = transform(ring[i], "EPSG:4326", "EPSG:2269");
      expect(point[0]).toBeCloseTo(expected[0], 3);
      expect(point[1]).toBeCloseTo(expected[1], 3);
    });
    // The bottom edge is no longer horizontal in state plane coordinates.
    const bottomLeft = projected[0];
    const bottomRight = projected[EDGE_DENSITY + 1];
    expect(Math.abs(bottomLeft[1] - bottomRight[1])).toBeGreaterThan(100);
  });

  it("publishes nothing for a view enclosing a pole", () => {
    expect(
      viewFootprint({
        center: [0, 0],
        resolution: 5000,
        rotation: 0,
        size: [400, 400],
        projection: "EPSG:3031",
      }),
    ).toBeNull();
  });

  it("publishes nothing for an unregistered projection or no area", () => {
    expect(viewFootprint({ ...view, projection: "EPSG:999999" })).toBeNull();
    expect(viewFootprint({ ...view, size: [0, 0] })).toBeNull();
  });

  it("keeps a view across the antimeridian one continuous ring", () => {
    const center = transform([179.9, 0], "EPSG:4326", "EPSG:3857");
    const ring = viewFootprint({ ...view, center, resolution: 200 });
    for (let i = 1; i < ring.length; i += 1) {
      expect(Math.abs(ring[i][0] - ring[i - 1][0])).toBeLessThan(180);
    }
  });
});

describe("unwrapLongitudes", () => {
  it("shifts by whole turns to avoid 180 degree jumps", () => {
    expect(
      unwrapLongitudes([
        [179, 0],
        [-179, 0],
        [-178, 1],
      ]),
    ).toEqual([
      [179, 0],
      [181, 0],
      [182, 1],
    ]);
  });
});

describe("footprintKey", () => {
  it("changes when any input that moves the footprint changes", () => {
    const base = footprintKey(view);
    expect(footprintKey({ ...view })).toBe(base);
    expect(
      footprintKey({ ...view, center: [eugene[0] + 1, eugene[1]] }),
    ).not.toBe(base);
    expect(footprintKey({ ...view, resolution: 21 })).not.toBe(base);
    expect(footprintKey({ ...view, rotation: 0.1 })).not.toBe(base);
    expect(footprintKey({ ...view, size: [401, 300] })).not.toBe(base);
    expect(footprintKey({ ...view, projection: "EPSG:4326" })).not.toBe(base);
  });
});

describe("footprintInProjection", () => {
  it("rejects malformed rings", () => {
    expect(footprintInProjection(null, "EPSG:3857")).toBeNull();
    expect(footprintInProjection([[0, 0]], "EPSG:3857")).toBeNull();
    expect(footprintInProjection(viewFootprint(view), undefined)).toBeNull();
  });
});

describe("outlinesToDraw", () => {
  const ring = [[0, 0]];
  const footprints = [
    { memberId: "self", ring, viewGroup: null },
    { memberId: "detail", ring, viewGroup: null },
    { memberId: "peer", ring, viewGroup: "Valley" },
    { memberId: "hidden", ring: null, viewGroup: null },
  ];

  it("skips itself, members with no footprint, and its view group peers", () => {
    expect(
      outlinesToDraw(footprints, {
        selfIds: ["self"],
        viewGroup: "Valley",
      }).map((f) => f.memberId),
    ).toEqual(["detail"]);
  });

  it("keeps view-grouped members when this map has no view group", () => {
    expect(
      outlinesToDraw(footprints, { selfIds: ["self"], viewGroup: null }).map(
        (f) => f.memberId,
      ),
    ).toEqual(["detail", "peer"]);
  });
});
