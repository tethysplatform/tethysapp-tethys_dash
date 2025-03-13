import { useEffect, useRef, useContext } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent } from "@testing-library/react";
import SettingsPane from "components/modals/DataViewer/SettingsPane";
import { mockedDashboards } from "__tests__/utilities/constants";
import createLoadedComponent from "__tests__/utilities/customRender";
import PropTypes from "prop-types";

const TestingComponent = ({
  visualizationRefElement,
  currentSettings = {},
}) => {
  const settingsRef = useRef(currentSettings);
  const visualizationRef = useRef(visualizationRefElement);

  return (
    <>
      <SettingsPane
        settingsRef={settingsRef}
        viz={null}
        visualizationRef={visualizationRef}
      />
    </>
  );
};

test("Settings Pane", async () => {
  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        inDataViewerMode: true,
      },
    })
  );

  expect(
    await screen.findByText("Visualization must be loaded to change settings.")
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
    })
  );

  const refreshRateInput = await screen.findByLabelText(
    "Refresh Rate (Minutes) Input"
  );
  expect(refreshRateInput).toBeInTheDocument();
  fireEvent.change(refreshRateInput, { target: { value: -2 } });
  expect(refreshRateInput.value).toBe("0");

  fireEvent.change(refreshRateInput, { target: { value: 2 } });
  expect(refreshRateInput.value).toBe("2");
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
    })
  );

  const refreshRateInput = await screen.findByLabelText(
    "Refresh Rate (Minutes) Input"
  );
  expect(refreshRateInput).toBeInTheDocument();
  expect(refreshRateInput.value).toBe("5");

  const enforceAspectRationInput = screen.getByLabelText(
    "Enforce Aspect Ratio Input"
  );
  expect(enforceAspectRationInput).toBeInTheDocument();
  expect(enforceAspectRationInput).toBeChecked();
  await userEvent.click(enforceAspectRationInput);
  expect(enforceAspectRationInput).not.toBeChecked();

  fireEvent.click(enforceAspectRationInput);
  expect(enforceAspectRationInput).toBeChecked();
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
    })
  );

  const enforceAspectRationInput = screen.queryByLabelText(
    "Enforce Aspect Ratio Input"
  );
  expect(enforceAspectRationInput).not.toBeInTheDocument();
});

TestingComponent.propTypes = {
  visualizationRefElement: PropTypes.object,
  currentSettings: PropTypes.object,
};
