import appAPI from "services/api/app";
import { spaceAndCapitalize } from "components/modals/utilities";

function checkForEmptyVariableInputs({
  metadata,
  argsString,
  variableInputValues,
}) {
  const dependentVariableInputs = getDependentVariableInputs(argsString);

  if (!dependentVariableInputs.every((key) => key in variableInputValues)) {
    const warnings = [];
    for (const dependentVariableInput of dependentVariableInputs) {
      if (!variableInputValues[dependentVariableInput]) {
        warnings.push(
          metadata.customMessaging?.[dependentVariableInput] ??
            `${dependentVariableInput} variable is empty`
        );
      }
    }
    return warnings;
  }

  return null;
}

function getDependentVariableInputs(args) {
  const regex = /\${(.*?)}/g; // Matches ${...}
  const uniqueValues = new Set();

  let match;
  while ((match = regex.exec(args)) !== null) {
    uniqueValues.add(match[1]); // Extract the variable name
  }

  return [...uniqueValues];
}

export async function getVisualization({
  setVizType,
  setVizData,
  sourceType,
  itemData,
  metadataString,
  argsString,
  variableInputValues,
  dashboardView,
}) {
  const metadata = JSON.parse(metadataString);
  const emptyVariableWarnings = checkForEmptyVariableInputs({
    metadata,
    argsString,
    variableInputValues,
  });
  if (emptyVariableWarnings) {
    setVizType("vizWarning");
    setVizData({
      warnings: emptyVariableWarnings,
    });
    return;
  }

  if (sourceType !== "map") {
    setVizType("loader");
  }

  const apiResponse = await appAPI.getPlotData(itemData);
  if (apiResponse.success === true) {
    let responseData = JSON.parse(JSON.stringify(apiResponse.data));
    if (typeof apiResponse.data === "string") {
      responseData = { value: apiResponse.data };
    }

    if (dashboardView) {
      responseData = updateObjectWithVariableInputs(
        responseData,
        variableInputValues
      );
    }

    if (typeof apiResponse.data === "string") {
      responseData = responseData.value;
    }

    if (apiResponse.viz_type === "plotly") {
      setVizType("plotly");
      setVizData({
        data: responseData.data,
        layout: responseData.layout,
        config: responseData.config,
      });
    } else if (apiResponse.viz_type === "card") {
      setVizType("card");
      setVizData({
        data: responseData.data,
        title: responseData.title,
        description: responseData.description,
      });
    } else if (apiResponse.viz_type === "table") {
      setVizType("table");
      setVizData({
        data: responseData.data,
        title: responseData.title,
        subtitle: responseData.subtitle,
      });
    } else if (apiResponse.viz_type === "image") {
      setVizType("image");
      setVizData({
        source: responseData,
        alt: itemData.source,
        imageError: metadata.customMessaging?.error,
      });
    } else if (apiResponse.viz_type === "map") {
      setVizType("map");
      setVizData({
        mapConfig: responseData.mapConfig,
        map_extent: responseData.map_extent,
        layers: responseData.layers,
        baseMap: responseData.baseMap,
        layerControl: responseData.layerControl,
      });
    } else if (apiResponse.viz_type === "custom") {
      setVizType("custom");
      setVizData({
        url: responseData.url,
        scope: responseData.scope,
        module: responseData.module,
        props: responseData.props,
      });
    } else if (apiResponse.viz_type === "text") {
      setVizType("text");
      setVizData({
        text: responseData.text,
      });
    } else if (apiResponse.viz_type === "variable_input") {
      setVizType("variableInput");
      setVizData({
        variable_name: responseData.variable_name,
        initial_value: responseData.initial_value,
        variable_options_source: responseData.variable_options_source,
      });
    } else {
      setVizType("vizWarning");
      setVizData({
        warnings: [
          `${apiResponse.viz_type} visualizations still need to be configured`,
        ],
      });
    }
  } else {
    setVizType("vizError");
    setVizData({
      error: metadata.customMessaging?.error ?? "Failed to retrieve data",
    });
  }
}

export function getGridItem(gridItems, gridItemI) {
  var result = gridItems.find((obj) => {
    return obj.i === gridItemI;
  });

  return result;
}

export function updateObjectWithVariableInputs(args, variableInputs) {
  for (let gridItemsArg in args) {
    let value = args[gridItemsArg];

    if (typeof value !== "string") {
      value = JSON.stringify(value);
    }
    let updatedValuesWithVariableInputs = value.replace(
      /\$\{([^}]+)\}/g,
      (_, key) =>
        typeof variableInputs[key] === "object"
          ? JSON.stringify(variableInputs[key])
          : (variableInputs[key] ?? "")
    );

    if (typeof args[gridItemsArg] !== "string") {
      updatedValuesWithVariableInputs = JSON.parse(
        updatedValuesWithVariableInputs
      );
    }
    args[gridItemsArg] = updatedValuesWithVariableInputs;
  }

  return args;
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
        type: "Image Tile",
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

export function findSelectOptionByValue(
  data,
  searchValue,
  searchKey = "value"
) {
  for (const element of data) {
    if (element[searchKey] === searchValue || element === searchValue) {
      return element; // Return the matching element
    }

    if (element.options && Array.isArray(element.options)) {
      const found = findSelectOptionByValue(
        element.options,
        searchValue,
        searchKey
      ); // Recursively search in options
      if (found) {
        return found; // Return the matching element from nested options
      }
    }
  }
  return null; // Return null if no match is found
}

export function downloadJSONFile(data, filename) {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}
