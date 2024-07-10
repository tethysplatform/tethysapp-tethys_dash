import { useRef } from "react";
import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";

function CW3ELandfallPlotOptions({
  setImageSource,
  setImageWarning,
  setUpdateCellMessage,
}) {
  const selectedModelOption = useRef(null);
  const selectedDataTypeOption = useRef(null);
  const selectedLocationOption = useRef(null);

  function onModelChange(e) {
    setImageWarning(null);
    selectedModelOption.current = e;
    if (selectedDataTypeOption.current && selectedLocationOption.current) {
      getImageURL();
    }
  }

  function onDataTypeChange(e) {
    setImageWarning(null);
    selectedDataTypeOption.current = e;
    if (selectedModelOption.current && selectedLocationOption.current) {
      getImageURL();
    }
  }

  function onLocationChange(e) {
    setImageWarning(null);
    selectedLocationOption.current = e;
    if (selectedModelOption.current && selectedDataTypeOption.current) {
      getImageURL();
    }
  }

  function getImageURL() {
    const imageURL =
      selectedModelOption.current["value"] +
      selectedDataTypeOption.current["value"] +
      selectedLocationOption.current["value"] +
      "_current.png";
    setUpdateCellMessage(
      "Cell updated to show CW3E Landfall plot in the " +
        selectedLocationOption.current["label"] +
        " region using the " +
        selectedModelOption.current["label"] +
        " model and " +
        selectedModelOption.current["label"] +
        " data."
    );
    setImageSource(imageURL);
  }

  const ARLandfallBaseUrl = "https://cw3e.ucsd.edu/images/";
  const modelOptions = [
    {
      value: ARLandfallBaseUrl + "gefs/v12/LFT/US-west/GEFS_LandfallTool",
      label: "GFS Ensemble",
    },
    {
      value:
        ARLandfallBaseUrl +
        "ECMWF/ensemble/LandfallTool/US-west/ECMWF_LandfallTool",
      label: "ECMWF EPS",
    },
    {
      value:
        ARLandfallBaseUrl +
        "ECMWF/ensemble/LandfallTool/US-west/ECMWF-GEFS_LandfallTool",
      label: "ECMWF minus GFS",
    },
    {
      value:
        ARLandfallBaseUrl +
        "wwrf/images/ensemble/LFT/US-west/W-WRF_LandfallTool",
      label: "West-WRF Ensemble",
    },
  ];

  const dataTypeOptions = [
    {
      value: "_control",
      label: "Control IVT magnitude",
    },
    {
      value: "_ensemble_mean",
      label: "Ensemble mean magnitude",
    },
    {
      value: "_150",
      label: "Probability of IVT >150 kg/m/s",
    },
    {
      value: "_250",
      label: "Probability of IVT >250 kg/m/s",
    },
    {
      value: "_500",
      label: "Probability of IVT >500 kg/m/s",
    },
    {
      value: "_750",
      label: "Probability of IVT >750 kg/m/s",
    },
    {
      value: "_Vectors_150",
      label: "IVT >150 kg/m/s with Vectors",
    },
    {
      value: "_Vectors_250",
      label: "IVT >250 kg/m/s with Vectors",
    },
    {
      value: "_Vectors_500",
      label: "IVT >500 kg/m/s with Vectors",
    },
    {
      value: "_Vectors_750",
      label: "IVT >750 kg/m/s with Vectors",
    },
  ];

  const locationOptions = [
    {
      value: "_coast",
      label: "Coastal",
    },
    {
      value: "_foothills",
      label: "Foothills",
    },
    {
      value: "_inland",
      label: "Inland",
    },
    {
      value: "_intwest",
      label: "Interior West",
    },
  ];

  return (
    <>
      <DataSelect
        label="Model"
        selectedDataTypeOption={selectedModelOption.current}
        onChange={onModelChange}
        options={modelOptions}
      />
      <DataSelect
        label="Data Type"
        selectedDataTypeOption={selectedDataTypeOption.current}
        onChange={onDataTypeChange}
        options={dataTypeOptions}
      />
      <DataSelect
        label="Location"
        selectedDataTypeOption={selectedLocationOption.current}
        onChange={onLocationChange}
        options={locationOptions}
      />
    </>
  );
}

CW3ELandfallPlotOptions.propTypes = {
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
  handleSubmit: PropTypes.func,
};

export default CW3ELandfallPlotOptions;
