import { useState, useRef } from "react";
import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import { CNRFCGauges } from "components/visualizations/Utilities";

function PlotDataViewerOptions({
  setImageSource,
  setImageWarning,
  setUpdateCellMessage,
}) {
  const [selectedPlotTypeOption, setSelectPlotTypeOption] = useState(null);
  const selectedTypeOption = useRef(null);
  const selectedLocationOption = useRef(null);

  function onPlotTypeChange(e) {
    setSelectPlotTypeOption(e);
    setImageSource(null);
    setImageWarning(null);
    selectedTypeOption.current = null;
    selectedLocationOption.current = null;
  }

  function onTypeChange(e) {
    setImageWarning(null);
    selectedTypeOption.current = e;
    if (selectedLocationOption.current) {
      getImageURL();
    }
  }

  function onLocationChange(e) {
    setImageWarning(null);
    selectedLocationOption.current = e;
    if (selectedTypeOption.current) {
      getImageURL();
    }
  }

  function getImageURL() {
    let imageURL;
    if (selectedPlotTypeOption["label"] === "CNRFC") {
      const location = selectedTypeOption.current["value"]["lowercase"]
        ? selectedLocationOption.current["value"].toLowerCase()
        : selectedLocationOption.current["value"];
      imageURL =
        selectedTypeOption.current["value"]["baseURL"] +
        location +
        selectedTypeOption.current["value"]["plotName"];
    }
    setUpdateCellMessage(
      "Cell updated to show " +
        selectedTypeOption.current["label"] +
        " plot at " +
        selectedLocationOption.current["label"]
    );
    setImageSource(imageURL);
  }

  const plotTypeOptions = [
    { value: "USACE", label: "USACE" },
    { value: "CDEC", label: "CDEC" },
    { value: "CNRFC", label: "CNRFC" },
  ];

  const locationOptions = CNRFCGauges;

  const CNRFCEnsembleBaseUrl = "https://www.cnrfc.noaa.gov/images/ensembles/";
  const CDECGuidancePlotBaseUrl = "https://cdec.water.ca.gov/guidance_plots/";
  const typeOptions = [
    {
      value: {
        baseURL: CNRFCEnsembleBaseUrl,
        plotName: ".ens_accum10day.png",
        lowercase: false,
      },
      label: "10-Day Accumulated Volume",
    },
    {
      value: {
        baseURL: CNRFCEnsembleBaseUrl,
        plotName: ".ens_boxwhisker.png",
        lowercase: false,
      },
      label: "10-Day Maximum Flow Probability",
    },
    {
      value: {
        baseURL: CNRFCEnsembleBaseUrl,
        plotName: ".ens_10day.png",
        lowercase: false,
      },
      label: "Daily Maximum Flow Probability",
    },
    {
      value: {
        baseURL: CNRFCEnsembleBaseUrl,
        plotName: ".ens_monthly.png",
        lowercase: false,
      },
      label: "Monthly Volume Exceedance",
    },
    {
      value: {
        baseURL: CNRFCEnsembleBaseUrl,
        plotName: ".ens_4x5day.png",
        lowercase: false,
      },
      label: "5 Day Volume Exceedance Levels",
    },
    {
      value: {
        baseURL: CDECGuidancePlotBaseUrl,
        plotName: "_rvf.png",
        lowercase: true,
      },
      label: "River Forecast Plot",
    },
  ];

  return (
    <>
      <DataSelect
        label="Data Provider"
        selectedDataTypeOption={selectedPlotTypeOption}
        onChange={onPlotTypeChange}
        options={plotTypeOptions}
      />
      {selectedPlotTypeOption && (
        <>
          {selectedPlotTypeOption["label"] === "CNRFC" && (
            <>
              <DataSelect
                label="Plot Type"
                selectedDataTypeOption={selectedTypeOption.current}
                onChange={onTypeChange}
                options={typeOptions}
              />
              <DataSelect
                label="Location"
                selectedDataTypeOption={selectedLocationOption.current}
                onChange={onLocationChange}
                options={locationOptions}
              />
            </>
          )}
        </>
      )}
    </>
  );
}

PlotDataViewerOptions.propTypes = {
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
  handleSubmit: PropTypes.func,
};

export default PlotDataViewerOptions;
