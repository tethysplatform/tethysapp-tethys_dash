import { useState, useEffect } from "react";
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
  font-weight: bold;
`;

export const MapExtent = ({ onChange, values, visualizationRef }) => {
  const [extentMode, setExtentMode] = useState("customExtent");
  const [customExtent, setCustomExtent] = useState(values ?? "");
  const [customExtentValid, setCustomExtentValid] = useState(true);
  const valueOptions = [
    { label: "Use the Previewed Map Extent", value: "mapExtent" },
    { label: "Use a Custom Extent", value: "customExtent" },
  ];
  const { mapReady } = useMapContext();

  useEffect(() => {
    if (!values) {
      setCustomExtent("-10686671.12,4721671.57,4.5");
      onChange("-10686671.12,4721671.90,4.5");
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!mapReady || !visualizationRef.current) return;

    const map = visualizationRef.current;
    const view = visualizationRef.current?.getView();

    const handleResolutionChange = () => {
      setMapExtent();
    };

    if (extentMode === "mapExtent") {
      setMapExtent();
      view.on("change:resolution", handleResolutionChange);
      map.on("moveend", handleResolutionChange);
    } else {
      onChange(customExtent);
    }

    // Cleanup function to remove the event listener
    return () => {
      view.un("change:resolution", handleResolutionChange);
      map.un("moveend", handleResolutionChange);
    };
    // eslint-disable-next-line
  }, [extentMode, mapReady]);

  const setMapExtent = () => {
    const center = visualizationRef.current.getView().getCenter();
    const zoom = visualizationRef.current.getView().getZoom().toFixed(2);
    onChange(`${center[0].toFixed(2)},${center[1].toFixed(2)},${zoom}`);
  };

  const containsTemplate = (str) => /\$\{\w+\}/.test(str);

  const isValidExtentInput = (value) => {
    const trimmed = value.trim();

    // Allow any value with a template
    if (containsTemplate(trimmed)) return true;

    const parts = trimmed.split(",").map((p) => p.trim());

    // Only 3 or 4 parts allowed
    if (parts.length !== 3 && parts.length !== 4) return false;

    return parts.every((part) => {
      const num = parseFloat(part);
      return !isNaN(num) && isFinite(num);
    });
  };

  const onCustomExtentChange = (type, value) => {
    const isValid = isValidExtentInput(value);

    setCustomExtent(value);
    setCustomExtentValid(isValid);

    onChange(isValid ? value : "");
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
              placeholder="minX, minY, maxX, maxY OR Lon, Lat, Zoom"
              isValid={customExtentValid}
              aria-label="Custom Extent Input"
            />
          </InputLabel>
        </InputRow>
      )}
    </>
  );
};

MapExtent.propTypes = {
  onChange: PropTypes.func,
  values: PropTypes.string,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};
