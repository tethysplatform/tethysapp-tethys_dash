import { render, screen } from "@testing-library/react";
import TileErrorFallback from "components/error/TileErrorFallback";

const asError = (message = "boom") => {
  const e = new Error(message);
  return e;
};

const asErrorInfo = (stack = "\n    at Card\n    at Visualization") => ({
  componentStack: stack,
});

test("renders a compact short message in non-debug mode", async () => {
  process.env.TETHYS_DEBUG_MODE = "false";
  render(<TileErrorFallback error={asError()} errorInfo={asErrorInfo()} />);

  expect(
    await screen.findByText("Visualization could not be rendered")
  ).toBeInTheDocument();
  // The stack trace / error string must NOT appear in non-debug mode.
  expect(screen.queryByText(/boom/)).not.toBeInTheDocument();
  expect(screen.queryByText(/at Card/)).not.toBeInTheDocument();
});

test("renders the error + component stack in debug mode", async () => {
  process.env.TETHYS_DEBUG_MODE = "true";
  render(
    <TileErrorFallback
      error={asError("specific-message")}
      errorInfo={asErrorInfo("\n    at BadViz\n    at Base")}
    />
  );

  expect(
    await screen.findByText("Visualization could not be rendered")
  ).toBeInTheDocument();
  // Stack-trace excerpt visible in debug mode
  expect(screen.getByText(/specific-message/)).toBeInTheDocument();
  expect(screen.getByText(/at BadViz/)).toBeInTheDocument();
});

test("null errorInfo does not crash the debug branch", async () => {
  process.env.TETHYS_DEBUG_MODE = "true";
  render(<TileErrorFallback error={asError("earlyboom")} errorInfo={null} />);

  // Short message still renders + the error string appears; no stack excerpt
  expect(
    await screen.findByText("Visualization could not be rendered")
  ).toBeInTheDocument();
  expect(screen.getByText(/earlyboom/)).toBeInTheDocument();
});

test("empty-string error renders the short fallback without crashing", async () => {
  process.env.TETHYS_DEBUG_MODE = "false";
  render(<TileErrorFallback error="" errorInfo={null} />);

  expect(
    await screen.findByText("Visualization could not be rendered")
  ).toBeInTheDocument();
});

test("accepts a string error (already toString'd) without crashing", async () => {
  process.env.TETHYS_DEBUG_MODE = "true";
  render(
    <TileErrorFallback
      error="Error: already-a-string"
      errorInfo={asErrorInfo()}
    />
  );

  expect(
    await screen.findByText("Visualization could not be rendered")
  ).toBeInTheDocument();
  expect(screen.getByText(/already-a-string/)).toBeInTheDocument();
});
