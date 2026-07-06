import styled from "styled-components";
import ChatLog from "./ChatLog";
import ChatInputBar from "./ChatInputBar";
import { useChatState } from "./useChatState";

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 300px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
`;

const ErrorBar = styled.div`
  padding: 8px 12px;
  background: #fff5f5;
  color: #c92a2a;
  border-top: 1px solid #ffc9c9;
  font-size: 0.85rem;
`;

export default function Chatbox({ dashboardId }) {
  const { messages, isLoading, error, send } = useChatState({ dashboardId });

  return (
    <Container>
      <ChatLog messages={messages} isLoading={isLoading} />
      {error && <ErrorBar>{error}</ErrorBar>}
      <ChatInputBar onSend={send} disabled={isLoading} />
    </Container>
  );
}
