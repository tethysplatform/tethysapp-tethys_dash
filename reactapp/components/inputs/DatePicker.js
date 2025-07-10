import { format } from "date-fns";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const DatePicker = ({
  label = "Select Date",
  value,
  onChange,
  name = "date",
  type = "date",
  inputProps = {},
}) => {
  const commonProps = {
    id: name,
    selected: value,
    name,
    placeholderText: label,
    ...inputProps,
  };

  const labelEl = (
    <label htmlFor={name} style={{ display: "block", marginBottom: 4 }}>
      {label}
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

export default DatePicker;
