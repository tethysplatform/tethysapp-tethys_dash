// Whether a projection code needs anything registered before OpenLayers can
// resolve it.
//
// Deliberately its own module, with no dependencies. The answer is a property of
// the code itself, so it needs neither proj4 nor the definition table -- and
// keeping it separate is what lets the map ask the question without pulling
// ~150 KiB of projection machinery into the main bundle for every dashboard,
// including the ones with no layer that needs it. See projections.js, which is
// loaded on demand.

/**
 * Whether OpenLayers resolves this code on its own, with nothing registered.
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
