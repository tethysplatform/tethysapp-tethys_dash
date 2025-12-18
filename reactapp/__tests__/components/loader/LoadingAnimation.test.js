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

  it("renders all animation elements after delay", () => {
    render(<LoadingAnimation delay={0} />);
    act(() => {
      jest.advanceTimersByTime(0);
    });
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    // Check for key animation
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector(".center")).toBeInTheDocument();

    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector(".inner-spin")).toBeInTheDocument();

    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector(".outer-spin")).toBeInTheDocument();

    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector(".loading-text")).toBeInTheDocument();
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
