import { useState, useRef, useEffect } from "react";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import PropTypes from "prop-types";
import styled from "styled-components";

const FullInput = styled.input`
  width: 100%;
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
  flex: ${(props) => (props.fullWidth ? "1" : "initial")};

  input {
    font-weight: normal;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid #ccc;
    margin-top: 4px;
    width: 100%;
  }
`;

export const MapExtent = ({
  label,
  onChange,
  values,
  setShowingSubModal,
  gridItemIndex,
}) => {
  const [extentMode, setExtentMode] = useState("mapExtent");
  const [extent, setExtent] = useState("");
  const [center, setCenter] = useState("");
  const [zoom, setZoom] = useState("");
  const valueOptions = [
    { label: "Use the Previewed Map Extent", value: "mapExtent" },
    { label: "Use a Custom Extent", value: "customExtent" },
    { label: "Use a Custom Center with Zoom", value: "customCenterZoom" },
  ];

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
      />
      {extentMode === "customExtent" && (
        <InputRow>
          <InputLabel fullWidth>
            Custom Extent
            <FullInput
              value={extent}
              onChange={(e) => setExtent(e.target.value)}
              placeholder="minX, minY, maxX, maxY"
            />
          </InputLabel>
        </InputRow>
      )}
      {extentMode === "customCenterZoom" && (
        <InputRow>
          <InputLabel>
            Center
            <input
              value={center}
              onChange={(e) => setCenter(e.target.value)}
              placeholder="lon, lat"
            />
          </InputLabel>

          <InputLabel>
            Zoom
            <input
              value={zoom}
              type="number"
              onChange={(e) => setZoom(e.target.value)}
              placeholder="zoom level"
            />
          </InputLabel>
        </InputRow>
      )}
    </>
  );
};
