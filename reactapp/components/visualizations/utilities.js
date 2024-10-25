import appAPI from "services/api/app";
import BasePlot from "components/visualizations/BasePlot";
import DataTable from "components/visualizations/DataTable";
import Image from "components/visualizations/Image";
import styled from "styled-components";
import Card from "components/visualizations/Card";
import MapVisualization from "components/visualizations/MapVisualization";
import ModuleLoader from "./ModuleLoader";
import StyledLoader from "components/loader/StyledLoader";

const StyledH2 = styled.h2`
  text-align: center;
`;

export function setVisualization(setViz, itemData) {
  setViz(
    <StyledLoader
      width="200px"
      height="200px"
      centerDiameter="30px"
      innerArcDiameter="100px"
      outerArcDiameter="160px"
      innerMoonDiameter="10px"
      outerMoonDiameter="15px"
      innerMoonOrbit="45px"
      outerMoonOrbit="75px"
      fontSize="16pt"
      color="#007bff"
      innerSpin="12s"
      outerSpin="10s"
      borderWidth="3px"
    />
  );

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
            data={response.data.data} 
            title={response.data.title} 
            description={response.data.description}
          />
        ); 
      } else if (response["viz_type"] === "map") {
        setViz(
          <MapVisualization
            viewConfig={response.data.view_config}
            layers={response.data.layers}
            mapConfig={response.data.map_config}
            legend={response.data.legend}
          />
        );
      }
      else if(response["viz_type"] === "custom"){
        setViz(
          <ModuleLoader
            url={response.data.url}
            scope={response.data.scope}
            module={response.data.module}
            props={response.data.props}
          />
        );
      }
      else {
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
