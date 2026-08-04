import {
  useLayoutSuccessAlertContext,
  useLayoutErrorAlertContext,
  useLayoutWarningAlertContext,
} from "components/contexts/LayoutAlertContext";
import { useContext } from "react";
import { TabContext } from "components/contexts/Contexts";
import styled from "styled-components";
import Alert from "react-bootstrap/Alert";

/**
 * Top offset for the alerts, measured from the top of the viewport.
 *
 * Always 1rem below whatever sits directly above the dashboard body, so the gap
 * looks the same either way: that is the header on its own, or the header plus
 * the tab bar once a dashboard has more than one tab and the bar is showing.
 */
export const getAlertTopOffset = (hasTabBar) =>
  hasTabBar
    ? "calc(var(--ts-header-height) + var(--ts-tab-bar-height) + 1rem)"
    : "calc(var(--ts-header-height) + 1rem)";

const StyledAbsDiv = styled.div`
  /* Fixed rather than absolute so the offset from the header and tab bar — both
     of which are out of the flow or in a sibling subtree — is stated explicitly
     instead of depending on where this element lands in the flow. */
  position: fixed;
  z-index: 1000;
  top: ${(props) => props.$topOffset};
  right: 1rem;
  /* A quarter of the viewport, fixed: a long message grows taller, never wider. */
  width: 25%;
  /* ...and a long unbroken string wraps instead of widening the box. */
  overflow-wrap: anywhere;
`;

function DashboardLayoutAlerts() {
  const { successMessage, showSuccessMessage } = useLayoutSuccessAlertContext();
  const { errorMessage, showErrorMessage } = useLayoutErrorAlertContext();
  const { warningMessage, showWarningMessage } = useLayoutWarningAlertContext();
  // The landing page renders this component too, where there is no TabContext.
  const tabContext = useContext(TabContext);
  const hasTabBar = (tabContext?.tabs?.length ?? 0) > 1;

  return (
    <StyledAbsDiv
      data-testid="layout-alerts"
      $topOffset={getAlertTopOffset(hasTabBar)}
    >
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
    </StyledAbsDiv>
  );
}

export default DashboardLayoutAlerts;
