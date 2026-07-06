import { useState } from "react";
import styled from "styled-components";
import Chatbox from "./Chatbox";

const Launcher = styled.button`
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  padding: 10px 18px;
  background: #fff;
  border: 1px solid #ced4da;
  border-radius: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  &:hover { background: #f8f9fa; }
`;

const Panel = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 380px;
  height: 600px;
  max-height: calc(100vh - 40px);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  font-weight: 600;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.4rem;
  color: #495057;
  padding: 0 4px;
  &:hover { color: #212529; }
`;

const Content = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

export default function FloatingChatbox({ dashboardId }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Launcher onClick={() => setOpen(true)} aria-label="Open chat">
        Builder
      </Launcher>
    );
  }

  return (
    <Panel>
      <Header>
        <span>Chat</span>
        <CloseBtn onClick={() => setOpen(false)} aria-label="Close chat">×</CloseBtn>
      </Header>
      <Content>
        <Chatbox dashboardId={dashboardId} />
      </Content>
    </Panel>
  );
}
