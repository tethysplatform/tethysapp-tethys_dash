import PropTypes from "prop-types";
import styled from "styled-components";
import { memo, useState, useCallback } from "react";

const Container = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`;

const StyledImg = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

const StyledDiv = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
`;

const ImageSequence = ({
  urls,
  activeUrl,
  alt,
  imageError,
  visualizationRef,
}) => {
  const [loadedUrls, setLoadedUrls] = useState(() => new Set());
  const [errorUrls, setErrorUrls] = useState(() => new Set());

  const onLoad = useCallback((url) => {
    setLoadedUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  const onError = useCallback((url) => {
    setErrorUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  const activeHasError = errorUrls.has(activeUrl);
  const activeIsLoading = !loadedUrls.has(activeUrl) && !activeHasError;

  return (
    <Container>
      {activeHasError && (
        <StyledDiv>
          <h2>{imageError ?? "Failed to get image."}</h2>
        </StyledDiv>
      )}
      {activeIsLoading && (
        <StyledDiv>
          <h2>Loading Images...</h2>
        </StyledDiv>
      )}
      {urls.map((url) => {
        const isActive = url === activeUrl;
        return (
          <StyledImg
            key={url}
            src={url}
            alt={alt}
            ref={isActive ? visualizationRef : undefined}
            onLoad={() => onLoad(url)}
            onError={() => onError(url)}
            style={{
              visibility:
                isActive && !activeHasError && !activeIsLoading
                  ? "visible"
                  : "hidden",
            }}
          />
        );
      })}
    </Container>
  );
};

ImageSequence.propTypes = {
  urls: PropTypes.arrayOf(PropTypes.string).isRequired,
  activeUrl: PropTypes.string.isRequired,
  alt: PropTypes.string,
  imageError: PropTypes.string,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

export default memo(ImageSequence);
