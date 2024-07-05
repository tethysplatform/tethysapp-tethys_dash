import PropTypes from "prop-types";
import styled from "styled-components";
import appAPI from "../../services/api/app";
import { useEffect, useState, memo } from "react";
import Spinner from "react-bootstrap/Spinner";
import FullscreenPlotModal from "components/modals/FullscreenPlot";
import BasePlot from "components/visualizations/BasePlot";
import getCDECPlotInfo from "components/visualizations/CDECPlot";
import getUSACEPlotInfo from "components/visualizations/USACEPlot";
import Image from "components/visualizations/Image";

const StyledSpinner = styled(Spinner)`
  margin: auto;
  display: block;
`;

const BaseVisualization = ({
  rowHeight,
  colWidth,
  itemData,
  showFullscreen,
  hideFullscreen,
}) => {
  const [viz, setViz] = useState(null);
  const type = itemData["type"];
  const metadata = itemData["metadata"];

  useEffect(() => {
    if (type === "Image") {
      setViz(<Image source={metadata["uri"]} />);
    } else if (type.includes("Plot")) {
      setViz(<StyledSpinner animation="border" variant="info" />);
      getPlotData(itemData);
    }
    // eslint-disable-next-line
  }, [itemData]);

  function getPlotData() {
    appAPI.getPlotData(itemData).then((data) => {
      let plotInfo;
      if (itemData["type"] === "CDECPlot") {
        plotInfo = getCDECPlotInfo(data);
      } else if (itemData["type"] === "USACEPlot") {
        plotInfo = getUSACEPlotInfo(data);
      } else {
        throw new Error("Plot type is not configured");
      }

      const plotData = {
        data: plotInfo["traces"],
        layout: plotInfo["layout"],
        config: plotInfo["configOptions"],
      };
      setViz(
        <BasePlot
          plotData={plotData}
          rowHeight={rowHeight}
          colWidth={colWidth}
        />
      );
    });
  }

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
    type: PropTypes.string,
    metadata: PropTypes.shape({
      uri: PropTypes.string,
    }),
  }),
  showFullscreen: PropTypes.bool,
  hideFullscreen: PropTypes.func,
};
export default memo(BaseVisualization);
