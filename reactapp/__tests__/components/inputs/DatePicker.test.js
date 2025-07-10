import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format } from "date-fns";
import DatePicker from "components/inputs/DatePicker";

test("DatePicker date", async () => {
  const mockOnChange = jest.fn();

  render(
    <DatePicker
      label="Test DatePicker"
      type="date"
      value=""
      onChange={mockOnChange}
    />
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  await userEvent.click(input);

  // pick first available day in calendar (simulate)
  const days = await screen.findAllByRole("option", { name: /1/i });
  await userEvent.click(days[0]);

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const expectedDateString = format(firstOfMonth, "MM/dd/yyyy");
  expect(mockOnChange).toHaveBeenCalledWith(expectedDateString);
});

test("DatePicker date-hour", async () => {
  const mockOnChange = jest.fn();

  render(
    <DatePicker
      label="Test DatePicker"
      type="date-hour"
      value=""
      onChange={mockOnChange}
    />
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  await userEvent.click(input);

  // pick first available day in calendar (simulate)
  const days = await screen.findAllByRole("option", { name: /1/i });
  await userEvent.click(days[0]);

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  let expectedDateString = format(firstOfMonth, "MM/dd/yyyy h:mm aa");
  expect(mockOnChange).toHaveBeenCalledWith(expectedDateString);
});

test("DatePicker initial date and change to variable input", async () => {
  const mockOnChange = jest.fn();

  render(
    <DatePicker
      label="Test DatePicker"
      type="date"
      value="01/01/1990"
      onChange={mockOnChange}
    />
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  expect(input.value).toBe("01/01/1990");

  // eslint-disable-next-line
  fireEvent.change(input, { target: { value: "${Date}" } });

  // eslint-disable-next-line
  expect(input.placeholder).toBe("${Date}");
});

test("DatePicker initial date-hour", async () => {
  const mockOnChange = jest.fn();

  render(
    <DatePicker
      label="Test DatePicker"
      type="date-hour"
      value="01/01/1990 12:00 AM"
      onChange={mockOnChange}
    />
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  expect(input.value).toBe("01/01/1990 12:00 AM");
});

test("DatePicker bad date", async () => {
  const mockOnChange = jest.fn();

  render(
    <DatePicker
      label="Test DatePicker"
      type="date"
      value="01/01/19"
      onChange={mockOnChange}
    />
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  expect(input.value).toBe("");
});

test("DatePicker null value", async () => {
  const mockOnChange = jest.fn();

  render(
    <DatePicker
      label="Test DatePicker"
      type="date"
      value={null}
      onChange={mockOnChange}
    />
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  expect(input.value).toBe("");
});

test("DatePicker variable input 1", async () => {
  const mockOnChange = jest.fn();

  render(
    <DatePicker
      label="Test DatePicker"
      type="date"
      // eslint-disable-next-line
      value="${Date}"
      onChange={mockOnChange}
    />
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  expect(input.value).toBe("");
  // eslint-disable-next-line
  expect(input.placeholder).toBe("${Date}");
});

test("DatePicker variable input 2", async () => {
  const mockOnChange = jest.fn();

  render(
    <DatePicker
      label="Test DatePicker"
      type="date"
      // eslint-disable-next-line
      value="01/05/2025 ${hour} AM"
      onChange={mockOnChange}
    />
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  expect(input.value).toBe("");
  // eslint-disable-next-line
  expect(input.placeholder).toBe("01/05/2025 ${hour} AM");
});

test("DatePicker bad variable input", async () => {
  const mockOnChange = jest.fn();

  render(
    <DatePicker
      label="Test DatePicker"
      type="date"
      value="01/05/2025 ${hour"
      onChange={mockOnChange}
    />
  );

  expect(await screen.findByText("Test DatePicker")).toBeInTheDocument();

  const input = screen.getByRole("textbox");
  expect(input.value).toBe("");
  expect(input.placeholder).toBe("");
});
