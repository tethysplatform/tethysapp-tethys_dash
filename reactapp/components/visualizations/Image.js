import PropTypes from "prop-types";
import styled from "styled-components";
import { memo, useState, useEffect } from "react";
import EmptyState from "components/visualizations/EmptyState";

const StyledImg = styled.img`
  height: 100%;
  width: 100%;
`;

const Image = ({ source, alt, visualizationRef, imageError }) => {
  const [imageWarning, setImageWarning] = useState(false);

  useEffect(() => {
    setImageWarning(false);
  }, [source]);

  function onImageError() {
    setImageWarning(true);
  }

  return (
    <>
      {imageWarning ? (
        <EmptyState
          variant="error"
          title="Image unavailable"
          hint={imageError || "Could not load this image."}
        />
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
  imageError: PropTypes.string,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

export default memo(Image);
