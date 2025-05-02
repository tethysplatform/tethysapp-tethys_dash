import Form from "react-bootstrap/Form";
import PropTypes from "prop-types";
import styled from "styled-components";

const InlineLabel = styled.label`
  display: inline;
`;

const InlineFormCheck = styled(Form.Check)`
  display: inline;
  margin-left: 0.5rem;
`;

const CheckboxInput = ({
  label,
  onChange,
  value,
  type,
  inputProps,
  divProps,
}) => {
  return (
    <div {...divProps}>
      {label && (
        <InlineLabel className="no-caret">
          <b>{label}</b>:
        </InlineLabel>
      )}
      <InlineFormCheck
        aria-label={label + " Input"}
        type={type}
        id={label.replace(" ", "_")}
        checked={value}
        onChange={onChange}
        {...inputProps}
      />
    </div>
  );
};

CheckboxInput.propTypes = {
  label: PropTypes.string, // label for the input
  onChange: PropTypes.func, // callback function when the input changes
  value: PropTypes.bool, // state for input value
  type: PropTypes.string, // type of input to use
  inputProps: PropTypes.object, // additional props to pass to the input
  divProps: PropTypes.object, // additional props to pass to the parent div
};

export default CheckboxInput;
