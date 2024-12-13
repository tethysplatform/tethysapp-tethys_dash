import Joyride, { ACTIONS, EVENTS, STATUS, ORIGIN } from "react-joyride";
import { useAppTourContext } from "components/contexts/AppTourContext";

function AppTour() {
  const { appTourStep, setAppTourStep, activeAppTour, setActiveAppTour } =
    useAppTourContext();
  const handleCallback = (event) => {
    const { status, action, index, type, step } = event;

    if (
      status === STATUS.FINISHED ||
      status === STATUS.SKIPPED ||
      action === ACTIONS.CLOSE
    ) {
      setActiveAppTour(false);
    }

    if (step.data && step.data.callbackNext && type == EVENTS.STEP_AFTER) {
      const nextStepIndex = index + (action === ACTIONS.PREV ? -1 : 1);
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
      data: { callbackNext: true },
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
      data: { callbackNext: true },
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
      data: { callbackNext: true },
    },
    {
      target: ".dashboard-item-dropdown-toggle", // 8
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
      hideFooter: true,
    },
    {
      target: ".dashboard-item-dropdown-edit-visualization", // 9
      content: (
        <div>
          Editing the visualization will change the dashboard visualization as
          well as any dashboard item settings.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      hideBackButton: true,
      data: { callbackNext: true },
    },
    {
      target: ".dashboard-item-dropdown-create-copy", // 10
      content: (
        <div>
          Create a copy of the existing dashboard item. This will copy the
          visualization and any settings.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      data: { callbackNext: true },
    },
    {
      target: ".dashboard-item-dropdown-delete", // 11
      content: (
        <div>
          Deleting the dashboard item will remove it from the dashboard layout.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      data: { callbackNext: true },
    },
    {
      target: ".cancelChangesButton", // 12
      content: (
        <div>
          Click on the cancel changes button to revert any changes made and
          return the layout to the latest saved version.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      data: { callbackNext: true },
    },
    {
      target: ".saveChangesButton", // 13
      content: (
        <div>
          Click on the save changes button to save any changes made and persist
          for later sessions
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      data: { callbackNext: true },
    },
    {
      target: ".addGridItemsButton", // 14
      content: (
        <div>
          Click on the add dashboard items button to add new dashboard items to
          the layout
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      data: { callbackNext: true },
    },
  ];

  return (
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
  );
}

export default AppTour;
