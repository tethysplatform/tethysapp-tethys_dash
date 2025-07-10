import { parse, isValid, format } from "date-fns";
import { useState } from "react";
import PropTypes from "prop-types";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const isValidDateString = (str) => {
  if (typeof str !== "string") return false;

  const formats = ["MM/dd/yyyy", "MM/dd/yyyy h:mm aa"];

  return formats.some((fmt) => {
    const parsed = parse(str, fmt, new Date());
    return isValid(parsed) && format(parsed, fmt) === str;
  });
};

const DatePicker = ({ label, value, onChange, type }) => {
  const [placeholderText, setPlaceholderText] = useState(
    checkForVariable(value) && value
  );

  function checkForVariable(val) {
    if (typeof val !== "string") return false;
    // Regex to find at least one `${...}` anywhere in the string
    return /\$\{[^}]+\}/.test(val);
  }

  const handleRawChange = (e) => {
    const val = e.target.value;
    if (checkForVariable(val)) {
      onChange(val);
      setPlaceholderText(val);
    }
  };

  const handleDateChange = (date) => {
    if (type === "date") {
      onChange(format(date, "MM/dd/yyyy"));
    } else {
      onChange(format(date, "MM/dd/yyyy h:mm aa"));
    }
    setPlaceholderText("");
  };

  return (
    <div className="date-picker">
      {label && (
        <label htmlFor={label} style={{ display: "block", marginBottom: 4 }}>
          {label}
        </label>
      )}
      <ReactDatePicker
        id={label}
        name={label}
        placeholderText={placeholderText}
        selected={isValidDateString(value) ? new Date(value) : null}
        onChange={handleDateChange}
        onChangeRaw={handleRawChange}
        showTimeInput={type === "date-hour"}
        dateFormat={type === "date-hour" ? "MM/dd/yyyy h:mm aa" : "MM/dd/yyyy"}
        timeInputLabel="Time:"
      />
    </div>
  );
};

DatePicker.propTypes = {
  label: PropTypes.string,
  type: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
  onChange: PropTypes.func,
  value: PropTypes.string,
};

export default DatePicker;
