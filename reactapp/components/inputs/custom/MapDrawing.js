import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";

const Container = styled.div`
  margin-left: 1.5rem;
  gap: 1rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
`;

const drawingOptions = ["Point", "LineString", "Polygon", "Circle"];

export const MapDrawing = ({ onChange, values, visualizationRef }) => {
  const [selected, setSelected] = useState(values?.options ?? []);
  const [featureLimit, setFeatureLimit] = useState(values?.limit ?? 0);

  const handleToggle = (option) => {
    let newSelected;
    if (selected.includes(option)) {
      newSelected = selected.filter((item) => item !== option);
    } else {
      newSelected = [...selected, option];
    }
    setSelected(newSelected);

    if (newSelected.length === 0) {
      onChange({});
      return;
    }

    const newValues = featureLimit
      ? { options: newSelected, limit: featureLimit }
      : { options: newSelected };
    onChange(newValues);
  };

  const handleLimitChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setFeatureLimit(value);

    if (selected.length > 0) {
      onChange({ options: selected, limit: value });
    }
  };

  return (
    <>
      <p>
        <b>Map Drawing</b>:
      </p>
      <Container>
        {drawingOptions.map((option) => (
          <label key={option}>
            {option}{" "}
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => handleToggle(option)}
            />
          </label>
        ))}
        <label>
          <b>Drawn Feature Limit:</b>{" "}
          <input
            type="number"
            min="1"
            value={featureLimit}
            onChange={handleLimitChange}
          />
        </label>
      </Container>
    </>
  );
};

MapDrawing.propTypes = {
  onChange: PropTypes.func,
  values: PropTypes.arrayOf(PropTypes.string),
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};
