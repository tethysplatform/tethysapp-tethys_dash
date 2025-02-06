import { convertXML } from "simple-xml-to-json";
import { transform } from "ol/proj";
import Feature from "ol/Feature";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { LineString, MultiPolygon, Polygon, Point } from "ol/geom";
import { Stroke, Style, Circle } from "ol/style";
import Icon from "ol/style/Icon";

export const sourcePropertiesOptions = {
  ImageArcGISRest: {
    required: {
      url: "ArcGIS Rest service URL",
    },
    optional: {
      attributions: "Attributions",
      params: {
        LAYERS: "[show|hide|include|exclude]:layerId1,layerId2",
        TIME: "<startTime>, <endTime> or <timeInstant>",
        LAYERDEFS: "Allows you to filter the features of individual layers",
      },
      projection: "EPSG:<Code>",
    },
  },
  ImageWMS: {
    required: {
      url: "WMS service URL",
      params: {
        LAYERS: "<workspace>:<layerName>,<workspace>:<layerName>",
      },
    },
    optional: {
      attributions: "Attributions",
      params: {
        STYLES: "SLD (Styled Layer Descriptor) Name",
        TIME: "yyyy-MM-ddThh:mm:ss.SSSZ",
      },
      projection: "EPSG:<Code>",
    },
  },
  ImageTile: {
    required: {
      url: "Image Tile URL",
    },
    optional: {
      attributions: "Attributions",
      projection: "EPSG:<Code>",
    },
  },
  GeoJSON: {
    required: {},
    optional: {},
  },
  VectorTile: {
    required: {
      urls: "An comma separated list of URL templates. Must include {x}, {y} or {-y}, and {z} placeholders. A {?-?} template pattern, for example subdomain{a-f}.domain.com, may be used instead of defining each one separately in the urls option.",
    },
    optional: {
      attributions: "Attributions",
      projection: "EPSG:<Code>",
    },
  },
};

export const layerPropertiesOptions = {
  opacity: "Opacity (0, 1)",
  minResolution:
    "The minimum resolution (inclusive) at which this layer will be visible.",
  maxResolution:
    "The maximum resolution (exclusive) below which this layer will be visible.",
  minZoom:
    "The minimum view zoom level (exclusive) above which this layer will be visible.",
  maxZoom:
    "The maximum view zoom level (inclusive) at which this layer will be visible.",
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
    })
  );
  const markerLayer = new VectorLayer({
    source: new VectorSource({
      features: [marker],
    }),
    name: "ClickMarkerLayer",
  });

  return markerLayer;
}

export function createHighlightLayer(geometries) {
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
  } else if (geometries?.type === "MultiPolygon") {
    features = [
      new Feature({
        geometry: new MultiPolygon(geometries.coordinates),
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
  const stroke = new Stroke({
    color: "#00008b",
    width: 3,
  });
  const highlightLayer = new VectorLayer({
    source: new VectorSource({
      features: features,
    }),
    style: new Style({
      stroke: stroke,
      image: new Circle({
        stroke: stroke,
        radius: 5,
      }),
    }),
    zIndex: 100,
    name: "ClickHighlighterLayer",
  });

  return highlightLayer;
}

export function transformCoordinates(coords, sourceProj, destProj) {
  if (Array.isArray(coords[0])) {
    return coords.map((coord) =>
      transformCoordinates(coord, sourceProj, destProj)
    );
  } else if (
    coords.length === 2 &&
    typeof coords[0] === "number" &&
    typeof coords[1] === "number"
  ) {
    return transform(coords, sourceProj, destProj);
  } else {
    throw new Error("Invalid coordinate structure");
  }
}

export async function queryLayerFeatures(layerInfo, map, coordinate, pixel) {
  let features;
  const sourceUrl = layerInfo.configuration.props.source.props?.url ?? "";
  const sourceParams = layerInfo.configuration.props.source.props.params;
  const sourceType = layerInfo.configuration.props.source.type;
  if (sourceType === "ImageArcGISRest") {
    features = await getESRILayerFeatures(sourceUrl, map, coordinate);
  } else if (sourceType === "ImageWMS") {
    features = await getImageWMSLayerFeatures(
      sourceUrl,
      sourceParams,
      map,
      pixel
    );
  } else if (sourceType === "GeoJSON") {
    features = await getGeoJSONLayerFeatures(map, pixel, coordinate);
  } else {
    throw Error(`${sourceType} is not currently configured to be queried`);
  }

  return features;
}

async function getESRILayerFeatures(sourceUrl, map, coordinate) {
  const featureQueryUrl = sourceUrl + "/identify";
  // Build the identify request parameters
  const params = new URLSearchParams({
    f: "json",
    tolerance: 10, // Pixel tolerance
    returnGeometry: true,
    geometryType: "esriGeometryPoint",
    sr: map.getView().getProjection().getCode(),
    geometry: coordinate.join(","),
    mapExtent: map.getView().calculateExtent().join(","),
    imageDisplay: map
      .getSize()
      .concat(map.getView().getResolution())
      .join(", "),
  });

  try {
    const featureQuery = await fetch(`${featureQueryUrl}?${params.toString()}`);
    const featureQueryJson = await featureQuery.json();
    return featureQueryJson.results;
  } catch (error) {
    console.error("Identify request failed:", error);
    return null;
  }
}

async function getImageWMSLayerFeatures(sourceUrl, sourceParams, map, pixel) {
  const lowercaseSourceParams = Object.keys(sourceParams).reduce((acc, key) => {
    acc[key.toLowerCase()] = sourceParams[key];
    return acc;
  }, {});
  const [mapWidth, mapHeight] = map.getSize();
  const mapSRS = map.getView().getProjection().getCode();
  // Build the identify request parameters
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
  try {
    const featureQuery = await fetch(`${sourceUrl}?${params.toString()}`);
    const featureQueryJson = await featureQuery.json();
    const features = [];
    const featuresSRSRaw =
      featureQueryJson.crs.properties.name.match(/crs:(.*)/)[1];
    const featuresSRSFormatted = featuresSRSRaw.replace("::", ":");

    for (const feature of featureQueryJson.features) {
      let transformedCoords = feature.geometry.coordinates;
      if (mapSRS !== featuresSRSFormatted) {
        transformedCoords = transformCoordinates(
          transformedCoords,
          featuresSRSFormatted,
          mapSRS
        );
      }
      const updatedGeometry = {
        ...feature.geometry,
        ...{ coordinates: transformedCoords },
      };
      features.push({
        layerName: feature.id.split(".")[0],
        attributes: feature.properties,
        geometry: updatedGeometry,
      });
    }
    return features;
  } catch (error) {
    console.error("Identify request failed:", error);
    return null;
  }
}

async function getGeoJSONLayerFeatures(map, pixel, coordinate) {
  const features = [];
  map.forEachFeatureAtPixel(pixel, function (feature, layer) {
    if (
      layer.get("name") === "ClickHighlighterLayer" ||
      layer.get("name") === "ClickMarkerLayer"
    ) {
      return;
    }

    if (feature) {
      let clickedGeometries = [];
      const { geometry, ...properties } = feature.getProperties();
      if (geometry.getType() === "GeometryCollection") {
        const resolution = map.getView().getResolution();
        geometry.getGeometries().forEach((geom) => {
          const type = geom.getType();

          if (
            type === "Point" ||
            type === "LineString" ||
            type === "MultiLineString"
          ) {
            const closestPoint = geom.getClosestPoint(coordinate);
            const distance =
              Math.sqrt(
                Math.pow(closestPoint[0] - coordinate[0], 2) +
                  Math.pow(closestPoint[1] - coordinate[1], 2)
              ) / resolution; // to get pixel distance
            const threshold = 10; // pixel threshold
            if (distance < threshold) {
              clickedGeometries.push(geom);
            }
          } else {
            if (geom.intersectsCoordinate(coordinate)) {
              clickedGeometries.push(geom);
            }
          }
        });
      } else {
        clickedGeometries.push(geometry);
      }
      if (clickedGeometries.length > 0) {
        clickedGeometries.forEach((clickedGeometry) => {
          features.push({
            layerName: layer.getProperties().name,
            attributes: properties,
            geometry: {
              type: clickedGeometry.getType(),
              coordinates: clickedGeometry.getCoordinates(),
            }, // {x:"", y:"", spatialreference: {}}, {type: "MultiPolygon", coordinates: [[],[],[],[]]}
          });
        });
      }
    }
  });

  return features;
}

export async function getLayerAttributes(sourceProps, layerName) {
  let attributes;
  const sourceProperties = sourceProps.props;
  const sourceType = sourceProps.type;
  const sourceParams = sourceProperties?.params ?? {};
  const sourceUrl = sourceProperties?.url ?? "";
  const sourceGeoJSON = sourceProps?.geojson ?? {};
  if (sourceType === "ImageArcGISRest") {
    attributes = await getESRILayerAttributes(sourceUrl);
  } else if (sourceType === "ImageWMS") {
    attributes = await getImageWMSLayerAttributes(sourceUrl, sourceParams);
  } else if (sourceType === "GeoJSON") {
    attributes = await getGeoJSONLayerAttributes(sourceGeoJSON, layerName);
  } else {
    throw Error(`${sourceType} is not currently configured to be queried`);
  }

  return attributes;
}

async function getESRILayerAttributes(sourceUrl) {
  const sourceURLParams = new URLSearchParams({
    f: "json",
  });

  const sourceInfoUrl = `${sourceUrl}?${sourceURLParams.toString()}`;
  const sourceInfoResponse = await fetch(sourceInfoUrl);
  const sourceInfoJSON = await sourceInfoResponse.json();

  const sourceAttributes = {};
  const layers = sourceInfoJSON.layers.map((layer) => layer.name);

  for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
    let layerName = layers[layerIndex];
    let specificLayerInfoUrl = `${sourceUrl}/${layerIndex}?${sourceURLParams.toString()}`;
    let specificLayerInfoResponse = await fetch(specificLayerInfoUrl);
    let specificLayerInfoJson = await specificLayerInfoResponse.json();
    let specificLayerFieds = [];
    for (const field of specificLayerInfoJson.fields) {
      specificLayerFieds.push({ name: field.name, alias: field.alias });
    }
    sourceAttributes[layerName] = specificLayerFieds;
  }

  return sourceAttributes;
}

async function getImageWMSLayerAttributes(sourceUrl, sourceParams) {
  const lowercaseLayerParams = Object.keys(sourceParams).reduce((acc, key) => {
    acc[key.toLowerCase()] = sourceParams[key];
    return acc;
  }, {});

  const sourceURLParams = new URLSearchParams({
    service: "WFS",
    request: "describeFeatureType",
    typename: lowercaseLayerParams.layers,
  });
  const sourceInfoUrl = `${sourceUrl}?${sourceURLParams.toString()}`;
  let sourceInfoResponse;
  try {
    sourceInfoResponse = await fetch(sourceInfoUrl);
  } catch (e) {
    throw new Error(
      "Failed to fetch attribute data. Check to make sure layers exist."
    );
  }
  const sourceInfoText = await sourceInfoResponse.text();
  if (sourceInfoText.includes("ExceptionReport")) {
    throw new Error(
      "Failed to fetch attribute data. Check to make sure WFS extension is enabled on layers or that layer names are correct."
    );
  }
  const sourceInfoJSON = convertXML(sourceInfoText);
  const sourceAttributes = {};

  const allLayersInfo = sourceInfoJSON["xsd:schema"].children.filter((obj) =>
    obj.hasOwnProperty("xsd:complexType")
  );
  for (const { "xsd:complexType": layerInfo } of allLayersInfo) {
    const layerName = layerInfo.name.replace("Type", "");
    const fields =
      layerInfo.children[0]["xsd:complexContent"].children[0]["xsd:extension"]
        .children[0]["xsd:sequence"].children;

    const attributes = fields.map((obj) => ({
      name: obj["xsd:element"]?.name,
      alias: obj["xsd:element"]?.name,
    }));
    sourceAttributes[layerName] = attributes;
  }

  return sourceAttributes;
}

async function getGeoJSONLayerAttributes(sourceGeoJSON, layerName) {
  const sourceAttributes = {};
  const attributes = [];
  const geoJSON =
    typeof sourceGeoJSON === "object"
      ? sourceGeoJSON
      : JSON.parse(sourceGeoJSON);
  const sourceFeatures = geoJSON?.features ?? [];
  const propertyKeys = sourceFeatures
    .map((feature) =>
      feature.properties ? Object.keys(feature.properties) : []
    )
    .flat();
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

export function getMapAttributeVariables(mapLayers) {
  let mapAttributeVariables = [];
  // loop through all map layers
  for (let mapLayer of mapLayers) {
    // loop through all map layers/sublayers
    for (const mapLayerName in mapLayer.attributeVariables) {
      // get all the variable inputs setup from the layer/sublayer attributes
      const layerAttributeVariables = Object.values(
        mapLayer.attributeVariables[mapLayerName]
      );
      mapAttributeVariables = [
        ...mapAttributeVariables,
        ...layerAttributeVariables,
      ];
    }
  }
  return mapAttributeVariables;
}
