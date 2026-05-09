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
// it out so this gate test doesn't need full chat infrastructure.
jest.mock("@chatbox/core/components", () => ({
  Chatbox: () => <div data-testid="chatbox-stub" />,
}));

function renderWithContexts({ editable, pluginEditablePaths = {} }) {
  const layout = { editable };
  const tab = { tabs: [] };
  const variables = { variableInputValues: {}, setVariableInputValues: () => {} };
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
