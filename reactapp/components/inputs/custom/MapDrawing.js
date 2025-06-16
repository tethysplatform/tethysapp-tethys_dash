import { useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { mapDrawingPropType } from "components/map/utilities";
import { drawTypes } from "components/map/DrawInteractions";

const Container = styled.div`
  margin-left: 1.5rem;
  gap: 1rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
`;

export const MapDrawing = ({ onChange, values }) => {
  const [selected, setSelected] = useState(values?.options ?? []);
  const [featureLimit, setFeatureLimit] = useState(values?.limit ?? 0);
  const [geometryVariable, setGeometryVariable] = useState(
    values?.variable ?? ""
  );

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

    const newValues = {
      options: newSelected,
      ...(featureLimit && { limit: featureLimit }),
      ...(geometryVariable && { variable: geometryVariable }),
    };
    onChange(newValues);
  };

  const handleLimitChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setFeatureLimit(value);

    if (selected.length > 0) {
      const newValues = {
        options: selected,
        limit: value,
        ...(geometryVariable && { variable: geometryVariable }),
      };
      onChange(newValues);
    }
  };

  const handleVariableChange = (e) => {
    const value = e.target.value;
    setGeometryVariable(value);

    if (selected.length > 0) {
      const newValues = {
        options: selected,
        variable: value,
        ...(featureLimit && { limit: featureLimit }),
      };
      onChange(newValues);
    }
  };

  return (
    <>
      <p>
        <b>Map Drawing</b>:
      </p>
      <Container>
        {Object.keys(drawTypes).map((option) => (
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
            min="0"
            value={featureLimit}
            onChange={handleLimitChange}
          />
        </label>
        <label>
          <b>Geometry Variable Name:</b>{" "}
          <input
            type="text"
            value={geometryVariable}
            onChange={handleVariableChange}
          />
        </label>
      </Container>
    </>
  );
};

MapDrawing.propTypes = {
  onChange: PropTypes.func,
  values: mapDrawingPropType,
};
