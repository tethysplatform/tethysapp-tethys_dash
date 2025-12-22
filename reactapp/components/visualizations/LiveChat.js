import { useContext, useState, useRef, useEffect, Fragment } from "react";
import PropTypes from "prop-types";
import { AppContext } from "components/contexts/Contexts";
import { WebsocketContext } from "components/contexts/WebSocketContext";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";

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

const ChatRow = styled.div`
  display: flex;
  justify-content: ${(props) => (props.isUser ? "flex-end" : "flex-start")};
  margin-bottom: 4px;
`;

const ChatBubble = styled.div`
  background: ${(props) => (props.isUser ? "#e3f2fd" : "#f1f1f1")};
  color: #222;
  border-radius: 16px;
  padding: 8px 14px;
  max-width: 75%;
  font-size: 15px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  align-self: ${(props) => (props.isUser ? "flex-end" : "flex-start")};
`;

const UsernameButton = styled.button`
  padding: 8px 12px;
  border-radius: 8px;
  background: #eee;
  color: #1976d2;
  border: 1px solid #1976d2;
  font-size: 20px;
  cursor: pointer;
  margin-left: 0;
  margin-right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SendButton = styled.button`
  padding: 8px 12px;
  border-radius: 8px;
  background: #1976d2;
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const UsernameInput = styled.input`
  flex: 1;
  min-height: 32px;
  font-size: 16px;
  border-radius: 6px;
  border: 1px solid #ccc;
  padding: 8px 12px;
`;

const MessageTextarea = styled.textarea`
  flex: 1;
  resize: none;
  min-height: 32px;
  max-height: 80px;
`;

// TODO: add uuid to new, imported, and copied grid item, update new uuid to grid item uuid where requestId is used, history
const LiveChat = ({ requestId }) => {
  const { websocketReady, sendMessage, messagesByRequestId } =
    useContext(WebsocketContext);
  const { user } = useContext(AppContext);
  // Allow user to define username if not set
  const [customUsername, setCustomUsername] = useState(user.username || "");
  const [editingUsername, setEditingUsername] = useState(false);
  // Generate a unique session ID for this chat instance
  const sessionIdRef = useRef(uuidv4());
  const [input, setInput] = useState("");
  const messageInputRef = useRef(null);
  const [chatLog, setChatLog] = useState([]);
  const chatLogRef = useRef(null);

  // Listen for new messages for this requestId
  useEffect(() => {
    if (!requestId) return;
    const messageData = messagesByRequestId[requestId];
    if (messageData) {
      try {
        const parsed = JSON.parse(messageData);
        setChatLog((prev) => {
          const last = prev[prev.length - 1];
          const isDuplicate =
            last &&
            last.sender === parsed.sender &&
            last.text === parsed.message &&
            last.sessionId === parsed.sessionId;
          if (isDuplicate) return prev;
          return [
            ...prev,
            {
              sender: parsed.sender,
              text: parsed.message,
              sessionId: parsed.sessionId,
            },
          ];
        });
      } catch (e) {
        // ignore parse errors
      }
    }
  }, [messagesByRequestId]);

  // Only scroll to bottom if user is already at (or near) the bottom
  useEffect(() => {
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
    // If username is not set, treat input as username entry
    if (!customUsername) {
      if (!input.trim()) return;
      setCustomUsername(input.trim());
      setInput("");
      return;
    }
    // If editing username, update and exit editing mode
    if (editingUsername) {
      if (!input.trim()) return;
      setCustomUsername(input.trim());
      setEditingUsername(false);
      setInput("");
      return;
    }
    if (!input.trim() || !websocketReady) return;

    const messageObj = {
      requestId: requestId,
      message: input,
      sender: customUsername,
      sessionId: sessionIdRef.current,
    };
    sendMessage && sendMessage(JSON.stringify(messageObj));
    setInput("");
  };

  // Autofocus message input when username is set or updated
  useEffect(() => {
    if (customUsername && !editingUsername && messageInputRef.current) {
      messageInputRef.current.focus();
    }
  }, [customUsername, editingUsername]);

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
          const isUser =
            msg.sessionId && msg.sessionId === sessionIdRef.current;
          return (
            <ChatRow key={idx} isUser={isUser}>
              <ChatBubble isUser={isUser}>
                <span style={{ fontWeight: "bold" }}>
                  {isUser ? "You" : msg.sender}:
                </span>{" "}
                {msg.text.split("\n").map((line, i) => (
                  <Fragment key={i}>
                    {i > 0 && <br />}
                    {line}
                  </Fragment>
                ))}
              </ChatBubble>
            </ChatRow>
          );
        })}
      </ChatLogArea>
      <form
        onSubmit={handleSend}
        style={{ display: "flex", gap: 8, alignItems: "center" }}
      >
        {/* If username is set, show update username button to the left of input */}
        {customUsername && !editingUsername && (
          <UsernameButton
            type="button"
            onClick={() => {
              setEditingUsername(true);
              setInput(customUsername);
            }}
            title="Change Username"
            aria-label="Change Username"
          >
            <span role="img" aria-label="profile">
              &#128100;
            </span>
          </UsernameButton>
        )}
        {/* If username is not set, use input for username entry */}
        {!customUsername || editingUsername ? (
          <UsernameInput
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Enter your username..."
            maxLength={32}
            autoFocus
            disabled={false}
          />
        ) : (
          <MessageTextarea
            ref={messageInputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={websocketReady ? "Type a message..." : "Connecting..."}
            disabled={!websocketReady || !customUsername}
          />
        )}
        <SendButton
          type="submit"
          disabled={
            (!customUsername && !input.trim()) ||
            (customUsername &&
              !editingUsername &&
              (!websocketReady || !input.trim()))
          }
          aria-label={
            !customUsername || editingUsername ? "Set Username" : "Send"
          }
        >
          {!customUsername || editingUsername ? (
            "Set Username"
          ) : (
            <span role="img" aria-label="send">
              &#10148;
            </span>
          )}
        </SendButton>
      </form>
    </PaddedContainer>
  );
};

LiveChat.propTypes = {
  requestId: PropTypes.string,
};

export default LiveChat;
