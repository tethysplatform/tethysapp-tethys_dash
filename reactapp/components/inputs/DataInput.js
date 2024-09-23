import PropTypes from "prop-types";
import styled from "styled-components";
import Form from "react-bootstrap/Form";
import DataSelect from "components/inputs/DataSelect";

const StyledDiv = styled.div`
  padding-bottom: 1rem;
  width: 100%;
`;

const Input = ({ label, type, onChange, value, index }) => {
  if (Array.isArray(type)) {
    let options = [];
    for (const option of type) {
      if (typeof option === "object") {
        options.push(option);
      } else {
        options.push({ value: option, label: option });
      }
    }

    return (
      <DataSelect
        label={label}
        selectedOption={value}
        onChange={(e) => onChange(e, index)}
        options={options}
      />
    );
  } else if (type === "checkbox") {
    return (
      <>
        <Form.Check
          type={type}
          id={label.replace(" ", "_")}
          label={label}
          checked={value}
          onChange={(e) => onChange(e.target.checked, index)}
        />
      </>
    );
  } else {
    return (
      <>
        <Form.Label>{label}</Form.Label>
        <Form.Control
          required
          type={type}
          onChange={(e) => onChange(e.target.value, index)}
          value={value}
        />
      </>
    );
  }
};

const DataInput = ({ objValue, onChange, index }) => {
  const { label, type, value } = objValue;

  return (
    <StyledDiv>
      <Input
        label={label}
        type={type}
        onChange={onChange}
        value={value}
        index={index}
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
