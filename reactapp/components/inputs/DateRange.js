import PropTypes from "prop-types";
import { useEffect, useRef } from "react";
import DatePicker from "components/inputs/DatePicker";
import styled from "styled-components";

const FlexWrap = styled.div`
  display: flex;
  flex-direction: row;
  gap: 1rem;
  width: 100%;
  min-width: 0;

  @container (max-width: 300px) {
    flex-direction: column;
    gap: 0.5rem;
  }
`;
const Container = styled.div`
  container-type: inline-size;
`;

const FlexItem = styled.div`
  flex: 1;
`;

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
    <Container {...divProps}>
      <FlexWrap>
        <FlexItem>
          <DatePicker
            label={startDateVariable}
            value={startDate}
            onChange={onStartDateChange}
            dateFormat={metadata?.format}
            {...props}
          />
        </FlexItem>
        <FlexItem>
          <DatePicker
            label={endDateVariable}
            value={endDate}
            onChange={onEndDateChange}
            dateFormat={metadata?.format}
            {...props}
          />
        </FlexItem>
      </FlexWrap>
    </Container>
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
