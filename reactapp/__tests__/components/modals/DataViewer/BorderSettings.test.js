import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BorderSettings from "components/modals/DataViewer/BorderSettings";
import {
  defaultBorderStyle,
  defaultBorderWidth,
  defaultBorderColor,
} from "components/modals/DataViewer/SettingsPane";
import selectEvent from "react-select-event";
import PropTypes from "prop-types";

global.ResizeObserver = require("resize-observer-polyfill");

const TestingComponent = () => {
  const [border, setBorder] = useState({
    top: {
      color: defaultBorderColor,
      style: defaultBorderStyle,
      width: defaultBorderWidth,
    },
    bottom: {
      color: defaultBorderColor,
      style: defaultBorderStyle,
      width: defaultBorderWidth,
    },
    left: {
      color: defaultBorderColor,
      style: defaultBorderStyle,
      width: defaultBorderWidth,
    },
    right: {
      color: defaultBorderColor,
      style: defaultBorderStyle,
      width: defaultBorderWidth,
    },
    all: {
      color: defaultBorderColor,
      style: defaultBorderStyle,
      width: defaultBorderWidth,
    },
  });

  return (
    <>
      <BorderSettings border={border} setBorder={setBorder} />
      <p data-testid="border">{JSON.stringify(border)}</p>
    </>
  );
};

it("BorderSettings", async () => {
  render(<TestingComponent />);

  expect(await screen.findByText("Border")).toBeInTheDocument();
  const removeBordersButton = screen.getByLabelText("Remove Borders");
  expect(removeBordersButton).toBeInTheDocument();
  const allBorderButton = screen.getByLabelText("all Border Button");
  expect(allBorderButton).toBeInTheDocument();
  const leftBorderButton = screen.getByLabelText("left Border Button");
  expect(leftBorderButton).toBeInTheDocument();
  const topBorderButton = screen.getByLabelText("top Border Button");
  expect(topBorderButton).toBeInTheDocument();
  const rightBorderButton = screen.getByLabelText("right Border Button");
  expect(rightBorderButton).toBeInTheDocument();
  const bottomBorderButton = screen.getByLabelText("bottom Border Button");
  expect(bottomBorderButton).toBeInTheDocument();

  // eslint-disable-next-line
  expect(allBorderButton.querySelector("svg")).not.toHaveAttribute("color");
  // eslint-disable-next-line
  expect(leftBorderButton.querySelector("svg")).not.toHaveAttribute("color");
  // eslint-disable-next-line
  expect(topBorderButton.querySelector("svg")).not.toHaveAttribute("color");
  // eslint-disable-next-line
  expect(rightBorderButton.querySelector("svg")).not.toHaveAttribute("color");
  // eslint-disable-next-line
  expect(bottomBorderButton.querySelector("svg")).not.toHaveAttribute("color");

  // all border button will affect all sides
  await userEvent.click(allBorderButton);

  let hexInput = await screen.findByLabelText(/hex/i);
  expect(hexInput.value).toBe(defaultBorderColor);
  fireEvent.change(hexInput, { target: { value: "#0000ff" } });

  let styleSelect = await screen.findByRole("combobox");
  await selectEvent.select(styleSelect, "solid");

  let widthInput = await screen.findByRole("spinbutton");
  expect(widthInput.value).toBe(`${defaultBorderWidth}`);
  fireEvent.change(widthInput, { target: { value: 20 } });

  await userEvent.click(allBorderButton);

  await waitFor(() => {
    expect(hexInput).not.toBeInTheDocument();
  });
  // eslint-disable-next-line
  expect(leftBorderButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#0000ff"
  );
  // eslint-disable-next-line
  expect(topBorderButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#0000ff"
  );
  // eslint-disable-next-line
  expect(rightBorderButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#0000ff"
  );
  // eslint-disable-next-line
  expect(bottomBorderButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#0000ff"
  );
  expect(await screen.findByTestId("border")).toHaveTextContent(
    JSON.stringify({
      left: {
        color: "#0000ff",
        style: { value: "solid", label: "solid" },
        width: "20",
      },
      right: {
        color: "#0000ff",
        style: { value: "solid", label: "solid" },
        width: "20",
      },
      top: {
        color: "#0000ff",
        style: { value: "solid", label: "solid" },
        width: "20",
      },
      bottom: {
        color: "#0000ff",
        style: { value: "solid", label: "solid" },
        width: "20",
      },
      all: {
        color: "#0000ff",
        style: { value: "solid", label: "solid" },
        width: "20",
      },
    })
  );

  // left border button will update existing
  await userEvent.click(leftBorderButton);

  hexInput = await screen.findByLabelText(/hex/i);
  expect(hexInput.value).toBe("#0000ff");
  fireEvent.change(hexInput, { target: { value: "#FF0000" } });

  styleSelect = await screen.findByRole("combobox");
  await selectEvent.select(styleSelect, "dashed");

  widthInput = await screen.findByRole("spinbutton");
  expect(widthInput.value).toBe("20");
  fireEvent.change(widthInput, { target: { value: 10 } });

  await userEvent.click(leftBorderButton);

  await waitFor(() => {
    expect(hexInput).not.toBeInTheDocument();
  });
  // eslint-disable-next-line
  expect(leftBorderButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#FF0000"
  );
  // eslint-disable-next-line
  expect(topBorderButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#0000ff"
  );
  // eslint-disable-next-line
  expect(rightBorderButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#0000ff"
  );
  // eslint-disable-next-line
  expect(bottomBorderButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#0000ff"
  );
  // eslint-disable-next-line
  expect(await screen.findByTestId("border")).toHaveTextContent(
    JSON.stringify({
      left: {
        color: "#FF0000",
        style: { value: "dashed", label: "dashed" },
        width: "10",
      },
      right: {
        color: "#0000ff",
        style: { value: "solid", label: "solid" },
        width: "20",
      },
      top: {
        color: "#0000ff",
        style: { value: "solid", label: "solid" },
        width: "20",
      },
      bottom: {
        color: "#0000ff",
        style: { value: "solid", label: "solid" },
        width: "20",
      },
      all: {
        color: "#0000ff",
        style: { value: "solid", label: "solid" },
        width: "20",
      },
    })
  );

  // remove border button will make all border style to none
  await userEvent.click(removeBordersButton);

  // eslint-disable-next-line
  expect(leftBorderButton.querySelector("svg")).not.toHaveAttribute("color");
  // eslint-disable-next-line
  expect(topBorderButton.querySelector("svg")).not.toHaveAttribute("color");
  // eslint-disable-next-line
  expect(rightBorderButton.querySelector("svg")).not.toHaveAttribute("color");
  // eslint-disable-next-line
  expect(bottomBorderButton.querySelector("svg")).not.toHaveAttribute("color");

  expect(await screen.findByTestId("border")).toHaveTextContent(
    JSON.stringify({
      left: {
        color: "#FF0000",
        style: { value: "none", label: "none" },
        width: "10",
      },
      right: {
        color: "#0000ff",
        style: { value: "none", label: "none" },
        width: "20",
      },
      top: {
        color: "#0000ff",
        style: { value: "none", label: "none" },
        width: "20",
      },
      bottom: {
        color: "#0000ff",
        style: { value: "none", label: "none" },
        width: "20",
      },
      all: {
        color: "#0000ff",
        style: { value: "none", label: "none" },
        width: "20",
      },
    })
  );
});

TestingComponent.propTypes = {
  visualizationRefElement: PropTypes.object,
  currentSettings: PropTypes.object,
};
