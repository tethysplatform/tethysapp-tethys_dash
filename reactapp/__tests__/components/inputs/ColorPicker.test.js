import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ColorPicker, { isTransparentColor } from "components/inputs/ColorPicker";

global.ResizeObserver = require("resize-observer-polyfill");

it("ColorPicker", async () => {
  const mockOnChange = jest.fn();
  render(<ColorPicker color="#ff0000" onChange={mockOnChange} />);

  expect(screen.getByText("HEX")).toBeInTheDocument();
  expect(screen.getByText("RGB")).toBeInTheDocument();
  expect(screen.getByText("HSV")).toBeInTheDocument();

  const hexInput = screen.getByRole("textbox", { name: "HEX" });
  expect(hexInput.value).toBe("#ff0000");

  fireEvent.change(hexInput, { target: { value: "#0000ff" } });

  await waitFor(() => {
    expect(mockOnChange).toHaveBeenCalledWith("#0000ff");
  });
});

it("ColorPicker Hide Input", async () => {
  const mockOnChange = jest.fn();
  render(
    <ColorPicker
      color="#ff0000"
      onChange={mockOnChange}
      hideInput={["rgb", "hsv"]}
    />,
  );

  expect(screen.getByText("HEX")).toBeInTheDocument();
  expect(screen.queryByText("RGB")).not.toBeInTheDocument();
  expect(screen.queryByText("HSV")).not.toBeInTheDocument();
});

describe("isTransparentColor", () => {
  test("detects zero-alpha hex colors", () => {
    expect(isTransparentColor("#ff000000")).toBe(true);
    expect(isTransparentColor("#F000")).toBe(true);
    expect(isTransparentColor("#ff000080")).toBe(false);
    expect(isTransparentColor("#ff0000")).toBe(false);
    expect(isTransparentColor("red")).toBe(false);
    expect(isTransparentColor(undefined)).toBe(false);
  });
});
