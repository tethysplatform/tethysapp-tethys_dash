import { useCallback, useContext, useEffect, useState } from "react";
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
    window.localStorage.setItem(storageKey(dashboardId), JSON.stringify(clean));
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

export function withLiveProgress(messages, getMessageForRequest) {
  const last = messages[messages.length - 1];
  if (
    !last ||
    last.role !== "assistant" ||
    last.text ||
    !getMessageForRequest
  ) {
    return messages;
  }
  const payload = getMessageForRequest(last.id);
  if (!payload) return messages;
  let parsed;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return messages;
  }
  const text = parsed.message;
  if (parsed.requestId !== last.id || typeof text !== "string" || !text) {
    return messages;
  }
  return [...messages.slice(0, -1), { ...last, text }];
}

export function useChatState({ dashboardId }) {
  const [messages, setMessages] = useState(() => loadMessages(dashboardId));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { csrf } = useContext(AppContext);
  const { getMessageForRequest } = useContext(WebsocketContext) || {};

  // Persist on every messages change (dashboardId is read here, so it's a dep).
  useEffect(() => {
    saveMessages(dashboardId, messages);
  }, [messages, dashboardId]);

  // Live progress is derived during render, not copied into state.
  const displayMessages = withLiveProgress(messages, getMessageForRequest);

  const send = useCallback(
    async (prompt) => {
      const text = prompt.trim();
      if (!text || isLoading) return;

      const chatId = crypto.randomUUID();
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
          if (!last || last.role !== "assistant" || last.id !== chatId)
            return m;
          return [...m.slice(0, -1), { ...last, text: reply }];
        });
        window.dispatchEvent(new Event("tethysdash:agent-dashboard-refetch"));
      } catch (e) {
        setError(e.message);
        setMessages((m) => m.filter((msg) => msg.id !== chatId));
      } finally {
        setIsLoading(false);
      }
    },
    [dashboardId, isLoading, csrf, messages],
  );

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
    clearMessages(dashboardId);
  }, [dashboardId]);

  return { messages: displayMessages, isLoading, error, send, clear };
}
