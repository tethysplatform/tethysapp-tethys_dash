import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  const expectedDateString = "01/01/2020";
  fireEvent.change(input, {
    target: { value: expectedDateString },
  });

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

  const expectedDateString = "01/01/2020 12:00 AM";
  fireEvent.change(input, {
    target: { value: expectedDateString },
  });

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
