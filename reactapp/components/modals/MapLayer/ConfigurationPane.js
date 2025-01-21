import PropTypes from "prop-types";
import DataInput from "components/inputs/DataInput";
import { useState, useEffect } from "react";
import FileUpload from "components/inputs/FileUpload";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";
import { layerTypeProperties } from "components/map/utilities";
import InputTable from "components/inputs/InputTable";
import appAPI from "services/api/app";
import "components/modals/wideModal.css";

const layerTypes = [
  "ImageArcGISRest",
  "ImageWMS",
  "ImageTile",
  "GeoJSON",
  "VectorTile",
];

const StyledTextInput = styled.textarea`
  width: 100%;
  height: 30vh;
`;

const StyledP = styled.p`
  margin-bottom: 1rem;
  text-align: center;
`;

const StyledDiv = styled.div`
  margin-bottom: 1rem;
`;

const setEmptyValues = (obj) => {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      typeof value === "object" && value !== null
        ? setEmptyValues(value) // Recursive call for nested objects
        : "",
    ])
  );
};

const generatePropertiesArrayWithValues = (properties, mapping) => {
  const result = [];

  const processKeys = (obj, required, parentKey = "", mappingObj = {}) => {
    for (const [key, value] of Object.entries(obj)) {
      const property = parentKey ? `${parentKey} - ${key}` : key;

      if (typeof value === "object" && value !== null) {
        // Recursively process nested objects
        processKeys(value, required, property, mappingObj[key] || {});
      } else {
        // Add to the result array with mapped value or empty string
        result.push({
          required,
          property,
          value: mappingObj[key] || "",
          placeholder: value,
        });
      }
    }
  };

  // Process required and optional parts with mapping
  processKeys(properties.required, true, "", mapping);
  processKeys(properties.optional, false, "", mapping);

  return result;
};

const ConfigurationPane = ({ layerInfo, setLayerInfo }) => {
  const [layerType, setLayerType] = useState(layerInfo.layerType ?? null);
  const [layerTypeArgs, setLayerTypeArgs] = useState(
    layerInfo.layerType
      ? layerTypeProperties[layerInfo.layerType]
      : {
          required: {},
          optional: {},
        }
  );
  const [layerTypeArgResults, setLayerTypeResults] = useState(
    layerInfo.layerType
      ? loadExistingArgs(layerInfo.layerType, layerInfo.sourceProps)
      : {}
  );
  const [layerPropertiesArray, setLayerPropertiesArray] = useState(
    layerInfo.layerType
      ? generatePropertiesArrayWithValues(
          layerTypeProperties[layerInfo.layerType],
          layerInfo.sourceProps
        )
      : []
  );
  const [name, setName] = useState(layerInfo.name ?? "");
  const [geoJSON, setGeoJSON] = useState("{}");

  useEffect(() => {
    (async () => {
      if (layerType === "GeoJSON") {
        if (layerInfo.url.split(".").pop() === "json" && geoJSON === "{}") {
          const apiResponse = await appAPI.downloadGeoJSON({
            filename: layerInfo.url,
          });
          setGeoJSON(JSON.stringify(apiResponse.data, null, 4));
        }
      }
    })();
    layerInfo.url = `${uuidv4()}.json`;
    layerInfo.geojson = geoJSON;
  }, [geoJSON]);

  function loadExistingArgs(sourceType, sourceProps) {
    const newLayerTypeResults = setEmptyValues({
      ...layerTypeProperties[sourceType].required,
      ...layerTypeProperties[sourceType].optional,
      params: {
        ...layerTypeProperties[sourceType].required.params,
        ...layerTypeProperties[sourceType].optional.params,
      },
    });
    return { ...newLayerTypeResults, ...sourceProps };
  }

  function handlePropertyChange(updatedUserInputs) {
    const updatedLayerTypeArgResults = { ...layerTypeArgResults };
    updatedUserInputs.forEach(({ property, value }) => {
      const keys = property.split(" - "); // Split property for nested keys
      let current = updatedLayerTypeArgResults;

      // Traverse to the right level in the target object
      keys.forEach((key, index) => {
        if (index === keys.length - 1) {
          // Update the final key with the value
          current[key] = value;
        } else {
          // Move deeper into the nested object
          current = current[key];
        }
      });
    });
    setLayerTypeResults(updatedLayerTypeArgResults);
    setLayerInfo((previousLayerInfo) => ({
      ...previousLayerInfo,
      ...{ sourceProps: updatedLayerTypeArgResults },
    }));
  }

  function handleLayerTypeChange(e) {
    setLayerType(e.value);
    const newLayerTypeArgs = layerTypeProperties[e.value];
    setLayerTypeArgs(newLayerTypeArgs);
    const newLayerTypeResults = loadExistingArgs(e.value, layerTypeArgResults);
    setLayerTypeResults(newLayerTypeResults);
    const newLayerPropertiesArray = generatePropertiesArrayWithValues(
      newLayerTypeArgs,
      layerTypeArgResults
    );
    setLayerPropertiesArray(newLayerPropertiesArray);
    setLayerInfo((previousLayerInfo) => ({
      ...previousLayerInfo,
      ...{ layerType: e.value, sourceProps: newLayerTypeResults },
    }));
  }

  function handleGeoJSONUpload({ fileContent }) {
    setGeoJSON(fileContent);
  }

  function handleGeoJSONChange(e) {
    setGeoJSON(e.target.value);
  }

  return (
    <>
      <DataInput
        objValue={{ label: "Name", type: "text", value: name }}
        onChange={(e) => {
          setName(e);
          setLayerInfo((previousLayerInfo) => ({
            ...previousLayerInfo,
            ...{ name: e },
          }));
        }}
      />
      <DataInput
        objValue={{
          label: "Layer Type",
          type: layerTypes,
          value: layerType,
        }}
        onChange={handleLayerTypeChange}
        includeVariableInputs={false}
      />
      {layerType && (
        <>
          {layerType === "GeoJSON" ? (
            <>
              <FileUpload
                label="Upload GeoJSON file"
                onFileUpload={handleGeoJSONUpload}
                extensionsAllowed={["json", "geojson"]}
              />
              <StyledTextInput value={geoJSON} onChange={handleGeoJSONChange} />
            </>
          ) : (
            <InputTable
              label="Layer Properties"
              onChange={handlePropertyChange}
              values={layerPropertiesArray}
              disabledFields={["required", "property"]}
              hiddenFields={["placeholder"]}
              staticRows={true}
              placeholders={layerPropertiesArray.map((item) => [
                null,
                null,
                item.placeholder,
                null,
              ])}
            />
          )}
        </>
      )}
    </>
  );
};

ConfigurationPane.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
    PropTypes.object,
  ]),
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
};

export default ConfigurationPane;
