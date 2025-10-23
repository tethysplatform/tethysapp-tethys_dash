import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DatePicker, { parseDateMath } from "components/inputs/DatePicker";
import { getOrdinal } from "__tests__/utilities/constants";
import { format } from "date-fns";
import { DataViewerModeContext } from "components/contexts/Contexts";
import { dateHourFormat } from "components/inputs/DatePicker";

test("DatePicker date", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <DatePicker
        label="Test DatePicker"
        type="date"
        value=""
        onChange={mockOnChange}
      />
    </DataViewerModeContext.Provider>
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  await userEvent.click(input);

  const expectedDateString = "01/01/2020";
  fireEvent.change(input, {
    target: { value: expectedDateString },
  });

  expect(mockOnChange).toHaveBeenCalledWith(expectedDateString);
});

test("DatePicker date-hour", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <DatePicker
        label="Test DatePicker"
        type="date-hour"
        value=""
        onChange={mockOnChange}
      />
    </DataViewerModeContext.Provider>
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  await userEvent.click(input);

  const expectedDateString = "01/01/2020 12:00 AM";
  fireEvent.change(input, {
    target: { value: expectedDateString },
  });

  expect(mockOnChange).toHaveBeenCalledWith(expectedDateString);
});

test("DatePicker initial date and change to variable input", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <DatePicker
        label="Test DatePicker"
        type="date"
        value="01/01/1990"
        onChange={mockOnChange}
      />
    </DataViewerModeContext.Provider>
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  expect(input.value).toBe("01/01/1990");

  // eslint-disable-next-line
  fireEvent.change(input, { target: { value: "${Date" } });

  // eslint-disable-next-line
  expect(mockOnChange).toHaveBeenCalledTimes(0);

  // eslint-disable-next-line
  fireEvent.change(input, { target: { value: "${Date}" } });

  // eslint-disable-next-line
  expect(mockOnChange).toHaveBeenLastCalledWith("${Date}");
});

test("DatePicker initial date-hour", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <DatePicker
        label="Test DatePicker"
        type="date-hour"
        value="01/01/1990 12:00 AM"
        onChange={mockOnChange}
      />
    </DataViewerModeContext.Provider>
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  expect(input.value).toBe("01/01/1990 12:00 AM");
  expect(mockOnChange).toHaveBeenCalledTimes(0);
});

test("DatePicker initial variable", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <DatePicker
        label="Test DatePicker"
        type="date-hour"
        // eslint-disable-next-line
        value="${Date}"
      />
    </DataViewerModeContext.Provider>
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  // eslint-disable-next-line
  expect(input.value).toBe("${Date}");
  expect(mockOnChange).toHaveBeenCalledTimes(0);
});

test("DatePicker initial now+1D", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <DatePicker
        label="Test DatePicker"
        type="date-hour"
        value="now+1D"
        onChange={mockOnChange}
      />
    </DataViewerModeContext.Provider>
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  expect(input.value).toBe("now+1D");

  const calendarButton = screen.getByLabelText("Calendar Icon");
  await userEvent.click(calendarButton);

  const datePicker = await screen.findByRole("dialog");
  expect(datePicker).toBeInTheDocument();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const weekday = tomorrow.toLocaleDateString("en-US", { weekday: "long" });
  const month = tomorrow.toLocaleDateString("en-US", { month: "long" });
  const day = tomorrow.getDate();
  const ordinal = getOrdinal(day);
  const year = tomorrow.getFullYear();

  const formatted = `Choose ${weekday}, ${month} ${day}${ordinal}, ${year}`;
  const tomorrowCalendarItem = screen.getByLabelText(formatted);
  expect(tomorrowCalendarItem).toHaveAttribute("aria-selected", "true");

  const timeInput = screen.getByPlaceholderText("Time");
  const timeString = today.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  expect(timeInput).toHaveValue(timeString);
  expect(mockOnChange).toHaveBeenCalledTimes(0);
});

test("DatePicker initial today", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <DatePicker
        label="Test DatePicker"
        type="date-hour"
        value="today"
        onChange={mockOnChange}
      />
    </DataViewerModeContext.Provider>
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  expect(input.value).toBe("today");

  const calendarButton = screen.getByLabelText("Calendar Icon");
  await userEvent.click(calendarButton);

  const datePicker = await screen.findByRole("dialog");
  expect(datePicker).toBeInTheDocument();
  const today = new Date();
  const weekday = today.toLocaleDateString("en-US", { weekday: "long" });
  const month = today.toLocaleDateString("en-US", { month: "long" });
  const day = today.getDate();
  const ordinal = getOrdinal(day);
  const year = today.getFullYear();

  const formatted = `Choose ${weekday}, ${month} ${day}${ordinal}, ${year}`;
  const todayCalendarItem = screen.getByLabelText(formatted);
  expect(todayCalendarItem).toHaveAttribute("aria-selected", "true");

  const timeInput = screen.getByPlaceholderText("Time");
  expect(timeInput).toHaveValue("00:00");
  expect(mockOnChange).toHaveBeenCalledTimes(0);
});

test("DatePicker relative date in dataviewer mode", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: true }}>
      <DatePicker
        label="Test DatePicker"
        type="date-hour"
        value=""
        onChange={mockOnChange}
      />
    </DataViewerModeContext.Provider>
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  fireEvent.change(input, {
    target: { value: "today" },
  });

  expect(mockOnChange).toHaveBeenCalledWith("today");
  expect(mockOnChange).toHaveBeenCalledTimes(1);
});

test("DatePicker relative date not in dataviewer mode", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <DatePicker
        label="Test DatePicker"
        type="date-hour"
        value=""
        onChange={mockOnChange}
      />
    </DataViewerModeContext.Provider>
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  fireEvent.change(input, {
    target: { value: "today" },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expect(mockOnChange).toHaveBeenCalledWith(format(today, dateHourFormat));
  expect(mockOnChange).toHaveBeenCalledTimes(1);
});

test("DatePicker select tomorrow date-hour", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <DatePicker
        label="Test DatePicker"
        type="date-hour"
        value=""
        onChange={mockOnChange}
      />
    </DataViewerModeContext.Provider>
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  expect(input.value).toBe("");

  const calendarButton = screen.getByLabelText("Calendar Icon");
  await userEvent.click(calendarButton);

  const datePicker = await screen.findByRole("dialog");
  expect(datePicker).toBeInTheDocument();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const weekday = tomorrow.toLocaleDateString("en-US", { weekday: "long" });
  const month = tomorrow.toLocaleDateString("en-US", { month: "long" });
  const day = tomorrow.getDate();
  const ordinal = getOrdinal(day);
  const year = tomorrow.getFullYear();

  const formatted = `Choose ${weekday}, ${month} ${day}${ordinal}, ${year}`;
  const tomorrowCalendarItem = screen.getByLabelText(formatted);

  await userEvent.click(tomorrowCalendarItem);
  expect(input.value).toBe(`${format(tomorrow, "MM/dd/yyyy")} 12:00 AM`);
  expect(mockOnChange).toHaveBeenCalledWith(
    `${format(tomorrow, "MM/dd/yyyy")} 12:00 AM`
  );
});

test("DatePicker select tomorrow date", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <DatePicker
        label="Test DatePicker"
        type="date"
        value=""
        onChange={mockOnChange}
      />
    </DataViewerModeContext.Provider>
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  expect(input.value).toBe("");

  const calendarButton = screen.getByLabelText("Calendar Icon");
  await userEvent.click(calendarButton);

  const datePicker = await screen.findByRole("dialog");
  expect(datePicker).toBeInTheDocument();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const weekday = tomorrow.toLocaleDateString("en-US", { weekday: "long" });
  const month = tomorrow.toLocaleDateString("en-US", { month: "long" });
  const day = tomorrow.getDate();
  const ordinal = getOrdinal(day);
  const year = tomorrow.getFullYear();

  const formatted = `Choose ${weekday}, ${month} ${day}${ordinal}, ${year}`;
  const tomorrowCalendarItem = screen.getByLabelText(formatted);

  await userEvent.click(tomorrowCalendarItem);
  expect(input.value).toBe(format(tomorrow, "MM/dd/yyyy"));
  expect(mockOnChange).toHaveBeenCalledWith(format(tomorrow, "MM/dd/yyyy"));
});

describe("parseDateMath", () => {
  const { format } = require("date-fns");
  const {
    dateFormat,
    dateHourFormat,
  } = require("components/inputs/DatePicker");

  it("parses 'now' for date", () => {
    const today = new Date();
    const result = parseDateMath({ value: "now" });
    expect(format(result, dateFormat)).toBe(format(today, dateFormat));
  });

  it("parses 'now' for date-hour", () => {
    const today = new Date();
    const result = parseDateMath({ value: "now" });
    expect(format(result, dateHourFormat)).toBe(format(today, dateHourFormat));
  });

  it("parses 'today' for date", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = parseDateMath({ value: "today" });
    expect(format(result, dateFormat)).toBe(format(today, dateFormat));
  });

  it("parses 'today' for date-hour", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = parseDateMath({ value: "today" });
    expect(format(result, dateHourFormat)).toBe(format(today, dateHourFormat));
  });

  it("parses ISO date string", () => {
    const result = parseDateMath({ value: "2025-08-15T09:37:00" });
    expect(format(result, dateHourFormat)).toBe("08/15/2025 9:37 AM");
  });

  it("parses offset +1D", () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const result = parseDateMath({ value: "now+1D" });
    expect(format(result, dateFormat)).toBe(format(tomorrow, dateFormat));
  });

  it("parses offset -1D", () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const result = parseDateMath({ value: "now-1D" });
    expect(format(result, dateFormat)).toBe(format(yesterday, dateFormat));
  });

  it("parses multiple offsets", () => {
    const today = new Date();
    const date = new Date(today);
    date.setFullYear(date.getFullYear() + 1);
    date.setMonth(date.getMonth() + 2);
    date.setDate(date.getDate() + 7);
    const result = parseDateMath({ value: "now+1Y+2M+1W" });
    expect(format(result, dateFormat)).toBe(format(date, dateFormat));
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
    expect(format(result, dateFormat)).toBe(format(today, dateFormat));
  });
});
