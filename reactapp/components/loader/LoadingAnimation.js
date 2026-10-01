import PropTypes from "prop-types";
import { useState, useEffect } from "react";

import "components/loader/LoadingAnimation.scss";

const LoadingAnimation = ({ delay, text = "Loading...", detail }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Option to delay display of animated loader for longer resolutions
    setTimeout(() => {
      setShow(true);
    }, delay);
  }, [delay]);

  return (
    <>
      {show && (
        <div>
          <div className="center"></div>
          <div className="inner-spin">
            <div className="inner-arc inner-arc_start-a"></div>
            <div className="inner-arc inner-arc_end-a"></div>
            <div className="inner-arc inner-arc_start-b"></div>
            <div className="inner-arc inner-arc_end-b"></div>

            <div className="inner-moon-a"></div>
            <div className="inner-moon-b"></div>
          </div>
          <div className="outer-spin">
            <div className="outer-arc outer-arc_start-a"></div>
            <div className="outer-arc outer-arc_end-a"></div>
            <div className="outer-arc outer-arc_start-b"></div>
            <div className="outer-arc outer-arc_end-b"></div>
            <div className="outer-moon-a"></div>
            <div className="outer-moon-b"></div>
          </div>
          {/* A live region, so a screen reader hears the text and any detail
              (e.g. a progress count) change while the page waits. */}
          <div className="loading-text" role="status" aria-live="polite">
            {text}
            {detail && <div className="loading-detail">{detail}</div>}
          </div>
        </div>
      )}
    </>
  );
};

LoadingAnimation.propTypes = {
  delay: PropTypes.number,
  text: PropTypes.string,
  // A secondary line under `text` describing what is still loading.
  detail: PropTypes.string,
};

export default LoadingAnimation;
