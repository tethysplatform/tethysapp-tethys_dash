import PropTypes from "prop-types";
import CreatableSelect from "react-select/creatable";
import Select from "react-select";
import styled from "styled-components";

const StyledDiv = styled.div`
  margin-bottom: 1rem;
`;

const DataSelect = ({
  label,
  value,
  selectedOption,
  onChange,
  options,
  creatable = true,
  divProps,
  ...props
}) => {
  let id;
  if (label) {
    id = label.toLowerCase().replace(" ", "");
  }

  // Support both value (string) and selectedOption (object) props for flexibility
  // If value is provided, map it to the corresponding option object
  const optionValue =
    selectedOption ||
    (typeof value !== "undefined"
      ? options.find((opt) => opt.value === value) || null
      : null);

  // Always call onChange with just the value (string)
  const handleChange = (option) => {
    if (option && option.value !== undefined) {
      onChange(option.value);
    } else {
      onChange("");
    }
  };

  return (
    <StyledDiv {...divProps}>
      {label && (
        <label htmlFor={id} className="no-caret">
          <b>{label}</b>:
        </label>
      )}
      {creatable ? (
        <CreatableSelect
          formatCreateLabel={(userInput) => `Use "${userInput}"`}
          options={options}
          value={optionValue}
          onChange={handleChange}
          aria-label={id}
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
      ) : (
        <Select
          options={options}
          value={optionValue}
          onChange={handleChange}
          inputID={id}
          aria-label={id}
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
      )}
    </StyledDiv>
  );
};

DataSelect.propTypes = {
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  selectedOption: PropTypes.object,
  options: PropTypes.array.isRequired,
  creatable: PropTypes.bool,
  divProps: PropTypes.object,
};

export default DataSelect;
