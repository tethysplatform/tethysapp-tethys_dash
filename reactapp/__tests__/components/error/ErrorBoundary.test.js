import { render, screen } from "@testing-library/react";
import ErrorBoundary from "components/error/ErrorBoundary";

const BuggyComponent = () => {
  throw new Error("Oops!");
};

test("error boundary no issue", async () => {
  render(
    <ErrorBoundary>
      <div>No issues</div>
    </ErrorBoundary>
  );

  expect(await screen.findByText("No issues")).toBeInTheDocument();
});

test("error boundary debug", async () => {
  process.env.TETHYS_DEBUG_MODE = true;
  render(
    <ErrorBoundary>
      <BuggyComponent />
    </ErrorBoundary>
  );

  expect(await screen.findByText("TETHYS_DEBUG = true")).toBeInTheDocument();
});

test("error boundary no debug", async () => {
  process.env.TETHYS_DEBUG_MODE = false;
  render(
    <ErrorBoundary>
      <BuggyComponent />
    </ErrorBoundary>
  );

  expect(
    await screen.findByText("Something went wrong. Please try again.")
  ).toBeInTheDocument();
});
