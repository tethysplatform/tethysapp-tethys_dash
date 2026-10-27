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
  if (!source) return false;
  return (
    reportsView(source) ||
    typeof source.getImageExtent === "function" ||
    typeof source.getFeatures === "function" ||
    !!source.getTileGrid?.()?.getExtent?.()
  );
}

// An extent in the source's projection, moved into the view's. A source
// spanning the poles (a global EPSG:4326 raster) transforms to Infinity in
// Web Mercator, so the extent is first cut to the part the view projection
// can express.
function toViewProjection(extent, sourceProjection, viewProjection) {
  if (!extent || isEmpty(extent)) return null;
  const from = sourceProjection ? getProjection(sourceProjection) : null;
  let result = extent;
  if (from && from.getCode() !== viewProjection.getCode()) {
    const viewValid = viewProjection.getExtent?.();
    let clipped = extent;
    if (viewValid) {
      const validInSource = transformExtent(viewValid, viewProjection, from);
      if (validInSource.every(Number.isFinite)) {
        clipped = getIntersection(extent, validInSource);
      }
    }
    if (isEmpty(clipped)) return null;
    result = transformExtent(clipped, from, viewProjection);
  }
  return result.every(Number.isFinite) && !isEmpty(result) ? result : null;
}

/**
 * Where a layer is, as an extent in the map's view projection, or null when
 * the layer cannot say -- a vector layer still loading or holding no features,
 * a raster whose file failed to open, or a server-rendered image layer.
 *
 * Async because a GeoTIFF reads its georeferencing from the file's header, and
 * only reports it once that has arrived (Zarr sources expose the same
 * `getView()` shim).
 */
export async function getLayerExtent(layer, viewProjection) {
  if (!layer) return null;

  if (isGroup(layer)) {
    const extents = await Promise.all(
      layer
        .getLayers()
        .getArray()
        .map((child) => getLayerExtent(child, viewProjection)),
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
  if (!source) return null;

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

  // Vector features are parsed into the view projection as they load, and
  // reprojected with it when a raster adopts a new one.
  if (typeof source.getFeatures === "function") {
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

  const extent = await getLayerExtent(layer, view.getProjection());
  if (!extent) return false;
  // A raster adopting its projection replaces the view outright, and can do
  // so while a GeoTIFF header is still arriving above; that extent is in the
  // old view's coordinates, so read it again against the new one.
  if (map.getView() !== view) {
    return retried ? false : zoomToLayer(map, layer, true);
  }

  const size = map.getSize?.();
  if (!size || !(size[0] > 0) || !(size[1] > 0)) return false;

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
