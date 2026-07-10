import { useEffect, useRef } from "react";
import styled from "styled-components";
import ChatMessage from "./ChatMessage";
import ChatHints from "./ChatHints";
import PropTypes from "prop-types";

const Log = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: #fff;
  display: flex;
  flex-direction: column;
`;

const Thinking = styled.div`
  color: #868e96;
  font-size: 0.85rem;
  padding: 4px 8px;
  font-style: italic;
`;

export default function ChatLog({ messages, isLoading, onSuggestion }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <Log>
      {messages.length === 0 && !isLoading && (
        <ChatHints onPick={onSuggestion} />
      )}
      {messages.map((m) => (
        <ChatMessage key={m.id} role={m.role} text={m.text} />
      ))}
      {isLoading && <Thinking>Thinking...</Thinking>}
      <div ref={bottomRef} />
    </Log>
  );
}

ChatLog.propTypes = {
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      role: PropTypes.string,
      text: PropTypes.string,
    }),
  ).isRequired,
  isLoading: PropTypes.bool,
  onSuggestion: PropTypes.func,
};
