import { useContext, useState, useRef, useEffect, Fragment, memo } from "react";
import PropTypes from "prop-types";
import { AppContext } from "components/contexts/Contexts";
import { WebsocketContext } from "components/contexts/WebSocketContext";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";
import { valuesEqual } from "components/modals/utilities";

const PaddedContainer = styled.div`
  padding: 16px;
  display: flex;
  height: 100%;
  /* The padding has to come out of the grid item's height rather than add to
     it, or the input row below the log is pushed past the bottom of the tile. */
  box-sizing: border-box;
  flex-direction: column;
`;

const ChatLogArea = styled.div`
  flex: 1 1 0%;
  /* A flex item's automatic minimum size is its content size, so without this
     the log refuses to shrink below the full height of the message list: it
     grows instead of scrolling, pushing the input row out of the grid item and
     down the page (and leaving the messages above the fold). min-height: 0 lets
     it shrink so overflow-y actually scrolls inside the tile. */
  min-height: 0;
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
  padding-right: ${(props) => (props.isUser ? "28px" : "14px")};
  max-width: 75%;
  font-size: 15px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  align-self: ${(props) => (props.isUser ? "flex-end" : "flex-start")};
  margin-top: 2px;
  position: relative;
`;

const EditButton = styled.button`
  background: none;
  border: none;
  color: #1976d2;
  cursor: pointer;
  font-size: 16px;
  margin-left: 8px;
  margin-top: 2px;
  padding: 0;
  display: none;
  position: absolute;
  top: 6px;
  right: 8px;

  ${ChatBubble}:hover & {
    display: block;
  }
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

// todo: api hit 3 times on load

function getOrCreateSessionId(sessionIdKey) {
  let sid = null;
  try {
    sid = window.localStorage.getItem(sessionIdKey);
  } catch (e) {
    /* no-op */
  }
  if (!sid) {
    sid = uuidv4();
    try {
      window.localStorage.setItem(sessionIdKey, sid);
    } catch (e) {
      /* no-op */
    }
  }
  return sid;
}

function getOrCreateUsername(usernameKey, fallbackUsername) {
  let cached = "";
  try {
    cached = window.localStorage.getItem(usernameKey) || "";
  } catch (e) {
    /* no-op */
  }
  return cached || fallbackUsername || "";
}

export const ChatMessage = ({
  msg,
  sessionId,
  requestId,
  messageId,
  setPendingMessageId,
  pendingMessageId,
}) => {
  const { sendMessage } = useContext(WebsocketContext);
  const [editInput, setEditInput] = useState(msg.message);
  const [isEditing, setIsEditing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState("");

  const isUser = msg.sessionId && msg.sessionId === sessionId;
  let timestamp = format(new Date(msg.timestamp), "MMM dd, hh:mm a");

  // Exit edit mode when edit is confirmed (pendingMessageId matches this messageId and message has been updated)
  useEffect(() => {
    if (isEditing && messageId === pendingMessageId) {
      setIsEditing(false);
      setUpdating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessageId]);

  const handleEditClick = (msg) => {
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
  };

  const handleEditSave = async () => {
    setUpdating(true);
    setUpdateError("");
    const editObj = {
      requestId,
      message: editInput,
      sender: msg.sender,
      sessionId,
      messageId,
    };
    setPendingMessageId(messageId);
    try {
      await Promise.resolve(
        sendMessage && sendMessage(JSON.stringify(editObj)),
      );
      // updating will be reset when edit is confirmed and isEditing is set to false
    } catch (e) {
      setUpdateError("Failed to update message. Please try again.");
      setUpdating(false);
      setPendingMessageId(null);
    }
  };

  return (
    <ChatRow isUser={isUser}>
      <ChatMetaRow isUser={isUser}>
        {!isUser && <ChatMetaName>{msg.sender}</ChatMetaName>}
        <ChatMetaText>
          {timestamp}
          {msg.edited ? " - Edited" : ""}
        </ChatMetaText>
      </ChatMetaRow>
      <ChatBubble isUser={isUser}>
        {isEditing ? (
          <>
            <MessageTextarea
              value={editInput}
              onChange={(e) => setEditInput(e.target.value)}
              style={{ marginBottom: 4 }}
              autoFocus
            />
            <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
              {updateError && (
                <div
                  style={{ color: "#d32f2f", marginBottom: 4, fontSize: 13 }}
                >
                  {updateError}
                </div>
              )}
              {updating ? (
                <Spinner aria-label="Loading" />
              ) : (
                <SendButton
                  aria-label="Save Button"
                  type="button"
                  onClick={handleEditSave}
                  disabled={!editInput.trim()}
                  style={{ minWidth: 32, fontSize: 14 }}
                >
                  Save
                </SendButton>
              )}
              <SendButton
                type="button"
                onClick={handleEditCancel}
                style={{
                  background: "#eee",
                  color: "#1976d2",
                  minWidth: 32,
                  fontSize: 14,
                }}
              >
                Cancel
              </SendButton>
            </div>
          </>
        ) : (
          <>
            {msg.message.split("\n").map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {line}
              </Fragment>
            ))}
            {isUser && (
              <EditButton
                type="button"
                title="Edit message"
                aria-label="Edit message"
                onClick={handleEditClick}
              >
                &#9998;
              </EditButton>
            )}
          </>
        )}
      </ChatBubble>
    </ChatRow>
  );
};

const LiveChat = ({ requestId, chatHistory }) => {
  const {
    websocketReady,
    sendMessage,
    messagesByRequestId,
    errorMessagesByRequestId,
  } = useContext(WebsocketContext);
  const { user } = useContext(AppContext);
  const usernameKey = `livechat_username_${requestId}`;
  // Initialize customUsername from localStorage if available, else from user.username
  const [customUsername, setCustomUsername] = useState(() =>
    getOrCreateUsername(usernameKey, user.username),
  );
  const [editingUsername, setEditingUsername] = useState(
    customUsername ? false : true,
  );
  const [input, setInput] = useState("");
  const messageInputRef = useRef(null);
  const usernameInputRef = useRef(null);
  const hasMountedRef = useRef(false);
  const [chatLog, setChatLog] = useState(chatHistory ?? []);
  const chatLogRef = useRef(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const rateLimitRef = useRef({ count: 0, timer: null, resetAt: null });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [pendingMessageId, setPendingMessageId] = useState(null);

  const sessionIdKey = `livechat_sessionid_${requestId}`;
  const sessionId = getOrCreateSessionId(sessionIdKey);

  // getVisualization hands down a fresh chatHistory on every re-fetch (refresh
  // interval, manual retry, arg change). useState reads its argument only on
  // mount, so without this the log would stay frozen on whatever history it
  // mounted with. Messages that arrived over the websocket after the server
  // took its snapshot are carried over rather than dropped.
  useEffect(() => {
    const history = chatHistory ?? [];
    setChatLog((prev) => {
      if (valuesEqual(prev, history)) return prev;
      const historyIds = new Set(history.map((msg) => msg.messageId));
      const liveOnly = prev.filter((msg) => !historyIds.has(msg.messageId));
      return [...history, ...liveOnly];
    });
  }, [chatHistory]);

  // Listen for new successful messages for this requestId
  useEffect(() => {
    const messageData = messagesByRequestId[requestId];
    if (messageData) {
      try {
        const parsed = JSON.parse(messageData);

        // Handle rebroadcasted message with messageId
        if (parsed.messageId && parsed.messageId === pendingMessageId) {
          setSending(false);
          setSendError("");
          setInput("");
          setPendingMessageId(null);
        }

        setChatLog((prev) => {
          // If a message with the same messageId exists, update its message and edited fields
          const msgIdx = prev.findIndex(
            (msg) =>
              msg.messageId &&
              parsed.messageId &&
              msg.messageId === parsed.messageId,
          );
          if (msgIdx !== -1) {
            // Update the message and edited fields, keep other fields the same
            return prev.map((msg, idx) =>
              idx === msgIdx
                ? {
                    ...msg,
                    message: parsed.message,
                    edited: true,
                    timestamp: parsed.timestamp,
                  }
                : msg,
            );
          }

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
                : msg,
            );
          }
          return [
            ...updatedLog,
            {
              sender: parsed.sender,
              message: parsed.message,
              sessionId: parsed.sessionId,
              timestamp: parsed.timestamp,
              messageId: parsed.messageId,
              edited: parsed.edited,
            },
          ];
        });
      } catch (e) {
        // ignore parse errors
      }
    }
  }, [messagesByRequestId, requestId, sessionId, pendingMessageId]);

  // Listen for error messages for this requestId
  useEffect(() => {
    const errorData = errorMessagesByRequestId[requestId];
    if (errorData) {
      try {
        const parsed = JSON.parse(errorData);
        if (
          parsed.error &&
          parsed.messageId &&
          parsed.messageId === pendingMessageId
        ) {
          setSendError(parsed.error);
          setSending(false);
          setPendingMessageId(null);
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  }, [errorMessagesByRequestId, requestId, pendingMessageId]);

  // Scroll to bottom on chatLog update, or on initial load if chatHistory exists
  useEffect(() => {
    const el = chatLogRef.current;

    // If this is the initial load and chatHistory exists, always scroll to bottom
    if (
      chatHistory &&
      chatHistory.length > 0 &&
      chatLog.length === chatHistory.length
    ) {
      el.scrollTop = el.scrollHeight;
      return;
    }
    // Otherwise, only scroll if user is already at (or near) the bottom
    const threshold = 100;
    const isAtBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    // istanbul ignore next
    if (isAtBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [chatLog, chatHistory]);

  const handleSend = async (e) => {
    e.preventDefault();
    setSendError("");

    if (editingUsername) {
      if (!input.trim()) return;
      setCustomUsername(input.trim());
      try {
        window.localStorage.setItem(usernameKey, input.trim());
      } catch (e) {
        /* no-op */
      }
      setEditingUsername(false);
      setInput("");
      return;
    }

    // Prevent sending duplicate message (same sender, message, sessionId as latest message from this user)
    const latestUserMsg = [...chatLog]
      .reverse()
      .find(
        (msg) => msg.sender === customUsername && msg.sessionId === sessionId,
      );
    if (latestUserMsg && latestUserMsg.message === input) {
      setSendError(
        "Duplicate message detected. Please send a different message.",
      );
      return;
    }

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
    const messageId = uuidv4();
    setPendingMessageId(messageId);
    const messageObj = {
      requestId: requestId,
      message: input,
      sender: customUsername,
      sessionId,
      messageId,
    };
    try {
      await Promise.resolve(
        sendMessage && sendMessage(JSON.stringify(messageObj)),
      );
    } catch (e) {
      setSendError("Failed to send message. Please try again.");
      setSending(false);
      setPendingMessageId(null);
    }
  };

  // Move focus to whichever input just became active when the username is set
  // or updated. Skipped on the initial mount, and focused with preventScroll:
  // focusing an element scrolls its scrollable ancestors to reveal it, so an
  // on-load focus drags the dashboard page down to this widget and hides
  // everything above it -- including this chat's own message history.
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    const activeInput =
      !customUsername || editingUsername
        ? usernameInputRef.current
        : messageInputRef.current;
    if (activeInput) {
      activeInput.focus({ preventScroll: true });
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
        {chatLog.map((msg, idx) => (
          <ChatMessage
            key={msg.messageId}
            msg={msg}
            sessionId={sessionId}
            requestId={requestId}
            messageId={msg.messageId}
            setPendingMessageId={setPendingMessageId}
            pendingMessageId={pendingMessageId}
          />
        ))}
      </ChatLogArea>
      {rateLimited && (
        <div style={{ color: "#d32f2f", marginBottom: 8, textAlign: "center" }}>
          You are sending messages too quickly. Please wait {rateLimitCountdown}{" "}
          second{rateLimitCountdown !== 1 ? "s" : ""} before sending more
          messages.
        </div>
      )}
      {sendError && (
        <div style={{ color: "#d32f2f", marginBottom: 8, textAlign: "center" }}>
          {sendError}
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
            ref={usernameInputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Enter your username..."
            maxLength={32}
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

ChatMessage.propTypes = {
  msg: PropTypes.shape({
    message: PropTypes.string.isRequired,
    sessionId: PropTypes.string,
    sender: PropTypes.string,
    timestamp: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    messageId: PropTypes.string,
    edited: PropTypes.bool,
  }).isRequired,
  sessionId: PropTypes.string.isRequired,
  requestId: PropTypes.string,
  messageId: PropTypes.string,
  setPendingMessageId: PropTypes.func.isRequired,
  pendingMessageId: PropTypes.string,
};

LiveChat.propTypes = {
  requestId: PropTypes.string,
  chatHistory: PropTypes.arrayOf(
    PropTypes.shape({
      message: PropTypes.string.isRequired,
      sessionId: PropTypes.string,
      sender: PropTypes.string,
      timestamp: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      messageId: PropTypes.string,
      edited: PropTypes.bool,
    }),
  ),
};

export default memo(LiveChat, valuesEqual);
