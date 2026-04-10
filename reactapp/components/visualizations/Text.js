import PropTypes from "prop-types";
import styled from "styled-components";
import { memo, Fragment } from "react";
import parse from "html-react-parser";
import DOMPurify from "dompurify";

const urlSplitRegex = /(https?:\/\/[^\s]+|ftp:\/\/[^\s]+|www\.[^\s]+)/g;

const linkifyOptions = {
  replace: (domNode) => {
    if (domNode.type === "text" && domNode.parent?.name !== "a") {
      const text = domNode.data;
      const parts = text.split(urlSplitRegex);
      if (parts.length <= 1) return;
      return (
        <>
          {parts.map((part, i) =>
            urlSplitRegex.test(part) ? (
              <a
                key={i}
                href={part.startsWith("www.") ? `https://${part}` : part}
                target="_blank"
                rel="noopener noreferrer"
              >
                {part}
              </a>
            ) : (
              <Fragment key={i}>{part}</Fragment>
            ),
          )}
        </>
      );
    }
  },
};

const StyledDiv = styled.div`
  height: 100%;
  overflow-y: auto;
`;

const PreWrapDiv = styled.div`
  white-space: pre-wrap;
  word-break: break-word;
`;

const Text = ({ textValue, visualizationRef }) => {
  const clean = DOMPurify.sanitize(textValue);

  return (
    <StyledDiv ref={visualizationRef}>
      <PreWrapDiv>{parse(clean, linkifyOptions)}</PreWrapDiv>
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
