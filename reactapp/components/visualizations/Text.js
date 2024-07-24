import PropTypes from "prop-types";
import styled from "styled-components";
import { memo } from "react";
import parse from "html-react-parser";
import DOMPurify from "dompurify";

const StyledDiv = styled.div`
  text-align: center;
  height: 100%;
  overflow-y: auto;
`;

const Text = ({ textValue }) => {
  const clean = DOMPurify.sanitize(textValue);
  return (
    <StyledDiv>
      <div>{parse(clean)}</div>
    </StyledDiv>
  );
};

Text.propTypes = {
  source: PropTypes.string,
  onError: PropTypes.func,
};

export default memo(Text);
