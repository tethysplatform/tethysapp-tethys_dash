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
  const params = new URLSearchParams({
    f: "json",
    tolerance: 10, // Pixel tolerance
    returnGeometry: true,
    geometryType: "esriGeometryPoint",
    sr: map.getView().getProjection().getCode().split(":")[1],
    geometry: coordinate.join(","),
    mapExtent: map.getView().calculateExtent().join(","),
    returnFieldName: true,
    imageDisplay: map
      .getSize()
      .concat(map.getView().getResolution())
      .join(", "),
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
}) {
  // make sure a valid json is supplied if the source is GeoJSON
  let fields = [];
  let geojson;
  if (sourceProps.type === "GeoJSON") {
    try {
      geojson = await loadGeoJSON(sourceProps.geojson, dashboard_uuid);
    } catch (e) {
      return fields;
    }
    fields = [
      ...new Set(
        geojson.features.flatMap((feature) =>
          Object.keys(feature.properties ?? {}),
        ),
      ),
    ];
  } else if (sourceProps.type === "ESRI Feature Service") {
    const attributes = await getArcGISFeatureServiceLayerAttributes(
      sourceProps.props.url,
      sourceProps.props.layer,
      layerProps.name,
    );
    fields = [
      ...new Set(
        Object.values(attributes).flatMap((fields) =>
          fields.map((f) => f.name),
        ),
      ),
    ];
  }
  return fields;
}

export async function getLayerAttributes(
  sourceProps,
  layerName,
  dashboard_uuid,
) {
  // setup constants
  let attributes;
  const sourceProperties = sourceProps.props;
  const sourceType = sourceProps.type;
  const sourceParams = sourceProperties?.params ?? {};
  const sourceUrl = sourceProperties?.url ?? "";
  const sourceGeoJSON = sourceProps?.geojson ?? {};
  const layerNumber = sourceProperties?.layer;

  // make the appropriate request based on the source type
  // TODO: add PM Vector Tile and KML attribute retrieval
  if (sourceType === "ESRI Image and Map Service") {
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
    let geojson;
    try {
      geojson = await loadGeoJSON(source.geojson, dashboard_uuid, keep_urls);
    } catch (e) {
      delete mapLayer.configuration.props.source.geojson;
      return {
        success: false,
        message: `Failed to fetch: ${e.message}`,
      };
    }
    mapLayer.configuration.props.source.geojson = geojson;
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

export const configurationPropType = PropTypes.shape({
  // other layer properties are available like opacity, zoom, etc. see components/map/utilities.js (layerPropertiesOptions) for examples
  props: PropTypes.shape({
    name: PropTypes.string,
    source: sourcePropType,
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
