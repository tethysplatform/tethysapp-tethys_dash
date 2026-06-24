import { useRef } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import BackgroundSettings from "components/modals/DataViewer/BackgroundSettings";
import PropTypes from "prop-types";

global.ResizeObserver = require("resize-observer-polyfill");

const TestingComponent = ({ onChange }) => {
  const settingsPaneRef = useRef(null);

  return (
    <div ref={settingsPaneRef}>
      <BackgroundSettings
        initialBackgroundColor={"black"}
        onChange={onChange}
        settingsPaneRef={settingsPaneRef}
      />
    </div>
  );
};

it("BackgroundSettings", async () => {
  const mockOnChange = jest.fn();
  render(<TestingComponent onChange={mockOnChange} />);

  const backgroundColorButton = await screen.findByLabelText(
    "Background Color Selector",
  );
  expect(backgroundColorButton).toBeInTheDocument();
  // eslint-disable-next-line
  expect(backgroundColorButton.querySelector("svg")).toHaveAttribute(
    "color",
    "black",
  );

  await userEvent.click(backgroundColorButton);

  const hexInput = await screen.findByLabelText(/hex/i);
  expect(hexInput.value).toBe("black");

  await userEvent.clear(hexInput);
  await userEvent.type(hexInput, "#0000ff");
  await userEvent.tab();

  await waitFor(() => {
    expect(mockOnChange).toHaveBeenCalledWith("#0000ff");
  });

  // eslint-disable-next-line
  expect(backgroundColorButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#0000ff",
  );

  await userEvent.click(backgroundColorButton);

  await waitFor(() => {
    expect(hexInput).not.toBeInTheDocument();
  });
});

TestingComponent.propTypes = {
  onChange: PropTypes.func,
};
