import PropTypes from "prop-types";
import CW3ELandfallPlotOptions from "components/modals/DataViewerComponents/CW3E/LandfallPlotOptions";
import HUC8QPFPlotOptions from "components/modals/DataViewerComponents/CW3E/HUC8QPFPlotOptions";

function Options({
  selectedVizTypeOption,
  setViz,
  setVizMetadata,
  setUpdateCellMessage,
}) {
  if (selectedVizTypeOption["label"] === "CW3E AR Landfall") {
    return (
      <CW3ELandfallPlotOptions
        setViz={setViz}
        setVizMetadata={setVizMetadata}
        setUpdateCellMessage={setUpdateCellMessage}
      />
    );
  } else if (selectedVizTypeOption["label"] === "HUC 8 QPF Table") {
    return (
      <HUC8QPFPlotOptions
        setViz={setViz}
        setVizMetadata={setVizMetadata}
        setUpdateCellMessage={setUpdateCellMessage}
      />
    );
  } else {
    return null;
  }
}

function CW3EPlotOptions({
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

CW3EPlotOptions.propTypes = {
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

export default CW3EPlotOptions;
