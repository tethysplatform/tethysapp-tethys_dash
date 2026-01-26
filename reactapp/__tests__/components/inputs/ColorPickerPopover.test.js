import PropTypes from "prop-types";
import { useRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ColorPickerPopover from "components/inputs/ColorPickerPopOver";

jest.mock("react-bootstrap/Overlay", () => {
  // eslint-disable-next-line react/prop-types
  const MockOverlay = ({ show, onHide, children, ...props }) => {
    if (!show && onHide) {
      setTimeout(onHide, 0);
    }
    return show ? <div data-testid="overlay-mock">{children}</div> : null;
  };
  return MockOverlay;
});

beforeEach(() => {
  delete window.ResizeObserver;
  window.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
});

afterEach(() => {
  window.ResizeObserver = ResizeObserver;
  jest.restoreAllMocks();
});

const TestingComponent = ({
  label = "Test Label",
  color = "#123456",
  onChange = jest.fn(),
}) => {
  const containerRef = useRef(null);

  return (
    <div ref={containerRef}>
      <ColorPickerPopover
        label={label}
        color={color}
        onChange={onChange}
        containerRef={containerRef}
      />
    </div>
  );
};

describe("ColorPickerPopover", () => {
  it("renders label and color swatch", async () => {
    render(<TestingComponent />);

    const label = screen.getByText(/Test Label/i);
    expect(label).toBeInTheDocument();

    const swatch = screen.getByLabelText(/color popover square/i);
    expect(swatch).toBeInTheDocument();
    expect(swatch).toHaveStyle({ background: "#123456" });

    fireEvent.click(swatch);

    const hexInput = await screen.findByRole("textbox", { name: /HEX/i });
    expect(hexInput).toBeInTheDocument();

    // Simulate closing popover by clicking swatch again
    fireEvent.click(swatch);
    // Wait for Overlay mock to call onHide
    await new Promise((r) => setTimeout(r, 10));
    expect(
      screen.queryByRole("textbox", { name: /HEX/i }),
    ).not.toBeInTheDocument();
  });

  it("renders without color", async () => {
    render(<TestingComponent color={null} />);

    const label = screen.getByText(/Test Label/i);
    expect(label).toBeInTheDocument();

    const swatch = screen.getByLabelText(/color popover square/i);
    expect(swatch).toBeInTheDocument();
    expect(swatch).toHaveStyle({ background: "#cccccc" });

    fireEvent.click(swatch);

    const hexInput = await screen.findByRole("textbox", { name: /HEX/i });
    expect(hexInput).toBeInTheDocument();

    // Simulate closing popover by clicking swatch again
    fireEvent.click(swatch);
    // Wait for Overlay mock to call onHide
    await new Promise((r) => setTimeout(r, 10));
    expect(
      screen.queryByRole("textbox", { name: /HEX/i }),
    ).not.toBeInTheDocument();
  });
});

TestingComponent.propTypes = {
  label: PropTypes.string,
  color: PropTypes.string,
  onChange: PropTypes.func,
};
