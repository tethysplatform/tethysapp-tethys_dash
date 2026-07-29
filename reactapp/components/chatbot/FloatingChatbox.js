import { useContext, useState } from "react";
import styled from "styled-components";
import Chatbox from "./Chatbox";
import PropTypes from "prop-types";
import { FaRobot, FaBroom } from "react-icons/fa6";
import { EditingContext, LayoutContext } from "components/contexts/Contexts";
import { useChatState } from "./useChatState";
import { useChatModel } from "./useChatModel";
import { BetaBadge, colors, focusRing, radii } from "./styles";

const Launcher = styled.button`
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  padding: 10px 16px;
  background: ${colors.surface};
  border: 1px solid ${colors.borderStrong};
  border-radius: ${radii.pill};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: ${colors.text};
  transition:
    background 0.15s ease,
    box-shadow 0.15s ease;
  &:hover {
    background: ${colors.surfaceMuted};
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
  }
  ${focusRing}
`;

const LauncherIcon = styled(FaRobot)`
  color: ${colors.accent};
  font-size: 1.05rem;
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
  background: ${colors.surface};
  border-radius: ${radii.lg};
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: ${colors.surfaceMuted};
  border-bottom: 1px solid ${colors.border};
`;

const Title = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: ${colors.text};
`;

const ModelLine = styled.div`
  padding-left: 24px;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.68rem;
  color: ${colors.textFaint};
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
`;

const IconBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  border-radius: ${radii.sm};
  cursor: pointer;
  line-height: 1;
  color: ${colors.textMuted};
  transition: background 0.15s ease;
  &:hover:not(:disabled) {
    background: ${colors.border};
    color: ${colors.text};
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  ${focusRing}
`;

const CloseBtn = styled(IconBtn)`
  font-size: 1.4rem;
`;

const ConfirmBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 14px;
  background: ${colors.errorBg};
  border-bottom: 1px solid ${colors.errorBorder};
  font-size: 0.82rem;
  color: ${colors.text};
`;

const ConfirmActions = styled.div`
  display: flex;
  gap: 6px;
`;

const GhostBtn = styled.button`
  padding: 4px 10px;
  font: inherit;
  font-size: 0.8rem;
  background: none;
  border: 1px solid ${colors.borderStrong};
  border-radius: ${radii.sm};
  color: ${colors.textMuted};
  cursor: pointer;
  &:hover {
    background: ${colors.surface};
  }
  ${focusRing}
`;

const DangerBtn = styled(GhostBtn)`
  border-color: ${colors.errorBorder};
  background: ${colors.errorText};
  color: ${colors.surface};
  &:hover {
    background: #b02525;
  }
`;

const Content = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

export default function FloatingChatbox({ dashboardId }) {
  const { editable, chatVisible } = useContext(LayoutContext) || {};
  const { isEditing } = useContext(EditingContext) || {};
  const [open, setOpen] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const { messages, isLoading, error, send, clear } = useChatState({
    dashboardId,
  });
  const model = useChatModel();

  if (!editable || !isEditing || !chatVisible) {
    return null;
  }

  if (!open) {
    return (
      <Launcher onClick={() => setOpen(true)} aria-label="Open chat assistant (beta)">
        <LauncherIcon aria-hidden="true" />
        Chat
        <BetaBadge>Beta</BetaBadge>
      </Launcher>
    );
  }

  const confirmClear = () => {
    clear();
    setConfirmingClear(false);
  };

  return (
    <Panel role="dialog" aria-label="Chat assistant (beta)">
      <Header>
        <Title>
          <TitleRow>
            <FaRobot aria-hidden="true" color={colors.accent} />
            Chat
            <BetaBadge>Beta</BetaBadge>
          </TitleRow>
          {model && <ModelLine title="Chat model">{model}</ModelLine>}
        </Title>
        <Actions>
          {messages.length > 0 && (
            <IconBtn
              onClick={() => setConfirmingClear(true)}
              aria-label="Clear conversation"
              title="Clear conversation"
            >
              <FaBroom aria-hidden="true" style={{ fontSize: "1rem" }} />
            </IconBtn>
          )}
          <CloseBtn onClick={() => setOpen(false)} aria-label="Close chat">
            ×
          </CloseBtn>
        </Actions>
      </Header>
      {confirmingClear && (
        <ConfirmBar role="alertdialog" aria-label="Clear conversation">
          <span>Clear this conversation?</span>
          <ConfirmActions>
            <GhostBtn type="button" onClick={() => setConfirmingClear(false)}>
              Cancel
            </GhostBtn>
            <DangerBtn type="button" onClick={confirmClear}>
              Clear
            </DangerBtn>
          </ConfirmActions>
        </ConfirmBar>
      )}
      <Content>
        <Chatbox
          messages={messages}
          isLoading={isLoading}
          error={error}
          send={send}
        />
      </Content>
    </Panel>
  );
}

FloatingChatbox.propTypes = {
  dashboardId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
