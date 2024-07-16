import PropTypes from "prop-types";
import styled from "styled-components";
import Form from "react-bootstrap/Form";

const StyledDiv = styled.div`
  padding-bottom: 1rem;
  width: 100%;
`;

const DataInput = ({ inputLabel, inputText, onChange }) => {
  return (
    <StyledDiv>
      <Form.Label>{inputLabel}</Form.Label>
      <Form.Control
        required
        type="text"
        onChange={onChange}
        value={inputText}
        data-inputlabel={inputLabel.toLowerCase().replace(" ", "")}
      />
    </StyledDiv>
  );
};

DataInput.propTypes = {
  onChange: PropTypes.func,
  inputLabel: PropTypes.string,
  inputText: PropTypes.string,
};

export default DataInput;
