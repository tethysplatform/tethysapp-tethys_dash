export const mockedDashboards = {
  editable: {
    id: 1,
    name: "editable",
    label: "test_label",
    notes: "test_notes",
    editable: true,
    access_groups: [],
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
    access_groups: ["public"],
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
        args: { plugin_arg1: "text" },
      },
      {
        source: "plugin_source2",
        value: "plugin_value2",
        label: "plugin_label2",
        args: { plugin_arg2: "text" },
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

export const updatedDashboard = {
  id: 1,
  name: "editable",
  label: "test_label_updated",
  notes: "test_notes",
  editable: true,
  access_groups: [],
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
  access_groups: [],
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
  access_groups: [],
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
