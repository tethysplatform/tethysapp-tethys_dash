import PropTypes from "prop-types";
import DataInput from "components/inputs/DataInput";
import { useState, useEffect } from "react";
import FileUpload from "components/inputs/FileUpload";
import styled from "styled-components";
import {
  sourcePropertiesOptions,
  layerPropertiesOptions,
} from "components/map/utilities";
import InputTable from "components/inputs/InputTable";
import appAPI from "services/api/app";
import "components/modals/wideModal.css";

const StyledTextInput = styled.textarea`
  width: 100%;
  height: 30vh;
`;

const generatePropertiesArrayWithValues = (properties, mapping) => {
  const result = [];
  let existingValues = mapping ?? {};

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
          value: mappingObj[key]
            ? Array.isArray(mappingObj[key])
              ? mappingObj[key].join(",")
              : mappingObj[key]
            : "",
          placeholder: value,
        });
      }
    }
  };

  // Process required and optional parts with mapping
  processKeys(properties.required, true, "", existingValues);
  processKeys(properties.optional, false, "", existingValues);

  return result;
};

function parsePropertiesArray(properties) {
  return properties.reduce((acc, item) => {
    const { property, value } = item;
    const parts = property.split(" - "); // Split by delimiter

    if (parts.length > 1) {
      const [parentKey, childKey] = parts.map((part) => part.trim());
      acc[parentKey] = acc[parentKey] || {};
      acc[parentKey][childKey] = value;
    } else {
      acc[property] = value;
    }

    return acc;
  }, {});
}

const SourcePane = ({
  sourceProps,
  setSourceProps,
  setAttributeVariables,
  setOmittedPopupAttributes,
}) => {
  const [sourceProperties, setSourceProperties] = useState(
    sourceProps?.type
      ? generatePropertiesArrayWithValues(
          sourcePropertiesOptions[sourceProps.type],
          sourceProps.props
        )
      : []
  );
  const [sourceType, setSourceType] = useState(sourceProps?.type ?? null);
  const [geoJSON, setGeoJSON] = useState("{}");

  useEffect(() => {
    (async () => {
      if (
        sourceType === "GeoJSON" &&
        geoJSON === "{}" &&
        sourceProps?.geojson
      ) {
        const apiResponse = await appAPI.downloadJSON({
          filename: sourceProps.geojson,
        });
        setGeoJSON(JSON.stringify(apiResponse.data, null, 4));
        setSourceProps((previousSourceProps) => ({
          ...previousSourceProps,
          ...{ geojson: JSON.stringify(apiResponse.data) },
        }));
      }
    })();
  }, [geoJSON]);

  function handlePropertyChange(newSourceProperties) {
    setSourceProperties(newSourceProperties);

    const parsedSourceProps = parsePropertiesArray(newSourceProperties);
    setSourceProps((previousSourceProps) => ({
      ...previousSourceProps,
      ...{
        props: parsedSourceProps,
      },
    }));
  }

  function handleLayerTypeChange(e) {
    setSourceType(e.value);

    const newSourceProperties = generatePropertiesArrayWithValues(
      sourcePropertiesOptions[e.value],
      sourceProps.props
    );
    setSourceProperties(newSourceProperties);

    const parsedSourceProps = parsePropertiesArray(newSourceProperties);
    setSourceProps((previousSourceProps) => ({
      ...previousSourceProps,
      ...{
        type: e.value,
        props: parsedSourceProps,
      },
    }));
    setAttributeVariables({});
    setOmittedPopupAttributes({});
  }

  function handleGeoJSONUpload({ fileContent }) {
    setGeoJSON(fileContent);
    setSourceProps((previousSourceProps) => ({
      ...previousSourceProps,
      ...{ geojson: fileContent },
    }));
  }

  function handleGeoJSONChange(e) {
    setGeoJSON(e.target.value);
    setSourceProps((previousSourceProps) => ({
      ...previousSourceProps,
      ...{ geojson: e.target.value },
    }));
  }

  return (
    <>
      <DataInput
        objValue={{
          label: "Source Type",
          type: Object.keys(sourcePropertiesOptions),
          value: sourceType,
        }}
        onChange={handleLayerTypeChange}
        includeVariableInputs={false}
      />
      {sourceType && (
        <>
          {sourceType === "GeoJSON" ? (
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
              label="Source Properties"
              onChange={handlePropertyChange}
              values={sourceProperties}
              disabledFields={["required", "property"]}
              hiddenFields={["placeholder"]}
              staticRows={true}
              placeholders={sourceProperties.map((item) => [
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

SourcePane.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
    PropTypes.object,
  ]),
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
};

export default SourcePane;
