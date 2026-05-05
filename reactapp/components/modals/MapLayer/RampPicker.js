import PropTypes from "prop-types";
import styled from "styled-components";
import { COLOR_RAMPS, RAMP_NAMES } from "components/map/colorRamps";

const PickerList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
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

const RampLabel = styled.span`
  min-width: 90px;
  font-size: 0.9rem;
  font-weight: 500;
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
      {RAMP_NAMES.map((name) => {
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
