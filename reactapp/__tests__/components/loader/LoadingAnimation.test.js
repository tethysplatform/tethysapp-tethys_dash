import { render, screen, act } from "@testing-library/react";
import LoadingAnimation from "components/loader/LoadingAnimation";

describe("LoadingAnimation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("does not render immediately if delay is set", () => {
    render(<LoadingAnimation delay={1000} text="Please wait..." />);
    expect(screen.queryByText("Please wait...")).toBeNull();
  });

  it("renders after the delay with default text", () => {
    render(<LoadingAnimation delay={500} />);
    expect(screen.queryByText("Loading...")).toBeNull();
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders after the delay with custom text", () => {
    render(<LoadingAnimation delay={200} text="Custom Loading" />);
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(screen.getByText("Custom Loading")).toBeInTheDocument();
  });

  it("renders loader structure (spinner + label)", () => {
    render(<LoadingAnimation delay={0} />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector(".loader")).toBeInTheDocument();
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector(".loader__spinner")).toBeInTheDocument();
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector(".loader__label")).toBeInTheDocument();
  });

  it("exposes a polite live-region for assistive tech", () => {
    render(<LoadingAnimation delay={0} text="Loading Dashboard..." />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("Loading Dashboard...");
  });

  it("does not throw if delay is undefined", () => {
    expect(() => {
      render(<LoadingAnimation />);
      act(() => {
        jest.runAllTimers();
      });
    }).not.toThrow();
  });
});
