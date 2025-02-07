import PropTypes from "prop-types";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

const CustomPicker = ({ maxColCount, pickerOptions, onSelect }) => {
  // calculate how many rows (fullrows + 1 for any remainders) are needed based on the numbers of keys and the maxColCount
  const pickerKeys = Object.keys(pickerOptions);
  const numFullRows = Math.floor(pickerKeys.length / maxColCount);
  const colsLeftInRemainderRow = pickerKeys.length % maxColCount;

  return (
    <Container>
      {Array.from(Array(numFullRows)).map((_, rowIndex) => (
        <Row key={rowIndex}>
          {Array.from(Array(maxColCount)).map((__, colIndex) => {
            const pickerKey = pickerKeys[rowIndex * maxColCount + colIndex];
            const PickerComponent = pickerOptions[pickerKey];
            return (
              <Col key={colIndex} onClick={() => onSelect(pickerKey)}>
                {PickerComponent}
              </Col>
            );
          })}
        </Row>
      ))}
      <Row>
        {Array.from(Array(colsLeftInRemainderRow)).map((_, colIndex) => {
          const pickerKey = pickerKeys[numFullRows * maxColCount + colIndex];
          const PickerComponent = pickerOptions[pickerKey];
          return (
            <Col key={colIndex} onClick={() => onSelect(pickerKey)}>
              {PickerComponent}
            </Col>
          );
        })}
      </Row>
    </Container>
  );
};

CustomPicker.propTypes = {
  maxColCount: PropTypes.number.isRequired, // max number of columns to show
  pickerOptions: PropTypes.objectOf(PropTypes.element).isRequired, // objects with keys as identifiers and values as components to render
  onSelect: PropTypes.func.isRequired, // callback function for when an option is selected
};

export default CustomPicker;
