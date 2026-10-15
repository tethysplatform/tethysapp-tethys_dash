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
  padding: 1rem;
  display: flex;
  flex-direction: column;
  /* Hidden, not disabled: the text still scrolls by wheel, touch and keyboard. */
  ${(props) =>
    props.$hideScrollbar &&
    `
      scrollbar-width: none;
      &::-webkit-scrollbar {
        display: none;
      }
    `}
`;

// Auto margins rather than justify-content: centred or bottom-aligned text
// that outgrows its tile still scrolls from its first line, where
// justify-content would push the top of it out of reach.
const VERTICAL_MARGINS = {
  middle: "margin-top: auto; margin-bottom: auto;",
  bottom: "margin-top: auto;",
};

const PreWrapDiv = styled.div`
  white-space: pre-wrap;
  word-break: break-word;
  ${(props) => VERTICAL_MARGINS[props.$verticalAlign] ?? ""}
`;

const Text = ({
  textValue,
  visualizationRef,
  hideScrollbar = false,
  verticalAlign = "top",
}) => {
  const clean = DOMPurify.sanitize(textValue);

  return (
    <StyledDiv
      ref={visualizationRef}
      $hideScrollbar={hideScrollbar}
      data-testid="text-visualization"
    >
      <PreWrapDiv $verticalAlign={verticalAlign} data-testid="text-content">
        {parse(clean, linkifyOptions)}
      </PreWrapDiv>
    </StyledDiv>
  );
};

Text.propTypes = {
  textValue: PropTypes.string,
  // Grid-item setting: keep scrolling but draw no scrollbar.
  hideScrollbar: PropTypes.bool,
  // Grid-item setting: where the text sits in its tile.
  verticalAlign: PropTypes.oneOf(["top", "middle", "bottom"]),
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

export default memo(Text);
