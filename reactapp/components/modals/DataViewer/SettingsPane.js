import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import DataInput from "components/inputs/DataInput";
import Alert from "react-bootstrap/Alert";
import "components/modals/wideModal.css";

function SettingsPane({ settingsRef, viz, visualizationRef }) {
  const [gridItemRefreshRate, setGridItemRefreshRate] = useState(
    settingsRef.current.refreshRate ? settingsRef.current.refreshRate : 0
  );
  const [enforceAspectRatio, setEnforceAspectRatio] = useState(
    settingsRef.current.enforceAspectRatio ? true : false
  );

  useEffect(() => {
    setGridItemRefreshRate(
      settingsRef.current.refreshRate ? settingsRef.current.refreshRate : 0
    );
    setEnforceAspectRatio(
      settingsRef.current.enforceAspectRatio ? true : false
    );
    // eslint-disable-next-line
  }, [viz]);

  function onRefreshRateChange(e) {
    if (parseInt(e) >= 0) {
      setGridItemRefreshRate(parseInt(e));
      settingsRef.current.refreshRate = parseInt(e);
    }
  }

  function onEnforceAspectRatioChange(e) {
    if (e === true) {
      settingsRef.current.aspectRatio =
        visualizationRef.current.naturalWidth /
        visualizationRef.current.naturalHeight;
      settingsRef.current.enforceAspectRatio = true;
    } else {
      delete settingsRef.current.enforceAspectRatio;
    }
    setEnforceAspectRatio(e);
  }

  return (
    <>
      {visualizationRef.current ? (
        <>
          <DataInput
            objValue={{
              label: "Refresh Rate (Minutes)",
              type: "number",
              value: gridItemRefreshRate,
            }}
            onChange={onRefreshRateChange}
            index={0}
          />
          {visualizationRef.current.tagName && (
            <>
              {visualizationRef.current.tagName.toLowerCase() === "img" &&
                visualizationRef.current.naturalWidth && (
                  <DataInput
                    objValue={{
                      label: "Enforce Aspect Ratio",
                      type: "checkbox",
                      value: enforceAspectRatio,
                    }}
                    onChange={onEnforceAspectRatioChange}
                    index={0}
                  />
                )}
            </>
          )}
        </>
      ) : (
        <Alert key={"warning"} variant={"warning"}>
          Visualization must be loaded to change settings.
        </Alert>
      )}
    </>
  );
}

SettingsPane.propTypes = {
  settingsRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
  viz: PropTypes.object,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

export default SettingsPane;
