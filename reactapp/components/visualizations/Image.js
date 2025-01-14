import PropTypes from "prop-types";
import styled from "styled-components";
import { memo, useState, useEffect } from "react";
import useConditionalChecks from "hooks/useConditionalChecks";

const StyledImg = styled.img`
  height: 100%;
  width: 100%;
`;

const StyledDiv = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
`;

const StyledErrorDiv = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const Image = ({ source, alt, visualizationRef, customErrors }) => {
  const [imageWarning, setImageWarning] = useState(false);
  const { passed, resultMessages } = useConditionalChecks(customErrors);

  useEffect(() => {
    setImageWarning(false);
  }, [source]);

  function onImageError({currentTarget}) {
    setImageWarning(true);
  }

  return (
    passed ? (
      imageWarning ? (
        <StyledDiv>
          <h2>Failed to get image.</h2>
        </StyledDiv>
      ) : (
        <StyledImg
          src={source}
          alt={alt}
          onError={onImageError}
          ref={visualizationRef}
        />
      )
    ) : (
      // These will only show if the useConditionalChecks hook finds any failures
      // It will then map through all of the possible errors that occured.
      resultMessages.map((message, messageIndex) => (
        <StyledErrorDiv key={messageIndex}>
          <h2>{message}</h2>
        </StyledErrorDiv>
      ))
    )
  );
};

Image.propTypes = {
  source: PropTypes.string,
  alt: PropTypes.string,
  onError: PropTypes.func,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
  customErrors: PropTypes.arrayOf(
    PropTypes.shape({
      variableName: PropTypes.string,
      operator: PropTypes.string,
      comparison: PropTypes.string,
      resultMessage: PropTypes.string,
    })
  ),
};

export default memo(Image);
