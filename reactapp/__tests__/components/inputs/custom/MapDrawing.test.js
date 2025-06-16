import { render, screen, fireEvent } from "@testing-library/react";
import { MapDrawing } from "components/inputs/custom/MapDrawing";

describe("MapDrawing Component", () => {
  test("renders all drawing option checkboxes and feature limit input", async () => {
    render(<MapDrawing onChange={jest.fn()} values={{}} />);

    const mapDrawing = screen.getByText("Map Drawing");
    fireEvent.click(mapDrawing);

    expect(await screen.findByLabelText("Polygon")).not.toBeChecked();
    expect(screen.getByLabelText("Rectangle")).not.toBeChecked();
    expect(screen.getByLabelText("Point")).not.toBeChecked();
    expect(screen.getByLabelText("LineString")).not.toBeChecked();
    expect(screen.getByLabelText(/Drawn Feature Limit/i)).toBeInTheDocument();
  });

  test("toggles a checkbox and calls onChange with updated options", async () => {
    const handleChange = jest.fn();
    render(<MapDrawing onChange={handleChange} values={{}} />);

    const mapDrawing = screen.getByText("Map Drawing");
    fireEvent.click(mapDrawing);

    const checkbox = await screen.findByLabelText("Point");
    fireEvent.click(checkbox);

    expect(handleChange).toHaveBeenCalledWith({ options: ["Point"] });

    fireEvent.click(checkbox); // uncheck it
    expect(handleChange).toHaveBeenCalledWith({});
  });

  test("sets feature limit and calls onChange with options + limit", async () => {
    const handleChange = jest.fn();
    render(
      <MapDrawing
        onChange={handleChange}
        values={{ options: ["LineString"], variable: "some value" }}
      />
    );
    const mapDrawing = screen.getByText("Map Drawing");
    fireEvent.click(mapDrawing);

    const input = await screen.findByLabelText(/Drawn Feature Limit/i);
    fireEvent.change(input, { target: { value: "3" } });

    expect(handleChange).toHaveBeenCalledWith({
      options: ["LineString"],
      limit: 3,
      variable: "some value",
    });

    const drawingOption = screen.getByLabelText("LineString");
    fireEvent.click(drawingOption);

    expect(handleChange).toHaveBeenCalledWith({});
  });

  test("sets variable and calls onChange with options + limit", async () => {
    const handleChange = jest.fn();
    render(
      <MapDrawing
        onChange={handleChange}
        values={{ options: ["LineString"], limit: 2 }}
      />
    );
    const mapDrawing = screen.getByText("Map Drawing");
    fireEvent.click(mapDrawing);

    const input = await screen.findByLabelText(/Geometry Variable Name/i);
    fireEvent.change(input, { target: { value: "some variable" } });

    expect(handleChange).toHaveBeenCalledWith({
      options: ["LineString"],
      limit: 2,
      variable: "some variable",
    });

    const drawingOption = screen.getByLabelText("LineString");
    fireEvent.click(drawingOption);

    expect(handleChange).toHaveBeenCalledWith({});
  });

  test("checkbox is checked if passed in values.options", async () => {
    const handleChange = jest.fn();
    render(
      <MapDrawing
        onChange={handleChange}
        values={{
          options: ["Polygon", "Rectangle"],
          limit: 5,
          variable: "some value",
        }}
      />
    );
    const mapDrawing = screen.getByText("Map Drawing");
    fireEvent.click(mapDrawing);

    expect(await screen.findByLabelText("Polygon")).toBeChecked();
    expect(screen.getByLabelText("Rectangle")).toBeChecked();
    expect(screen.getByLabelText("Point")).not.toBeChecked();
    expect(screen.getByLabelText("LineString")).not.toBeChecked();

    const limitInput = screen.getByLabelText(/Drawn Feature Limit/i);
    expect(limitInput.value).toBe("5");

    const checkbox = screen.getByLabelText("Point");
    fireEvent.click(checkbox);

    expect(handleChange).toHaveBeenCalledWith({
      options: ["Polygon", "Rectangle", "Point"],
      limit: 5,
      variable: "some value",
    });
  });

  test("does not call onChange on limit change if no options selected", async () => {
    const handleChange = jest.fn();
    render(<MapDrawing onChange={handleChange} values={{}} />);
    const mapDrawing = screen.getByText("Map Drawing");
    fireEvent.click(mapDrawing);

    const input = await screen.findByLabelText(/Drawn Feature Limit/i);

    fireEvent.change(input, { target: { value: "10" } });

    expect(handleChange).not.toHaveBeenCalled();
  });

  test("does not call onChange on variable change if no options selected", async () => {
    const handleChange = jest.fn();
    render(<MapDrawing onChange={handleChange} values={{}} />);
    const mapDrawing = screen.getByText("Map Drawing");
    fireEvent.click(mapDrawing);

    const input = await screen.findByLabelText(/Geometry Variable Name/i);

    fireEvent.change(input, { target: { value: "some value" } });

    expect(handleChange).not.toHaveBeenCalled();
  });
});
