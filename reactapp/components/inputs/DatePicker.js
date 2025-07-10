import { format } from "date-fns";
import PropTypes from "prop-types";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const DatePicker = ({ label, value, onChange, type, inputProps = {} }) => {
  const commonProps = {
    id: label,
    selected: value,
    name: label,
    placeholderText: "Select a Date",
    ...inputProps,
  };

  const labelEl = (
    <label htmlFor={label} style={{ display: "block", marginBottom: 4 }}>
      <b>{label}</b>:
    </label>
  );

  return (
    <div className="date-picker">
      {labelEl}
      {type === "date-hour" ? (
        <ReactDatePicker
          {...commonProps}
          onChange={(date) => onChange(format(date, "MM/dd/yyyy h:mm aa"))}
          showTimeInput
          timeInputLabel="Time:"
          dateFormat="MM/dd/yyyy h:mm aa"
        />
      ) : (
        <ReactDatePicker
          {...commonProps}
          onChange={(date) => onChange(format(date, "MM/dd/yyyy"))}
          dateFormat="MM/dd/yyyy"
        />
      )}
    </div>
  );
};

DatePicker.propTypes = {
  label: PropTypes.string, // label for the input
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), // state for input value
  onChange: PropTypes.func, // callback function when the input changes
  type: PropTypes.string, // type of input to use
  name: PropTypes.string,
  inputProps: PropTypes.object, // additional props to pass to the parent div
};

export default DatePicker;
