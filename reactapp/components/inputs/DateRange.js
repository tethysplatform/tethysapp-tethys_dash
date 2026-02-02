import PropTypes from "prop-types";
import { useState } from "react";
import DatePicker from "components/inputs/DatePicker";

export const DateRange = ({
  values,
  onChange,
  metadata,
  divProps,
  ...props
}) => {
  const [startDate, setStartDate] = useState(
    values?.[metadata?.startDateVariable || "Start Date"] || "",
  );
  const [endDate, setEndDate] = useState(
    values?.[metadata?.endDateVariable || "End Date"] || "",
  );

  const startDateVariable = metadata?.startDateVariable || "Start Date";
  const endDateVariable = metadata?.endDateVariable || "End Date";

  const onStartDateChange = (newDate) => {
    setStartDate(newDate);
    onChange({ [startDateVariable]: newDate, [endDateVariable]: endDate });
  };

  const onEndDateChange = (newDate) => {
    setEndDate(newDate);
    onChange({ [startDateVariable]: startDate, [endDateVariable]: newDate });
  };

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
  values: PropTypes.shape({
    startDate: PropTypes.string,
    endDate: PropTypes.string,
  }),
  onChange: PropTypes.func.isRequired,
  metadata: PropTypes.object,
  divProps: PropTypes.object,
};

export default DateRange;
