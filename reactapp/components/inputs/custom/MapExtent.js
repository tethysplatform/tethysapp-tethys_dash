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

const StyledDiv = styled.div`
  border: 1px solid #dedddd;
`;

const InputRow = styled.div`
  margin-left: 1.5rem;
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1rem;
  padding-right: 1rem;
`;

const InputLabel = styled.label`
  width: 100%;
  font-weight: bold;
`;

const CollapsibleHeader = styled.div`
  cursor: pointer;
  font-weight: bold;
  background: #f2f2f2;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
`;

const ArrowIcon = styled.span`
  font-size: 1.5rem;
  line-height: 1;
  user-select: none;
`;

const CollapsibleContent = styled.div`
  padding-left: 0.5rem;
  margin-bottom: 1rem;
  margin-left: 1.5rem;
`;

export const MapExtent = ({ onChange, values, visualizationRef }) => {
  const [extentMode, setExtentMode] = useState("customExtent");
  const [customExtent, setCustomExtent] = useState(values?.extent ?? "");
  const [customExtentValid, setCustomExtentValid] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const { mapReady } = useMapContext();
  const [extentVariable, setExtentVariable] = useState(values?.variable ?? "");

  const valueOptions = [
    { label: "Use the Previewed Map Extent", value: "mapExtent" },
    { label: "Use a Custom Extent", value: "customExtent" },
  ];

  useEffect(() => {
    if (!values) {
      setCustomExtent("-10686671.12,4721671.57,4.5");
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (customExtent) {
      const isValid = isValidExtentInput(customExtent);
      if (isValid) {
        onChange({
          extent: customExtent,
          ...(extentVariable && { variable: extentVariable }),
        });
      } else {
        onChange(null);
      }
    }
    // eslint-disable-next-line
  }, [customExtent]);

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
      onChange({
        extent: customExtent,
        ...(extentVariable && { variable: extentVariable }),
      });
    }

    return () => {
      view.un("change:resolution", handleResolutionChange);
      map.un("moveend", handleResolutionChange);
    };
    // eslint-disable-next-line
  }, [extentMode, mapReady]);

  const setMapExtent = () => {
    const center = visualizationRef.current.getView().getCenter();
    const zoom = visualizationRef.current.getView().getZoom().toFixed(2);
    const newExtent = `${center[0].toFixed(2)},${center[1].toFixed(2)},${zoom}`;
    setCustomExtent(newExtent);
    onChange({
      extent: newExtent,
      ...(extentVariable && { variable: extentVariable }),
    });
  };

  const containsTemplate = (str) => /\$\{\w+\}/.test(str);

  const isValidExtentInput = (value) => {
    const trimmed = value.trim();
    if (containsTemplate(trimmed)) return true;

    const parts = trimmed.split(",").map((p) => p.trim());
    if (parts.length !== 3 && parts.length !== 4) return false;

    return parts.every((part) => {
      const num = parseFloat(part);
      return !isNaN(num) && isFinite(num);
    });
  };

  const onCustomExtentChange = (value) => {
    const isValid = isValidExtentInput(value);
    setCustomExtent(value);
    setCustomExtentValid(isValid);
  };

  const handleVariableChange = (e) => {
    const value = e.target.value;
    setExtentVariable(value);

    onChange({
      extent: customExtent,
      variable: value,
    });
  };

  return (
    <StyledDiv>
      <CollapsibleHeader onClick={() => setIsOpen(!isOpen)}>
        <span>Map Extent</span>
        <ArrowIcon>{isOpen ? "▾" : "▸"}</ArrowIcon>
      </CollapsibleHeader>
      {isOpen && (
        <CollapsibleContent>
          <DataRadioSelect
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
                  onChange={(e) => onCustomExtentChange(e.target.value)}
                  placeholder="minX, minY, maxX, maxY OR Lon, Lat, Zoom"
                  isValid={customExtentValid}
                  aria-label="Custom Extent Input"
                />
              </InputLabel>
            </InputRow>
          )}
          <label>
            <b>Extent Variable Name:</b>{" "}
            <input
              type="text"
              value={extentVariable}
              onChange={handleVariableChange}
            />
          </label>
        </CollapsibleContent>
      )}
    </StyledDiv>
  );
};

MapExtent.propTypes = {
  onChange: PropTypes.func,
  values: PropTypes.shape({
    extent: PropTypes.string, // minX,minY,maxX,maxY or lon,lat,zoom
    variable: PropTypes.string,
  }),
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};
