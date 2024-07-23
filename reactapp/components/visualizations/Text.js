import PropTypes from "prop-types";
import styled from "styled-components";
import { memo } from "react";
import parse from "html-react-parser";
import DOMPurify from "dompurify";

const StyledDiv = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
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
