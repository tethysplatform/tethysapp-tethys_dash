/* eslint-disable no-template-curly-in-string */
// Grid-item args reference variable inputs with literal `${...}` strings.
import appAPI from "services/api/app";
import {
  collectPluginVariableInputs,
  preloadPluginVariableInputs,
  VARIABLE_INPUT_PRELOAD_BUDGET_MS,
} from "components/loader/variableInputPreload";
import {
  clearPreloadedVisualizations,
  takePreloadedVisualization,
} from "components/visualizations/preloadedVisualizationCache";

const visualizations = [
  {
    label: "Plugins",
    options: [
      { source: "picker_a", type: "variable_input", args: { region: "text" } },
      { source: "picker_b", type: "variable_input", args: { station: "text" } },
      { source: "picker_c", type: "variable_input", args: { other: "text" } },
      { source: "plot", type: "plotly", args: { station: "text" } },
    ],
  },
  {
    label: "Default",
    options: [{ source: "Variable Input", type: "variableInput", args: {} }],
  },
];

const gridItem = (source, args, uuid = source) => ({
  source,
  uuid,
  args_string: JSON.stringify(args),
  metadata_string: "{}",
});

const viResponse = (data) => ({
  success: true,
  viz_type: "variable_input",
  data: { variable_options_source: "text", ...data },
});

// Answers each source with the given response (or a function of the request).
const mockPlugins = (responses) =>
  jest.spyOn(appAPI, "getVisualizationData").mockImplementation((itemData) => {
    const response = responses[itemData.source];
    return Promise.resolve(
      typeof response === "function" ? response(itemData) : response,
    );
  });

const flushMicrotasks = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

afterEach(() => {
  clearPreloadedVisualizations();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("has a five second budget", () => {
  expect(VARIABLE_INPUT_PRELOAD_BUDGET_MS).toBe(5000);
});

it("collects only plugin variable inputs from every tab", () => {
  const tabs = [
    {
      id: 1,
      gridItems: [
        gridItem("picker_a", {}),
        gridItem("plot", {}),
        gridItem("Variable Input", { variable_name: "Built In" }),
      ],
    },
    { id: 2, gridItems: [gridItem("picker_b", {})] },
  ];
  expect(
    collectPluginVariableInputs(tabs, visualizations).map(
      ({ gridItem }) => gridItem.source,
    ),
  ).toEqual(["picker_a", "picker_b"]);
});

it("does nothing when the dashboard has no plugin variable inputs", async () => {
  const spy = jest.spyOn(appAPI, "getVisualizationData");
  const onProgress = jest.fn();
  const result = await preloadPluginVariableInputs({
    tabs: [{ id: 1, gridItems: [gridItem("plot", {})] }],
    visualizations,
    onProgress,
  });
  expect(result).toEqual({ values: {}, dateFormats: {} });
  expect(spy).not.toHaveBeenCalled();
  expect(onProgress).not.toHaveBeenCalled();
});

it("loads a chain in waves, resolving each wave's args from the last", async () => {
  const spy = mockPlugins({
    picker_a: viResponse({ variable_name: "Region", initial_value: "west" }),
    picker_b: (itemData) =>
      viResponse({
        variable_name: "Station",
        initial_value: `${itemData.args.station}-1`,
      }),
  });
  const onProgress = jest.fn();

  const result = await preloadPluginVariableInputs({
    tabs: [
      {
        id: 1,
        gridItems: [
          // B depends on A, and is listed first to prove order comes from the
          // dependency, not the layout.
          gridItem("picker_b", { station: "${Region}" }),
          gridItem("picker_a", { region: "${Basin}" }),
        ],
      },
    ],
    visualizations,
    variableInputValues: { Basin: "willamette" },
    onProgress,
  });

  expect(spy.mock.calls.map(([itemData]) => itemData)).toEqual([
    {
      source: "picker_a",
      args: { region: "willamette" },
      requestId: "picker_a",
    },
    { source: "picker_b", args: { station: "west" }, requestId: "picker_b" },
  ]);
  expect(result.values).toEqual({ Region: "west", Station: "west-1" });
  expect(onProgress.mock.calls.map(([progress]) => progress)).toEqual([
    { completed: 0, total: 2 },
    { completed: 1, total: 2 },
    { completed: 2, total: 2 },
  ]);
  // Both responses are waiting for their tiles, under the args they ran with.
  expect(
    takePreloadedVisualization({
      source: "picker_b",
      args: { station: "west" },
    }),
  ).toEqual(viResponse({ variable_name: "Station", initial_value: "west-1" }));
});

it("skips cyclic and unresolvable plugin variable inputs", async () => {
  const spy = mockPlugins({
    picker_a: viResponse({ variable_name: "A", initial_value: "a" }),
    picker_b: viResponse({ variable_name: "B", initial_value: "b" }),
    picker_c: viResponse({ variable_name: "C", initial_value: "c" }),
  });

  const result = await preloadPluginVariableInputs({
    tabs: [
      {
        id: 1,
        gridItems: [
          gridItem("picker_a", { region: "${B}" }),
          gridItem("picker_b", { station: "${A}" }),
          gridItem("picker_c", { other: "${Nothing Sets This}" }),
        ],
      },
    ],
    visualizations,
  });

  expect(spy).not.toHaveBeenCalled();
  expect(result.values).toEqual({});
});

it("leaves a failing plugin to its tile and keeps going", async () => {
  // One plugin reports a failure and another throws.
  mockPlugins({
    picker_a: { success: false, data: { error: "boom" } },
    picker_b: viResponse({ variable_name: "B", initial_value: "b" }),
    picker_c: () => {
      throw new Error("network");
    },
  });

  const result = await preloadPluginVariableInputs({
    tabs: [
      {
        id: 1,
        gridItems: [
          gridItem("picker_a", { region: "x" }),
          gridItem("picker_b", { station: "y" }),
          gridItem("picker_c", { other: "z" }),
        ],
      },
    ],
    visualizations,
  });

  expect(result.values).toEqual({ B: "b" });
  expect(
    takePreloadedVisualization({ source: "picker_a", args: { region: "x" } }),
  ).toBe(undefined);
});

it("publishes nothing for an empty initial value, the same as VariableInput", async () => {
  mockPlugins({
    picker_a: viResponse({ variable_name: "A", initial_value: "" }),
  });
  const result = await preloadPluginVariableInputs({
    tabs: [{ id: 1, gridItems: [gridItem("picker_a", {})] }],
    visualizations,
  });
  expect(result.values).toEqual({});
});

it("normalizes values and registers date formats like VariableInput", async () => {
  mockPlugins({
    picker_a: viResponse({
      variable_name: "Threshold",
      initial_value: "0",
      variable_options_source: "number",
    }),
    picker_b: viResponse({
      variable_name: "Window",
      initial_value: { "Start Date": "01/01/2026", "End Date": "01/02/2026" },
      variable_options_source: "date-range",
      metadata: { format: "MM/dd/yyyy" },
    }),
    picker_c: viResponse({
      variable_name: "Flag",
      initial_value: null,
      variable_options_source: "checkbox",
    }),
  });

  const result = await preloadPluginVariableInputs({
    tabs: [
      {
        id: 1,
        gridItems: [
          gridItem("picker_a", {}),
          gridItem("picker_b", {}),
          gridItem("picker_c", {}),
        ],
      },
    ],
    visualizations,
  });

  expect(result.values).toEqual({
    Threshold: 0,
    Window: { "Start Date": "01/01/2026", "End Date": "01/02/2026" },
    "Start Date": "01/01/2026",
    "End Date": "01/02/2026",
    Flag: false,
  });
  expect(result.dateFormats).toEqual({ Window: "MM/dd/yyyy" });
});

it("stops at the budget and ignores what arrives afterwards", async () => {
  jest.useFakeTimers();
  let resolveSlow;
  jest.spyOn(appAPI, "getVisualizationData").mockImplementation(({ source }) =>
    source === "picker_a"
      ? Promise.resolve(viResponse({ variable_name: "A", initial_value: "a" }))
      : new Promise((resolve) => {
          resolveSlow = resolve;
        }),
  );
  const onProgress = jest.fn();

  const preload = preloadPluginVariableInputs({
    tabs: [
      {
        id: 1,
        gridItems: [
          gridItem("picker_a", { region: "x" }),
          gridItem("picker_b", { station: "y" }),
        ],
      },
    ],
    visualizations,
    budgetMs: 1000,
    onProgress,
  });

  // Let the fast plugin's response land, then run out the budget.
  await flushMicrotasks();
  jest.advanceTimersByTime(1000);
  const result = await preload;
  // What arrived inside the budget counts...
  expect(result.values).toEqual({ A: "a" });

  // ...and the hanging plugin's late answer goes nowhere.
  resolveSlow(viResponse({ variable_name: "B", initial_value: "late" }));
  await flushMicrotasks();
  expect(result.values).toEqual({ A: "a" });
  expect(onProgress).toHaveBeenLastCalledWith({ completed: 1, total: 2 });
  expect(
    takePreloadedVisualization({ source: "picker_b", args: { station: "y" } }),
  ).toBe(undefined);
});

it("writes nothing once abandoned", async () => {
  let abandoned = false;
  jest.spyOn(appAPI, "getVisualizationData").mockImplementation(() => {
    abandoned = true;
    return Promise.resolve(
      viResponse({ variable_name: "A", initial_value: "a" }),
    );
  });
  const result = await preloadPluginVariableInputs({
    tabs: [{ id: 1, gridItems: [gridItem("picker_a", {})] }],
    visualizations,
    isAbandoned: () => abandoned,
  });
  expect(result.values).toEqual({});
  expect(takePreloadedVisualization({ source: "picker_a", args: {} })).toBe(
    undefined,
  );
});
