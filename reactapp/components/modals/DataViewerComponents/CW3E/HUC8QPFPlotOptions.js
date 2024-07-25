import { useRef } from "react";
import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import Image from "components/visualizations/Image";
import { CW3EHUC8s } from "components/modals/DataViewerComponents/CW3E/CW3EHUC8s";

function HUC8QPFPlotOptions({ setViz, setVizMetadata, setUpdateCellMessage }) {
  const selectedHUC8Option = useRef(null);

  function onHUC8Change(e) {
    selectedHUC8Option.current = e;
    getImageURL();
  }

  const QPFBaseUrl = "https://cw3e.ucsd.edu/Projects/QPF/images/HUC8/table_";
  function getImageURL() {
    const imageURL = QPFBaseUrl + selectedHUC8Option.current["value"] + ".png";
    setUpdateCellMessage(
      "Cell updated to show CW3E QPF Plot for HUC " +
        selectedHUC8Option.current["value"]
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
        label="HUC8"
        selectedDataTypeOption={selectedHUC8Option.current}
        onChange={onHUC8Change}
        options={CW3EHUC8s}
      />
    </>
  );
}

HUC8QPFPlotOptions.propTypes = {
  setViz: PropTypes.func,
  setVizMetadata: PropTypes.func,
  setUpdateCellMessage: PropTypes.func,
};

export default HUC8QPFPlotOptions;
