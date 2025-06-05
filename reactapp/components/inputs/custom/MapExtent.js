import { useState, useRef, useEffect } from "react";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import PropTypes from "prop-types";
import styled from "styled-components";
import { useMapContext } from "components/contexts/MapContext";

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
  width: 100%;
`;

export const MapExtent = ({ label, onChange, values, visualizationRef }) => {
  const [extentMode, setExtentMode] = useState("customCenterZoom");
  const [customExtent, setCustomExtent] = useState("");
  const [centerZoom, setCenterZoom] = useState("-10686671.12,4721671.57,4.5");
  const [customExtentValid, setCustomExtentValid] = useState(true);
  const [centerZoomValid, setCenterZoomValid] = useState(true);
  const valueOptions = [
    { label: "Use the Previewed Map Extent", value: "mapExtent" },
    { label: "Use a Custom Extent", value: "customExtent" },
    { label: "Use a Custom Center with Zoom", value: "customCenterZoom" },
  ];
  const { mapReady } = useMapContext();

  useEffect(() => {
    if (extentMode === "mapExtent") {
      onChange(centerZoom);
    } else if (extentMode === "customExtent") {
      onChange(customExtent);
    } else {
      onChange(centerZoom);
    }
  }, []);

  useEffect(() => {
    if (!mapReady || !visualizationRef.current) return;
    const view = visualizationRef.current?.getView();

    const handleResolutionChange = () => {
      setMapExtent();
    };

    if (extentMode === "mapExtent") {
      setMapExtent();
      view.on("change:resolution", handleResolutionChange);
      visualizationRef.current.on("moveend", handleResolutionChange);
    } else if (extentMode === "customExtent") {
      onChange(customExtent);
    } else {
      onChange(centerZoom);
    }

    // Cleanup function to remove the event listener
    return () => {
      view.un("change:resolution", handleResolutionChange);
      visualizationRef.current.un("moveend", handleResolutionChange);
    };
  }, [extentMode, mapReady]);

  const setMapExtent = () => {
    const center = visualizationRef.current.getView().getCenter();
    const zoom = visualizationRef.current.getView().getZoom().toFixed(2);
    onChange(`${center[0].toFixed(2)},${center[1].toFixed(2)},${zoom}`);
  };

  const isValidExtent = (value, numberOfParts) => {
    const parts = value.split(",").map((p) => p.trim());
    if (parts.length !== numberOfParts) return false;

    return parts.every((part) => !isNaN(parseFloat(part)) && isFinite(part));
  };

  const onCustomExtentChange = (type, value) => {
    const validInput = value.replace(/[^0-9.,-]/g, "");

    const isCustomExtent = type === "customExtent";
    const expectedParts = isCustomExtent ? 4 : 3;
    const isValid = isValidExtent(validInput, expectedParts);

    if (isCustomExtent) {
      setCustomExtent(validInput);
      setCustomExtentValid(isValid);
    } else {
      setCenterZoom(validInput);
      setCenterZoomValid(isValid);
    }

    onChange(isValid ? validInput : "");
  };

  return (
    <>
      <DataRadioSelect
        label={"Map Extent"}
        aria-label={"Map Extent Input"}
        selectedRadio={extentMode}
        radioOptions={valueOptions}
        onChange={(e) => setExtentMode(e.target.value)}
        blockedRadio={true}
      />
      {extentMode === "customExtent" && (
        <InputRow>
          <InputLabel>
            Custom Extent
            <FullInput
              value={customExtent}
              onChange={(e) =>
                onCustomExtentChange("customExtent", e.target.value)
              }
              placeholder="minX,minY,maxX,maxY"
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
              onChange={(e) =>
                onCustomExtentChange("centerZoom", e.target.value)
              }
              placeholder="lon,lat,zoom"
              isValid={centerZoomValid}
            />
          </InputLabel>
        </InputRow>
      )}
    </>
  );
};
