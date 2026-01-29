import PropTypes from "prop-types";
import DatePicker from "components/inputs/DatePicker";

export const DateRange = ({
  label,
  startDate,
  startDateVariable,
  endDate,
  endDateVariable,
  onStartDateChange,
  onEndDateChange,
  divProps,
  ...props
}) => {
  return (
    <div {...divProps}>
      <div style={{ display: "flex", gap: "1rem" }}>
        <DatePicker
          label={startDateVariable}
          value={startDate}
          onChange={onStartDateChange}
          {...props}
        />
        <DatePicker
          label={endDateVariable}
          value={endDate}
          onChange={onEndDateChange}
          {...props}
        />
      </div>
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
