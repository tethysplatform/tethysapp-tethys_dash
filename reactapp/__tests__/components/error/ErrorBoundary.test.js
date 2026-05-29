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

// ---------------------------------------------------------------------------
// fallback prop — lets callers supply their own error UI per mount site.
// App-level usage (no prop) keeps the default GenericError/DebugError branch.
// Per-tile usage (DashboardItem) supplies a compact in-tile fallback.
// ---------------------------------------------------------------------------

test("fallback as a static ReactNode renders on error instead of default", async () => {
  process.env.TETHYS_DEBUG_MODE = false;
  render(
    <ErrorBoundary fallback={<div>Custom fallback content</div>}>
      <BuggyComponent />
    </ErrorBoundary>
  );

  expect(
    await screen.findByText("Custom fallback content")
  ).toBeInTheDocument();
  // The default-branch message must NOT appear — the fallback replaces it.
  expect(
    screen.queryByText("Something went wrong. Please try again.")
  ).not.toBeInTheDocument();
});

test("fallback as a function is invoked with (error, errorInfo)", async () => {
  process.env.TETHYS_DEBUG_MODE = false;
  const renderFallback = jest.fn((error, errorInfo) => (
    <div>
      <span>error-text:{String(error)}</span>
      <span>info-present:{errorInfo ? "yes" : "no"}</span>
    </div>
  ));

  render(
    <ErrorBoundary fallback={renderFallback}>
      <BuggyComponent />
    </ErrorBoundary>
  );

  // The function is called with both args; error is the stringified Error.
  expect(await screen.findByText(/error-text:Error: Oops!/)).toBeInTheDocument();
  expect(screen.getByText("info-present:yes")).toBeInTheDocument();
  expect(renderFallback).toHaveBeenCalled();
});

test("fallback as a function returning null renders nothing (no crash)", async () => {
  process.env.TETHYS_DEBUG_MODE = false;
  const { container } = render(
    <ErrorBoundary fallback={() => null}>
      <BuggyComponent />
    </ErrorBoundary>
  );

  // Boundary caught the throw and rendered null. The default-branch UI
  // must not appear.
  expect(
    screen.queryByText("Something went wrong. Please try again.")
  ).not.toBeInTheDocument();
  expect(container.textContent).toBe("");
});

test("fallback is ignored when children render normally", async () => {
  process.env.TETHYS_DEBUG_MODE = false;
  const renderFallback = jest.fn(() => <div>should-not-render</div>);

  render(
    <ErrorBoundary fallback={renderFallback}>
      <div>All good</div>
    </ErrorBoundary>
  );

  expect(await screen.findByText("All good")).toBeInTheDocument();
  expect(screen.queryByText("should-not-render")).not.toBeInTheDocument();
  expect(renderFallback).not.toHaveBeenCalled();
});
