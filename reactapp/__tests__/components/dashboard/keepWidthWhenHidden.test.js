import PropTypes from "prop-types";
import { act, render, screen } from "@testing-library/react";
import keepWidthWhenHidden from "components/dashboard/keepWidthWhenHidden";

// The observer the provider measures with, captured so a test can report
// widths to it and see what it observed and when it stopped.
let observer;
jest.mock("resize-observer-polyfill", () => ({
  __esModule: true,
  default: class {
    constructor(callback) {
      this.callback = callback;
      this.observed = [];
      this.disconnected = false;
      observer = this;
    }
    observe(node) {
      this.observed.push(node);
    }
    disconnect() {
      this.disconnected = true;
    }
  },
}));

// A stand-in grid: renders the width it is given, on the element it is handed
// the ref for, as react-grid-layout does with `innerRef`.
const Grid = ({ innerRef, width, label }) => (
  <div ref={innerRef} data-testid="grid" data-width={width}>
    {label}
  </div>
);
Grid.propTypes = {
  innerRef: PropTypes.object,
  width: PropTypes.number,
  label: PropTypes.string,
};

const report = (width) =>
  act(() => observer.callback([{ contentRect: { width } }]));
const renderedWidth = () =>
  Number(screen.getByTestId("grid").getAttribute("data-width"));

describe("keepWidthWhenHidden", () => {
  const WithWidth = keepWidthWhenHidden(Grid);

  test("starts from react-grid-layout's default width, and measures the grid's own element", () => {
    render(<WithWidth label="tiles" />);

    expect(renderedWidth()).toBe(1280);
    expect(observer.observed).toEqual([screen.getByTestId("grid")]);
    expect(screen.getByTestId("grid")).toHaveTextContent("tiles");
  });

  test("lays the grid out at the width it measures", () => {
    render(<WithWidth />);
    report(1600);
    expect(renderedWidth()).toBe(1600);
  });

  test("a hidden tab measures 0 wide and keeps the width it last really had", () => {
    render(<WithWidth />);
    report(1600);

    report(0);
    expect(renderedWidth()).toBe(1600);

    // Shown again, in a window resized meanwhile.
    report(1400);
    expect(renderedWidth()).toBe(1400);
  });

  test("stops measuring when it unmounts", () => {
    const { unmount } = render(<WithWidth />);
    unmount();
    expect(observer.disconnected).toBe(true);
  });

  test("a grid that never attaches its element stays at the default width", () => {
    const Detached = keepWidthWhenHidden(({ width }) => (
      <div data-testid="grid" data-width={width} />
    ));
    observer = undefined;
    render(<Detached />);
    expect(renderedWidth()).toBe(1280);
    expect(observer).toBeUndefined();
  });
});
