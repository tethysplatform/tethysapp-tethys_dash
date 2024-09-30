import appAPI from "services/api/app";
import BasePlot from "components/visualizations/BasePlot";
import DataTable from "components/visualizations/DataTable";
import Image from "components/visualizations/Image";
import Spinner from "react-bootstrap/Spinner";
import styled from "styled-components";
import Card from "components/visualizations/Card";
import MapVisualization from "components/visualizations/MapVisualization";

const StyledSpinner = styled(Spinner)`
  margin: auto;
  display: block;
`;

const StyledH2 = styled.h2`
  text-align: center;
`;

export function setVisualization(setViz, itemData) {
  setViz(<StyledSpinner animation="border" variant="info" />);
  appAPI.getPlotData(itemData).then((response) => {
    if (response.success === true) {
      if (response["viz_type"] === "plotly") {
        const plotData = {
          data: response.data.data,
          layout: response.data.layout,
        };
        setViz(<BasePlot plotData={plotData} />);
      } else if (response["viz_type"] === "image") {
        setViz(<Image source={response.data} />);
      } else if (response["viz_type"] === "table") {
        setViz(
          <DataTable data={response.data.data} title={response.data.title} />
        );
      
      } else if (response["viz_type"] === "card") {
        setViz(
          <Card
            data={response.data.data} title={response.data.title}
          />
        ); 
      } else if (response["viz_type"] === "map") {
        console.log(response.data.layers);
          setViz(
            <MapVisualization 
              layers={response.data.layers}
          />
        );
      }else {
        let message =
          response["viz_type"] + " visualizations still need to be configured";
        setViz(<StyledH2>{message}</StyledH2>);
      }
    } else {
      setViz(<StyledH2>Failed to retrieve data</StyledH2>);
    }
  });
}
