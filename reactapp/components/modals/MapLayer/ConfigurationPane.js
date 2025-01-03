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

const ConfigurationPane = ({ layerInfo }) => {
  const [url, setUrl] = useState(layerInfo.current.url ?? "");
  const [layerType, setLayerType] = useState(
    layerInfo.current.layerType ?? null
  );
  const [name, setName] = useState(layerInfo.current.name ?? "");

  return (
    <>
      <DataInput
        objValue={{
          label: "Layer Type",
          type: layerTypes,
          value: layerType,
        }}
        onChange={(e) => {
          layerInfo.current.layerType = e.value;
          setLayerType(e.value);
        }}
        includeVariableInputs={false}
      />
      <DataInput
        objValue={{ label: "URL", type: "text", value: url }}
        onChange={(e) => {
          layerInfo.current.url = e;
          setUrl(e);
        }}
      />
      <DataInput
        objValue={{ label: "Name", type: "text", value: name }}
        onChange={(e) => {
          layerInfo.current.name = e;
          setName(e);
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
