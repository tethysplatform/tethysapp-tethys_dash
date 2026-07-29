import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import { colors, radii } from "./styles";

const Bar = styled.form`
  display: flex;
  /* pin the button to the bottom instead of stretching it to match
     the auto-growing textarea */
  align-items: flex-end;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid ${colors.border};
  background: ${colors.surfaceMuted};
`;

const Input = styled.textarea`
  flex: 1;
  resize: none;
  min-height: 36px;
  max-height: 120px;
  overflow-y: auto;
  padding: 8px 10px;
  border: 1px solid ${colors.borderStrong};
  border-radius: ${radii.sm};
  font: inherit;
  line-height: 1.4;
  color: ${colors.text};
  background: ${colors.surface};
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  &::placeholder {
    color: ${colors.textFaint};
  }
  &:focus {
    outline: none;
    border-color: ${colors.accent};
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.2);
  }
`;

const SendButton = styled.button`
  height: 36px;
  padding: 0 14px;
  background: ${colors.accent};
  color: ${colors.surface};
  border: none;
  border-radius: ${radii.sm};
  cursor: pointer;
  font-weight: 500;
  transition: background 0.15s ease;
  &:hover:not(:disabled) {
    background: ${colors.accentHover};
  }
  &:active:not(:disabled) {
    background: ${colors.accentActive};
  }
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.4);
  }
  &:disabled {
    background: ${colors.borderStrong};
    cursor: not-allowed;
  }
`;

export default function ChatInputBar({ onSend, disabled, draft }) {
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  // Auto-grow: textareas don't track their content height natively.
  const autoResize = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  // Runs after every render where value changed (typing, prefill,
  // post-send reset) so height always matches content.
  useEffect(() => {
    autoResize();
  }, [value]);

  // Suggestion chips with mode "prefill" (see ChatHints) put a template
  // here for the user to edit before sending - never auto-sent.
  useEffect(() => {
    if (draft?.text) {
      setValue(draft.text);
      inputRef.current?.focus();
    }
  }, [draft]);

  const submit = (e) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSend(value);
    setValue("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(e);
    }
  };

  return (
    <Bar onSubmit={submit}>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a visualization, or list plugins..."
        disabled={disabled}
        rows={1}
      />
      <SendButton type="submit" disabled={disabled || !value.trim()}>
        Send
      </SendButton>
    </Bar>
  );
}

ChatInputBar.propTypes = {
  onSend: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  draft: PropTypes.shape({ text: PropTypes.string }),
};
