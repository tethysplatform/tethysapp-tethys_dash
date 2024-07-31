import { useRef, useEffect } from "react";
import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import { CNRFCGauges } from "components/modals/utilities";
import setImage from "components/modals/DataViewerComponents/CNRFC/ImageOption";
import setImpactStatements from "components/modals/DataViewerComponents/CNRFC/ImpactStatementOption";
import setRiverForecastPlot from "components/modals/DataViewerComponents/CNRFC/RiverForecastPlotOption";
import setHEFSPlot from "components/modals/DataViewerComponents/CNRFC/HEFSPlotOption";

function Options({
  selectedVizTypeOption,
  label,
  selectedOption,
  onChange,
  options,
}) {
  if (selectedVizTypeOption["value"]["fullURL"] || null) {
    return null;
  } else {
    return (
      <DataSelect
        label={label}
        selectedOption={selectedOption}
        onChange={onChange}
        options={options}
      />
    );
  }
}

function CNRFCPlotOptions({
  selectedVizTypeOption,
  setViz,
  setVizMetadata,
  setUpdateCellMessage,
}) {
  const selectedLocationOption = useRef(null);
  const locationNeeded = useRef(false);

  useEffect(() => {
    if (selectedVizTypeOption["value"]["fullURL"] || null) {
      locationNeeded.current = false;
    } else {
      locationNeeded.current = true;
    }

    if (
      (locationNeeded.current && selectedLocationOption.current) ||
      !locationNeeded.current
    ) {
      getVisualization();
    }
    // eslint-disable-next-line
  }, [selectedVizTypeOption]);

  function onLocationChange(e) {
    selectedLocationOption.current = e;
    getVisualization();
  }

  function getVisualization() {
    setViz(null);
    setVizMetadata(null);
    if (selectedVizTypeOption["label"] === "River Forecast Plot") {
      setRiverForecastPlot(
        setUpdateCellMessage,
        selectedLocationOption,
        setViz,
        setVizMetadata
      );
    } else if (selectedVizTypeOption["label"] === "HEFS Plot") {
      setHEFSPlot(
        setUpdateCellMessage,
        selectedLocationOption,
        setViz,
        setVizMetadata
      );
    } else if (selectedVizTypeOption["label"] === "Impact Statements") {
      setImpactStatements(
        setUpdateCellMessage,
        selectedLocationOption,
        setViz,
        setVizMetadata
      );
    } else {
      setImage(
        selectedVizTypeOption,
        setUpdateCellMessage,
        selectedLocationOption,
        setViz,
        setVizMetadata
      );
    }
  }

  const locationOptions = CNRFCGauges;

  return (
    <Options
      label="Location"
      selectedOption={selectedLocationOption.current}
      selectedVizTypeOption={selectedVizTypeOption}
      onChange={onLocationChange}
      options={locationOptions}
    />
  );
}

CNRFCPlotOptions.propTypes = {
  selectedVizTypeOption: PropTypes.object,
  setViz: PropTypes.func,
  setVizMetadata: PropTypes.func,
  setUpdateCellMessage: PropTypes.func,
};

Options.propTypes = {
  selectedVizTypeOption: PropTypes.object,
  label: PropTypes.string,
  selectedOption: PropTypes.object,
  onChange: PropTypes.func,
  options: PropTypes.array,
};

export default CNRFCPlotOptions;
