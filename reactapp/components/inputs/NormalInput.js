import Form from "react-bootstrap/Form";
import PropTypes from "prop-types";

const NormalInput = ({ label, onChange, value, type }) => {
  return (
    <div>
      {label && (
        <Form.Label>
          <b>{label}</b>:
        </Form.Label>
      )}
      <Form.Control
        aria-label={label + " Input"}
        type={type}
        onChange={onChange}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault(); // prevents submitting form on enter
          }
        }}
        value={value}
      />
    </div>
  );
};

NormalInput.propTypes = {
  label: PropTypes.string, // label for the input
  onChange: PropTypes.func, // callback function when the input changes
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), // state for input value
  type: PropTypes.string, // type of input to use
};

export default NormalInput;
