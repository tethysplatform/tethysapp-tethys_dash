import { render, screen, act } from "@testing-library/react";
import LoadingAnimation from "components/loader/LoadingAnimation";

describe("LoadingAnimation", () => {
  let infoSpy;
  beforeEach(() => {
    jest.useFakeTimers();
    infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    infoSpy.mockRestore();
  });

  it("does not render the spinner immediately if delay is set", () => {
    render(<LoadingAnimation delay={1000} text="Please wait..." />);
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector(".inner-spin")).toBeNull();
  });

  it("renders the spinner (but no visible text) after the delay", () => {
    render(<LoadingAnimation delay={500} />);
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector(".inner-spin")).toBeNull();
    act(() => {
      jest.advanceTimersByTime(500);
    });
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector(".inner-spin")).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).toBeNull();
  });

  it("logs the loading text to the console instead of showing it", () => {
    render(<LoadingAnimation delay={200} text="Custom Loading" />);
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(screen.queryByText("Custom Loading")).toBeNull();
    expect(infoSpy).toHaveBeenCalledWith("[loading]", "Custom Loading");
  });

  it("renders the animation elements but no loading-text element", () => {
    render(<LoadingAnimation delay={0} />);
    act(() => {
      jest.advanceTimersByTime(0);
    });
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector(".center")).toBeInTheDocument();
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector(".inner-spin")).toBeInTheDocument();
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector(".outer-spin")).toBeInTheDocument();
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector(".loading-text")).toBeNull();
  });

  it("does not throw if delay is undefined", () => {
    expect(() => {
      render(<LoadingAnimation />);
      act(() => {
        jest.runAllTimers();
      });
    }).not.toThrow();
  });

  it("logs its text and detail to the console (not shown to users)", () => {
    render(
      <LoadingAnimation
        text="Loading Dashboard..."
        detail="Loading variable inputs… (1 of 2)"
      />,
    );
    act(() => {
      jest.runAllTimers();
    });
    expect(screen.getByTestId("loading-animation")).toBeInTheDocument();
    expect(screen.queryByText("Loading Dashboard...")).toBeNull();
    expect(screen.queryByText(/Loading variable inputs/)).toBeNull();
    expect(infoSpy).toHaveBeenCalledWith(
      "[loading]",
      "Loading Dashboard... — Loading variable inputs… (1 of 2)",
    );
  });
});
