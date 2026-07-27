import styled from "styled-components";
import PropTypes from "prop-types";

// Keep in sync with the router's capabilities
// (tethysapp/tethysdash/chat/agents/router.py ROUTER_CANDIDATES):
// docs Q&A, add a visualization (owner only), list plugins.
//
// mode "send"    - tapping fires the example immediately (safe: read-only)
// mode "prefill" - tapping puts a template in the input for the user to
//                  edit first (the add action writes to the dashboard, and
//                  the installed plugins vary per deployment - never fire
//                  a canned add)
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
  color: #495057;
  font-size: 0.85rem;
  text-align: center;
  margin-bottom: 4px;
`;

const Chip = styled.button`
  text-align: left;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
  font: inherit;
  &:hover {
    background: #eef4fc;
    border-color: #4a90e2;
  }
`;

const ChipTitle = styled.div`
  font-size: 0.82rem;
  font-weight: 600;
  color: #343a40;
`;

const ChipExample = styled.div`
  font-size: 0.78rem;
  color: #868e96;
  margin-top: 2px;
`;

const ChipNote = styled.div`
  font-size: 0.72rem;
  color: #adb5bd;
  margin-top: 2px;
  font-style: italic;
`;

export default function ChatHints({ onPick }) {
  return (
    <Wrap>
      <Intro>I can help with three things - tap one to try it:</Intro>
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
    </Wrap>
  );
}

ChatHints.propTypes = {
  onPick: PropTypes.func,
};
