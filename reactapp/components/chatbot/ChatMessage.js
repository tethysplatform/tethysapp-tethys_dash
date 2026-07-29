import styled from "styled-components";
import Markdown from "markdown-to-jsx";
import PropTypes from "prop-types";
import { colors, radii } from "./styles";

const Row = styled.div`
  display: flex;
  justify-content: ${(p) => (p.$role === "user" ? "flex-end" : "flex-start")};
  padding: 4px 0;
`;

const Bubble = styled.div`
  max-width: 80%;
  padding: 8px 12px;
  border-radius: ${radii.lg};
  word-wrap: break-word;
  line-height: 1.4;
  font-size: 0.9rem;
  background: ${(p) => (p.$role === "user" ? colors.accent : colors.bubbleAssistant)};
  color: ${(p) => (p.$role === "user" ? colors.surface : colors.text)};
  border: 1px solid
    ${(p) => (p.$role === "user" ? "transparent" : colors.border)};
  white-space: ${(p) => (p.$role === "user" ? "pre-wrap" : "normal")};

  & > *:first-child {
    margin-top: 0;
  }
  & > *:last-child {
    margin-bottom: 0;
  }
  ul,
  ol {
    padding-left: 1.25em;
    margin: 0.35em 0;
  }
  code {
    background: rgba(0, 0, 0, 0.06);
    padding: 0 4px;
    border-radius: 4px;
    font-size: 0.85em;
  }
  p {
    margin: 0.35em 0;
  }
  /* LLM answers arrive with arbitrary heading levels - render them at
     chat-bubble scale instead of page scale. */
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-weight: 600;
    line-height: 1.3;
    margin: 0.6em 0 0.25em;
  }
  h1 {
    font-size: 1.05rem;
  }
  h2 {
    font-size: 1rem;
  }
  h3,
  h4,
  h5,
  h6 {
    font-size: 0.95rem;
  }
  li {
    margin: 0.15em 0;
  }
  a {
    color: ${colors.link};
    word-break: break-all;
  }
`;

export default function ChatMessage({ role, text }) {
  return (
    <Row $role={role}>
      <Bubble $role={role}>
        {role === "assistant" ? <Markdown>{text || ""}</Markdown> : text}
      </Bubble>
    </Row>
  );
}

ChatMessage.propTypes = {
  role: PropTypes.string.isRequired,
  text: PropTypes.string,
};
