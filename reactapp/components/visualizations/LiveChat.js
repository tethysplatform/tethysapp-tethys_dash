import { useContext, useState, useRef, useEffect, Fragment } from "react";
import PropTypes from "prop-types";
import { AppContext } from "components/contexts/Contexts";
import { WebsocketContext } from "components/contexts/WebSocketContext";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";

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
  flex-direction: column;
  align-items: ${(props) => (props.isUser ? "flex-end" : "flex-start")};
  margin-bottom: 12px;
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
  margin-top: 2px;
`;

const ChatMetaRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: ${(props) => (props.isUser ? "flex-end" : "flex-start")};
  gap: 8px;
  margin-bottom: 2px;
  max-width: 75%;
`;

const ChatMetaText = styled.span`
  font-size: 12px;
  color: #888;
`;

const ChatMetaName = styled.span`
  font-size: 12px;
  color: #1976d2;
  font-weight: bold;
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
  min-width: 44px;
  min-height: 36px;
  position: relative;
  transition:
    background 0.2s,
    color 0.2s;
  &:disabled {
    background: #b0b8c1;
    color: #e0e0e0;
    cursor: not-allowed;
    opacity: 1;
  }
`;

const Spinner = styled.div`
  border: 2px solid #fff;
  border-top: 2px solid #1976d2;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  animation: spin 0.8s linear infinite;
  margin: 0 2px;
  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
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

// todo: put a loading icon on the send button until successful, if not successful show error (maybe in chatlog?), auto scroll to bottom on history, delete chat messages when grid items changes

function getOrCreateSessionId(sessionIdKey) {
  let sid = null;
  try {
    sid = window.localStorage.getItem(sessionIdKey);
  } catch (e) {
    // Ignore localStorage errors (e.g., private mode)
  }
  if (!sid) {
    sid = uuidv4();
    try {
      window.localStorage.setItem(sessionIdKey, sid);
    } catch (e) {
      // Ignore localStorage errors (e.g., private mode)
    }
  }
  return sid;
}

function getOrCreateUsername(usernameKey, fallbackUsername = "") {
  let cached = "";
  try {
    cached = window.localStorage.getItem(usernameKey) || "";
  } catch (e) {}
  return cached || fallbackUsername || "";
}

const LiveChat = ({ requestId, chatHistory }) => {
  const { websocketReady, sendMessage, messagesByRequestId } =
    useContext(WebsocketContext);
  const { user } = useContext(AppContext);
  const usernameKey = `livechat_username_${requestId || "default"}`;
  // Initialize customUsername from localStorage if available, else from user.username
  const [customUsername, setCustomUsername] = useState(() =>
    getOrCreateUsername(usernameKey, user.username)
  );
  const [editingUsername, setEditingUsername] = useState(false);
  const [input, setInput] = useState("");
  const messageInputRef = useRef(null);
  const [chatLog, setChatLog] = useState(chatHistory || []);
  const chatLogRef = useRef(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const rateLimitRef = useRef({ count: 0, timer: null, resetAt: null });
  const [sending, setSending] = useState(false);

  const sessionIdKey = `livechat_sessionid_${requestId || "default"}`;
  const sessionId = getOrCreateSessionId(sessionIdKey);

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
            last.message === parsed.message &&
            last.sessionId === parsed.sessionId;
          if (isDuplicate) return prev;

          let needsUpdate = false;
          for (const msg of prev) {
            if (
              msg.sessionId === parsed.sessionId &&
              msg.sender !== parsed.sender
            ) {
              needsUpdate = true;
              break;
            }
          }
          let updatedLog = prev;
          if (needsUpdate) {
            updatedLog = prev.map((msg) =>
              msg.sessionId === parsed.sessionId
                ? { ...msg, sender: parsed.sender }
                : msg
            );
          }
          return [
            ...updatedLog,
            {
              sender: parsed.sender,
              message: parsed.message,
              sessionId: parsed.sessionId,
              timestamp: parsed.timestamp,
            },
          ];
        });
      } catch (e) {
        // ignore parse errors
      }
    }
  }, [messagesByRequestId, requestId]);

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

  const handleSend = async (e) => {
    e.preventDefault();
    if (rateLimited || sending) return;
    if (!customUsername) {
      if (!input.trim()) return;
      setCustomUsername(input.trim());
      try {
        window.localStorage.setItem(usernameKey, input.trim());
      } catch (e) {}
      setInput("");
      return;
    }
    if (editingUsername) {
      if (!input.trim()) return;
      setCustomUsername(input.trim());
      try {
        window.localStorage.setItem(usernameKey, input.trim());
      } catch (e) {}
      setEditingUsername(false);
      setInput("");
      return;
    }
    if (!input.trim() || !websocketReady) return;

    // Rate limiting logic (client-side, matches server: 5 messages per 10s)
    const now = Date.now();
    if (!rateLimitRef.current.resetAt || now > rateLimitRef.current.resetAt) {
      rateLimitRef.current.count = 0;
      rateLimitRef.current.resetAt = now + 10000;
    }
    rateLimitRef.current.count += 1;
    if (rateLimitRef.current.count > 5) {
      setRateLimited(true);
      const msLeft = rateLimitRef.current.resetAt - now;
      setRateLimitCountdown(Math.ceil(msLeft / 1000));
      if (rateLimitRef.current.timer) clearInterval(rateLimitRef.current.timer);
      rateLimitRef.current.timer = setInterval(() => {
        setRateLimitCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(rateLimitRef.current.timer);
            setRateLimited(false);
            rateLimitRef.current.count = 0;
            rateLimitRef.current.resetAt = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return;
    }

    setSending(true);
    const messageObj = {
      requestId: requestId,
      message: input,
      sender: customUsername,
      sessionId,
    };
    try {
      await Promise.resolve(
        sendMessage && sendMessage(JSON.stringify(messageObj))
      );
    } catch (e) {
      // Optionally show error
    }
    setInput("");
    // Wait for message to appear in chatLog (optimistic: short delay fallback)
    setTimeout(() => setSending(false), 500);
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
          const isUser = msg.sessionId && msg.sessionId === sessionId;
          // Always use msg.timestamp if available, else fallback to now (for legacy messages)
          let timestamp = format(new Date(msg.timestamp), "MMM dd, hh:mm a");
          console.log(timestamp, msg.timestamp);

          return (
            <ChatRow key={idx} isUser={isUser}>
              <ChatMetaRow isUser={isUser}>
                {!isUser && <ChatMetaName>{msg.sender}</ChatMetaName>}
                <ChatMetaText>{timestamp}</ChatMetaText>
              </ChatMetaRow>
              <ChatBubble isUser={isUser}>
                {msg.message.split("\n").map((line, i) => (
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
      {rateLimited && (
        <div style={{ color: "#d32f2f", marginBottom: 8, textAlign: "center" }}>
          You are sending messages too quickly. Please wait {rateLimitCountdown}{" "}
          second{rateLimitCountdown !== 1 ? "s" : ""} before sending more
          messages.
        </div>
      )}
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
            disabled={!websocketReady || !customUsername || rateLimited}
          />
        )}
        <SendButton
          type="submit"
          disabled={
            sending ||
            rateLimited ||
            (!customUsername && !input.trim()) ||
            (customUsername &&
              !editingUsername &&
              (!websocketReady || !input.trim()))
          }
          aria-label={
            !customUsername || editingUsername
              ? "Set Username"
              : sending
                ? "Sending"
                : "Send"
          }
          tabIndex={sending ? -1 : 0}
        >
          {sending ? (
            <Spinner aria-label="Loading" />
          ) : !customUsername || editingUsername ? (
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
