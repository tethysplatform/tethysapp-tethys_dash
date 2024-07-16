import { useState } from "react";
import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import CNRFCPlotOptions from "components/modals/DataViewerComponents/CNRFC/PlotOptions";
import CW3EPlotOptions from "components/modals/DataViewerComponents/CW3E/PlotOptions";
import USACEPlotOptions from "components/modals/DataViewerComponents/USACE/PlotOptions";

function PlotDataViewerOptions({
  setImageSource,
  setImageWarning,
  setViz,
  setVizMetadata,
  setUpdateCellMessage,
}) {
  const [selectedPlotTypeOption, setSelectPlotTypeOption] = useState(null);

  function onPlotTypeChange(e) {
    setSelectPlotTypeOption(e);
    setImageSource(null);
    setImageWarning(null);
    setViz(null);
    setVizMetadata(null);
  }

  const plotTypeOptions = [
    { value: "USACE", label: "USACE" },
    { value: "CDEC", label: "CDEC" },
    { value: "CNRFC", label: "CNRFC" },
    { value: "CW3E", label: "CW3E" },
  ];

  return (
    <>
      <DataSelect
        label="Data Provider"
        selectedDataTypeOption={selectedPlotTypeOption}
        onChange={onPlotTypeChange}
        options={plotTypeOptions}
      />
      {selectedPlotTypeOption && (
        <>
          {selectedPlotTypeOption["label"] === "USACE" && (
            <USACEPlotOptions
              setViz={setViz}
              setVizMetadata={setVizMetadata}
              setUpdateCellMessage={setUpdateCellMessage}
            />
          )}
          {selectedPlotTypeOption["label"] === "CNRFC" && (
            <CNRFCPlotOptions
              setImageSource={setImageSource}
              setImageWarning={setImageWarning}
              setViz={setViz}
              setVizMetadata={setVizMetadata}
              setUpdateCellMessage={setUpdateCellMessage}
            />
          )}
          {selectedPlotTypeOption["label"] === "CW3E" && (
            <CW3EPlotOptions
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

PlotDataViewerOptions.propTypes = {
  setViz: PropTypes.func,
  setVizMetadata: PropTypes.func,
  setUpdateCellMessage: PropTypes.func,
  setImageSource: PropTypes.func,
  setImageWarning: PropTypes.func,
};

export default PlotDataViewerOptions;
