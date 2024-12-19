import { render, screen } from "@testing-library/react";
import GenericError from "components/error/GenericError";

test("generic error", async () => {
  render(<GenericError />);

  expect(
    await screen.findByText("Something went wrong. Please try again.")
  ).toBeInTheDocument();
});
