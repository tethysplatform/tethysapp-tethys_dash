import PropTypes from "prop-types";
import DataInput from "components/inputs/DataInput";
import { useState, useEffect } from "react";
import { objectToArray, arrayToObject } from "components/modals/utilities";
import FileUpload from "components/inputs/FileUpload";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";
import appAPI from "services/api/app";
import "components/modals/wideModal.css";

const layerTypes = [
  "ImageArcGISRest",
  "ImageWMS",
  "ImageTile",
  "GeoJSON",
  "Raster",
];

const StyledTextInput = styled.textarea`
  width: 100%;
  height: 30vh;
`;

const ConfigurationPane = ({ layerInfo, setLayerInfo }) => {
  const [url, setUrl] = useState(layerInfo.url ?? "");
  const [layerType, setLayerType] = useState(layerInfo.layerType ?? null);
  const [name, setName] = useState(layerInfo.name ?? "");
  const [params, setParams] = useState(
    layerInfo.params && Object.keys(layerInfo.params).length > 0
      ? objectToArray(layerInfo.params)
      : [{ Parameter: "", Value: "" }]
  );
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

  function handleParameterChange(e) {
    setParams(e);
    const paramObject = arrayToObject(e);
    setLayerInfo((previousLayerInfo) => ({
      ...previousLayerInfo,
      ...{ params: paramObject },
    }));
  }

  function handleLayerTypeChange(e) {
    setLayerType(e.value);
    setLayerInfo((previousLayerInfo) => ({
      ...previousLayerInfo,
      ...{ layerType: e.value },
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
        <>
          <DataInput
            objValue={{ label: "URL", type: "text", value: url }}
            onChange={(e) => {
              setUrl(e);
              setLayerInfo((previousLayerInfo) => ({
                ...previousLayerInfo,
                ...{ url: e },
              }));
            }}
          />
          <DataInput
            objValue={{
              label: "Parameters",
              type: "inputtable",
              value: params,
            }}
            onChange={handleParameterChange}
          />
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
