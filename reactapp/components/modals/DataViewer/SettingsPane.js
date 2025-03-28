import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import NormalInput from "components/inputs/NormalInput";
import CheckboxInput from "components/inputs/CheckboxInput";
import BorderSettings from "components/modals/DataViewer/BorderSettings";
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
    if (parseInt(e.target.value) >= 0) {
      setGridItemRefreshRate(parseInt(e.target.value));
      settingsRef.current.refreshRate = parseInt(e.target.value);
    }
  }

  function onEnforceAspectRatioChange(e) {
    if (e.target.checked === true) {
      settingsRef.current.aspectRatio =
        visualizationRef.current.naturalWidth /
        visualizationRef.current.naturalHeight;
      settingsRef.current.enforceAspectRatio = true;
    } else {
      delete settingsRef.current.enforceAspectRatio;
    }
    setEnforceAspectRatio(e.target.checked);
  }

  return (
    <>
      <NormalInput
        label="Refresh Rate (Minutes)"
        type="number"
        value={gridItemRefreshRate}
        onChange={onRefreshRateChange}
        divProps={{ style: { "margin-bottom": "1rem" } }}
      />
      <BorderSettings />
      {visualizationRef.current?.tagName ? (
        <>
          {visualizationRef.current.tagName.toLowerCase() === "img" &&
            visualizationRef.current.naturalWidth && (
              <CheckboxInput
                label="Enforce Aspect Ratio"
                type="checkbox"
                value={enforceAspectRatio}
                onChange={onEnforceAspectRatioChange}
                divProps={{ style: { "margin-bottom": "1rem" } }}
              />
            )}
        </>
      ) : (
        <Alert key={"warning"} variant={"warning"}>
          Visualization must be loaded to change additional settings.
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
