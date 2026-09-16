// Proximity ranking for click/hover query results. Extracted from utilities.js so
// its coverage is measured against a module no test mocks — the utilities mocks
// (jest.mock(..., () => ({ ...jest.requireActual(...) }))) shadow-instrument
// utilities.js and under-report these branches in the merged coverage report.

import {
  LineString,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Polygon,
  Point,
} from "ol/geom";

import {
  RASTER_SOURCE_TYPES,
  shiftEPSG3857ExtentAndPoint,
} from "components/map/utilities";

// Rank tiers, lowest first. Snapped selection beats everything because a snap is
// a deliberate pick; a pixel readout loses to anything with real geometry
// because its coordinates are the click itself; anything we cannot measure sinks
// rather than being dropped, so the popup never loses a feature silently.
const RANK_TIER = {
  SNAPPED: 0,
  REAL_GEOMETRY: 1,
  RASTER: 2,
  UNRANKABLE: 3,
};

// Geometry-kind sub-rank inside the real-geometry tier. A polygon containing the
// click is zero distance away, so without this a basin covering the map would
// take slot 1 on every click inside it, ahead of the gauge the user aimed at.
export const RANK_KIND = {
  POINT: 0,
  LINE: 1,
  POLYGON: 2,
};

const ESRI_IMAGE_SOURCE_TYPE = "ESRI Image and Map Service";

/**
 * Read a queried feature's geometry into OL geometries plus a kind, for ranking.
 *
 * Deliberately NOT `buildHighlightFeatures`, which looks similar but cannot
 * serve here: it returns `[]` only for a null/non-object input and funnels every
 * other unrecognized shape into `new Point(geometries.coordinates)`, which
 * throws. That is survivable when it runs once for an already-selected feature;
 * ranking runs over every feature of every click and every debounced hover, so
 * one malformed geometry in one layer would take down the whole gesture. It also
 * has no MultiPoint branch, which would sink a MultiPoint gauge below the raster
 * readings -- the exact inversion the tiering exists to prevent.
 *
 * Accepts the ESRI identify shapes (`x`/`y`, `paths`, `rings`) and the GeoJSON
 * shapes (`type` + `coordinates`) the query paths return. Coordinates are used
 * as-is; the callers' sources carry no projection.
 *
 * @returns {{kind: number, geometries: Array}|null} `null` when the shape is not
 *   one this understands, which routes the feature to the unrankable tier.
 */
export function classifyGeometryForRanking(geometry) {
  if (!geometry || typeof geometry !== "object") return null;

  // ESRI identify shapes carry no `type`, so test them by key.
  if ("x" in geometry && "y" in geometry) {
    return {
      kind: RANK_KIND.POINT,
      geometries: [new Point([geometry.x, geometry.y])],
    };
  }
  if (Array.isArray(geometry.points)) {
    // ESRI's multipoint shape. Without this branch a dead-on multipoint hit
    // falls through to the unrankable tier and sorts below the raster readings.
    return {
      kind: RANK_KIND.POINT,
      geometries: [new MultiPoint(geometry.points)],
    };
  }
  if (Array.isArray(geometry.paths)) {
    return {
      kind: RANK_KIND.LINE,
      geometries: geometry.paths.map((path) => new LineString(path)),
    };
  }
  if (Array.isArray(geometry.rings)) {
    // ESRI `rings` is one polygon's outer ring plus holes -- Polygon, not
    // MultiPolygon. Only the closest point matters here, so the distinction is
    // about reading the nesting correctly, not about rendering.
    return {
      kind: RANK_KIND.POLYGON,
      geometries: [new Polygon(geometry.rings)],
    };
  }

  const coordinates = geometry.coordinates;
  switch (geometry.type) {
    case "Point":
      return { kind: RANK_KIND.POINT, geometries: [new Point(coordinates)] };
    case "MultiPoint":
      return {
        kind: RANK_KIND.POINT,
        geometries: [new MultiPoint(coordinates)],
      };
    case "LineString":
      return {
        kind: RANK_KIND.LINE,
        geometries: [new LineString(coordinates)],
      };
    case "MultiLineString":
      return {
        kind: RANK_KIND.LINE,
        geometries: [new MultiLineString(coordinates)],
      };
    case "Polygon":
      return {
        kind: RANK_KIND.POLYGON,
        geometries: [new Polygon(coordinates)],
      };
    case "MultiPolygon":
      return {
        kind: RANK_KIND.POLYGON,
        geometries: [new MultiPolygon(coordinates)],
      };
    case "GeometryCollection": {
      // Rank a mixed collection by its strongest member: a collection holding a
      // point and a polygon should behave like the point it contains. The
      // GeoJSON-family builder already explodes collections into one feature per
      // member, so this path is reached only by ESRI, WMS and PMTiles results.
      const members = (geometry.geometries ?? [])
        .map((member) => classifyGeometryForRanking(member))
        .filter(Boolean);
      if (members.length === 0) return null;
      return {
        kind: Math.min(...members.map((member) => member.kind)),
        geometries: members.flatMap((member) => member.geometries),
      };
    }
    default:
      return null;
  }
}

/**
 * Map-unit distance from `coordinate` to the nearest point of any geometry.
 *
 * @returns {number} `Infinity` when no finite distance can be computed, which
 *   routes the feature to the unrankable tier rather than into an engine-defined
 *   position in the sort.
 */
export function distanceToGeometries(geometries, coordinate) {
  let nearest = Infinity;
  for (const geometry of geometries) {
    // Containment is zero distance. `getClosestPoint` on a polygon answers with
    // the nearest point on its BOUNDARY even when the coordinate is inside it,
    // so without this a click in the middle of a basin would score as far from
    // that basin. The query builder already reads polygon hits this way.
    if (geometry.intersectsCoordinate?.(coordinate)) return 0;

    const closest = geometry.getClosestPoint(coordinate);
    // Check the closest POINT for finiteness, not just the distance. An empty or
    // malformed geometry makes OL return `[null, null]`, and `null - 0` is `0`
    // in JS -- so the subtraction below would quietly produce a distance of
    // exactly 0 and rank the broken feature FIRST. A NaN coordinate is caught
    // here too, since NaN is not finite.
    if (!Number.isFinite(closest?.[0]) || !Number.isFinite(closest?.[1])) {
      continue;
    }
    const distance = Math.hypot(
      closest[0] - coordinate[0],
      closest[1] - coordinate[1],
    );
    if (Number.isFinite(distance) && distance < nearest) nearest = distance;
  }
  return nearest;
}

// ArcGIS `/identify` is sent a request shifted by whole world-widths when the
// view is panned past the antimeridian (see shiftEPSG3857ExtentAndPoint), and it
// answers in that shifted space. The offset is computed inside the builder and
// discarded, so recompute it here and move the CLICK into the same space rather
// than moving every returned geometry out of it -- the distance is identical and
// it is one addition instead of a deep coordinate walk.
function esriRankingCoordinate(map, coordinate) {
  const view = map.getView();
  // shiftEPSG3857ExtentAndPoint has no projection guard of its own, so keep it
  // here; the antimeridian offset itself is delegated to that shared helper (the
  // inverse of the shift the /identify builder applied) rather than recomputed.
  if (view.getProjection().getCode() !== "EPSG:3857") return coordinate;
  return shiftEPSG3857ExtentAndPoint(view.calculateExtent(), coordinate).point;
}

/**
 * Order the features one click or hover turned up, nearest first.
 *
 * Without this the order is layer order then OL draw order, so clicking a dense
 * cluster opens the popup on whichever feature happened to draw last. The popup
 * always opens on index 0, so array order is slot order.
 *
 * Ranking is by tier, then geometry kind inside the real-geometry tier, then
 * distance, then arrival order. The sort is stable via index decoration so ties
 * keep the order the query produced.
 *
 * Pass the TRUE click coordinate (`evt.coordinate`), not the snapped one: every
 * layer was queried at the true click, and ranking against the snapped point
 * would re-sort every other layer around a point the user did not click.
 *
 * @returns {Array} a new array; the input is not mutated.
 */
export function rankQueriedFeatures(features, map, coordinate) {
  if (!Array.isArray(features) || features.length < 2) {
    return Array.isArray(features) ? [...features] : features;
  }

  let esriCoordinate;
  const ranked = features.map((feature, index) => {
    const sourceType =
      feature?.__wrapperLayer?.configuration?.props?.source?.type;

    let tier = RANK_TIER.REAL_GEOMETRY;
    let kind = RANK_KIND.POINT;
    let distance = Infinity;

    if (feature?.__snapped) {
      tier = RANK_TIER.SNAPPED;
    } else if (RASTER_SOURCE_TYPES.includes(sourceType)) {
      tier = RANK_TIER.RASTER;
    }

    if (tier === RANK_TIER.SNAPPED || tier === RANK_TIER.REAL_GEOMETRY) {
      let classified = null;
      try {
        classified = classifyGeometryForRanking(feature?.geometry);
      } catch {
        // A shape the classifier accepted by key but OL rejected on
        // construction. One bad geometry in one layer must not abort the click.
        classified = null;
      }
      if (classified) {
        let measureFrom = coordinate;
        if (sourceType === ESRI_IMAGE_SOURCE_TYPE) {
          esriCoordinate ??= esriRankingCoordinate(map, coordinate);
          measureFrom = esriCoordinate;
        }
        distance = distanceToGeometries(classified.geometries, measureFrom);
        kind = classified.kind;
      }
      if (!Number.isFinite(distance)) {
        // Nothing measurable. A snapped feature stays pinned -- it was chosen
        // deliberately, so it keeps slot 1 even when its geometry is unreadable.
        if (tier !== RANK_TIER.SNAPPED) tier = RANK_TIER.UNRANKABLE;
        distance = Infinity;
      }
    }

    return { feature, index, tier, kind, distance };
  });

  ranked.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.tier === RANK_TIER.REAL_GEOMETRY && a.kind !== b.kind) {
      return a.kind - b.kind;
    }
    if (a.tier === RANK_TIER.SNAPPED || a.tier === RANK_TIER.REAL_GEOMETRY) {
      if (a.distance !== b.distance) return a.distance - b.distance;
    }
    // Raster and unrankable keep the layer order they arrived in.
    return a.index - b.index;
  });

  return ranked.map((entry) => entry.feature);
}
