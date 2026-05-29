/**
 * First-ever Jest coverage for DashboardLayout.handleUpdateVisualization.
 *
 * Characterization: pins the existing `append_layers` behavior (there was
 * zero test coverage prior to this file). Extension: validates the new
 * `apply_patch` branch added for the generic update-visualization protocol
 * (Unit 6 of the plan).
 */

import { useContext } from "react";
import { act, render, screen } from "@testing-library/react";
import DashboardLayout from "components/dashboard/DashboardLayout";
import createLoadedComponent, {
  TabsPComponent,
} from "__tests__/utilities/customRender";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import { TabContext } from "components/contexts/Contexts";

// Wraps DashboardLayout so `gridItems` flows from TabContext on every render,
// mirroring production. Without this, handleAddVisualization mutates
// gridItemsUpdated.current but the parent's re-render overwrites it with
// the stale static prop — breaking any multi-dispatch test.
const LiveDashboardLayout = ({ tabId }) => {
  const { tabs } = useContext(TabContext);
  const tab = (tabs || []).find((t) => t.id === tabId);
  return <DashboardLayout tabId={tabId} gridItems={tab?.gridItems || []} />;
};

// eslint-disable-next-line
jest.mock("components/dashboard/DashboardItem", () => (props) => (
  <p>Rendered Item</p>
));

function makeDashboard(gridItems) {
  return {
    id: 1,
    owner: "admin",
    uuid: "d-uuid",
    name: "Test Dashboard",
    description: "",
    publicDashboard: false,
    permissions: [{ username: "admin", permission: "admin" }],
    userPermission: "admin",
    unrestrictedPlacement: false,
    notes: "",
    tabs: [{ id: 1, name: "Tab 1", gridItems }],
  };
}

async function renderWithDashboard(dashboard) {
  const result = render(
    createLoadedComponent({
      children: (
        <>
          <LayoutAlertContextProvider>
            <LiveDashboardLayout tabId={dashboard.tabs[0].id} />
          </LayoutAlertContextProvider>
          <TabsPComponent />
        </>
      ),
      options: { initialDashboard: dashboard, inEditing: true },
    }),
  );
  // Generous timeout — some viz types (multi-item tabs, large args_string)
  // are slower to render through the DashboardItem mock chain.
  await screen.findAllByText("Rendered Item", {}, { timeout: 5000 });
  return result;
}

function getTabGridItems() {
  const raw = screen.getByTestId("tabs-context").textContent;
  const parsed = JSON.parse(raw);
  return parsed.tabs[0].gridItems;
}

async function dispatchUpdate(detail) {
  await act(async () => {
    window.dispatchEvent(
      new CustomEvent("tethysdash:update-visualization", { detail }),
    );
  });
}

async function dispatchAdd(detail) {
  await act(async () => {
    window.dispatchEvent(
      new CustomEvent("tethysdash:add-visualization", { detail }),
    );
  });
}

// ---------------------------------------------------------------------------
// Characterization: append_layers (existing behavior)
// ---------------------------------------------------------------------------

describe("handleUpdateVisualization — append_layers (characterization)", () => {
  const mapItem = {
    id: 1,
    uuid: "map-1",
    i: "1",
    x: 0,
    y: 0,
    w: 50,
    h: 30,
    source: "Map",
    args_string: JSON.stringify({ baseMap: "streets", layers: [] }),
    metadata_string: '{"refreshRate":0}',
  };

  test("appends layers to the target map's args.layers", async () => {
    await renderWithDashboard(makeDashboard([mapItem]));
    const newLayer = { name: "rainfall-wms", configuration: {} };

    await dispatchUpdate({
      uuid: "map-1",
      operation: "append_layers",
      layers: [newLayer],
    });

    const items = getTabGridItems();
    const updated = JSON.parse(items[0].args_string);
    expect(updated.layers).toEqual([newLayer]);
  });

  test("ignores append_layers when uuid is missing", async () => {
    await renderWithDashboard(makeDashboard([mapItem]));
    await dispatchUpdate({
      operation: "append_layers",
      layers: [{ name: "x" }],
    });
    const items = getTabGridItems();
    const unchanged = JSON.parse(items[0].args_string);
    expect(unchanged.layers).toEqual([]);
  });

  test("ignores append_layers when layers array is empty", async () => {
    await renderWithDashboard(makeDashboard([mapItem]));
    await dispatchUpdate({
      uuid: "map-1",
      operation: "append_layers",
      layers: [],
    });
    const items = getTabGridItems();
    const unchanged = JSON.parse(items[0].args_string);
    expect(unchanged.layers).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// New: apply_patch — generic update protocol
// ---------------------------------------------------------------------------

describe("handleUpdateVisualization — apply_patch", () => {
  const plotItem = {
    id: 1,
    uuid: "plot-1",
    i: "1",
    x: 0,
    y: 0,
    w: 50,
    h: 40,
    source: "Inline Plotly",
    args_string: JSON.stringify({
      vizType: "plotly",
      inlineData: {
        data: [{ x: [1, 2, 3], y: [4, 5, 6] }],
        layout: { title: "Rainfall" },
      },
    }),
    metadata_string: '{"refreshRate":0}',
  };

  const mapItem = {
    id: 2,
    uuid: "map-1",
    i: "2",
    x: 0,
    y: 0,
    w: 50,
    h: 30,
    source: "Map",
    args_string: JSON.stringify({
      baseMap: "streets",
      layerControl: false,
      layers: [{ name: "layer-0" }, { name: "layer-1" }, { name: "layer-2" }],
    }),
    metadata_string: '{"refreshRate":0}',
  };

  test("replaces a scalar field on an existing grid item", async () => {
    await renderWithDashboard(makeDashboard([plotItem]));
    await dispatchUpdate({
      batch: true,
      operation: "apply_patch",
      patches: [
        {
          uuid: "plot-1",
          source: "Inline Plotly",
          ops: [
            {
              op: "replace",
              path: "/args/inlineData/layout/title",
              value: "Precipitation",
            },
          ],
        },
      ],
    });
    const items = getTabGridItems();
    const updated = JSON.parse(items[0].args_string);
    expect(updated.inlineData.layout.title).toBe("Precipitation");
  });

  test("removes an array element", async () => {
    await renderWithDashboard(makeDashboard([mapItem]));
    await dispatchUpdate({
      batch: true,
      operation: "apply_patch",
      patches: [
        {
          uuid: "map-1",
          source: "Map",
          ops: [{ op: "remove", path: "/args/layers/1" }],
        },
      ],
    });
    const items = getTabGridItems();
    const updated = JSON.parse(items[0].args_string);
    expect(updated.layers).toEqual([{ name: "layer-0" }, { name: "layer-2" }]);
  });

  test("applies patches to multiple UUIDs in a single batch event", async () => {
    await renderWithDashboard(makeDashboard([plotItem, mapItem]));
    await dispatchUpdate({
      batch: true,
      operation: "apply_patch",
      patches: [
        {
          uuid: "plot-1",
          source: "Inline Plotly",
          ops: [{ op: "replace", path: "/args/inlineData/layout/title", value: "New Plot" }],
        },
        {
          uuid: "map-1",
          source: "Map",
          ops: [{ op: "replace", path: "/args/layerControl", value: true }],
        },
      ],
    });
    const items = getTabGridItems();
    const plot = JSON.parse(items.find((i) => i.uuid === "plot-1").args_string);
    const map = JSON.parse(items.find((i) => i.uuid === "map-1").args_string);
    expect(plot.inlineData.layout.title).toBe("New Plot");
    expect(map.layerControl).toBe(true);
  });

  test("partial-batch tolerance: bad UUID skipped, good UUID still lands", async () => {
    await renderWithDashboard(makeDashboard([plotItem]));
    await dispatchUpdate({
      batch: true,
      operation: "apply_patch",
      patches: [
        {
          uuid: "nonexistent-uuid",
          source: "Map",
          ops: [{ op: "replace", path: "/args/layerControl", value: true }],
        },
        {
          uuid: "plot-1",
          source: "Inline Plotly",
          ops: [{ op: "replace", path: "/args/inlineData/layout/title", value: "Still Works" }],
        },
      ],
    });
    const items = getTabGridItems();
    const updated = JSON.parse(items[0].args_string);
    expect(updated.inlineData.layout.title).toBe("Still Works");
  });

  test("partial-batch tolerance: rfc6902 apply error skips that UUID only", async () => {
    await renderWithDashboard(makeDashboard([plotItem, mapItem]));
    await dispatchUpdate({
      batch: true,
      operation: "apply_patch",
      patches: [
        {
          // replace on missing parent path — rfc6902 error
          uuid: "plot-1",
          source: "Inline Plotly",
          ops: [{ op: "replace", path: "/args/inlineData/nonexistent/foo", value: "x" }],
        },
        {
          uuid: "map-1",
          source: "Map",
          ops: [{ op: "replace", path: "/args/layerControl", value: true }],
        },
      ],
    });
    const items = getTabGridItems();
    const plot = JSON.parse(items.find((i) => i.uuid === "plot-1").args_string);
    const map = JSON.parse(items.find((i) => i.uuid === "map-1").args_string);
    // Plot unchanged — patch failed cleanly
    expect(plot.inlineData.layout.title).toBe("Rainfall");
    // Map still updated — partial-batch tolerance preserved sibling
    expect(map.layerControl).toBe(true);
  });

  test("emits tethysdash:patch-rejected when rfc6902 fails", async () => {
    // Silent-failure UX gap: failed patches must surface a chat-visible
    // event so the user sees the failure.
    await renderWithDashboard(makeDashboard([plotItem]));
    const events = [];
    const onReject = (e) => events.push(e.detail);
    window.addEventListener("tethysdash:patch-rejected", onReject);
    try {
      await dispatchUpdate({
        batch: true,
        operation: "apply_patch",
        patches: [
          {
            uuid: "plot-1",
            source: "Inline Plotly",
            ops: [{ op: "replace", path: "/args/inlineData/nonexistent/foo", value: "x" }],
          },
        ],
      });
    } finally {
      window.removeEventListener("tethysdash:patch-rejected", onReject);
    }
    expect(events.length).toBe(1);
    expect(events[0].uuid).toBe("plot-1");
    expect(events[0].path).toBe("/args/inlineData/nonexistent/foo");
    // rfc6902 surfaces the error class as `name`; we forward it verbatim.
    expect(events[0].errorClass).toBe("MissingError");
  });

  test("partial failure emits one event per failed UUID; successful UUIDs do not emit", async () => {
    await renderWithDashboard(makeDashboard([plotItem, mapItem]));
    const events = [];
    const onReject = (e) => events.push(e.detail);
    window.addEventListener("tethysdash:patch-rejected", onReject);
    try {
      await dispatchUpdate({
        batch: true,
        operation: "apply_patch",
        patches: [
          {
            uuid: "plot-1",
            source: "Inline Plotly",
            ops: [{ op: "replace", path: "/args/inlineData/nonexistent/foo", value: "x" }],
          },
          {
            uuid: "map-1",
            source: "Map",
            ops: [{ op: "replace", path: "/args/layerControl", value: true }],
          },
        ],
      });
    } finally {
      window.removeEventListener("tethysdash:patch-rejected", onReject);
    }
    expect(events.length).toBe(1);
    expect(events[0].uuid).toBe("plot-1");
    // Sibling patch still applied (existing partial-batch tolerance).
    const items = getTabGridItems();
    const map = JSON.parse(items.find((i) => i.uuid === "map-1").args_string);
    expect(map.layerControl).toBe(true);
  });

  test("clean apply does not emit tethysdash:patch-rejected", async () => {
    await renderWithDashboard(makeDashboard([plotItem]));
    const events = [];
    const onReject = (e) => events.push(e.detail);
    window.addEventListener("tethysdash:patch-rejected", onReject);
    try {
      await dispatchUpdate({
        batch: true,
        operation: "apply_patch",
        patches: [
          {
            uuid: "plot-1",
            source: "Inline Plotly",
            ops: [{ op: "replace", path: "/args/inlineData/layout/title", value: "OK" }],
          },
        ],
      });
    } finally {
      window.removeEventListener("tethysdash:patch-rejected", onReject);
    }
    expect(events.length).toBe(0);
  });

  test("no patches field → no-op", async () => {
    await renderWithDashboard(makeDashboard([plotItem]));
    await dispatchUpdate({
      batch: true,
      operation: "apply_patch",
      patches: [],
    });
    const items = getTabGridItems();
    const unchanged = JSON.parse(items[0].args_string);
    expect(unchanged.inlineData.layout.title).toBe("Rainfall");
  });

  test("regression: /args/-prefixed path from server whitelist resolves correctly", async () => {
    // The server whitelist (editableSchemas.json) roots every allowed path at
    // `/args/...`. The LLM emits paths like `/args/inlineData/layout/title`.
    // If the reducer applied those against the bare parsed args (no `args`
    // wrapper), the path wouldn't resolve and rfc6902 would silently return
    // an error — the user would see "tool succeeded" from the chatbox but
    // the chart would never update. This test pins the correct wrap-unwrap
    // behavior so that contract never drifts again.
    await renderWithDashboard(makeDashboard([plotItem]));
    await dispatchUpdate({
      batch: true,
      operation: "apply_patch",
      patches: [
        {
          uuid: "plot-1",
          source: "Inline Plotly",
          ops: [
            {
              op: "replace",
              path: "/args/inlineData/layout/title",
              value: "Bolivar campeon 2026",
            },
          ],
        },
      ],
    });
    const items = getTabGridItems();
    const updated = JSON.parse(items[0].args_string);
    expect(updated.inlineData.layout.title).toBe("Bolivar campeon 2026");
    // args wrapper must not leak into the persisted args_string
    expect(updated.args).toBeUndefined();
  });

  test("handles literal-dotted-key paths (variable_options_source.metadata)", async () => {
    // Source is "Inline Plotly" rather than "Variable Input" because the
    // Variable Input source triggers other context providers in the render
    // tree that aren't relevant to this reducer test. What we're pinning is
    // the RFC 6901 literal-dot behavior through rfc6902 + our reducer —
    // the source field doesn't affect that path.
    const dotItem = {
      id: 3,
      uuid: "dot-1",
      i: "3",
      x: 0,
      y: 0,
      w: 30,
      h: 10,
      source: "Inline Plotly",
      args_string: JSON.stringify({
        "variable_options_source.metadata": {
          outputFormat: "{{n}}",
          min: 0,
          max: 100,
        },
      }),
      metadata_string: '{"refreshRate":0}',
    };
    await renderWithDashboard(makeDashboard([dotItem]));
    await dispatchUpdate({
      batch: true,
      operation: "apply_patch",
      patches: [
        {
          uuid: "dot-1",
          source: "Inline Plotly",
          ops: [
            {
              op: "replace",
              path: "/args/variable_options_source.metadata/max",
              value: 200,
            },
          ],
        },
      ],
    });
    const items = getTabGridItems();
    const updated = JSON.parse(items[0].args_string);
    expect(updated["variable_options_source.metadata"].max).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Same-turn ordering invariant
// ---------------------------------------------------------------------------
//
// Chatbox.jsx dispatches `tethysdash:add-visualization` synchronously, then
// schedules `tethysdash:update-visualization` via requestAnimationFrame.
// That ordering is what makes it safe to patch a UUID the LLM just created
// in the same turn: the add handler runs to completion (updating
// gridItemsUpdated.current) before the rAF-scheduled patch dispatches.
// This test pins that invariant at the reducer level so a regression of
// the silent-drop "target_not_yet_persisted" behavior can't sneak back in.

describe("handleUpdateVisualization — same-turn add + patch ordering", () => {
  // A placeholder grid item so renderWithDashboard's findAllByText wait
  // can resolve. The add-visualization dispatch appends new items alongside.
  const placeholder = {
    id: 999,
    uuid: "placeholder",
    i: "999",
    x: 0,
    y: 0,
    w: 50,
    h: 30,
    source: "Text",
    args_string: JSON.stringify({ text: "placeholder" }),
    metadata_string: '{"refreshRate":0}',
  };

  test("a patch against a UUID added in the same batch lands on the new item", async () => {
    // Simulate Chatbox.jsx's dispatch order: synchronous add-visualization,
    // then update-visualization (as if rAF already fired — the reducer
    // doesn't care how it was scheduled).
    await renderWithDashboard(makeDashboard([placeholder]));

    // add-visualization event carries panels with raw `args` (not args_string);
    // handleAddVisualization stringifies internally at DashboardLayout.js:111.
    const newPanel = {
      source: "Inline Plotly",
      uuid: "plot-new",
      w: 50,
      h: 40,
      args: {
        vizType: "plotly",
        inlineData: {
          data: [{ x: [1, 2, 3], y: [4, 5, 6] }],
          layout: { title: "Rainfall (downstream)" },
        },
      },
    };

    await dispatchAdd({ batch: true, panels: [newPanel] });

    // At this point the reducer has appended the plot. Chatbox would now
    // fire the rAF-scheduled patch — we simulate it directly.
    await dispatchUpdate({
      batch: true,
      operation: "apply_patch",
      patches: [
        {
          uuid: "plot-new",
          source: "Inline Plotly",
          ops: [
            {
              op: "replace",
              path: "/args/inlineData/layout/title",
              value: "Tailwater",
            },
          ],
        },
      ],
    });

    const items = getTabGridItems();
    const plot = items.find((i) => i.uuid === "plot-new");
    expect(plot).toBeDefined();
    const args = JSON.parse(plot.args_string);
    // Patch landed: title is the new value, original data preserved
    expect(args.inlineData.layout.title).toBe("Tailwater");
    expect(args.inlineData.data).toEqual([{ x: [1, 2, 3], y: [4, 5, 6] }]);
  });

  test("two same-turn plots, patch targets only one of them", async () => {
    // Mirrors the user's reported prompt: create two plots, rename one.
    await renderWithDashboard(makeDashboard([placeholder]));

    const mkPanel = (uuid, title) => ({
      source: "Inline Plotly",
      uuid,
      w: 50,
      h: 40,
      args: {
        vizType: "plotly",
        inlineData: {
          data: [{ x: [1], y: [1] }],
          layout: { title },
        },
      },
    });

    await dispatchAdd({
      batch: true,
      panels: [
        mkPanel("plot-upstream", "Rainfall (upstream)"),
        mkPanel("plot-downstream", "Rainfall (downstream)"),
      ],
    });

    await dispatchUpdate({
      batch: true,
      operation: "apply_patch",
      patches: [
        {
          uuid: "plot-downstream",
          source: "Inline Plotly",
          ops: [
            {
              op: "replace",
              path: "/args/inlineData/layout/title",
              value: "Tailwater",
            },
          ],
        },
      ],
    });

    const items = getTabGridItems();
    const upstream = JSON.parse(
      items.find((i) => i.uuid === "plot-upstream").args_string,
    );
    const downstream = JSON.parse(
      items.find((i) => i.uuid === "plot-downstream").args_string,
    );
    // Upstream untouched
    expect(upstream.inlineData.layout.title).toBe("Rainfall (upstream)");
    // Downstream renamed
    expect(downstream.inlineData.layout.title).toBe("Tailwater");
  });

  test("patch that removes the entire /args root is refused — db cannot be poisoned", async () => {
    // Review ADV-004 (latent P2): JSON.stringify(undefined) returns the
    // JS value undefined (NOT the string "undefined"), which assigned to
    // args_string poisons later JSON.parse. The whitelist currently
    // blocks /args as a bare path, but a future broader entry would
    // silently corrupt state. Defense-in-depth: reducer refuses to
    // persist when draft.args ends up undefined.
    const plot = {
      id: 1,
      uuid: "plot-1",
      i: "1",
      x: 0, y: 0, w: 50, h: 40,
      source: "Inline Plotly",
      args_string: JSON.stringify({
        vizType: "plotly",
        inlineData: { data: [], layout: { title: "Original" } },
      }),
      metadata_string: '{"refreshRate":0}',
    };
    await renderWithDashboard(makeDashboard([plot]));
    await dispatchUpdate({
      batch: true,
      operation: "apply_patch",
      patches: [
        {
          uuid: "plot-1",
          source: "Inline Plotly",
          // Removing /args leaves the draft's args key undefined.
          ops: [{ op: "remove", path: "/args" }],
        },
      ],
    });
    const items = getTabGridItems();
    const result = JSON.parse(items[0].args_string);
    // Original state preserved — the guard refused the destructive op.
    expect(result.inlineData.layout.title).toBe("Original");
    // args_string never becomes the literal string "undefined".
    expect(items[0].args_string).not.toBe("undefined");
  });
});

describe("handleUpdateVisualization — unknown operation", () => {
  const item = {
    id: 1,
    uuid: "x-1",
    i: "1",
    x: 0,
    y: 0,
    w: 50,
    h: 30,
    source: "Inline Plotly",
    args_string: JSON.stringify({ title: "Untouched" }),
    metadata_string: '{"refreshRate":0}',
  };

  test("unknown operation is a no-op (fail-closed)", async () => {
    await renderWithDashboard(makeDashboard([item]));
    await dispatchUpdate({
      uuid: "x-1",
      operation: "mystery_op",
      something: "else",
    });
    const items = getTabGridItems();
    const unchanged = JSON.parse(items[0].args_string);
    expect(unchanged.title).toBe("Untouched");
  });
});

// ---------------------------------------------------------------------------
// Same-UUID-twice apply ordering (per-envelope atomicity)
// ---------------------------------------------------------------------------
//
// Chatbox.jsx emits one patches[] entry per engine envelope rather than
// merging by UUID, so `patches[]` may contain two entries with the same
// UUID. The handler's per-entry `updated`-array threading
// (`updated = [...updated.slice(...), newItem, ...]` plus the next
// iteration's `updated.findIndex(...)`) is what makes entry-B see entry-A's
// output.
//
// These tests prove the threading works and that per-envelope failure
// isolation holds — entry-B failing no longer poisons entry-A.

describe("handleUpdateVisualization — apply_patch same-UUID-twice", () => {
  const plotItem = {
    id: 1,
    uuid: "plot-1",
    i: "1",
    x: 0,
    y: 0,
    w: 50,
    h: 40,
    source: "Inline Plotly",
    args_string: JSON.stringify({
      vizType: "plotly",
      inlineData: {
        data: [{ x: [1, 2, 3], y: [4, 5, 6] }],
        layout: { title: "Original" },
      },
    }),
    metadata_string: '{"refreshRate":0}',
  };

  test("two same-UUID entries, both valid: both apply (second reads first's output)", async () => {
    await renderWithDashboard(makeDashboard([plotItem]));
    await dispatchUpdate({
      batch: true,
      operation: "apply_patch",
      patches: [
        {
          uuid: "plot-1",
          source: "Inline Plotly",
          ops: [
            { op: "replace", path: "/args/inlineData/layout/title", value: "After A" },
          ],
        },
        {
          uuid: "plot-1",
          source: "Inline Plotly",
          ops: [
            // Threading check: this `test` op only succeeds if it sees the
            // value entry-A wrote. RFC 6902 `test` fails the whole entry
            // if the value differs.
            { op: "test", path: "/args/inlineData/layout/title", value: "After A" },
            { op: "replace", path: "/args/inlineData/layout/title", value: "After B" },
          ],
        },
      ],
    });
    const items = getTabGridItems();
    const updated = JSON.parse(items[0].args_string);
    // Entry-B saw entry-A's output and applied on top — final state is "After B".
    expect(updated.inlineData.layout.title).toBe("After B");
  });

  test("two same-UUID entries, second invalid: first applies, second skipped (failure isolation)", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await renderWithDashboard(makeDashboard([plotItem]));
      await dispatchUpdate({
        batch: true,
        operation: "apply_patch",
        patches: [
          {
            uuid: "plot-1",
            source: "Inline Plotly",
            ops: [
              { op: "replace", path: "/args/inlineData/layout/title", value: "First Wins" },
            ],
          },
          {
            uuid: "plot-1",
            source: "Inline Plotly",
            ops: [
              // Replace on a missing parent path → rfc6902 apply error.
              // Pre-#15 this would have rolled back the merged transaction
              // and discarded entry-A. Post-#15 entry-A still lands.
              { op: "replace", path: "/args/inlineData/nonexistent/foo", value: "X" },
            ],
          },
        ],
      });
      const items = getTabGridItems();
      const updated = JSON.parse(items[0].args_string);
      expect(updated.inlineData.layout.title).toBe("First Wins");
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  test("two same-UUID entries, first invalid: first skipped, second applies on original state", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await renderWithDashboard(makeDashboard([plotItem]));
      await dispatchUpdate({
        batch: true,
        operation: "apply_patch",
        patches: [
          {
            uuid: "plot-1",
            source: "Inline Plotly",
            ops: [
              // First entry fails — entry-B should still see the *original*
              // state (not whatever partial mutation entry-A might have
              // attempted before failing).
              { op: "replace", path: "/args/inlineData/nonexistent/foo", value: "X" },
            ],
          },
          {
            uuid: "plot-1",
            source: "Inline Plotly",
            ops: [
              { op: "replace", path: "/args/inlineData/layout/title", value: "Second Wins" },
            ],
          },
        ],
      });
      const items = getTabGridItems();
      const updated = JSON.parse(items[0].args_string);
      expect(updated.inlineData.layout.title).toBe("Second Wins");
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
