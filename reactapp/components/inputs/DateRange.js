import PropTypes from "prop-types";
import { useEffect, useRef } from "react";
import DatePicker from "components/inputs/DatePicker";

export const DateRange = ({
  values,
  onChange,
  metadata,
  divProps,
  ...props
}) => {
  const startDateVariable = metadata?.startDateVariable || "Start Date";
  const endDateVariable = metadata?.endDateVariable || "End Date";
  const startDate = values?.[startDateVariable] || "";
  const endDate = values?.[endDateVariable] || "";

  const startDateVariableRef = useRef(startDateVariable);
  const endDateVariableRef = useRef(endDateVariable);

  useEffect(() => {
    if (
      startDateVariableRef.current === startDateVariable &&
      endDateVariableRef.current === endDateVariable
    )
      return;

    const oldStartDate = values?.[startDateVariableRef.current] || startDate;
    const oldEndDate = values?.[endDateVariableRef.current] || endDate;
    onChange({
      [startDateVariable]: oldStartDate,
      [endDateVariable]: oldEndDate,
    });

    startDateVariableRef.current = startDateVariable;
    endDateVariableRef.current = endDateVariable;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, startDateVariable, endDateVariable]);

  const onStartDateChange = (newDate) => {
    onChange({ [startDateVariable]: newDate, [endDateVariable]: endDate });
  };

  const onEndDateChange = (newDate) => {
    onChange({ [startDateVariable]: startDate, [endDateVariable]: newDate });
  };

  return (
    <div {...divProps}>
      <div style={{ display: "flex", gap: "1rem" }}>
        <div style={{ flex: 1 }}>
          <DatePicker
            label={startDateVariable}
            value={startDate}
            onChange={onStartDateChange}
            dateFormat={metadata?.format}
            {...props}
          />
        </div>
        <div style={{ flex: 1 }}>
          <DatePicker
            label={endDateVariable}
            value={endDate}
            onChange={onEndDateChange}
            dateFormat={metadata?.format}
            {...props}
          />
        </div>
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
