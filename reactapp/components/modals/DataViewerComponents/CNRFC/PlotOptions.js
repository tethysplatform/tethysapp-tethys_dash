import { useRef, useEffect } from "react";
import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import BasePlot from "components/visualizations/BasePlot";
import { CNRFCGauges } from "components/modals/utilities";
import Image from "components/visualizations/Image";
import appAPI from "services/api/app";
import getCNRFCRiverForecastPlotInfo from "components/visualizations/CNRFCRiverForecastPlot";
import Spinner from "react-bootstrap/Spinner";
import styled from "styled-components";

const StyledSpinner = styled(Spinner)`
  margin: auto;
  display: block;
`;

const StyledH2 = styled.h2`
  text-align: center;
`;

function Options({
  selectedVizTypeOption,
  label,
  selectedOption,
  onChange,
  options,
}) {
  if (selectedVizTypeOption["value"]["baseURL"] || null) {
    return (
      <DataSelect
        label={label}
        selectedOption={selectedOption}
        onChange={onChange}
        options={options}
      />
    );
  } else {
    return null;
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
      getPlot();
    } else {
      getImageURL();
    }
  }

  function getPlot() {
    setViz(<StyledSpinner animation="border" variant="info" />);
    const itemData = {
      type: "CNRFCRiverForecastPlot",
      metadata: {
        location: selectedLocationOption.current["value"],
      },
    };
    setVizMetadata(itemData);
    setUpdateCellMessage(
      "Cell updated to show CNRFC River Forecast plot at " +
        selectedLocationOption.current["label"] +
        "."
    );
    appAPI.getPlotData(itemData).then((response) => {
      if (response.success === true) {
        let plotInfo = getCNRFCRiverForecastPlotInfo(response.data);

        const plotData = {
          data: plotInfo["traces"],
          layout: plotInfo["layout"],
          config: plotInfo["configOptions"],
        };
        setViz(<BasePlot plotData={plotData} rowHeight={100} colWidth={12} />);
      } else {
        setViz(<StyledH2>Failed to retrieve data</StyledH2>);
      }
    });
  }

  function getImageURL() {
    let imageURL;
    if (selectedVizTypeOption["value"]["fullURL"] || null) {
      imageURL = selectedVizTypeOption["value"]["fullURL"];
      setUpdateCellMessage(
        "Cell updated to show " + selectedVizTypeOption["label"]
      );
    } else {
      const location = selectedVizTypeOption["value"]["lowercase"]
        ? selectedLocationOption.current["value"].toLowerCase()
        : selectedLocationOption.current["value"];
      imageURL =
        selectedVizTypeOption["value"]["baseURL"] +
        location +
        selectedVizTypeOption["value"]["plotName"];
      setUpdateCellMessage(
        "Cell updated to show " +
          selectedVizTypeOption["label"] +
          " plot at " +
          selectedLocationOption.current["label"]
      );
    }
    setViz(<Image source={imageURL} />);
    const itemData = {
      type: "Image",
      metadata: {
        uri: imageURL,
      },
    };
    setVizMetadata(itemData);
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
