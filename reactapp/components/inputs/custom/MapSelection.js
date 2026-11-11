import { useId, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import Table from "react-bootstrap/Table";
import {
  MAP_SELECTION_KEYS,
  MAP_SELECTION_LABELS,
  mapSelectionPropType,
  resolveMapSelection,
} from "components/map/mapSelection";

const Container = styled.div`
  margin-left: 1.5rem;
  padding: 0.5rem 0;
`;

// A button rather than MapDrawing's clickable div, so the section can be
// opened from the keyboard; styled to match the neighboring headers.
const CollapsibleHeader = styled.button`
  width: 100%;
  border: none;
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

const StyledDiv = styled.div`
  border: 1px solid #dedddd;
`;

const SelectionTable = styled(Table)`
  width: auto;
  margin-bottom: 0;
`;

// The saved value holds only what differs from the defaults (on the map, not
// in the legend, listed in the layer control), so a map left at the defaults
// saves `{}`, the same as a map saved before the setting existed. A mark the
// map does not draw saves only that.
const toSavedValue = (setting) =>
  Object.fromEntries(
    MAP_SELECTION_KEYS.flatMap((key) => {
      const { map, legend, layerControl } = setting[key];
      const entry = map
        ? {
            ...(legend ? { legend: true } : {}),
            ...(layerControl ? {} : { layerControl: false }),
          }
        : { map: false };
      return Object.keys(entry).length > 0 ? [[key, entry]] : [];
    }),
  );

export const MapSelection = ({ onChange, values }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [setting, setSetting] = useState(() => resolveMapSelection(values));
  const idPrefix = useId();

  const handleToggle = (key, field, checked) => {
    const entry = { ...setting[key], [field]: checked };
    // Turning a mark off or back on resets what depends on it to the
    // defaults: a legend entry or a layer-control row would describe a mark
    // the map no longer draws, and a mark that comes back is listed in the
    // layer control as it would be on a new map.
    if (field === "map") {
      entry.legend = false;
      entry.layerControl = checked;
    }
    const next = { ...setting, [key]: entry };
    setSetting(next);
    onChange(toSavedValue(next));
  };

  return (
    <StyledDiv>
      <CollapsibleHeader
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>Map Selection</span>
        <ArrowIcon aria-hidden="true">{isOpen ? "▾" : "▸"}</ArrowIcon>
      </CollapsibleHeader>

      {isOpen && (
        <Container>
          <SelectionTable size="sm" borderless>
            <thead>
              <tr>
                <td />
                <th scope="col" className="text-center">
                  Show on map
                </th>
                <th scope="col" className="text-center">
                  Show in legend
                </th>
                <th scope="col" className="text-center">
                  Show in layer control
                </th>
              </tr>
            </thead>
            <tbody>
              {MAP_SELECTION_KEYS.map((key) => {
                const label = MAP_SELECTION_LABELS[key];
                const { map, legend, layerControl } = setting[key];
                const hintId = `${idPrefix}-${key}-needs-map-hint`;
                return (
                  <tr key={key}>
                    <th scope="row">{label}</th>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        aria-label={`${label} Show on map`}
                        checked={map}
                        onChange={(e) =>
                          handleToggle(key, "map", e.target.checked)
                        }
                      />
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        aria-label={`${label} Show in legend`}
                        aria-describedby={map ? undefined : hintId}
                        title={map ? undefined : "Turn on Show on map first"}
                        checked={legend}
                        disabled={!map}
                        onChange={(e) =>
                          handleToggle(key, "legend", e.target.checked)
                        }
                      />
                      {!map && (
                        <span id={hintId} className="visually-hidden">
                          Turn on Show on map first
                        </span>
                      )}
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        aria-label={`${label} Show in layer control`}
                        aria-describedby={map ? undefined : hintId}
                        title={map ? undefined : "Turn on Show on map first"}
                        checked={layerControl}
                        disabled={!map}
                        onChange={(e) =>
                          handleToggle(key, "layerControl", e.target.checked)
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </SelectionTable>
        </Container>
      )}
    </StyledDiv>
  );
};

MapSelection.propTypes = {
  onChange: PropTypes.func,
  values: mapSelectionPropType,
};
