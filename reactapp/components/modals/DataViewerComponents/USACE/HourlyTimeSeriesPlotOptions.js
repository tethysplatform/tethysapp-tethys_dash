import { useRef } from "react";
import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import BasePlot from "components/visualizations/BasePlot";
import appAPI from "services/api/app";
import getUSACEPlotInfo from "components/visualizations/USACEPlot";
import Spinner from "react-bootstrap/Spinner";
import styled from "styled-components";
import { USACELocations } from "components/modals/utilities";

const StyledSpinner = styled(Spinner)`
  margin: auto;
  display: block;
`;

const StyledH2 = styled.h2`
  text-align: center;
`;

function USACEHourlyTimeSeriesPlotOptions({
  setViz,
  setVizMetadata,
  setUpdateCellMessage,
}) {
  const selectedWaterYear = useRef(null);
  const selectedLocationOption = useRef(null);

  function onWaterYearChange(e) {
    setViz(null);
    selectedWaterYear.current = e;
    if (selectedLocationOption.current) {
      getPlot();
    }
  }

  function onLocationChange(e) {
    setViz(null);
    selectedLocationOption.current = e;
    if (selectedWaterYear.current) {
      getPlot();
    }
  }

  function getPlot() {
    setViz(<StyledSpinner animation="border" variant="info" />);
    const itemData = {
      type: "USACEPlot",
      metadata: {
        location: selectedLocationOption.current["value"],
        year: selectedWaterYear.current["value"],
      },
    };
    setVizMetadata(itemData);
    setUpdateCellMessage(
      "Cell updated to show USACE Hourly Time Series plot at " +
        selectedLocationOption.current["label"] +
        " for the " +
        selectedWaterYear.current["label"] +
        " Water Year."
    );
    appAPI.getPlotData(itemData).then((response) => {
      if (response.success === true) {
        let plotInfo = getUSACEPlotInfo(response.data);

        const plotData = {
          data: plotInfo["traces"],
          layout: plotInfo["layout"],
          config: plotInfo["configOptions"],
        };
        setViz(<BasePlot plotData={plotData} rowHeight={100} colWidth={12} />);
      } else {
        setViz(<StyledH2>Failed to retrieve data</StyledH2>);
      }
    });
  }

  const currentDate = new Date();
  let currentWaterYear;
  if (currentDate.getMonth() > 9) {
    currentWaterYear = currentDate.getFullYear() + 1;
  } else {
    currentWaterYear = currentDate.getFullYear();
  }
  const waterYearOptions = [];
  for (let i = 1995; i <= currentWaterYear; i++) {
    waterYearOptions.push({
      value: i,
      label: i,
    });
  }

  return (
    <>
      <DataSelect
        label="Location"
        selectedDataTypeOption={selectedLocationOption.current}
        onChange={onLocationChange}
        options={USACELocations}
      />
      <DataSelect
        label="Water Year"
        selectedDataTypeOption={selectedWaterYear.current}
        onChange={onWaterYearChange}
        options={waterYearOptions}
      />
    </>
  );
}

USACEHourlyTimeSeriesPlotOptions.propTypes = {
  setViz: PropTypes.func,
  setVizMetadata: PropTypes.func,
  setUpdateCellMessage: PropTypes.func,
};

export default USACEHourlyTimeSeriesPlotOptions;
