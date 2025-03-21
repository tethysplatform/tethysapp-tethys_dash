import PropTypes from "prop-types";
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
  // check to see if the coords values are an array (nested coords) or a number
  if (Array.isArray(coords[0])) {
    // run function again to transform nested values
    return coords.map((coord) =>
      transformCoordinates(coord, sourceProj, destProj)
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

  // make the appropriate request based on the source type
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
  // setup fetch request with params
  const featureQueryUrl = sourceUrl + "/identify";
  const params = new URLSearchParams({
    f: "json",
    tolerance: 10, // Pixel tolerance
    returnGeometry: true,
    geometryType: "esriGeometryPoint",
    sr: map.getView().getProjection().getCode(),
    geometry: coordinate.join(","),
    mapExtent: map.getView().calculateExtent().join(","),
    returnFieldName: true,
    imageDisplay: map
      .getSize()
      .concat(map.getView().getResolution())
      .join(", "),
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
        mapSRS
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

async function getGeoJSONLayerFeatures(map, pixel, coordinate) {
  const features = [];

  // loop through the feature layers that are found at the clicked pixel
  map.forEachFeatureAtPixel(pixel, function (feature, layer) {
    // dont get any features that are highlights or markers
    if (
      layer.get("name") === "ClickHighlighterLayer" ||
      layer.get("name") === "ClickMarkerLayer"
    ) {
      return;
    }

    if (feature) {
      let clickedGeometries = [];
      const { geometry, ...properties } = feature.getProperties();

      // if a feature is a collection of geometries, then check each individual item in the collection and check if it was clicked
      if (geometry.getType() === "GeometryCollection") {
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
                  Math.pow(closestPoint[1] - coordinate[1], 2)
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

export async function getLayerAttributes(sourceProps, layerName) {
  // setup constants
  let attributes;
  const sourceProperties = sourceProps.props;
  const sourceType = sourceProps.type;
  const sourceParams = sourceProperties?.params ?? {};
  const sourceUrl = sourceProperties?.url ?? "";
  const sourceGeoJSON = sourceProps?.geojson ?? {};

  // make the appropriate request based on the source type
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
  // setup fetch request with params
  const sourceURLParams = new URLSearchParams({
    f: "json",
  });
  const sourceInfoUrl = `${sourceUrl}?${sourceURLParams.toString()}`;

  // Fetch data and parse json
  const sourceInfoResponse = await fetch(sourceInfoUrl);
  const sourceInfoJSON = await sourceInfoResponse.json();

  // setup constants, get an array of layer names
  const sourceAttributes = {};
  const layers = sourceInfoJSON.layers.map((layer) => layer.name);

  // for each layer, make a new request to get layer specific attributes
  for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
    let layerName = layers[layerIndex];

    // Fetch data and parse json
    let specificLayerInfoUrl = `${sourceUrl}/${layerIndex}?${sourceURLParams.toString()}`;
    let specificLayerInfoResponse = await fetch(specificLayerInfoUrl);
    let specificLayerInfoJson = await specificLayerInfoResponse.json();

    // loop through layer fields and append to sourceAttributes object
    let specificLayerFieds = [];
    for (const field of specificLayerInfoJson.fields) {
      specificLayerFieds.push({ name: field.name, alias: field.alias });
    }
    sourceAttributes[layerName] = specificLayerFieds;
  }

  return sourceAttributes;
}

async function getImageWMSLayerAttributes(sourceUrl, sourceParams) {
  // make all source params lowercase just to make sure there are no issues grabbing keys with capitalization
  const lowercaseLayerParams = Object.keys(sourceParams).reduce((acc, key) => {
    acc[key.toLowerCase()] = sourceParams[key];
    return acc;
  }, {});

  // setup fetch request with params
  const sourceURLParams = new URLSearchParams({
    service: "WFS",
    request: "describeFeatureType",
    typename: lowercaseLayerParams.layers,
  });
  const sourceInfoUrl = `${sourceUrl}?${sourceURLParams.toString()}`;

  // try to get WFS info
  let sourceInfoResponse;
  try {
    sourceInfoResponse = await fetch(sourceInfoUrl);
  } catch (e) {
    throw new Error(
      "Failed to fetch attribute data. Check to make sure layers exist."
    );
  }

  // convert response to text and check for errors
  const sourceInfoText = await sourceInfoResponse.text();
  if (sourceInfoText.includes("ExceptionReport")) {
    throw new Error(
      "Failed to fetch attribute data. Check to make sure WFS extension is enabled on layers or that layer names are correct."
    );
  }

  // convert xml to json for easier navigation
  const sourceInfoJSON = convertXML(sourceInfoText);
  const sourceAttributes = {};

  // loop through data and parse fields
  const allLayersInfo = sourceInfoJSON["xsd:schema"].children.filter((obj) =>
    Reflect.has(obj, "xsd:complexType")
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
  // setup constants
  const sourceAttributes = {};
  const attributes = [];

  // get the geojson features
  const geoJSON =
    typeof sourceGeoJSON === "object"
      ? sourceGeoJSON
      : JSON.parse(sourceGeoJSON);
  const sourceFeatures = geoJSON?.features ?? [];

  // for each feature, get an array of all the available properties/fields and then flatten into a single array
  const propertyKeys = sourceFeatures
    .map((feature) =>
      feature.properties ? Object.keys(feature.properties) : []
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

// layer attribute variable for the layer, structure is {layerName: {"field1": "Variable Name 1"}}
export const attributeVariablesPropType = PropTypes.objectOf(
  PropTypes.objectOf(PropTypes.string)
);

// layer attributes to be omitted in the popups, structure is {layerName: ["field1", "field2"]}
export const omittedPopupAttributesPropType = PropTypes.objectOf(
  PropTypes.arrayOf(PropTypes.string)
);

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

export const legendPropType = PropTypes.shape({
  title: PropTypes.string, // title for the layer in the map legend
  // an array of legend items to show in the map legend
  items: PropTypes.arrayOf(legendItemPropType),
});

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
