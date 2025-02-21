import { useEffect, useRef, useContext } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent } from "@testing-library/react";
import SettingsPane from "components/modals/DataViewer/SettingsPane";
import { mockedDashboards } from "__tests__/utilities/constants";
import { LayoutContext } from "components/contexts/Contexts";
import createLoadedComponent from "__tests__/utilities/customRender";
import PropTypes from "prop-types";

const TestingComponent = ({
  layoutContext,
  visualizationRefElement,
  currentSettings = {},
}) => {
  const { setLayoutContext } = useContext(LayoutContext);
  const settingsRef = useRef(currentSettings);
  const visualizationRef = useRef();

  useEffect(() => {
    setLayoutContext(layoutContext);
    if (visualizationRefElement) {
      visualizationRef.current = visualizationRefElement;
    }
    // eslint-disable-next-line
  }, []);

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
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));

  render(
    createLoadedComponent({
      children: <TestingComponent layoutContext={mockedDashboard} />,
      options: {
        inDataViewerMode: true,
      },
    })
  );

  expect(
    screen.getByText("Visualization must be loaded to change settings.")
  ).toBeInTheDocument();
});

test("Settings Pane with visualizationRef Element", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
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

  const refreshRateInput = screen.getByLabelText(
    "Refresh Rate (Minutes) Input"
  );
  expect(refreshRateInput).toBeInTheDocument();
  fireEvent.change(refreshRateInput, { target: { value: -2 } });
  expect(refreshRateInput.value).toBe("0");

  fireEvent.change(refreshRateInput, { target: { value: 2 } });
  expect(refreshRateInput.value).toBe("2");
});

test("Settings Pane with visualizationRef Image Element with current settings", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
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

  const refreshRateInput = screen.getByLabelText(
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
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          layoutContext={mockedDashboard}
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
  layoutContext: PropTypes.object,
  visualizationRefElement: PropTypes.object,
  currentSettings: PropTypes.object,
};
