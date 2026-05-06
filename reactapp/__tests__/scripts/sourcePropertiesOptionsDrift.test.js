import { sourcePropertiesOptions } from "components/map/utilities";
import fs from "fs";
import path from "path";

// Cross-language drift guard — JS half.
//
// This test catches the failure mode that motivated plan 004:
//   "UI added a source type, MCP didn't notice."
//
// The JSON fixture lives under tethysapp/tethysdash/tests/fixtures/ so
// the Python-side guard can load the same file. When this test fails,
// either:
//   (a) you intentionally added/removed a JS source type → update the
//       fixture, and update plugin_helpers.available_source_properties
//       + LayerConfigurationBuilder.valid_sources to match (or add to
//       deferred_in_backend with reasoning).
//   (b) you accidentally changed the keys → revert.
//
// See: tethysapp/tethysdash/tests/mcp/test_source_metadata_drift.py for
// the Python half that closes the loop.

const fixturePath = path.resolve(
  __dirname,
  "../../../tethysapp/tethysdash/tests/fixtures/source_properties_options.json",
);

describe("sourcePropertiesOptions cross-language drift guard", () => {
  test("JS keys equal the committed fixture snapshot", () => {
    const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    const jsKeys = Object.keys(sourcePropertiesOptions).sort();
    expect(jsKeys).toEqual(fixture.source_types);
  });

  test("fixture deferred_in_backend entries are a subset of JS keys", () => {
    // Sanity: anything declared as backend-deferred must actually exist on
    // the JS side; otherwise the deferral is a stale entry.
    const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    const jsKeys = new Set(Object.keys(sourcePropertiesOptions));
    fixture.deferred_in_backend.forEach((key) => {
      expect(jsKeys.has(key)).toBe(true);
    });
  });
});
