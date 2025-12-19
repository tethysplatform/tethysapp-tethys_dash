import React, { useContext, useState } from "react";
import { AppContext } from "components/contexts/Contexts";
import { WebsocketContext } from "components/contexts/WebSocketContext";
import styled from "styled-components";

const PaddedContainer = styled.div`
  padding: 16px;
  display: flex;
  height: 100%;
  flex-direction: column;
`;

const ChatLogArea = styled.div`
  flex: 1 1 0%;
  overflow-y: auto;
  margin-bottom: 8px;
`;

const Chatbox = ({ requestId }) => {
  const { websocketReady, sendMessage, messagesByRequestId } =
    useContext(WebsocketContext);
  const { user } = useContext(AppContext);
  const [input, setInput] = useState("");
  const [chatLog, setChatLog] = useState([]);
  const chatLogRef = React.useRef(null);

  // Listen for new messages for this requestId
  React.useEffect(() => {
    if (!requestId) return;
    const messageData = messagesByRequestId[requestId];
    if (messageData) {
      try {
        const parsed = JSON.parse(messageData);
        // Ignore rebroadcasted messages from self
        if (parsed.sender === user.username) return;
        setChatLog((prev) => [
          ...prev,
          { sender: parsed.sender, text: parsed.message },
        ]);
      } catch (e) {
        // ignore parse errors
      }
    }
  }, [messagesByRequestId]);

  // Only scroll to bottom if user is already at (or near) the bottom
  React.useEffect(() => {
    const el = chatLogRef.current;
    if (el) {
      // How far from the bottom is considered "at bottom" (px)
      const threshold = 100;
      const isAtBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      if (isAtBottom) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [chatLog]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || !websocketReady) return;

    const messageObj = {
      requestId: requestId,
      message: input,
      sender: user.username,
    };
    sendMessage && sendMessage(JSON.stringify(messageObj));
    setChatLog((prev) => [...prev, { sender: user.username, text: input }]);
    setInput("");
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      handleSend(e);
    }
    // If Shift+Enter, allow default (new line)
  };

  return (
    <PaddedContainer>
      <ChatLogArea ref={chatLogRef}>
        {chatLog.map((msg, idx) => {
          const isUser = msg.sender === user.username;
          return (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: isUser ? "flex-end" : "flex-start",
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  background: isUser ? "#e3f2fd" : "#f1f1f1",
                  color: "#222",
                  borderRadius: 16,
                  padding: "8px 14px",
                  maxWidth: "75%",
                  fontSize: 15,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  alignSelf: isUser ? "flex-end" : "flex-start",
                }}
              >
                <span style={{ fontWeight: "bold" }}>
                  {isUser ? "You" : msg.sender}:
                </span>{" "}
                {msg.text.split("\n").map((line, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <br />}
                    {line}
                  </React.Fragment>
                ))}
              </div>
            </div>
          );
        })}
      </ChatLogArea>
      <form onSubmit={handleSend} style={{ display: "flex", gap: 8 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={websocketReady ? "Type a message..." : "Connecting..."}
          disabled={!websocketReady}
          style={{ flex: 1, resize: "none", minHeight: 32, maxHeight: 80 }}
        />
        <button type="submit" disabled={!websocketReady || !input.trim()}>
          Send
        </button>
      </form>
    </PaddedContainer>
  );
};

export default Chatbox;
