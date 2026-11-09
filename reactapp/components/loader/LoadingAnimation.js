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

  // The status text is logged for developers, not shown to ordinary users.
  useEffect(() => {
    const parts = [text, detail].filter(Boolean);
    if (parts.length) {
      // eslint-disable-next-line no-console
      console.info("[loading]", parts.join(" — "));
    }
  }, [text, detail]);

  // The status region is mounted before the spinner shows, so a screen reader
  // announces the hidden "Loading..." when it arrives. Only that generic text
  // is announced, never the `text`/`detail` progress.
  return (
    <div data-testid="loading-animation" role="status">
      {show && (
        <>
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
          <span className="visually-hidden">Loading...</span>
        </>
      )}
    </div>
  );
};

LoadingAnimation.propTypes = {
  delay: PropTypes.number,
  text: PropTypes.string,
  // A secondary line under `text` describing what is still loading.
  detail: PropTypes.string,
};

export default LoadingAnimation;
