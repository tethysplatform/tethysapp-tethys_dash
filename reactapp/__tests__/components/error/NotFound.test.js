import { render, screen } from "@testing-library/react";
import NotFound from "components/error/NotFound";

test("not found error", async () => {
  render(<NotFound />);

  expect(
    await screen.findByText("The page you were looking for could not be found.")
  ).toBeInTheDocument();
});
