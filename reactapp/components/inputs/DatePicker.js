import { format } from "date-fns";
import { useRef, memo, useState, useEffect, useContext } from "react";
import PropTypes from "prop-types";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FaRegCalendarAlt } from "react-icons/fa";
import "components/inputs/DatePicker.css";
import { DataViewerModeContext } from "components/contexts/Contexts";
import styled from "styled-components";

const Wrapper = styled.div`
  position: relative;
  display: inline-block;
  width: 100%;
`;

const StyledInput = styled.input`
  paddingright: 2rem;
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

export const dateHourFormat = "MM/dd/yyyy h:mm aa";
export const dateFormat = "MM/dd/yyyy";

// Relative date parser

export const parseDateMath = ({ value }) => {
  if (!value || typeof value !== "string") return null;
  let date;

  if (value.startsWith("now")) {
    date = new Date();
    value = value.slice(3);
  } else {
    // Interpret as local time
    let dateString = value;

    // Check if this looks like a date-time string without timezone info
    const hasTime = /\d{4}-\d{2}-\d{2}[\s|T]\d{2}:\d{2}/.test(value);
    const hasTimezone = value.includes("Z") || /[+-]\d{2}:\d{2}$/.test(value);

    if (hasTime && !hasTimezone) {
      // Convert space to T for local interpretation
      dateString = value.replace(/\s/, "T");
    }

    const isoDate = new Date(dateString);
    if (!isNaN(isoDate)) {
      date = isoDate;
    } else {
      return null;
    }
  }

  const offsetRegex = /([+-])(\d+)([YMWDHmS])/g;
  let match;
  while ((match = offsetRegex.exec(value)) !== null) {
    const sign = match[1] === "+" ? 1 : -1;
    const amount = parseInt(match[2], 10) * sign;
    const unit = match[3];

    // eslint-disable-next-line default-case
    switch (unit) {
      case "Y":
        date.setFullYear(date.getFullYear() + amount);
        break;
      case "M":
        date.setMonth(date.getMonth() + amount);
        break;
      case "W":
        date.setDate(date.getDate() + amount * 7);
        break;
      case "D":
        date.setDate(date.getDate() + amount);
        break;
      case "H":
        date.setHours(date.getHours() + amount);
        break;
      case "m":
        date.setMinutes(date.getMinutes() + amount);
        break;
      case "S":
        date.setSeconds(date.getSeconds() + amount);
        break;
    }
  }

  return date;
};

export function checkForVariable(val) {
  return typeof val === "string" && /\$\{[^}]+\}/.test(val);
}

const DatePicker = ({ label, value, onChange, type, divProps }) => {
  const { inDataViewerMode } = useContext(DataViewerModeContext);

  // Track raw input value separately
  const datePickerRef = useRef(null);
  const [rawInputValue, setRawInputValue] = useState(value);

  // Update rawInputValue if value prop changes (from parent)
  useEffect(() => {
    // Only update rawInputValue if value prop is different from current rawInputValue
    // or if value is not the formatted version of rawInputValue
    let formattedRaw = rawInputValue;
    if (!checkForVariable(rawInputValue) && rawInputValue) {
      const parsed = parseDateMath({ value: rawInputValue });
      if (parsed) {
        formattedRaw =
          type === "date"
            ? format(parsed, dateFormat)
            : format(parsed, dateHourFormat);
      }
    }
    if (value !== formattedRaw) {
      setRawInputValue(value);
    }
    // eslint-disable-next-line
  }, [value]);

  // Derive selectedDate for calendar from value prop (only if not relative)
  let selectedDate = null;
  if (!checkForVariable(rawInputValue) && rawInputValue) {
    const parsed = parseDateMath({ value: rawInputValue });
    if (parsed) {
      selectedDate = parsed;
    }
  }

  const isRelativeInput = (val) => {
    if (!val) return false;
    // Accepts 'now', 'now-1D', etc.
    return /^now([+-]\d+[YMWDHmS])*$/.test(val);
  };

  const onRawChange = (val) => {
    setRawInputValue(val);
    // Only call onChange if valid absolute or relative time
    if (isRelativeInput(val)) {
      const parsedDate = parseDateMath({ value: val });
      if (inDataViewerMode) {
        onChange(val);
      } else {
        const formattedDate =
          type === "date"
            ? format(parsedDate, dateFormat)
            : format(parsedDate, dateHourFormat);
        onChange(formattedDate);
      }
      return;
    }

    if (checkForVariable(val)) {
      onChange(val);
      return;
    }

    // Absolute date string
    const parsedDate = parseDateMath({ value: val });
    if (parsedDate) {
      const formattedDate =
        type === "date"
          ? format(parsedDate, dateFormat)
          : format(parsedDate, dateHourFormat);
      onChange(formattedDate);
    }
    // Otherwise, do not call onChange
  };

  const openCalendar = () => {
    datePickerRef.current.setOpen(true);
  };

  const handleSelect = (date) => {
    const formattedDate =
      type === "date" ? format(date, dateFormat) : format(date, dateHourFormat);
    setRawInputValue(formattedDate);
    onChange(formattedDate);
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
            showTimeInput={type === "date-hour"}
            dateFormat={type === "date-hour" ? dateHourFormat : dateFormat}
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
  value: PropTypes.string,
  divProps: PropTypes.object,
};

export default memo(DatePicker);
