import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import AppTourContextProvider, {
  useAppTourContext,
} from "components/contexts/AppTourContext";
import PropTypes from "prop-types";

const TestingComponent = (props) => {
  const { appTourStep, setAppTourStep, activeAppTour, setActiveAppTour } =
    useAppTourContext();

  useEffect(() => {
    if (props.appTourStep) {
      setAppTourStep(props.appTourStep);
    }
    if (props.activeAppTour) {
      const activeMessage = props.activeAppTour ? "active" : "not active";
      setActiveAppTour(activeMessage);
    }
    // eslint-disable-next-line
  }, []);

  return (
    <>
      <p data-testid="app-tour-step">{appTourStep}</p>
      <p data-testid="active-app-tour">
        {activeAppTour ? "active" : "not active"}
      </p>
    </>
  );
};

test("app tour context", async () => {
  jest.useFakeTimers();

  render(
    <AppTourContextProvider>
      <TestingComponent />
    </AppTourContextProvider>
  );
  expect(await screen.findByTestId("app-tour-step")).toHaveTextContent(0);
  expect(await screen.findByTestId("active-app-tour")).toHaveTextContent(
    "not active"
  );
});

test("app tour context update", async () => {
  jest.useFakeTimers();

  render(
    <AppTourContextProvider>
      <TestingComponent appTourStep={1} activeAppTour={true} />
    </AppTourContextProvider>
  );
  expect(await screen.findByTestId("app-tour-step")).toHaveTextContent(1);
  expect(await screen.findByTestId("active-app-tour")).toHaveTextContent(
    "active"
  );
});

TestingComponent.propTypes = {
  appTourStep: PropTypes.number,
  activeAppTour: PropTypes.bool,
};
