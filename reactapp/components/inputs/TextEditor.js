import PropTypes from "prop-types";
import {
  BtnBold,
  BtnItalic,
  BtnUnderline,
  BtnStrikeThrough,
  BtnLink,
  BtnStyles,
  Editor,
  EditorProvider,
  Toolbar,
} from "react-simple-wysiwyg";
import "components/inputs/TextEditor.css";

const TextEditor = ({ textValue, onChange }) => {
  return (
    <EditorProvider>
      <Toolbar>
        <BtnBold />
        <BtnItalic />
        <BtnUnderline />
        <BtnStrikeThrough />
        <BtnLink />
        <BtnStyles />
      </Toolbar>
      <Editor
        containerProps={{ style: { height: "100%", overflowY: "auto" } }}
        value={textValue}
        onChange={onChange}
      ></Editor>
    </EditorProvider>
  );
};

TextEditor.propTypes = {
  onChange: PropTypes.func,
  textInput: PropTypes.string,
};

export default TextEditor;
