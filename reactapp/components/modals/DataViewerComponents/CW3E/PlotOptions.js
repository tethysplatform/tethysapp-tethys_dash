import { useState } from "react";
import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import CW3ELandfallPlotOptions from "components/modals/DataViewerComponents/CW3E/LandfallPlotOptions";

function CW3EPlotOptions({
  selectedVizTypeOption,
  setImageSource,
  setImageWarning,
  setUpdateCellMessage,
}) {
  return (
    <>
      {selectedVizTypeOption["label"] === "CW3E AR Landfall" && (
        <CW3ELandfallPlotOptions
          setImageSource={setImageSource}
          setImageWarning={setImageWarning}
          setUpdateCellMessage={setUpdateCellMessage}
        />
      )}
    </>
  );
}

CW3EPlotOptions.propTypes = {
  setImageSource: PropTypes.func,
  setImageWarning: PropTypes.func,
  setUpdateCellMessage: PropTypes.func,
};

export default CW3EPlotOptions;
