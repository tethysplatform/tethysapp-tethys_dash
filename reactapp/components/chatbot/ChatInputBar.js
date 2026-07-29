import { useContext, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import { FaArrowUp } from "react-icons/fa6";
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
  padding: 8px 12px 10px;
  border-top: 1px solid ${colors.border};
  background: ${colors.surfaceMuted};
`;

/* One rounded composer holds the textarea and the send action; the border and
   focus ring live here (focus-within) so the whole box reads as a single field
   the way Linear / Notion / ChatGPT composers do. */
const Composer = styled.div`
  display: flex;
  /* pin the send button to the bottom as the textarea grows upward */
  align-items: flex-end;
  gap: 6px;
  padding: 6px 6px 6px 12px;
  background: ${colors.surface};
  border: 1px solid ${colors.borderStrong};
  border-radius: ${radii.lg};
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  &:focus-within {
    border-color: ${colors.accent};
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.2);
  }
`;

const Input = styled.textarea`
  flex: 1;
  resize: none;
  min-height: 30px;
  max-height: 120px;
  overflow-y: auto;
  padding: 5px 0;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  line-height: 1.4;
  color: ${colors.text};
  &::placeholder {
    color: ${colors.textFaint};
  }
`;

/* Compact circular send. Icon-only is the familiar chat affordance and frees
   width in the 380px panel; the accessible name lives on aria-label. */
const SendButton = styled.button`
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: ${colors.accent};
  color: ${colors.surface};
  border: none;
  border-radius: ${radii.pill};
  cursor: pointer;
  font-size: 0.8rem;
  transition:
    background 0.15s ease,
    transform 0.1s ease;
  &:hover:not(:disabled) {
    background: ${colors.accentHover};
  }
  &:active:not(:disabled) {
    background: ${colors.accentActive};
    transform: scale(0.94);
  }
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.4);
  }
  &:disabled {
    background: ${colors.borderStrong};
    color: ${colors.surfaceMuted};
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
      <Composer>
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
        <SendButton
          type="submit"
          disabled={disabled || !value.trim()}
          aria-label="Send message"
          title="Send"
        >
          <FaArrowUp aria-hidden="true" />
        </SendButton>
      </Composer>
    </Bar>
  );
}

ChatInputBar.propTypes = {
  onSend: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  draft: PropTypes.shape({ text: PropTypes.string }),
};
