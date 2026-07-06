import { useCallback, useState } from "react";
import { sendMessage } from "./chatApi";

export function useChatState({ dashboardId }) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const send = useCallback(async (prompt) => {
    const text = prompt.trim();
    if (!text || isLoading) return;

    setError(null);
    setMessages((m) => [...m, { role: "user", text, id: crypto.randomUUID() }]);
    setIsLoading(true);
    try {
      const { text: reply } = await sendMessage({ prompt: text, dashboardId });
      setMessages((m) => [...m, { role: "assistant", text: reply, id: crypto.randomUUID() }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [dashboardId, isLoading]);

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, send, clear };
}
