import PropTypes from "prop-types";
import USACEHourlyTimeSeriesPlotOptions from "components/modals/DataViewerComponents/USACE/HourlyTimeSeriesPlotOptions";

function USACEPlotOptions({
  selectedVizTypeOption,
  setViz,
  setVizMetadata,
  setUpdateCellMessage,
}) {
  return (
    <>
      {selectedVizTypeOption["label"] === "Hourly Time Series" && (
        <USACEHourlyTimeSeriesPlotOptions
          setViz={setViz}
          setVizMetadata={setVizMetadata}
          setUpdateCellMessage={setUpdateCellMessage}
        />
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
