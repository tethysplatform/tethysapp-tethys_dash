import PropTypes from "prop-types";
import Select from "react-select";
import styled from "styled-components";

const StyledDiv = styled.div`
  padding-bottom: 1rem;
`;

const DataSelect = ({ label, selectedOption, onChange, options }) => {
  const id = label.toLowerCase().replace(" ", "");
  return (
    <StyledDiv>
      <label htmlFor={id}>{label}</label>
      <Select
        options={options}
        value={selectedOption}
        onChange={onChange}
        inputID={id}
      />
    </StyledDiv>
  );
};

DataSelect.propTypes = {
  onChange: PropTypes.func,
};

export default DataSelect;
