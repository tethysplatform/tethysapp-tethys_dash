import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

const CustomPicker = ({ maxColCount, pickerOptions, setPickervalue }) => {
  const pickerKeys = Object.keys(pickerOptions);
  const quotient = Math.floor(pickerKeys.length / maxColCount);
  const remainder = pickerKeys.length % maxColCount;

  return (
    <Container>
      {Array.from(Array(quotient)).map((row, rowIndex) => (
        <Row key={rowIndex}>
          {Array.from(Array(maxColCount)).map((col, colIndex) => {
            const pickerKey = pickerKeys[rowIndex * maxColCount + colIndex];
            const PickerComponent = pickerOptions[pickerKey];
            return (
              <Col key={colIndex} onClick={() => setPickervalue(pickerKey)}>
                {PickerComponent}
              </Col>
            );
          })}
        </Row>
      ))}
      <Row>
        {Array.from(Array(remainder)).map((col, colIndex) => {
          const pickerKey = pickerKeys[quotient * maxColCount + colIndex];
          const PickerComponent = pickerOptions[pickerKey];
          return (
            <Col key={colIndex} onClick={() => setPickervalue(pickerKey)}>
              {PickerComponent}
            </Col>
          );
        })}
      </Row>
    </Container>
  );
};

export default CustomPicker;
