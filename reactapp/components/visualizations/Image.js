import PropTypes from "prop-types";
import styled from "styled-components";
import { memo, useState, useEffect } from "react";

// With a locked aspect ratio the image is fitted inside the tile rather than
// stretched to it, since the tile's shape drifts with the screen's. The img has
// no background, so the letterbox bars show the tile behind it.
const StyledImg = styled.img`
  height: 100%;
  width: 100%;
  ${(props) => props.$keepAspectRatio && "object-fit: contain;"}
`;

const StyledDiv = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
`;

const Image = ({
  source,
  alt,
  visualizationRef,
  imageError,
  keepAspectRatio,
}) => {
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
        <StyledDiv>
          <h2>{imageError ?? "Failed to get image."}</h2>
        </StyledDiv>
      ) : (
        <StyledImg
          src={source}
          alt={alt}
          onError={onImageError}
          ref={visualizationRef}
          $keepAspectRatio={keepAspectRatio}
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
  keepAspectRatio: PropTypes.bool,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

export default memo(Image);
