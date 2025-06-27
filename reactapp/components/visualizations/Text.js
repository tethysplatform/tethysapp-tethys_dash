import PropTypes from "prop-types";
import styled from "styled-components";
import { memo } from "react";
import parse from "html-react-parser";
import DOMPurify from "dompurify";

const StyledDiv = styled.div`
  height: 100%;
  overflow-y: auto;
`;

const Text = ({ textValue, visualizationRef }) => {
  const clean = DOMPurify.sanitize(textValue);

  return (
    <StyledDiv ref={visualizationRef}>
      <div>{parse(clean)}</div>
    </StyledDiv>
  );
};

Text.propTypes = {
  textValue: PropTypes.string,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

export default memo(Text);
