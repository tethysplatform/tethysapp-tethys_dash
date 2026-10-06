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
import { buildPreloadedRequestKey } from "components/visualizations/utilities";

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

// What a tile with these raw args and variable values would take.
const takeFor = (uuid, source, args, variableInputValues = {}) =>
  takePreloadedVisualization(
    uuid,
    buildPreloadedRequestKey({ source, args, variableInputValues }),
  );

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

it("finds nothing in a dashboard that has not loaded yet", () => {
  // Called before the tabs or the plugin registry are in hand, which is the
  // state DashboardLoader is in for its first render.
  expect(collectPluginVariableInputs()).toEqual([]);
  expect(collectPluginVariableInputs(undefined, visualizations)).toEqual([]);
  expect(
    collectPluginVariableInputs([
      { id: 1, gridItems: [gridItem("picker_a", {})] },
    ]),
  ).toEqual([]);
});

it("tolerates a tab with no grid items and an item with no source", () => {
  // A newly added tab holds no grid items until one is dropped on it, and a
  // half-written item can reach this scan without a source.
  const tabs = [
    { id: 1 },
    { id: 2, gridItems: [{ uuid: "no-source" }, gridItem("picker_a", {})] },
  ];
  expect(
    collectPluginVariableInputs(tabs, visualizations).map(
      ({ gridItem }) => gridItem.source,
    ),
  ).toEqual(["picker_a"]);
});

it("publishes nothing for a response with no options source", async () => {
  // VariableInput publishes nothing without one -- it is what decides how the
  // value is read -- so the preload must not either, or the dashboard would
  // start with a value its own tile then disagrees with.
  mockPlugins({
    picker_a: {
      success: true,
      viz_type: "variable_input",
      data: { variable_name: "A", initial_value: "a" },
    },
    picker_b: viResponse({ variable_name: "B", initial_value: "b" }),
  });

  const result = await preloadPluginVariableInputs({
    tabs: [
      {
        id: 1,
        gridItems: [gridItem("picker_a", {}), gridItem("picker_b", {})],
      },
    ],
    visualizations,
  });

  expect(result.values).toEqual({ B: "b" });
  expect(result.owners).not.toHaveProperty("picker_a");
});

it("skips a grid item whose args do not parse", () => {
  // Hand-authored and script-generated dashboards reach this scan too, so a
  // malformed args_string is expected traffic. The item is left out and the
  // rest of the dashboard still preloads; its own tile reports the problem.
  const tabs = [
    {
      id: 1,
      gridItems: [
        { source: "picker_a", uuid: "bad", args_string: "{oops" },
        gridItem("picker_b", {}),
      ],
    },
  ];
  expect(
    collectPluginVariableInputs(tabs, visualizations).map(
      ({ gridItem }) => gridItem.source,
    ),
  ).toEqual(["picker_b"]);
});

it("leaves a response the substituter cannot process to its tile", async () => {
  // getVisualization substitutes variable inputs into a tile's response before
  // VariableInput sees it, and that pass copies the response through JSON. What
  // it cannot copy it cannot substitute into -- and neither could the tile's
  // own pass, so the item is left for the tile to report rather than failing
  // the preload. A self-referencing object stands in for whatever the
  // substituter chokes on; the point is that the dashboard still loads.
  const circular = { variable_name: "A", variable_options_source: "text" };
  circular.self = circular;
  mockPlugins({
    picker_a: { success: true, viz_type: "variable_input", data: circular },
    picker_b: viResponse({ variable_name: "B", initial_value: "b" }),
  });

  const result = await preloadPluginVariableInputs({
    tabs: [
      {
        id: 1,
        gridItems: [gridItem("picker_a", {}), gridItem("picker_b", {})],
      },
    ],
    visualizations,
  });

  expect(result.values).toEqual({ B: "b" });
  expect(result.owners).not.toHaveProperty("picker_a");
});

it("does nothing when the dashboard has no plugin variable inputs", async () => {
  const spy = jest.spyOn(appAPI, "getVisualizationData");
  const onProgress = jest.fn();
  const result = await preloadPluginVariableInputs({
    tabs: [{ id: 1, gridItems: [gridItem("plot", {})] }],
    visualizations,
    onProgress,
  });
  expect(result).toEqual({ values: {}, dateFormats: {}, owners: {} });
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
  // Each grid item's request is waiting for its tile, keyed by the raw args
  // and the variable values it was built from.
  const entry = takeFor(
    "picker_b",
    "picker_b",
    { station: "${Region}" },
    { Region: "west" },
  );
  expect(entry.settled).toBe(true);
  await expect(entry.promise).resolves.toEqual(
    viResponse({ variable_name: "Station", initial_value: "west-1" }),
  );
  // And it reports which keys each grid item published.
  expect(result.owners).toEqual({
    picker_a: { variableName: "Region", keys: ["Region"] },
    picker_b: { variableName: "Station", keys: ["Station"] },
  });
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
  // The tile reports the failure from the same request rather than running
  // the plugin a second time.
  await expect(
    takeFor("picker_a", "picker_a", { region: "x" }).promise,
  ).resolves.toEqual({ success: false, data: { error: "boom" } });
});

it("throws from a helper rather than swallowing it, for the loader to catch", async () => {
  jest.spyOn(appAPI, "getVisualizationData");
  await expect(
    preloadPluginVariableInputs({
      tabs: [{ id: 1, gridItems: [gridItem("picker_a", {})] }],
      // A malformed registry entry makes collectPluginVariableInputs throw.
      visualizations: [null],
    }),
  ).rejects.toThrow();
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

  // ...the hanging plugin's request is left for its tile, still pending...
  const entry = takeFor("picker_b", "picker_b", { station: "y" });
  expect(entry.settled).toBe(false);

  // ...and its late answer adds no values, but reaches the tile.
  resolveSlow(viResponse({ variable_name: "B", initial_value: "late" }));
  await flushMicrotasks();
  expect(result.values).toEqual({ A: "a" });
  expect(onProgress).toHaveBeenLastCalledWith({ completed: 1, total: 2 });
  await expect(entry.promise).resolves.toEqual(
    viResponse({ variable_name: "B", initial_value: "late" }),
  );
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
  expect(result.owners).toEqual({});
});
