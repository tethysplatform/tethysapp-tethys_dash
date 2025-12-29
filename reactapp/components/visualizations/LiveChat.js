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

// todo: history, when people change name change the chatlog name too, put a loading icon on the send button until successful, if not successful show error (maybe in chatlog?)

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

const LiveChat = ({ requestId, chatHistory }) => {
  const { websocketReady, sendMessage, messagesByRequestId } =
    useContext(WebsocketContext);
  const { user } = useContext(AppContext);
  const [customUsername, setCustomUsername] = useState(user.username || "");
  const [editingUsername, setEditingUsername] = useState(false);
  const [input, setInput] = useState("");
  const messageInputRef = useRef(null);
  const [chatLog, setChatLog] = useState(chatHistory || []);
  const chatLogRef = useRef(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const rateLimitRef = useRef({ count: 0, timer: null, resetAt: null });

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

          // If the sessionId exists in previous messages but with a different sender, update all previous senders for that sessionId
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

  const handleSend = (e) => {
    e.preventDefault();
    // If rate limited, block sending
    if (rateLimited) return;
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
      // Start countdown
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

    const messageObj = {
      requestId: requestId,
      message: input,
      sender: customUsername,
      sessionId,
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
          const isUser = msg.sessionId && msg.sessionId === sessionId;
          return (
            <ChatRow key={idx} isUser={isUser}>
              <ChatBubble isUser={isUser}>
                <span style={{ fontWeight: "bold" }}>
                  {isUser ? "You" : msg.sender}:
                </span>{" "}
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
            rateLimited ||
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
