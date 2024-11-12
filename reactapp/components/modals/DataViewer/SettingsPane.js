import { useState } from "react";
import PropTypes from "prop-types";
import DataInput from "components/inputs/DataInput";
import { useVisualizationRefMetadataContext } from "components/contexts/VisualizationRefContext";
import "components/modals/wideModal.css";

function SettingsPane({ settingsRef }) {
  const visualizationRefMetadata = useVisualizationRefMetadataContext();
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
    setEnforceAspectRatio(e);
    if (e === true) {
      settingsRef.current.enforceAspectRatio = true;
    } else if ("enforceAspectRatio" in settingsRef.current) {
      delete settingsRef.current.enforceAspectRatio;
    }
  }

  return (
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
      {"aspectRatio" in visualizationRefMetadata.current && (
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
  );
}

SettingsPane.propTypes = {
  grid_item_index: PropTypes.number,
  source: PropTypes.string,
  argsString: PropTypes.string,
  refreshRate: PropTypes.number,
  setGridItemMessage: PropTypes.func,
  setShowGridItemMessage: PropTypes.func,
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
};

export default SettingsPane;
