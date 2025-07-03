import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ColorPicker from "components/inputs/ColorPicker";

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
    />
  );

  expect(screen.getByText("HEX")).toBeInTheDocument();
  expect(screen.queryByText("RGB")).not.toBeInTheDocument();
  expect(screen.queryByText("HSV")).not.toBeInTheDocument();
});
