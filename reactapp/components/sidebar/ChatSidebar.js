import { memo, useCallback, useContext, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import {
  AppContext,
  LayoutContext,
  TabContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import { ChatSidebarContext } from "components/contexts/ChatSidebarContext";
import { Chatbox } from "@chatbox/core/components";
import { buildGenericSystemMessage } from "@chatbox/core/messages";
import { BsXLg } from "react-icons/bs";
import { buildDeltaSummary, buildPatchContext } from "./chatboxStateBuilder";

// Plan 003 D3 — system-prompt instruction telling the LLM to use the
// engine's `_engine_dispatched` field as ground truth for any claim
// that a visualization, chart, map, or other tile was created or
// updated. Without this, an LLM that gets data back from a tool call
// can confidently tell the user a tile was rendered when nothing
// reached the dashboard. The Unit C3 banner is the structural
// fallback; this instruction is the in-band fix.
const DISPATCH_FEEDBACK_RULE =
  "Only claim a visualization was created or updated if its UUID " +
  "appears in the `_engine_dispatched` field of the corresponding " +
  "tool result. If `_engine_dispatched` is empty, that call returned " +
  "data only — do not claim a tile was rendered.";

function buildSystemPromptWithDispatchRule(opts = {}) {
  const base = buildGenericSystemMessage(opts);
  if (!base || typeof base.content !== "string") return base;
  return { ...base, content: `${base.content}\n\n${DISPATCH_FEEDBACK_RULE}` };
}

// R6 delta truncation policy (from the origin requirements doc): the
// afterToolExecution decoration shows at most the last N rounds OR the
// last M UUID-field pairs worth of mutations, whichever is smaller.
const DELTA_MAX_UUIDS = 30;

// Pattern used to strip a previously-appended delta block before writing
// the next one. Without this, each afterToolExecution invocation would
// append a new `[in-turn delta]` block to the same message — linearly
// growing the context across a multi-round turn (review ADV-005).
const DELTA_BLOCK_RE = /\n\n\[in-turn delta\]\n[\s\S]*$/;

const SIDEBAR_WIDTH = 360;

// Cap on patch-rejected entries shown in the banner. Older entries drop off
// FIFO so the banner doesn't grow unbounded across a long debugging session.
// Plan 2026-05-07-001 Unit B: silent-failure UX gap — failed patches must
// surface to the user so the chatbox's confident "Done!" message is not the
// last word.
const PATCH_REJECTED_BANNER_CAP = 5;

const Wrapper = styled.div`
  width: ${(props) => (props.$isOpen ? `${SIDEBAR_WIDTH}px` : "0px")};
  min-width: ${(props) => (props.$isOpen ? `${SIDEBAR_WIDTH}px` : "0px")};
  overflow: hidden;
  transition: width 0.3s ease, min-width 0.3s ease;
  border-left: ${(props) => (props.$isOpen ? "1px solid #ddd" : "none")};
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  position: relative;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  background: #f8f9fa;
  flex-shrink: 0;
  min-width: ${SIDEBAR_WIDTH}px;
`;

const Title = styled.span`
  font-weight: 600;
  font-size: 0.9rem;
  color: #333;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #666;
  display: flex;
  align-items: center;
  &:hover {
    color: #333;
  }
`;

const Content = styled.div`
  flex: 1;
  overflow: hidden;
  min-width: ${SIDEBAR_WIDTH}px;
  height: 0;
`;

const PatchRejectedBanner = styled.div`
  flex-shrink: 0;
  min-width: ${SIDEBAR_WIDTH}px;
  background: #fff8e1;
  border-bottom: 1px solid #f0d68a;
  padding: 6px 10px;
  font-size: 0.78rem;
  color: #5a4400;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const PatchRejectedEntry = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 6px;
  line-height: 1.3;
`;

const PatchRejectedBody = styled.div`
  flex: 1;
  word-break: break-all;
`;

const PatchRejectedDismiss = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: #7a5c00;
  padding: 0 4px;
  font-size: 0.85rem;
  line-height: 1;
  flex-shrink: 0;
  &:hover {
    color: #3d2e00;
  }
`;

function ChatSidebar() {
  // `?? {}` matches the pattern in components/layout/Header.js:287 — callers
  // that mount the sidebar outside the required providers (e.g., isolated
  // component tests that don't set up the full context tree) should get a
  // no-op rather than crash during destructuring.
  const { isOpen, setIsOpen } = useContext(ChatSidebarContext) ?? {};
  const { csrf, pluginEditablePaths } = useContext(AppContext) ?? {};
  const { variableInputValues, setVariableInputValues } =
    useContext(VariableInputsContext) ?? {};
  // TabContext provides live tabs + gridItems. Subscribed here (not deeper)
  // so dashboardState stays in sync with whatever the user + reducer have
  // persisted. The Chatbox package remains generic — TethysDash state is
  // injected via engineExtensions below.
  const { tabs } = useContext(TabContext) ?? {};
  // R11 (permission gate): the chatbox is an editor tool. Viewers and
  // not-yet-loaded permission states get no chatbox at all — matches the
  // edit modal's visibility. `editable` is the same boolean the layout
  // chrome already uses to hide edit controls (DashboardLoader.js:50).
  // When mounted outside LayoutContext (test harness), default to not-
  // editable — failing closed is safer than failing open.
  const { editable } = useContext(LayoutContext) ?? {};

  const updateVariableInputValues = useCallback(
    (updatedValues) =>
      setVariableInputValues((prev) => ({ ...prev, ...updatedValues })),
    [setVariableInputValues],
  );

  const memoizedVariableInputValues = useMemo(
    () => variableInputValues,
    [variableInputValues],
  );

  // Plan 2026-05-07-001 Unit B: chat-sidebar-visible feedback when a patch
  // dispatch fails inside `applyPatchToGridItem` (rfc6902 errors etc.).
  // Without this banner, the chatbox shows the LLM's confident "Done!"
  // message and the user has no signal that nothing actually changed.
  const [patchRejections, setPatchRejections] = useState([]);
  useEffect(() => {
    function onPatchRejected(e) {
      const detail = e?.detail;
      if (!detail || typeof detail !== "object") return;
      const entry = {
        // A unique key for React; the same UUID can fail multiple times,
        // so combine with a monotonic counter via Date.now() + Math.random()
        // (collision-resistant enough for a chat-banner UI).
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        uuid: typeof detail.uuid === "string" ? detail.uuid : "(unknown)",
        path: typeof detail.path === "string" ? detail.path : "(no path)",
        errorClass:
          typeof detail.errorClass === "string"
            ? detail.errorClass
            : "ApplyError",
        opIndex: typeof detail.opIndex === "number" ? detail.opIndex : null,
      };
      setPatchRejections((prev) => {
        const next = [...prev, entry];
        // FIFO cap — drop oldest entries when over the limit.
        return next.length > PATCH_REJECTED_BANNER_CAP
          ? next.slice(next.length - PATCH_REJECTED_BANNER_CAP)
          : next;
      });
    }
    window.addEventListener("tethysdash:patch-rejected", onPatchRejected);
    return () => {
      window.removeEventListener("tethysdash:patch-rejected", onPatchRejected);
    };
  }, []);

  const dismissPatchRejection = useCallback((id) => {
    setPatchRejections((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // Snapshot of current dashboard visualizations + the editable-path
  // whitelist for every source present. Rebuilt on every tabs /
  // variableInputValues change so the beforeFirstMessage closure always
  // captures the freshest state for the next user turn. Returns null when
  // the dashboard has nothing patchable — the engine skips the injection.
  const patchContext = useMemo(
    () => buildPatchContext(tabs, variableInputValues, pluginEditablePaths),
    [tabs, variableInputValues, pluginEditablePaths],
  );

  // Engine extensions: inject dashboard state + editable-path whitelist at
  // turn start (R6) and decorate each tool result with an in-turn delta
  // (R6 + R12 discipline). The engine reads
  // `state.pendingVisualizations / pendingLayerUpdates / pendingPatches`
  // at hook time so the delta reflects mutations that accumulated during
  // this turn (not just the turn-start snapshot).
  const engineExtensions = useMemo(
    () => ({
      systemPromptBuilder: buildSystemPromptWithDispatchRule,
      beforeFirstMessage: () => {
        if (!patchContext) return null;
        return {
          role: "system",
          content:
            "Current dashboard state and patch_visualization reference. " +
            "To edit an existing visualization, target its uuid via the " +
            "patch_visualization tool. Use `editable_paths_by_source` to " +
            "find allowed paths for each viz's source — every path starts " +
            "with `/args/...` and each listed entry is a PREFIX you can " +
            "extend (e.g., `/args/inlineData` permits " +
            "`/args/inlineData/layout/title`, `/args/inlineData/data/0/x`, " +
            "etc.). RFC 6901 JSON Pointer: literal `.` in segment names is " +
            "preserved (do not escape). When a path appears in " +
            "`value_hints_by_source`, the persisted value must be chosen " +
            "verbatim from the listed `options` — do not invent or " +
            "abbreviate the value. Variable input values are listed below " +
            "so you can reason over current filters.\n" +
            JSON.stringify(patchContext),
        };
      },
      afterToolExecution: (toolName, args, toolResult, state, messages) => {
        // R12: never signal an early return from here. This hook only
        // decorates the just-pushed tool-result message with a compact
        // summary of what the current turn has mutated so far, so the LLM
        // can reason about subsequent patch targets without waiting for
        // the next turn's state injection.
        const createdUuids = (state.pendingVisualizations || [])
          .map((v) => v?.uuid)
          .filter(Boolean);
        const patchedUuids = (state.pendingPatches || [])
          .map((p) => p?.uuid)
          .filter(Boolean);
        const layerUpdateUuids = (state.pendingLayerUpdates || [])
          .map((l) => l?.map_uuid)
          .filter(Boolean);

        if (
          createdUuids.length === 0 &&
          patchedUuids.length === 0 &&
          layerUpdateUuids.length === 0
        ) {
          return;
        }

        const summary = buildDeltaSummary(
          createdUuids,
          patchedUuids,
          layerUpdateUuids,
          DELTA_MAX_UUIDS,
        );

        // Rewrite the delta on the most-recent tool-result message. Strip
        // any prior [in-turn delta] block first so we don't accumulate one
        // block per hook invocation across a multi-round turn (review
        // ADV-005 — quadratic context growth).
        const lastIdx = messages.length - 1;
        if (lastIdx < 0 || messages[lastIdx]?.role !== "tool") return;
        const currentContent = messages[lastIdx].content;
        if (typeof currentContent !== "string") return;
        const base = currentContent.replace(DELTA_BLOCK_RE, "");
        messages[lastIdx].content =
          base + `\n\n[in-turn delta]\n${JSON.stringify(summary)}`;
      },
      // toolErrorCheck: tells the engine which tool results are errors so
      // the structured repair loop can fire. patch_visualization +
      // create_card return `{error: "..."}` envelopes for invalid_envelope,
      // whitelist_rejected, patch_apply_failed, invalid_args (review
      // REL-001). Without this wiring, the LLM only sees the error as raw
      // tool-result content with no engine-level retry scaffolding.
      toolErrorCheck: (toolResult) => {
        if (
          toolResult &&
          typeof toolResult === "object" &&
          typeof toolResult.error === "string"
        ) {
          return { error: toolResult.error };
        }
        return null;
      },
    }),
    [patchContext],
  );

  // R11: viewers and not-yet-loaded permission states see no chatbox at
  // all. All hooks above ran unconditionally (React rules); the gate is
  // the render output. Aligns with the edit-modal visibility pattern.
  if (!editable) return null;

  // Sidebar renders even without chatboxConfig — users add MCP servers via the panel.
  // LLM provider config is managed via localStorage (LLMProviderPanel in chatbox).
  return (
    <Wrapper $isOpen={isOpen}>
      <Header>
        <Title>Chat</Title>
        <CloseButton onClick={() => setIsOpen(false)} aria-label="Close chat">
          <BsXLg size={14} />
        </CloseButton>
      </Header>
      {patchRejections.length > 0 && (
        <PatchRejectedBanner data-testid="patch-rejected-banner" role="alert">
          {patchRejections.map((entry) => (
            <PatchRejectedEntry
              key={entry.id}
              data-testid="patch-rejected-entry"
            >
              <PatchRejectedBody>
                <strong>Patch failed:</strong> {entry.errorClass}
                {" · "}
                <code>{entry.path}</code>
                {" · "}
                <span title={entry.uuid}>{entry.uuid.slice(0, 8)}</span>
              </PatchRejectedBody>
              <PatchRejectedDismiss
                aria-label="Dismiss patch failure"
                onClick={() => dismissPatchRejection(entry.id)}
              >
                <BsXLg size={10} />
              </PatchRejectedDismiss>
            </PatchRejectedEntry>
          ))}
        </PatchRejectedBanner>
      )}
      <Content>
        <Chatbox
          csrfToken={csrf}
          variableInputValues={memoizedVariableInputValues}
          updateVariableInputValues={updateVariableInputValues}
          engineExtensions={engineExtensions}
          welcomeHeading="Ask me about your dashboard"
          welcomeSubtitle="I can create visualizations, edit tiles, add map layers, and analyze data — just ask."
          suggestedPrompts={[
            "Create a bar chart",
            "Add a map layer",
            "Summarize this dashboard",
          ]}
        />
      </Content>
    </Wrapper>
  );
}

export default memo(ChatSidebar);
