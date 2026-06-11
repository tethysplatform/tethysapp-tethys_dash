import { useState, useContext, useCallback, useRef, useEffect } from "react";
import { AppContext, LayoutContext } from "components/contexts/Contexts";
import appAPI from "services/api/app";

import "./SimpleAgentChat.scss";

const DASHBOARD_REFETCH_EVENT = "tethysdash:agent-dashboard-refetch";

const SimpleAgentChat = () => {
  const { csrf } = useContext(AppContext) ?? {};
  const layoutContext = useContext(LayoutContext) ?? {};
  const dashboardId = layoutContext.id ?? null;

  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]); // [{role, text}]
  const [pending, setPending] = useState(false);
  const transcriptRef = useRef(null);

  // Auto-scroll the transcript on new messages.
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages, pending]);

  const send = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || pending) return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setDraft("");
    setPending(true);

    try {
      const response = await appAPI.chatAgent(trimmed, dashboardId, csrf);
      if (response?.success) {
        setMessages((prev) => [
          ...prev,
          { role: "agent", text: response.response ?? "(no response)" },
        ]);
        // Tools may have added dashboard tiles server-side. Tell the
        // DashboardLoader to refetch so they appear without a full reload.
        if (response.dashboard_id_used !== null) {
          window.dispatchEvent(new CustomEvent(DASHBOARD_REFETCH_EVENT));
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "error",
            text: response?.message ?? "Agent request failed.",
          },
        ]);
      }
    } catch (err) {
      const detail =
        err?.response?.data?.message ?? err?.message ?? "Network error.";
      setMessages((prev) => [...prev, { role: "error", text: detail }]);
    } finally {
      setPending(false);
    }
  }, [draft, dashboardId, csrf, pending]);

  const onKeyDown = (e) => {
    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        className="simple-agent-chat-toggle"
        onClick={() => setIsOpen(true)}
        title="Open chat with the dashboard agent"
      >
        💬 Agent
      </button>
    );
  }

  return (
    <div className="simple-agent-chat-panel">
      <header className="simple-agent-chat-header">
        <span>Dashboard Agent</span>
        <button
          type="button"
          className="simple-agent-chat-close"
          aria-label="Close agent chat"
          onClick={() => setIsOpen(false)}
        >
          ×
        </button>
      </header>

      <div ref={transcriptRef} className="simple-agent-chat-transcript">
        {messages.length === 0 && !pending && (
          <p className="simple-agent-chat-hint">
            Ask for a visualization. Try:&nbsp;
            <em>"add a GEOGloWS forecast for river 610217883"</em>.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`simple-agent-chat-msg simple-agent-chat-msg-${msg.role}`}
          >
            <strong>{msg.role === "user" ? "You" : msg.role === "agent" ? "Agent" : "Error"}:</strong>{" "}
            <span>{msg.text}</span>
          </div>
        ))}
        {pending && (
          <div className="simple-agent-chat-msg simple-agent-chat-msg-agent">
            <em>Agent is thinking…</em>
          </div>
        )}
      </div>

      <div className="simple-agent-chat-input">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message and press Enter…"
          rows={2}
          disabled={pending}
        />
        <button
          type="button"
          onClick={send}
          disabled={pending || !draft.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export { DASHBOARD_REFETCH_EVENT };
export default SimpleAgentChat;
