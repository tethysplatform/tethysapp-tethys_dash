import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import { useState, useEffect } from "react";
import FileUpload from "components/inputs/FileUpload";
import styled from "styled-components";
import {
  sourcePropertiesOptions,
  sourcePropType,
} from "components/map/utilities";
import InputTable from "components/inputs/InputTable";
import appAPI from "services/api/app";
import { removeEmptyValues } from "components/modals/utilities";
import "components/modals/wideModal.css";

const StyledTextInput = styled.textarea`
  width: 100%;
  height: 30vh;
`;

// loop through the properties of a source type and extract potential settings and placeholders, setting new values from existing values if applicable
const generatePropertiesArrayWithValues = (
  sourceProperties,
  existingPropertyValues
) => {
  const properties = [];
  const placeholders = [];
  const types = [];
  let existingValues = existingPropertyValues ?? {};

  const processKeys = (obj, required, parentKey = "", mappingObj = {}) => {
    // loop through each key/value pair in the object
    for (const [key, value] of Object.entries(obj)) {
      // if processing a nested object, combine the parent with the key to get a master key
      const property = parentKey ? `${parentKey} - ${key}` : key;

      // try to get existing value if present
      const valueInMap = mappingObj[key];
      const existingValue = valueInMap?.value ?? valueInMap;

      if (
        value &&
        typeof value === "object" &&
        !Object.keys(value).includes("placeholder")
      ) {
        processKeys(value, required, property, existingValue || {});
      } else {
        const propertyName = `${required ? "*" : ""}${property}`;
        // Add to the result array with mapped value or empty string
        properties.push({
          property: propertyName,
          value: existingValue
            ? Array.isArray(existingValue)
              ? existingValue.join(",")
              : existingValue
            : "",
        });
        placeholders.push({ value: value.placeholder });
        types.push(value?.type ?? "text");
      }
    }
  };

  // Process required and optional parts with existingValues
  processKeys(sourceProperties.required, true, "", existingValues);
  processKeys(sourceProperties.optional, false, "", existingValues);

  return { properties, placeholders, types };
};

// coverts a flat object of properties from the generatePropertiesArrayWithValues function into a nested object
function parsePropertiesArray(properties) {
  return properties.reduce((acc, item) => {
    let { property, value } = item;
    const parts = property.split(" - "); // Split by delimiter
    property = property.replace(/^\*/, "");

    // source properties can be {value: ..., placeholder:...} or just a straight value
    if (parts.length > 1) {
      let [parentKey, childKey] = parts.map((part) => part.trim());
      parentKey = parentKey.replace(/^\*/, "");
      acc[parentKey] = acc[parentKey] || {};
      acc[parentKey][childKey] = value?.value ?? value;
    } else {
      acc[property] = value?.value ?? value;
    }

    return acc;
  }, {});
}

const SourcePane = ({ sourceProps, setSourceProps, setAttributeProps }) => {
  const [sourceProperties, setSourceProperties] = useState([]); // array of objects that represent properties that will be rendered in the table
  const [propertyPlaceholders, SetPropertyPlaceholders] = useState([]); // array of objects that represent placeholders for the table inputs
  const [propertyTypes, SetPropertyTypes] = useState([]); // array of objects that represent types for the table inputs
  const [sourceType, setSourceType] = useState({}); // source type dropdown selection {value: ..., label: ...}
  const [geoJSON, setGeoJSON] = useState("{}"); // track the geojson value

  useEffect(() => {
    const fetchGeoJSON = async () => {
      const apiResponse = await appAPI.downloadJSON({
        filename: sourceProps.geojson,
      });
      setGeoJSON(JSON.stringify(apiResponse.data, null, 4));
      setSourceProps((previousSourceProps) => ({
        ...previousSourceProps,
        ...{ geojson: JSON.stringify(apiResponse.data) },
      }));
    };

    // if loading existing layer, then set states appropriately
    if (sourceProps.type) {
      const { properties, placeholders, types } =
        generatePropertiesArrayWithValues(
          sourcePropertiesOptions[sourceProps.type],
          sourceProps.props
        );
      setSourceProperties(properties);
      SetPropertyPlaceholders(placeholders);
      SetPropertyTypes(types);
      setSourceType({ value: sourceProps.type, label: sourceProps.type });
    }

    // if loading existing GeoJSON layer, then get JSON data and set states
    if (sourceProps.type === "GeoJSON" && sourceProps?.geojson) {
      fetchGeoJSON();
    }
    // eslint-disable-next-line
  }, [sourceProps]);

  function handlePropertyChange({ newValue, rowIndex, field }) {
    // update table values
    const updatedSourceProperties = JSON.parse(
      JSON.stringify(sourceProperties)
    );
    updatedSourceProperties[rowIndex][field] = newValue;
    setSourceProperties(updatedSourceProperties);

    // update layer source props
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

    // update table values and placeholders from new source type
    const { properties, placeholders, types } =
      generatePropertiesArrayWithValues(
        sourcePropertiesOptions[e.value],
        sourceProps.props
      );
    setSourceProperties(properties);
    SetPropertyPlaceholders(placeholders);
    SetPropertyTypes(types);

    // update layer source props
    const parsedSourceProps = parsePropertiesArray(properties);
    setSourceProps((previousSourceProps) => ({
      ...previousSourceProps,
      ...{
        type: e.value,
        props: removeEmptyValues(parsedSourceProps),
      },
    }));

    // reset attribute variable and omitted popup attributes since the source has changed
    setAttributeProps({});
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
            <>
              <InputTable
                label="Source Properties"
                onChange={handlePropertyChange}
                values={sourceProperties}
                disabledFields={["required", "property"]}
                placeholders={propertyPlaceholders}
                show_placeholder_on_hover={true}
                types={propertyTypes}
              />
              <p>
                <em>* indicates a required property</em>
              </p>
            </>
          )}
        </>
      )}
    </>
  );
};

SourcePane.propTypes = {
  sourceProps: sourcePropType,
  setSourceProps: PropTypes.func, // setter for sourceProps state
  setAttributeProps: PropTypes.func, // setter for attributeProps state
};

export default SourcePane;
