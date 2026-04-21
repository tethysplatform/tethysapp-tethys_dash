/**
 * Sanity tests for the JS side of the R7 LLM-editable-path whitelist.
 *
 * Parity with the Python side (tethysapp/tethysdash/editable_schemas.py)
 * is enforced BY CONSTRUCTION: both sides load the same JSON file
 * (reactapp/config/editableSchemas.json). These tests validate JS-side
 * shape + matching-semantics behavior so the structural-prefix match
 * and literal-dotted-key hazards are pinned at the frontend boundary.
 */

import {
  LLM_EDITABLE_PATHS,
  isPathAllowed,
} from "../../config/editableSchemas";

describe("editableSchemas — schema shape", () => {
  test("has exactly the 5 in-scope viz types", () => {
    expect(Object.keys(LLM_EDITABLE_PATHS).sort()).toEqual(
      ["Inline Card", "Inline Plotly", "Inline Table", "Map", "Variable Input"],
    );
  });

  test("every entry is a non-empty list of absolute JSON Pointers", () => {
    for (const [source, prefixes] of Object.entries(LLM_EDITABLE_PATHS)) {
      expect(Array.isArray(prefixes)).toBe(true);
      expect(prefixes.length).toBeGreaterThan(0);
      for (const prefix of prefixes) {
        expect(typeof prefix).toBe("string");
        expect(prefix.startsWith("/")).toBe(true);
      }
    }
  });
});

describe("editableSchemas — R9 required fixtures (sample)", () => {
  // A subset of R9's paths — enough to pin the matching semantics from the
  // JS side. Full coverage lives in the Python contract test.
  const R9_SAMPLE = [
    ["Inline Plotly", "/args/title"],
    ["Inline Plotly", "/args/inlineData/data"],
    ["Inline Plotly", "/args/inlineData/data/0/x"],
    ["Inline Plotly", "/args/inlineData/layout"],
    ["Inline Table", "/args/subtitle"],
    ["Inline Table", "/args/inlineData/data/-"],
    ["Inline Card", "/args/inlineData/data/0/value"],
    ["Variable Input", "/args/initial_value"],
    ["Variable Input", "/args/variable_options_source.metadata"],
    ["Variable Input", "/args/variable_options_source.metadata/outputFormat"],
    ["Map", "/args/baseMap"],
    ["Map", "/args/layerControl"],
    ["Map", "/args/layers/2/configuration/props/opacity"],
    ["Map", "/args/map_extent/variable"],
    ["Map", "/args/mapDrawing/options"],
  ];

  test.each(R9_SAMPLE)("isPathAllowed(%s, %s) → true", (source, path) => {
    expect(isPathAllowed(source, path)).toBe(true);
  });
});

describe("editableSchemas — matching semantics", () => {
  test("exact match is allowed", () => {
    expect(isPathAllowed("Map", "/args/baseMap")).toBe(true);
  });

  test("child path via '/' separator is allowed", () => {
    expect(isPathAllowed("Map", "/args/layers/2")).toBe(true);
  });

  test("non-whitelisted path is rejected", () => {
    expect(isPathAllowed("Map", "/args/secret_internal_field")).toBe(false);
  });

  test("unknown source rejects everything (fail-closed)", () => {
    expect(isPathAllowed("Text", "/args/text")).toBe(false);
    expect(isPathAllowed("Custom Image", "/args/image_source")).toBe(false);
    expect(isPathAllowed("Nonexistent", "/args/title")).toBe(false);
  });
});

describe("editableSchemas — literal-dotted-key hazard", () => {
  test("dotted-key sibling is distinct from non-dotted key", () => {
    expect(isPathAllowed("Variable Input", "/args/variable_options_source")).toBe(true);
    expect(
      isPathAllowed("Variable Input", "/args/variable_options_source.metadata"),
    ).toBe(true);
  });

  test("dotted-key children are reachable via '/' separator", () => {
    expect(
      isPathAllowed(
        "Variable Input",
        "/args/variable_options_source.metadata/outputFormat",
      ),
    ).toBe(true);
  });

  test("matcher does NOT split on '.' — unrelated dotted keys stay rejected", () => {
    // /args/variable_name is whitelisted; /args/variable_name.metadata
    // must NOT be (no separate whitelist entry for it).
    expect(isPathAllowed("Variable Input", "/args/variable_name")).toBe(true);
    expect(
      isPathAllowed("Variable Input", "/args/variable_name.metadata"),
    ).toBe(false);
  });
});
