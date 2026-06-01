import PropTypes from "prop-types";
import { useState, useEffect } from "react";

import "components/loader/LoadingAnimation.scss";

const LoadingAnimation = ({ delay = 0, text = "Loading..." }) => {
  const [show, setShow] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) return undefined;
    const id = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(id);
  }, [delay]);

  if (!show) return null;

  return (
    <div className="loader" role="status" aria-live="polite">
      <div className="loader__spinner" aria-hidden="true" />
      <div className="loader__label">{text}</div>
    </div>
  );
};

LoadingAnimation.propTypes = {
  delay: PropTypes.number,
  text: PropTypes.string,
};

export default LoadingAnimation;
