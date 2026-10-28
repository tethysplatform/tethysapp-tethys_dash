import { unByKey } from "ol/Observable";
import { createEmpty, extend, getIntersection, isEmpty } from "ol/extent";
import { get as getProjection, transformExtent } from "ol/proj";

// How far "zoom to layer" will go in. A single point, or a layer of one tiny
// feature, has an extent with no area, and fitting that unbounded lands on the
// view's deepest zoom -- a blank tile with the point somewhere in it. 16 is
// the deepest the ESRI Canvas basemaps (Light/Dark Gray) have tiles for; the
// basemap's own source cannot say so, since its generic tile grid claims 42
// levels, and past 16 those basemaps draw only "Map data not yet available".
export const ZOOM_TO_LAYER_MAX_ZOOM = 16;

// Pixels left clear around the fitted extent, so features on the edge of the
// layer are not drawn under the map's border or its floating controls.
export const ZOOM_TO_LAYER_PADDING = 24;

const isGroup = (layer) => typeof layer?.getLayers === "function";

// Every OpenLayers source inherits a `getView()` whose promise only a subclass
// ever resolves -- in OL itself only GeoTIFF does -- so on a tile or image
// source it never settles, and awaiting it hangs the click. Trust it only from
// a GeoTIFF (recognised by a method only it has, since the class is loaded
// lazily) or from the Zarr loader, which sets its own on the instance.
const reportsView = (source) =>
  typeof source.determineTransformMatrix === "function" ||
  Object.prototype.hasOwnProperty.call(source, "getView");

// A GeoTIFF that cannot open its file says so only through its state: it never
// rejects its view promise, so awaiting that on a failed file hangs too.
const failedToOpen = (source) => source.getState?.() === "error";

/**
 * Whether a layer has any way of reporting where it is. Checked synchronously
 * so the panel can disable the button rather than offer one that does nothing:
 * an image WMS or ArcGIS layer is drawn from a server that is asked for one
 * viewport at a time, so the browser never learns its extent.
 *
 * Duck-typed rather than `instanceof`, because layer and source classes are
 * loaded lazily through moduleMap.
 */
export function canZoomToLayer(layer) {
  if (!layer) return false;
  if (isGroup(layer)) {
    return layer.getLayers().getArray().some(canZoomToLayer);
  }
  if (layer.getExtent?.()) return true;
  const source = layer.getSource?.();
  if (!source || failedToOpen(source)) return false;
  return (
    reportsView(source) ||
    typeof source.getImageExtent === "function" ||
    typeof source.getFeatures === "function" ||
    !!source.getTileGrid?.()?.getExtent?.()
  );
}

// An extent in the source's projection, moved into the view's and cut to the
// part the view projection can express -- a global EPSG:4326 raster reaches
// far past Web Mercator's poles. The cut is made in view coordinates, where
// that valid area is defined. Carried the other way, into a projected source
// CRS such as UTM or Albers, Web Mercator's world is four corners on the
// antimeridian, which land on a sliver no real raster overlaps.
function toViewProjection(extent, sourceProjection, viewProjection) {
  if (!extent || isEmpty(extent)) return null;
  const from = sourceProjection ? getProjection(sourceProjection) : null;
  let result = extent;
  if (from && from.getCode() !== viewProjection.getCode()) {
    // Points along each edge as well as the corners: a projected CRS's
    // straight edge is a curve in another, and can bow past its corners.
    result = transformExtent(extent, from, viewProjection, 8);
    const viewValid = viewProjection.getExtent?.();
    if (viewValid) result = getIntersection(result, viewValid);
  }
  return result.every(Number.isFinite) && !isEmpty(result) ? result : null;
}

// A vector source that fetches its own features -- a GeoJSON or KML URL, a
// Shapefile, an ESRI Feature Service -- does so only when its layer is drawn,
// and a layer that is hidden or outside its zoom range never is. Ask it for
// what drawing it in the current view would load, which is nothing for one
// that already holds that or was given its features outright, and wait for
// the load to end. A tiled ESRI service loads the view a tile at a time, so
// it is fitted to the first tile that arrives.
async function loadAsIfDrawn(source, frame, projection) {
  source.loadFeatures?.(frame.extent, frame.resolution, projection);
  // OpenLayers keeps `loading` only for a loader that reports back when it
  // finishes; any other cannot be waited on.
  if (!source.loading) return;
  await new Promise((resolve) => {
    const keys = source.once(["featuresloadend", "featuresloaderror"], () => {
      unByKey(keys);
      resolve();
    });
  });
}

/**
 * Where a layer is, as an extent in the map's view projection, or null when
 * the layer cannot say -- a vector layer holding no features, a raster whose
 * file failed to open, or a server-rendered image layer.
 *
 * Async because a GeoTIFF reads its georeferencing from the file's header, and
 * only reports it once that has arrived (Zarr sources expose the same
 * `getView()` shim), and because a vector layer that has never been drawn may
 * first have to load its features. `frame` is the view's current
 * `{extent, resolution}`, which that load is for; without it, a vector layer
 * reports only what it already holds.
 */
export async function getLayerExtent(layer, viewProjection, frame) {
  if (!layer) return null;

  if (isGroup(layer)) {
    const extents = await Promise.all(
      layer
        .getLayers()
        .getArray()
        .map((child) => getLayerExtent(child, viewProjection, frame)),
    );
    const union = extents
      .filter(Boolean)
      .reduce((acc, e) => extend(acc, e), createEmpty());
    return isEmpty(union) ? null : union;
  }

  // An authored layer extent is already in view coordinates, and is the
  // narrowest thing the layer can draw into.
  const layerExtent = layer.getExtent?.();
  if (layerExtent) return toViewProjection(layerExtent, null, viewProjection);

  const source = layer.getSource?.();
  if (!source || failedToOpen(source)) return null;

  if (reportsView(source)) {
    try {
      const { extent, projection } = await source.getView();
      return toViewProjection(extent, projection, viewProjection);
    } catch {
      return null;
    }
  }

  if (typeof source.getImageExtent === "function") {
    return toViewProjection(
      source.getImageExtent(),
      source.getProjection?.(),
      viewProjection,
    );
  }

  // Vector features are parsed into the view projection as they load.
  if (typeof source.getFeatures === "function") {
    if (frame) await loadAsIfDrawn(source, frame, viewProjection);
    return toViewProjection(source.getExtent(), null, viewProjection);
  }

  const tileGridExtent = source.getTileGrid?.()?.getExtent?.();
  if (tileGridExtent) {
    return toViewProjection(
      tileGridExtent,
      source.getProjection?.(),
      viewProjection,
    );
  }

  return null;
}

/**
 * Fit a map's view to a layer. Resolves to whether it moved: false when the
 * layer has no extent to fit to, or the map has not been sized yet.
 */
export async function zoomToLayer(map, layer, retried = false) {
  const view = map?.getView?.();
  if (!view) return false;
  const size = map.getSize?.();
  if (!size || !(size[0] > 0) || !(size[1] > 0)) return false;

  const extent = await getLayerExtent(layer, view.getProjection(), {
    extent: view.calculateExtent(size),
    resolution: view.getResolution(),
  });
  if (!extent) return false;
  // A new saved extent replaces the view outright, and can do so while a
  // GeoTIFF header is still arriving above; the extent was read against the
  // old view, so read it again against the new one.
  if (map.getView() !== view) {
    return retried ? false : zoomToLayer(map, layer, true);
  }

  // The padding is per side, so on a map narrower than twice of it the fit
  // would have nothing left to fit into.
  const pad = Math.min(
    ZOOM_TO_LAYER_PADDING,
    Math.floor(Math.min(size[0], size[1]) / 4),
  );
  view.fit(extent, {
    size,
    padding: [pad, pad, pad, pad],
    maxZoom: Math.min(view.getMaxZoom(), ZOOM_TO_LAYER_MAX_ZOOM),
    duration: 250,
  });
  return true;
}
