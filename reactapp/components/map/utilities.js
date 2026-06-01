import PropTypes from "prop-types";
import { convertXML } from "simple-xml-to-json";
import { transform } from "ol/proj";
import Feature from "ol/Feature";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { LineString, MultiPolygon, Polygon, Point } from "ol/geom";
import { Stroke, Style, Circle } from "ol/style";
import Icon from "ol/style/Icon";
import { toGeometry } from "ol/render/Feature";
import GeoJSONFormat from "ol/format/GeoJSON";
import appAPI from "services/api/app";
import { v4 as uuidv4 } from "uuid";
import JSON5 from "json5";
import { PMTiles } from "pmtiles";
import { VectorTile } from "@mapbox/vector-tile";
import Protobuf from "pbf";

export const sourcePropertiesOptions = {
  "ESRI Image and Map Service": {
    required: {
      url: {
        placeholder: "ArcGIS Rest service URL",
      },
    },
    optional: {
      attributions: {
        placeholder: "Attributions",
      },
      params: {
        LAYERS: {
          placeholder: "[show|hide|include|exclude]:layerId1,layerId2",
        },
        TIME: {
          placeholder: "<startTime>, <endTime> or <timeInstant>",
        },
        LAYERDEFS: {
          placeholder: "Allows you to filter the features of individual layers",
        },
        mosaicRule: {
          placeholder: "Specifies how image service should handle mosaics",
        },
      },
      projection: {
        placeholder: "EPSG:<Code>",
      },
    },
  },
  WMS: {
    required: {
      url: {
        placeholder: "WMS service URL",
      },
      params: {
        LAYERS: {
          placeholder: "<workspace>:<layerName>,<workspace>:<layerName>",
        },
      },
    },
    optional: {
      attributions: {
        placeholder: "Attributions",
      },
      params: {
        STYLES: {
          placeholder: "SLD (Styled Layer Descriptor) Name",
        },
        TIME: {
          placeholder: "yyyy-MM-ddThh:mm:ss.SSSZ",
        },
      },
      projection: {
        placeholder: "EPSG:<Code>",
      },
    },
  },
  KML: {
    required: {
      url: {
        placeholder: "KML URL",
      },
    },
    optional: {
      attributions: {
        placeholder: "Attributions",
      },
      projection: {
        placeholder: "EPSG:<Code>",
      },
    },
  },
  "Image Tile": {
    required: {
      url: {
        placeholder: "Image Tile URL",
      },
    },
    optional: {
      attributions: {
        placeholder: "Attributions",
      },
      projection: {
        placeholder: "EPSG:<Code>",
      },
    },
  },
  GeoJSON: {
    required: {},
    optional: {},
  },
  GeoTIFF: {
    required: {},
    optional: {},
  },
  "Vector Tile": {
    required: {
      urls: {
        placeholder:
          "An comma separated list of URL templates. Must include {x}, {y} or {-y}, and {z} placeholders. A {?-?} template pattern, for example subdomain{a-f}.domain.com, may be used instead of defining each one separately in the urls option.",
      },
    },
    optional: {
      attributions: {
        placeholder: "Attributions",
      },
      projection: {
        placeholder: "EPSG:<Code>",
      },
    },
  },
  "ESRI Feature Service": {
    required: {
      url: {
        placeholder: "ArcGIS Feature Service URL",
      },
      layer: { type: "number", placeholder: "the integer for the layer index" },
    },
    optional: {
      attributions: {
        placeholder: "Attributions",
      },
      params: {
        TIME: {
          placeholder: "<startTime>, <endTime> or <timeInstant>",
        },
        WHERE: {
          placeholder: "WHERE clause for the query filter",
        },
      },
    },
  },
  "PMTiles Vector": {
    required: {
      url: { placeholder: "PMTiles Vector URL" },
    },
    optional: {
      attributions: {
        placeholder: "Attributions",
      },
      tileSize: {
        placeholder: "Tile Size (e.g., 256, 512)",
      },
    },
  },
  "PMTiles Raster": {
    required: {
      url: { placeholder: "PMTiles Raster URL" },
    },
    optional: {
      attributions: {
        placeholder: "Attributions",
      },
      tileSize: {
        placeholder: "Tile Size (e.g., 256, 512)",
      },
    },
  },
  "Static Image": {
    required: {
      url: { placeholder: "https://example.com/image.png" },
      projection: { placeholder: "EPSG:4326" },
      imageExtent: { placeholder: "minX,minY,maxX,maxY" },
    },
    optional: {
      attributions: {
        placeholder: "Attributions",
      },
    },
  },
};

export const layerPropertiesOptions = {
  opacity: { type: "number", placeholder: "Opacity (0, 1)" },
  minResolution: {
    type: "number",
    placeholder:
      "The minimum resolution (inclusive) at which this layer will be visible.",
  },
  maxResolution: {
    type: "number",
    placeholder:
      "The maximum resolution (exclusive) below which this layer will be visible.",
  },
  minZoom: {
    type: "number",
    placeholder:
      "The minimum view zoom level (exclusive) above which this layer will be visible.",
  },
  maxZoom: {
    type: "number",
    placeholder:
      "The maximum view zoom level (inclusive) at which this layer will be visible.",
  },
  minZoomQuery: {
    type: "number",
    placeholder:
      "The minimum view zoom level (inclusive) at which this layer can be queried. If the mp is clicked beyond the zoom level, then the map will zoom into the minZoomQuery value",
  },
};

/**
 * Swap the features on a preserved OpenLayers VectorLayer in place.
 *
 * Used by the runtimeLayerFetcher (Unit 5) when a dynamic_map_layer plugin
 * returns new features: clear the existing VectorSource and add the parsed
 * FeatureCollection, keeping the same OL layer instance so popup/highlight
 * state survives the refresh.
 *
 * Accepts:
 *   olLayer: the preserved ol/layer/Vector instance
 *   featureCollection: a GeoJSON FeatureCollection dict (or null/empty for
 *     the empty-success state — source is cleared, no features added)
 *   mapProjection: the map's projection code (e.g., "EPSG:3857") used as
 *     featureProjection when parsing. dataProjection is read from the
 *     FeatureCollection's crs (defaulting to EPSG:4326 when absent).
 *
 * The caller is responsible for dismissing any popup anchored to the
 * outgoing features before invoking this helper (see Unit 7).
 */
export function swapVectorLayerFeatures(
  olLayer,
  featureCollection,
  mapProjection,
) {
  const source = olLayer?.getSource?.();
  if (!source || typeof source.clear !== "function") {
    return;
  }
  source.clear();

  if (
    !featureCollection ||
    !Array.isArray(featureCollection.features) ||
    featureCollection.features.length === 0
  ) {
    return;
  }

  const crsName = featureCollection?.crs?.properties?.name;
  const dataProjection = crsName || "EPSG:4326";
  const features = new GeoJSONFormat().readFeatures(featureCollection, {
    dataProjection,
    featureProjection: mapProjection,
  });
  source.addFeatures(features);
}

/**
 * Apply cosmetic prop changes to a preserved OpenLayers layer instance.
 *
 * Used by the shouldKeep identity branch when a dynamic_map_layer's config
 * changes in non-feature ways (opacity, name, zoom bounds, visibility).
 * Avoids tearing down the layer just for a cosmetic edit, which would
 * discard the features painted by the runtime fetcher.
 *
 * Only applies the props OL has first-class setters for; other props
 * (e.g., source config) trigger a rebuild via the normal reconciliation
 * path since they can't be safely mutated in place.
 */
export function updateOlLayerProps(olLayer, newProps) {
  if (!olLayer || !newProps) return;

  if (typeof newProps.name === "string") {
    olLayer.set("name", newProps.name);
  }
  if (typeof newProps.opacity === "number") {
    olLayer.setOpacity(newProps.opacity);
  }
  if (typeof newProps.minResolution === "number") {
    olLayer.setMinResolution(newProps.minResolution);
  }
  if (typeof newProps.maxResolution === "number") {
    olLayer.setMaxResolution(newProps.maxResolution);
  }
  if (typeof newProps.minZoom === "number") {
    olLayer.setMinZoom(newProps.minZoom);
  }
  if (typeof newProps.maxZoom === "number") {
    olLayer.setMaxZoom(newProps.maxZoom);
  }
  // Keep the pluginSource / layerId tags in sync so identity lookups work
  // after an edit that preserved identity but touched other fields.
  if (newProps.layerId) {
    olLayer.set("layerId", newProps.layerId);
  }
  if (newProps.pluginSource) {
    olLayer.set("pluginSource", newProps.pluginSource);
  }
}

export function createMarkerLayer(coordinate) {
  const markPath = `
      M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9
      c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z
    `;
  const svgIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40">
        <path d="${markPath}" fill="#007bff" stroke="white" stroke-width="1"/>
      </svg>
    `;
  const svgURI = "data:image/svg+xml;base64," + btoa(svgIcon);
  const marker = new Feature({
    type: "marker",
    geometry: new Point(coordinate),
  });
  marker.setStyle(
    new Style({
      image: new Icon({
        src: svgURI,
        anchor: [0.5, 1], // Align the bottom-center of the icon to the point
      }),
    }),
  );
  const markerLayer = new VectorLayer({
    source: new VectorSource({
      features: [marker],
    }),
    name: "Marker",
  });

  return markerLayer;
}

export function createHighlightLayer() {
  const stroke = new Stroke({
    color: "#00008b",
    width: 3,
  });
  const highlightLayer = new VectorLayer({
    source: new VectorSource({}),
    style: new Style({
      stroke: stroke,
      image: new Circle({
        stroke: stroke,
        radius: 5,
      }),
    }),
    zIndex: 100,
    name: "Highlighted Layer",
  });

  return highlightLayer;
}

export function addHighlightFeatures(highlightLayer, geometries) {
  if (!geometries || typeof geometries !== "object") return;

  let features;
  if ("paths" in geometries || geometries?.type === "MultiLineString") {
    const paths = geometries.paths || geometries.coordinates;
    features = paths.map((path) => {
      return new Feature({
        geometry: new LineString(path),
        name: "Polyline",
      });
    });
  } else if (geometries?.type === "LineString") {
    features = [
      new Feature({
        geometry: new LineString(geometries.coordinates),
        name: "LineString",
      }),
    ];
  } else if ("rings" in geometries || geometries?.type === "MultiPolygon") {
    const paths = geometries.rings || geometries.coordinates;
    features = [
      new Feature({
        geometry: new MultiPolygon(paths),
        name: "MultiPolygon",
      }),
    ];
  } else if (geometries?.type === "Polygon") {
    features = [
      new Feature({
        geometry: new Polygon(geometries.coordinates),
        name: "Polygon",
      }),
    ];
  } else {
    let geometry;
    if ("x" in geometries) {
      geometry = new Point((geometries.x, geometries.y));
    } else {
      geometry = new Point(geometries.coordinates);
    }
    features = [
      new Feature({
        name: "Point",
        geometry: geometry,
      }),
    ];
  }

  highlightLayer.getSource().addFeatures(features);
}

// Half the circumference of the Earth at the equator in EPSG:3857 meters.
// Valid X for EPSG:3857 lies in [-MERCATOR_HALF_WORLD, MERCATOR_HALF_WORLD].
export const MERCATOR_HALF_WORLD = 20037508.342789244;

// Normalize an EPSG:3857 X coordinate into the valid world range. OpenLayers
// renders past the antimeridian by wrapping tiles, but `view.calculateExtent()`
// returns the raw unwrapped value, which breaks BBOX-based image requests to
// ArcGIS/WMS services.
export function wrapMercatorX(x) {
  // Short-circuit in-range values so identity inputs round-trip exactly,
  // avoiding floating-point drift from the modulo arithmetic.
  if (x >= -MERCATOR_HALF_WORLD && x < MERCATOR_HALF_WORLD) return x;
  const world = MERCATOR_HALF_WORLD * 2;
  return (
    ((((x + MERCATOR_HALF_WORLD) % world) + world) % world) -
    MERCATOR_HALF_WORLD
  );
}

// Convert an EPSG:3857 X (meters) to longitude in degrees. Linear in spherical
// Web Mercator: X = R * lon_radians, with R chosen so ±half-world maps to ±180°.
export function mercatorXToLongitude(x) {
  return (x / MERCATOR_HALF_WORLD) * 180;
}

// Build a Well-Known Text string for a Web Mercator projection whose origin is
// rotated so the given longitude maps to X=0. ArcGIS MapServer accepts this in
// the `bboxSR` and `imageSR` query parameters, letting us request an in-range
// BBOX even when the view straddles the antimeridian. Mirrors the WKT shape
// produced by ESRI's own client (e.g., maps.water.noaa.gov panning requests).
export function buildShiftedMercatorWKT(centralMeridianDegrees) {
  return (
    'PROJCS["WGS_1984_Web_Mercator_Auxiliary_Sphere",' +
    'GEOGCS["GCS_WGS_1984",' +
    'DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],' +
    'PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],' +
    'PROJECTION["Mercator_Auxiliary_Sphere"],' +
    'PARAMETER["False_Easting",0.0],PARAMETER["False_Northing",0.0],' +
    `PARAMETER["Central_Meridian",${centralMeridianDegrees}],` +
    'PARAMETER["Standard_Parallel_1",0.0],' +
    'PARAMETER["Auxiliary_Sphere_Type",0.0],UNIT["Meter",1.0]]'
  );
}

// Rewrite an ArcGIS MapServer /export URL so its BBOX stays in valid EPSG:3857
// range. OpenLayers' ImageArcGISRest source builds the URL from
// `view.calculateExtent()`, which can fall outside ±MERCATOR_HALF_WORLD when
// the user pans past the antimeridian — the server then queries empty ocean
// and returns a blank tile. We shift the spatial reference's central meridian
// to the view's wrapped center longitude and re-express BBOX relative to that
// origin, so the request is always in valid range. Pure URL-in URL-out — must
// never throw, since it runs inside an OL `imageLoadFunction`.
export function rewriteArcGISExportUrlForAntimeridian(src) {
  let url;
  try {
    url = new URL(src);
  } catch {
    return src;
  }
  const params = url.searchParams;
  const bboxKey = ["BBOX", "bbox"].find((k) => params.has(k));
  if (!bboxKey) return src;

  const parts = params.get(bboxKey).split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return src;
  const [minX, minY, maxX, maxY] = parts;

  // Common case: bbox already in-range. Skip the rewrite entirely.
  if (
    minX >= -MERCATOR_HALF_WORLD &&
    maxX <= MERCATOR_HALF_WORLD &&
    minX <= maxX
  ) {
    return src;
  }

  const centerX = (minX + maxX) / 2;
  const wrappedCenterX = wrapMercatorX(centerX);
  const centerLon = mercatorXToLongitude(wrappedCenterX);
  const halfWidth = (maxX - minX) / 2;
  const wkt = buildShiftedMercatorWKT(centerLon);

  params.set(bboxKey, [-halfWidth, minY, halfWidth, maxY].join(","));
  for (const key of ["BBOXSR", "bboxSR", "IMAGESR", "imageSR"]) {
    if (params.has(key)) params.set(key, JSON.stringify({ wkt }));
  }
  // If the URL didn't have explicit SR params yet, set the canonical casing.
  if (!params.has("BBOXSR") && !params.has("bboxSR")) {
    params.set("BBOXSR", JSON.stringify({ wkt }));
  }
  if (!params.has("IMAGESR") && !params.has("imageSR")) {
    params.set("IMAGESR", JSON.stringify({ wkt }));
  }
  return url.toString();
}

// Translate an EPSG:3857 extent and a point inside it by whole world-widths so
// the extent's center lands in valid range. ArcGIS `/identify` doesn't
// auto-wrap out-of-range coordinates (despite `sr=3857`), so a click on a
// panned-past-antimeridian view returns no features. Shifting both `mapExtent`
// and `geometry` by the same offset preserves the relative click position and
// produces a request the server handles correctly without needing a custom SR.
// Returns the original inputs when the extent center is already in range.
export function shiftEPSG3857ExtentAndPoint(extent, point) {
  const centerX = (extent[0] + extent[2]) / 2;
  if (centerX >= -MERCATOR_HALF_WORLD && centerX < MERCATOR_HALF_WORLD) {
    return { extent, point };
  }
  const shift = wrapMercatorX(centerX) - centerX;
  return {
    extent: [extent[0] + shift, extent[1], extent[2] + shift, extent[3]],
    point: [point[0] + shift, point[1]],
  };
}

export function transformCoordinates(coords, sourceProj, destProj) {
  // check to see if the coords values are an array (nested coords) or a number
  if (Array.isArray(coords[0])) {
    // run function again to transform nested values
    return coords.map((coord) =>
      transformCoordinates(coord, sourceProj, destProj),
    );
  } else if (
    coords.length === 2 &&
    typeof coords[0] === "number" &&
    typeof coords[1] === "number"
  ) {
    // if the coords values are numbers, then transform to the new projection
    return transform(coords, sourceProj, destProj);
  } else {
    throw new Error("Invalid coordinate structure");
  }
}

export async function queryLayerFeatures(layerInfo, map, coordinate, pixel) {
  // setup constants
  let features;
  const sourceUrl = layerInfo.configuration.props.source.props?.url ?? "";
  const sourceParams = layerInfo.configuration.props.source.props.params;
  const sourceType = layerInfo.configuration.props.source.type;
  const LayerName = layerInfo.configuration.props.name;

  const mapZoom = map.getView().getZoom();
  if (layerInfo.configuration.props.minZoomQuery >= mapZoom) {
    map.getView().setCenter(coordinate);
    map
      .getView()
      .setZoom(parseFloat(layerInfo.configuration.props.minZoomQuery) + 0.1);
    features = "zoomed";
  } else {
    // make the appropriate request based on the source type
    if (sourceType === "ESRI Image and Map Service") {
      features = await getESRILayerFeatures(
        sourceUrl,
        sourceParams,
        map,
        coordinate,
      );
    } else if (sourceType === "WMS") {
      features = await getImageWMSLayerFeatures(
        sourceUrl,
        sourceParams,
        map,
        pixel,
      );
    } else if (
      sourceType === "GeoJSON" ||
      sourceType === "ESRI Feature Service"
    ) {
      features = await getGeoJSONLayerFeatures(
        map,
        pixel,
        coordinate,
        LayerName,
      );
    } else if (sourceType === "PMTiles Vector") {
      features = getVectorTileLayerFeatures(map, pixel);
    } else if (sourceType === "KML") {
      features = getKMLLayerFeatures(map, pixel, coordinate, LayerName);
    } else if (sourceType === "GeoTIFF") {
      features = getGeoTIFFPixelValues(
        map,
        pixel,
        LayerName,
        layerInfo,
        coordinate,
      );
    } else {
      throw Error(`${sourceType} is not currently configured to be queried`);
    }
  }

  return features;
}

async function getKMLLayerFeatures(map, pixel, coordinate, LayerName) {
  let features = await getGeoJSONLayerFeatures(
    map,
    pixel,
    coordinate,
    LayerName,
  );

  // Remove styleUrl and description, and filter out features with no other attributes
  features = features.map((feature) => {
    const attrs = { ...feature.attributes };
    delete attrs.styleUrl;
    delete attrs.description;
    return {
      ...feature,
      attributes: attrs,
    };
  });

  return features;
}

function getGeoTIFFPixelValues(map, pixel, LayerName, layerInfo, coordinate) {
  const targetLayer = map
    .getLayers()
    .getArray()
    .find((layer) => layer.get("name") === LayerName);

  if (!targetLayer || typeof targetLayer.getData !== "function") return [];

  const data = targetLayer.getData(pixel);
  if (!data || data.length === 0) return [];

  const configuredSources =
    layerInfo?.configuration?.props?.source?.props?.sources ?? [];
  const anySourceHasNodata = configuredSources.some(
    (s) => s?.nodata !== undefined && s.nodata !== null && s.nodata !== "",
  );

  if (anySourceHasNodata && data.length >= 2 && data[data.length - 1] === 0) {
    return [
      {
        layerName: LayerName,
        attributes: { "Band 1": "No data" },
        geometry: { type: "Point", coordinates: coordinate },
      },
    ];
  }

  const attributes = {};
  const bandCount = anySourceHasNodata ? data.length - 1 : data.length;
  for (let i = 0; i < bandCount; i++) {
    attributes[`Band ${i + 1}`] = data[i];
  }

  return [
    {
      layerName: LayerName,
      attributes,
      geometry: {
        type: "Point",
        coordinates: coordinate,
      },
    },
  ];
}

function getVectorTileLayerFeatures(map, pixel) {
  const features = [];
  map.forEachFeatureAtPixel(pixel, function (feature, layer) {
    if (!feature) return;
    let featureLayerName = feature.get("layer");
    features.push({
      layerName: featureLayerName,
      attributes: feature.getProperties(),
      geometry: {
        type: toGeometry(feature).getType(),
        coordinates: toGeometry(feature).getCoordinates(),
      },
    });
  });
  return features;
}

async function getESRILayerFeatures(sourceUrl, sourceParams, map, coordinate) {
  // setup fetch request with params
  const featureQueryUrl = sourceUrl + "/identify";
  const view = map.getView();
  const projectionCode = view.getProjection().getCode();
  const rawExtent = view.calculateExtent();
  const { extent, point } =
    projectionCode === "EPSG:3857"
      ? shiftEPSG3857ExtentAndPoint(rawExtent, coordinate)
      : { extent: rawExtent, point: coordinate };
  const params = new URLSearchParams({
    f: "json",
    tolerance: 10, // Pixel tolerance
    returnGeometry: true,
    geometryType: "esriGeometryPoint",
    sr: projectionCode.split(":")[1],
    geometry: point.join(","),
    mapExtent: extent.join(","),
    returnFieldName: true,
    imageDisplay: map.getSize().concat(view.getResolution()).join(", "),
    layers: sourceParams?.LAYERS?.startsWith("show:")
      ? `visible:${sourceParams.LAYERS.slice(5)}`
      : "visible",
  });

  let featureQueryJson;
  try {
    const featureQuery = await fetch(`${featureQueryUrl}?${params.toString()}`);
    featureQueryJson = await featureQuery.json();
  } catch (error) {
    console.error("Identify request failed:", error);
    return null;
  }

  return featureQueryJson.results;
}

async function getImageWMSLayerFeatures(sourceUrl, sourceParams, map, pixel) {
  // make all source params lowercase just to make sure there are no issues grabbing keys with capitalization
  const lowercaseSourceParams = Object.keys(sourceParams).reduce((acc, key) => {
    acc[key.toLowerCase()] = sourceParams[key];
    return acc;
  }, {});

  // get map information for the request
  const [mapWidth, mapHeight] = map.getSize();
  const mapSRS = map.getView().getProjection().getCode();

  let featureQueryJson;
  try {
    // setup fetch request with params
    const params = new URLSearchParams({
      SERVICE: "WMS",
      INFO_FORMAT: "application/json",
      LAYERS: lowercaseSourceParams.layers,
      QUERY_LAYERS: lowercaseSourceParams.layers,
      X: pixel[0],
      Y: pixel[1],
      SRS: mapSRS,
      BBOX: map.getView().calculateExtent().join(","),
      HEIGHT: mapHeight,
      WIDTH: mapWidth,
      REQUEST: "GetFeatureInfo",
      VERSION: "1.1.1",
    });
    const featureQuery = await fetch(`${sourceUrl}?${params.toString()}`);
    featureQueryJson = await featureQuery.json();
  } catch (error) {
    console.error("Identify request failed:", error);
    return null;
  }

  // setup constants for feature handling
  const features = [];
  const featuresSRSRaw =
    featureQueryJson.crs.properties.name.match(/crs:(.*)/)[1];
  const featuresSRSFormatted = featuresSRSRaw.replace("::", ":");

  // loop through all the clicked features
  for (const feature of featureQueryJson.features) {
    // transform coordinates to map spatial reference if needed
    let transformedCoords = feature.geometry.coordinates;
    if (mapSRS !== featuresSRSFormatted) {
      transformedCoords = transformCoordinates(
        transformedCoords,
        featuresSRSFormatted,
        mapSRS,
      );
    }
    const updatedGeometry = {
      ...feature.geometry,
      ...{ coordinates: transformedCoords },
    };

    // add clicked features to features array
    features.push({
      layerName: feature.id.split(".")[0],
      attributes: feature.properties,
      geometry: updatedGeometry,
    });
  }

  return features;
}

async function getGeoJSONLayerFeatures(map, pixel, coordinate, LayerName) {
  const features = [];

  // loop through the feature layers that are found at the clicked pixel
  map.forEachFeatureAtPixel(pixel, function (feature, layer) {
    // dont get any features that are highlights or markers
    if (layer.get("name") !== LayerName) {
      return;
    }

    if (feature) {
      let clickedGeometries = [];
      const { geometry, ...properties } = feature.getProperties();

      // if a feature is a collection of geometries, then check each individual item in the collection and check if it was clicked
      if (
        geometry.getType() === "GeometryCollection" ||
        geometry.getType() === "MultiGeometry"
      ) {
        const resolution = map.getView().getResolution();

        // loop through each individual geometry in the collection
        geometry.getGeometries().forEach((geom) => {
          const type = geom.getType();

          // if the geometry is a point or string (not a polygon) then see how close the click was to the feature
          if (
            type === "Point" ||
            type === "LineString" ||
            type === "MultiLineString"
          ) {
            // get the closest feature point to the clicked coordinate
            const closestPoint = geom.getClosestPoint(coordinate);

            // calculate the distance from the closest point to the clicked coordinate and convert from coordinate unit to pixel
            const distance =
              Math.sqrt(
                Math.pow(closestPoint[0] - coordinate[0], 2) +
                  Math.pow(closestPoint[1] - coordinate[1], 2),
              ) / resolution;

            // if the closest point distance is less than the threshold, count it as being clicked
            const threshold = 10; // pixel threshold
            if (distance < threshold) {
              clickedGeometries.push(geom);
            }
          } else {
            // check to see if the geometry intersects with the coordinate
            if (geom.intersectsCoordinate(coordinate)) {
              clickedGeometries.push(geom);
            }
          }
        });
      } else {
        clickedGeometries.push(geometry);
      }

      // for each geometry that was clicked or within a threshold of clicking, add it feature and attributes
      if (clickedGeometries.length > 0) {
        clickedGeometries.forEach((clickedGeometry) => {
          features.push({
            layerName: layer.getProperties().name,
            attributes: properties,
            geometry: {
              type: clickedGeometry.getType(),
              coordinates: clickedGeometry.getCoordinates(),
            },
          });
        });
      }
    }
  });

  return features;
}

export async function getStyleFields({
  sourceProps,
  layerProps,
  dashboard_uuid,
  isDynamicMapLayer = false,
}) {
  let fields = [];
  if (isDynamicMapLayer || sourceProps.type === "PMTiles Vector") {
    const attributes = await getLayerAttributes({
      sourceProps,
      layerName: layerProps?.name ?? "",
      dashboard_uuid,
      isDynamicMapLayer,
    });
    fields = [
      ...new Set(
        Object.values(attributes).flatMap((attrs) =>
          attrs.map((f) => f.name),
        ),
      ),
    ];
  } else if (sourceProps.type === "GeoJSON") {
    try {
      const geojson = await loadGeoJSON(sourceProps.geojson, dashboard_uuid);
      fields = [
        ...new Set(
          (geojson.features ?? []).flatMap((feature) =>
            Object.keys(feature.properties ?? {}),
          ),
        ),
      ];
    } catch (e) {
      return fields;
    }
  } else if (sourceProps.type === "ESRI Feature Service") {
    const attributes = await getArcGISFeatureServiceLayerAttributes(
      sourceProps.props.url,
      sourceProps.props.layer,
      layerProps.name,
    );
    fields = [
      ...new Set(
        Object.values(attributes).flatMap((attrs) =>
          attrs.map((f) => f.name),
        ),
      ),
    ];
  }
  return fields;
}

export async function getLayerAttributes({
  sourceProps,
  layerName,
  dashboard_uuid,
  isDynamicMapLayer,
}) {
  // setup constants
  let attributes;
  const sourceProperties = sourceProps.props;
  const sourceType = sourceProps.type;
  const sourceParams = sourceProperties?.params ?? {};
  const sourceUrl = sourceProperties?.url ?? "";
  const sourceGeoJSON = sourceProps?.geojson ?? {};
  const layerNumber = sourceProperties?.layer;

  if (isDynamicMapLayer) {
    const apiResponse = await appAPI.getVisualizationData({
      source: sourceProps.source,
      args: sourceProps.args ?? {},
    });
    if (!apiResponse?.success) {
      throw new Error(
        apiResponse?.data?.error ?? "Failed to fetch plugin attributes.",
      );
    }
    const scaffold = apiResponse.data ?? {};
    const scaffoldAliases = scaffold.attributeAliases ?? {};
    const scaffoldVariables = scaffold.attributeVariables ?? {};
    const scaffoldOmitted = scaffold.omittedPopupAttributes ?? {};
    const scaffoldLayerNames = new Set([
      ...Object.keys(scaffoldAliases),
      ...Object.keys(scaffoldVariables),
      ...Object.keys(scaffoldOmitted),
    ]);
    if (scaffoldLayerNames.size === 0) {
      scaffoldLayerNames.add(layerName);
    }
    attributes = {};
    for (const name of scaffoldLayerNames) {
      const aliasesForLayer = scaffoldAliases[name] ?? {};
      const fieldNames = new Set([
        ...Object.keys(aliasesForLayer),
        ...Object.keys(scaffoldVariables[name] ?? {}),
        ...(scaffoldOmitted[name] ?? []),
      ]);
      attributes[name] = Array.from(fieldNames).map((field) => ({
        name: field,
        alias: aliasesForLayer[field] ?? field,
      }));
    }
  } else if (sourceType === "ESRI Image and Map Service") {
    attributes = await getImageArcGISRestLayerAttributes(
      sourceUrl,
      sourceParams,
    );
  } else if (sourceType === "WMS") {
    attributes = await getImageWMSLayerAttributes(sourceUrl, sourceParams);
  } else if (sourceType === "GeoJSON") {
    attributes = await getGeoJSONLayerAttributes(
      sourceGeoJSON,
      layerName,
      dashboard_uuid,
    );
  } else if (sourceType === "ESRI Feature Service") {
    attributes = await getArcGISFeatureServiceLayerAttributes(
      sourceUrl,
      layerNumber,
      layerName,
    );
  } else if (sourceType === "KML") {
    attributes = await getKMLLayerAttributes(sourceUrl, layerName);
  } else if (sourceType === "PMTiles Vector") {
    attributes = await getPMTilesVectorLayerAttributes(sourceUrl);
  } else {
    throw Error(`${sourceType} is not currently configured to be queried`);
  }

  return attributes;
}

async function getPMTilesVectorLayerAttributes(sourceUrl) {
  // Default to tile 0/0/0 if not specified, or allow passing tile coordinates as needed
  const z = 0,
    x = 0,
    y = 0;
  const pmtiles = new PMTiles(sourceUrl);
  const { data } = await pmtiles.getZxy(z, x, y);
  const tile = new VectorTile(new Protobuf(data));
  const sourceAttributes = {};
  const layerNames = Object.keys(tile.layers);
  for (const lyrName of layerNames) {
    const layer = tile.layers[lyrName];
    const attributesSet = new Set();
    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);
      Object.keys(feature.properties).forEach((attr) => {
        attributesSet.add(attr);
      });
    }
    const attributes = Array.from(attributesSet).map((attr) => ({
      name: attr,
      alias: attr,
    }));
    sourceAttributes[lyrName] = attributes;
  }
  return sourceAttributes;
}

async function getKMLLayerAttributes(sourceUrl, layerName) {
  const parser = new DOMParser();
  const kmlTextResponse = await fetch(sourceUrl);
  const kmlText = await kmlTextResponse.text();
  const xmlDoc = parser.parseFromString(kmlText, "application/xml");

  const invalidTags = [
    "Point",
    "LineString",
    "Polygon",
    "MultiGeometry",
    "MultiLineString",
    "MultiPolygon",
    "GeometryCollection",
    "styleUrl",
    "description",
  ];

  const placemarks = xmlDoc.getElementsByTagName("Placemark");
  const attributes = new Set();
  for (let i = 0; i < placemarks.length; i++) {
    const placemark = placemarks[i];
    for (let j = 0; j < placemark.children.length; j++) {
      const child = placemark.children[j];
      const tag = child.tagName;
      if (!invalidTags.includes(tag)) {
        attributes.add(tag);
      }
    }
  }
  return {
    [layerName]: Array.from(attributes).map((attr) => ({
      name: attr,
      alias: attr,
    })),
  };
}

async function getImageArcGISRestLayerAttributes(sourceUrl, sourceParams) {
  // setup fetch request with params
  const sourceURLParams = new URLSearchParams({
    f: "json",
  });
  const sourceInfoUrl = `${sourceUrl}?${sourceURLParams.toString()}`;

  // Fetch data and parse json
  const sourceInfoResponse = await fetch(sourceInfoUrl);
  const sourceInfoJSON = await sourceInfoResponse.json();

  // Filter layers based on sourceParams.LAYERS directive (show/hide/include/exclude)
  const sourceAttributes = {};
  const allLayers = sourceInfoJSON.layers;
  let visibleLayers;

  if (sourceParams?.LAYERS) {
    const [directive, ids] = sourceParams.LAYERS.split(":");
    const layerIds = ids.split(",").map(Number);

    if (directive === "show") {
      visibleLayers = allLayers.filter((l) => layerIds.includes(l.id));
    } else if (directive === "hide") {
      visibleLayers = allLayers.filter((l) => !layerIds.includes(l.id));
    } else if (directive === "include") {
      visibleLayers = allLayers.filter(
        (l) => l.defaultVisibility || layerIds.includes(l.id),
      );
    } else if (directive === "exclude") {
      visibleLayers = allLayers.filter(
        (l) => l.defaultVisibility && !layerIds.includes(l.id),
      );
    } else {
      visibleLayers = allLayers.filter((l) => l.defaultVisibility);
    }
  } else {
    visibleLayers = allLayers.filter((l) => l.defaultVisibility);
  }

  // for each visible layer, make a new request to get layer specific attributes
  for (const layer of visibleLayers) {
    // Fetch data and parse json
    let specificLayerInfoUrl = `${sourceUrl}/${layer.id}?${sourceURLParams.toString()}`;
    let specificLayerInfoResponse = await fetch(specificLayerInfoUrl);
    let specificLayerInfoJson = await specificLayerInfoResponse.json();

    // loop through layer fields and append to sourceAttributes object
    let specificLayerFieds = [];
    for (const field of specificLayerInfoJson.fields ?? []) {
      specificLayerFieds.push({ name: field.name, alias: field.alias });
    }
    sourceAttributes[layer.name] = specificLayerFieds;
  }

  return sourceAttributes;
}

export async function getArcGISFeatureServiceLayerAttributes(
  sourceUrl,
  layerNumber,
  layerName,
) {
  sourceUrl += sourceUrl.endsWith("/") ? layerNumber : `/${layerNumber}`;

  // setup fetch request with params
  const sourceURLParams = new URLSearchParams({
    f: "json",
  });
  const sourceInfoUrl = `${sourceUrl}?${sourceURLParams.toString()}`;

  // Fetch data and parse json
  const sourceInfoResponse = await fetch(sourceInfoUrl);
  const sourceInfoJSON = await sourceInfoResponse.json();

  // setup constants, get an array of layer names
  let layerFields = [];
  for (const field of sourceInfoJSON.fields) {
    layerFields.push({ name: field.name, alias: field.alias });
  }
  const sourceAttributes = { [layerName]: layerFields };
  return sourceAttributes;
}

async function getImageWMSLayerAttributes(sourceUrl, sourceParams) {
  // Normalize source params to lowercase
  const lowercaseLayerParams = Object.keys(sourceParams).reduce((acc, key) => {
    acc[key.toLowerCase()] = sourceParams[key];
    return acc;
  }, {});

  const layerNames = lowercaseLayerParams.layers
    ?.split(",")
    .map((l) => l.trim());
  if (!layerNames || layerNames.length === 0) {
    throw new Error("No layers specified in source parameters.");
  }

  const sourceAttributes = {};

  for (const layerName of layerNames) {
    const sourceURLParams = new URLSearchParams({
      service: "WFS",
      request: "describeFeatureType",
      typename: layerName,
    });
    const sourceInfoUrl = `${sourceUrl}?${sourceURLParams.toString()}`;

    let sourceInfoResponse;
    try {
      sourceInfoResponse = await fetch(sourceInfoUrl);
    } catch (e) {
      throw new Error(
        `Failed to fetch attribute data for layer '${layerName}'. Check if the layer exists.`,
      );
    }

    const sourceInfoText = await sourceInfoResponse.text();
    if (sourceInfoText.includes("ExceptionReport")) {
      throw new Error(
        `WFS DescribeFeatureType request failed for layer '${layerName}'. Ensure WFS is enabled and the layer name is correct.`,
      );
    }

    const sourceInfoJSON = convertXML(sourceInfoText);
    const schema = sourceInfoJSON["xsd:schema"];

    if (!schema || !Array.isArray(schema.children)) {
      throw new Error(
        `Unexpected DescribeFeatureType format for layer '${layerName}'.`,
      );
    }

    const allLayersInfo = schema.children.filter((obj) =>
      Reflect.has(obj, "xsd:complexType"),
    );

    for (const { "xsd:complexType": layerInfo } of allLayersInfo) {
      const layerTypeName = layerInfo.name?.replace("Type", "") || layerName;
      const fields =
        layerInfo.children?.[0]?.["xsd:complexContent"]?.children?.[0]?.[
          "xsd:extension"
        ]?.children?.[0]?.["xsd:sequence"]?.children;

      if (!Array.isArray(fields)) {
        continue;
      }

      const attributes = fields
        .map((obj) => {
          const element = obj["xsd:element"];
          const name = element?.name;
          return name ? { name, alias: name } : null;
        })
        .filter(Boolean);

      sourceAttributes[layerTypeName] = attributes;
    }
  }

  return sourceAttributes;
}

async function getGeoJSONLayerAttributes(
  sourceGeoJSON,
  layerName,
  dashboard_uuid,
) {
  // setup constants
  const sourceAttributes = {};
  const attributes = [];

  // get the geojson features
  const geoJSON = await loadGeoJSON(sourceGeoJSON, dashboard_uuid);

  const sourceFeatures = geoJSON?.features ?? [];

  // for each feature, get an array of all the available properties/fields and then flatten into a single array
  const propertyKeys = sourceFeatures
    .map((feature) =>
      feature.properties ? Object.keys(feature.properties) : [],
    )
    .flat();

  // remove any duplicate fields and then add to the sourceAttributes object
  const uniquePropertyKeys = [...new Set(propertyKeys)];
  for (const uniquePropertyKey of uniquePropertyKeys) {
    attributes.push({
      name: uniquePropertyKey,
      alias: uniquePropertyKey,
    });
  }
  sourceAttributes[layerName] = attributes;

  return sourceAttributes;
}

async function loadStyle(style, layerName, dashboard_uuid, keep_urls) {
  if (typeof style !== "object") {
    if (style.includes("/")) {
      if (keep_urls) return style;
      const response = await fetch(style);
      if (!response.ok) {
        console.error(`Failed to load the style for ${layerName} layer`);
        return undefined;
      }
      return JSON5.parse(await response.text());
    } else {
      const styleJSONResponse = await appAPI.downloadJSON({
        filename: style,
        dashboard_uuid,
      });
      if (!styleJSONResponse.success) {
        console.error(`Failed to load the style for ${layerName} layer`);
        return undefined;
      }
      return styleJSONResponse.data;
    }
  }
  return style;
}

export async function loadGeoJSON(geojson, dashboard_uuid, keep_urls = false) {
  if (typeof geojson === "object") return geojson;
  if (geojson.trim().startsWith("{")) {
    return JSON5.parse(geojson);
  }
  if (geojson.includes("/")) {
    if (keep_urls) return geojson;
    const response = await fetch(geojson);
    if (!response.ok) throw Error(`Failed to fetch: ${response.statusText}`);
    geojson = JSON5.parse(await response.text());
  } else {
    const geoJSONResponse = await appAPI.downloadJSON({
      filename: geojson,
      dashboard_uuid,
    });
    if (!geoJSONResponse.success) throw Error(geoJSONResponse.message);
    geojson = geoJSONResponse.data;
  }
  const crs = checkForCRS(geojson);
  if (!crs)
    throw Error(
      "GeoJSON does include a crs key and CRS could not be inferred from the data. Must be a valid geojson.",
    );
  geojson.crs = geojson.crs || {};
  geojson.crs.properties = geojson.crs.properties || {};
  geojson.crs.properties.name = crs;
  return geojson;
}

export async function loadLayerJSONs(
  mapLayer,
  dashboard_uuid,
  keep_urls = false,
) {
  // Load style if needed
  if (mapLayer?.configuration?.style) {
    const style = await loadStyle(
      mapLayer.configuration.style,
      mapLayer.configuration.props?.name,
      dashboard_uuid,
      keep_urls,
    );
    if (style !== undefined) {
      mapLayer.configuration.style = style;
    } else {
      delete mapLayer.configuration.style;
    }
  }

  // Load GeoJSON if needed
  const source = mapLayer?.configuration?.props?.source;
  if (source?.type === "GeoJSON" && source?.geojson) {
    const geo = source.geojson;
    const isUrlGeoJSON =
      typeof geo === "string" &&
      geo.trim() !== "" &&
      geo.includes("/") &&
      !geo.trim().startsWith("{");

    // URL-based GeoJSON: leave the URL on source.geojson. ModuleLoader's
    // VectorSource will pass it to OL's GeoJSON format via `url:` so OL
    // fetches + parses directly into features — no intermediate JS object
    // tree, and layer fetches parallelize instead of serializing through
    // this await loop. For inline JSON bodies and saved workspace
    // filenames, keep the existing fetch/parse path.
    if (!isUrlGeoJSON) {
      let geojson;
      try {
        geojson = await loadGeoJSON(geo, dashboard_uuid, keep_urls);
      } catch (e) {
        delete mapLayer.configuration.props.source.geojson;
        return {
          success: false,
          message: `Failed to fetch: ${e.message}`,
        };
      }
      mapLayer.configuration.props.source.geojson = geojson;
    }
  }

  return { success: true };
}

export function checkForCRS(geojson) {
  // 1. Check for explicit CRS
  if (geojson?.crs?.properties?.name) {
    return geojson.crs.properties.name;
  }

  // 2. Determine the first geometry to inspect
  let geometry = null;

  if (geojson.type === "FeatureCollection" && geojson.features?.length) {
    geometry = geojson.features[0].geometry;
  } else if (geojson.type === "Feature") {
    geometry = geojson.geometry;
  } else if (geojson.type && geojson.coordinates) {
    geometry = geojson; // A single geometry object
  }

  if (!geometry) return null;

  // 3. Extract first coordinate pair
  const coord = getFirstCoordinate(geometry);
  if (!coord) return null;

  const [x, y] = coord;

  // 4. Guess CRS
  const is4326 = Math.abs(x) <= 180 && Math.abs(y) <= 90;
  const is3857 = Math.abs(x) > 180 || Math.abs(y) > 90;

  if (is4326) return "EPSG:4326";
  if (is3857) return "EPSG:3857";
}

function getFirstCoordinate(geometry) {
  const coords = geometry.coordinates;

  function findCoord(arr) {
    if (typeof arr[0] === "number" && typeof arr[1] === "number") {
      return arr;
    } else if (Array.isArray(arr[0])) {
      return findCoord(arr[0]);
    }
    return null;
  }

  return findCoord(coords);
}

export async function saveLayerJSON({
  stringJSON,
  csrf,
  check_crs,
  dashboard_uuid,
}) {
  let parsedJSON;
  if (stringJSON.startsWith('"') && stringJSON.endsWith('"')) {
    stringJSON = stringJSON.slice(1, -1);
  }
  // If it looks like a JSON string (starts with `{` or `[`), parse it directly
  const trimmed = stringJSON.trim();
  const looksLikeJson = trimmed.startsWith("{") || trimmed.startsWith("[");

  try {
    let jsonText;

    if (looksLikeJson) {
      jsonText = trimmed;
    } else {
      // Otherwise, assume it's a URL or path to a remote file
      const response = await fetch(stringJSON);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      jsonText = await response.text();
    }

    parsedJSON = JSON5.parse(jsonText);
  } catch (err) {
    console.log("Failed to parse JSON or fetch file:", err);
    return {
      success: false,
      message: "Invalid JSON or failed to fetch/parse the file.",
    };
  }

  if (check_crs) {
    if (!checkForCRS(parsedJSON)) {
      return {
        success: false,
        message:
          "GeoJSON does include a crs key and CRS could not be inferred from the data. Must be a valid geojson.",
      };
    }
  }

  if (looksLikeJson) {
    const JSONFilename = `${uuidv4()}.json`;
    const JSONInfo = {
      data: JSON.stringify(parsedJSON),
      filename: JSONFilename,
      dashboard_uuid,
    };
    const apiResponse = await appAPI.uploadJSON(JSONInfo, csrf);

    return apiResponse;
  } else {
    return { success: true, filename: stringJSON };
  }
}

// layer attribute variable for the layer, structure is {layerName: {"field1": "Variable Name 1"}}
export const attributeVariablesPropType = PropTypes.objectOf(
  PropTypes.objectOf(PropTypes.string),
);

// layer attributes to be omitted in the popups, structure is {layerName: ["field1", "field2"]}
export const omittedPopupAttributesPropType = PropTypes.objectOf(
  PropTypes.arrayOf(PropTypes.string),
);

export const attributePropsPropType = PropTypes.shape({
  variables: attributeVariablesPropType,
  omitted: omittedPopupAttributesPropType,
  queryable: PropTypes.bool,
});

export const sourcePropType = PropTypes.shape({
  props: PropTypes.object, // an object of source properties like url, params, etc. see components/map/utilities.js (sourcePropertiesOptions) for examples
  type: PropTypes.string, // layer source type
});

// plugin-reference block for runtime-capable map_layer plugins.
// Present as a sibling to `source` under `configuration.props` when the
// layer's features are fetched at runtime via plugin.fetch_features().
// `args` preserves raw template strings (e.g. "${VarName}") and is resolved
// against VariableInputsContext at fetch time.
export const pluginSourcePropType = PropTypes.shape({
  source: PropTypes.string.isRequired,
  args: PropTypes.object.isRequired,
});

export const configurationPropType = PropTypes.shape({
  // other layer properties are available like opacity, zoom, etc. see components/map/utilities.js (layerPropertiesOptions) for examples
  props: PropTypes.shape({
    name: PropTypes.string,
    source: sourcePropType,
    // Stable UUID assigned at save time; used for runtime-layer
    // reconciliation identity and for the per-layer WebSocket correlation id.
    layerId: PropTypes.string,
    // Optional; present on runtime-capable layers only.
    pluginSource: pluginSourcePropType,
  }),
  type: PropTypes.string, // layer type
});

export const legendItemPropType = PropTypes.shape({
  color: PropTypes.string, // legend item color
  label: PropTypes.string, // legend item label
  symbol: PropTypes.string, // legend item symbol
});

export const legendPropType = PropTypes.oneOfType([
  PropTypes.string, // e.g., "default"
  PropTypes.shape({
    title: PropTypes.string, // title for the layer in the map legend
    items: PropTypes.arrayOf(legendItemPropType), // array of legend items
  }),
  // Auto-generated colorbar legend for GeoTIFF ramp-styled layers.
  PropTypes.shape({
    rampColors: PropTypes.arrayOf(PropTypes.string).isRequired,
    rampMin: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
      .isRequired,
    rampMax: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
      .isRequired,
    title: PropTypes.string,
  }),
]);

export const layerPropType = PropTypes.shape({
  configuration: configurationPropType,
  attributeVariables: attributeVariablesPropType,
  omittedPopupAttributes: omittedPopupAttributesPropType,
  style: PropTypes.string,
  legend: legendPropType,
});

export const layerInfoPropType = PropTypes.shape({
  sourceProps: sourcePropType,
  layerProps: PropTypes.shape({
    name: PropTypes.string,
  }), // an object of layer properties like opacity, zoom, etc. see components/map/utilities.js (layerPropertiesOptions) for examples
  legend: legendPropType,
  style: PropTypes.string, // name of .json file that is save with the application that contain the actual style json
  attributeVariables: attributeVariablesPropType,
  omittedPopupAttributes: omittedPopupAttributesPropType,
});

export const mapDrawingPropType = PropTypes.shape({
  options: PropTypes.arrayOf(PropTypes.string),
  limit: PropTypes.number,
});
