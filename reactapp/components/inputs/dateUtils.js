import { format } from "date-fns";

// Formats for date and date-hour
export const dateHourFormat = "MM/dd/yyyy h:mm aa";
export const dateFormat = "MM/dd/yyyy";

/**
 * Parses a date string, supporting relative expressions like 'now', 'now-1D', etc.
 * Returns a Date object or null if invalid.
 */
export const parseDateMath = ({ value }) => {
  if (value instanceof Date && !isNaN(value)) return value;
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

/**
 * Checks if a value is a variable expression like ${...}
 */
export function checkForVariable(val) {
  return typeof val === "string" && /\$\{[^}]+\}/.test(val);
}

/**
 * Checks if a value is a relative date input (e.g., 'now', 'now-1D')
 */
export function isRelativeInput(val) {
  if (!val) return false;
  // Accepts 'now', 'now-1D', etc.
  return /^now([+-]\d+[YMWDHmS])*$/.test(val);
}

export const parseDate = (
  rawDate,
  dateFormat = dateHourFormat,
  return_formatted = false,
) => {
  let selectedDate = rawDate;
  if (!checkForVariable(rawDate) && rawDate) {
    selectedDate = parseDateMath({ value: rawDate });
  }
  if (selectedDate && return_formatted) {
    selectedDate = format(selectedDate, dateFormat);
  }
  return selectedDate;
};
