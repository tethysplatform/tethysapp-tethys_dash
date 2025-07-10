import Form from "react-bootstrap/Form";
import PropTypes from "prop-types";

const TextArea = ({ label, onChange, value, maxLength }) => {
  return (
    <div>
      <Form.Label>
        <b>{label}</b>:
      </Form.Label>
      <Form.Control
        as="textarea"
        rows={3}
        aria-label={label + " Input"}
        onChange={onChange}
        value={value}
        maxLength={maxLength}
        placeholder={`Enter up to ${maxLength} characters`}
      />
    </div>
  );
};

TextArea.propTypes = {
  label: PropTypes.string, // label for the input
  onChange: PropTypes.func, // callback function when the input changes
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), // state for input value
  type: PropTypes.string, // type of input to use
  maxLength: PropTypes.number,
};

export default TextArea;
