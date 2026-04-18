/**
 * Dashboard fixture builders for Playwright E2E tests.
 *
 * Each function returns a grid item object ready for createDashboard().
 * The shapes match what the MCP tools produce (validated by Layer 1 contract tests).
 */

// ---------------------------------------------------------------------------
// Inline visualization types (inlineData path)
// ---------------------------------------------------------------------------

function plotlyChartItem(data, opts = {}) {
  return {
    source: "Inline Plotly",
    args: {
      vizType: "plotly",
      inlineData: {
        data: data || [{ x: [1, 2, 3], y: [4, 5, 6], type: "scatter" }],
        layout: opts.layout || { title: opts.title || "Test Chart" },
        config: opts.config || { responsive: true, displaylogo: false },
      },
    },
    w: opts.w || 50,
    h: opts.h || 40,
  };
}

function dataTableItem(data, opts = {}) {
  return {
    source: "Inline Table",
    args: {
      vizType: "table",
      inlineData: {
        data: data || [
          { name: "Alice", value: 10 },
          { name: "Bob", value: 20 },
        ],
        title: opts.title || "Test Table",
        subtitle: opts.subtitle || "",
      },
    },
    w: opts.w || 50,
    h: opts.h || 35,
  };
}

function cardItem(title, opts = {}) {
  return {
    source: "Inline Card",
    args: {
      vizType: "card",
      inlineData: {
        title: title || "Test Card",
        description: opts.description || "",
        data: opts.data || null,
      },
    },
    w: opts.w || 25,
    h: opts.h || 15,
  };
}

// ---------------------------------------------------------------------------
// Flat-args visualization types (source-specific short-circuit path)
// ---------------------------------------------------------------------------

function textItem(text, opts = {}) {
  return {
    source: "Text",
    args: { text: text || "Hello World" },
    w: opts.w || 50,
    h: opts.h || 15,
  };
}

function customImageItem(imageUrl, opts = {}) {
  return {
    source: "Custom Image",
    args: { image_source: imageUrl || "https://via.placeholder.com/300" },
    w: opts.w || 50,
    h: opts.h || 30,
  };
}

// Base map URL shorthand → ArcGIS MapServer URL (matches MCP server's BASE_MAPS)
const BASE_MAP_URLS = {
  streets: "https://server.arcgisonline.com/arcgis/rest/services/World_Street_Map/MapServer",
  imagery: "https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer",
  topo: "https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer",
  light_gray:
    "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer",
  dark_gray:
    "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer",
  terrain:
    "https://server.arcgisonline.com/arcgis/rest/services/World_Terrain_Base/MapServer",
  ocean:
    "https://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer",
};

function mapItem(opts = {}) {
  const baseMapInput = opts.baseMap || "streets";
  const baseMap = BASE_MAP_URLS[baseMapInput] || baseMapInput;
  return {
    source: "Map",
    args: {
      baseMap,
      layers: opts.layers || [],
      zoom: opts.zoom || 4,
      layerControl: opts.layerControl || false,
      ...(opts.mapExtent ? { map_extent: opts.mapExtent } : {}),
    },
    w: opts.w || 50,
    h: opts.h || 45,
  };
}

// ---------------------------------------------------------------------------
// Variable inputs (hybrid: flat args + vizType)
// ---------------------------------------------------------------------------

function variableInputItem(name, type, opts = {}) {
  const args = {
    variable_name: name,
    initial_value: opts.initialValue || "",
  };

  if (type === "dropdown" && opts.options) {
    args.variable_options_source = opts.options;
  } else if (type === "slider") {
    args.variable_options_source = "slider";
    args["variable_options_source.metadata"] = {
      min: opts.min ?? 0,
      max: opts.max ?? 100,
      step: opts.step ?? 1,
      dataType: "Number",
      initialValue: opts.initialValue ?? opts.min ?? 0,
      outputFormat: "{{n}}",
    };
  } else {
    args.variable_options_source = type;
  }

  return {
    source: "Variable Input",
    args: { ...args, vizType: "variableInput" },
    w: opts.w || 25,
    h: opts.h || 12,
  };
}

// ---------------------------------------------------------------------------
// Map layer builders (for use inside mapItem's layers array)
// ---------------------------------------------------------------------------

function wmsLayer(url, layers, opts = {}) {
  return {
    configuration: {
      type: "ImageLayer",
      props: {
        name: opts.name || "WMS Layer",
        source: {
          type: "WMS",
          props: {
            url,
            params: { LAYERS: layers, ...(opts.params || {}) },
          },
        },
      },
    },
    queryable: opts.queryable || false,
  };
}

function esriImageLayer(url, opts = {}) {
  return {
    configuration: {
      type: "ImageLayer",
      props: {
        name: opts.name || "ESRI Layer",
        source: {
          type: "ESRI Image and Map Service",
          props: {
            url,
            params: {
              ...(opts.layerId ? { LAYERS: opts.layerId } : {}),
              ...(opts.params || {}),
            },
          },
        },
      },
    },
    queryable: opts.queryable || false,
  };
}

function geojsonLayer(geojsonData, opts = {}) {
  return {
    configuration: {
      type: "VectorLayer",
      props: {
        name: opts.name || "GeoJSON Layer",
        source: {
          type: "GeoJSON",
          props: {},
          geojson: geojsonData,
        },
      },
    },
    queryable: opts.queryable || false,
  };
}

module.exports = {
  plotlyChartItem,
  dataTableItem,
  cardItem,
  textItem,
  customImageItem,
  mapItem,
  variableInputItem,
  wmsLayer,
  esriImageLayer,
  geojsonLayer,
};
