import { useEffect, useRef } from "react";
import styled from "styled-components";
import ChatMessage from "./ChatMessage";
import ChatHints from "./ChatHints";
import PropTypes from "prop-types";
import { colors, TypingDots } from "./styles";

const Log = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: ${colors.surface};
  display: flex;
  flex-direction: column;
`;

const Thinking = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: ${colors.textFaint};
  font-size: 0.85rem;
  padding: 4px 8px;
`;

export default function ChatLog({ messages, isLoading, onSuggestion }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <Log role="log" aria-live="polite" aria-label="Conversation">
      {messages.length === 0 && !isLoading && (
        <ChatHints onPick={onSuggestion} />
      )}
      {messages.map((m) => (
        <ChatMessage key={m.id} role={m.role} text={m.text} />
      ))}
      {isLoading && (
        <Thinking>
          Thinking
          <TypingDots />
        </Thinking>
      )}
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
