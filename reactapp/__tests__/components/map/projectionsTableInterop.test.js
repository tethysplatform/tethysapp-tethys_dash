// The generated EPSG table is loaded with a dynamic `import()`, and what that
// yields depends on how the JSON is transformed: a namespace object carrying
// `default`, or the parsed object itself. `loadGeneratedTable` accepts either.
// This lives in its own file because mocking the table would replace the real
// one for every other projections test.
jest.mock("components/map/epsgDefinitions.json", () => ({
  // No `default` key, so the fallback arm is the one taken.
  epsgVersion: "test",
  definitions: {
    99999: "+proj=longlat +datum=WGS84 +no_defs",
  },
  unsupported: {},
}));

import { ensureProjectionAsync } from "components/map/projections";

test("reads a generated table that is the parsed object rather than a namespace", async () => {
  const result = await ensureProjectionAsync("EPSG:99999");

  expect(result.projection).toBeTruthy();
  expect(result.error).toBeUndefined();
});
