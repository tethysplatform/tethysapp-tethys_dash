import { memo, useCallback, useContext, useMemo } from "react";
import styled from "styled-components";
import {
  AppContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import { ChatSidebarContext } from "components/contexts/ChatSidebarContext";
import { Chatbox } from "@chatbox/core/components";
import { BsXLg } from "react-icons/bs";

const SIDEBAR_WIDTH = 360;

const Wrapper = styled.div`
  width: ${(props) => (props.$isOpen ? `${SIDEBAR_WIDTH}px` : "0px")};
  min-width: ${(props) => (props.$isOpen ? `${SIDEBAR_WIDTH}px` : "0px")};
  overflow: hidden;
  transition: width 0.3s ease, min-width 0.3s ease;
  border-left: ${(props) => (props.$isOpen ? "1px solid #ddd" : "none")};
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  position: relative;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  background: #f8f9fa;
  flex-shrink: 0;
  min-width: ${SIDEBAR_WIDTH}px;
`;

const Title = styled.span`
  font-weight: 600;
  font-size: 0.9rem;
  color: #333;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #666;
  display: flex;
  align-items: center;
  &:hover {
    color: #333;
  }
`;

const Content = styled.div`
  flex: 1;
  overflow: hidden;
  min-width: ${SIDEBAR_WIDTH}px;
  height: 0;
`;

function ChatSidebar() {
  const { isOpen, setIsOpen } = useContext(ChatSidebarContext);
  const { tethysApp, csrf } = useContext(AppContext);
  const { variableInputValues, setVariableInputValues } =
    useContext(VariableInputsContext);

  const chatboxConfig = tethysApp?.chatboxConfig;

  const updateVariableInputValues = useCallback(
    (updatedValues) =>
      setVariableInputValues((prev) => ({ ...prev, ...updatedValues })),
    [setVariableInputValues],
  );

  const memoizedVariableInputValues = useMemo(
    () => variableInputValues,
    [variableInputValues],
  );

  // Sidebar renders even without chatboxConfig — users add MCP servers via the panel.
  // LLM provider config is managed via localStorage (LLMProviderPanel in chatbox).
  return (
    <Wrapper $isOpen={isOpen}>
      <Header>
        <Title>Chat</Title>
        <CloseButton onClick={() => setIsOpen(false)} aria-label="Close chat">
          <BsXLg size={14} />
        </CloseButton>
      </Header>
      <Content>
        <Chatbox
          csrfToken={csrf}
          variableInputValues={memoizedVariableInputValues}
          updateVariableInputValues={updateVariableInputValues}
        />
      </Content>
    </Wrapper>
  );
}

export default memo(ChatSidebar);
