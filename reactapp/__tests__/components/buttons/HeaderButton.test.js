import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import HeaderButton from "components/buttons/HeaderButton";

test("HeaderButton tooltips and href", async () => {
  render(
    <HeaderButton
      tooltipPlacement={"right"}
      tooltipText={"Test"}
      href={"some/url"}
    />
  );

  const button = screen.getByRole("button");
  await act(async () => {
    await userEvent.hover(button);
  });

  const tooltip = screen.getByRole("tooltip");
  expect(tooltip).toBeInTheDocument();
  expect(tooltip).toHaveTextContent("Test");
});

test("HeaderButton no tooltips", async () => {
  const { container } = render(
    <HeaderButton
      tooltipPlacement={"right"}
      tooltipText={null}
      href={"some/url"}
    />
  );

  const button = screen.getByRole("button");
  await act(async () => {
    await userEvent.hover(button);
  });

  const tooltip = screen.queryByRole("tooltip");
  expect(tooltip).not.toBeInTheDocument();
});
