import { memo, useCallback, useContext, useMemo } from "react";
import styled from "styled-components";
import {
  AppContext,
  TabContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import { ChatSidebarContext } from "components/contexts/ChatSidebarContext";
import { Chatbox } from "@chatbox/core/components";
import { BsXLg } from "react-icons/bs";
import { buildPatchContext } from "./chatboxStateBuilder";

// R6 delta truncation policy (from the origin requirements doc): the
// afterToolExecution decoration shows at most the last N rounds OR the
// last M UUID-field pairs worth of mutations, whichever is smaller.
const DELTA_MAX_UUIDS = 30;

const SIDEBAR_WIDTH = 360;

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

function ChatSidebar() {
  // `?? {}` matches the pattern in components/layout/Header.js:287 — callers
  // that mount the sidebar outside the required providers (e.g., isolated
  // component tests that don't set up the full context tree) should get a
  // no-op rather than crash during destructuring.
  const { isOpen, setIsOpen } = useContext(ChatSidebarContext) ?? {};
  const { tethysApp, csrf } = useContext(AppContext) ?? {};
  const { variableInputValues, setVariableInputValues } =
    useContext(VariableInputsContext) ?? {};
  // TabContext provides live tabs + gridItems. Subscribed here (not deeper)
  // so dashboardState stays in sync with whatever the user + reducer have
  // persisted. The Chatbox package remains generic — TethysDash state is
  // injected via engineExtensions below.
  const { tabs } = useContext(TabContext) ?? {};

  const updateVariableInputValues = useCallback(
    (updatedValues) =>
      setVariableInputValues((prev) => ({ ...prev, ...updatedValues })),
    [setVariableInputValues],
  );

  const memoizedVariableInputValues = useMemo(
    () => variableInputValues,
    [variableInputValues],
  );

  // Snapshot of current dashboard visualizations + the editable-path
  // whitelist for every source present. Rebuilt on every tabs /
  // variableInputValues change so the beforeFirstMessage closure always
  // captures the freshest state for the next user turn. Returns null when
  // the dashboard has nothing patchable — the engine skips the injection.
  const patchContext = useMemo(
    () => buildPatchContext(tabs, variableInputValues),
    [tabs, variableInputValues],
  );

  // Engine extensions: inject dashboard state + editable-path whitelist at
  // turn start (R6) and decorate each tool result with an in-turn delta
  // (R6 + R12 discipline). The engine reads
  // `state.pendingVisualizations / pendingLayerUpdates / pendingPatches`
  // at hook time so the delta reflects mutations that accumulated during
  // this turn (not just the turn-start snapshot).
  const engineExtensions = useMemo(
    () => ({
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
            "preserved (do not escape). Variable input values are listed " +
            "below so you can reason over current filters.\n" +
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

        const total =
          createdUuids.length + patchedUuids.length + layerUpdateUuids.length;
        if (total === 0) return;

        // Truncation: cap decoration at DELTA_MAX_UUIDS distinct UUIDs
        // across all three categories. Rollover sentinel for the rest.
        const summary = {};
        if (createdUuids.length > 0) {
          summary.created_this_turn = createdUuids.slice(0, DELTA_MAX_UUIDS);
        }
        if (patchedUuids.length > 0) {
          summary.patched_this_turn = patchedUuids.slice(0, DELTA_MAX_UUIDS);
        }
        if (layerUpdateUuids.length > 0) {
          summary.layer_updates_this_turn = layerUpdateUuids.slice(
            0,
            DELTA_MAX_UUIDS,
          );
        }
        if (total > DELTA_MAX_UUIDS) {
          summary._note =
            `${total - DELTA_MAX_UUIDS} earlier in-turn mutations omitted; ` +
            `full dashboard_state re-injects on the next user turn.`;
        }

        // Append the delta to the most-recent tool-result message so the
        // LLM sees it in the next inference round.
        const lastIdx = messages.length - 1;
        if (lastIdx < 0 || messages[lastIdx]?.role !== "tool") return;
        try {
          messages[lastIdx].content =
            messages[lastIdx].content +
            `\n\n[in-turn delta]\n${JSON.stringify(summary)}`;
        } catch {
          // If content isn't a string for some reason, skip decoration
          // rather than throwing — the engine's try/catch also guards this.
        }
      },
    }),
    [patchContext],
  );

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
      <Content>
        <Chatbox
          csrfToken={csrf}
          variableInputValues={memoizedVariableInputValues}
          updateVariableInputValues={updateVariableInputValues}
          engineExtensions={engineExtensions}
        />
      </Content>
    </Wrapper>
  );
}

export default memo(ChatSidebar);
