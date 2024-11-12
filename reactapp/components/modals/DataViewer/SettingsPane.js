import { useState } from "react";
import PropTypes from "prop-types";
import DataInput from "components/inputs/DataInput";
import Alert from "react-bootstrap/Alert";
import "components/modals/wideModal.css";

function SettingsPane({ settingsRef, visualizationRef }) {
  const [gridItemRefreshRate, setGridItemRefreshRate] = useState(
    settingsRef.current.refreshRate ? settingsRef.current.refreshRate : 0
  );
  const [enforceAspectRatio, setEnforceAspectRatio] = useState(
    settingsRef.current.enforceAspectRatio ? true : false
  );

  function onRefreshRateChange(e) {
    if (parseInt(e) >= 0) {
      setGridItemRefreshRate(parseInt(e));
      settingsRef.current.refreshRate = parseInt(e);
    }
  }

  function onEnforceAspectRatioChange(e) {
    if (e === true) {
      if (visualizationRef.current.naturalWidth) {
        settingsRef.current.aspectRatio =
          visualizationRef.current.naturalWidth /
          visualizationRef.current.naturalHeight;
        settingsRef.current.enforceAspectRatio = true;
        setEnforceAspectRatio(e);
      }
    } else if ("enforceAspectRatio" in settingsRef.current) {
      delete settingsRef.current.enforceAspectRatio;
      setEnforceAspectRatio(e);
    }
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
              {visualizationRef.current.tagName.toLowerCase() === "img" && (
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
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

export default SettingsPane;
