import PropTypes from "prop-types";
import styled from "styled-components";
import { memo, useState, useEffect } from "react";

const StyledImg = styled.img`
  max-width: 100% !important;
  max-height: 100% !important;
  height: auto;
  width: auto;
  margin: auto;
  display: block;
`;

const StyledDiv = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
`;

const Image = ({ source }) => {
  const [imageWarning, setImageWarning] = useState(null);

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

  return (
    <>
      {imageWarning ? (
        imageWarning
      ) : (
        <StyledImg src={source} onError={onImageError} />
      )}
    </>
  );
};

Image.propTypes = {
  source: PropTypes.string,
  onError: PropTypes.func,
};

export default memo(Image);
