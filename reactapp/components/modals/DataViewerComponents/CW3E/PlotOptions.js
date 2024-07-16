import { useState } from "react";
import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import CW3ELandfallPlotOptions from "components/modals/DataViewerComponents/CW3E/LandfallPlotOptions";

function CW3EPlotOptions({
  setImageSource,
  setImageWarning,
  setUpdateCellMessage,
}) {
  const [selectedPlotTypeOption, setSelectPlotTypeOption] = useState(null);

  function onPlotTypeChange(e) {
    setImageSource(null);
    setImageWarning(null);
    setSelectPlotTypeOption(e);
  }

  const plotTypeOptions = [
    {
      value: "CW3E AR Landfall",
      label: "CW3E AR Landfall",
    },
  ];

  return (
    <>
      <DataSelect
        label="Plot Type"
        selectedDataTypeOption={selectedPlotTypeOption}
        onChange={onPlotTypeChange}
        options={plotTypeOptions}
      />
      {selectedPlotTypeOption && (
        <>
          {selectedPlotTypeOption["label"] === "CW3E AR Landfall" && (
            <CW3ELandfallPlotOptions
              setImageSource={setImageSource}
              setImageWarning={setImageWarning}
              setUpdateCellMessage={setUpdateCellMessage}
            />
          )}
        </>
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
