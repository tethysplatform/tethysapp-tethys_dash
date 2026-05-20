/**
 * ChatSidebar.clear.test.js — wiring coverage for the host-side `/clear`
 * integration.
 *
 * Verifies:
 *   - <Chatbox> receives an `onClear` callback prop
 *   - Invoking that callback calls `clearChatHistory(dashboardUuid)` so
 *     the per-dashboard localStorage entry is wiped in lockstep with
 *     chatbox-core's IndexedDB clear
 *   - Fallback to `"no-dashboard"` when LayoutContext has no uuid
 *   - `clearChatHistory` is NOT called on mount — only when the
 *     callback fires (so a mount alone does not destroy state)
 *
 * Mirrors ChatSidebar.persistence.test.js setup: stubs <Chatbox>, mocks
 * the chatHistoryStorage service so calls are observable, captures
 * props via `Chatbox.mock.calls` rather than a closure (jest.clearAllMocks
 * resets call history but not implementations set via the factory).
 */
import { render } from "@testing-library/react";
import ChatSidebar from "components/sidebar/ChatSidebar";
import {
  AppContext,
  LayoutContext,
  TabContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import { ChatSidebarContext } from "components/contexts/ChatSidebarContext";

jest.mock("@chatbox/core/components", () => ({
  Chatbox: jest.fn(() => <div data-testid="chatbox-stub" />),
}));
jest.mock("services/chatHistoryStorage", () => ({
  getChatHistory: jest.fn(() => []),
  saveChatHistory: jest.fn(),
  clearChatHistory: jest.fn(),
}));

import { Chatbox } from "@chatbox/core/components";
import { clearChatHistory } from "services/chatHistoryStorage";

beforeEach(() => {
  jest.clearAllMocks();
});

function lastChatboxProps() {
  const calls = Chatbox.mock.calls;
  if (calls.length === 0) return null;
  return calls[calls.length - 1][0];
}

function renderWithContexts(opts = {}) {
  const editable = "editable" in opts ? opts.editable : true;
  const dashboardUuid =
    "dashboardUuid" in opts ? opts.dashboardUuid : "dash-1";
  const layout = { editable, uuid: dashboardUuid };
  const tab = { tabs: [] };
  const variables = {
    variableInputValues: {},
    setVariableInputValues: () => {},
  };
  const chatSidebar = { isOpen: true, setIsOpen: () => {} };
  const app = { csrf: "csrf-token", pluginEditablePaths: {} };
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

describe("ChatSidebar — /clear wiring", () => {
  it("passes an onClear callback to <Chatbox>", () => {
    renderWithContexts();
    const props = lastChatboxProps();
    expect(props).toBeTruthy();
    expect(typeof props.onClear).toBe("function");
  });

  it("invoking onClear calls clearChatHistory with the active dashboardUuid", () => {
    renderWithContexts({ dashboardUuid: "dash-42" });
    const props = lastChatboxProps();
    expect(clearChatHistory).not.toHaveBeenCalled();
    props.onClear();
    expect(clearChatHistory).toHaveBeenCalledTimes(1);
    expect(clearChatHistory).toHaveBeenCalledWith("dash-42");
  });

  it("falls back to 'no-dashboard' when LayoutContext has no uuid", () => {
    renderWithContexts({ dashboardUuid: undefined });
    const props = lastChatboxProps();
    expect(typeof props.onClear).toBe("function");
    props.onClear();
    expect(clearChatHistory).toHaveBeenCalledWith("no-dashboard");
  });

  it("does NOT call clearChatHistory on mount alone", () => {
    renderWithContexts({ dashboardUuid: "dash-99" });
    expect(clearChatHistory).not.toHaveBeenCalled();
  });

  it("conversationId prop matches the onClear argument (lockstep contract)", () => {
    // The conversationId chatbox-core uses for its IndexedDB cache must
    // match the localStorage key segment the host wipes on /clear, or
    // the two stores drift apart.
    renderWithContexts({ dashboardUuid: "dash-lockstep" });
    const props = lastChatboxProps();
    expect(props.conversationId).toBe("dash-lockstep");
    props.onClear();
    expect(clearChatHistory).toHaveBeenCalledWith("dash-lockstep");
  });
});
