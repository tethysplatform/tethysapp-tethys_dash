import proj4 from "proj4";
import { register } from "ol/proj/proj4.js";
import { get as getProjection } from "ol/proj.js";
import wktParser from "wkt-parser";

// Coordinate reference systems the map can resolve, beyond the ones OpenLayers
// ships with. OL natively handles EPSG:4326, EPSG:3857 and every WGS84 UTM zone
// via its own projection factory; everything else -- State Plane, Albers, the
// polar stereographics -- resolves only if a definition is registered here.
//
// Two things are registered, from two different places, and the split matters:
//
//   1. Codes named by a layer that carries no definition of its own. A WMS or
//      GeoTIFF layer says "EPSG:5041" and nothing more, so the definition has to
//      already be on hand. That is what the table below is for.
//
//   2. Definitions a layer brings with it. A shapefile carries its CRS as WKT in
//      its .prj, so it needs no table entry -- see registerProjectionFromWkt.
//
// The table therefore only has to cover case 1, which is why it is short. A
// survey of the live dashboards found exactly one layer naming a non-native code
// (a WMS layer requesting EPSG:5041); EPSG:5070 is included because US national
// hydrology datasets commonly name Conus Albers by code. Adding a zone is a
// table entry plus a control point, and `ensureProjection` registers it on
// demand rather than at startup.
//
// Registration is deliberately *not* done for the whole table at load time.
// `register` builds pairwise transforms across every registered code, so its
// cost is quadratic: measured at 99ms for two definitions on top of proj4's
// built-ins, and hundreds of milliseconds once a State-Plane-sized set is in
// play. This module is imported statically by the map, so that cost would land
// before first render on every dashboard, including the ones with no layer that
// needs it.

// Definitions, extents and control points are taken from PROJ's EPSG database
// rather than hand-derived. The control points sit away from each projection's
// origin so they exercise the standard parallels and scale factor -- a point at
// the origin would return the false easting no matter how wrong the rest of the
// definition was. proj4 agrees with PROJ on both to sub-millimetre, so the test
// that round-trips them is a cross-implementation check, not a self-consistency
// one.
export const PROJECTION_TABLE = {
  "EPSG:5041": {
    name: "WGS 84 / UPS North (E,N)",
    definition:
      "+proj=stere +lat_0=90 +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +datum=WGS84 +units=m +no_defs",
    extent: [-1405881, -1405881, 5405881, 5405881],
    controlPoint: { lonLat: [-45, 70], projected: [414390.988, 414390.988] },
  },
  "EPSG:5070": {
    name: "NAD83 / Conus Albers",
    definition:
      "+proj=aea +lat_0=23 +lon_0=-96 +lat_1=29.5 +lat_2=45.5 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs",
    extent: [-2916311, 153629, 2945750, 3255275],
    controlPoint: { lonLat: [-105, 40], projected: [-760465.745, 1923013.98] },
  },
};

// Registered when this module is evaluated. Keep this list to codes a layer
// actually names today; the rest of the table is reachable through
// `ensureProjection` at the point of use.
export const INITIAL_CODES = ["EPSG:5041", "EPSG:5070"];

// Prefix for projections registered from a layer's own WKT. Kept distinct from
// any authority namespace so a synthetic code can never be mistaken for -- or
// collide with -- a real EPSG code.
const WKT_CODE_PREFIX = "WKT:";

/**
 * Whether OpenLayers resolves this code on its own, without anything registered
 * here.
 *
 * Asked by code rather than by registry lookup, because once a definition is
 * registered the two are indistinguishable through the registry -- which is the
 * whole point of the question. Used to keep the raster auto-fit from adopting a
 * newly-registered projection as the map's *view* projection: adoption calls
 * setView and publishes the adopted code into the map-extent variable other
 * visualizations read, so widening it is a separate change with its own
 * verification. Registered projections still serve as data projections, so a
 * raster in one renders by reprojection instead.
 *
 * @param {string} code Projection code.
 * @returns {boolean}
 */
export function isNativelyResolvable(code) {
  if (typeof code !== "string") return false;
  const match = /^EPSG:(\d+)$/.exec(code.trim());
  if (!match) return false;
  const id = Number(match[1]);
  if ([4326, 3857, 900913, 102100].includes(id)) return true;
  // OpenLayers ships a UTM projection factory covering the WGS84 zones.
  return (id > 32600 && id < 32661) || (id > 32700 && id < 32761);
}

// Registering a definition does not give the resulting projection an extent:
// `register` builds it from the proj4 definition, and a proj4 definition has
// nowhere to carry one. Verified against the installed versions -- the extent
// reads null until it is set explicitly. OpenLayers uses projection extent for
// view clamping, so a projection that ever becomes the view projection without
// one degrades silently.
function applyExtent(code) {
  const entry = PROJECTION_TABLE[code];
  const projection = getProjection(code);
  if (entry?.extent && projection && !projection.getExtent()) {
    projection.setExtent(entry.extent);
  }
}

// Definitions have to be declared and registered together. `register` iterates
// everything already in proj4's registry, so declaring the whole table and then
// registering a subset is not possible -- the subset is chosen by what gets
// declared.
function registerCodes(codes) {
  const pending = codes.filter(
    (code) => PROJECTION_TABLE[code] && !getProjection(code),
  );
  if (pending.length === 0) return;
  pending.forEach((code) => {
    proj4.defs(code, PROJECTION_TABLE[code].definition);
  });
  register(proj4);
  pending.forEach(applyExtent);
}

/**
 * Resolve a projection by code, registering its table entry if it has not been
 * registered yet.
 *
 * Re-registering is safe: OpenLayers skips any code already in its projection
 * cache, so previously registered projections keep their identity and their
 * applied extent.
 *
 * @param {string} code Projection code, e.g. "EPSG:5070".
 * @returns {import("ol/proj/Projection.js").default|null} The projection, or
 *   null when the code is neither native nor in the table.
 */
export function ensureProjection(code) {
  if (!code) return null;
  const existing = getProjection(code);
  if (existing) return existing;
  if (!PROJECTION_TABLE[code]) return null;
  registerCodes([code]);
  return getProjection(code);
}

// Stable, dependency-free hash of the normalized WKT. Two textually different
// but semantically equivalent definitions hash differently and so register
// separately; that costs a duplicate registration and nothing else, which is
// cheaper than trying to canonicalise WKT.
function wktCode(wkt) {
  const normalized = wkt.replace(/\s+/g, "");
  let hash = 5381;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0;
  }
  return `${WKT_CODE_PREFIX}${(hash >>> 0).toString(36)}`;
}

// The outermost AUTHORITY node, which is the one belonging to the projected CRS
// itself. A WKT string carries several -- the datum and the geographic CRS have
// their own -- so reading the last one out of the raw text would pick the wrong
// node. wkt-parser hands back only the top-level one.
function claimedCode(parsed) {
  const authority = parsed?.AUTHORITY;
  if (!authority) return null;
  const [name] = Object.keys(authority);
  if (!name) return null;
  return `${name}:${authority[name]}`;
}

// Where to probe a candidate definition. It has to be a point the projection
// actually covers: an Albers centred on -96 returns nothing usable at [0, 0], so
// probing there would report a perfectly good definition as unsupported. The
// parsed definition carries its own centre in radians, which is always inside
// the domain.
function probePoint(parsed) {
  const toDegrees = 180 / Math.PI;
  const lon = parsed?.long0 ?? parsed?.longc;
  const lat = parsed?.lat0 ?? parsed?.lat_ts;
  return [
    typeof lon === "number" ? lon * toDegrees : 0,
    typeof lat === "number" ? lat * toDegrees : 0,
  ];
}

// A WKT whose projection method proj4 does not implement parses cleanly, and
// declaring it does not fail either -- it only goes wrong at transform time, and
// then with an internal error that names nothing. The only way to tell is to
// transform something, which is why every candidate is probed.
//
// This runs before `register`, deliberately. `register` constructs a transform
// for every pair of registered codes, so an unusable definition sitting in the
// registry makes it throw -- taking down projections that were working. A
// candidate that fails is removed again before anything else sees it.
function definitionUsable(code, parsed) {
  try {
    const [x, y] = proj4("EPSG:4326", code, probePoint(parsed));
    return Number.isFinite(x) && Number.isFinite(y);
  } catch {
    return false;
  }
}

/**
 * Register a coordinate reference system from a layer's own WKT definition.
 *
 * Never overwrites a definition that already resolves. A layer's WKT is
 * authoritative for that layer's own features, but the projection registry is
 * global to the browser session -- so letting one layer's parameters replace a
 * code every other layer resolves through would make rendering depend on which
 * dashboard was opened first. When the WKT claims a code that already resolves,
 * the existing definition is reused and nothing is written. Otherwise the
 * definition is registered under a synthetic code, never under the claimed one.
 *
 * @param {string} wkt WKT definition, typically the contents of a .prj.
 * @returns {{code: string}|{error: {reason: string, detail: string}}} The code to
 *   read coordinates with, or a failure describing what could not be resolved.
 */
export function registerProjectionFromWkt(wkt) {
  if (typeof wkt !== "string" || wkt.trim() === "") {
    return {
      error: { reason: "empty", detail: "No projection definition was found." },
    };
  }

  let parsed;
  try {
    parsed = wktParser(wkt);
  } catch (error) {
    return {
      error: {
        reason: "unparsable",
        detail: `The projection definition could not be parsed: ${error.message}`,
      },
    };
  }

  const claimed = claimedCode(parsed);
  if (claimed && (getProjection(claimed) || ensureProjection(claimed))) {
    return { code: claimed };
  }

  const code = wktCode(wkt);
  if (getProjection(code)) return { code };

  proj4.defs(code, wkt);
  if (!definitionUsable(code, parsed)) {
    delete proj4.defs[code];
    const method = parsed?.projName ?? "an unnamed projection method";
    return {
      error: {
        reason: "unsupported",
        detail: `The projection "${method}"${
          claimed ? ` (${claimed})` : ""
        } could not be resolved.`,
      },
    };
  }

  register(proj4);
  return { code };
}

registerCodes(INITIAL_CODES);
