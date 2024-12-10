export const mockedDashboards = {
  editable: {
    id: 1,
    name: "editable",
    label: "test_label",
    notes: "test_notes",
    editable: true,
    accessGroups: [],
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
  noneditable: {
    id: 2,
    name: "noneditable",
    label: "test_label2",
    notes: "test_notes2",
    editable: false,
    accessGroups: ["public"],
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
      },
      {
        source: "plugin_source2",
        value: "plugin_value2",
        label: "plugin_label2",
        args: { plugin_arg: "text" },
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
        args: { plugin_arg: "text" },
      },
      {
        source: "plugin_source2",
        value: "plugin_value2",
        label: "plugin_label2",
        args: { plugin_arg: "text" },
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
      },
    ],
  },
  {
    label: "Other",
    options: [
      {
        source: "Custom Image",
        value: "Custom Image",
        label: "Custom Image",
        args: { image_source: "text" },
      },
      {
        source: "Text",
        value: "Text",
        label: "Text",
        args: { text: "text" },
      },
      {
        source: "Variable Input",
        value: "Variable Input",
        label: "Variable Input",
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
  source: "cnrfc_5day_streamflow_volume_exceedance",
  args_string: JSON.stringify({
    gauge_location: "CREC1",
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
  source: "plot_api",
  args_string: "{}",
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
  source: "table_api",
  args_string: "{}",
  metadata_string: JSON.stringify({
    refreshRate: 0,
  }),
};

export const mockedTableData = {
  data: [
    {
      name: "Alice Johnson",
      age: 28,
      occupation: "Engineer",
    },
    {
      name: "Bob Smith",
      age: 34,
      occupation: "Designer",
    },
    {
      name: "Charlie Brown",
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
  source: "card_api",
  args_string: "{}",
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
  source: "map_api",
  args_string: "{}",
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
          type: "ImageTile",
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
          type: "ImageArcGISRest",
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
        name: "rfc max forecast (Decreasing Forecast Trend)",
        zIndex: 2,
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

export const mockedUserSetting = {
  deselected_visualizations: [],
};
