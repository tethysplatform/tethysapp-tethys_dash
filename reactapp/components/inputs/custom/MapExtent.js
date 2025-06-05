import { useState, useRef, useEffect } from "react";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import PropTypes from "prop-types";
import styled from "styled-components";

const FullInput = styled.input`
  width: 100%;
  font-weight: normal;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid ${({ isValid }) => (isValid ? "#ccc" : "red")};
  margin-top: 4px;
  outline: none;

  &:focus {
    border-color: ${({ isValid }) => (isValid ? "#888" : "red")};
  }
`;

const InputRow = styled.div`
  margin-left: 1.5rem;
  display: flex;
  gap: 1rem; /* space between inputs */
  align-items: center;
  margin-bottom: 1rem;
`;

const InputLabel = styled.label`
  display: flex;
  flex-direction: column;
  font-weight: bold;
  flex: "1"};
`;

export const MapExtent = ({
  label,
  onChange,
  values,
  setShowingSubModal,
  gridItemIndex,
}) => {
  const [extentMode, setExtentMode] = useState("mapExtent");
  const [customExtent, setCustomExtent] = useState("");
  const [centerZoom, setCenterZoom] = useState("");
  const [customExtentValid, setCustomExtentValid] = useState(true);
  const [centerZoomValid, setCenterZoomValid] = useState(true);
  const valueOptions = [
    { label: "Use the Previewed Map Extent", value: "mapExtent" },
    { label: "Use a Custom Extent", value: "customExtent" },
    { label: "Use a Custom Center with Zoom", value: "customCenterZoom" },
  ];

  const isValidExtent = (value, numberOfParts) => {
    const parts = value.split(",").map((p) => p.trim());
    if (parts.length !== numberOfParts) return false;

    return parts.every((part) => !isNaN(parseFloat(part)) && isFinite(part));
  };

  const onExtentChange = (type, value) => {
    const validInput = value.replace(/[^0-9.,]/g, "");

    if (type === "customExtent") {
      setCustomExtent(validInput);
      setCenterZoom("");
      const isValid = isValidExtent(validInput, 4);
      setCustomExtentValid(isValid);
      if (isValid) {
        onChange(validInput);
      }
      return;
    }

    setCustomExtent("");
    setCenterZoom(validInput);
    const isValid = isValidExtent(validInput, 3);
    setCenterZoomValid(isValid);
    if (isValid) {
      onChange(validInput);
    }
  };

  return (
    <>
      <DataRadioSelect
        label={"Map Extent"}
        aria-label={"Map Extent Input"}
        selectedRadio={extentMode}
        radioOptions={valueOptions}
        onChange={(e) => {
          setExtentMode(e.target.value);
        }}
        blockedRadio={true}
      />
      {extentMode === "customExtent" && (
        <InputRow>
          <InputLabel>
            Custom Extent
            <FullInput
              value={customExtent}
              onChange={(e) => onExtentChange("customExtent", e.target.value)}
              placeholder="minX, minY, maxX, maxY"
              isValid={customExtentValid}
            />
          </InputLabel>
        </InputRow>
      )}
      {extentMode === "customCenterZoom" && (
        <InputRow>
          <InputLabel>
            Center and Zoom
            <FullInput
              value={centerZoom}
              onChange={(e) => onExtentChange("centerZoom", e.target.value)}
              placeholder="lon, lat, zoom"
              isValid={centerZoomValid}
            />
          </InputLabel>
        </InputRow>
      )}
    </>
  );
};
