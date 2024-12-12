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

    if ([4, 5, 7].includes(index) && type == EVENTS.STEP_AFTER) {
      const nextStepIndex = index + 1;
      setAppTourStep(nextStepIndex);
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
      spotlightClicks: true,
    },
    {
      target: ".newdashboard-content", // 2
      content: <div>Enter the dashboard name and select "Create".</div>,
      disableBeacon: true,
      disableOverlayClose: true,
      hideFooter: true,
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
      spotlightClicks: true,
      hideBackButton: true,
    },
    {
      target: ".gridVisualization:first-child", // 5
      content: (
        <div>
          Dashboards are composed of dashboard items. Each dashboard item can be
          customized to show visualizations and be changed in size to the users
          liking. Dashboards and items can only be changed by the dashboard
          owner and when the dashboard is in edit mode.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      hideBackButton: true,
    },
    {
      target: ".editDashboardButton", // 6
      content: <div>To turn on edit mode, click on the edit button</div>,
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      hideFooter: true,
    },
    {
      target: "#gridUpdate > div > div:nth-child(1) > span", // 7
      content: (
        <div>
          Once in edit mode, update the size of a dashboard item by dragging the
          resize handle.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      hideBackButton: true,
      styles: {
        options: {
          arrowColor: "transparent",
        },
      },
    },
    {
      target: "#gridUpdate > div > div:nth-child(1) > div > div", // 8
      content: (
        <div>
          While in edit mode, update the visualization by clicking on the 3 dot
          menu within the dashboard item.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      placement: "bottom",
      spotlightClicks: true,
      hideBackButton: true,
    },
  ];

  return (
    <>
      <Joyride
        callback={handleCallback}
        continuous
        scrollToFirstStep
        showSkipButton
        steps={steps}
        stepIndex={appTourStep}
        run={activeAppTour}
        locale={{ skip: "End App Tour", last: "End App Tour" }}
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
