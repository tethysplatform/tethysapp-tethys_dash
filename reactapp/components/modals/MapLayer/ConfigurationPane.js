import PropTypes from "prop-types";
import DataInput from "components/inputs/DataInput";
import { useState } from "react";
import "components/modals/wideModal.css";

const layerTypes = [
  "ImageLayer",
  "VectorLayer",
  "ImageTile",
  "ImageArcGISRest",
  "GeoJSON",
];

const ConfigurationPane = ({ layerInfo, setLayerInfo }) => {
  const [url, setUrl] = useState(layerInfo.url ?? "");
  const [layerType, setLayerType] = useState(layerInfo.layerType ?? null);
  const [name, setName] = useState(layerInfo.name ?? "");

  return (
    <>
      <DataInput
        objValue={{
          label: "Layer Type",
          type: layerTypes,
          value: layerType,
        }}
        onChange={(e) => {
          setLayerType(e.value);
          setLayerInfo((previousLayerInfo) => ({
            ...previousLayerInfo,
            ...{ layerType: e.value },
          }));
        }}
        includeVariableInputs={false}
      />
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
        objValue={{ label: "Name", type: "text", value: name }}
        onChange={(e) => {
          setName(e);
          setLayerInfo((previousLayerInfo) => ({
            ...previousLayerInfo,
            ...{ name: e },
          }));
        }}
      />
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
