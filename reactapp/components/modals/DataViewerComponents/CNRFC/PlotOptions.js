import { useRef, useEffect } from "react";
import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import BasePlot from "components/visualizations/BasePlot";
import { CNRFCGauges } from "components/modals/utilities";
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

function CNRFCPlotOptions({
  selectedVizTypeOption,
  setImageSource,
  setImageWarning,
  setViz,
  setVizMetadata,
  setUpdateCellMessage,
}) {
  const selectedLocationOption = useRef(null);

  useEffect(() => {
    if (selectedLocationOption.current) {
      getVisualization();
    }
  }, [selectedVizTypeOption]);

  function onLocationChange(e) {
    setImageWarning(null);
    selectedLocationOption.current = e;
    getVisualization();
  }

  function getVisualization() {
    if (selectedVizTypeOption["label"] === "River Forecast Plot") {
      setImageSource(null);
      setImageWarning(null);
      getPlot();
    } else {
      setViz(null);
      setVizMetadata(null);
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
    const location = selectedVizTypeOption["value"]["lowercase"]
      ? selectedLocationOption.current["value"].toLowerCase()
      : selectedLocationOption.current["value"];
    const imageURL =
      selectedVizTypeOption["value"]["baseURL"] +
      location +
      selectedVizTypeOption["value"]["plotName"];
    setUpdateCellMessage(
      "Cell updated to show " +
        selectedVizTypeOption["label"] +
        " plot at " +
        selectedLocationOption.current["label"]
    );
    setImageSource(imageURL);
  }

  const locationOptions = CNRFCGauges;

  return (
    <DataSelect
      label="Location"
      selectedDataTypeOption={selectedLocationOption.current}
      onChange={onLocationChange}
      options={locationOptions}
    />
  );
}

CNRFCPlotOptions.propTypes = {
  setImageSource: PropTypes.func,
  setImageWarning: PropTypes.func,
  setViz: PropTypes.func,
  setVizMetadata: PropTypes.func,
  setUpdateCellMessage: PropTypes.func,
};

export default CNRFCPlotOptions;
