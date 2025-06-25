export const mockedLandingPageDashboards = {
  user: [
    {
      id: 1,
      uuid: "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
      name: "editable",
      description: "test_description",
      accessGroups: [],
      image: "my_image.png",
    },
  ],
  public: [
    {
      id: 2,
      uuid: "acde070d-8c4c-4f0d-9d8a-162843c10333",
      name: "noneditable",
      description: "test_description2",
      accessGroups: ["public"],
      image: "public_image.png",
    },
  ],
};

export const mockedDashboards = {
  user: [
    {
      id: 1,
      uuid: "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
      name: "editable",
      description: "test_description",
      accessGroups: [],
      unrestrictedPlacement: false,
      image: "my_image.png",
      notes: "test_notes",
      gridItems: [
        {
          i: "1",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "",
          args_string: "{}",
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
      ],
    },
  ],
  public: [
    {
      id: 2,
      uuid: "acde070d-8c4c-4f0d-9d8a-162843c10333",
      name: "noneditable",
      description: "test_description2",
      accessGroups: ["public"],
      image: "public_image.png",
      notes: "test_notes2",
      gridItems: [
        {
          i: "1",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "",
          args_string: "{}",
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
      ],
    },
  ],
};

export const mockedVisualizations = [
  {
    label: "Visualization Group",
    options: [
      {
        source: "plugin_source",
        value: "plugin_value",
        label: "plugin_label",
        args: { plugin_arg: "text" },
        type: "some type",
        tags: ["test", "plugin"],
        description: "some description",
      },
      {
        source: "plugin_source2",
        value: "plugin_value2",
        label: "plugin_label2",
        args: { plugin_arg: "text" },
        type: "some type",
        tags: [],
        description: "",
      },
    ],
  },
  {
    label: "Visualization Group 2",
    options: [
      {
        source: "plugin_source3",
        value: "plugin_value3",
        label: "plugin_label3",
        args: { plugin_arg3: "text" },
        type: "some type",
        tags: [],
        description: "",
      },
    ],
  },
];

export const mockedVisualizationArgs = [
  {
    argOptions: "text",
    label: "Visualization Group: plugin_label - plugin_arg",
    value: "Visualization Group: plugin_label - plugin_arg",
  },
  {
    argOptions: "text",
    label: "Visualization Group: plugin_label2 - plugin_arg",
    value: "Visualization Group: plugin_label2 - plugin_arg",
  },
  {
    argOptions: "text",
    label: "Visualization Group 2: plugin_label3 - plugin_arg3",
    value: "Visualization Group 2: plugin_label3 - plugin_arg3",
  },
];

export const mockedVisualizationsWithDefaults = [
  {
    label: "Visualization Group",
    options: [
      {
        source: "plugin_source",
        value: "plugin_value",
        label: "plugin_label",
        type: "image",
        args: { plugin_arg: "text" },
        tags: ["test", "plugin"],
        description: "some description",
      },
      {
        source: "plugin_source2",
        value: "plugin_value2",
        label: "plugin_label2",
        type: "plotly",
        args: { plugin_arg: "text" },
        tags: [],
        description: "",
      },
    ],
  },
  {
    label: "Visualization Group 2",
    options: [
      {
        source: "plugin_source3",
        value: "plugin_value3",
        label: "plugin_label3",
        type: "plotly",
        args: { plugin_arg3: "text" },
        tags: [],
        description: "",
      },
    ],
  },
  {
    label: "Default",
    options: [
      {
        source: "Custom Image",
        value: "Custom Image",
        label: "Custom Image",
        type: "image",
        args: { image_source: "text" },
        tags: ["image", "default", "custom"],
        description:
          "Any publicly available image using the corresponding URL.",
      },
      {
        source: "Map",
        value: "Map",
        label: "Map",
        type: "map",
        args: {
          baseMap: [
            {
              label: "ArcGIS Map Service Base Maps",
              options: [
                {
                  label: "World Light Gray Base",
                  value:
                    "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer",
                },
              ],
            },
          ],
          layers: "custom-AddMapLayer",
          layerControl: "checkbox",
        },
        tags: ["map", "default"],
        description:
          "A configurable map that allows users to add a basemap and custom layers from a variety of sources.",
      },
      {
        source: "Text",
        value: "Text",
        label: "Text",
        type: "text",
        args: { text: "text" },
        tags: ["text", "default"],
        description: "A block of formattable text.",
      },
      {
        source: "Variable Input",
        value: "Variable Input",
        label: "Variable Input",
        type: "variableInput",
        args: {
          variable_name: "text",
          variable_options_source: [
            "text",
            "number",
            "checkbox",
            {
              label: "Existing Visualization Inputs",
              options: mockedVisualizationArgs,
            },
          ],
        },
        tags: ["variable", "default", "dynamic"],
        description:
          "An input that acts as a dashboard variable. This variable can be referenced in other visualizations to allow for dynamic updating.",
      },
    ],
  },
];

export const updatedDashboard = {
  id: 1,
  name: "editable",
  label: "test_label_updated",
  notes: "test_notes",
  editable: true,
  accessGroups: [],
  gridItems: [
    {
      id: 1,
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "",
      args_string: "{}",
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ],
};

export const newDashboard = {
  id: 3,
  name: "test3",
  label: "test_label3",
  notes: "test_notes3",
  editable: true,
  accessGroups: [],
  gridItems: [
    {
      id: 1,
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "",
      args_string: "{}",
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ],
};

export const copiedDashboard = {
  id: 1,
  name: "test_copy",
  label: "test_label Copy",
  notes: "test_notes",
  editable: true,
  accessGroups: [],
  gridItems: [
    {
      id: 1,
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "",
      args_string: "{}",
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ],
};

export const mockedApiImageBase = {
  i: "1",
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  source: "plugin_source",
  args_string: JSON.stringify({
    plugin_arg: "CREC1",
  }),
  metadata_string: JSON.stringify({
    refreshRate: 0,
  }),
};

export const mockedPlotBase = {
  i: "1",
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  source: "plugin_source",
  args_string: JSON.stringify({
    plugin_arg: "CREC1",
  }),
  metadata_string: JSON.stringify({
    refreshRate: 0,
  }),
};

export const mockedPlotData = {
  data: [
    {
      type: "scatter",
      x: [1, 2, 3],
      y: [3, 1, 6],
      marker: {
        color: "rgb(16, 32, 77)",
      },
    },
    {
      type: "bar",
      x: [1, 2, 3],
      y: [3, 1, 6],
      name: "bar chart example",
    },
  ],
  layout: {
    title: "simple example",
    xaxis: {
      title: "time",
    },
    annotations: [
      {
        text: "simple annotation",
        x: 0,
        xref: "paper",
        y: 0,
        yref: "paper",
      },
    ],
  },
  config: {
    displayModeBar: true,
  },
};

export const mockedTableBase = {
  i: "1",
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  source: "plugin_source",
  args_string: JSON.stringify({
    plugin_arg: "CREC1",
  }),
  metadata_string: JSON.stringify({
    refreshRate: 0,
  }),
};

export const mockedCustomData = {
  url: "some url",
  scope: "some scope",
  module: "some module",
  props: { prop1: "some prop" },
};

export const mockedTableData = {
  data: [
    {
      " name": "Alice Johnson",
      age: 28,
      occupation: "Engineer",
    },
    {
      " name": "Bob Smith",
      age: 34,
      occupation: "Designer",
    },
    {
      " name": "Charlie Brown",
      age: 22,
      occupation: "Teacher",
    },
  ],
  title: "User Information",
};

export const mockedCardBase = {
  i: "1",
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  source: "plugin_source",
  args_string: JSON.stringify({
    plugin_arg: "CREC1",
  }),
  metadata_string: JSON.stringify({
    refreshRate: 0,
  }),
};

export const mockedCardData = {
  data: [
    {
      color: "#ff0000",
      label: "Total Sales",
      value: "1,500",
      icon: "BiMoney",
    },
    {
      color: "#00ff00",
      label: "New Customers",
      value: "350",
      icon: "BiFace",
    },
    {
      color: "#0000ff",
      label: "Refund Requests",
      value: "5",
      icon: "BiArrowFromRight",
    },
  ],
  title: "Company Statistics",
};

export const mockedMapBase = {
  i: "1",
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  source: "Map",
  args_string: JSON.stringify({
    baseMap:
      "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer",
    layers: [
      {
        configuration: {
          type: "ImageLayer",
          props: {
            name: "NWC",
            source: {
              type: "ESRI Image and Map Service",
              props: {
                url: "some_url",
              },
            },
          },
        },
        attributeVariables: {
          NWC: {
            nws_lid: "LID",
          },
        },
        omittedPopupAttributes: {
          NWC: ["nws_lid"],
        },
        legend: {
          title: "Some Title",
          items: [{ label: "Some label", color: "green", symbol: "square" }],
        },
      },
    ],
    layerControl: true,
    viewConfig: {
      center: [-9974138.670265444, 4049495.619645755],
      zoom: 7.253038543654934,
    },
  }),
  metadata_string: JSON.stringify({
    refreshRate: 0,
  }),
};

export const mockedMapData = {
  mapConfig: {
    className: "ol-map",
    style: {
      width: "100%",
      height: "100vh",
    },
  },
  viewConfig: {
    center: [-110.875, 37.345],
    zoom: 5,
  },
  layers: [
    {
      type: "WebGLTile",
      props: {
        source: {
          type: "Image Tile",
          props: {
            url: "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
            attributions:
              'Tiles © <a href="https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer">ArcGIS</a>',
          },
        },
        name: "World Dark Gray Base Base Map",
        zIndex: 0,
      },
    },
    {
      type: "ImageLayer",
      props: {
        source: {
          type: "ESRI Image and Map Service",
          props: {
            url: "https://mapservices.weather.noaa.gov/eventdriven/rest/services/water/riv_gauges/MapServer",
            params: {
              LAYERS: "show:0",
            },
          },
        },
        name: "Flooding River Gauges",
        zIndex: 1,
      },
    },
    {
      type: "VectorLayer",
      props: {
        source: {
          type: "Vector",
          props: {
            url: "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Parks_and_Open_Space/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&f=geojson",
            format: {
              type: "GeoJSON",
              props: {},
            },
          },
        },
        name: "rfc max forecast (Decreasing Forecast Trend)",
        zIndex: 2,
      },
      style: {
        type: "Style",
        props: {
          stroke: {
            type: "Stroke",
            props: {
              color: "#501020",
              width: 1,
            },
          },
        },
      },
    },
  ],
  legend: [
    {
      label: "Major Flood",
      color: "#cc33ff",
    },
    {
      label: "Moderate Flood",
      color: "#ff0000",
    },
    {
      label: "Minor Flood",
      color: "#ff9900",
    },
    {
      label: "Action",
      color: "#ffff00",
    },
    {
      label: "No Flood",
      color: "#00ff00",
    },
    {
      label: "Flood Category Not Defined",
      color: "#72afe9",
    },
    {
      label: "Low Water Threshold",
      color: "#906320",
    },
    {
      label: "Data Not Current",
      color: "#bdc2bb",
    },
    {
      label: "Out of Service",
      color: "#666666",
    },
  ],
};

export const mockedUnknownBase = {
  i: "1",
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  source: "unknown_api",
  args_string: "{}",
  metadata_string: JSON.stringify({
    refreshRate: 0,
  }),
};

export const mockedCustomImageBase = {
  i: "1",
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  source: "Custom Image",
  args_string: JSON.stringify({
    image_source: "https://www.aquaveo.com/images/aquaveo_logo.svg",
  }),
  metadata_string: JSON.stringify({
    refreshRate: 0,
  }),
};

export const mockedTextBase = {
  i: "1",
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  source: "Text",
  args_string: JSON.stringify({
    text: "Custom Text",
  }),
  metadata_string: JSON.stringify({
    refreshRate: 0,
  }),
};

export const mockedTextVariable = {
  i: "1",
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  source: "Variable Input",
  args_string: JSON.stringify({
    initial_value: "",
    variable_name: "Test Variable",
    variable_options_source: "text", // TODO Change this to be an empty string or null
    variable_input_type: "text",
  }),
  metadata_string: JSON.stringify({
    refreshRate: 0,
  }),
};

export const mockedNumberVariable = {
  i: "1",
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  source: "Variable Input",
  args_string: JSON.stringify({
    initial_value: 0,
    variable_name: "Test Variable",
    variable_options_source: "number", // TODO Change this to be an empty string or null
    variable_input_type: "number",
  }),
  metadata_string: JSON.stringify({
    refreshRate: 0,
  }),
};

export const mockedCheckboxVariable = {
  i: "1",
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  source: "Variable Input",
  args_string: JSON.stringify({
    initial_value: true,
    variable_name: "Test Variable",
    variable_options_source: "checkbox", // TODO Change this to be an empty string or null
    variable_input_type: "number",
  }),
  metadata_string: JSON.stringify({
    refreshRate: 0,
  }),
};

export const mockedNullCheckboxVariable = {
  i: "1",
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  source: "Variable Input",
  args_string: JSON.stringify({
    initial_value: null,
    variable_name: "Test Variable",
    variable_options_source: "checkbox", // TODO Change this to be an empty string or null
    variable_input_type: "number",
  }),
  metadata_string: JSON.stringify({
    refreshRate: 0,
  }),
};

export const mockedDropdownVariable = {
  i: "1",
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  source: "Variable Input",
  args_string: JSON.stringify({
    initial_value: "CREC1",
    variable_name: "Test Variable",
    variable_options_source:
      "Some Visualization Group Name: Some Visualization Name - Some Visualization Arg",
    variable_input_type: "dropdown",
  }),
  metadata_string: JSON.stringify({
    refreshRate: 0,
  }),
};

export const mockedDropdownVisualization = [
  {
    label: "Some Visualization Group Name",
    options: [
      {
        source: "plugin_source",
        value: "plugin_value",
        label: "Some Visualization Name",
        args: {
          some_visualization_arg: [
            {
              label: "North Coast",
              options: [
                {
                  label:
                    "CREC1 - SMITH RIVER - JEDEDIAH SMITH SP NEAR CRESCENT CITY",
                  value: "CREC1",
                },
                {
                  label: "FTDC1 - SMITH RIVER - DOCTOR FINE BRIDGE",
                  value: "FTDC1",
                },
                {
                  label: "ORIC1 - REDWOOD CREEK - ORICK",
                  value: "ORIC1",
                },
              ],
            },
          ],
        },
        type: "some type",
        tags: [],
        description: "",
      },
    ],
  },
];

export const legendItems = {
  title: "Some Title",
  items: [
    {
      label: "square",
      color: "#4935d0",
      symbol: "square",
    },
    {
      label: "circle",
      color: "#4935d0",
      symbol: "circle",
    },
    {
      label: "upTriangle",
      color: "#4935d0",
      symbol: "upTriangle",
    },
    {
      label: "rightTriangle",
      color: "#4935d0",
      symbol: "rightTriangle",
    },
    {
      label: "downTriangle",
      color: "#4935d0",
      symbol: "downTriangle",
    },
    {
      label: "leftTriangle",
      color: "#4935d0",
      symbol: "leftTriangle",
    },
    {
      label: "rectangle",
      color: "#4935d0",
      symbol: "rectangle",
    },
    {
      label: "line",
      color: "#4935d0",
      symbol: "line",
    },
  ],
};

export const mapConfig = {
  className: "test-map",
  style: { width: "100%", height: "100%", position: "relative" },
};

export const viewConfig = {
  center: [-10739800.855969304, 4724173.713444437],
  zoom: 4.715261169570117,
};

export const layerConfig = {
  configuration: {
    type: "ImageLayer",
    props: {
      name: "Some Layer",
      source: {
        type: "ESRI Image and Map Service",
        props: {
          url: "Some Url",
        },
      },
    },
  },
};

export const layerAttributeVariables = {
  "Some Layer": {
    "attribute 1": "variable 1",
  },
};

export const layerOmittedPopupAttributes = {
  "Some Layer": ["attribute 2"],
};

export const layerConfigArcGISFeatureService = {
  configuration: {
    type: "VectorLayer",
    props: {
      name: "Some ArcGISFeatureService Layer",
      source: {
        type: "ESRI Feature Service",
        props: {
          url: "Some Url",
          layer: 0,
        },
      },
    },
  },
};

export const layerConfigGeoJSON = {
  configuration: {
    type: "VectorLayer",
    props: {
      name: "GeoJSON Layer",
      opacity: ".5",
      source: {
        type: "GeoJSON",
        props: {},
        geojson: {
          type: "FeatureCollection",
          crs: {
            type: "name",
            properties: {
              name: "EPSG:3857",
            },
          },
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [0, 0],
              },
              properties: { "Some Field": "Some Value" },
            },
          ],
        },
      },
      zIndex: 1,
    },
  },
};

export const layerConfigImageArcGISRest = {
  configuration: {
    type: "ImageLayer",
    props: {
      name: "ImageArcGISRest Layer",
      source: {
        type: "ESRI Image and Map Service",
        props: {
          url: "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",
        },
      },
      zIndex: 1,
    },
  },
};

export const layerConfigImageWMS = {
  configuration: {
    type: "ImageLayer",
    props: {
      name: "WMS",
      source: {
        type: "WMS",
        props: {
          url: "https://ahocevar.com/geoserver/wms",
          params: { LAYERS: "topp:states" },
        },
      },
      zIndex: 1,
    },
  },
};

export const layerConfigVectorTile = {
  configuration: {
    type: "VectorTileLayer",
    props: {
      source: {
        type: "Vector Tile",
        props: {
          urls: [
            "https://ahocevar.com/geoserver/gwc/service/tms/1.0.0/ne:ne_10m_admin_0_countries@EPSG%3A900913@pbf/{z}/{x}/{-y}.pbf",
          ],
          someProp: [{ randomProp: "someValue" }],
          someOtherProp: { randomProp: "someValue" },
        },
      },
      name: "Vector Tile Layer",
      zIndex: 0,
    },
  },
};

export const layerConfigWebGLTile = {
  configuration: {
    type: "WebGLTile",
    props: {
      source: {
        type: "Image Tile",
        props: {
          url: "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        },
      },
      name: "World Light Gray Base",
      zIndex: 0,
    },
  },
};

export const exampleStyle = {
  version: 8,
  sprite:
    "https://cdn.arcgis.com/sharing/rest/content/items/005b8960ddd04ae781df8d471b6726b3/resources/styles/../sprites/sprite",
  glyphs:
    "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/resources/fonts/{fontstack}/{range}.pbf",
  sources: {
    esri: {
      type: "vector",
      url: "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer",
      tiles: [
        "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile/{z}/{y}/{x}.pbf",
      ],
    },
  },
  layers: [
    {
      id: "Land/Ice",
      type: "fill",
      source: "esri",
      "source-layer": "Land",
      filter: ["==", "_symbol", 1],
      layout: {},
      paint: {
        "fill-opacity": 0.8,
        "fill-color": "#feffff",
      },
    },
  ],
};

export const fullMapLayer = {
  configuration: {
    type: "ImageLayer",
    layerVisibility: false,
    props: {
      name: "NWC",
      source: {
        type: "ESRI Image and Map Service",
        props: {
          url: "some_url",
        },
      },
    },
    style: {
      type: "Style",
      props: {
        stroke: {
          type: "Stroke",
          props: {
            color: "#501020",
            width: 1,
          },
        },
      },
    },
  },
  queryable: true,
  attributeAliases: {
    NWC: {
      nws_lid: "LID",
    },
  },
  attributeVariables: {
    NWC: {
      nws_lid: "LID",
    },
  },
  omittedPopupAttributes: {
    NWC: ["nws_lid"],
  },
  legend: {
    title: "Some Title",
    items: [{ label: "Some label", color: "green", symbol: "square" }],
  },
};
