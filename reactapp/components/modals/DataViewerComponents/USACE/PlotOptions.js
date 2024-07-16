import { useState } from "react";
import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import USACEHourlyTimeSeriesPlotOptions from "components/modals/DataViewerComponents/USACE/HourlyTimeSeriesPlotOptions";

function USACEPlotOptions({ setViz, setVizMetadata, setUpdateCellMessage }) {
  const [selectedPlotTypeOption, setSelectPlotTypeOption] = useState(null);

  function onPlotTypeChange(e) {
    setViz(null);
    setVizMetadata(null);
    setSelectPlotTypeOption(e);
  }

  const plotTypeOptions = [
    {
      value: "Hourly Time Series",
      label: "Hourly Time Series",
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
          {selectedPlotTypeOption["label"] === "Hourly Time Series" && (
            <USACEHourlyTimeSeriesPlotOptions
              setViz={setViz}
              setVizMetadata={setVizMetadata}
              setUpdateCellMessage={setUpdateCellMessage}
            />
          )}
        </>
      )}
    </>
  );
}

USACEPlotOptions.propTypes = {
  setViz: PropTypes.func,
  setVizMetadata: PropTypes.func,
  setUpdateCellMessage: PropTypes.func,
};

export default USACEPlotOptions;
