import {
  parseDateMath,
  dateHourFormat,
  checkForVariable,
  isRelativeInput,
  parseDate,
  toLocalISO,
  convertDatesToLocalISO,
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

  it("parses day", () => {
    const result = parseDateMath({
      value: "2025-01-02",
      dateFormat: "yyyy-MM-dd",
    });
    expect(format(result, "yyyy-MM-dd")).toBe("2025-01-02");
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

  it("returns null for bad format", () => {
    const today = new Date();
    const result = parseDate(today, "bad_format", true);
    expect(result).toBeNull();
  });
});

describe("toLocalISO function", () => {
  it("should format date with correct timezone offset signs - covers line 174", () => {
    // Test the specific logic on line 174: (d.getTimezoneOffset() > 0 ? "-" : "+")

    // Create a base date for testing
    const baseDate = new Date("2025-01-15T12:00:00");

    // Store original getTimezoneOffset method
    const originalGetTimezoneOffset = baseDate.getTimezoneOffset;

    try {
      // Test Case 1: Positive offset (timezone behind UTC) - should use "-"
      // This tests the first part of the ternary: d.getTimezoneOffset() > 0 ? "-"
      baseDate.getTimezoneOffset = jest.fn().mockReturnValue(360); // UTC-6 (360 minutes behind)
      const resultBehindUTC = toLocalISO(baseDate);
      expect(resultBehindUTC).toMatch(/.*-06:00$/); // Should end with -06:00

      // Test Case 2: Negative offset (timezone ahead of UTC) - should use "+"
      // This tests the second part of the ternary: : "+"
      baseDate.getTimezoneOffset = jest.fn().mockReturnValue(-120); // UTC+2 (120 minutes ahead, so negative)
      const resultAheadUTC = toLocalISO(baseDate);
      expect(resultAheadUTC).toMatch(/.*\+02:00$/); // Should end with +02:00

      // Test Case 3: Zero offset (exactly UTC) - should use "+"
      // This tests the edge case where getTimezoneOffset() === 0, so the condition is false
      baseDate.getTimezoneOffset = jest.fn().mockReturnValue(0); // UTC±0
      const resultUTC = toLocalISO(baseDate);
      expect(resultUTC).toMatch(/.*\+00:00$/); // Should end with +00:00

      // Test Case 4: Large positive offset - should use "-"
      baseDate.getTimezoneOffset = jest.fn().mockReturnValue(720); // UTC-12
      const resultLargeBehind = toLocalISO(baseDate);
      expect(resultLargeBehind).toMatch(/.*-12:00$/); // Should end with -12:00

      // Test Case 5: Large negative offset - should use "+"
      baseDate.getTimezoneOffset = jest.fn().mockReturnValue(-720); // UTC+12
      const resultLargeAhead = toLocalISO(baseDate);
      expect(resultLargeAhead).toMatch(/.*\+12:00$/); // Should end with +12:00

      // Verify the complete format structure
      const completeResult = toLocalISO(baseDate);
      expect(completeResult).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
      );
    } finally {
      // Always restore the original method
      baseDate.getTimezoneOffset = originalGetTimezoneOffset;
    }
  });
});

describe("convertDatesToLocalISO function", () => {
  it("should convert Date objects to local ISO strings", () => {
    const date1 = new Date("2025-01-15T12:00:00");
    const date2 = new Date("2025-02-20T15:30:45");
    const input = {
      dateField1: date1,
      nested: {
        dateField2: date2,
      },
      nonDateField: "test",
    };

    const result = convertDatesToLocalISO(input);

    expect(result.dateField1).toBe(toLocalISO(date1));
    expect(result.nested.dateField2).toBe(toLocalISO(date2));
    expect(result.nonDateField).toBe("test"); // Non-date fields should remain unchanged
  });

  it("should handle arrays of Date objects", () => {
    const date1 = new Date("2025-01-15T12:00:00");
    const date2 = new Date("2025-02-20T15:30:45");
    const input = [date1, date2, "not a date"];

    const result = convertDatesToLocalISO(input);

    expect(result[0]).toBe(toLocalISO(date1));
    expect(result[1]).toBe(toLocalISO(date2));
    expect(result[2]).toBe("not a date"); // Non-date fields should remain unchanged
  });

  it("should return non-object, non-array values unchanged", () => {
    expect(convertDatesToLocalISO("just a string")).toBe("just a string");
    expect(convertDatesToLocalISO(123)).toBe(123);
    expect(convertDatesToLocalISO(null)).toBe(null);
    expect(convertDatesToLocalISO(undefined)).toBe(undefined);
  });
});
