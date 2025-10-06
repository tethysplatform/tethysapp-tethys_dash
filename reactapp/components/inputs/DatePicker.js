import { parse, format } from "date-fns";
import { useState, useRef, memo, useContext, useEffect } from "react";
import PropTypes from "prop-types";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FaRegCalendarAlt } from "react-icons/fa";
import "components/inputs/DatePicker.css";
import styled from "styled-components";
import { DataViewerModeContext } from "components/contexts/Contexts";

const Wrapper = styled.div`
  position: relative;
  display: inline-block;
`;

const StyledInput = styled.input`
  paddingright: 2rem;
  width: 200px;
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
export const parseDateMath = ({ value, type }) => {
  if (!value || typeof value !== "string") return null;
  let date;

  if (value.startsWith("now")) {
    date = new Date();
    value = value.slice(3);
  } else if (value.startsWith("today")) {
    date = new Date();
    date.setHours(0, 0, 0, 0);
    value = value.slice(5);
  } else {
    const isoDate = new Date(value);
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

    // eslint-disable-next-line
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

  // Return formatted string without any Z / timezone offset
  return type === "date"
    ? format(date, dateFormat)
    : format(date, dateHourFormat);
};

const DatePicker = ({ label, value, onChange, type, divProps }) => {
  const { inDataViewerMode } = useContext(DataViewerModeContext);

  const [selectedDate, setSelectedDate] = useState(() => {
    if (checkForVariable(value)) return null;
    const parsed = parseDateMath({ value, type });
    return parsed
      ? parse(
          parsed,
          type === "date-hour" ? dateHourFormat : dateFormat,
          new Date()
        )
      : null;
  });
  const datePickerRef = useRef(null);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    if (value !== inputValue && value !== parseDateMath({ value, type })) {
      onRawChange(value);
    }
    // eslint-disable-next-line
  }, [value]);

  function checkForVariable(val) {
    return typeof val === "string" && /\$\{[^}]+\}/.test(val);
  }

  const onRawChange = (val) => {
    setInputValue(val);

    if (checkForVariable(val)) {
      onChange(val);
      return;
    }

    // Try relative date parsing
    const parsedDate = parseDateMath({ value: val, type });
    if (parsedDate) {
      if (inDataViewerMode) {
        onChange(val);
      } else {
        onChange(parsedDate);
      }
      setSelectedDate(parsedDate);
      return;
    }
  };

  const openCalendar = () => {
    datePickerRef.current.setOpen(true);
  };

  const handleSelect = (date) => {
    setSelectedDate(date);
    const formattedDate =
      type === "date" ? format(date, dateFormat) : format(date, dateHourFormat);
    onChange(formattedDate);
    setInputValue(formattedDate);
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
            value={inputValue}
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
