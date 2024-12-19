import { render, screen } from "@testing-library/react";
import { useEffect, act } from "react";
import LayoutAlertContextProvider, {
  useLayoutSuccessAlertContext,
  useLayoutErrorAlertContext,
  useLayoutWarningAlertContext,
} from "components/contexts/LayoutAlertContext";
import Alert from "react-bootstrap/Alert";

const TestingComponent = () => {
  const {
    successMessage,
    setSuccessMessage,
    showSuccessMessage,
    setShowSuccessMessage,
  } = useLayoutSuccessAlertContext();
  const {
    errorMessage,
    setErrorMessage,
    showErrorMessage,
    setShowErrorMessage
  } = useLayoutErrorAlertContext();
  const {
    warningMessage,
    setWarningMessage,
    showWarningMessage,
    setShowWarningMessage,
  } = useLayoutWarningAlertContext();

  useEffect(() => {
    setSuccessMessage("success");
    setShowSuccessMessage(true);
    setErrorMessage("error");
    setShowErrorMessage(true);
    setWarningMessage("warning");
    setShowWarningMessage(true);
    // eslint-disable-next-line
  }, []);

  return (
    <>
      {showErrorMessage && (
        <Alert key="failure" variant="danger" dismissible={true}>
          {errorMessage}
        </Alert>
      )}
      {showSuccessMessage && (
        <Alert key="success" variant="success" dismissible={true}>
          {successMessage}
        </Alert>
      )}
      {showWarningMessage && (
        <Alert key="warning" variant="warning" dismissible={true}>
          {warningMessage}
        </Alert>
      )}
    </>
  );
};

test("layout alert context", async () => {
  jest.useFakeTimers();

  render(
    <LayoutAlertContextProvider>
      <TestingComponent />
    </LayoutAlertContextProvider>
  );

  expect(await screen.findByText("success")).toBeInTheDocument();
  expect(await screen.findByText("error")).toBeInTheDocument();
  expect(await screen.findByText("warning")).toBeInTheDocument();

  act(() => {
    jest.advanceTimersByTime(7000);
  });

  expect(screen.queryByText("success")).not.toBeInTheDocument();
  expect(screen.queryByText("error")).not.toBeInTheDocument();
  expect(screen.queryByText("warning")).not.toBeInTheDocument();

  jest.useRealTimers();
});
