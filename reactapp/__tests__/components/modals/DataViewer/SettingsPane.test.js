import { useRef, useState } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SettingsPane from "components/modals/DataViewer/SettingsPane";
import {
  defaultBorderWidth,
  defaultBorderColor,
} from "components/modals/DataViewer/BorderSettings";
import createLoadedComponent from "__tests__/utilities/customRender";
import selectEvent from "react-select-event";
import PropTypes from "prop-types";

global.ResizeObserver = require("resize-observer-polyfill");

const TestingComponent = ({
  visualizationRefElement,
  vizInputsValues = {},
  currentSettings = {},
}) => {
  const [settings, setSettings] = useState(currentSettings);
  const visualizationRef = useRef(visualizationRefElement);

  return (
    <>
      <SettingsPane
        settings={settings}
        setSettings={setSettings}
        viz={null}
        visualizationRef={visualizationRef}
        vizInputsValues={vizInputsValues}
      />
      <p data-testid="settings">{JSON.stringify(settings)}</p>
    </>
  );
};

TestingComponent.displayName = "TestingComponent";

// Settings updates can land asynchronously after an interaction — most
// notably ColorPicker debounces its onChange, so the state write outlives
// the userEvent call that triggered it. Always retry the content assertion
// instead of racing the re-render: a bare
// `expect(await screen.findByTestId("settings"))` resolves as soon as the
// element exists (it always does) and then asserts only once, which flaked
// in CI whenever the machine was slow enough for the trailing debounce to
// lose the race.
const expectSettings = async (expectedText) => {
  await waitFor(() => {
    expect(screen.getByTestId("settings")).toHaveTextContent(expectedText);
  });
};

test("Settings Pane", async () => {
  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        inDataViewerMode: true,
      },
    }),
  );

  expect(
    await screen.findByText(
      "Visualization must be loaded to change additional settings.",
    ),
  ).toBeInTheDocument();
});

test("Settings Pane with visualizationRef Element", async () => {
  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          visualizationRefElement={{
            tagName: "div",
          }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    }),
  );

  const refreshRateInput = await screen.findByLabelText(
    "Refresh Rate (Minutes) Input",
  );
  expect(refreshRateInput).toBeInTheDocument();
  fireEvent.change(refreshRateInput, { target: { value: -2 } });
  expect(refreshRateInput.value).toBe("0");

  await expectSettings(JSON.stringify({}));

  fireEvent.change(refreshRateInput, { target: { value: 2 } });
  await waitFor(() => {
    expect(refreshRateInput.value).toBe("2");
  });

  await expectSettings(
    JSON.stringify({
      refreshRate: 2,
    }),
  );
});

test("Settings Pane with visualizationRef Image Element with current settings", async () => {
  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          visualizationRefElement={{
            tagName: "img",
            naturalWidth: 1,
            naturalHeight: 2,
          }}
          currentSettings={{ refreshRate: 5, enforceAspectRatio: true }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    }),
  );

  const refreshRateInput = await screen.findByLabelText(
    "Refresh Rate (Minutes) Input",
  );
  expect(refreshRateInput).toBeInTheDocument();
  expect(refreshRateInput.value).toBe("5");

  const enforceAspectRationInput = screen.getByLabelText(
    "Enforce Aspect Ratio Input",
  );
  expect(enforceAspectRationInput).toBeInTheDocument();
  expect(enforceAspectRationInput).toBeChecked();
  await userEvent.click(enforceAspectRationInput);
  expect(enforceAspectRationInput).not.toBeChecked();

  fireEvent.click(enforceAspectRationInput);
  expect(enforceAspectRationInput).toBeChecked();

  await expectSettings(
    JSON.stringify({
      refreshRate: 5,
      aspectRatio: 0.5,
      enforceAspectRatio: true,
    }),
  );
});

test("Settings Pane with visualizationRef Image Element but no natural width", async () => {
  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          visualizationRefElement={{
            tagName: "img",
          }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    }),
  );

  const enforceAspectRationInput = screen.queryByLabelText(
    "Enforce Aspect Ratio Input",
  );
  expect(enforceAspectRationInput).not.toBeInTheDocument();

  await expectSettings(JSON.stringify({}));
});

test("Settings configure border", async () => {
  render(
    createLoadedComponent({
      children: <TestingComponent currentSettings={{}} />,
      options: {
        inDataViewerMode: true,
      },
    }),
  );

  await expectSettings(JSON.stringify({}));

  const leftBorderButton = await screen.findByLabelText("left Border Button");
  expect(leftBorderButton).toBeInTheDocument();
  const topBorderButton = screen.getByLabelText("top Border Button");
  expect(topBorderButton).toBeInTheDocument();
  const rightBorderButton = screen.getByLabelText("right Border Button");
  expect(rightBorderButton).toBeInTheDocument();
  const bottomBorderButton = screen.getByLabelText("bottom Border Button");
  expect(bottomBorderButton).toBeInTheDocument();
  const removeBordersButton = screen.getByLabelText("Remove Borders");
  expect(removeBordersButton).toBeInTheDocument();
  const allBorderButton = screen.getByLabelText("all Border Button");
  expect(allBorderButton).toBeInTheDocument();

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

  let styleSelect = await screen.findByRole("combobox");
  await selectEvent.select(styleSelect, "solid");

  await userEvent.click(allBorderButton);

  await expectSettings(
    JSON.stringify({
      border: { border: `${defaultBorderWidth}px solid ${defaultBorderColor}` },
    }),
  );

  // left border button will update existing
  await userEvent.click(leftBorderButton);

  styleSelect = await screen.findByRole("combobox");
  await selectEvent.select(styleSelect, "dashed");

  await userEvent.click(leftBorderButton);

  await expectSettings(
    JSON.stringify({
      border: {
        "border-top": "1px solid black",
        "border-bottom": "1px solid black",
        "border-left": "1px dashed black",
        "border-right": "1px solid black",
      },
    }),
  );
});

test("Settings with border", async () => {
  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          currentSettings={{ border: { border: "4px solid #ff6161" } }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    }),
  );

  await expectSettings(
    JSON.stringify({
      border: { border: "4px solid #ff6161" },
    }),
  );

  const leftBorderButton = await screen.findByLabelText("left Border Button");
  expect(leftBorderButton).toBeInTheDocument();
  const topBorderButton = screen.getByLabelText("top Border Button");
  expect(topBorderButton).toBeInTheDocument();
  const rightBorderButton = screen.getByLabelText("right Border Button");
  expect(rightBorderButton).toBeInTheDocument();
  const bottomBorderButton = screen.getByLabelText("bottom Border Button");
  expect(bottomBorderButton).toBeInTheDocument();
  const removeBordersButton = screen.getByLabelText("Remove Borders");
  expect(removeBordersButton).toBeInTheDocument();
  const allBorderButton = screen.getByLabelText("all Border Button");
  expect(allBorderButton).toBeInTheDocument();

  // eslint-disable-next-line
  expect(leftBorderButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#ff6161",
  );
  // eslint-disable-next-line
  expect(topBorderButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#ff6161",
  );
  // eslint-disable-next-line
  expect(rightBorderButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#ff6161",
  );
  // eslint-disable-next-line
  expect(bottomBorderButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#ff6161",
  );

  await expectSettings(
    JSON.stringify({
      border: { border: "4px solid #ff6161" },
    }),
  );

  // all border button will affect all sides
  await userEvent.click(allBorderButton);

  const hexInput = screen.getByRole("textbox", { name: "Color : HEX" });
  expect(hexInput.value).toBe("#ff6161");
  await userEvent.clear(hexInput);
  await userEvent.type(hexInput, "#0000ff");
  await userEvent.tab();

  let styleSelect = await screen.findByRole("combobox");
  await selectEvent.select(styleSelect, "dashed");

  let widthInput = await screen.findByRole("textbox", { name: "Width Input" });
  expect(widthInput.value).toBe("4");
  fireEvent.change(widthInput, { target: { value: 20 } });

  await expectSettings(
    JSON.stringify({
      border: { border: "20px dashed #0000ff" },
    }),
  );

  await userEvent.click(removeBordersButton);

  await expectSettings(JSON.stringify({}));
});

test("Settings with top and bottom border", async () => {
  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          currentSettings={{
            border: {
              "border-top": "2px solid #7fc066",
              "border-bottom": "4px solid #ff6161",
            },
          }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    }),
  );

  const leftBorderButton = await screen.findByLabelText("left Border Button");
  expect(leftBorderButton).toBeInTheDocument();
  const topBorderButton = screen.getByLabelText("top Border Button");
  expect(topBorderButton).toBeInTheDocument();
  const rightBorderButton = screen.getByLabelText("right Border Button");
  expect(rightBorderButton).toBeInTheDocument();
  const bottomBorderButton = screen.getByLabelText("bottom Border Button");
  expect(bottomBorderButton).toBeInTheDocument();

  // eslint-disable-next-line
  expect(leftBorderButton.querySelector("svg")).not.toHaveAttribute("color");
  // eslint-disable-next-line
  expect(topBorderButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#7fc066",
  );
  // eslint-disable-next-line
  expect(rightBorderButton.querySelector("svg")).not.toHaveAttribute("color");
  // eslint-disable-next-line
  expect(bottomBorderButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#ff6161",
  );

  await expectSettings(
    JSON.stringify({
      border: {
        "border-top": "2px solid #7fc066",
        "border-bottom": "4px solid #ff6161",
      },
    }),
  );
});

test("Settings with backgroundColor", async () => {
  render(
    createLoadedComponent({
      children: (
        <TestingComponent currentSettings={{ backgroundColor: "#ff6161" }} />
      ),
      options: {
        inDataViewerMode: true,
      },
    }),
  );

  await expectSettings(
    JSON.stringify({
      backgroundColor: "#ff6161",
    }),
  );

  const backgroundColorButton = await screen.findByLabelText(
    "Background Color Selector",
  );
  expect(backgroundColorButton).toBeInTheDocument();
  // eslint-disable-next-line
  expect(backgroundColorButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#ff6161",
  );

  await userEvent.click(backgroundColorButton);

  const hexInput = await screen.findByLabelText(/hex/i);
  expect(hexInput.value).toBe("#ff6161");
  await userEvent.clear(hexInput);
  await userEvent.type(hexInput, "#0000ff");
  await userEvent.tab();

  await expectSettings(
    JSON.stringify({
      backgroundColor: "#0000ff",
    }),
  );

  // change to transparent
  await userEvent.clear(hexInput);
  await userEvent.type(hexInput, "#00000000");
  await userEvent.tab();

  await expectSettings(JSON.stringify({}));
});

test("Settings with box shadow", async () => {
  render(
    createLoadedComponent({
      children: <TestingComponent currentSettings={{}} />,
      options: {
        inDataViewerMode: true,
      },
    }),
  );

  const boxShadowCheckbox = await screen.findByLabelText(
    "Use Box Shadow Styling Input",
  );
  expect(boxShadowCheckbox).toBeInTheDocument();

  await userEvent.click(boxShadowCheckbox);

  await expectSettings(
    JSON.stringify({
      boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
    }),
  );

  await userEvent.click(boxShadowCheckbox);

  await expectSettings(JSON.stringify({}));
});

test("Settings with box shadow and border", async () => {
  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          currentSettings={{ border: { border: "4px solid #ff6161" } }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    }),
  );

  const boxShadowCheckbox = await screen.findByLabelText(
    "Use Box Shadow Styling Input",
  );
  expect(boxShadowCheckbox).toBeInTheDocument();

  await userEvent.click(boxShadowCheckbox);

  await expectSettings(
    JSON.stringify({
      border: { border: "4px solid #ff6161" },
      boxShadow: "0 4px 8px #ff6161",
    }),
  );

  await userEvent.click(boxShadowCheckbox);

  await expectSettings(
    JSON.stringify({
      border: { border: "4px solid #ff6161" },
    }),
  );
});

test("Settings with box shadow and top and bottom border", async () => {
  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          currentSettings={{
            border: {
              "border-top": "2px solid #7fc066",
              "border-bottom": "4px solid #ff6161",
            },
          }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    }),
  );

  const boxShadowCheckbox = await screen.findByLabelText(
    "Use Box Shadow Styling Input",
  );
  expect(boxShadowCheckbox).toBeInTheDocument();

  await userEvent.click(boxShadowCheckbox);

  await expectSettings(
    JSON.stringify({
      border: {
        "border-top": "2px solid #7fc066",
        "border-bottom": "4px solid #ff6161",
      },
      boxShadow: "0 4px 8px #ff6161,0 -4px 8px #7fc066",
    }),
  );
});

test("Settings with box shadow and left and right border", async () => {
  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          currentSettings={{
            border: {
              "border-left": "2px solid #7fc066",
              "border-right": "4px solid #ff6161",
            },
          }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    }),
  );

  const boxShadowCheckbox = await screen.findByLabelText(
    "Use Box Shadow Styling Input",
  );
  expect(boxShadowCheckbox).toBeInTheDocument();

  await userEvent.click(boxShadowCheckbox);

  await expectSettings(
    JSON.stringify({
      border: {
        "border-left": "2px solid #7fc066",
        "border-right": "4px solid #ff6161",
      },
      boxShadow: "4px 0 8px #ff6161,-4px 0 8px #7fc066",
    }),
  );
});

test("Settings with box shadow and change border", async () => {
  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          currentSettings={{
            border: {
              "border-left": "2px solid #7fc066",
              "border-right": "4px solid #ff6161",
            },
          }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    }),
  );

  const leftBorderButton = await screen.findByLabelText("left Border Button");
  expect(leftBorderButton).toBeInTheDocument();
  const boxShadowCheckbox = await screen.findByLabelText(
    "Use Box Shadow Styling Input",
  );
  expect(boxShadowCheckbox).toBeInTheDocument();

  await userEvent.click(boxShadowCheckbox);

  await expectSettings(
    JSON.stringify({
      border: {
        "border-left": "2px solid #7fc066",
        "border-right": "4px solid #ff6161",
      },
      boxShadow: "4px 0 8px #ff6161,-4px 0 8px #7fc066",
    }),
  );

  await userEvent.click(leftBorderButton);

  const hexInput = await screen.findByLabelText(/hex/i);
  expect(hexInput.value).toBe("#7fc066");
  await userEvent.clear(hexInput);
  await userEvent.type(hexInput, "#FF0000");
  await userEvent.tab();

  await expectSettings(
    JSON.stringify({
      border: {
        "border-left": "2px solid #FF0000",
        "border-right": "4px solid #ff6161",
      },
      boxShadow: "4px 0 8px #ff6161,-4px 0 8px #FF0000",
    }),
  );
});

test("Settings with attribution", async () => {
  render(
    createLoadedComponent({
      children: <TestingComponent currentSettings={{}} />,
      options: {
        inDataViewerMode: true,
      },
    }),
  );

  const attributionCheckbox = await screen.findByLabelText(
    "Show Attribution Input",
  );
  expect(attributionCheckbox).toBeInTheDocument();
  expect(attributionCheckbox.checked).toBe(true);

  await userEvent.click(attributionCheckbox);

  await expectSettings(JSON.stringify({ attribution: false }));
  expect(attributionCheckbox.checked).toBe(false);

  await userEvent.click(attributionCheckbox);

  await expectSettings(JSON.stringify({}));
  expect(attributionCheckbox.checked).toBe(true);
});

test("Settings with existing attribution", async () => {
  render(
    createLoadedComponent({
      children: <TestingComponent currentSettings={{ attribution: false }} />,
      options: {
        inDataViewerMode: true,
      },
    }),
  );

  const attributionCheckbox = await screen.findByLabelText(
    "Show Attribution Input",
  );
  expect(attributionCheckbox).toBeInTheDocument();
  await expectSettings(JSON.stringify({ attribution: false }));
  expect(attributionCheckbox.checked).toBe(false);

  await userEvent.click(attributionCheckbox);

  await expectSettings(JSON.stringify({}));
  expect(attributionCheckbox.checked).toBe(true);
});

test("Settings with custom messaging", async () => {
  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          currentSettings={{
            customMessaging: { error: "some custom error message" },
          }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    }),
  );

  await expectSettings(
    JSON.stringify({
      customMessaging: { error: "some custom error message" },
    }),
  );

  const errorMessageInput = screen.getByLabelText("error Custom Message Input");
  expect(errorMessageInput).toBeInTheDocument();
  expect(errorMessageInput.value).toBe("some custom error message");

  fireEvent.change(errorMessageInput, {
    target: { value: "a new custom message" },
  });

  await expectSettings(
    JSON.stringify({
      customMessaging: { error: "a new custom message" },
    }),
  );

  fireEvent.change(errorMessageInput, {
    target: { value: "" },
  });

  await expectSettings(JSON.stringify({}));
});

test("SettingsPane renders PlotlySettings when visualizationRef.current.el.className includes 'plotly'", async () => {
  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          visualizationRefElement={{ el: { className: "plotly-graph-div" } }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    }),
  );
  // Check for a PlotlySettings-specific element or behavior
  // For example, if PlotlySettings renders a known label or input
  // Here, we check for the absence of the warning alert
  expect(
    screen.queryByText(
      "Visualization must be loaded to change additional settings.",
    ),
  ).not.toBeInTheDocument();

  expect(await screen.findByText(/Vertical Line/i)).toBeInTheDocument();
});

test("Settings with fill viewport", async () => {
  render(
    createLoadedComponent({
      children: <TestingComponent currentSettings={{}} />,
      options: {
        inDataViewerMode: true,
      },
    }),
  );

  // Renders for any viz type (no visualizationRef), unlike Enforce Aspect Ratio
  // which is image-only.
  const fillViewportCheckbox = await screen.findByLabelText(
    "Fill Viewport Input",
  );
  expect(fillViewportCheckbox).toBeInTheDocument();
  expect(fillViewportCheckbox.checked).toBe(false);

  await userEvent.click(fillViewportCheckbox);

  await expectSettings(JSON.stringify({ fillViewport: true }));
  expect(fillViewportCheckbox.checked).toBe(true);

  await userEvent.click(fillViewportCheckbox);

  await expectSettings(JSON.stringify({}));
  expect(fillViewportCheckbox.checked).toBe(false);
});

test("Fill viewport disables aspect ratio control without losing it", async () => {
  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          visualizationRefElement={{
            tagName: "img",
            naturalWidth: 1,
            naturalHeight: 2,
          }}
          currentSettings={{ aspectRatio: 0.5, enforceAspectRatio: true }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    }),
  );

  const enforceAspectRatioInput = await screen.findByLabelText(
    "Enforce Aspect Ratio Input",
  );
  expect(enforceAspectRatioInput).toBeChecked();
  expect(enforceAspectRatioInput).not.toBeDisabled();

  const fillViewportCheckbox = await screen.findByLabelText(
    "Fill Viewport Input",
  );
  await userEvent.click(fillViewportCheckbox);

  // Aspect ratio control becomes disabled, and its stored keys are preserved.
  expect(enforceAspectRatioInput).toBeDisabled();
  await expectSettings(
    JSON.stringify({
      aspectRatio: 0.5,
      enforceAspectRatio: true,
      fillViewport: true,
    }),
  );

  // Turning fill off restores the prior aspect-ratio setting unchanged.
  await userEvent.click(fillViewportCheckbox);
  expect(enforceAspectRatioInput).not.toBeDisabled();
  expect(enforceAspectRatioInput).toBeChecked();
  await expectSettings(
    JSON.stringify({ aspectRatio: 0.5, enforceAspectRatio: true }),
  );
});

TestingComponent.propTypes = {
  visualizationRefElement: PropTypes.object,
  currentSettings: PropTypes.object,
  vizInputsValues: PropTypes.arrayOf(PropTypes.object),
};
