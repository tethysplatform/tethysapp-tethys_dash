import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import DashboardLayoutAlerts, {
  getAlertTopOffset,
} from "components/dashboard/DashboardLayoutAlerts";
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
    </LayoutAlertContextProvider>,
  );

  expect(await screen.findByText("success")).toBeInTheDocument();
  expect(await screen.findByText("error")).toBeInTheDocument();
  expect(await screen.findByText("warning")).toBeInTheDocument();
});

test("Dashboard Layout Alerts are pinned below the header at a fixed width", async () => {
  render(
    <LayoutAlertContextProvider>
      <TestingComponent successMessage={"success"} />
    </LayoutAlertContextProvider>,
  );

  expect(await screen.findByText("success")).toBeInTheDocument();
  // The container is the positioned element, not the Alert itself.
  const styles = window.getComputedStyle(screen.getByTestId("layout-alerts"));

  expect(styles.position).toBe("fixed");
  // Anchored to the right edge, 1rem clear of it, rather than spanning the full
  // width as it used to (left and right were both 1rem).
  expect(styles.right).toBe("1rem");
  expect(styles.left).toBe("");
  // A quarter of the width, so long messages grow taller and not wider.
  expect(styles.width).toBe("25%");
  // The top offset is calc(var(--ts-header-height) + 1rem). jsdom cannot
  // evaluate var() inside calc() and reports it as "", so the clearance below
  // the header is not assertable here and has to be checked in a browser.
});

describe("getAlertTopOffset", () => {
  test("clears the header alone when there is no tab bar", () => {
    expect(getAlertTopOffset(false)).toBe(
      "calc(var(--ts-header-height) + 1rem)",
    );
  });

  test("clears the tab bar as well when it is showing", () => {
    expect(getAlertTopOffset(true)).toBe(
      "calc(var(--ts-header-height) + var(--ts-tab-bar-height) + 1rem)",
    );
  });

  test("leaves the same 1rem gap either way", () => {
    // Whatever sits above the body, the visible gap below it is the same.
    expect(getAlertTopOffset(false)).toContain("+ 1rem");
    expect(getAlertTopOffset(true)).toContain("+ 1rem");
  });
});

test("Dashboard Layout Alerts not Shown", async () => {
  render(
    <LayoutAlertContextProvider>
      <TestingComponent />
    </LayoutAlertContextProvider>,
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
