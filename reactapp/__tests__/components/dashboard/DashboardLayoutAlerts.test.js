import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import DashboardLayoutAlerts from "components/dashboard/DashboardLayoutAlerts";
import LayoutAlertContextProvider, {
  useLayoutSuccessAlertContext,
  useLayoutErrorAlertContext,
  useLayoutWarningAlertContext,
} from "components/contexts/LayoutAlertContext";
import PropTypes from "prop-types";

const TestingComponent = (props) => {
  const { setSuccessMessage, setShowSuccessMessage } =
    useLayoutSuccessAlertContext();
  const { setErrorMessage, setShowErrorMessage } = useLayoutErrorAlertContext();
  const { setWarningMessage, setShowWarningMessage } =
    useLayoutWarningAlertContext();

  useEffect(() => {
    if (props.successMessage) {
      setSuccessMessage(props.successMessage);
      setShowSuccessMessage(true);
    }
    if (props.errorMessage) {
      setErrorMessage(props.errorMessage);
      setShowErrorMessage(true);
    }
    if (props.warningMessage) {
      setWarningMessage(props.warningMessage);
      setShowWarningMessage(true);
    }
    // eslint-disable-next-line
  }, []);

  return <DashboardLayoutAlerts />;
};

test("Dashboard Layout Alerts Shown", async () => {
  render(
    <LayoutAlertContextProvider>
      <TestingComponent
        successMessage={"success"}
        errorMessage={"error"}
        warningMessage={"warning"}
      />
    </LayoutAlertContextProvider>
  );

  expect(await screen.findByText("success")).toBeInTheDocument();
  expect(await screen.findByText("error")).toBeInTheDocument();
  expect(await screen.findByText("warning")).toBeInTheDocument();
});

test("Dashboard Layout Alerts not Shown", async () => {
  render(
    <LayoutAlertContextProvider>
      <TestingComponent />
    </LayoutAlertContextProvider>
  );

  expect(screen.queryByText("success")).not.toBeInTheDocument();
  expect(screen.queryByText("error")).not.toBeInTheDocument();
  expect(screen.queryByText("warning")).not.toBeInTheDocument();
});

TestingComponent.propTypes = {
  successMessage: PropTypes.string,
  errorMessage: PropTypes.string,
  warningMessage: PropTypes.string,
};
