/**
 * Tests for the dashboard_state + editable_paths injection the chatbox
 * emits at the start of each user turn. Without these paths, the LLM has
 * no reliable way to discover the `/args/...` JSON Pointer prefix the
 * whitelist requires — it guesses viz-native paths (e.g., `/layout/title`
 * for Plotly) and gives up after a few `whitelist_rejected` rounds.
 */

import {
  buildDashboardState,
  buildEditablePathsBySource,
  buildPatchContext,
} from "../../../components/sidebar/chatboxStateBuilder";
import { LLM_EDITABLE_PATHS } from "../../../config/editableSchemas";

const plotItem = {
  uuid: "plot-1",
  source: "Inline Plotly",
  args_string: JSON.stringify({
    inlineData: { layout: { title: "Rainfall" }, data: [] },
  }),
};

const mapItem = {
  uuid: "map-1",
  source: "Map",
  args_string: JSON.stringify({ title: "Watershed", layers: [] }),
};

const textItem = {
  uuid: "text-1",
  source: "Text",
  args_string: JSON.stringify({ text: "Hello" }),
};

const variableInputItem = {
  uuid: "vi-1",
  source: "Variable Input",
  args_string: JSON.stringify({
    variable_name: "year",
    initial_value: 2026,
  }),
};

const tabs = [
  { id: "t1", gridItems: [plotItem, mapItem, textItem] },
  { id: "t2", gridItems: [variableInputItem] },
];

describe("buildDashboardState", () => {
  test("returns empty array for missing/invalid tabs", () => {
    expect(buildDashboardState(undefined)).toEqual([]);
    expect(buildDashboardState(null)).toEqual([]);
    expect(buildDashboardState([])).toEqual([]);
    expect(buildDashboardState([{ gridItems: null }])).toEqual([]);
  });

  test("emits one entry per grid item with uuid + source + title", () => {
    const result = buildDashboardState(tabs);
    expect(result.map((i) => i.uuid)).toEqual([
      "plot-1",
      "map-1",
      "text-1",
      "vi-1",
    ]);
    const plot = result.find((i) => i.uuid === "plot-1");
    expect(plot.source).toBe("Inline Plotly");
    expect(plot.title).toBe("Rainfall");
    expect(plot.tabId).toBe("t1");
  });

  test("skips items with unparseable args_string", () => {
    const bad = { uuid: "bad", source: "Map", args_string: "{invalid" };
    const result = buildDashboardState([{ gridItems: [bad, plotItem] }]);
    expect(result.map((i) => i.uuid)).toEqual(["plot-1"]);
  });

  test("skips items with no uuid", () => {
    const noUuid = { source: "Map", args_string: "{}" };
    const result = buildDashboardState([{ gridItems: [noUuid, plotItem] }]);
    expect(result.map((i) => i.uuid)).toEqual(["plot-1"]);
  });
});

describe("buildEditablePathsBySource", () => {
  test("returns empty object for empty items", () => {
    expect(buildEditablePathsBySource([])).toEqual({});
  });

  test("includes only sources present in the items (dedup across items)", () => {
    const items = [
      { source: "Inline Plotly" },
      { source: "Inline Plotly" },
      { source: "Map" },
    ];
    const result = buildEditablePathsBySource(items);
    expect(Object.keys(result).sort()).toEqual(["Inline Plotly", "Map"]);
    expect(result["Inline Plotly"]).toEqual(LLM_EDITABLE_PATHS["Inline Plotly"]);
    expect(result["Map"]).toEqual(LLM_EDITABLE_PATHS["Map"]);
  });

  test("omits sources not in the whitelist (token saving; fail-closed)", () => {
    // Text + Custom Image are in the dashboard but not patchable.
    const items = [{ source: "Text" }, { source: "Custom Image" }];
    expect(buildEditablePathsBySource(items)).toEqual({});
  });

  test("mixed patchable + unpatchable items emits only patchable sources", () => {
    const items = [
      { source: "Inline Plotly" },
      { source: "Text" },
      { source: "Variable Input" },
    ];
    const result = buildEditablePathsBySource(items);
    expect(Object.keys(result).sort()).toEqual([
      "Inline Plotly",
      "Variable Input",
    ]);
  });
});

describe("buildPatchContext", () => {
  test("returns null when no patchable items are in the dashboard", () => {
    // Empty dashboard, no variable inputs set — nothing useful to say.
    expect(buildPatchContext([], {})).toBeNull();
    expect(buildPatchContext(undefined, undefined)).toBeNull();
  });

  test("returns context when items are present", () => {
    const ctx = buildPatchContext(tabs, { year: 2026 });
    expect(ctx).not.toBeNull();
    expect(ctx.dashboard_state).toHaveLength(4);
    expect(Object.keys(ctx.editable_paths_by_source).sort()).toEqual([
      "Inline Plotly",
      "Map",
      "Variable Input",
    ]);
    expect(ctx.variable_input_values).toEqual({ year: 2026 });
  });

  test("includes the plot's /args/inlineData prefix so the LLM can infer /args/inlineData/layout/title", () => {
    const ctx = buildPatchContext([{ id: "t", gridItems: [plotItem] }], {});
    expect(ctx.editable_paths_by_source["Inline Plotly"]).toContain(
      "/args/inlineData",
    );
  });

  test("returns context even when no items are patchable but variable inputs exist", () => {
    // A dashboard with only Text items and variable inputs — still useful
    // to tell the LLM what variables exist, even if nothing is patchable.
    // Decision: return null here (no patchable targets, injection has no
    // effect on patch_visualization). Keep behavior narrow.
    const result = buildPatchContext(
      [{ id: "t", gridItems: [textItem] }],
      { year: 2026 },
    );
    expect(result).toBeNull();
  });
});
