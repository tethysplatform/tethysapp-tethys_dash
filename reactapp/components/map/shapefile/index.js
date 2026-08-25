import { strFromU8 } from "fflate";
import {
  ensureProjection,
  registerProjectionDefinition,
} from "components/map/projections";

/**
 * Turn shapefile component buffers into a GeoJSON feature collection carrying
 * its coordinate reference.
 *
 * The output shape matches what the existing vector-swap path already consumes:
 * a feature collection whose `crs` names the projection its coordinates are in.
 * That keeps the two vector paths interchangeable, and keeps OpenLayers objects
 * out of here entirely -- features are built from this collection at insertion
 * time, against whatever the view projection is by then.
 *
 * @param {Record<string, Uint8Array>} components Buffers keyed by extension.
 * @param {{fallbackProjection?: string}} [options] `fallbackProjection` is the
 *   author-supplied projection, used only when the source carries no .prj.
 * @returns {Promise<{featureCollection: object, projectionCode: string}
 *   |{error: {stage: string, reason: string, detail: string}}>}
 */
export async function interpretShapefile(
  components,
  { fallbackProjection } = {},
) {
  if (!components?.shp) {
    return {
      error: {
        stage: "parse",
        reason: "no_geometry",
        detail: "The source contained no .shp geometry to read.",
      },
    };
  }

  const projection = resolveProjection(components.prj, fallbackProjection);
  if (projection.error) return projection;

  // Loaded lazily so the parser stays out of the main bundle, matching how the
  // GeoTIFF reader is pulled in. The browser build is named explicitly: the
  // package resolves to a Node build under the test runner and a browser build
  // under the bundler, and the fidelity guarantees below are only worth anything
  // if they were measured against the artifact that actually ships.
  const { read } = await import("shapefile/dist/shapefile.js");

  let collection;
  try {
    collection = await read(
      toArrayBuffer(components.shp),
      components.dbf ? toArrayBuffer(components.dbf) : undefined,
    );
  } catch (error) {
    return {
      error: {
        stage: "parse",
        reason: "unreadable_geometry",
        detail: `The shapefile geometry could not be read: ${error.message}`,
      },
    };
  }

  // Shapefile encodes a polygon's interior rings by winding direction with no
  // parent pointer, so the ring order a parser produces is the only record of
  // which ring is a hole. Normalizing to the GeoJSON spec's winding is cheap
  // insurance: rendering keys off ring order rather than direction, but anything
  // downstream that reads the geometry as spec GeoJSON gets what it expects.
  const { default: rewind } = await import("@mapbox/geojson-rewind");
  rewind(collection);

  collection.crs = {
    type: "name",
    properties: { name: projection.code },
  };

  return { featureCollection: collection, projectionCode: projection.code };
}

// The parser reads from an ArrayBuffer. A component buffer may be a view over a
// larger allocation, so slice to its own bounds rather than handing over the
// whole backing store.
function toArrayBuffer(bytes) {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
}

// A code is a short token like "EPSG:5070"; a definition is WKT or a proj4
// string. Detected by shape rather than by trying one and falling back, so a
// malformed definition is reported as such instead of as an unknown code.
function looksLikeDefinition(value) {
  return /^\s*(\+proj=|[A-Z_]*(PROJCS|GEOGCS|PROJCRS|GEOGCRS|GEODCRS)\s*\[)/i.test(
    value,
  );
}

// Absence and failure are different inputs here, and keeping them apart is the
// point. A .prj that is genuinely missing falls back to what the author
// supplied; a .prj that failed to arrive was already reported upstream and never
// reaches this function, because silently substituting a fallback for it would
// draw the features somewhere else with no error at all.
function resolveProjection(prjBytes, fallbackProjection) {
  if (prjBytes) {
    // Decoded with fflate rather than TextDecoder: this runs in the browser and
    // under the test runner, and one of those has no TextDecoder.
    const wkt = strFromU8(prjBytes).trim();
    const registered = registerProjectionDefinition(wkt);
    if (registered.error) {
      return {
        error: {
          stage: "parse",
          reason: "unresolvable_projection",
          detail: registered.error.detail,
        },
      };
    }
    return { code: registered.code };
  }

  if (fallbackProjection) {
    // The field takes a definition as well as a code. A shapefile with no .prj
    // in an uncommon CRS has no other way to be placed: there is no table entry
    // to name, and the registration helper already accepts exactly this input.
    if (looksLikeDefinition(fallbackProjection)) {
      const registered = registerProjectionDefinition(fallbackProjection);
      if (registered.error) {
        return {
          error: {
            stage: "parse",
            reason: "unresolvable_projection",
            detail: registered.error.detail,
          },
        };
      }
      return { code: registered.code };
    }

    const resolved = ensureProjection(fallbackProjection);
    if (!resolved) {
      return {
        error: {
          stage: "parse",
          reason: "unresolvable_projection",
          detail: `The projection "${fallbackProjection}" could not be resolved. Supply a coordinate system this map recognises, or a WKT definition.`,
        },
      };
    }
    return { code: fallbackProjection };
  }

  return {
    error: {
      stage: "parse",
      reason: "missing_projection",
      detail:
        "The shapefile carries no .prj and no projection was supplied, so its coordinates cannot be placed.",
    },
  };
}
