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
      url: "WMS service URL",
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
