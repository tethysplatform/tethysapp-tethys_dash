import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BackgroundSettings from "components/modals/DataViewer/BackgroundSettings";
import PropTypes from "prop-types";

global.ResizeObserver = require("resize-observer-polyfill");

const TestingComponent = () => {
  const [backgroundColor, setBackgroundColor] = useState("black");

  return (
    <BackgroundSettings
      backgroundColor={backgroundColor}
      setBackgroundColor={setBackgroundColor}
    />
  );
};

it("BackgroundSettings", async () => {
  render(<TestingComponent />);

  const backgroundColorButton = await screen.findByLabelText(
    "Background Color Selector"
  );
  expect(backgroundColorButton).toBeInTheDocument();
  // eslint-disable-next-line
  expect(backgroundColorButton.querySelector("svg")).toHaveAttribute(
    "color",
    "black"
  );

  await userEvent.click(backgroundColorButton);

  const hexInput = await screen.findByLabelText(/hex/i);
  expect(hexInput.value).toBe("black");

  fireEvent.change(hexInput, { target: { value: "#0000ff" } });

  await waitFor(() => {
    // eslint-disable-next-line
    expect(backgroundColorButton.querySelector("svg")).toHaveAttribute(
      "color",
      "#0000ff"
    );
  });

  await userEvent.click(backgroundColorButton);

  await waitFor(() => {
    expect(hexInput).not.toBeInTheDocument();
  });
});

TestingComponent.propTypes = {
  visualizationRefElement: PropTypes.object,
  currentSettings: PropTypes.object,
};
