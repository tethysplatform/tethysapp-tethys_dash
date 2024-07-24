import PropTypes from "prop-types";
import TextEditor from "components/inputs/TextEditor";
import { useState } from "react";
import styled from "styled-components";

const StyledDiv = styled.div`
  height: 90%;
`;

function CustomTextOptions({ setVizMetadata, setUpdateCellMessage }) {
  const [textValue, setTextValue] = useState("");

  function onChange(e) {
    setTextValue(e.target.value);
    const itemData = {
      type: "Text",
      metadata: {
        text: e.target.value,
      },
    };
    setVizMetadata(itemData);
    setUpdateCellMessage("Cell updated to show custom text");
  }

  return (
    <StyledDiv>
      <TextEditor textValue={textValue} onChange={onChange} />
    </StyledDiv>
  );
}

CustomTextOptions.propTypes = {
  setImageSource: PropTypes.func,
  imageSource: PropTypes.string,
};

export default CustomTextOptions;
