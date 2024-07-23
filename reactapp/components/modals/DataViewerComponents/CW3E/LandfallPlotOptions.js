import { useRef } from "react";
import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import Image from "components/visualizations/Image";
import {
  ARLandfallModelOptions,
  ARLandfallModelTypeOptions,
  ARLandfallModelLocationOptions,
} from "components/modals/utilities";

function CW3ELandfallPlotOptions({
  setViz,
  setVizMetadata,
  setUpdateCellMessage,
}) {
  const selectedModelOption = useRef(null);
  const selectedDataTypeOption = useRef(null);
  const selectedLocationOption = useRef(null);

  function onModelChange(e) {
    selectedModelOption.current = e;
    if (selectedDataTypeOption.current && selectedLocationOption.current) {
      getImageURL();
    }
  }

  function onDataTypeChange(e) {
    selectedDataTypeOption.current = e;
    if (selectedModelOption.current && selectedLocationOption.current) {
      getImageURL();
    }
  }

  function onLocationChange(e) {
    selectedLocationOption.current = e;
    if (selectedModelOption.current && selectedDataTypeOption.current) {
      getImageURL();
    }
  }

  function getImageURL() {
    const imageURL =
      selectedModelOption.current["value"] +
      selectedDataTypeOption.current["value"] +
      selectedLocationOption.current["value"] +
      "_current.png";
    setUpdateCellMessage(
      "Cell updated to show CW3E Landfall plot in the " +
        selectedLocationOption.current["label"] +
        " region using the " +
        selectedModelOption.current["label"] +
        " model and " +
        selectedModelOption.current["label"] +
        " data."
    );
    setViz(<Image source={imageURL} />);
    const itemData = {
      type: "Image",
      metadata: {
        uri: imageURL,
      },
    };
    setVizMetadata(itemData);
  }

  return (
    <>
      <DataSelect
        label="Model"
        selectedDataTypeOption={selectedModelOption.current}
        onChange={onModelChange}
        options={ARLandfallModelOptions}
      />
      <DataSelect
        label="Data Type"
        selectedDataTypeOption={selectedDataTypeOption.current}
        onChange={onDataTypeChange}
        options={ARLandfallModelTypeOptions}
      />
      <DataSelect
        label="Location"
        selectedDataTypeOption={selectedLocationOption.current}
        onChange={onLocationChange}
        options={ARLandfallModelLocationOptions}
      />
    </>
  );
}

CW3ELandfallPlotOptions.propTypes = {
  setViz: PropTypes.func,
  setVizMetadata: PropTypes.func,
  setUpdateCellMessage: PropTypes.func,
};

export default CW3ELandfallPlotOptions;
