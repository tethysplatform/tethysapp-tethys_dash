import { fireEvent, render, screen } from "@testing-library/react";
import DateMetadata from "components/inputs/custom/DateMetadata";

describe("DateMetadata", () => {
  test("renders and updates correctly", () => {
    const onChange = jest.fn();

    render(
      <DateMetadata
        onChange={onChange}
        values={{ showTimeInput: false, format: "MM/dd/yyyy" }}
      />,
    );

    const checkbox = screen.getByLabelText("Show Time Input Input");
    expect(checkbox).not.toBeChecked();

    const dateFormatInput = screen.getByLabelText("Output Format Input");
    expect(dateFormatInput).toHaveValue("MM/dd/yyyy");

    checkbox.click();
    expect(onChange).toHaveBeenCalledWith({
      showTimeInput: true,
      format: "MM/dd/yyyy",
    });

    fireEvent.change(dateFormatInput, { target: { value: "yyyy-MM-dd" } });
    expect(onChange).toHaveBeenCalledWith({
      showTimeInput: false,
      format: "yyyy-MM-dd",
    });
  });

  test("default values, change time input", () => {
    const onChange = jest.fn();

    render(<DateMetadata onChange={onChange} values={{}} />);

    const checkbox = screen.getByLabelText("Show Time Input Input");
    expect(checkbox).toBeChecked();

    const dateFormatInput = screen.getByLabelText("Output Format Input");
    expect(dateFormatInput).toHaveValue("MM/dd/yyyy'T'HH:mm");

    checkbox.click();
    expect(onChange).toHaveBeenCalledWith({
      showTimeInput: false,
    });
  });

  test("default values, change format", () => {
    const onChange = jest.fn();

    render(<DateMetadata onChange={onChange} values={{}} />);

    const checkbox = screen.getByLabelText("Show Time Input Input");
    expect(checkbox).toBeChecked();

    const dateFormatInput = screen.getByLabelText("Output Format Input");
    expect(dateFormatInput).toHaveValue("MM/dd/yyyy'T'HH:mm");

    fireEvent.change(dateFormatInput, { target: { value: "yyyy-MM-dd" } });
    expect(onChange).toHaveBeenCalledWith({
      format: "yyyy-MM-dd",
    });
  });
});
