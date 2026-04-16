import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DatePicker from "components/inputs/DatePicker";
import { format } from "date-fns";
import { getOrdinal } from "__tests__/utilities/constants";
import { DataViewerModeContext } from "components/contexts/Contexts";

test("DatePicker date", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <DatePicker label="Test DatePicker" value="" onChange={mockOnChange} />
    </DataViewerModeContext.Provider>,
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

test("DatePicker date-hour", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <DatePicker label="Test DatePicker" value="" onChange={mockOnChange} />
    </DataViewerModeContext.Provider>,
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
        value="01/01/1990"
        onChange={mockOnChange}
      />
    </DataViewerModeContext.Provider>,
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

test("DatePicker bad parse initial date", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <DatePicker
        label="Test DatePicker"
        value="bad_format_date"
        onChange={mockOnChange}
      />
    </DataViewerModeContext.Provider>,
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  expect(input.value).toBe("bad_format_date");
});

test("DatePicker initial date-hour", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <DatePicker
        label="Test DatePicker"
        value="01/01/1990 12:00 AM"
        onChange={mockOnChange}
      />
    </DataViewerModeContext.Provider>,
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  expect(input.value).toBe("01/01/1990 12:00 AM");
  expect(mockOnChange).toHaveBeenCalledTimes(0);
});

test("DatePicker initial date", async () => {
  const mockOnChange = jest.fn();
  const frozenNow = new Date("2026-03-30T19:23:57.966Z");

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <DatePicker
        label="Test DatePicker"
        value={frozenNow}
        onChange={mockOnChange}
      />
    </DataViewerModeContext.Provider>,
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  expect(input.value).toBe("03/30/2026 2:23 PM");
  expect(mockOnChange).toHaveBeenCalledTimes(0);
});

test("DatePicker initial date, false showTimeInput", async () => {
  const mockOnChange = jest.fn();
  const frozenNow = new Date("2026-03-30T19:23:57.966Z");

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <DatePicker
        label="Test DatePicker"
        value={frozenNow}
        onChange={mockOnChange}
        showTimeInput={false}
      />
    </DataViewerModeContext.Provider>,
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  expect(input.value).toBe("03/30/2026");
  expect(mockOnChange).toHaveBeenCalledTimes(0);
});

test("DatePicker initial variable", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <DatePicker
        label="Test DatePicker"
        // eslint-disable-next-line
        value="${Date}"
      />
    </DataViewerModeContext.Provider>,
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
        value="now+1D"
        onChange={mockOnChange}
      />
    </DataViewerModeContext.Provider>,
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

test("DatePicker select tomorrow date-hour", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <DatePicker label="Test DatePicker" value="" onChange={mockOnChange} />
    </DataViewerModeContext.Provider>,
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
  const expectedDateTime = tomorrow;
  expectedDateTime.setHours(0, 0, 0, 0);
  expect(mockOnChange).toHaveBeenCalledWith(expectedDateTime);
});

test("DatePicker select tomorrow date", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <DatePicker label="Test DatePicker" value="" onChange={mockOnChange} />
    </DataViewerModeContext.Provider>,
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
  expect(input.value).toBe(format(tomorrow, "MM/dd/yyyy '12:00 AM'"));
  const expectedDateTime = tomorrow;
  expectedDateTime.setHours(0, 0, 0, 0);
  expect(mockOnChange).toHaveBeenCalledWith(expectedDateTime);
});

test("DatePicker select tomorrow date, showTimeInput false", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <DatePicker
        label="Test DatePicker"
        value=""
        onChange={mockOnChange}
        showTimeInput={false}
      />
    </DataViewerModeContext.Provider>,
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
  const expectedDateTime = tomorrow;
  expectedDateTime.setHours(0, 0, 0, 0);
  expect(mockOnChange).toHaveBeenCalledWith(expectedDateTime);
});

test("DatePicker relative date in dataviewer mode", async () => {
  const frozenNow = new Date("2026-03-30T19:23:57.966Z");
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: true }}>
      <DatePicker label="Test DatePicker" value="" onChange={mockOnChange} />
    </DataViewerModeContext.Provider>,
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  jest.useFakeTimers();
  try {
    jest.setSystemTime(frozenNow);
    fireEvent.change(input, {
      target: { value: "now" },
    });

    expect(mockOnChange).toHaveBeenLastCalledWith("now");
    expect(mockOnChange).toHaveBeenCalledTimes(1);

    fireEvent.change(input, {
      target: { value: null },
    });

    expect(mockOnChange).toHaveBeenCalledTimes(1);

    fireEvent.change(input, {
      target: { value: "now+1H+1D" },
    });

    expect(mockOnChange).toHaveBeenLastCalledWith("now+1H+1D");
    expect(mockOnChange).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});
