import { useEffect, useRef, useState } from "react";
import styled from "styled-components";

const Bar = styled.form`
  display: flex;
  /* pin the button to the bottom instead of stretching it to match
     the auto-growing textarea */
  align-items: flex-end;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid #dee2e6;
  background: #f8f9fa;
`;

const Input = styled.textarea`
  flex: 1;
  resize: none;
  min-height: 36px;
  max-height: 120px;
  overflow-y: auto;
  padding: 8px 10px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font: inherit;
  line-height: 1.4;
  &:focus {
    outline: none;
    border-color: #4a90e2;
  }
`;

const SendButton = styled.button`
  height: 36px;
  padding: 0 14px;
  background: #4a90e2;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  &:disabled {
    background: #ced4da;
    cursor: not-allowed;
  }
`;

export default function ChatInputBar({ onSend, disabled, draft }) {
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  // Auto-grow: textareas don't track their content height natively.
  // Collapse to auto first so the height also SHRINKS when lines are
  // deleted; the CSS max-height caps growth and switches to scrolling.
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
        placeholder="Ask the docs, add a visualization, or list plugins..."
        disabled={disabled}
        rows={1}
      />
      <SendButton type="submit" disabled={disabled || !value.trim()}>
        Send
      </SendButton>
    </Bar>
  );
}
