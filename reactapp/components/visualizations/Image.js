import PropTypes from "prop-types";
import styled from "styled-components";
import { memo } from "react";

const StyledImg = styled.img`
  max-width: 100% !important;
  max-height: 100% !important;
  height: auto;
  width: auto;
  margin: auto;
  display: block;
`;

const Image = ({ source, onError }) => {
  return <StyledImg src={source} onError={onError} />;
};

Image.propTypes = {
  metadata: PropTypes.object,
};

export default memo(Image);
