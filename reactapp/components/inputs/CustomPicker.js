import PropTypes from "prop-types";
import styled from "styled-components";
import { Container, Row, Col } from "react-bootstrap";

const HighlightedCol = styled(Col)`
  border: 2px solid ${({ selected }) => (selected ? "#007bff" : "transparent")};
  border-radius: 4px;
  padding: 0.25rem;
  cursor: pointer;

  &:hover {
    border-color: ${({ selected }) => (selected ? "#007bff" : "#ccc")};
  }
`;

const CustomPicker = ({ pickerOptions, onSelect, selected }) => {
  const pickerKeys = Object.keys(pickerOptions);

  return (
    <Container fluid>
      <Row>
        {pickerKeys.map((pickerKey) => {
          const PickerComponent = pickerOptions[pickerKey];
          const isSelected = pickerKey === selected;
          return (
            <HighlightedCol
              key={pickerKey}
              xs="auto"
              onClick={() => onSelect(pickerKey)}
              selected={isSelected}
            >
              <PickerComponent />
            </HighlightedCol>
          );
        })}
      </Row>
    </Container>
  );
};

CustomPicker.propTypes = {
  pickerOptions: PropTypes.objectOf(PropTypes.elementType).isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default CustomPicker;
