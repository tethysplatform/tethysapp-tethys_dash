import { useCallback, useState } from "react";
import styled from "styled-components";
import ChatLog from "./ChatLog";
import ChatInputBar from "./ChatInputBar";
import { useChatState } from "./useChatState";
import PropTypes from "prop-types";
import { colors, radii } from "./styles";

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 300px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  overflow: hidden;
  background: ${colors.surface};
`;

const ErrorBar = styled.div`
  padding: 8px 12px;
  background: ${colors.errorBg};
  color: ${colors.errorText};
  border-top: 1px solid ${colors.errorBorder};
  font-size: 0.85rem;
`;

export default function Chatbox({ dashboardId }) {
  const { messages, isLoading, error, send } = useChatState({ dashboardId });
  // Wrapped in an object so picking the same template twice still
  // triggers the input's effect (fresh identity per pick).
  const [draft, setDraft] = useState(null);

  const handleSuggestion = useCallback(
    (text, mode) => {
      if (mode === "prefill") {
        setDraft({ text });
      } else {
        send(text);
      }
    },
    [send],
  );

  return (
    <Container>
      <ChatLog
        messages={messages}
        isLoading={isLoading}
        onSuggestion={handleSuggestion}
      />
      {error && <ErrorBar>{error}</ErrorBar>}
      <ChatInputBar onSend={send} disabled={isLoading} draft={draft} />
    </Container>
  );
}

Chatbox.propTypes = {
  dashboardId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
