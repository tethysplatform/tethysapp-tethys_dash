/**
 * R11 / Unit B0 — chatbox permission gate.
 *
 * Pins that `<ChatSidebar />` renders only when the current dashboard's
 * permission is editor/admin (`editable === true`). Viewers and the
 * not-yet-loaded state produce no DOM. Mirrors the edit-modal's
 * visibility — the chatbox is an editor tool.
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

// The Chatbox itself connects to an MCP server and owns heavy state — stub
// it out so this gate test doesn't need full chat infrastructure.
jest.mock("@chatbox/core/components", () => ({
  Chatbox: () => <div data-testid="chatbox-stub" />,
}));

function renderWithContexts({ editable }) {
  const layout = { editable };
  const tab = { tabs: [] };
  const variables = { variableInputValues: {}, setVariableInputValues: () => {} };
  const chatSidebar = { isOpen: true, setIsOpen: () => {} };
  const app = { csrf: "csrf-token" };
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
