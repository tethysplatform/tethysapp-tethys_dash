import PropTypes from "prop-types";
import { DatePicker } from "components/inputs/DatePicker";

export const DateRange = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  ...props
}) => {
  return (
    <div style={{ display: "flex", gap: "1rem" }}>
      <DatePicker
        label="Start Date"
        selectedDate={startDate}
        onDateChange={onStartDateChange}
        {...props}
      />
      <DatePicker
        label="End Date"
        selectedDate={endDate}
        onDateChange={onEndDateChange}
        {...props}
      />
    </div>
  );
};

DateRange.propTypes = {
  startDate: PropTypes.string,
  endDate: PropTypes.string,
  onStartDateChange: PropTypes.func.isRequired,
  onEndDateChange: PropTypes.func.isRequired,
};

export default DateRange;
