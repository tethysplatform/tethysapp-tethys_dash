import styled from "styled-components";

const Row = styled.div`
  display: flex;
  justify-content: ${(p) => (p.$role === "user" ? "flex-end" : "flex-start")};
  padding: 4px 0;
`;

const Bubble = styled.div`
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.4;
  font-size: 0.9rem;
  background: ${(p) => (p.$role === "user" ? "#4a90e2" : "#f1f3f5")};
  color: ${(p) => (p.$role === "user" ? "#fff" : "#212529")};
`;

export default function ChatMessage({ role, text }) {
  return (
    <Row $role={role}>
      <Bubble $role={role}>{text}</Bubble>
    </Row>
  );
}
