/**
 * R11 / Unit B0 — chatbox permission gate.
 *
 * Pins that `<ChatSidebar />` renders only when the current dashboard's
 * permission is editor/admin (`editable === true`). Viewers and the
 * not-yet-loaded state produce no DOM. Mirrors the edit-modal's
 * visibility — the chatbox is an editor tool.
 */
import { act, fireEvent, render } from "@testing-library/react";
import ChatSidebar from "components/sidebar/ChatSidebar";
import {
  AppContext,
  LayoutContext,
  TabContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import { ChatSidebarContext } from "components/contexts/ChatSidebarContext";

// The Chatbox itself connects to an MCP server and owns heavy state — stub
// it out so this gate test doesn't need full chat infrastructure. The
// stub records the most-recent props it was rendered with so tests can
// inspect engineExtensions etc. (jest.mock factories can't close over
// outer variables due to hoisting, so we attach to globalThis instead.)
jest.mock("@chatbox/core/components", () => ({
  Chatbox: (props) => {
    globalThis.__chatboxLastProps = props;
    return <div data-testid="chatbox-stub" />;
  },
}));

function renderWithContexts({
  editable,
  pluginEditablePaths = {},
  tabs = [],
  variableInputValues = {},
}) {
  const layout = { editable };
  const tab = { tabs };
  const variables = { variableInputValues, setVariableInputValues: () => {} };
  const chatSidebar = { isOpen: true, setIsOpen: () => {} };
  const app = { csrf: "csrf-token", pluginEditablePaths };
  return render(
    <AppContext.Provider value={app}>
      <LayoutContext.Provider value={layout}>
        <TabContext.Provider value={tab}>
          <VariableInputsContext.Provider value={variables}>
            <ChatSidebarContext.Provider value={chatSidebar}>
              <ChatSidebar />
            </ChatSidebarContext.Provider>
          </VariableInputsContext.Provider>
        </TabContext.Provider>
      </LayoutContext.Provider>
    </AppContext.Provider>,
  );
}

function dispatchPatchRejected(detail) {
  act(() => {
    window.dispatchEvent(
      new CustomEvent("tethysdash:patch-rejected", { detail }),
    );
  });
}

describe("ChatSidebar permission gate (R11)", () => {
  test("mounts the chatbox when editable is true", () => {
    const { queryByTestId } = renderWithContexts({ editable: true });
    expect(queryByTestId("chatbox-stub")).not.toBeNull();
  });

  test("renders nothing when editable is false (viewer)", () => {
    const { queryByTestId, container } = renderWithContexts({ editable: false });
    expect(queryByTestId("chatbox-stub")).toBeNull();
    // The component returns null for viewers — no wrapper DOM either.
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing when editable is undefined (permission still loading)", () => {
    const { queryByTestId, container } = renderWithContexts({ editable: undefined });
    expect(queryByTestId("chatbox-stub")).toBeNull();
    expect(container.firstChild).toBeNull();
  });
});

describe("ChatSidebar patch-rejected banner (plan 2026-05-07-001 Unit B)", () => {
  test("renders nothing initially when no events have fired", () => {
    const { queryByTestId } = renderWithContexts({ editable: true });
    expect(queryByTestId("patch-rejected-banner")).toBeNull();
  });

  test("renders a banner entry when tethysdash:patch-rejected fires", () => {
    const { queryByTestId } = renderWithContexts({ editable: true });
    dispatchPatchRejected({
      uuid: "abcdef12-1234-5678-9abc-def012345678",
      path: "/args/layers/1/configuration/props/source/props/params",
      errorClass: "MissingError",
      opIndex: 0,
    });
    const banner = queryByTestId("patch-rejected-banner");
    expect(banner).not.toBeNull();
    // Banner content names the failure: error class, path, and uuid prefix.
    const text = banner.textContent;
    expect(text).toContain("MissingError");
    expect(text).toContain(
      "/args/layers/1/configuration/props/source/props/params",
    );
    expect(text).toContain("abcdef12");
  });

  test("subsequent events accumulate into the banner", () => {
    const { queryAllByTestId } = renderWithContexts({ editable: true });
    dispatchPatchRejected({
      uuid: "11111111-1111-1111-1111-111111111111",
      path: "/args/layers/0/configuration/props/source/props/params",
      errorClass: "MissingError",
      opIndex: 0,
    });
    dispatchPatchRejected({
      uuid: "22222222-2222-2222-2222-222222222222",
      path: "/args/layers/2/configuration/props/opacity",
      errorClass: "TestError",
      opIndex: 1,
    });
    expect(queryAllByTestId("patch-rejected-entry").length).toBe(2);
  });

  test("caps the number of visible entries", () => {
    const { queryAllByTestId } = renderWithContexts({ editable: true });
    // Fire more than the cap — older entries should drop off.
    for (let i = 0; i < 12; i++) {
      dispatchPatchRejected({
        uuid: `0000000${i}-0000-0000-0000-000000000000`,
        path: `/args/layers/${i}/configuration/props/opacity`,
        errorClass: "MissingError",
        opIndex: 0,
      });
    }
    const entries = queryAllByTestId("patch-rejected-entry");
    // Exact cap is an implementation detail; pin "fewer than dispatched".
    expect(entries.length).toBeLessThan(12);
    expect(entries.length).toBeGreaterThan(0);
  });

  test("dismiss button removes a single entry", () => {
    const { queryAllByTestId, queryAllByLabelText } = renderWithContexts({
      editable: true,
    });
    dispatchPatchRejected({
      uuid: "11111111-1111-1111-1111-111111111111",
      path: "/args/layers/0/x",
      errorClass: "MissingError",
      opIndex: 0,
    });
    dispatchPatchRejected({
      uuid: "22222222-2222-2222-2222-222222222222",
      path: "/args/layers/1/y",
      errorClass: "MissingError",
      opIndex: 0,
    });
    expect(queryAllByTestId("patch-rejected-entry").length).toBe(2);
    const closeButtons = queryAllByLabelText(/dismiss patch failure/i);
    expect(closeButtons.length).toBe(2);
    act(() => {
      fireEvent.click(closeButtons[0]);
    });
    expect(queryAllByTestId("patch-rejected-entry").length).toBe(1);
  });

  test("listener is cleaned up on unmount", () => {
    // Spy on add/remove so we can verify the cleanup function actually ran.
    // Comparing call shapes (event name + handler reference) catches the case
    // where the addEventListener returns successfully but the cleanup never
    // calls removeEventListener (or calls it with the wrong args).
    const adds = [];
    const removes = [];
    const origAdd = window.addEventListener;
    const origRemove = window.removeEventListener;
    window.addEventListener = function (type, handler, options) {
      if (type === "tethysdash:patch-rejected") {
        adds.push(handler);
      }
      return origAdd.call(this, type, handler, options);
    };
    window.removeEventListener = function (type, handler, options) {
      if (type === "tethysdash:patch-rejected") {
        removes.push(handler);
      }
      return origRemove.call(this, type, handler, options);
    };
    try {
      const { unmount } = renderWithContexts({ editable: true });
      expect(adds.length).toBe(1);
      unmount();
      // Cleanup must remove the SAME handler reference that was added.
      expect(removes.length).toBe(1);
      expect(removes[0]).toBe(adds[0]);
    } finally {
      window.addEventListener = origAdd;
      window.removeEventListener = origRemove;
    }
  });

  test("does not render banner when editable is false (viewer mode)", () => {
    const { queryByTestId, container } = renderWithContexts({
      editable: false,
    });
    dispatchPatchRejected({
      uuid: "11111111-1111-1111-1111-111111111111",
      path: "/args/x",
      errorClass: "MissingError",
      opIndex: 0,
    });
    expect(queryByTestId("patch-rejected-banner")).toBeNull();
    expect(container.firstChild).toBeNull();
  });
});

/**
 * 2026-05-09 debug session — third-party MCP servers (e.g.,
 * mta-subway-mcp-server) hit by slash-command prompt templates were
 * being refused by the LLM as "off-topic" because the
 * `beforeFirstMessage` system message framed every turn as
 * dashboard-edit-only, with no escape clause.
 *
 * The fix injects an explicit "advisory, not exclusive" preamble
 * BEFORE the dashboard-state JSON so the LLM treats off-topic
 * requests (slash-command templates from other MCP servers, general
 * questions) as routable. These tests pin the wording so a future
 * editor can't silently drop the escape clause.
 */
describe("ChatSidebar beforeFirstMessage system-message framing", () => {
  beforeEach(() => {
    globalThis.__chatboxLastProps = undefined;
  });

  const plotItem = {
    uuid: "dd6a49b1-eee2-4300-a4a4-ab88f52571dd",
    source: "Inline Plotly",
    args_string: JSON.stringify({
      inlineData: { layout: { title: "Streamflow timeseries" }, data: [] },
    }),
  };
  const tabsWithViz = [{ id: "t1", gridItems: [plotItem] }];

  test("emits the AUTHORITATIVE clause with empty dashboard_state when the dashboard is empty", () => {
    // Empty dashboard must still emit a system message so the AUTHORITATIVE
    // clause fires. Without this, the LLM reasons over prior-turn
    // create_* / patch_visualization tool calls and believes deleted UUIDs
    // still exist (bug 2026-05-19: user deletes plot, asks for new plot of
    // same data, LLM patches the no-longer-existing tile instead of
    // creating fresh).
    renderWithContexts({ editable: true, tabs: [] });
    const props = globalThis.__chatboxLastProps;
    expect(props).toBeDefined();
    const msg = props.engineExtensions.beforeFirstMessage();
    expect(msg).not.toBeNull();
    expect(msg.role).toBe("system");
    expect(msg.content).toMatch(/AUTHORITATIVE/);
    expect(msg.content).toMatch(
      /has been DELETED by the user since that call/,
    );
    // dashboard_state is the empty array — LLM applies AUTHORITATIVE semantics
    // ("everything previously created has been deleted") to all prior UUIDs.
    expect(msg.content).toMatch(/"dashboard_state":\[\]/);
  });

  test("emits a system message containing both the escape clause AND the dashboard-edit framing", () => {
    renderWithContexts({ editable: true, tabs: tabsWithViz });
    const props = globalThis.__chatboxLastProps;
    expect(props).toBeDefined();
    const msg = props.engineExtensions.beforeFirstMessage();
    expect(msg).not.toBeNull();
    expect(msg.role).toBe("system");
    // Escape clause — guards against the bug where the LLM refused
    // off-topic slash-command prompts (subway etc.) because the
    // dashboard-edit framing read as exclusive.
    expect(msg.content).toMatch(/REFERENCE for editing existing visualizations/);
    expect(msg.content).toMatch(/NOT exclusive scope/i);
    expect(msg.content).toMatch(
      /slash-command prompt template from another connected MCP server/i,
    );
    expect(msg.content).toMatch(/Do NOT refuse off-topic requests/i);
    expect(msg.content).toMatch(/advisory, not exclusive/i);
    // Dashboard-edit framing still present — the fix didn't drop it,
    // just contextualized it.
    expect(msg.content).toMatch(
      /To edit an existing visualization, target its uuid via the patch_visualization tool/,
    );
    expect(msg.content).toMatch(/editable_paths_by_source/);
    // Dashboard-state JSON is still appended.
    expect(msg.content).toMatch(/dd6a49b1-eee2-4300-a4a4-ab88f52571dd/);
    expect(msg.content).toMatch(/Inline Plotly/);
  });

  test("escape clause appears BEFORE the dashboard-edit framing in the system message", () => {
    renderWithContexts({ editable: true, tabs: tabsWithViz });
    const msg = globalThis.__chatboxLastProps.engineExtensions.beforeFirstMessage();
    const escapeIdx = msg.content.indexOf("REFERENCE for editing");
    const editFramingIdx = msg.content.indexOf(
      "Current dashboard state and patch_visualization reference",
    );
    expect(escapeIdx).toBeGreaterThanOrEqual(0);
    expect(editFramingIdx).toBeGreaterThanOrEqual(0);
    // Position matters — system messages weight early content more.
    // The escape clause must lead so the LLM sees the "not exclusive"
    // framing before the dashboard-edit instructions.
    expect(escapeIdx).toBeLessThan(editFramingIdx);
  });

  // Debug session 2026-05-09 — LLM was firing BOTH create_plotly_chart
  // AND patch_visualization for "add a line to viz X" requests, producing
  // a duplicate ghost tile. The fix added a PRIORITY rule to the system
  // message making patch_visualization the winner when both could apply.
  // These tests pin the wording AND its position in the message so the
  // rule can't silently regress.

  test("PRIORITY rule names patch_visualization as the winner when both create and patch could apply", () => {
    renderWithContexts({ editable: true, tabs: tabsWithViz });
    const msg = globalThis.__chatboxLastProps.engineExtensions.beforeFirstMessage();
    expect(msg.content).toMatch(/PRIORITY/);
    expect(msg.content).toMatch(
      /ALWAYS use\s+`?patch_visualization`?/i,
    );
    expect(msg.content).toMatch(/Do NOT also call any `?create_\*`?/i);
    // Names the duplicate-ghost-tile failure mode so a future editor
    // understands what the rule prevents.
    expect(msg.content).toMatch(/duplicate ghost tiles/i);
  });

  test("PRIORITY rule preserves the add_*_layer exception for new layers on existing maps", () => {
    renderWithContexts({ editable: true, tabs: tabsWithViz });
    const msg = globalThis.__chatboxLastProps.engineExtensions.beforeFirstMessage();
    // The PRIORITY rule's negative directive is "no create_* in the same
    // turn as patch_visualization", but adding a NEW layer to an
    // EXISTING map still goes through `add_*_layer` (which takes a
    // map_uuid), not patch_visualization. The system message must
    // surface this exception so the LLM doesn't degenerate to "every
    // edit goes through patch_visualization".
    expect(msg.content).toMatch(/add_\*_layer/);
    expect(msg.content).toMatch(/exception/i);
  });

  test("PRIORITY rule appears BETWEEN the patch-framing and the dashboard-state JSON", () => {
    renderWithContexts({ editable: true, tabs: tabsWithViz });
    const msg = globalThis.__chatboxLastProps.engineExtensions.beforeFirstMessage();
    const editFramingIdx = msg.content.indexOf(
      "Current dashboard state and patch_visualization reference",
    );
    const priorityIdx = msg.content.indexOf("PRIORITY");
    const jsonIdx = msg.content.indexOf("dd6a49b1-eee2-4300-a4a4-ab88f52571dd");
    expect(editFramingIdx).toBeGreaterThanOrEqual(0);
    expect(priorityIdx).toBeGreaterThanOrEqual(0);
    expect(jsonIdx).toBeGreaterThanOrEqual(0);
    // PRIORITY must sit between the framing prose and the dashboard-state
    // JSON dump. Putting it BEFORE the framing risks the LLM weighting
    // it as "advisory" along with the escape clause; putting it AFTER
    // the JSON buries it. Between is the right slot.
    expect(priorityIdx).toBeGreaterThan(editFramingIdx);
    expect(priorityIdx).toBeLessThan(jsonIdx);
  });

  // Debug session 2026-05-17 — LLM was treating dashboard_state as
  // additive to its own prior-turn tool-call history. When the user
  // deleted a viz in the UI between turns, the LLM trusted "I created
  // uuid X earlier" over the fresh dashboard_state that no longer
  // listed X — refusing to recreate ("it already exists") or trying to
  // patch_visualization a UUID that was gone. The fix adds an
  // AUTHORITATIVE clause establishing dashboard_state as the complete
  // current truth, with prior tool-call history explicitly subordinate.
  // These tests pin the wording and its position so the rule can't
  // silently regress.

  test("AUTHORITATIVE clause establishes dashboard_state as the complete current truth, overriding prior tool-call history", () => {
    renderWithContexts({ editable: true, tabs: tabsWithViz });
    const msg = globalThis.__chatboxLastProps.engineExtensions.beforeFirstMessage();
    expect(msg.content).toMatch(/AUTHORITATIVE/);
    expect(msg.content).toMatch(/COMPLETE list/i);
    // Names the deletion semantics so the LLM knows what missing UUIDs mean.
    expect(msg.content).toMatch(/DELETED by the user/i);
    // Names the wrong behaviors the rule prevents — refusing to recreate
    // and trying to patch a UUID that no longer exists.
    expect(msg.content).toMatch(/recreate from scratch/i);
    // Explicitly subordinates prior-turn history to dashboard_state.
    expect(msg.content).toMatch(
      /tool-call history is NOT authoritative/i,
    );
    expect(msg.content).toMatch(/`?dashboard_state`?\s+always\s+wins/i);
  });

  test("AUTHORITATIVE clause appears AFTER the escape clause and BEFORE the dashboard-edit framing", () => {
    renderWithContexts({ editable: true, tabs: tabsWithViz });
    const msg = globalThis.__chatboxLastProps.engineExtensions.beforeFirstMessage();
    const escapeIdx = msg.content.indexOf("REFERENCE for editing");
    const authorityIdx = msg.content.indexOf("AUTHORITATIVE");
    const editFramingIdx = msg.content.indexOf(
      "Current dashboard state and patch_visualization reference",
    );
    expect(escapeIdx).toBeGreaterThanOrEqual(0);
    expect(authorityIdx).toBeGreaterThanOrEqual(0);
    expect(editFramingIdx).toBeGreaterThanOrEqual(0);
    // Position is load-bearing: the escape clause defends against
    // off-topic refusals (must lead); the AUTHORITATIVE clause defends
    // against stale-history reasoning (must lead the dashboard-edit
    // section so the LLM knows dashboard_state is current truth before
    // it reads any patch_visualization instructions).
    expect(authorityIdx).toBeGreaterThan(escapeIdx);
    expect(authorityIdx).toBeLessThan(editFramingIdx);
  });
});
