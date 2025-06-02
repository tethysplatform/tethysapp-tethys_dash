import { useCallback, useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";
import { Color } from "@tiptap/extension-color";
import ListItem from "@tiptap/extension-list-item";
import ListKeymap from "@tiptap/extension-list-keymap";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextStyle from "@tiptap/extension-text-style";
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
  LuMinus,
  LuIndentIncrease,
  LuIndentDecrease,
} from "react-icons/lu";
import ButtonGroup from "react-bootstrap/ButtonGroup";
import Overlay from "react-bootstrap/Overlay";
import Popover from "react-bootstrap/Popover";
import "components/inputs/TextEditor.css";

const SeparatedButtonGroup = styled(ButtonGroup)`
  border-right: 1px solid lightgray;
  padding-left: 0.2rem;
  padding-right: 0.2rem;
  border-radius: 0;
  height: 2.5rem;
  gap: 0.1rem;
  align-items: center;
`;

const MenuButton = styled.button`
  height: 2rem;
  width: 2rem;
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

const STYLE_OPTIONS = [
  { label: "Normal Text", value: "Normal Text" },
  { label: "H1", value: 1 },
  { label: "H2", value: 2 },
  { label: "H3", value: 3 },
  { label: "H4", value: 4 },
  { label: "H5", value: 5 },
  { label: "H6", value: 6 },
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
      <MenuButton
        ref={buttonRef}
        onClick={() => setShowPopover(!showPopover)}
        aria-label={`${type} Menu Button`}
      >
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
  const [selectedFont, setSelectedFont] = useState("Arial, sans-serif");
  const [selectedStyle, setSelectedStyle] = useState("Normal Text");

  // Keep dropdown value in sync with editor
  useEffect(() => {
    const updateFont = () => {
      const currentFont =
        editor.getAttributes("textStyle").fontFamily || "Arial, sans-serif";
      setSelectedFont(currentFont);
    };

    const updateStyle = () => {
      const currentStyle =
        editor.getAttributes("heading").level || "Normal Text";
      setSelectedStyle(currentStyle);
    };

    editor.on("selectionUpdate", updateFont);
    editor.on("transaction", updateFont);

    editor.on("selectionUpdate", updateStyle);
    editor.on("transaction", updateStyle);

    // Initial font value
    updateFont();
    updateStyle();

    return () => {
      editor.off("selectionUpdate", updateFont);
      editor.off("transaction", updateFont);

      editor.off("selectionUpdate", updateStyle);
      editor.off("transaction", updateStyle);
    };
  }, [editor]);

  const handleFontChange = (e) => {
    const font = e.target.value;
    editor.chain().focus().setFontFamily(font).run();
    setSelectedFont(font);
  };

  const handleStyleChange = (e) => {
    let style = e.target.value;
    if (style === "Normal Text" && selectedStyle !== "Normal Text") {
      style = selectedStyle;
    }
    editor
      .chain()
      .focus()
      .toggleHeading({ level: parseInt(style) })
      .run();
    setSelectedStyle(style);
  };

  return (
    <ButtonBar>
      <SeparatedButtonGroup>
        <MenuButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          aria-label="Undo Menu Button"
        >
          <LuUndo />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          aria-label="Redo Menu Button"
        >
          <LuRedo />
        </MenuButton>
        <MenuButton
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
          aria-label="Eraser Menu Button"
        >
          <LuEraser />
        </MenuButton>
      </SeparatedButtonGroup>
      <SeparatedButtonGroup>
        <MenuButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive("bold") ? "is-active" : ""}
          aria-label="Bold Menu Button"
        >
          <LuBold />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive("italic") ? "is-active" : ""}
          aria-label="Italic Menu Button"
        >
          <LuItalic />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive("underline") ? "is-active" : ""}
          aria-label="Underline Menu Button"
        >
          <LuUnderline />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive("strike") ? "is-active" : ""}
          aria-label="Strikethrough Menu Button"
        >
          <LuStrikethrough />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          className={editor.isActive("superscript") ? "is-active" : ""}
          aria-label="Superscript Menu Button"
        >
          <LuSuperscript />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          className={editor.isActive("subscript") ? "is-active" : ""}
          aria-label="Subscript Menu Button"
        >
          <LuSubscript />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={editor.isActive("code") ? "is-active" : ""}
          aria-label="Code Menu Button"
        >
          <LuCode />
        </MenuButton>
        <MenuButtonWithOverlay editor={editor} type={"highlight"}>
          <LuHighlighter />
        </MenuButtonWithOverlay>
        <MenuButtonWithOverlay editor={editor} type={"color"}>
          <LuBaseline />
        </MenuButtonWithOverlay>
      </SeparatedButtonGroup>
      <SeparatedButtonGroup>
        <div>
          <select
            id="font-select"
            value={selectedFont}
            onChange={handleFontChange}
            style={{ border: "none" }}
            aria-label="Font Select"
          >
            {FONT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </SeparatedButtonGroup>
      <SeparatedButtonGroup>
        <div>
          <select
            id="style-select"
            value={selectedStyle}
            onChange={handleStyleChange}
            style={{ border: "none" }}
            aria-label="Style Select"
          >
            {STYLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </SeparatedButtonGroup>
      <ButtonGroup>
        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={editor.isActive({ textAlign: "left" }) ? "is-active" : ""}
          aria-label="Align Left Menu Button"
        >
          <LuAlignLeft />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={
            editor.isActive({ textAlign: "center" }) ? "is-active" : ""
          }
          aria-label="Align Center Menu Button"
        >
          <LuAlignJustify />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={editor.isActive({ textAlign: "right" }) ? "is-active" : ""}
          aria-label="Align Right Menu Button"
        >
          <LuAlignRight />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive("bulletList") ? "is-active" : ""}
          aria-label="List Menu Button"
        >
          <LuList />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive("orderedList") ? "is-active" : ""}
          aria-label="List Order Menu Button"
        >
          <LuListOrdered />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().sinkListItem("listItem").run()}
          disabled={!editor.can().sinkListItem("listItem")}
          aria-label="Indent Increase Menu Button"
        >
          <LuIndentIncrease />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().liftListItem("listItem").run()}
          disabled={!editor.can().liftListItem("listItem")}
          aria-label="Indent Decrease Menu Button"
        >
          <LuIndentDecrease />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          aria-label="Horizontal Line Menu Button"
        >
          <LuMinus />
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
      textStyle: false,
    }),
    Color.configure({ types: [TextStyle.name, ListItem.name] }),
    TextStyle.configure({ mergeNestedSpanStyles: true }),
    Underline,
    Highlight.configure({ multicolor: true }),
    Superscript,
    Subscript,
    FontFamily,
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
    ListKeymap,
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
    editorProps: {
      attributes: {
        "aria-label": "textEditor",
        "data-testid": "tiptap-editor",
      },
    },
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

ColorOverlay.propTypes = {
  target: PropTypes.shape({ current: PropTypes.any }),
  show: PropTypes.bool,
  setShow: PropTypes.func,
  editor: PropTypes.object,
  type: PropTypes.string,
};

MenuButtonWithOverlay.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.element),
    PropTypes.element,
  ]),
  editor: PropTypes.object,
  type: PropTypes.string,
};

MenuBar.propTypes = {
  editor: PropTypes.object,
};

TextEditor.propTypes = {
  onChange: PropTypes.func,
  textValue: PropTypes.string,
};

export default TextEditor;
