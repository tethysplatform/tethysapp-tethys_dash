import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TooltipButton from "components/buttons/TooltipButton";

test("TooltipButton tooltips and href", async () => {
  render(
    <TooltipButton
      tooltipPlacement={"right"}
      tooltipText={"Test"}
      href={"some/url"}
    />
  );

  const button = screen.getByRole("button");
  expect(button).toHaveClass("btn-info");
  await userEvent.hover(button);

  const tooltip = screen.getByRole("tooltip");
  expect(tooltip).toBeInTheDocument();
  expect(tooltip).toHaveTextContent("Test");
});

test("TooltipButton no tooltips", async () => {
  render(
    <TooltipButton
      tooltipPlacement={"right"}
      tooltipText={null}
      href={"some/url"}
      variant={"warning"}
    />
  );

  const button = screen.getByRole("button");
  expect(button).toHaveClass("btn-warning");
  userEvent.hover(button);

  const tooltip = screen.queryByRole("tooltip");
  expect(tooltip).not.toBeInTheDocument();
});
