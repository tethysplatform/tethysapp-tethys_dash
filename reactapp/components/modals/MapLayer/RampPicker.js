import { Fragment } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { COLOR_RAMPS, RAMP_GROUPS } from "components/map/colorRamps";

const PickerList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
  /* Enough ramps now that the list needs its own scroll rather than pushing the
     rest of the Style tab off-screen. */
  max-height: 320px;
  overflow-y: auto;
`;

const GroupLabel = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6c757d;
  margin: 4px 0 0 2px;

  &:first-child {
    margin-top: 0;
  }
`;

const RampLabel = styled.span`
  flex: 0 0 5.5rem;
  font-size: 0.8rem;
  color: #212529;
`;

const RampRow = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 6px 10px;
  background: ${({ $selected }) => ($selected ? "#e7f1ff" : "transparent")};
  border: 2px solid
    ${({ $selected }) => ($selected ? "#007bff" : "transparent")};
  border-radius: 4px;
  cursor: pointer;
  text-align: left;

  &:hover {
    border-color: ${({ $selected }) => ($selected ? "#007bff" : "#ccc")};
  }

  &:focus {
    outline: 2px solid #0056b3;
    outline-offset: 1px;
  }
`;

const GradientSwatch = styled.span`
  flex: 1;
  height: 20px;
  min-width: 180px;
  border: 1px solid #ddd;
  border-radius: 3px;
  background: ${({ $gradient }) => $gradient};
`;

const buildGradient = (colors) =>
  `linear-gradient(to right, ${colors.join(", ")})`;

const RampPicker = ({ selectedRamp, onChange }) => {
  return (
    <PickerList role="radiogroup" aria-label="Color ramp picker">
      {RAMP_GROUPS.map((group) => (
        <Fragment key={group.label}>
          <GroupLabel aria-hidden="true">{group.label}</GroupLabel>
          {group.names.map((name) => {
            const colors = COLOR_RAMPS[name];
            const isSelected = selectedRamp === name;
            return (
              <RampRow
                key={name}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`Select ${name} ramp`}
                data-testid={`ramp-option-${name}`}
                data-selected={isSelected ? "true" : "false"}
                $selected={isSelected}
                onClick={() => onChange(name)}
              >
                <RampLabel>{name}</RampLabel>
                <GradientSwatch
                  aria-hidden="true"
                  data-testid={`ramp-swatch-${name}`}
                  $gradient={buildGradient(colors)}
                />
              </RampRow>
            );
          })}
        </Fragment>
      ))}
    </PickerList>
  );
};

RampPicker.propTypes = {
  selectedRamp: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

RampPicker.defaultProps = {
  selectedRamp: null,
};

export default RampPicker;
