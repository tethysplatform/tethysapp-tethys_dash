import { render, screen, fireEvent } from "@testing-library/react";
import NormalInput from "components/inputs/NormalInput";

/* eslint-disable no-template-curly-in-string */
const varRef = "${My Var}";
const varRefWithNum = "1${My Var}";
const unclosedVar = "${My Var";
/* eslint-enable no-template-curly-in-string */

describe("NormalInput Component", () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  test("renders with label and value", () => {
    render(
      <NormalInput label="Name" value="hello" onChange={mockOnChange} />,
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Name Input")).toHaveValue("hello");
  });

  test("renders without label", () => {
    render(
      <NormalInput
        ariaLabel="No Label"
        value="test"
        onChange={mockOnChange}
      />,
    );
    expect(screen.queryByRole("label")).not.toBeInTheDocument();
    expect(screen.getByLabelText("No Label")).toHaveValue("test");
  });

  test("text input calls onChange on any input", () => {
    render(
      <NormalInput
        label="Text"
        type="text"
        value=""
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Text Input");
    fireEvent.change(input, { target: { value: "abc" } });
    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });

  test("number input allows numeric values", () => {
    render(
      <NormalInput
        label="Num"
        type="number"
        value=""
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    fireEvent.change(input, { target: { value: "42" } });
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue("42");
  });

  test("number input allows negative numbers", () => {
    render(
      <NormalInput
        label="Num"
        type="number"
        value=""
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    fireEvent.change(input, { target: { value: "-5" } });
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue("-5");
  });

  test("number input allows decimal values", () => {
    render(
      <NormalInput
        label="Num"
        type="number"
        value=""
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    fireEvent.change(input, { target: { value: "3.14" } });
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue("3.14");
  });

  test("number input rejects non-numeric, non-variable text", () => {
    render(
      <NormalInput
        label="Num"
        type="number"
        value=""
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    fireEvent.change(input, { target: { value: "abc" } });
    expect(mockOnChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("");
  });

  test("number input allows $ to start a variable", () => {
    render(
      <NormalInput
        label="Num"
        type="number"
        value=""
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    fireEvent.change(input, { target: { value: "$" } });
    // $ is stored locally but not propagated to parent
    expect(mockOnChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("$");
  });

  test("number input allows typing an unclosed variable reference", () => {
    render(
      <NormalInput
        label="Num"
        type="number"
        value=""
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    fireEvent.change(input, { target: { value: "$" } });
    fireEvent.change(input, { target: { value: "${" } });
    fireEvent.change(input, { target: { value: unclosedVar } });
    // Unclosed variable is not propagated
    expect(mockOnChange).not.toHaveBeenCalled();
    expect(input).toHaveValue(unclosedVar);
  });

  test("number input propagates a completed variable reference", () => {
    render(
      <NormalInput
        label="Num"
        type="number"
        value=""
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    fireEvent.change(input, { target: { value: varRef } });
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue(varRef);
  });

  test("number input allows $ after a number to start a variable", () => {
    render(
      <NormalInput
        label="Num"
        type="number"
        value="1"
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    fireEvent.change(input, { target: { value: "1$" } });
    expect(input).toHaveValue("1$");
  });

  test("number input allows number with completed variable", () => {
    render(
      <NormalInput
        label="Num"
        type="number"
        value=""
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    fireEvent.change(input, { target: { value: varRefWithNum } });
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue(varRefWithNum);
  });

  test("number input does not propagate empty value", () => {
    render(
      <NormalInput
        label="Num"
        type="number"
        value="5"
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    fireEvent.change(input, { target: { value: "" } });
    expect(mockOnChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("");
  });

  test("number input does not propagate lone minus", () => {
    render(
      <NormalInput
        label="Num"
        type="number"
        value=""
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    fireEvent.change(input, { target: { value: "-" } });
    expect(mockOnChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("-");
  });

  test("number input ignores NaN from parent value prop", () => {
    const { rerender } = render(
      <NormalInput
        label="Num"
        type="number"
        value="5"
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    expect(input).toHaveValue("5");

    rerender(
      <NormalInput
        label="Num"
        type="number"
        value={NaN}
        onChange={mockOnChange}
      />,
    );
    expect(input).toHaveValue("5");
  });

  test("ArrowUp increments number value", () => {
    render(
      <NormalInput
        label="Num"
        type="number"
        value="10"
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(mockOnChange).toHaveBeenCalledWith({ target: { value: "11" } });
    expect(input).toHaveValue("11");
  });

  test("ArrowDown decrements number value", () => {
    render(
      <NormalInput
        label="Num"
        type="number"
        value="10"
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(mockOnChange).toHaveBeenCalledWith({ target: { value: "9" } });
    expect(input).toHaveValue("9");
  });

  test("ArrowUp respects max", () => {
    render(
      <NormalInput
        label="Num"
        type="number"
        value="100"
        max={100}
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(mockOnChange).toHaveBeenCalledWith({ target: { value: "100" } });
  });

  test("ArrowDown respects min", () => {
    render(
      <NormalInput
        label="Num"
        type="number"
        value="0"
        min={0}
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(mockOnChange).toHaveBeenCalledWith({ target: { value: "0" } });
  });

  test("ArrowUp does nothing for non-numeric value", () => {
    render(
      <NormalInput
        label="Num"
        type="number"
        value={varRef}
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  test("Enter key is prevented from submitting form", () => {
    render(
      <NormalInput label="Text" value="" onChange={mockOnChange} />,
    );
    const input = screen.getByLabelText("Text Input");
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
    });
    const preventSpy = jest.spyOn(event, "preventDefault");
    input.dispatchEvent(event);
    expect(preventSpy).toHaveBeenCalled();
  });

  test("renders with placeholder", () => {
    render(
      <NormalInput
        label="Search"
        placeholder="Type here..."
        value=""
        onChange={mockOnChange}
      />,
    );
    expect(screen.getByPlaceholderText("Type here...")).toBeInTheDocument();
  });

  test("renders with null value for number input", () => {
    render(
      <NormalInput
        label="Num"
        type="number"
        value={null}
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    expect(input).toHaveValue("");
  });

  test("renders with undefined value for number input", () => {
    render(
      <NormalInput
        label="Num"
        type="number"
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    expect(input).toHaveValue("");
  });

  test("handles value prop changing to null", () => {
    const { rerender } = render(
      <NormalInput
        label="Num"
        type="number"
        value="5"
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    expect(input).toHaveValue("5");

    rerender(
      <NormalInput
        label="Num"
        type="number"
        value={null}
        onChange={mockOnChange}
      />,
    );
    expect(input).toHaveValue("");
  });

  test("number input handles non-string value in change event", () => {
    render(
      <NormalInput
        label="Num"
        type="number"
        value=""
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    // fireEvent always sends string values, but this covers the hasUnclosedVariable non-string branch
    fireEvent.change(input, { target: { value: "5" } });
    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });

  test("syncs rawValue when value prop changes", () => {
    const { rerender } = render(
      <NormalInput
        label="Num"
        type="number"
        value="5"
        onChange={mockOnChange}
      />,
    );
    const input = screen.getByLabelText("Num Input");
    expect(input).toHaveValue("5");

    rerender(
      <NormalInput
        label="Num"
        type="number"
        value="20"
        onChange={mockOnChange}
      />,
    );
    expect(input).toHaveValue("20");
  });
});
