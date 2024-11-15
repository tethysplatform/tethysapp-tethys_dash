import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import ClipboardCopy from "components/buttons/ClipboardCopy";

test("ClipboardCopy tooltips for null success", async () => {
  render(<ClipboardCopy success={null} />);

  const button = screen.getByRole("button");
  await act(async () => {
    await userEvent.hover(button);
  });

  const tooltip = screen.getByRole("tooltip");
  expect(tooltip).toBeInTheDocument();
  expect(tooltip).toHaveTextContent("Copy to clipboard");
});

test("ClipboardCopy tooltips for true success", async () => {
  render(<ClipboardCopy success={true} />);

  const button = screen.getByRole("button");
  await act(async () => {
    await userEvent.hover(button);
  });

  const tooltip = screen.getByRole("tooltip");
  expect(tooltip).toBeInTheDocument();
  expect(tooltip).toHaveTextContent("Copied");
});

test("ClipboardCopy tooltips for false success", async () => {
  render(<ClipboardCopy success={false} />);

  const button = screen.getByRole("button");
  await act(async () => {
    await userEvent.hover(button);
  });

  const tooltip = screen.getByRole("tooltip");
  expect(tooltip).toBeInTheDocument();
  expect(tooltip).toHaveTextContent("Failed to Copy");
});
