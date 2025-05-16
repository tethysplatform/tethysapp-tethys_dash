import { useCallback, useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";
import { Color } from "@tiptap/extension-color";
import ListItem from "@tiptap/extension-list-item";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextStyle from "@tiptap/extension-text-style";
import Text from "@tiptap/extension-text";
import FontFamily from "@tiptap/extension-font-family";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import TextAlign from "@tiptap/extension-text-align";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import styled from "styled-components";
import {
  LuBold,
  LuItalic,
  LuStrikethrough,
  LuCode,
  LuCodeXml,
  LuUnderline,
  LuHighlighter,
  LuSuperscript,
  LuSubscript,
  LuBaseline,
  LuAlignLeft,
  LuAlignJustify,
  LuAlignRight,
  LuUndo,
  LuRedo,
  LuEraser,
  LuList,
  LuListOrdered,
  LuMessageSquareQuote,
  LuMinus,
  LuSeparatorHorizontal,
} from "react-icons/lu";
import ButtonGroup from "react-bootstrap/ButtonGroup";
import Overlay from "react-bootstrap/Overlay";
import Popover from "react-bootstrap/Popover";
import "components/inputs/TextEditor.css";

const MenuButton = styled.button`
  font-size: 0.875rem;
  font-weight: 500;
  font-feature-settings:
    "salt" on,
    "cv01" on;
  line-height: 1.15;
  height: 2rem;
  min-width: 2rem;
  border: none;
  padding: 0.5rem;
  gap: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--tt-radius-lg, 0.75rem);
  transition-property: background, color, opacity;
  transition-duration: var(--tt-transition-duration-default);
  transition-timing-function: var(--tt-transition-easing-default);
  background-color: transparent;

  &:hover {
    background-color: rgb(156, 156, 156);
  }

  &.is-active {
    background-color: rgb(90, 90, 90);
    color: white;
    font-weight: bold;
  }
`;

const ColorGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.5rem;
`;

const ColorCircleButton = styled.button`
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: none;
  background-color: #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  padding: 0;

  &:hover {
    background-color: rgb(156, 156, 156);
  }

  &.is-active {
    background-color: rgb(90, 90, 90);
    color: white;
    font-weight: bold;
  }
`;

const ColorCircle = styled.div`
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  flex-shrink: 0;
  flex-grow: 0;
  box-sizing: border-box;
  margin: 0;

  background-color: ${(props) => props.bgColor};
`;

const ButtonBar = styled.div`
  margin-bottom: 10px;
`;

const FONT_OPTIONS = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Helvetica", value: "Helvetica, sans-serif" },
  { label: "Times New Roman", value: '"Times New Roman", serif' },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier New", value: '"Courier New", monospace' },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Trebuchet MS", value: '"Trebuchet MS", sans-serif' },
  { label: "Comic Sans MS", value: '"Comic Sans MS", cursive, sans-serif' },
  { label: "Lucida Console", value: '"Lucida Console", monospace' },
  { label: "Tahoma", value: "Tahoma, sans-serif" },
];

const ColorOverlay = ({ target, show, setShow, editor, type }) => {
  const colors = [
    "red",
    "darkred",
    "orange",
    "darkorange",
    "yellow",
    "lightgreen",
    "green",
    "darkgreen",
    "lightblue",
    "blue",
    "darkblue",
    "purple",
    "lightgray",
    "gray",
    "darkgray",
    "black",
    "white",
  ];

  return (
    <Overlay
      target={target}
      show={show}
      placement="bottom"
      rootClose={true}
      onHide={() => setShow(false)}
      container={target}
    >
      <Popover>
        <Popover.Body>
          <ColorGrid>
            {colors.map((color) => (
              <ColorCircleButton
                key={color}
                onClick={
                  type === "highlight"
                    ? () =>
                        editor.chain().focus().toggleHighlight({ color }).run()
                    : () => editor.chain().focus().setColor(color).run()
                }
                className={
                  type === "highlight"
                    ? editor.isActive("highlight", { color })
                      ? "is-active"
                      : ""
                    : editor.isActive("textStyle", { color })
                      ? "is-active"
                      : ""
                }
              >
                <ColorCircle bgColor={color} />
              </ColorCircleButton>
            ))}
          </ColorGrid>
        </Popover.Body>
      </Popover>
    </Overlay>
  );
};

const MenuButtonWithOverlay = ({ children, editor, type }) => {
  const [showPopover, setShowPopover] = useState(false);
  const buttonRef = useRef(null);

  return (
    <>
      <MenuButton ref={buttonRef} onClick={() => setShowPopover(!showPopover)}>
        {children}
      </MenuButton>
      <ColorOverlay
        target={buttonRef.current}
        show={showPopover}
        setShow={setShowPopover}
        editor={editor}
        type={type}
      />
    </>
  );
};

const MenuBar = ({ editor }) => {
  const [selectedFont, setSelectedFont] = useState("");

  // Keep dropdown value in sync with editor
  useEffect(() => {
    if (!editor) return;

    const updateFont = () => {
      const currentFont = editor.getAttributes("textStyle").fontFamily || "";
      setSelectedFont(currentFont);
    };

    editor.on("selectionUpdate", updateFont);
    editor.on("transaction", updateFont);

    // Initial font value
    updateFont();

    return () => {
      editor.off("selectionUpdate", updateFont);
      editor.off("transaction", updateFont);
    };
  }, [editor]);

  const handleChange = (e) => {
    const font = e.target.value;
    if (font === "") {
      editor.chain().focus().unsetFontFamily().run();
    } else {
      editor.chain().focus().setFontFamily(font).run();
    }
    setSelectedFont(font);
  };

  if (!editor) {
    return null;
  }

  return (
    <ButtonBar>
      <ButtonGroup>
        <MenuButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive("bold") ? "is-active" : ""}
        >
          <LuBold />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive("italic") ? "is-active" : ""}
        >
          <LuItalic />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive("strike") ? "is-active" : ""}
        >
          <LuStrikethrough />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={editor.isActive("code") ? "is-active" : ""}
        >
          <LuCode />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          className={editor.isActive("superscript") ? "is-active" : ""}
        >
          <LuSuperscript />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          className={editor.isActive("subscript") ? "is-active" : ""}
        >
          <LuSubscript />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive("underline") ? "is-active" : ""}
        >
          <LuUnderline />
        </MenuButton>
        <MenuButtonWithOverlay editor={editor} type={"highlight"}>
          <LuHighlighter />
        </MenuButtonWithOverlay>
        <MenuButtonWithOverlay editor={editor} type={"color"}>
          <LuBaseline />
        </MenuButtonWithOverlay>
        <div>
          <label htmlFor="font-select">Font:</label>
          <select id="font-select" value={selectedFont} onChange={handleChange}>
            <option value="">Default</option>
            {FONT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={editor.isActive({ textAlign: "left" }) ? "is-active" : ""}
        >
          <LuAlignLeft />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={
            editor.isActive({ textAlign: "center" }) ? "is-active" : ""
          }
        >
          <LuAlignJustify />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={editor.isActive({ textAlign: "right" }) ? "is-active" : ""}
        >
          <LuAlignRight />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <LuUndo />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          <LuRedo />
        </MenuButton>
        <MenuButton
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
        >
          <LuEraser />
        </MenuButton>
        {[1, 2, 3, 4, 5, 6].map((level) => (
          <MenuButton
            key={level}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level }).run()
            }
            className={editor.isActive("heading", { level }) ? "is-active" : ""}
          >
            H{level}
          </MenuButton>
        ))}
        <MenuButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive("bulletList") ? "is-active" : ""}
        >
          <LuList />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive("orderedList") ? "is-active" : ""}
        >
          <LuListOrdered />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive("codeBlock") ? "is-active" : ""}
        >
          <LuCodeXml />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive("blockquote") ? "is-active" : ""}
        >
          <LuMessageSquareQuote />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <LuMinus />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setHardBreak().run()}>
          <LuSeparatorHorizontal />
        </MenuButton>
      </ButtonGroup>
    </ButtonBar>
  );
};

const TextEditor = ({ textValue, onChange }) => {
  const extensions = [
    StarterKit.configure({
      bulletList: {
        keepMarks: true,
        keepAttributes: false,
      },
      orderedList: {
        keepMarks: true,
        keepAttributes: false,
      },
    }),
    Color.configure({ types: [TextStyle.name, ListItem.name] }),
    TextStyle,
    Underline,
    Highlight.configure({ multicolor: true }),
    Superscript,
    Subscript,
    Text,
    FontFamily,
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
  ];

  const editor = useEditor({
    extensions: extensions,
    content: textValue,
    onUpdate: useCallback(
      ({ editor }) => {
        const html = editor.getHTML();
        onChange(html);
      },
      [onChange]
    ),
  });

  // Watch for initial textValue and set it manually
  useEffect(() => {
    if (editor && textValue && editor.getHTML() !== textValue) {
      editor.commands.setContent(textValue, false); // `false` = don't emit update event
    }
  }, [editor, textValue]);

  return (
    <div>
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};

TextEditor.propTypes = {
  onChange: PropTypes.func,
  textValue: PropTypes.string,
};

export default TextEditor;
