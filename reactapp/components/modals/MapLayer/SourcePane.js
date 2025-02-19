import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import { useState, useEffect } from "react";
import FileUpload from "components/inputs/FileUpload";
import styled from "styled-components";
import { sourcePropertiesOptions } from "components/map/utilities";
import InputTable from "components/inputs/InputTable";
import appAPI from "services/api/app";
import {
  removeEmptyValues,
  checkRequiredKeys,
} from "components/modals/utilities";
import "components/modals/wideModal.css";

const StyledTextInput = styled.textarea`
  width: 100%;
  height: 30vh;
`;

const generatePropertiesArrayWithValues = (sourceProperties, mapping) => {
  const properties = [];
  const placeholders = [];
  let existingValues = mapping ?? {};

  const processKeys = (obj, required, parentKey = "", mappingObj = {}) => {
    for (const [key, value] of Object.entries(obj)) {
      const property = parentKey ? `${parentKey} - ${key}` : key;
      const valueInMap = mappingObj[key];
      const existingValue = valueInMap?.value ?? valueInMap;

      if (typeof value === "object" && value !== null) {
        // Recursively process nested objects
        processKeys(value, required, property, existingValue || {});
      } else {
        // Add to the result array with mapped value or empty string
        properties.push({
          required,
          property,
          value: existingValue
            ? Array.isArray(existingValue)
              ? existingValue.join(",")
              : existingValue
            : "",
        });
        placeholders.push({ value: value });
      }
    }
  };

  // Process required and optional parts with mapping
  processKeys(sourceProperties.required, true, "", existingValues);
  processKeys(sourceProperties.optional, false, "", existingValues);

  return { properties, placeholders };
};

function parsePropertiesArray(properties) {
  return properties.reduce((acc, item) => {
    const { property, value } = item;
    const parts = property.split(" - "); // Split by delimiter

    // source properties can be {value: ..., placeholder:...} or just a straight value
    if (parts.length > 1) {
      const [parentKey, childKey] = parts.map((part) => part.trim());
      acc[parentKey] = acc[parentKey] || {};
      acc[parentKey][childKey] = value?.value ?? value;
    } else {
      acc[property] = value?.value ?? value;
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
  const [sourceProperties, setSourceProperties] = useState([]);
  const [propertyPlaceholders, SetPropertyPlaceholders] = useState([]);
  const [sourceType, setSourceType] = useState({});
  const [geoJSON, setGeoJSON] = useState("{}");

  useEffect(() => {
    (async () => {
      if (
        sourceProps.type === "GeoJSON" &&
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
  }, []);

  useEffect(() => {
    if (sourceProps.type) {
      const { properties, placeholders } = generatePropertiesArrayWithValues(
        sourcePropertiesOptions[sourceProps.type],
        sourceProps.props
      );
      setSourceProperties(properties);
      SetPropertyPlaceholders(placeholders);
      setSourceType({ value: sourceProps.type, label: sourceProps.type });
    }
  }, [sourceProps]);

  function handlePropertyChange({ newValue, rowIndex, field }) {
    const updatedSourceProperties = JSON.parse(
      JSON.stringify(sourceProperties)
    );
    updatedSourceProperties[rowIndex][field] = newValue;
    setSourceProperties(updatedSourceProperties);

    const parsedSourceProps = parsePropertiesArray(updatedSourceProperties);
    setSourceProps((previousSourceProps) => ({
      ...previousSourceProps,
      ...{
        props: removeEmptyValues(parsedSourceProps),
      },
    }));
  }

  function handleLayerTypeChange(e) {
    setSourceType(e);

    const { properties, placeholders } = generatePropertiesArrayWithValues(
      sourcePropertiesOptions[e.value],
      sourceProps.props
    );
    setSourceProperties(properties);
    SetPropertyPlaceholders(placeholders);

    const parsedSourceProps = parsePropertiesArray(properties);
    setSourceProps((previousSourceProps) => ({
      ...previousSourceProps,
      ...{
        type: e.value,
        props: removeEmptyValues(parsedSourceProps),
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
      <DataSelect
        label={"Source Type"}
        aria-label={"Source Type Input"}
        selectedOption={sourceType}
        onChange={handleLayerTypeChange}
        options={Object.keys(sourcePropertiesOptions).map((option) => ({
          value: option,
          label: option,
        }))}
      />

      {sourceType.value && (
        <>
          {sourceType.value === "GeoJSON" ? (
            <>
              <FileUpload
                label="Upload GeoJSON file"
                onFileUpload={handleGeoJSONUpload}
                extensionsAllowed={["json", "geojson"]}
              />
              <StyledTextInput
                aria-label={"geojson-source-text-area"}
                value={geoJSON}
                onChange={handleGeoJSONChange}
              />
            </>
          ) : (
            <InputTable
              label="Source Properties"
              onChange={handlePropertyChange}
              values={sourceProperties}
              disabledFields={["required", "property"]}
              allowRowCreation={true}
              placeholders={propertyPlaceholders}
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
