import { render, screen } from "@testing-library/react";
import DebugError from "components/error/DebugError";

test("debug error", async () => {
  render(
    <DebugError
      error={"some_error"}
      errorInfo={{ componentStack: "some_info" }}
    />
  );

  expect(await screen.findByText("some_error")).toBeInTheDocument();
  expect(await screen.findByText("some_info")).toBeInTheDocument();
});
