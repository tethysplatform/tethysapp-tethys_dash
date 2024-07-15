import { useRef } from "react";
import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import BasePlot from "components/visualizations/BasePlot";
import appAPI from "services/api/app";
import getUSACEPlotInfo from "components/visualizations/USACEPlot";
import Spinner from "react-bootstrap/Spinner";
import styled from "styled-components";

const StyledSpinner = styled(Spinner)`
  margin: auto;
  display: block;
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
    appAPI.getPlotData(itemData).then((data) => {
      let plotInfo = getUSACEPlotInfo(data);

      const plotData = {
        data: plotInfo["traces"],
        layout: plotInfo["layout"],
        config: plotInfo["configOptions"],
      };
      setViz(<BasePlot plotData={plotData} rowHeight={100} colWidth={12} />);
    });
  }

  const locationOptions = [
    {
      value: "sha",
      label: "Shasta Dam & Lake Shasta",
    },
    {
      value: "blb",
      label: "Black Butte Dam & Lake",
    },
    {
      value: "oro",
      label: "Oroville Dam & Lake Oroville",
    },
    {
      value: "bul",
      label: "New Bullards Bar Dam & Lake",
    },
    {
      value: "eng",
      label: "Englebright Lake",
    },
    {
      value: "inv",
      label: "Indian Valley Dam & Reservoir",
    },
    {
      value: "fol",
      label: "Folsom Dam & Lake",
    },
    {
      value: "cmn",
      label: "Camanche Dam & Reservoir",
    },
    {
      value: "nhg",
      label: "New Hogan Dam & Lake",
    },
    {
      value: "frm",
      label: "Farmington Dam & Reservoir",
    },
    {
      value: "nml",
      label: "New Melones Dam & Lake",
    },
    {
      value: "tul",
      label: "Tulloch Dam & Reservoir",
    },
    {
      value: "dnp",
      label: "Don Pedro Dam & Lake",
    },
    {
      value: "exc",
      label: "New Exchequer Dam, Lake McClure",
    },
    {
      value: "lbn",
      label: "Los Banos Detention Reservoir",
    },
    {
      value: "bur",
      label: "Burns Dam & Reservoir",
    },
    {
      value: "bar",
      label: "Bear Dam & Reservoir",
    },
    {
      value: "own",
      label: "Owens Dam & Reservoir",
    },
    {
      value: "mar",
      label: "Mariposa Dam & Reservoir",
    },
    {
      value: "buc",
      label: "Buchanan Dam, H.V. Eastman Lake",
    },
    {
      value: "hid",
      label: "Hidden Dam, Hensley Lake",
    },
    {
      value: "mil",
      label: "Friant Dam, Millerton Lake",
    },
    {
      value: "bdc",
      label: "Big Dry Creek Dam & Reservoir",
    },
    {
      value: "pnf",
      label: "Pine Flat Dam & Lake",
    },
    {
      value: "trm",
      label: "Terminus Dam, Lake Kaweah",
    },
    {
      value: "scc",
      label: "Schafer Dam, Success Lake",
    },
    {
      value: "isb",
      label: "Isabella Dam & Lake Isabella",
    },
    {
      value: "coy",
      label: "Coyote Valley Dam, Lake Mendocino",
    },
    {
      value: "wrs",
      label: "Warm Springs Dam, Lake Sonoma",
    },
    {
      value: "dlv",
      label: "Del Valle Dam & Reservoir",
    },
    {
      value: "mrt",
      label: "Martis Creek Dam & Lake",
    },
    {
      value: "prs",
      label: "Prosser Creek Dam & Reservoir",
    },
    {
      value: "stp",
      label: "Stampede Dam & Reservoir",
    },
    {
      value: "boc",
      label: "Boca Dam & Reservoir",
    },
  ];

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
        options={locationOptions}
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
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
  handleSubmit: PropTypes.func,
};

export default USACEHourlyTimeSeriesPlotOptions;
