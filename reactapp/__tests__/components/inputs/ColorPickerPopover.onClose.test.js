import { useRef } from "react";
import PropTypes from "prop-types";
import { act, render, screen, fireEvent } from "@testing-library/react";
import ColorPickerPopover from "components/inputs/ColorPickerPopOver";

// Stands in for react-bootstrap's Overlay with its root-close behaviour: a
// click outside the open popover asks it to hide.
// The last onHide the overlay was given, so a test can fire a root close
// the way the real overlay does after the swatch's own click.
const overlay = { onHide: null };
jest.mock("react-bootstrap/Overlay", () => {
  /* eslint-disable react/prop-types -- a test stand-in, not a component. */
  const MockOverlay = ({ show, onHide, children }) => {
    overlay.onHide = onHide;
    return show ? (
      <div>
        <div data-testid="popover">{children}</div>
        <button type="button" onClick={onHide}>
          click outside
        </button>
      </div>
    ) : null;
  };
  /* eslint-enable react/prop-types */
  return MockOverlay;
});

jest.mock("components/inputs/ColorPicker", () => {
  const MockPicker = () => <div data-testid="picker" />;
  return MockPicker;
});

const Picker = ({ onClose }) => {
  const containerRef = useRef(null);
  return (
    <div ref={containerRef}>
      <ColorPickerPopover
        label="Line Color"
        color="#123456"
        onChange={jest.fn()}
        onClose={onClose}
        containerRef={containerRef}
      />
    </div>
  );
};
Picker.propTypes = { onClose: PropTypes.func };

const swatch = () => screen.getByLabelText("Line Color color popover square");

it("calls onClose when a click outside closes the picker", () => {
  const onClose = jest.fn();
  render(<Picker onClose={onClose} />);

  fireEvent.click(swatch());
  expect(screen.getByTestId("popover")).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "click outside" }));
  expect(screen.queryByTestId("popover")).toBeNull();
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("calls onClose when the swatch closes the picker, but not when it opens it", () => {
  const onClose = jest.fn();
  render(<Picker onClose={onClose} />);

  fireEvent.click(swatch());
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(swatch());
  expect(screen.queryByTestId("popover")).toBeNull();
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("closes without an onClose", () => {
  render(<Picker />);
  fireEvent.click(swatch());
  fireEvent.click(screen.getByRole("button", { name: "click outside" }));
  expect(screen.queryByTestId("popover")).toBeNull();
});

it("calls onClose once when the swatch's click also reaches the root close", () => {
  const onClose = jest.fn();
  render(<Picker onClose={onClose} />);
  fireEvent.click(swatch());

  // One click on the swatch: its own handler, then the overlay's root close
  // for a click outside the popover, in the same event.
  fireEvent.click(swatch());
  act(() => overlay.onHide());
  expect(onClose).toHaveBeenCalledTimes(1);
});
