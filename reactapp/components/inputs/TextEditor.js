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

const TextEditor = ({ textValue, onChange }) => {
  return (
    <EditorProvider>
      <Editor value={textValue} onChange={onChange}>
        <Toolbar>
          <BtnBold />
          <BtnItalic />
          <BtnUnderline />
          <BtnStrikeThrough />
          <BtnLink />
          <BtnStyles />
        </Toolbar>
      </Editor>
    </EditorProvider>
  );
};

TextEditor.propTypes = {
  onChange: PropTypes.func,
  textInput: PropTypes.string,
};

export default TextEditor;
