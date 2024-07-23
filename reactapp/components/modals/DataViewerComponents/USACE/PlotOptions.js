import PropTypes from "prop-types";
import USACEHourlyTimeSeriesPlotOptions from "components/modals/DataViewerComponents/USACE/HourlyTimeSeriesPlotOptions";

function Options({
  selectedVizTypeOption,
  setViz,
  setVizMetadata,
  setUpdateCellMessage,
}) {
  if (selectedVizTypeOption["label"] === "Hourly Time Series") {
    return (
      <USACEHourlyTimeSeriesPlotOptions
        setViz={setViz}
        setVizMetadata={setVizMetadata}
        setUpdateCellMessage={setUpdateCellMessage}
      />
    );
  } else {
    return null;
  }
}

function USACEPlotOptions({
  selectedVizTypeOption,
  setViz,
  setVizMetadata,
  setUpdateCellMessage,
}) {
  return (
    <Options
      selectedVizTypeOption={selectedVizTypeOption}
      setViz={setViz}
      setVizMetadata={setVizMetadata}
      setUpdateCellMessage={setUpdateCellMessage}
    />
  );
}

USACEPlotOptions.propTypes = {
  selectedVizTypeOption: PropTypes.object,
  setViz: PropTypes.func,
  setVizMetadata: PropTypes.func,
  setUpdateCellMessage: PropTypes.func,
};

Options.propTypes = {
  selectedVizTypeOption: PropTypes.object,
  setViz: PropTypes.func,
  setVizMetadata: PropTypes.func,
  setUpdateCellMessage: PropTypes.func,
};

export default USACEPlotOptions;
