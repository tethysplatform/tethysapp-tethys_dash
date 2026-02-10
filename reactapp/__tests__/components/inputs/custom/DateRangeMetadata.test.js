import DateRangeMetadata from "components/inputs/custom/DateRangeMetadata";
import { render, screen, fireEvent } from "@testing-library/react";

describe("DateRangeMetadata Component", () => {
  test("renders all inputs with initial values", () => {
    render(
      <DateRangeMetadata
        onChange={jest.fn()}
        values={{
          startDateVariable: "start_date",
          endDateVariable: "end_date",
          format: "MM/DD/YYYY",
        }}
      />,
    );

    expect(screen.getByLabelText("Start Date Variable Name Input")).toHaveValue(
      "start_date",
    );
    expect(screen.getByLabelText("End Date Variable Name Input")).toHaveValue(
      "end_date",
    );
    expect(screen.getByDisplayValue("MM/DD/YYYY")).toBeInTheDocument();
  });

  test("calls onChange with updated start date variable name", () => {
    const handleChange = jest.fn();
    render(
      <DateRangeMetadata
        onChange={handleChange}
        values={{ startDateVariable: "start_date" }}
      />,
    );

    const startDateInput = screen.getByLabelText(
      "Start Date Variable Name Input",
    );
    fireEvent.change(startDateInput, { target: { value: "new_start_date" } });

    expect(handleChange).toHaveBeenCalledWith({
      startDateVariable: "new_start_date",
    });
  });

  test("calls onChange with updated end date variable name", () => {
    const handleChange = jest.fn();
    render(
      <DateRangeMetadata
        onChange={handleChange}
        values={{ endDateVariable: "end_date" }}
      />,
    );

    const endDateInput = screen.getByLabelText("End Date Variable Name Input");
    fireEvent.change(endDateInput, { target: { value: "new_end_date" } });

    expect(handleChange).toHaveBeenCalledWith({
      endDateVariable: "new_end_date",
    });
  });

  test("calls onChange with updated date format", () => {
    const handleChange = jest.fn();
    render(
      <DateRangeMetadata
        onChange={handleChange}
        values={{ format: "MM/DD/YYYY" }}
      />,
    );

    const formatInput = screen.getByDisplayValue("MM/DD/YYYY");
    fireEvent.change(formatInput, { target: { value: "YYYY-MM-DD" } });

    expect(handleChange).toHaveBeenCalledWith({
      format: "YYYY-MM-DD",
    });
  });
});
