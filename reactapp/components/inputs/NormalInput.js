import Form from "react-bootstrap/Form";
import PropTypes from "prop-types";

const NormalInput = ({
  label,
  onChange,
  value,
  type,
  ariaLabel,
  placeholder,
  divProps,
  labelProps,
  min,
  max,
}) => {
  return (
    <div {...divProps}>
      {label && (
        <Form.Label className="no-caret" {...labelProps}>
          <b>{label}</b>:
        </Form.Label>
      )}
      <Form.Control
        aria-label={ariaLabel || label + " Input"}
        type={type}
        onChange={onChange}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault(); // prevents submitting form on enter
          }
        }}
        value={value}
        placeholder={placeholder}
        min={min !== undefined ? min : null}
        max={max !== undefined ? max : null}
      />
    </div>
  );
};

NormalInput.propTypes = {
  placeholder: PropTypes.string,
  ariaLabel: PropTypes.string,
  label: PropTypes.string, // label for the input
  onChange: PropTypes.func, // callback function when the input changes
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), // state for input value
  type: PropTypes.string, // type of input to use
  divProps: PropTypes.object, // additional props to pass to the parent div
  labelProps: PropTypes.object, // additional props to pass to the label
  min: PropTypes.number, // minimum value for the input
  max: PropTypes.number, // maximum value for the input
};

export default NormalInput;
