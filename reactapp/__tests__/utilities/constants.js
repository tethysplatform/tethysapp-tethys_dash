export const mockedDashboards = {
  test: {
    id: 1,
    name: "test_dashboard",
    label: "test_label",
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
        metadata_string: "{}",
      },
    ],
  },
  test2: {
    id: 2,
    name: "test_dashboard2",
    label: "test_label2",
    notes: "test_notes2",
    editable: false,
    access_groups: ["public"],
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
        metadata_string: "{}",
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
    ],
  },
];
