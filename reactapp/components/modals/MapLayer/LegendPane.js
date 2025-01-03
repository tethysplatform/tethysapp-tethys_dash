import PropTypes from "prop-types";
import DataInput from "components/inputs/DataInput";
import "components/modals/wideModal.css";

const layerTypes = [
  "ImageLayer",
  "VectorLayer",
  "ImageTile",
  "ImageArcGISRest",
  "GeoJSON",
];

const LegendPane = ({
  name,
  setName,
  layerType,
  setLayerType,
  url,
  setUrl,
}) => {
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
        }}
        includeVariableInputs={false}
      />
      <DataInput
        objValue={{ label: "URL", type: "text", value: url }}
        onChange={(e) => {
          setUrl(e);
        }}
      />
      <DataInput
        objValue={{ label: "Name", type: "text", value: name }}
        onChange={(e) => {
          setName(e);
        }}
      />
    </>
  );
};

LegendPane.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
    PropTypes.object,
  ]),
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
};

export default LegendPane;
