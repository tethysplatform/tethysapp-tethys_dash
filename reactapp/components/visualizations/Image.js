import PropTypes from "prop-types";
import styled from "styled-components";
import { memo, useState, useEffect } from "react";

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

const Image = ({ source, alt, visualizationRef }) => {
  const [imageWarning, setImageWarning] = useState(null);

  useEffect(() => {
    setImageWarning(false);
  }, [source]);

  function onImageError({currentTarget}) {
    setImageWarning(true);
  }

  return (
    <>
      {imageWarning ? (
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
      )}
    </>
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
};

export default memo(Image);
