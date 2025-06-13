import { render, screen, fireEvent } from "@testing-library/react";
import { MapDrawing } from "components/inputs/custom/MapDrawing";

describe("MapDrawing Component", () => {
  const drawingOptions = ["Point", "LineString", "Polygon", "Circle"];

  test("renders all drawing option checkboxes and feature limit input", () => {
    render(<MapDrawing onChange={jest.fn()} values={{}} />);
    drawingOptions.forEach((option) => {
      const drawingOption = screen.getByLabelText(option);
      expect(drawingOption).toBeInTheDocument();
      expect(drawingOption.checked).toBe(false);
    });
    expect(screen.getByLabelText(/Drawn Feature Limit/i)).toBeInTheDocument();
  });

  test("toggles a checkbox and calls onChange with updated options", () => {
    const handleChange = jest.fn();
    render(<MapDrawing onChange={handleChange} values={{}} />);

    const checkbox = screen.getByLabelText("Point");
    fireEvent.click(checkbox);

    expect(handleChange).toHaveBeenCalledWith({ options: ["Point"] });

    fireEvent.click(checkbox); // uncheck it
    expect(handleChange).toHaveBeenCalledWith({});
  });

  test("sets feature limit and calls onChange with options + limit", () => {
    const handleChange = jest.fn();
    render(
      <MapDrawing
        onChange={handleChange}
        values={{ options: ["LineString"] }}
      />
    );

    const input = screen.getByLabelText(/Drawn Feature Limit/i);
    fireEvent.change(input, { target: { value: "3" } });

    expect(handleChange).toHaveBeenCalledWith({
      options: ["LineString"],
      limit: 3,
    });

    const drawingOption = screen.getByLabelText("LineString");
    fireEvent.click(drawingOption);

    expect(handleChange).toHaveBeenCalledWith({});
  });

  test("checkbox is checked if passed in values.options", () => {
    const handleChange = jest.fn();
    render(
      <MapDrawing
        onChange={handleChange}
        values={{ options: ["Polygon", "Circle"], limit: 5 }}
      />
    );
    expect(screen.getByLabelText("Polygon")).toBeChecked();
    expect(screen.getByLabelText("Circle")).toBeChecked();
    expect(screen.getByLabelText("Point")).not.toBeChecked();
    expect(screen.getByLabelText("LineString")).not.toBeChecked();

    const limitInput = screen.getByLabelText(/Drawn Feature Limit/i);
    expect(limitInput.value).toBe("5");

    const checkbox = screen.getByLabelText("Point");
    fireEvent.click(checkbox);

    expect(handleChange).toHaveBeenCalledWith({
      options: ["Polygon", "Circle", "Point"],
      limit: 5,
    });
  });

  test("does not call onChange on limit change if no options selected", () => {
    const handleChange = jest.fn();
    render(<MapDrawing onChange={handleChange} values={{}} />);
    const input = screen.getByLabelText(/Drawn Feature Limit/i);

    fireEvent.change(input, { target: { value: "10" } });

    expect(handleChange).not.toHaveBeenCalled();
  });
});
