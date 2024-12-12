import DashboardLayout from "../../components/dashboard/DashboardLayout";
import DashboardLayoutAlerts from "../../components/dashboard/DashboardLayoutAlerts";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import Header from "components/layout/Header";
import PropTypes from "prop-types";
import { useContext } from "react";
import { LayoutContext } from "components/contexts/Contexts";
import Joyride, { ACTIONS, EVENTS, STATUS, ORIGIN } from "react-joyride";
import { useAppTourContext } from "components/contexts/AppTourContext";

function DashboardView({ initialDashboard }) {
  const { getLayoutContext } = useContext(LayoutContext);
  const { name } = getLayoutContext();
  const { appTourStep, setAppTourStep, activeAppTour, setActiveAppTour } =
    useAppTourContext();

  const handleCallback = (event) => {
    const { status, action, index, type, origin } = event;

    if (
      status === STATUS.FINISHED ||
      status === STATUS.SKIPPED ||
      action === ACTIONS.CLOSE
    ) {
      setActiveAppTour(false);
    }
  };

  const steps = [
    {
      target: ".wizard-step-1", // 0
      content: (
        <div>
          Begin by clicking on the dropdown to select or create a dashboard.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      hideFooter: true,
      placement: "bottom",
      spotlightClicks: true,
    },
    {
      target: ".wizard-step-2__menu", // 1
      content: (
        <div>
          Select an existing dashboard to view or create a new dashboard with
          the "Create a New Dashboard" option.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      hideFooter: true,
      placement: "bottom",
      spotlightClicks: true,
    },
    {
      target: ".newdashboard-content", // 2
      content: <div>Enter the dashboard name and select "Create".</div>,
      disableBeacon: true,
      disableOverlayClose: true,
      hideFooter: true,
      placement: "left",
      spotlightClicks: true,
    },
    {
      target: ".newdashboard-content", // 3
      content: (
        <div>
          The dashboard name is already used. Try to update the dashboard name
          and select "Create" again.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      hideFooter: true,
      placement: "left",
      spotlightClicks: true,
    },
    {
      target: ".complex-interface-layout", // 4
      content: (
        <div>
          This is the main layout of the dashboard where dashboards items will
          be shown.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      placement: "top",
      spotlightClicks: true,
      hideBackButton: true,
    },
  ];

  return (
    <>
      <Joyride
        callback={handleCallback}
        scrollToFirstStep
        showProgress
        showSkipButton
        steps={steps}
        stepIndex={appTourStep}
        run={activeAppTour}
        styles={{
          options: {
            zIndex: 10000,
          },
        }}
      />
      <Header initialDashboard={initialDashboard} />
      {name && (
        // {/* look at moving context here so that we can set name, griditems, etc? */}
        <LayoutAlertContextProvider>
          <DashboardLayoutAlerts />
          <DashboardLayout key={name} />
        </LayoutAlertContextProvider>
      )}
    </>
  );
}

DashboardView.propTypes = {
  initialDashboard: PropTypes.string,
};

export default DashboardView;
