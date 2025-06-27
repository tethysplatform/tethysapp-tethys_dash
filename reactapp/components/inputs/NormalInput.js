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
}) => {
  return (
    <div {...divProps}>
      {label && (
        <Form.Label className="no-caret">
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
};

export default NormalInput;
