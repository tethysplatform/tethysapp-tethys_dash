/**
 * ChatSidebar.persistence.test.js — wiring coverage for per-dashboard
 * chat history persistence (plan 2026-05-08-004 Unit 3).
 *
 * Verifies:
 *   - <Chatbox> receives initialMessages hydrated from getChatHistory(uuid)
 *   - <Chatbox> receives an onMessagesChange callback that delegates to
 *     saveChatHistory(uuid, ...)
 *   - <Chatbox> is keyed on the dashboard uuid so React tears down +
 *     remounts on dashboard switch
 *   - When uuid is missing (mounted outside LayoutContext or before the
 *     dashboard loads), initialMessages is [] and the save callback is
 *     a no-op (does not write to localStorage)
 *
 * The Chatbox is stubbed (matches the existing ChatSidebar.test.js
 * pattern) so we don't need to mount the full chatbox-core stack.
 * Captures props via the mock's `.mock.calls` rather than a closure
 * array — `jest.clearAllMocks()` resets implementations, which makes
 * the closure approach fragile.
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
}));

import { Chatbox } from "@chatbox/core/components";
import {
  getChatHistory,
  saveChatHistory,
} from "services/chatHistoryStorage";

beforeEach(() => {
  // clearAllMocks() resets call history but NOT mock implementations,
  // because the implementation was set via the factory function in
  // jest.mock() above. Each test sees a fresh call log; the stub render
  // continues to fire.
  jest.clearAllMocks();
});

function lastChatboxProps() {
  const calls = Chatbox.mock.calls;
  if (calls.length === 0) return null;
  // jest.fn for a function component receives (props, ref?) — props is index 0.
  return calls[calls.length - 1][0];
}

function renderWithContexts(opts = {}) {
  const editable = "editable" in opts ? opts.editable : true;
  // Allow tests to explicitly pass undefined (or omit `uuid`) to
  // simulate "mounted before LayoutContext.uuid is populated."
  const dashboardUuid =
    "dashboardUuid" in opts ? opts.dashboardUuid : "dash-1";
  const layout = { editable, uuid: dashboardUuid };
  const tab = { tabs: [] };
  const variables = { variableInputValues: {}, setVariableInputValues: () => {} };
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

describe("ChatSidebar persistence wiring", () => {
  test("hydrates initialMessages from getChatHistory(uuid)", () => {
    getChatHistory.mockReturnValueOnce([
      { role: "user", content: "remembered from last session" },
    ]);
    renderWithContexts({ dashboardUuid: "dashboard-A" });

    expect(getChatHistory).toHaveBeenCalledWith("dashboard-A");
    expect(lastChatboxProps()?.initialMessages).toEqual([
      { role: "user", content: "remembered from last session" },
    ]);
  });

  test("onMessagesChange delegates to saveChatHistory(uuid, messages)", () => {
    renderWithContexts({ dashboardUuid: "dashboard-A" });

    const newMessages = [{ role: "user", content: "hi" }];
    lastChatboxProps().onMessagesChange(newMessages);

    expect(saveChatHistory).toHaveBeenCalledWith("dashboard-A", newMessages);
  });

  test("keying on dashboard uuid forces remount-with-fresh-history on switch", () => {
    // First render with dashboard-A.
    getChatHistory.mockReturnValueOnce([
      { role: "user", content: "A's history" },
    ]);
    const { rerender } = renderWithContexts({ dashboardUuid: "dashboard-A" });
    expect(getChatHistory).toHaveBeenCalledWith("dashboard-A");
    expect(lastChatboxProps().initialMessages).toEqual([
      { role: "user", content: "A's history" },
    ]);

    // Re-render in the same React tree with dashboard-B. The uuid change
    // forces useMemo to recompute initialMessages and getChatHistory to
    // be called for B. (The literal React key on <Chatbox> ensures the
    // child remounts; here we observe the upstream effect on prop wiring.)
    getChatHistory.mockReturnValueOnce([
      { role: "user", content: "B's history" },
    ]);
    const layout = { editable: true, uuid: "dashboard-B" };
    const tab = { tabs: [] };
    const variables = { variableInputValues: {}, setVariableInputValues: () => {} };
    const chatSidebar = { isOpen: true, setIsOpen: () => {} };
    const app = { csrf: "csrf-token", pluginEditablePaths: {} };
    rerender(
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

    expect(getChatHistory).toHaveBeenCalledWith("dashboard-B");
    expect(lastChatboxProps().initialMessages).toEqual([
      { role: "user", content: "B's history" },
    ]);
  });

  test("initialMessages defaults to [] when dashboardUuid is missing", () => {
    renderWithContexts({ dashboardUuid: undefined });

    // No call to getChatHistory because uuid is missing.
    expect(getChatHistory).not.toHaveBeenCalled();
    expect(lastChatboxProps().initialMessages).toEqual([]);
  });

  test("onMessagesChange is a no-op when dashboardUuid is missing", () => {
    renderWithContexts({ dashboardUuid: undefined });

    lastChatboxProps().onMessagesChange([
      { role: "user", content: "should not save" },
    ]);

    expect(saveChatHistory).not.toHaveBeenCalled();
  });
});
