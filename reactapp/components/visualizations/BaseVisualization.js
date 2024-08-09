import PropTypes from "prop-types";
import styled from "styled-components";
import appAPI from "../../services/api/app";
import { useEffect, useState, memo } from "react";
import Spinner from "react-bootstrap/Spinner";
import FullscreenPlotModal from "components/modals/FullscreenPlot";
import BasePlot from "components/visualizations/BasePlot";
import getCDECPlotInfo from "components/visualizations/CDECPlot";
import getUSACEPlotInfo from "components/visualizations/USACEPlot";
import getCNRFCRiverForecastPlotInfo from "components/visualizations/CNRFCRiverForecastPlot";
import getCNRFCHEFSPlotInfo from "components/visualizations/CNRFCHEFSPlot";
import Image from "components/visualizations/Image";
import Text from "components/visualizations/Text";
import DataTable from "components/visualizations/DataTable";

const StyledSpinner = styled(Spinner)`
  margin: auto;
  display: block;
`;

const StyledH2 = styled.h2`
  text-align: center;
`;

const BaseVisualization = ({
  rowHeight,
  colWidth,
  type,
  metadataString,
  showFullscreen,
  hideFullscreen,
}) => {
  const [viz, setViz] = useState(null);
  const metadata = JSON.parse(metadataString);
  const itemData = { type: type, metadata: metadata };

  useEffect(() => {
    console.log(metadataString);
    if (type === "Image") {
      setViz(<Image source={metadata["uri"]} />);
    } else if (type.includes("Plot")) {
      setViz(<StyledSpinner animation="border" variant="info" />);
      getPlotData(itemData);
    } else if (type.includes("Text")) {
      setViz(<Text textValue={metadata["text"]} />);
    } else if (type.includes("ImpactStatement")) {
      setViz(<StyledSpinner animation="border" variant="info" />);
      getTableData(itemData);
    }
    // eslint-disable-next-line
  }, [type, metadataString]);

  function getPlotData() {
    appAPI.getPlotData(itemData).then((response) => {
      if (response.success === true) {
        let plotInfo;
        if (itemData["type"] === "CDECPlot") {
          plotInfo = getCDECPlotInfo(response.data);
        } else if (itemData["type"] === "USACEPlot") {
          plotInfo = getUSACEPlotInfo(response.data);
        } else if (itemData["type"] === "CNRFCRiverForecastPlot") {
          plotInfo = getCNRFCRiverForecastPlotInfo(response.data);
        } else if (itemData["type"] === "CNRFCHEFSPlot") {
          plotInfo = getCNRFCHEFSPlotInfo(response.data);
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
      } else {
        setViz(<StyledH2>Failed to retrieve data</StyledH2>);
      }
    });
  }

  function getTableData() {
    appAPI.getPlotData(itemData).then((response) => {
      if (response.success === true) {
        setViz(
          <DataTable
            data={response.data}
            title={metadata["location"] + " Impact Statements"}
          />
        );
      } else {
        setViz(<StyledH2>Failed to retrieve data</StyledH2>);
      }
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
