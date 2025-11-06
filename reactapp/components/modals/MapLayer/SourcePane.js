import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import { useState, useEffect, memo, useContext } from "react";
import FileUpload from "components/inputs/FileUpload";
import styled from "styled-components";
import {
  sourcePropertiesOptions,
  sourcePropType,
} from "components/map/utilities";
import InputTable from "components/inputs/InputTable";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import NormalInput from "components/inputs/NormalInput";
import appAPI from "services/api/app";
import { removeEmptyValues } from "components/modals/utilities";
import { LayoutContext } from "components/contexts/Contexts";
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

  const processKeys = (obj, required, parentKey, mappingObj) => {
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

const SourcePane = ({
  sourceProps,
  setSourceProps,
  setAttributeProps,
  setErrorMessage,
}) => {
  const [sourceProperties, setSourceProperties] = useState([]); // array of objects that represent properties that will be rendered in the table
  const [propertyPlaceholders, SetPropertyPlaceholders] = useState([]); // array of objects that represent placeholders for the table inputs
  const [propertyTypes, SetPropertyTypes] = useState([]); // array of objects that represent types for the table inputs
  const [sourceType, setSourceType] = useState({}); // source type dropdown selection {value: ..., label: ...}
  const [geoJSON, setGeoJSON] = useState("{}"); // track the geojson value
  const [geoJSONSource, setGeoJSONSource] = useState("custom"); // track the geojson value
  const { uuid } = useContext(LayoutContext);

  useEffect(() => {
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
    // eslint-disable-next-line
  }, [sourceProps.type]);

  useEffect(() => {
    const fetchGeoJSON = async () => {
      if (sourceProps.geojson.includes("/")) {
        const response = await fetch(sourceProps.geojson);
        if (!response.ok) {
          setErrorMessage("Failed to retrieve JSON");
        }
        setGeoJSON(sourceProps.geojson);
        setSourceProps((previousSourceProps) => ({
          ...previousSourceProps,
          ...{ geojson: sourceProps.geojson },
        }));
        setGeoJSONSource("url");
      } else {
        const apiResponse = await appAPI.downloadJSON({
          filename: sourceProps.geojson,
          dashboard_uuid: uuid,
        });
        if (apiResponse.success) {
          setGeoJSON(JSON.stringify(apiResponse.data, null, 4));
          setSourceProps((previousSourceProps) => ({
            ...previousSourceProps,
            ...{ geojson: JSON.stringify(apiResponse.data) },
          }));
          setGeoJSONSource("custom");
        } else {
          setErrorMessage("Failed to retrieve JSON");
        }
      }
    };
    if (!sourceProps.type || sourceProps.type !== "GeoJSON") return;

    const geo = sourceProps.geojson;
    if (
      typeof geo === "string" &&
      (geo.endsWith(".json") || geo.endsWith(".geojson"))
    ) {
      fetchGeoJSON();
    } else if (typeof geo === "object" && geo !== null) {
      setGeoJSON(JSON.stringify(geo, null, 4));
      setSourceProps((prev) => ({
        ...prev,
        geojson: JSON.stringify(geo),
      }));
      setGeoJSONSource("custom");
    }
    // eslint-disable-next-line
  }, [sourceProps.geojson]);

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

  function handleGeoJSONSourceChange(e) {
    const source = e.target.value;
    setGeoJSONSource(source);

    let newGeoJSON;
    if (source === "custom") {
      newGeoJSON = "{}";
    } else {
      newGeoJSON = "";
    }
    setGeoJSON(newGeoJSON);
    setSourceProps((previousSourceProps) => ({
      ...previousSourceProps,
      ...{ geojson: newGeoJSON },
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
              <DataRadioSelect
                label="GeoJSON Source"
                selectedRadio={geoJSONSource}
                radioOptions={[
                  { value: "custom", label: "Custom" },
                  { value: "url", label: "URL" },
                ]}
                onChange={handleGeoJSONSourceChange}
              />
              {geoJSONSource === "custom" ? (
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
                <NormalInput
                  label="URL"
                  value={geoJSON}
                  type="text"
                  onChange={handleGeoJSONChange}
                />
              )}
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
  setErrorMessage: PropTypes.func,
};

export default memo(SourcePane);
