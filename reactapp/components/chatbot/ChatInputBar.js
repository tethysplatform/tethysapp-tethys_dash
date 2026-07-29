import { useContext, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import { TabContext } from "components/contexts/Contexts";
import { colors, radii } from "./styles";
import SlashMenu from "./SlashMenu";
import { usePluginCatalog } from "./usePluginCatalog";
import {
  SLASH_TRIGGER,
  buildSlashItems,
  caretForInsert,
  filterSlashItems,
} from "./slashTemplates";

const Bar = styled.form`
  position: relative;
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

const LIST_ID = "chat-slash-menu";

export default function ChatInputBar({ onSend, disabled, draft }) {
  const [value, setValue] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [pendingCaret, setPendingCaret] = useState(null);
  const inputRef = useRef(null);

  const catalog = usePluginCatalog();
  const tabCtx = useContext(TabContext);
  const getActiveTab = tabCtx?.getActiveTab;
  const tiles = useMemo(
    () => getActiveTab?.()?.gridItems || [],
    [getActiveTab],
  );

  const items = useMemo(
    () => buildSlashItems({ catalog, tiles }),
    [catalog, tiles],
  );
  const isSlash = value.startsWith(SLASH_TRIGGER);
  const filtered = useMemo(
    () => (isSlash ? filterSlashItems(items, value.slice(1)) : []),
    [isSlash, items, value],
  );
  const menuOpen = isSlash && !dismissed && filtered.length > 0;

  // Auto-grow the textarea, and apply a queued caret position after a template
  // insert (textareas don't track content height or caret across a value swap).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    if (pendingCaret != null) {
      el.focus();
      el.setSelectionRange(pendingCaret, pendingCaret);
      setPendingCaret(null);
    }
  }, [value, pendingCaret]);

  // Keep the highlighted option in range as the filtered list changes.
  useEffect(() => {
    setHighlight(0);
  }, [value]);

  // Suggestion chips with mode "prefill" (see ChatHints) put a template
  // here for the user to edit before sending - never auto-sent.
  useEffect(() => {
    if (draft?.text) {
      setValue(draft.text);
      inputRef.current?.focus();
    }
  }, [draft]);

  const selectItem = (item) => {
    if (!item) return;
    setValue(item.insert);
    setPendingCaret(caretForInsert(item.insert));
    setDismissed(true);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSend(value);
    setValue("");
    setDismissed(false);
  };

  const handleKeyDown = (e) => {
    if (menuOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        selectItem(filtered[highlight]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissed(true);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(e);
    }
  };

  return (
    <Bar onSubmit={submit}>
      {menuOpen && (
        <SlashMenu
          items={filtered}
          highlight={highlight}
          onSelect={selectItem}
          onHighlight={setHighlight}
          listId={LIST_ID}
        />
      )}
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setDismissed(false);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Message, or type / for templates..."
        disabled={disabled}
        rows={1}
        role="combobox"
        aria-expanded={menuOpen}
        aria-controls={LIST_ID}
        aria-autocomplete="list"
        aria-activedescendant={
          menuOpen ? `${LIST_ID}-opt-${highlight}` : undefined
        }
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
