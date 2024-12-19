import PropTypes from "prop-types";
import styled from "styled-components";
import Form from "react-bootstrap/Form";

const StyledDiv = styled.div`
  padding-bottom: 1rem;
  width: 100%;
`;

const DataRadioSelect = ({ label, selectedRadio, radioOptions, onChange }) => {
  let RadioButtons = [];
  for (let i = 0; i < radioOptions.length; i++) {
    RadioButtons.push(
      <Form.Check
        inline
        key={i}
        label={radioOptions[i]["label"]}
        aria-label={radioOptions[i]["label"]}
        name="group1"
        type="radio"
        onChange={onChange}
        value={radioOptions[i]["value"]}
        checked={selectedRadio === radioOptions[i]["value"]}
      />
    );
  }

  return (
    <StyledDiv>
      <b>{label}:</b>
      <br />
      {RadioButtons}
    </StyledDiv>
  );
};

DataRadioSelect.propTypes = {
  label: PropTypes.string,
  onChange: PropTypes.func,
  selectedRadio: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  radioOptions: PropTypes.array,
};

export default DataRadioSelect;
