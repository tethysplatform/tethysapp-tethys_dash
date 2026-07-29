import styled from "styled-components";
import PropTypes from "prop-types";
import { colors, focusRing, radii } from "./styles";


const HINTS = [
  {
    title: "List available plugins",
    example: "What plugins are available?",
    mode: "send",
  },
  {
    title: "Add a visualization",
    example: "Add the [plugin name] plugin for [its arguments]",
    note: "tap to prefill, then fill in a plugin from the list above",
    mode: "prefill",
  },
];

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 8px;
  /* center vertically in the empty chat instead of hugging the top */
  margin: auto 0;
`;

const Intro = styled.div`
  color: ${colors.textMuted};
  font-size: 0.85rem;
  text-align: center;
  margin-bottom: 4px;
`;

const Chip = styled.button`
  text-align: left;
  background: ${colors.surfaceMuted};
  border: 1px solid ${colors.border};
  border-radius: ${radii.lg};
  padding: 8px 12px;
  cursor: pointer;
  font: inherit;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
  &:hover {
    background: ${colors.accentSoft};
    border-color: ${colors.accent};
  }
  ${focusRing}
`;

const ChipTitle = styled.div`
  font-size: 0.82rem;
  font-weight: 600;
  color: ${colors.text};
`;

const ChipExample = styled.div`
  font-size: 0.78rem;
  color: ${colors.textFaint};
  margin-top: 2px;
`;

const ChipNote = styled.div`
  font-size: 0.72rem;
  color: ${colors.textFainter};
  margin-top: 2px;
  font-style: italic;
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
      <Intro>Ask about this dashboard, or tap an example to start:</Intro>
      {HINTS.map((h) => (
        <Chip
          key={h.title}
          onClick={() => onPick?.(h.example, h.mode)}
          type="button"
        >
          <ChipTitle>{h.title}</ChipTitle>
          <ChipExample>"{h.example}"</ChipExample>
          {h.note && <ChipNote>{h.note}</ChipNote>}
        </Chip>
      ))}
      <BetaNote>
        Chat is in beta. It can make mistakes, so review the changes it makes.
      </BetaNote>
    </Wrap>
  );
}

ChatHints.propTypes = {
  onPick: PropTypes.func,
};
