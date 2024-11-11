import PropTypes from "prop-types";
import styled from "styled-components";
import { memo, useState, useEffect, useRef } from "react";
import {
  useVisualizationRefContext,
  useVisualizationRefMetadataContext,
} from "components/contexts/VisualizationRefContext";

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

const Image = ({ source }) => {
  const [imageWarning, setImageWarning] = useState(null);
  let visualizationRef = useVisualizationRefContext();
  let visualizationRefMetadata = useVisualizationRefMetadataContext();
  if (!visualizationRef) {
    // if image is not in the dataviewer then the refs will be undefined
    visualizationRef = useRef({});
    visualizationRefMetadata = useRef({});
  }

  useEffect(() => {
    setImageWarning(null);
  }, [source]);

  function onImageError() {
    setImageWarning(
      <StyledDiv>
        <h2>Failed to get image.</h2>
      </StyledDiv>
    );
  }

  function onImageLoad() {
    visualizationRefMetadata.current["aspectRatio"] =
      visualizationRef.current.naturalWidth /
      visualizationRef.current.naturalHeight;
  }

  return (
    <>
      {imageWarning ? (
        imageWarning
      ) : (
        <StyledImg
          src={source}
          onError={onImageError}
          onLoad={onImageLoad}
          ref={visualizationRef}
        />
      )}
    </>
  );
};

Image.propTypes = {
  source: PropTypes.string,
  onError: PropTypes.func,
};

export default memo(Image);
