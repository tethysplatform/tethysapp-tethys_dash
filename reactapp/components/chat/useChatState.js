import { useCallback, useContext, useEffect, useRef, useState } from "react";
import appAPI from "services/api/app";
import { AppContext } from "components/contexts/Contexts";
import { WebsocketContext } from "components/contexts/WebSocketContext";

const STORAGE_PREFIX = "tethysdash:chat:v1:";

function storageKey(dashboardId) {
  return `${STORAGE_PREFIX}${dashboardId ?? "unknown"}`;
}

function loadMessages(dashboardId) {
  try {
    const raw = window.localStorage.getItem(storageKey(dashboardId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMessages(dashboardId, messages) {
  try {
    // Drop in-flight assistant placeholders (empty text) so a reload
    // during a send doesn't restore a half-finished bubble.
    const clean = messages.filter(
      (m) => !(m.role === "assistant" && (m.text ?? "") === ""),
    );
    window.localStorage.setItem(
      storageKey(dashboardId),
      JSON.stringify(clean),
    );
  } catch {
    /* quota exceeded or storage disabled - silently drop */
  }
}

function clearMessages(dashboardId) {
  try {
    window.localStorage.removeItem(storageKey(dashboardId));
  } catch {
    /* ignore */
  }
}

export function useChatState({ dashboardId }) {
  const [messages, setMessages] = useState(() => loadMessages(dashboardId));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { csrf } = useContext(AppContext);
  const { getMessageForRequest } = useContext(WebsocketContext) || {};
  const activeChatIdRef = useRef(null);

  // Re-load when the dashboard identity changes (defensive - the parent
  // is expected to remount via key={dashboardId}, but if it doesn't, this
  // still keeps history aligned with the current dashboard).
  useEffect(() => {
    setMessages(loadMessages(dashboardId));
  }, [dashboardId]);

  // Persist on every messages change.
  useEffect(() => {
    saveMessages(dashboardId, messages);
  }, [messages, dashboardId]);

  // Latest WS progress payload for the in-flight chat, if any.
  const activeChatId = activeChatIdRef.current;
  const wsPayload =
    activeChatId && getMessageForRequest ? getMessageForRequest(activeChatId) : null;

  useEffect(() => {
    if (!wsPayload || !activeChatId) return;
    let parsed;
    try {
      parsed = JSON.parse(wsPayload);
    } catch {
      return;
    }
    if (parsed.requestId !== activeChatId) return;
    const text = parsed.message;
    if (typeof text !== "string" || !text) return;
    setMessages((m) => {
      const last = m[m.length - 1];
      if (!last || last.role !== "assistant" || last.id !== activeChatId) return m;
      if (last.text === text) return m;
      return [...m.slice(0, -1), { ...last, text }];
    });
  }, [wsPayload, activeChatId]);

  const send = useCallback(
    async (prompt) => {
      const text = prompt.trim();
      if (!text || isLoading) return;

      const chatId = crypto.randomUUID();
      activeChatIdRef.current = chatId;

      // Last few completed turns, so the backend can resolve references
      // like "the same id" against earlier messages. Captured BEFORE the
      // new user message is appended.
      const history = messages
        .filter((m) => (m.text ?? "") !== "")
        .slice(-6)
        .map((m) => ({ role: m.role, text: m.text }));

      setError(null);
      setMessages((m) => [
        ...m,
        { role: "user", text, id: crypto.randomUUID() },
        { role: "assistant", text: "", id: chatId },
      ]);
      setIsLoading(true);
      try {
        const { text: reply } = await appAPI.sendChatBotMessage({
          prompt: text,
          dashboardId,
          chatId,
          history,
          csrf,
        });
        setMessages((m) => {
          const last = m[m.length - 1];
          if (!last || last.role !== "assistant" || last.id !== chatId) return m;
          return [...m.slice(0, -1), { ...last, text: reply }];
        });
        window.dispatchEvent(new Event("tethysdash:agent-dashboard-refetch"));
      } catch (e) {
        setError(e.message);
        // Drop the in-flight assistant placeholder - otherwise the last
        // WebSocket progress marker ("Looking up plugin...") is left
        // standing as if it were a real reply, and persists to
        // localStorage as fake history.
        setMessages((m) => m.filter((msg) => msg.id !== chatId));
      } finally {
        setIsLoading(false);
        activeChatIdRef.current = null;
      }
    },
    [dashboardId, isLoading, csrf, messages],
  );

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
    clearMessages(dashboardId);
  }, [dashboardId]);

  return { messages, isLoading, error, send, clear };
}
