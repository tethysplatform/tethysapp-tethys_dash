import styled from "styled-components";
import Spinner from "react-bootstrap/Spinner";
import appAPI from "services/api/app";
import getCNRFCRiverForecastPlotInfo from "components/visualizations/CNRFCRiverForecastPlot";
import BasePlot from "components/visualizations/BasePlot";

const StyledSpinner = styled(Spinner)`
  margin: auto;
  display: block;
`;

const StyledH2 = styled.h2`
  text-align: center;
`;

function setRiverForecastPlot(
  setUpdateCellMessage,
  selectedLocationOption,
  setViz,
  setVizMetadata
) {
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

export default setRiverForecastPlot;
