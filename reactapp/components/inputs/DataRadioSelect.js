import PropTypes from "prop-types";
import styled from "styled-components";
import Form from "react-bootstrap/Form";

const StyledDiv = styled.div`
  padding-bottom: 1rem;
  width: 100%;
`;

const DataRadioSelect = ({ selectedRadio, radioOptions, onChange }) => {
  let RadioButtons = [];
  for (let i = 0; i < radioOptions.length; i++) {
    RadioButtons.push(
      <Form.Check
        inline
        key={i}
        label={radioOptions[i]["label"]}
        name="group1"
        type="radio"
        onChange={onChange}
        value={radioOptions[i]["value"]}
        checked={selectedRadio === radioOptions[i]["value"]}
      />
    );
  }

  return <StyledDiv>{RadioButtons}</StyledDiv>;
};

DataRadioSelect.propTypes = {
  onChange: PropTypes.func,
};

export default DataRadioSelect;
