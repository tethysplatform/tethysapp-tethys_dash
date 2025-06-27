import PropTypes from "prop-types";
import CreatableSelect from "react-select/creatable";
import styled from "styled-components";

const StyledDiv = styled.div`
  margin-bottom: 1rem;
`;

const DataSelect = ({ label, selectedOption, onChange, options, ...props }) => {
  let id;
  if (label) {
    id = label.toLowerCase().replace(" ", "");
  }
  return (
    <StyledDiv>
      {label && (
        <label htmlFor={id} className="no-caret">
          <b>{label}</b>:
        </label>
      )}
      <CreatableSelect
        formatCreateLabel={(userInput) => `Use "${userInput}"`}
        options={options}
        value={selectedOption}
        onChange={onChange}
        inputID={id}
        styles={{
          groupHeading: (base) => ({
            ...base,
            flex: "1 1",
            color: "black",
            backgroundColor: "lightgray",
            margin: 0,
            fontSize: "12",
          }),
        }}
        {...props}
      />
    </StyledDiv>
  );
};

DataSelect.propTypes = {
  onChange: PropTypes.func,
  label: PropTypes.string,
  selectedOption: PropTypes.object,
  options: PropTypes.array,
};

export default DataSelect;
