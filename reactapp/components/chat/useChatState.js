import { useCallback, useState, useContext } from "react";
import appAPI from "services/api/app";
import { AppContext } from "components/contexts/Contexts";

export function useChatState({ dashboardId }) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { csrf } = useContext(AppContext);
  
  const send = useCallback(async (prompt) => {
    const text = prompt.trim();
    if (!text || isLoading) return;

    setError(null);
    setMessages((m) => [...m, { role: "user", text, id: crypto.randomUUID() }]);
    setIsLoading(true);
    try {
      const { text: reply } = await appAPI.sendChatBotMessage({ prompt: text, dashboardId, csrf });
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
