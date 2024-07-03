import { useState, useRef } from "react";
import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import { CNRFCGauges } from "components/visualizations/Utilities";

function PlotDataViewerOptions({ setImageSource, setImageWarning }) {
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
    selectedTypeOption.current = e.value;
    if (selectedLocationOption.current) {
      getImageURL();
    }
  }

  function onLocationChange(e) {
    setImageWarning(null);
    selectedLocationOption.current = e.value;
    if (selectedTypeOption.current) {
      getImageURL();
    }
  }

  function getImageURL() {
    const baseURL = selectedPlotTypeOption["value"];
    let imageURL;
    if (selectedPlotTypeOption["label"] === "CNRFC") {
      imageURL =
        baseURL +
        selectedTypeOption.current.split("/")[0] +
        "/" +
        selectedLocationOption.current +
        selectedTypeOption.current.split("/")[1];
    }

    setImageSource(imageURL);
  }

  const plotTypeOptions = [
    { value: "USACE", label: "USACE" },
    { value: "CDEC", label: "CDEC" },
    { value: "https://www.cnrfc.noaa.gov/images/", label: "CNRFC" },
  ];

  const locationOptions = CNRFCGauges;

  const typeOptions = [
    {
      value: "ensembles/.ens_accum10day.png",
      label: "10-Day Accumulated Volume",
    },
    {
      value: "ensembles/.ens_boxwhisker.png",
      label: "10-Day Maximum Flow Probability",
    },
    {
      value: "ensembles/.ens_10day.png",
      label: "Daily Maximum Flow Probability",
    },
    {
      value: "ensembles/.ens_monthly.png",
      label: "Monthly Volume Exceedance",
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
