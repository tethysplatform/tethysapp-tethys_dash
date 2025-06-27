import Joyride, { ACTIONS, EVENTS, STATUS } from "react-joyride";
import { useAppTourContext } from "components/contexts/AppTourContext";
import { FaRegUserCircle } from "react-icons/fa";
import { BsPeopleFill } from "react-icons/bs";

const AppTour = () => {
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

    if (step.data && type === EVENTS.STEP_AFTER) {
      if (index !== appTourStep) {
        setAppTourStep(appTourStep);
      } else if (action === ACTIONS.PREV) {
        const nextStepIndex = index - 1;
        setAppTourStep(nextStepIndex);
      } else if (step.data.callbackNext) {
        const nextStepIndex = index + 1;
        setAppTourStep(nextStepIndex);
      } else {
        setActiveAppTour(false);
      }
    }
  };

  const steps = [
    {
      target: ".landing-page", // 0
      content: (
        <div>
          All available user and public dashboards will be displayed on this
          page.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      hideBackButton: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
    },
    {
      target: ".create-new-card", // 1
      content: (
        <div>
          Dashboard can be created by clicking on the "Create a New Dashboard"
          card.
          <br />
          <br />
          Click on this card to create a new dashboard and continue with the App
          tour.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      hideFooter: true,
      spotlightPadding: 5,
    },
    {
      target: ".modal-content", // 2
      content: (
        <div>
          This is a modal for creating a new dashboard. Provide a name and a
          description for your dashboard and then click on "Create".
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      hideFooter: true,
      spotlightPadding: 5,
    },
    {
      target: ".landing-page > div > div:nth-child(2) > div", // 3
      content: (
        <div>
          Each card in the landing page represents a dashboard and its
          information.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      hideBackButton: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
    },
    {
      target:
        ".landing-page > div > div:nth-child(2) > div > div.card-header > div.card-header-icons", // 4
      content: (
        <div>
          Card icons will indicate ownership and public availability.
          <br />
          <br />
          <FaRegUserCircle />: You are the owner of the dashboard.
          <br />
          <BsPeopleFill />: Dashboard is publicly available.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
    },
    {
      target:
        ".landing-page > div > div:nth-child(2) > div > div.card-header > div.card-header-title", // 5
      content: <div>Dashboard names are displayed in the card header.</div>,
      disableBeacon: true,
      disableOverlayClose: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
    },
    {
      target: ".landing-page > div > div:nth-child(2) > div > div.card-body", // 6
      content: (
        <div>
          Thumbnails provide an image representing the dashboard. Hover over the
          card body to see the description of the dashboard.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
    },
    {
      target:
        ".landing-page > div > div:nth-child(2) > div > div.card-header > div.card-header-menu", // 7
      content: (
        <div>
          Additional dashboard options and interactions are available through
          the card context menu.
          <br />
          <br />
          Click on the context menu to see additional options.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      hideFooter: true,
      spotlightPadding: 5,
    },
    {
      target: ".card-open-option", // 8
      content: (
        <div>
          Open and view the dashboard. You can also double click on the card to
          open the dashboard.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      hideBackButton: true,
      data: { callbackNext: true },
    },
    {
      target: ".card-rename-option", // 9
      content: (
        <div>
          Rename the dashboard. This will also update any public urls tied to
          this dashboard.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
    },
    {
      target: ".card-update-description-option", // 10
      content: <div>Update the description of the dashboard.</div>,
      disableBeacon: true,
      disableOverlayClose: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
    },
    {
      target: ".card-update-thumbnail-option", // 11
      content: <div>Update the thumbnail of the dashboard.</div>,
      disableBeacon: true,
      disableOverlayClose: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
    },
    {
      target: ".card-share-option", // 12
      content: (
        <div>
          Update the sharing status of the dashboard or copy the public link for
          the dashboard if it is public.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
    },
    {
      target: ".card-copy-option", // 13
      content: (
        <div>
          Copy with the same settings and dashboard items. The new dashboard
          will have the name with "_copy" at the end.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
    },
    {
      target: ".card-delete-option", // 14
      content: <div>Delete the dashboard. This action cannot be undone.</div>,
      disableBeacon: true,
      disableOverlayClose: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
    },
    {
      target: ".landing-page", // 15
      content: (
        <div>
          For more information about TethysDash, visit the{" "}
          <a
            href="https://tethysdashdocs.readthedocs.io/en/latest/usage/settings_tab.html"
            target="_black"
            rel="noopener noreferrer"
          >
            TethysDash documentation
          </a>
          . Please follow instructions found in the{" "}
          <a
            href="https://tethysdashdocs.readthedocs.io/en/latest/feedback.html"
            target="_black"
            rel="noopener noreferrer"
          >
            feedback
          </a>{" "}
          sessions for reporting any bugs or issues.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      locale: { next: "End App Tour" },
      showSkipButton: false,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { endAppTourStep: true },
      placement: "center",
    },
    {},
    {
      target: ".complex-interface-layout", // 17
      content: (
        <div>
          This is the main layout of the dashboard where dashboards items will
          be shown.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      hideBackButton: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
    },
    {
      target: ".gridVisualization:first-child", // 18
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
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
    },
    {
      target: ".editDashboardButton", // 19
      content: <div>Click on the edit button to turn on edit mode.</div>,
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      hideFooter: true,
      spotlightPadding: 5,
    },
    {
      target:
        ".react-grid-layout.complex-interface-layout > div:nth-child(1) > span", // 20
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
      floaterProps: { hideArrow: true },
      data: { callbackNext: true },
    },
    {
      target: ".dashboard-item-dropdown-toggle", // 21
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
      target: ".dashboard-item-dropdown-edit-visualization", // 22
      content: (
        <div>
          Editing the visualization will change the dashboard visualization as
          well as any dashboard item settings.
          <br />
          <br />
          Click on "Edit" in the menu to learn more or continue the App Tour by
          clicking on "Next".
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      hideBackButton: true,
      data: { callbackNext: true },
      spotlightPadding: -1,
    },
    {
      target: ".dashboard-item-dropdown-create-copy", // 23
      content: (
        <div>
          Create a copy of the existing dashboard item. This will copy the
          visualization and any settings.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
      spotlightPadding: -1,
    },
    {
      target: ".dashboard-item-dropdown-export", // 24
      content: (
        <div>
          Export the dashboard item information into a file which can then be
          imported into dashboards.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
      spotlightPadding: -1,
    },
    {
      target: ".dashboard-item-dropdown-delete", // 25
      content: (
        <div>
          Deleting the dashboard item will remove it from the dashboard layout.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
      spotlightPadding: -1,
    },
    {
      target: ".dashboardExitButton", // 26
      content: <div>Exit the dashboard and return to the landing page.</div>,
      disableBeacon: true,
      disableOverlayClose: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
      spotlightPadding: 5,
    },
    {
      target: ".cancelChangesButton", // 27
      content: (
        <div>
          Cancel any changes made and return the layout to the latest saved
          version.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
      spotlightPadding: 5,
    },
    {
      target: ".saveChangesButton", // 28
      content: <div>Save any changes made and persist for later sessions.</div>,
      disableBeacon: true,
      disableOverlayClose: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
      spotlightPadding: 5,
    },
    {
      target: ".addGridItemsButton", // 29
      content: <div>Add new dashboard items to the layout.</div>,
      disableBeacon: true,
      disableOverlayClose: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
      spotlightPadding: 5,
    },
    {
      target: ".lockUnlocKMovementButton", // 30
      content: <div>Lock grid item movement during editing.</div>,
      disableBeacon: true,
      disableOverlayClose: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
      spotlightPadding: 5,
    },
    {
      target: ".importDashboardItemButton", // 31
      content: <div>Import grid items from a configuration file.</div>,
      disableBeacon: true,
      disableOverlayClose: true,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { callbackNext: true },
      spotlightPadding: 5,
    },
    {
      target: ".dashboardSettingButton", // 32
      content: (
        <div>
          Edit dashboard settings like names, descriptions, thumbnails, sharing
          status, and notes. These settings, as well as copying and deleting
          dashboard actions, can be found in this menu.
          <br />
          <br />
          Click on the button to learn more about dashboard settings or continue
          the App Tour by clicking on "Next".
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      data: { callbackNext: true },
      spotlightPadding: 5,
    },
    {
      target: ".react-grid-layout", // 33
      content: (
        <div>
          For more information about TethysDash, visit the{" "}
          <a
            href="https://tethysdashdocs.readthedocs.io/en/latest/usage/settings_tab.html"
            target="_black"
            rel="noopener noreferrer"
          >
            TethysDash documentation
          </a>
          . Please follow instructions found in the{" "}
          <a
            href="https://tethysdashdocs.readthedocs.io/en/latest/feedback.html"
            target="_black"
            rel="noopener noreferrer"
          >
            feedback
          </a>{" "}
          sessions for reporting any bugs or issues.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      locale: { next: "End App Tour" },
      showSkipButton: false,
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      data: { endAppTourStep: true },
      placement: "center",
    },
    // DATAVIEWER STEPS
    {
      target: ".modal-content", // 34
      content: (
        <div>
          This is a modal for configuring and previewing visualizations.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      hideBackButton: true,
      placement: "center",
      styles: {
        overlay: { "pointer-events": "auto" },
      },
      floaterProps: { hideArrow: true },
      data: { callbackNext: true },
    },
    {
      target: "#visualization-tabs > li:nth-child(1)", // 35
      content: (
        <div>
          The visualization tab will show options for configuring the
          visualization and any visualization arguments.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      data: { callbackNext: true },
      spotlightPadding: -1,
    },
    {
      target: ".dataviewer-inputs", // 36
      content: (
        <div>
          Begin by selecting a "Visualization Type" to pick a visualization.
          <br />
          <br />
          Once a visualization type has been chosen, additional inputs for
          arguments will appear for the given visualization.
          <br />
          <br />
          Click on the dropdown and select "Custom Image". In this example, the
          argument is asking for an publicly accessible image url.
          <br />
          <br />
          You can use <b>/static/tethysdash/images/tethys_dash.png</b> as an
          example.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      data: { callbackNext: true },
      placement: "right",
    },
    {
      target: "#visualization-tabs > li:nth-child(2)", // 37
      content: (
        <div>
          The settings tab will show options for configuring any dashboard item
          settings. Setting options will not be available until a visualization
          is configured and in the preview.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      data: { callbackNext: true },
      placement: "right",
      spotlightPadding: -1,
    },
    {
      target: ".dataviewer-inputs", // 38
      content: (
        <div>
          Once the visualization is loaded, available settings for the
          visualization will be shown. For more information on potential
          settings and what they do, please check the official{" "}
          <a
            href="https://tethysdashdocs.readthedocs.io/en/latest/usage/settings_tab.html"
            target="_black"
            rel="noopener noreferrer"
          >
            TethysDash documentation
          </a>
          .
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      data: { callbackNext: true },
      placement: "right",
    },
    {
      target: ".dataviewer-save-button", // 39
      content: (
        <div>
          After the visualization is configured correctly, click on the "Save"
          button to exit the data viewer and save any changes to the dashboard
          item.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      data: { callbackNext: true },
      spotlightPadding: 5,
    },
    {
      target: ".dataviewer-close-button", // 40
      content: (
        <div>
          Click on the "Close" button to exit the data viewer and continue with
          the App Tour.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      hideFooter: true,
      spotlightPadding: 5,
    },
    // DASHBOARD SETTINGS
    {
      target: ".dashboard-settings-editor", // 41
      content: (
        <div>
          General dashboard settings can be altered in this menu. General
          settings include the following:
          <br />
          <br />
          <ul>
            <li>
              <b>Name</b>: The name of dashboard that will show in the url and
              header.
            </li>
            <br />
            <li>
              <b>Description</b>: The description of the dashboard that will
              show in the landing page.
            </li>
            <br />
            <li>
              <b>Sharing Status</b>: Determines if the dashboard is publicly
              available.
            </li>
            <br />
            <li>
              <b>Unrestricted Grid Item Movement</b>: This allows grid items to
              be placed in any location in the dashboard and overlap.
            </li>
            <br />
            <li>
              <b>Notes</b>: Write and persist any text for future reference.
              These notes are publicly viewable if the dashboard is public.
            </li>
          </ul>
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      hideBackButton: true,
      data: { callbackNext: true },
      placement: "right",
    },
    {
      target: ".save-dashboard-button", // 42
      content: <div>Save updated dashboard settings.</div>,
      disableBeacon: true,
      disableOverlayClose: true,
      data: { callbackNext: true },
      placement: "top",
      spotlightPadding: 5,
    },
    {
      target: ".delete-dashboard-button", // 43
      content: <div>Delete the dashboard. This action cannot be undone.</div>,
      disableBeacon: true,
      disableOverlayClose: true,
      data: { callbackNext: true },
      placement: "top",
      spotlightPadding: 5,
    },
    {
      target: ".copy-dashboard-button", // 44
      content: (
        <div>
          Copy with the same settings and dashboard items. The new dashboard
          will have the name with "_copy" at the end.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      data: { callbackNext: true },
      placement: "top",
      spotlightPadding: 5,
    },
    {
      target: ".cancel-dashboard-editor-button", // 45
      content: (
        <div>
          Click on the "Close" button to exit the settings editor and continue
          with the App Tour.
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
      hideFooter: true,
      spotlightPadding: 5,
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
};

export default AppTour;
