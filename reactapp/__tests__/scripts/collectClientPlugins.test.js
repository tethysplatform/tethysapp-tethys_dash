/**
 * Tests for the build-time client plugin collector.
 *
 * Exercises the pure buildPluginEntry helper rather than running the full
 * fs-driven discovery pipeline — the interesting behavior is field
 * propagation from a plugin declaration into the registry entry, and that
 * the LLM-editability fields are only emitted when authors opt in.
 */

const {
  buildPluginEntry,
} = require("../../../scripts/collectClientPlugins");

describe("buildPluginEntry", () => {
  test("returns null when source is missing", () => {
    expect(buildPluginEntry({ module: "index.js" }, "some-package")).toBeNull();
  });

  test("returns null when module is missing", () => {
    expect(
      buildPluginEntry({ source: "some-source" }, "some-package"),
    ).toBeNull();
  });

  test("base entry carries required defaulted fields", () => {
    const entry = buildPluginEntry(
      { source: "nwm-flood-map", module: "dist/index.js" },
      "@nwm/flood-map",
    );
    expect(entry).toMatchObject({
      source: "nwm-flood-map",
      label: "nwm-flood-map",
      group: "Client Plugins",
      type: "client_custom",
      module: "dist/index.js",
      tags: [],
      description: "",
      args: {},
      packageName: "@nwm/flood-map",
    });
    // Without opt-in, editability fields must be absent — not null — so the
    // Python resolver falls through to default-permissive behavior.
    expect("llmEditableArgs" in entry).toBe(false);
    expect("llmNonEditableArgs" in entry).toBe(false);
  });

  test("propagates llmEditableArgs when declared as an array", () => {
    const entry = buildPluginEntry(
      {
        source: "nwm-flood-map",
        module: "dist/index.js",
        args: { title: "text", dataUrl: "text", secret: "text" },
        llmEditableArgs: ["title", "dataUrl"],
      },
      "@nwm/flood-map",
    );
    expect(entry.llmEditableArgs).toEqual(["title", "dataUrl"]);
  });

  test("propagates llmNonEditableArgs when declared as an array", () => {
    const entry = buildPluginEntry(
      {
        source: "nwm-flood-map",
        module: "dist/index.js",
        args: { title: "text", authToken: "text" },
        llmNonEditableArgs: ["authToken"],
      },
      "@nwm/flood-map",
    );
    expect(entry.llmNonEditableArgs).toEqual(["authToken"]);
  });

  test("ignores non-array llmEditableArgs (defensive)", () => {
    const entry = buildPluginEntry(
      {
        source: "nwm-flood-map",
        module: "dist/index.js",
        llmEditableArgs: "title",
      },
      "@nwm/flood-map",
    );
    expect("llmEditableArgs" in entry).toBe(false);
  });

  test("propagates scope and remoteType for client_custom_remote plugins", () => {
    const entry = buildPluginEntry(
      {
        source: "mfe-flood",
        module: "./FloodMap",
        type: "client_custom_remote",
        scope: "mfeFlood",
        remoteType: "module",
      },
      "@nwm/mfe-flood",
    );
    expect(entry.type).toBe("client_custom_remote");
    expect(entry.scope).toBe("mfeFlood");
    expect(entry.remoteType).toBe("module");
  });

  test("preserves user-declared group, label, tags, description", () => {
    const entry = buildPluginEntry(
      {
        source: "nwm-flood-map",
        module: "dist/index.js",
        label: "Flood Map",
        group: "Hydrology",
        tags: ["map", "flood"],
        description: "Flooded areas overlay",
      },
      "@nwm/flood-map",
    );
    expect(entry).toMatchObject({
      label: "Flood Map",
      group: "Hydrology",
      tags: ["map", "flood"],
      description: "Flooded areas overlay",
    });
  });
});
