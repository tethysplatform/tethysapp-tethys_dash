import PropTypes from "prop-types";
import styled from "styled-components";
import { memo, useRef } from "react";
import parse from "html-react-parser";
import DOMPurify from "dompurify";
import { useVisualizationRefContext } from "components/contexts/VisualizationRefContext";

const StyledDiv = styled.div`
  text-align: center;
  height: 100%;
  overflow-y: auto;
`;

const Text = ({ textValue }) => {
  const clean = DOMPurify.sanitize(textValue);
  let visualizationRef = useVisualizationRefContext();
  if (!visualizationRef) {
    // if image is not in the dataviewer then the refs will be undefined
    visualizationRef = useRef({});
  }

  return (
    <StyledDiv ref={visualizationRef}>
      <div>{parse(clean)}</div>
    </StyledDiv>
  );
};

Text.propTypes = {
  textValue: PropTypes.string,
};

export default memo(Text);
