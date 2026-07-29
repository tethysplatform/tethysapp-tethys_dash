import styled from "styled-components";
import PropTypes from "prop-types";
import { colors, focusRing, radii } from "./styles";

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 10px;
  /* center vertically in the empty chat instead of hugging the top */
  margin: auto 0;
`;

const Greeting = styled.div`
  color: ${colors.text};
  font-size: 0.9rem;
  font-weight: 600;
  text-align: center;
`;

// Primary affordance: tapping inserts "/" so the slash-template menu opens
// (same path as typing it), which is the fastest way to add or change a tile.
const SlashCard = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  background: ${colors.accentSoft};
  border: 1px solid ${colors.accentSoftBorder};
  border-radius: ${radii.lg};
  padding: 10px 12px;
  cursor: pointer;
  font: inherit;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
  &:hover {
    border-color: ${colors.accent};
  }
  ${focusRing}
`;

const Kbd = styled.kbd`
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9rem;
  color: ${colors.link};
  background: ${colors.surface};
  border: 1px solid ${colors.accentSoftBorder};
  border-radius: ${radii.sm};
  box-shadow: 0 1px 0 ${colors.accentSoftBorder};
`;

const CardBody = styled.span`
  display: flex;
  flex-direction: column;
`;

const CardText = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: ${colors.text};
`;

const CardSub = styled.span`
  font-size: 0.76rem;
  color: ${colors.textFaint};
  margin-top: 1px;
`;

const OrLine = styled.div`
  color: ${colors.textFaint};
  font-size: 0.78rem;
  text-align: center;
`;

const BetaNote = styled.p`
  color: ${colors.textFaint};
  font-size: 0.72rem;
  text-align: center;
  line-height: 1.4;
  margin: 4px 8px 0;
`;

export default function ChatHints({ onPick }) {
  return (
    <Wrap>
      <Greeting>How can I help with this dashboard?</Greeting>
      <SlashCard type="button" onClick={() => onPick?.("/", "prefill")}>
        <Kbd>/</Kbd>
        <CardBody>
          <CardText>Type / for quick templates</CardText>
          <CardSub>
            add a plugin, change a tile, or list what's available
          </CardSub>
        </CardBody>
      </SlashCard>
      <OrLine>or just ask a question in your own words</OrLine>
      <BetaNote>
        Chat is in beta. It can make mistakes, so review the changes it makes.
      </BetaNote>
    </Wrap>
  );
}

ChatHints.propTypes = {
  onPick: PropTypes.func,
};
