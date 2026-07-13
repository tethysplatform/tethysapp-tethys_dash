// --- Feature snapping (Approach A) ---------------------------------------
//
// For ESRI Map/Image-service layers flagged `snapToFeatures`, we pull the
// underlying polylines for the current view from the MapServer sublayer
// `/query` endpoint and snap the cursor to the nearest one. This replaces the
// fixed pixel `clickTolerance` used by `/identify`, which behaves poorly across
// zoom levels (too tight when zoomed out, too loose when zoomed in).

import Feature from "ol/Feature";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Point } from "ol/geom";
import { Stroke, Style, Circle, Fill } from "ol/style";
import GeoJSONFormat from "ol/format/GeoJSON";
import JSON5 from "json5";
import { shiftEPSG3857ExtentAndPoint } from "components/map/utilities";

// Cyan hover-preview color — visually distinct from the dark-blue
// click/selection highlight so the two never clobber each other.
export const SNAP_PREVIEW_COLOR = "#00c2d1";
export const SNAP_PREVIEW_LAYER_NAME = "Snap Preview";

// Parse an ArcGIS LAYERDEFS value into just the SQL WHERE clause for the
// given sublayer. ArcGIS accepts two syntaxes: simple ("<layerId>: <where>",
// optionally ";"-separated) and JSON (`{"<layerId>": "<where>"}`). We try the
// JSON form first (via JSON5, already a dependency in this file) since a
// valid simple-form string is not valid JSON5 and lands in the catch below.
// Returns "1=1" when no matching filter is set so the query is unfiltered.
export function layerDefsToWhere(layerDefs, sublayer = 0) {
  if (!layerDefs || typeof layerDefs !== "string") return "1=1";

  try {
    const parsed = JSON5.parse(layerDefs);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      const clause = parsed[String(sublayer)];
      return typeof clause === "string" && clause ? clause : "1=1";
    }
  } catch {
    // Not JSON(5) — fall through to the simple "id: clause" form below.
  }

  for (const entry of layerDefs.split(";")) {
    const idx = entry.indexOf(":");
    if (idx === -1) continue;
    const id = entry.slice(0, idx).trim();
    const clause = entry.slice(idx + 1).trim();
    if (id === String(sublayer) && clause) return clause;
  }
  return "1=1";
}

// Resolve the MapServer sublayer used for snap feature queries: an explicit
// `querySublayer` prop always wins; otherwise derive it from the LAYERS
// "show:N"/"include:N" source param (first id), mirroring the translation
// the /identify path (getESRILayerFeatures) already does for its `layers`
// param; falls back to 0 when neither is present/parseable.
export function resolveQuerySublayer(props) {
  if (props?.querySublayer !== null && props?.querySublayer !== undefined) {
    return props.querySublayer;
  }
  const match = props?.source?.props?.params?.LAYERS?.match(
    /^(show|include):\s*(\d+)/,
  );
  return match ? Number(match[2]) : 0;
}

// Query the MapServer sublayer for features intersecting the current map extent
// and return them as OpenLayers Features in the map projection. Returns [] on
// any failure so callers can degrade gracefully (e.g., fall back to /identify).
export async function fetchLayerVectorFeatures(layerInfo, map) {
  const props = layerInfo?.configuration?.props ?? {};
  const sourceUrl = props.source?.props?.url ?? "";
  if (!sourceUrl) return [];
  const sublayer = resolveQuerySublayer(props);
  const where = layerDefsToWhere(
    props.source?.props?.params?.LAYERDEFS,
    sublayer,
  );

  const view = map.getView();
  const projectionCode = view.getProjection().getCode();
  const inSR = projectionCode.split(":")[1];
  const rawExtent = view.calculateExtent();
  // Mirror /identify's antimeridian handling so a view panned past the
  // antimeridian still queries the correct world-copy.
  const extent =
    projectionCode === "EPSG:3857"
      ? shiftEPSG3857ExtentAndPoint(rawExtent, [
          (rawExtent[0] + rawExtent[2]) / 2,
          (rawExtent[1] + rawExtent[3]) / 2,
        ]).extent
      : rawExtent;

  const params = new URLSearchParams({
    f: "geojson",
    where,
    geometry: extent.join(","),
    geometryType: "esriGeometryEnvelope",
    spatialRel: "esriSpatialRelIntersects",
    inSR,
    outSR: "4326", // f=geojson coordinates come back as EPSG:4326
    outFields: "*",
    returnGeometry: "true",
  });

  let geojson;
  try {
    const resp = await fetch(`${sourceUrl}/${sublayer}/query?${params}`);
    geojson = await resp.json();
  } catch (error) {
    console.error("Vector feature query failed:", error);
    return [];
  }
  if (!geojson || !Array.isArray(geojson.features)) return [];

  // ArcGIS truncates /query responses at the server's maxRecordCount and
  // signals it via `exceededTransferLimit` — carried either as a top-level
  // flag or under `properties`, depending on server version, in f=geojson
  // responses. Using the partial feature set would make snapping select the
  // nearest CACHED river instead of the nearest VISIBLE one, so degrade to an
  // empty cache and let the click path fall back to ESRI /identify.
  const exceededTransferLimit =
    geojson.exceededTransferLimit === true ||
    geojson.properties?.exceededTransferLimit === true;
  if (exceededTransferLimit) {
    console.warn(
      `Vector feature query for ${sourceUrl} exceeded the server's maxRecordCount; snapping is disabled for this view.`,
    );
    return [];
  }

  try {
    return new GeoJSONFormat().readFeatures(geojson, {
      dataProjection: "EPSG:4326",
      featureProjection: projectionCode,
    });
  } catch (error) {
    console.error("Failed to parse vector features:", error);
    return [];
  }
}

// Screen-pixel distance between two map coordinates. Shared by findSnapFeature
// and findSnapFeatures so the snap math stays identical between the tight
// hover radius and the wider click gather radius. Returns null when either
// coordinate cannot be projected to a pixel.
export function pixelDistanceBetween(map, coordA, coordB) {
  const pixelA = map.getPixelFromCoordinate(coordA);
  const pixelB = map.getPixelFromCoordinate(coordB);
  if (!pixelA || !pixelB) return null;
  const dx = pixelA[0] - pixelB[0];
  const dy = pixelA[1] - pixelB[1];
  return Math.sqrt(dx * dx + dy * dy);
}

// Find the vector feature nearest to `coordinate` whose closest point is within
// `snapPx` screen pixels. Returns { feature, coordinate: <snapped>,
// pixelDistance } or null when nothing qualifies. Pixel-space (not map-space)
// distance keeps the snap radius consistent regardless of zoom level.
export function findSnapFeature(vectorSource, coordinate, map, snapPx = 15) {
  if (!vectorSource || !coordinate) return null;
  const feature = vectorSource.getClosestFeatureToCoordinate(coordinate);
  const geometry = feature?.getGeometry?.();
  if (!geometry) return null;
  const snappedCoord = geometry.getClosestPoint(coordinate);
  const pixelDistance = pixelDistanceBetween(map, coordinate, snappedCoord);
  if (pixelDistance === null || pixelDistance > snapPx) return null;
  return { feature, coordinate: snappedCoord, pixelDistance };
}

// Snap across multiple cached vector sources, returning the closest qualifying
// feature. `caches` is an array of { layerName, source }. Returns
// { layerName, feature, coordinate, pixelDistance } or null when nothing snaps.
export function findBestSnap(caches, coordinate, map, snapPx = 15) {
  let best = null;
  for (const cache of caches ?? []) {
    const hit = findSnapFeature(cache?.source, coordinate, map, snapPx);
    if (hit && (!best || hit.pixelDistance < best.pixelDistance)) {
      best = { ...hit, layerName: cache.layerName };
    }
  }
  return best;
}

// Gather ALL cached features whose closest point is within `gatherPx` screen
// pixels of `coordinate`, sorted nearest-first. Used on click to surface the
// connected reaches at a confluence (the nearest snapped river plus the ones it
// merges into/from) as separate popup entries — the wider gather radius mirrors
// the old /identify pixel tolerance, while the hover snap stays tight.
export function findSnapFeatures(caches, coordinate, map, gatherPx = 35) {
  if (!coordinate) return [];
  const cursorPixel = map.getPixelFromCoordinate(coordinate);
  const resolution = map.getView().getResolution();
  if (!cursorPixel || !resolution) return [];
  const r = gatherPx * resolution;
  const extent = [
    coordinate[0] - r,
    coordinate[1] - r,
    coordinate[0] + r,
    coordinate[1] + r,
  ];
  const results = [];
  for (const cache of caches ?? []) {
    const source = cache?.source;
    if (!source?.forEachFeatureInExtent) continue;
    source.forEachFeatureInExtent(extent, (feature) => {
      const geometry = feature.getGeometry?.();
      if (!geometry) return;
      const snapped = geometry.getClosestPoint(coordinate);
      const pixelDistance = pixelDistanceBetween(map, coordinate, snapped);
      if (pixelDistance !== null && pixelDistance <= gatherPx) {
        results.push({
          feature,
          coordinate: snapped,
          pixelDistance,
          layerName: cache.layerName,
        });
      }
    });
  }
  results.sort((a, b) => a.pixelDistance - b.pixelDistance);
  return results;
}

// Dedicated layer for the hover snap preview — visually distinct (cyan) from
// the dark-blue click/selection highlight so the two never clobber each other.
// The line traces the snapped feature; the filled dot marks the exact point the
// cursor clipped to.
export function createSnapLayer() {
  const color = SNAP_PREVIEW_COLOR;
  return new VectorLayer({
    source: new VectorSource({}),
    style: new Style({
      stroke: new Stroke({ color, width: 4 }),
      image: new Circle({
        radius: 6,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: "#ffffff", width: 2 }),
      }),
    }),
    zIndex: 101,
    name: SNAP_PREVIEW_LAYER_NAME,
  });
}

// Render the snap preview into `snapLayer`: the snapped feature outline plus a
// dot marking the exact on-geometry point the cursor clipped to. Clears any
// previous preview first. Safe to call with a null feature and/or coordinate.
export function addSnapPreview(snapLayer, feature, coordinate) {
  const source = snapLayer.getSource();
  source.clear();
  if (feature) source.addFeature(feature.clone());
  if (coordinate) {
    source.addFeature(new Feature({ geometry: new Point(coordinate) }));
  }
}

// Whether a click should select `layer` from the local snapped feature (vs an
// ESRI /identify). True only when there's an active snap whose source layer is
// this snap-enabled layer.
export function shouldSnapSelect(layer, clickSnap) {
  return Boolean(
    clickSnap?.feature &&
    layer?.configuration?.props?.snapToFeatures &&
    layer.configuration.props.name === clickSnap.layerName,
  );
}

// Build an ESRI-identify-shaped result ({ layerName, attributes, geometry })
// from a locally-snapped vector feature, so a snapped click can select the
// river WITHOUT an ESRI /identify round-trip (which is slow on a cache miss and
// intermittently returns empty even for an on-geometry point). `layerName` must
// equal the layer's attributeVariables key (which is the identify sub-layer
// name) so the downstream variable-input mapping fires; it falls back to the
// configured layer name when no attributeVariables are set.
export function buildSnapFeatureResult(feature, layer) {
  const attrVars =
    layer?.attributeVariables && typeof layer.attributeVariables === "object"
      ? layer.attributeVariables
      : {};
  const layerName =
    Object.keys(attrVars)[0] ?? layer?.configuration?.props?.name ?? "";
  const attributes = { ...feature.getProperties() };
  delete attributes.geometry;
  const geom = feature.getGeometry();
  return {
    layerName,
    attributes,
    geometry: geom
      ? { type: geom.getType(), coordinates: geom.getCoordinates() }
      : null,
  };
}
