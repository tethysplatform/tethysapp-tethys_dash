import { useContext, useState } from "react";
import styled from "styled-components";
import Chatbox from "./Chatbox";
import PropTypes from "prop-types";
import { FaRobot } from "react-icons/fa6";
import { EditingContext, LayoutContext } from "components/contexts/Contexts";
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
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: ${colors.text};
`;

const CloseBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  border-radius: ${radii.sm};
  cursor: pointer;
  font-size: 1.4rem;
  line-height: 1;
  color: ${colors.textMuted};
  transition: background 0.15s ease;
  &:hover {
    background: ${colors.border};
    color: ${colors.text};
  }
  ${focusRing}
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

  return (
    <Panel role="dialog" aria-label="Chat assistant (beta)">
      <Header>
        <Title>
          <FaRobot aria-hidden="true" color={colors.accent} />
          Chat
          <BetaBadge>Beta</BetaBadge>
        </Title>
        <CloseBtn onClick={() => setOpen(false)} aria-label="Close chat">
          ×
        </CloseBtn>
      </Header>
      <Content>
        <Chatbox dashboardId={dashboardId} />
      </Content>
    </Panel>
  );
}

FloatingChatbox.propTypes = {
  dashboardId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
