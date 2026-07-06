import { useEffect, useRef } from "react";
import styled from "styled-components";
import ChatMessage from "./ChatMessage";

const Log = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: #fff;
  display: flex;
  flex-direction: column;
`;

const Placeholder = styled.div`
  color: #868e96;
  font-size: 0.85rem;
  padding: 12px;
  text-align: center;
`;

const Thinking = styled.div`
  color: #868e96;
  font-size: 0.85rem;
  padding: 4px 8px;
  font-style: italic;
`;

export default function ChatLog({ messages, isLoading }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <Log>
      {messages.length === 0 && !isLoading && (
        <Placeholder>Ask me to add a visualization to your dashboard.</Placeholder>
      )}
      {messages.map((m) => (
        <ChatMessage key={m.id} role={m.role} text={m.text} />
      ))}
      {isLoading && <Thinking>Thinking…</Thinking>}
      <div ref={bottomRef} />
    </Log>
  );
}
