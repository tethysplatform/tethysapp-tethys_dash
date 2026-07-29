import { renderHook, act } from "@testing-library/react";
import { AppContext } from "components/contexts/Contexts";
import appAPI from "services/api/app";
import { useChatState } from "components/chatbot/useChatState";

jest.mock("services/api/app", () => ({
  __esModule: true,
  default: { streamChatBotMessage: jest.fn() },
}));

const wrapper = ({ children }) => (
  <AppContext.Provider value={{ csrf: "test-csrf" }}>
    {children}
  </AppContext.Provider>
);

const lastAssistant = (messages) =>
  messages.filter((m) => m.role === "assistant").pop();

beforeAll(() => {
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    Object.defineProperty(globalThis, "crypto", {
      value: {
        randomUUID: () => `uuid-${Math.random().toString(16).slice(2)}`,
      },
      configurable: true,
    });
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
});

describe("useChatState streaming send", () => {
  test("streams progress then the final reply into the assistant bubble", async () => {
    appAPI.streamChatBotMessage.mockImplementation(
      async ({ onEvent, csrf }) => {
        expect(csrf).toBe("test-csrf");
        onEvent({ type: "progress", text: "Understanding your request..." });
        onEvent({ type: "done", text: "All set." });
      },
    );

    const { result } = renderHook(() => useChatState({ dashboardId: 7 }), {
      wrapper,
    });
    await act(async () => {
      await result.current.send("add a plugin");
    });

    const messages = result.current.messages;
    expect(messages.find((m) => m.role === "user").text).toBe("add a plugin");
    expect(lastAssistant(messages).text).toBe("All set.");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test("appends delta tokens into the assistant bubble", async () => {
    appAPI.streamChatBotMessage.mockImplementation(async ({ onEvent }) => {
      onEvent({ type: "progress", text: "Thinking..." });
      onEvent({ type: "delta", text: "Hel" });
      onEvent({ type: "delta", text: "lo!" });
      onEvent({ type: "done", text: "Hello!" });
    });

    const { result } = renderHook(() => useChatState({ dashboardId: 7 }), {
      wrapper,
    });
    await act(async () => {
      await result.current.send("hi");
    });

    expect(lastAssistant(result.current.messages).text).toBe("Hello!");
    expect(result.current.error).toBeNull();
  });

  test("surfaces an error event and drops the assistant placeholder", async () => {
    appAPI.streamChatBotMessage.mockImplementation(async ({ onEvent }) => {
      onEvent({ type: "error", text: "backend boom" });
    });

    const { result } = renderHook(() => useChatState({ dashboardId: 7 }), {
      wrapper,
    });
    await act(async () => {
      await result.current.send("do it");
    });

    expect(result.current.error).toBe("backend boom");
    expect(result.current.messages.some((m) => m.role === "assistant")).toBe(
      false,
    );
  });

  test("refetches the dashboard only when the done event is flagged changed", async () => {
    const refetch = jest.fn();
    window.addEventListener("tethysdash:agent-dashboard-refetch", refetch);
    try {
      appAPI.streamChatBotMessage.mockImplementation(async ({ onEvent }) => {
        onEvent({ type: "done", text: "Added the map.", changed: true });
      });
      const { result } = renderHook(() => useChatState({ dashboardId: 7 }), {
        wrapper,
      });
      await act(async () => {
        await result.current.send("add the map");
      });
      expect(refetch).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("tethysdash:agent-dashboard-refetch", refetch);
    }
  });

  test("does not refetch when the agent changed nothing (plain Q&A)", async () => {
    const refetch = jest.fn();
    window.addEventListener("tethysdash:agent-dashboard-refetch", refetch);
    try {
      appAPI.streamChatBotMessage.mockImplementation(async ({ onEvent }) => {
        onEvent({
          type: "done",
          text: "Bolivia is in South America.",
          changed: false,
        });
      });
      const { result } = renderHook(() => useChatState({ dashboardId: 7 }), {
        wrapper,
      });
      await act(async () => {
        await result.current.send("where is Bolivia?");
      });
      expect(refetch).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("tethysdash:agent-dashboard-refetch", refetch);
    }
  });

  test("does not refetch when done omits the changed flag", async () => {
    const refetch = jest.fn();
    window.addEventListener("tethysdash:agent-dashboard-refetch", refetch);
    try {
      appAPI.streamChatBotMessage.mockImplementation(async ({ onEvent }) => {
        onEvent({ type: "done", text: "Here is some help." });
      });
      const { result } = renderHook(() => useChatState({ dashboardId: 7 }), {
        wrapper,
      });
      await act(async () => {
        await result.current.send("how does this work?");
      });
      expect(refetch).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("tethysdash:agent-dashboard-refetch", refetch);
    }
  });

  test("ignores empty prompts", async () => {
    const { result } = renderHook(() => useChatState({ dashboardId: 7 }), {
      wrapper,
    });
    await act(async () => {
      await result.current.send("   ");
    });
    expect(appAPI.streamChatBotMessage).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });
});
