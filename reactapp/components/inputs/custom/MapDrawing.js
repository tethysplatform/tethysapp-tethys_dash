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
  padding: 0.5rem 0;
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

const StyledDiv = styled.div`
  border: 1px solid #dedddd;
`;

export const MapDrawing = ({ onChange, values }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(values?.options ?? []);
  const [featureLimit, setFeatureLimit] = useState(values?.limit ?? 0);
  const [geometryVariable, setGeometryVariable] = useState(
    values?.variable ?? ""
  );

  const handleToggle = (option) => {
    const newSelected = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option];

    setSelected(newSelected);

    if (newSelected.length === 0) {
      onChange({});
      return;
    }

    onChange({
      options: newSelected,
      ...(featureLimit && { limit: featureLimit }),
      ...(geometryVariable && { variable: geometryVariable }),
    });
  };

  const handleLimitChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setFeatureLimit(value);

    if (selected.length > 0) {
      onChange({
        options: selected,
        limit: value,
        ...(geometryVariable && { variable: geometryVariable }),
      });
    }
  };

  const handleVariableChange = (e) => {
    const value = e.target.value;
    setGeometryVariable(value);

    if (selected.length > 0) {
      onChange({
        options: selected,
        variable: value,
        ...(featureLimit && { limit: featureLimit }),
      });
    }
  };

  return (
    <StyledDiv>
      <CollapsibleHeader onClick={() => setIsOpen(!isOpen)}>
        <span>Map Drawing</span>
        <ArrowIcon>{isOpen ? "▾" : "▸"}</ArrowIcon>
      </CollapsibleHeader>

      {isOpen && (
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
      )}
    </StyledDiv>
  );
};

MapDrawing.propTypes = {
  onChange: PropTypes.func,
  values: mapDrawingPropType,
};
