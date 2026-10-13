import Form from "react-bootstrap/Form";
import PropTypes from "prop-types";
import styled from "styled-components";

const FlexDiv = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
`;

const CheckboxInput = ({
  label,
  onChange,
  value,
  type,
  inputProps,
  divProps,
  hideLabel = false,
}) => {
  const changeHandler = (e) => {
    onChange(e.target.checked);
  };

  return (
    <FlexDiv {...divProps}>
      {/* `label` still names the control for assistive tech even when it is
          not drawn — for a caller that already renders its own label beside
          the checkbox and would otherwise show it twice. */}
      {label && !hideLabel && (
        <label className="no-caret">
          <b>{label}</b>:
        </label>
      )}
      <Form.Check
        aria-label={label + " Input"}
        type={type}
        id={label.replace(" ", "_")}
        checked={value}
        onChange={changeHandler}
        {...inputProps}
      />
    </FlexDiv>
  );
};

CheckboxInput.propTypes = {
  label: PropTypes.string, // label for the input
  onChange: PropTypes.func, // callback function when the input changes
  value: PropTypes.bool, // state for input value
  type: PropTypes.string, // type of input to use
  inputProps: PropTypes.object, // additional props to pass to the input
  divProps: PropTypes.object, // additional props to pass to the parent div
  hideLabel: PropTypes.bool, // hide the visible label; the accessible name is unaffected
};

export default CheckboxInput;
