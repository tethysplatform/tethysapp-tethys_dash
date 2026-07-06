import { useState } from "react";
import styled from "styled-components";

const Bar = styled.form`
  display: flex;
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
  padding: 8px 10px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font: inherit;
  &:focus {
    outline: none;
    border-color: #4a90e2;
  }
`;

const SendButton = styled.button`
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

export default function ChatInputBar({ onSend, disabled }) {
  const [value, setValue] = useState("");

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
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a visualization…"
        disabled={disabled}
        rows={1}
      />
      <SendButton type="submit" disabled={disabled || !value.trim()}>
        Send
      </SendButton>
    </Bar>
  );
}
