import { convertXML } from "simple-xml-to-json";
import { transform } from "ol/proj";
import Feature from "ol/Feature";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { LineString, MultiPolygon, Polygon, Point } from "ol/geom";
import { Stroke, Style, Circle } from "ol/style";
import Icon from "ol/style/Icon";

export const layerTypeProperties = {
  ImageArcGISRest: {
    required: {
      url: "ArcGIS Rest service URL",
    },
    optional: {
      attributions: "Attributions",
      params: {
        LAYERS: "[show|hide|include|exclude]:layerId1,layerId2",
        TIME: "<startTime>, <endTime> or <timeInstant>",
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

export const layerOptions = {
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
    name: "Marker",
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
    name: "Highlighter",
  });

  return highlightLayer;
}

function transformCoordinates(coords, sourceProj, destProj) {
  return coords.map((polygon) => {
    return polygon.map((ring) => {
      return ring.map((coord) => {
        return transform(coord, sourceProj, destProj);
      });
    });
  });
}

export async function queryLayerFeatures(layerInfo, map, coordinate, pixel) {
  let features;
  const layerUrl = layerInfo.configuration.props.source.props?.url ?? "";
  const layerParams = layerInfo.configuration.props.source.props.params;
  const layerType = layerInfo.configuration.props.source.type;
  if (layerUrl.includes("MapServer")) {
    features = await getESRILayerFeatures(layerUrl, map, coordinate);
  } else if (layerType === "ImageWMS") {
    features = await getImageWMSLayerFeatures(
      layerUrl,
      layerParams,
      map,
      coordinate,
      pixel
    );
  } else if (layerType === "GeoJSON") {
    features = await getGeoJSONLayerFeatures(map, pixel, coordinate);
  } else {
    throw Error(`${layerType} is not currently configured to be queried`);
  }

  return features;
}

async function getESRILayerFeatures(layerUrl, map, coordinate) {
  const featureQueryUrl = layerUrl + "/identify";
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
  } catch {
    (error) => {
      console.error("Identify request failed:", error);
      return null;
    };
  }
}

async function getImageWMSLayerFeatures(
  layerUrl,
  layerParams,
  map,
  coordinate,
  pixel
) {
  const lowercaseLayerParams = Object.keys(layerParams).reduce((acc, key) => {
    acc[key.toLowerCase()] = layerParams[key];
    return acc;
  }, {});
  const [mapWidth, mapHeight] = map.getSize();
  const mapSRS = map.getView().getProjection().getCode();
  // Build the identify request parameters
  const params = new URLSearchParams({
    INFO_FORMAT: "application/json",
    LAYERS: lowercaseLayerParams.layers ?? "",
    QUERY_LAYERS: lowercaseLayerParams.layers ?? "",
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
    const featureQuery = await fetch(`${layerUrl}?${params.toString()}`);
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
  } catch {
    (error) => {
      console.error("Identify request failed:", error);
      return null;
    };
  }
}

async function getGeoJSONLayerFeatures(map, pixel, coordinate) {
  const resolution = map.getView().getResolution();
  const features = [];
  map.forEachFeatureAtPixel(pixel, function (feature, layer) {
    if (feature) {
      let clickedGeometry = null;
      const { geometry, ...properties } = feature.getProperties();
      if (geometry.getType() === "GeometryCollection") {
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
              clickedGeometry = geom;
            }
          } else {
            if (geom.intersectsCoordinate(coordinate)) {
              clickedGeometry = geom;
            }
          }
        });
      } else {
        clickedGeometry = geometry;
      }
      if (clickedGeometry) {
        features.push({
          layerName: layer.getProperties().name,
          attributes: properties,
          geometry: {
            type: clickedGeometry.getType(),
            coordinates: clickedGeometry.getCoordinates(),
          }, // {x:"", y:"", spatialreference: {}}, {type: "MultiPolygon", coordinates: [[],[],[],[]]}
        });
      }
    }
  });

  return features;
}

export async function getLayerAttributes(layerInfo) {
  let attributes;
  const layerSourceProps = layerInfo.sourceProps;
  const layerType = layerInfo.layerType;
  const layerParams = layerSourceProps?.params ?? {};
  const layerUrl = layerSourceProps?.url ?? "";
  const layerGeoJSON = layerInfo?.geojson ?? {};
  const layerName = layerInfo.name;
  if (layerUrl.includes("MapServer")) {
    attributes = await getESRILayerAttributes(layerUrl);
  } else if (layerType === "ImageWMS") {
    attributes = await getImageWMSLayerAttributes(layerUrl, layerParams);
  } else if (layerType === "GeoJSON") {
    attributes = await getGeoJSONLayerAttributes(layerGeoJSON, layerName);
  } else {
    throw Error(`${layerUrl} is not currently configured to be queried`);
  }

  return attributes;
}

async function getESRILayerAttributes(url) {
  const layerInfoParams = new URLSearchParams({
    f: "json",
  });

  const layerInfoUrl = `${url}?${layerInfoParams.toString()}`;
  const layerInfoResponse = await fetch(layerInfoUrl);
  const layerInfoJson = await layerInfoResponse.json();

  const layerAttributes = {};
  const layers = layerInfoJson.layers.map((layer) => layer.name);

  for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
    let layerName = layers[layerIndex];
    let specificLayerInfoUrl = `${url}/${layerIndex}?${layerInfoParams.toString()}`;
    let specificLayerInfoResponse = await fetch(specificLayerInfoUrl);
    let specificLayerInfoJson = await specificLayerInfoResponse.json();
    let specificLayerFieds = [];
    for (const field of specificLayerInfoJson.fields) {
      specificLayerFieds.push({ name: field.name, alias: field.alias });
    }
    layerAttributes[layerName] = specificLayerFieds;
  }

  return layerAttributes;
}

async function getImageWMSLayerAttributes(layerUrl, layerParams) {
  const lowercaseLayerParams = Object.keys(layerParams).reduce((acc, key) => {
    acc[key.toLowerCase()] = layerParams[key];
    return acc;
  }, {});

  const layerInfoParams = new URLSearchParams({
    service: "WFS",
    request: "describeFeatureType",
    typename: lowercaseLayerParams.layers ?? "",
  });
  const layerInfoUrl = `${layerUrl}?${layerInfoParams.toString()}`;
  let layerInfoResponse;
  try {
    layerInfoResponse = await fetch(layerInfoUrl);
  } catch (e) {
    throw new Error(
      "Failed to fetch attribute data. Check to make sure layers exist."
    );
  }
  const layerInfoText = await layerInfoResponse.text();
  if (layerInfoText.includes("ows:ExceptionReport")) {
    throw new Error(
      "Failed to fetch attribute data. Check to make sure WFS extension is enabled on layers or that layer names are correct."
    );
  }
  const layerInfoJSON = convertXML(layerInfoText);
  const layerAttributes = {};

  const allLayersInfo = layerInfoJSON["xsd:schema"].children.filter((obj) =>
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
    layerAttributes[layerName] = attributes;
  }

  return layerAttributes;
}

async function getGeoJSONLayerAttributes(layerGeoJSON, layerName) {
  const layerAttributes = {};
  const attributes = [];
  const geoJSON =
    typeof layerGeoJSON === "object" ? layerGeoJSON : JSON.parse(layerGeoJSON);
  const layerFeatures = geoJSON?.features ?? [];
  const propertyKeys = layerFeatures
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
  layerAttributes[layerName] = attributes;

  return layerAttributes;
}
