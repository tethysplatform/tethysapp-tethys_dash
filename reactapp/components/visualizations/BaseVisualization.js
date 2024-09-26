import PropTypes from "prop-types";
import { useEffect, useState, memo } from "react";
import FullscreenPlotModal from "components/modals/FullscreenPlot";
import Image from "components/visualizations/Image";
import Text from "components/visualizations/Text";
import { setVisualization } from "components/visualizations/utilities";

const BaseVisualization = ({
  source,
  argsString,
  showFullscreen,
  hideFullscreen,
}) => {
  const [viz, setViz] = useState(null);
  const args = JSON.parse(argsString);
  const itemData = { source: source, args: args };

  useEffect(() => {
    if (source === "") {
      setViz(<div></div>);
    } else if (source === "Custom Image") {
      setViz(<Image source={args["image_source"]} />);
    } else if (source === "Text") {
      setViz(<Text textValue={args["text"]} />);
    } else {
      setVisualization(setViz, itemData);
    }
    // eslint-disable-next-line
  }, [source, argsString]);

  return (
    <>
      {viz}
      <FullscreenPlotModal
        showModal={showFullscreen}
        handleModalClose={hideFullscreen}
      >
        {viz}
      </FullscreenPlotModal>
    </>
  );
};

BaseVisualization.propTypes = {
  source: PropTypes.string,
  argsString: PropTypes.string,
  showFullscreen: PropTypes.bool,
  hideFullscreen: PropTypes.func,
};
export default memo(BaseVisualization);
