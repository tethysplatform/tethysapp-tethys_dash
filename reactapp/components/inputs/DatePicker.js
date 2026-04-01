import { format } from "date-fns";
import { useRef, memo, useState, useEffect, useContext } from "react";
import PropTypes from "prop-types";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FaRegCalendarAlt } from "react-icons/fa";
import "components/inputs/DatePicker.css";
import { DataViewerModeContext } from "components/contexts/Contexts";
import styled from "styled-components";
import {
  dateHourFormat,
  dateOnlyFormat,
  parseDateMath,
  checkForVariable,
  isRelativeInput,
  parseDate,
} from "components/inputs/dateUtils";

const Wrapper = styled.div`
  position: relative;
  display: inline-block;
  width: 100%;
`;

const StyledInput = styled.input`
  padding-right: 2rem;
  width: 100%;
`;

const StyledButton = styled.button`
  position: absolute;
  right: 0.4rem;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
`;

const DatePicker = ({
  label,
  value,
  onChange,
  divProps,
  dateFormat = dateHourFormat,
  showTimeInput = true,
}) => {
  const { inDataViewerMode } = useContext(DataViewerModeContext);

  // Track raw input value separately
  const datePickerRef = useRef(null);
  const [rawInputValue, setRawInputValue] = useState(
    typeof value === "string"
      ? value
      : format(value, showTimeInput ? dateHourFormat : dateOnlyFormat),
  );

  // Update rawInputValue if value prop changes (from parent)
  useEffect(() => {
    // Only update rawInputValue if value prop is different from current rawInputValue
    // or if value is not the formatted version of rawInputValue
    let dateHourFormattedRaw = parseDate(rawInputValue, dateHourFormat, true);
    let dateOnlyFormattedRaw = parseDate(rawInputValue, dateOnlyFormat, true);
    let dateFormattedRaw = parseDate(rawInputValue, dateFormat, true);
    if (
      value !== dateHourFormattedRaw &&
      value !== dateOnlyFormattedRaw &&
      value !== dateFormattedRaw &&
      !isRelativeInput(rawInputValue)
    ) {
      try {
        setRawInputValue(
          format(value, showTimeInput ? dateHourFormat : dateOnlyFormat),
        );
      } catch (e) {
        setRawInputValue(value);
      }
    }
    // eslint-disable-next-line
  }, [value]);

  // Derive selectedDate for calendar from value prop (only if not relative)
  let selectedDate = null;
  if (!checkForVariable(value)) {
    selectedDate = parseDate(value, dateHourFormat);
  }

  const onRawChange = (val) => {
    setRawInputValue(val);
    // Only call onChange if valid absolute or relative time
    if (isRelativeInput(val)) {
      const parsedDate = parseDateMath({ value: val });
      if (inDataViewerMode) {
        onChange(val);
      } else {
        onChange(parsedDate);
      }
      return;
    }

    if (checkForVariable(val)) {
      onChange(val);
      return;
    }

    // Absolute date string
    const parsedDate = parseDate(val, dateFormat, true);
    if (parsedDate) {
      onChange(parsedDate);
    }

    const parsedDateHour = parseDate(val, dateHourFormat, true);
    if (parsedDateHour) {
      onChange(parsedDateHour);
    }
  };

  const openCalendar = () => {
    datePickerRef.current.setOpen(true);
  };

  const handleSelect = (date) => {
    setRawInputValue(
      format(date, showTimeInput ? dateHourFormat : dateOnlyFormat),
    );
    onChange(date);
  };

  return (
    <div {...divProps}>
      {label && (
        <label className="no-caret">
          <b>{label}</b>:
        </label>
      )}
      <div>
        <Wrapper>
          <StyledInput
            type="text"
            name={label}
            aria-label={label}
            value={rawInputValue}
            onChange={(e) => onRawChange(e.target.value)}
          />

          {/* Calendar icon */}
          <StyledButton
            aria-label="Calendar Icon"
            type="button"
            onClick={openCalendar}
          >
            <FaRegCalendarAlt size={18} />
          </StyledButton>

          {/* Hidden DatePicker */}
          <ReactDatePicker
            ref={datePickerRef}
            selected={selectedDate}
            onChange={handleSelect}
            showTimeInput={showTimeInput}
            timeInputLabel="Time:"
            showYearDropdown
            showMonthDropdown
            scrollableYearDropdown
            customInput={<div />} // Prevents a visible input
            popperPlacement="bottom-end"
            wrapperClassName="icon-location"
          />
        </Wrapper>
      </div>
    </div>
  );
};

DatePicker.propTypes = {
  label: PropTypes.string,
  type: PropTypes.oneOf(["date", "date-hour"]),
  onChange: PropTypes.func,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  divProps: PropTypes.object,
  dateFormat: PropTypes.string,
  showTimeInput: PropTypes.bool,
};

export default memo(DatePicker);
