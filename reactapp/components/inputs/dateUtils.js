import { format, parse } from "date-fns";

// Formats for date and date-hour
export const dateHourFormat = "MM/dd/yyyy h:mm aa";
export const dateOnlyFormat = "MM/dd/yyyy";

export function toLocalISO(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes()) +
    ":" +
    pad(d.getSeconds()) +
    (d.getTimezoneOffset() > 0 ? "-" : "+") +
    pad(Math.abs(d.getTimezoneOffset() / 60)) +
    ":" +
    pad(Math.abs(d.getTimezoneOffset() % 60))
  );
}

// Helper function to convert Date objects to UTC strings recursively
export const convertDatesToLocalISO = (obj) => {
  if (obj instanceof Date) {
    return toLocalISO(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(convertDatesToLocalISO);
  }

  if (obj !== null && typeof obj === "object") {
    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertDatesToLocalISO(value);
    }
    return converted;
  }

  return obj;
};

/**
 * Parses a date string, supporting relative expressions like 'now', 'now-1D', etc.
 * Returns a Date object or null if invalid.
 */
export const parseDateMath = ({ value, dateFormat }) => {
  if (value instanceof Date && !isNaN(value)) return value;
  if (!value || typeof value !== "string") return null;
  let date;

  if (value.startsWith("now")) {
    date = new Date();
    value = value.slice(3);
  } else {
    try {
      date = parse(value, dateFormat, new Date());
    } catch (e) {
      // If parsing fails, return null
      return null;
    }

    if (isNaN(date)) {
      date = new Date(value);
      if (isNaN(date)) {
        return null;
      }
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
  if (typeof val !== "string") return null;
  const match = val.match(/\$\{([^}]+)\}/);
  return match ? match[1] : null;
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
  if (!rawDate) return null;
  let selectedDate = rawDate;
  if (checkForVariable(rawDate)) {
    return rawDate;
  }

  selectedDate = parseDateMath({ value: rawDate, dateFormat });

  // If formatting requested, only format if valid date
  if (return_formatted) {
    if (selectedDate instanceof Date && !isNaN(selectedDate)) {
      try {
        return format(selectedDate, dateFormat);
      } catch (e) {
        // If formatting fails, return null
        return null;
      }
    } else {
      // If invalid, return null (or could return rawDate if preferred)
      return null;
    }
  }
  return selectedDate;
};
