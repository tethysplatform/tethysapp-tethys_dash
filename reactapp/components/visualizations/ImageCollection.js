import PropTypes from "prop-types";
import styled from "styled-components";
import { memo, useState, useCallback } from "react";

const Container = styled.div`
  width: 100%;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
`;

const Title = styled.h5`
  text-align: center;
  margin: 8px 0;
  flex-shrink: 0;
`;

const Grid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px;
  justify-content: center;
  align-items: flex-start;
  flex: 1;
`;

const ImageWrapper = styled.div`
  flex: ${({ $columns }) =>
    $columns ? `0 0 calc(${100 / $columns}% - 8px)` : "1 1 200px"};
  display: flex;
  justify-content: center;
  align-items: center;
`;

const StyledImg = styled.img`
  width: 100%;
  height: auto;
  object-fit: contain;
`;

const ErrorText = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100px;
  color: #888;
`;

const ImageCollection = ({
  urls,
  title,
  columns,
  imageError,
  visualizationRef,
}) => {
  const [errorUrls, setErrorUrls] = useState(() => new Set());

  const onError = useCallback((url) => {
    setErrorUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  return (
    <Container ref={visualizationRef}>
      {title && <Title>{title}</Title>}
      <Grid>
        {urls.map((url, index) => (
          <ImageWrapper key={url + index} $columns={columns}>
            {errorUrls.has(url) ? (
              <ErrorText>
                <h6>{imageError ?? "Failed to get image."}</h6>
              </ErrorText>
            ) : (
              <StyledImg
                src={url}
                alt={`image-${index}`}
                onError={() => onError(url)}
              />
            )}
          </ImageWrapper>
        ))}
      </Grid>
    </Container>
  );
};

ImageCollection.propTypes = {
  urls: PropTypes.arrayOf(PropTypes.string).isRequired,
  title: PropTypes.string,
  columns: PropTypes.number,
  imageError: PropTypes.string,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

export default memo(ImageCollection);
