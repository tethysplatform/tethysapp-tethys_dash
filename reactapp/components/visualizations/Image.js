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

const Image = ({ source, visualizationMetadata }) => {
  const [imageWarning, setImageWarning] = useState(null);

  useEffect(() => {
    setImageWarning(null);
  }, [source]);

  function onImageLoad(e) {
    if (visualizationMetadata) {
      visualizationMetadata.current = {
        type: "image",
        aspectRatio: e.target.naturalWidth / e.target.naturalHeight,
      };
    }
  }

  function onImageError() {
    setImageWarning(
      <StyledDiv>
        <h2>Failed to get image.</h2>
      </StyledDiv>
    );
  }

  return (
    <>
      {imageWarning ? (
        imageWarning
      ) : (
        <StyledImg src={source} onError={onImageError} onLoad={onImageLoad} />
      )}
    </>
  );
};

Image.propTypes = {
  source: PropTypes.string,
  onError: PropTypes.func,
};

export default memo(Image);
