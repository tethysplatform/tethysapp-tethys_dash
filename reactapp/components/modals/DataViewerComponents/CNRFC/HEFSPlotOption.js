import styled from "styled-components";
import Spinner from "react-bootstrap/Spinner";
import appAPI from "services/api/app";
import getCNRFCHEFSPlotInfo from "components/visualizations/CNRFCHEFSPlot";
import BasePlot from "components/visualizations/BasePlot";

const StyledSpinner = styled(Spinner)`
  margin: auto;
  display: block;
`;

const StyledH2 = styled.h2`
  text-align: center;
`;

function setHEFSPlot(
  setUpdateCellMessage,
  selectedLocationOption,
  setViz,
  setVizMetadata
) {
  setViz(<StyledSpinner animation="border" variant="info" />);
  const itemData = {
    type: "CNRFCHEFSPlot",
    metadata: {
      location: selectedLocationOption.current["value"],
      location_proper_name: selectedLocationOption.current["label"],
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
      let plotInfo = getCNRFCHEFSPlotInfo(
        response.data,
        selectedLocationOption.current["label"]
      );

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

export default setHEFSPlot;
