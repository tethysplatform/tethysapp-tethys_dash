import { useState, useEffect, useRef } from "react";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import PropTypes from "prop-types";
import styled from "styled-components";
import { useMapContext } from "components/contexts/MapContext";
import { wrapMercatorX } from "components/map/utilities";
import { readViewGroupSettings } from "components/map/viewGroup";

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

const CheckboxLabel = styled.label`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-weight: bold;
  opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};
`;

const HelpText = styled.div`
  margin-left: 1.5rem;
  margin-top: -0.75rem;
  margin-bottom: 1rem;
  padding-right: 1rem;
  font-size: 0.8rem;
  font-weight: normal;
  font-style: italic;
  color: #666;
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

const containsTemplate = (str) => /\$\{\w+\}/.test(str ?? "");

// The saved value tolerates every historical shape: a bare extent string, an
// `{extent}` / `{extent, variable}` object, and the doubly wrapped
// `{extent: {extent, ...}}` object that `isValidExtentInput` also unwraps.
// `readViewGroupSettings` is the one reader of those shapes -- the map reads
// the very same value through it -- so this is only the widget's adapter over
// it: the editor wants an empty string for "no extent typed yet", and names
// the flag the way it is stored.
const normalizeExtentValue = (value) => {
  const settings = readViewGroupSettings(value);
  return {
    extent: settings.extent ?? "",
    variable: settings.variable,
    viewGroup: settings.viewGroup,
    isGroupInitialExtent: settings.isInitialExtent,
  };
};

export const MapExtent = ({ onChange, values, visualizationRef }) => {
  const [initialValue] = useState(() => normalizeExtentValue(values));
  const [extentMode, setExtentMode] = useState("customExtent");
  const [customExtent, setCustomExtent] = useState(initialValue.extent ?? "");
  const [customExtentValid, setCustomExtentValid] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const { mapReady } = useMapContext();
  const [extentVariable, setExtentVariable] = useState(
    initialValue.variable ?? "",
  );
  // The committed group name. The draft is what the text field shows; it is
  // only promoted to the committed name on blur so a partially typed name
  // never becomes a group.
  const [viewGroup, setViewGroup] = useState(
    (initialValue.viewGroup ?? "").trim(),
  );
  const [viewGroupDraft, setViewGroupDraft] = useState(
    (initialValue.viewGroup ?? "").trim(),
  );
  const [isGroupInitialExtent, setIsGroupInitialExtent] = useState(
    Boolean(initialValue.viewGroup?.trim()) &&
      Boolean(initialValue.isGroupInitialExtent),
  );

  // Mirror every emitted field into a ref so effect closures and event
  // handlers always merge from the current widget state.
  const customExtentRef = useRef(customExtent);
  const extentVariableRef = useRef(extentVariable);
  const viewGroupRef = useRef(viewGroup);
  const isGroupInitialExtentRef = useRef(isGroupInitialExtent);
  useEffect(() => {
    customExtentRef.current = customExtent;
  }, [customExtent]);
  useEffect(() => {
    extentVariableRef.current = extentVariable;
  }, [extentVariable]);
  useEffect(() => {
    viewGroupRef.current = viewGroup;
  }, [viewGroup]);
  useEffect(() => {
    isGroupInitialExtentRef.current = isGroupInitialExtent;
  }, [isGroupInitialExtent]);

  const valueOptions = [
    { label: "Use the Previewed Map Extent", value: "mapExtent" },
    { label: "Use a Custom Extent", value: "customExtent" },
  ];

  // The single place the emitted value is built. Every caller merges over the
  // full widget state, so editing one field can never drop another one.
  const buildValue = (overrides = {}) => {
    const extent = overrides.extent ?? customExtentRef.current;
    const variable = overrides.variable ?? extentVariableRef.current;
    const group = overrides.viewGroup ?? viewGroupRef.current;
    const isInitial =
      overrides.isGroupInitialExtent ?? isGroupInitialExtentRef.current;

    return {
      extent,
      ...(variable && { variable }),
      ...(group && { viewGroup: group }),
      ...(group && isInitial && { isGroupInitialExtent: true }),
    };
  };

  const emitValue = (overrides = {}) => {
    const newValue = buildValue(overrides);
    if (newValue.extent && isValidExtentInput(newValue.extent)) {
      onChange(newValue);
    } else {
      onChange(null);
    }
  };

  useEffect(() => {
    if (!values) {
      setCustomExtent("-10686671.12,4721671.57,4.5");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (customExtent) {
      emitValue({ extent: customExtent });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      emitValue();
    }

    return () => {
      view.un("change:resolution", handleResolutionChange);
      map.un("moveend", handleResolutionChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extentMode, mapReady]);

  const setMapExtent = () => {
    const view = visualizationRef.current.getView();
    const center = view.getCenter();
    const zoom = view.getZoom().toFixed(2);
    const centerX =
      view.getProjection().getCode() === "EPSG:3857"
        ? wrapMercatorX(center[0])
        : center[0];
    const newExtent = `${centerX.toFixed(2)},${center[1].toFixed(2)},${zoom}`;
    setCustomExtent(newExtent);
    customExtentRef.current = newExtent;
    emitValue({ extent: newExtent });
  };

  const isValidExtentInput = (value) => {
    let trimmed;
    try {
      trimmed = value.extent.extent.trim();
    } catch {
      try {
        trimmed = value.extent.trim();
      } catch {
        trimmed = value.trim();
      }
    }
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
    // Update the ref immediately so the merge below sees the new value
    extentVariableRef.current = value;

    emitValue();
  };

  const commitViewGroup = () => {
    // Group names are trimmed; a whitespace-only name means no group.
    const trimmed = viewGroupDraft.trim();
    // A flag with no group has nothing to apply it to.
    const nextIsInitial = trimmed ? isGroupInitialExtent : false;

    if (trimmed === viewGroup && nextIsInitial === isGroupInitialExtent) {
      if (trimmed !== viewGroupDraft) setViewGroupDraft(trimmed);
      return;
    }

    setViewGroup(trimmed);
    setViewGroupDraft(trimmed);
    setIsGroupInitialExtent(nextIsInitial);
    viewGroupRef.current = trimmed;
    isGroupInitialExtentRef.current = nextIsInitial;

    emitValue();
  };

  const handleGroupInitialExtentChange = (e) => {
    const checked = e.target.checked;
    setIsGroupInitialExtent(checked);
    isGroupInitialExtentRef.current = checked;

    emitValue();
  };

  const extentIsTemplated = containsTemplate(customExtent);
  const initialExtentDisabledReason = !viewGroup
    ? "Set a view group name to use this map's extent as the group's initial extent."
    : extentIsTemplated
      ? "An extent built from a variable template cannot supply the group's initial extent."
      : null;

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
            onChange={setExtentMode}
            divProps={{
              style: {
                "margin-bottom": 0,
                gap: 0,
                "align-items": "normal",
                "flex-direction": "column",
              },
            }}
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
          <InputRow>
            <InputLabel>
              View Group
              <FullInput
                value={viewGroupDraft}
                onChange={(e) => setViewGroupDraft(e.target.value)}
                onBlur={commitViewGroup}
                placeholder="Maps sharing this name move together"
                isValid={true}
                aria-label="View Group Input"
              />
            </InputLabel>
          </InputRow>
          <InputRow>
            <CheckboxLabel $disabled={Boolean(initialExtentDisabledReason)}>
              <input
                type="checkbox"
                checked={isGroupInitialExtent}
                disabled={Boolean(initialExtentDisabledReason)}
                onChange={handleGroupInitialExtentChange}
                aria-label="View Group Initial Extent Input"
              />
              Use as the view group&apos;s initial extent
            </CheckboxLabel>
          </InputRow>
          {initialExtentDisabledReason && (
            <HelpText>{initialExtentDisabledReason}</HelpText>
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
  values: PropTypes.oneOfType([
    PropTypes.string, // legacy bare extent string
    PropTypes.shape({
      extent: PropTypes.oneOfType([
        PropTypes.string, // minX,minY,maxX,maxY or lon,lat,zoom
        PropTypes.object, // legacy doubly wrapped { extent: { extent } }
      ]),
      variable: PropTypes.string,
      viewGroup: PropTypes.string,
      isGroupInitialExtent: PropTypes.bool,
    }),
  ]),
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};
