import { useCallback, useContext, useEffect, useState } from "react";
import appAPI from "services/api/app";
import { AppContext } from "components/contexts/Contexts";

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

export function useChatState({ dashboardId }) {
  const [messages, setMessages] = useState(() => loadMessages(dashboardId));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { csrf } = useContext(AppContext);

  // Persist on every messages change (dashboardId is read here, so it's a dep).
  useEffect(() => {
    saveMessages(dashboardId, messages);
  }, [messages, dashboardId]);

  const send = useCallback(
    async (prompt) => {
      const text = prompt.trim();
      if (!text || isLoading) return;

      const chatId = crypto.randomUUID();
      const history = messages
        .filter((m) => (m.text ?? "") !== "")
        .slice(-6)
        .map((m) => ({ role: m.role, text: m.text }));

      // Overwrite the in-flight assistant bubble as streamed events arrive.
      const setBubbleText = (newText) =>
        setMessages((m) => {
          const index = m.findIndex((msg) => msg.id === chatId);
          if (index < 0) return m;
          const next = m.slice();
          next[index] = { ...next[index], text: newText };
          return next;
        });

      setError(null);
      setMessages((m) => [
        ...m,
        { role: "user", text, id: crypto.randomUUID() },
        { role: "assistant", text: "", id: chatId },
      ]);
      setIsLoading(true);
      // Accumulates streamed answer tokens; progress milestones show only
      // until the first token arrives, then the answer takes over.
      let answer = "";
      let streaming = false;
      try {
        await appAPI.streamChatBotMessage({
          prompt: text,
          dashboardId,
          chatId,
          history,
          csrf,
          onEvent: (event) => {
            if (event.type === "delta") {
              streaming = true;
              answer += event.text;
              setBubbleText(answer);
            } else if (event.type === "progress") {
              if (!streaming) setBubbleText(event.text);
            } else if (event.type === "done") {
              setBubbleText(event.text || answer);
            } else if (event.type === "error") {
              throw new Error(event.text);
            }
          },
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

  return { messages, isLoading, error, send, clear };
}
