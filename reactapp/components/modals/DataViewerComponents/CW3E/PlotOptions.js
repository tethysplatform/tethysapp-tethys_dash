import PropTypes from "prop-types";
import CW3ELandfallPlotOptions from "components/modals/DataViewerComponents/CW3E/LandfallPlotOptions";

function Options({
  selectedVizTypeOption,
  setImageSource,
  setImageWarning,
  setUpdateCellMessage,
}) {
  if (selectedVizTypeOption["label"] === "CW3E AR Landfall") {
    return (
      <CW3ELandfallPlotOptions
        setImageSource={setImageSource}
        setImageWarning={setImageWarning}
        setUpdateCellMessage={setUpdateCellMessage}
      />
    );
  } else {
    return null;
  }
}

function CW3EPlotOptions({
  selectedVizTypeOption,
  setImageSource,
  setImageWarning,
  setUpdateCellMessage,
}) {
  return (
    <Options
      selectedVizTypeOption={selectedVizTypeOption}
      setImageSource={setImageSource}
      setImageWarning={setImageWarning}
      setUpdateCellMessage={setUpdateCellMessage}
    />
  );
}

CW3EPlotOptions.propTypes = {
  selectedVizTypeOption: PropTypes.object,
  setImageSource: PropTypes.func,
  setImageWarning: PropTypes.func,
  setUpdateCellMessage: PropTypes.func,
};

Options.propTypes = {
  selectedVizTypeOption: PropTypes.object,
  setImageSource: PropTypes.func,
  setImageWarning: PropTypes.func,
  setUpdateCellMessage: PropTypes.func,
};

export default CW3EPlotOptions;
