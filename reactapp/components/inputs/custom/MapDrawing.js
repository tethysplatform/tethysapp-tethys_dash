import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";

const Container = styled.div`
  gap: 1rem;
  display: flex;
  flex-wrap: wrap;
`;

const drawingOptions = ["Point", "LineString", "Polygon", "Circle"];

export const MapDrawing = ({ onChange, values, visualizationRef }) => {
  const [selected, setSelected] = useState(values ?? []);

  const handleToggle = (option) => {
    let newSelected;
    if (selected.includes(option)) {
      newSelected = selected.filter((item) => item !== option);
    } else {
      newSelected = [...selected, option];
    }
    setSelected(newSelected);
    onChange(newSelected);
  };

  return (
    <Container>
      <p>
        <b>Map Drawing</b>:
      </p>
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
    </Container>
  );
};

MapDrawing.propTypes = {
  onChange: PropTypes.func,
  values: PropTypes.string,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};
