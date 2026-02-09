import {
  parseDateMath,
  dateHourFormat,
  checkForVariable,
  isRelativeInput,
  parseDate,
} from "components/inputs/dateUtils";
import { format } from "date-fns";

describe("parseDateMath", () => {
  it("parses 'now' for date", () => {
    const today = new Date();
    const result = parseDateMath({ value: "now" });
    expect(format(result, dateHourFormat)).toBe(format(today, dateHourFormat));
  });

  it("parses 'now' for date-hour", () => {
    const today = new Date();
    const result = parseDateMath({ value: "now" });
    expect(format(result, dateHourFormat)).toBe(format(today, dateHourFormat));
  });

  it("parses ISO date", () => {
    const result = parseDateMath({ value: "2025-08-15T09:37:00" });
    expect(format(result, dateHourFormat)).toBe("08/15/2025 9:37 AM");
  });

  it("parses ISO date with dateFormat", () => {
    const result = parseDateMath({
      value: "2025-08-15T09",
      dateFormat: "yyyy-MM-dd'T'HH",
    });
    expect(format(result, dateHourFormat)).toBe("08/15/2025 9:00 AM");
  });

  it("bad date string returns null", () => {
    const result = parseDateMath({
      value: "20sdfsdfasdfasdf",
      dateFormat: "yyyy-MM-dd'T'HH:mm",
    });
    expect(result).toBeNull();
  });

  it("Date object returned as is", () => {
    const date = new Date("2025-08-15T09:37:00");
    const result = parseDateMath({ value: date });
    expect(result).toBe(date);
  });

  it("parses offset +1D", () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const result = parseDateMath({ value: "now+1D" });
    expect(format(result, dateHourFormat)).toBe(
      format(tomorrow, dateHourFormat),
    );
  });

  it("parses offset -1D", () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const result = parseDateMath({ value: "now-1D" });
    expect(format(result, dateHourFormat)).toBe(
      format(yesterday, dateHourFormat),
    );
  });

  it("parses multiple offsets", () => {
    const today = new Date();
    const date = new Date(today);
    date.setFullYear(date.getFullYear() + 1);
    date.setMonth(date.getMonth() + 2);
    date.setDate(date.getDate() + 7);
    const result = parseDateMath({ value: "now+1Y+2M+1W" });
    expect(format(result, dateHourFormat)).toBe(format(date, dateHourFormat));
  });

  it("parses multiple time offsets", () => {
    const today = new Date();
    const date = new Date(today);
    date.setHours(date.getHours() + 1);
    date.setMinutes(date.getMinutes() + 2);
    date.setSeconds(date.getSeconds() + 1);
    const result = parseDateMath({ value: "now+1H+2m+1S" });
    expect(format(result, dateHourFormat)).toBe(format(date, dateHourFormat));
  });

  it("returns null for invalid input", () => {
    expect(parseDateMath({ value: "invalid" })).toBeNull();
    expect(parseDateMath({ value: 123 })).toBeNull();
    expect(parseDateMath({ value: "" })).toBeNull();
  });

  it("ignores unknown units (default case)", () => {
    const today = new Date();
    // 'Q' matches the offset regex but is not handled in the switch
    const result = parseDateMath({ value: "now+1Q" });
    expect(format(result, dateHourFormat)).toBe(format(today, dateHourFormat));
  });
});

describe("checkForVariable", () => {
  it("detects variable expressions", () => {
    // eslint-disable-next-line
    expect(checkForVariable("${variable}")).toBe("variable");
    // eslint-disable-next-line
    expect(checkForVariable("prefix_${variable}_suffix")).toBe("variable");
    // eslint-disable-next-line
    expect(checkForVariable("${multiple}_${variable}_suffix")).toBe("multiple");
  });

  it("returns false for non-variable strings", () => {
    expect(checkForVariable("just a string")).toBe(null);
    expect(checkForVariable("12345")).toBe(null);
    expect(checkForVariable("now-1D")).toBe(null);
  });

  it("returns false for non-string inputs", () => {
    expect(checkForVariable(123)).toBe(null);
    expect(checkForVariable(null)).toBe(null);
    expect(checkForVariable(undefined)).toBe(null);
    expect(checkForVariable({})).toBe(null);
  });
});

describe("isRelativeInput", () => {
  it("detects relative date inputs", () => {
    expect(isRelativeInput("now")).toBe(true);
    expect(isRelativeInput("now-1D+2W")).toBe(true);
    expect(isRelativeInput("now+2M")).toBe(true);
  });

  it("returns false for absolute date inputs", () => {
    expect(isRelativeInput("2025-08-15T09:37:00")).toBe(false);
    expect(isRelativeInput("08/15/2025")).toBe(false);
  });

  it("returns false for non-string inputs", () => {
    expect(isRelativeInput(123)).toBe(false);
    expect(isRelativeInput(null)).toBe(false);
    expect(isRelativeInput(undefined)).toBe(false);
    expect(isRelativeInput({})).toBe(false);
  });
});

describe("parseDate", () => {
  it("returns variable expressions unchanged", () => {
    // eslint-disable-next-line
    expect(parseDate("${variable}")).toBe("${variable}");
  });

  it("parses relative date inputs", () => {
    const today = new Date();
    const result = parseDate("now");
    expect(format(result, dateHourFormat)).toBe(format(today, dateHourFormat));
  });

  it("parses absolute date strings", () => {
    const result = parseDate("2025-08-15T09:37:00");
    expect(format(result, dateHourFormat)).toBe("08/15/2025 9:37 AM");
  });

  it("returns formatted date when requested", () => {
    const result = parseDate("2025-08-15T09:37:00", dateHourFormat, true);
    expect(result).toBe("08/15/2025 9:37 AM");
  });

  it("returns null for invalid dates when formatting is requested", () => {
    const result = parseDate("invalid-date", dateHourFormat, true);
    expect(result).toBeNull();
  });

  it("returns null for null date", () => {
    const result = parseDate("", dateHourFormat, true);
    expect(result).toBeNull();
  });
});
