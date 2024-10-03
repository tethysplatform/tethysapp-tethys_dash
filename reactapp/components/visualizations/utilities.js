import appAPI from "services/api/app";
import BasePlot from "components/visualizations/BasePlot";
import DataTable from "components/visualizations/DataTable";
import Image from "components/visualizations/Image";
import Spinner from "react-bootstrap/Spinner";
import styled from "styled-components";

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
      } else {
        let message =
          response["viz_type"] + " visualizations still need to be configured";
        setViz(<StyledH2>{message}</StyledH2>);
      }
    } else {
      setViz(<StyledH2>Failed to retrieve data</StyledH2>);
    }
  });
}

export function getGridItem(gridItems, gridItemI) {
  var result = gridItems.find((obj) => {
    return obj.i === gridItemI;
  });

  return result;
}

export function updateGridItemArgsWithVariableInputs(
  argsString,
  variableInputs
) {
  const gridItemsArgs = JSON.parse(argsString);
  for (let gridItemsArg in gridItemsArgs) {
    const value = gridItemsArgs[gridItemsArg];
    if (typeof value !== "string") {
      continue;
    }
    if (value.includes("Variable Input:")) {
      const neededVariable = value.replace("Variable Input:", "");
      gridItemsArgs[gridItemsArg] = variableInputs[neededVariable];
    }
  }

  return gridItemsArgs;
}

export const nonDropDownVariableInputTypes = ["text", "number", "checkbox"];
