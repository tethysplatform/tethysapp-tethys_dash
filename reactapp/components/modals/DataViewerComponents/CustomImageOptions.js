import DataInput from "components/inputs/DataInput";
import PropTypes from "prop-types";
import { useState } from "react";
import Image from "components/visualizations/Image";

function CustomImageOptions({ setViz, setVizMetadata, setUpdateCellMessage }) {
  const [imageSource, setImageSource] = useState(null);

  function onImageSourceChange(e) {
    setImageSource(e.currentTarget.value);
    setViz(<Image source={e.currentTarget.value} />);
    const itemData = {
      type: "Image",
      metadata: {
        uri: e.currentTarget.value,
      },
    };
    setVizMetadata(itemData);
    setUpdateCellMessage("Cell updated to show " + e.currentTarget.value);
  }

  return (
    <div>
      <DataInput
        inputLabel="Image Source"
        inputValue={imageSource}
        onChange={onImageSourceChange}
      />
    </div>
  );
}

CustomImageOptions.propTypes = {
  setViz: PropTypes.func,
  setVizMetadata: PropTypes.func,
  setUpdateCellMessage: PropTypes.func,
};

export default CustomImageOptions;
