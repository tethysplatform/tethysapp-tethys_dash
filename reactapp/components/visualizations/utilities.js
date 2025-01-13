import appAPI from "services/api/app";
import BasePlot from "components/visualizations/BasePlot";
import DataTable from "components/visualizations/DataTable";
import Image from "components/visualizations/Image";
import styled from "styled-components";
import Card from "components/visualizations/Card";
import MapVisualization from "components/visualizations/Map";
import ModuleLoader from "./ModuleLoader";
import Spinner from "react-bootstrap/Spinner";
import { spaceAndCapitalize } from "components/modals/utilities";

const StyledSpinner = styled(Spinner)`
  margin: auto;
  display: block;
`;

const StyledH2 = styled.h2`
  text-align: center;
`;

export function setVisualization(setViz, itemData, visualizationRef) {
  setViz(
    <StyledSpinner data-testid="Loading..." animation="border" variant="info" />
  );

  appAPI.getPlotData(itemData).then((response) => {
    if (response.success === true) {
      if (response["viz_type"] === "plotly") {
        const plotData = {
          data: response.data.data,
          layout: response.data.layout,
        };
        setViz(
          <BasePlot plotData={plotData} visualizationRef={visualizationRef} />
        );
      } else if (response["viz_type"] === "image") {
        setViz(
          <Image
            source={response.data}
            alt={itemData.source}
            visualizationRef={visualizationRef}
          />
        );
      } else if (response["viz_type"] === "table") {
        setViz(
          <DataTable
            data={response.data.data}
            title={response.data.title}
            visualizationRef={visualizationRef}
          />
        );
      } else if (response["viz_type"] === "card") {
        setViz(
          <Card
            data={response.data.data}
            title={response.data.title}
            description={response.data.description}
            visualizationRef={visualizationRef}
          />
        );
      } else if (response["viz_type"] === "map") {
        setViz(
          <MapVisualization
            viewConfig={response.data.viewConfig}
            layers={response.data.layers}
            mapConfig={response.data.mapConfig}
            legend={response.data.legend}
            visualizationRef={visualizationRef}
          />
        );
      } else if (response["viz_type"] === "custom") {
        setViz(
          <ModuleLoader
            url={response.data.url}
            scope={response.data.scope}
            module={response.data.module}
            props={response.data.props}
            visualizationRef={visualizationRef}
          />
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
    const stringifiedValue = JSON.stringify(value);
    const updatedValuesWithVariableInputs = JSON.parse(
      stringifiedValue.replace(
        /\$\{([^}]+)\}/g,
        (_, key) => variableInputs[key] || ""
      )
    );
    gridItemsArgs[gridItemsArg] = updatedValuesWithVariableInputs;
  }

  return gridItemsArgs;
}

export const nonDropDownVariableInputTypes = ["text", "number", "checkbox"];

export const baseMapLayers = [
  {
    label: "ArcGIS Map Service Base Maps",
    options: [
      {
        label: "World Light Gray Base",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer",
      },
      {
        label: "World Dark Gray Base",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer",
      },
      {
        label: "World Topo Map",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer",
      },
      {
        label: "World Imagery",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer",
      },
      {
        label: "World Terrain Base",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/World_Terrain_Base/MapServer",
      },
      {
        label: "World Street Map",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/World_Street_Map/MapServer",
      },
      {
        label: "World Physical Map",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/World_Physical_Map/MapServer",
      },
      {
        label: "World Shaded Relief",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/World_Shaded_Relief/MapServer",
      },
      {
        label: "World Terrain Reference",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/World_Terrain_Reference/MapServer",
      },
      {
        label: "World Hillshade Dark",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade_Dark/MapServer",
      },
      {
        label: "World Hillshade",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer",
      },
      {
        label: "World Boundaries and Places Alternate",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places_Alternate/MapServer",
      },
      {
        label: "World Boundaries and Places",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer",
      },
      {
        label: "World Reference Overlay",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/Reference/World_Reference_Overlay/MapServer",
      },
      {
        label: "World Transportation",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/Reference/World_Transportation/MapServer",
      },
      {
        label: "World Ocean Base ",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer",
      },
      {
        label: "World Ocean Reference",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Reference/MapServer",
      },
    ],
  },
];

export function getBaseMapLayer(baseMapURL) {
  if (!baseMapURL.includes("/")) return null;

  const baseMapURLSplit = baseMapURL.split("/");
  const baseMapName = spaceAndCapitalize(
    baseMapURLSplit[baseMapURLSplit.length - 2]
  );
  const layer_dict = {
    type: "WebGLTile",
    props: {
      source: {
        type: "ImageTile",
        props: {
          url: baseMapURL + "/tile/{z}/{y}/{x}",
          attributions: 'Tiles © <a href="' + baseMapURL + '">ArcGIS</a>',
        },
      },
      name: baseMapName,
    },
  };

  return layer_dict;
}

export function findSelectOptionByValue(data, searchValue) {
  for (const element of data) {
    if (element.value === searchValue) {
      return element; // Return the matching element
    }
    if (element.options && Array.isArray(element.options)) {
      const found = findSelectOptionByValue(element.options, searchValue); // Recursively search in options
      if (found) {
        return found; // Return the matching element from nested options
      }
    }
  }
  return null; // Return null if no match is found
}

export function getMapAttributeVariables(mapLayers) {
  let mapAttributeVariables = [];
  // loop through all map layers
  for (let mapLayer of mapLayers) {
    // loop through all map layers/sublayers
    for (const mapLayerName in mapLayer.attributeVariables) {
      // get all the variable inputs setup from the layer/sublayer attributes
      const layerAttributeVariables = Object.values(
        mapLayer.attributeVariables[mapLayerName]
      );
      mapAttributeVariables = [
        ...mapAttributeVariables,
        ...layerAttributeVariables,
      ];
    }
  }
  return mapAttributeVariables;
}
