import appAPI from "services/api/app";
import {
  findSelectOptionByValue,
  findUnresolvedVariableInputTokens,
  hasVariableInputValue,
  updateObjectWithVariableInputs,
  normalizeVariableInputValue,
  getPublishedVariableInputValues,
  getVariableInputDateFormat,
  buildPreloadedRequestKey,
} from "components/visualizations/utilities";
import { setPreloadedVisualization } from "components/visualizations/preloadedVisualizationCache";

// The longest the dashboard waits, in total, for plugin variable inputs
// before rendering anyway. Whatever has not arrived by then loads the normal
// way, after render, in its own tile.
export const VARIABLE_INPUT_PRELOAD_BUDGET_MS = 5000;

/**
 * Every plugin-sourced variable input among the tabs' grid items: a grid item
 * whose source is a plugin of type `variable_input`. The built-in "Variable
 * Input" source is not one -- DashboardLoader seeds those from their args.
 * Popup layouts never appear in `tab.gridItems` (they live in a map layer's
 * popupConfig), so they are excluded by construction.
 */
export function collectPluginVariableInputs(tabs, visualizations) {
  const pluginVariableInputs = [];
  for (const tab of tabs ?? []) {
    for (const gridItem of tab.gridItems ?? []) {
      if (!gridItem.source || gridItem.source === "Variable Input") continue;
      const visualization = findSelectOptionByValue(
        visualizations ?? [],
        gridItem.source,
        "source",
      );
      if (visualization?.type !== "variable_input") continue;
      let args;
      try {
        args = JSON.parse(gridItem.args_string);
      } catch (error) {
        continue;
      }
      pluginVariableInputs.push({
        gridItem,
        args,
        sourceArgs: visualization.args,
      });
    }
  }
  return pluginVariableInputs;
}

// Runnable once every `${...}` its args reference holds a value. Uses the
// substituter's own tokenizer and emptiness test, so "runnable" means exactly
// "getVisualization would not warn that a variable is empty".
function isRunnable({ args }, values) {
  return findUnresolvedVariableInputTokens(args).every((token) =>
    hasVariableInputValue(values[token]),
  );
}

/**
 * Runs the dashboard's plugin variable inputs before it renders, so the
 * visualizations that depend on them fetch with a value on their first render
 * instead of first warning that the variable is empty.
 *
 * Runs in waves: each wave fetches, in parallel, every plugin variable input
 * whose args resolve from the values known so far, and its results may make
 * further ones runnable. It stops when a wave makes nothing new runnable (a
 * cycle, or a variable nothing sets) or when `budgetMs` runs out, whichever
 * comes first. A response that lands after that adds no values, but its
 * request is not lost: see below.
 *
 * Each request is put in the one-shot preloaded-visualization cache as soon
 * as it starts, under its grid item's uuid, so the variable input's own tile
 * awaits it instead of running the plugin again -- including a request still
 * running when the budget ran out, which would otherwise run twice and
 * stream progress from both runs to the same tile.
 *
 * Returns only what the preload adds: `values` to merge into the variable
 * input values, normalized exactly as VariableInput would publish them, the
 * `dateFormats` those variable inputs would self-register, and `owners`, the
 * keys each grid item published (uuid -> { variableName, keys }), so the
 * dashboard can release them when that grid item goes away.
 */
export async function preloadPluginVariableInputs({
  tabs,
  visualizations,
  variableInputValues = {},
  variableInputDateFormats = {},
  budgetMs = VARIABLE_INPUT_PRELOAD_BUDGET_MS,
  onProgress = () => {},
  isAbandoned = () => false,
}) {
  let pending = collectPluginVariableInputs(tabs, visualizations);
  const values = {};
  const dateFormats = {};
  const owners = {};
  const total = pending.length;
  if (total === 0) return { values, dateFormats, owners };

  const knownValues = { ...variableInputValues };
  const knownDateFormats = { ...variableInputDateFormats };
  let completed = 0;
  let expired = false;
  let timer;
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => {
      expired = true;
      resolve();
    }, budgetMs);
  });
  const isOver = () => expired || isAbandoned();

  const run = async ({ gridItem, args, sourceArgs }) => {
    // The request getVisualization builds for this grid item.
    let response;
    try {
      const itemData = {
        source: gridItem.source,
        args: updateObjectWithVariableInputs({
          args,
          variableInputs: knownValues,
          variableInputDateFormats: knownDateFormats,
          sourceArgs,
          returnDatesAsLocalISO: true,
        }),
        requestId: gridItem.uuid,
      };
      const request = appAPI.getVisualizationData(itemData);
      // Cached before it settles, keyed by what it was built from, so the
      // tile shares it even if the budget runs out first.
      setPreloadedVisualization(
        gridItem.uuid,
        buildPreloadedRequestKey({
          source: gridItem.source,
          args,
          variableInputValues: knownValues,
          variableInputDateFormats: knownDateFormats,
        }),
        request,
      );
      response = await request;
    } catch (error) {
      response = null;
    }
    if (isOver()) return;
    completed += 1;
    onProgress({ completed, total });
    // A failure, or a plugin that turns out not to be a variable input, is
    // left to its tile, which reports it the normal way.
    if (
      response?.success !== true ||
      response.viz_type !== "variable_input" ||
      !response.data ||
      typeof response.data !== "object"
    ) {
      return;
    }

    // getVisualization substitutes variable inputs into a dashboard tile's
    // response before VariableInput sees it. If that cannot be done, neither
    // can the tile's own pass, so leave the item for the tile to report.
    let data;
    try {
      data = updateObjectWithVariableInputs({
        args: response.data,
        variableInputs: knownValues,
      });
    } catch (error) {
      return;
    }
    const { variable_name, initial_value, variable_options_source, metadata } =
      data;
    // VariableInput publishes nothing without a variable_options_source.
    if (!variable_name || !variable_options_source) return;
    const published = getPublishedVariableInputValues(
      variable_name,
      normalizeVariableInputValue({ variable_options_source, initial_value }),
    );
    owners[gridItem.uuid] = {
      variableName: variable_name,
      keys: published ? Object.keys(published) : [variable_name],
    };
    if (published) {
      Object.assign(values, published);
      Object.assign(knownValues, published);
    }
    const dateFormat = getVariableInputDateFormat({
      variable_options_source,
      metadata,
    });
    if (dateFormat) {
      dateFormats[variable_name] = dateFormat;
      knownDateFormats[variable_name] = dateFormat;
    }
  };

  onProgress({ completed, total });
  try {
    while (!isOver()) {
      const wave = pending.filter((item) => isRunnable(item, knownValues));
      if (wave.length === 0) break;
      pending = pending.filter((item) => !wave.includes(item));
      await Promise.race([Promise.all(wave.map(run)), deadline]);
    }
  } finally {
    clearTimeout(timer);
    // Anything still in flight is abandoned from here on.
    expired = true;
  }
  return { values, dateFormats, owners };
}
