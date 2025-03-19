import PropTypes from "prop-types";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

const CustomPicker = ({ pickerOptions, onSelect }) => {
  const pickerKeys = Object.keys(pickerOptions);

  return (
    <Container fluid>
      <Row>
        {pickerKeys.map((pickerKey) => {
          const PickerComponent = pickerOptions[pickerKey];
          return (
            <Col key={pickerKey} xs="auto" onClick={() => onSelect(pickerKey)}>
              <PickerComponent />
            </Col>
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
