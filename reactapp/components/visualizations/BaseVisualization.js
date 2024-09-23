import PropTypes from "prop-types";
import { useEffect, useState, memo } from "react";
import FullscreenPlotModal from "components/modals/FullscreenPlot";
import Image from "components/visualizations/Image";
import Text from "components/visualizations/Text";
import { setVisualization } from "components/visualizations/utilities";

const BaseVisualization = ({
  rowHeight,
  colWidth,
  source,
  argsString,
  showFullscreen,
  hideFullscreen,
}) => {
  const [viz, setViz] = useState(null);
  const args = JSON.parse(argsString);
  const itemData = { source: source, args: args };

  useEffect(() => {
    if (source === "Custom Image") {
      setViz(<Image source={args["uri"]} />);
    } else if (source === "Text") {
      setViz(<Text textValue={args["text"]} />);
    } else {
      setVisualization(setViz, itemData, rowHeight, colWidth);
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
  rowHeight: PropTypes.number,
  colWidth: PropTypes.number,
  itemData: PropTypes.shape({
    source: PropTypes.string,
    args: PropTypes.shape({
      uri: PropTypes.string,
    }),
  }),
  showFullscreen: PropTypes.bool,
  hideFullscreen: PropTypes.func,
};
export default memo(BaseVisualization);
