import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { DashboardHeader } from "components/layout/Header";
import DashboardLayout from "components/dashboard/DashboardLayout";
import AppTour from "components/appTour/AppTour";
import { MemoryRouter } from "react-router-dom";
import createLoadedComponent from "__tests__/utilities/customRender";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import appAPI from "services/api/app";
import { confirm } from "components/inputs/DeleteConfirmation";
import LandingPage from "views/LandingPage";

jest.mock("components/inputs/DeleteConfirmation", () => {
  return {
    confirm: jest.fn(),
  };
});
const mockedConfirm = jest.mocked(confirm);

const { matchMedia } = window;

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

afterEach(() => {
  window.matchMedia = matchMedia;
  jest.restoreAllMocks();
});

test("Dashboard App Tour", async () => {
  let nextButton;
  let backButton;
  let endTourButton;
  const mockAddDashboard = jest.fn();
  appAPI.addDashboard = mockAddDashboard;
  mockAddDashboard.mockResolvedValue({
    success: true,
    new_dashboard: {
      id: 1,
      name: "new_name",
      label: "New Name",
      notes: "test_notes",
      editable: true,
      accessGroups: [],
      gridItems: [
        {
          i: "1",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "",
          args_string: "{}",
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
      ],
    },
  });

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <LayoutAlertContextProvider>
            <AppTour />
            <DashboardHeader />
            <DashboardLayout />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: { editableDashboard: true },
    })
  );

  expect(
    // eslint-disable-next-line
    document.querySelector("#react-joyride-portal")
  ).not.toBeInTheDocument();

  ////////////////////
  // App Info Modal //
  ////////////////////
  expect(await screen.findByText("TethysDash Dashboards")).toBeInTheDocument();
  expect(
    await screen.findByText(
      /If you would like to take a tour of the application, click on the button below to begin./i
    )
  ).toBeInTheDocument();
  const startTourButton = await screen.findByText("Start Dashboard Tour");
  expect(startTourButton).toBeInTheDocument();
  userEvent.click(startTourButton);
  await waitFor(() => {
    expect(screen.queryByText("Start Dashboard Tour")).not.toBeInTheDocument();
  });

  /////////////
  // STEP 17 //
  /////////////
  expect(
    await screen.findByText(
      "This is the main layout of the dashboard where dashboards items will be shown."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  await userEvent.click(nextButton);

  /////////////
  // STEP 18 //
  /////////////
  expect(
    await screen.findByText(
      "Dashboards are composed of dashboard items. Each dashboard item can be customized to show visualizations and be changed in size to the users liking. Dashboards and items can only be changed by the dashboard owner and when the dashboard is in edit mode."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(backButton);

  /////////////
  // STEP 17 //
  /////////////
  expect(
    await screen.findByText(
      "This is the main layout of the dashboard where dashboards items will be shown."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  await userEvent.click(nextButton);

  /////////////
  // STEP 18 //
  /////////////
  expect(
    await screen.findByText(
      "Dashboards are composed of dashboard items. Each dashboard item can be customized to show visualizations and be changed in size to the users liking. Dashboards and items can only be changed by the dashboard owner and when the dashboard is in edit mode."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(nextButton);

  /////////////
  // STEP 19 //
  /////////////
  expect(
    await screen.findByText("Click on the edit button to turn on edit mode.")
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  const dashboardEditButton = await screen.findByLabelText("editButton");
  await userEvent.click(dashboardEditButton);

  /////////////
  // STEP 20 //
  /////////////
  expect(
    await screen.findByText(
      "Once in edit mode, update the size of a dashboard item by dragging the resize handle."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  await userEvent.click(nextButton);

  /////////////
  // STEP 21 //
  /////////////
  expect(
    await screen.findByText(
      "While in edit mode, update the visualization by clicking on the 3 dot menu within the dashboard item."
    )
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  const dashboardItemDropdownToggle = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(dashboardItemDropdownToggle);

  /////////////
  // STEP 22 //
  /////////////
  expect(
    await screen.findByText(
      /Editing the visualization will change the dashboard visualization as well as any dashboard item settings./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /Click on "Edit" in the menu to learn more or continue the App Tour by clicking on "Next"./i
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  const editGridItemButton = await screen.findByText("Edit");
  await userEvent.click(editGridItemButton);

  //////////////////////////
  // STEP 32 - DATAVIEWER //
  //////////////////////////
  expect(
    await screen.findByText(
      "This is a modal for configuring and previewing visualizations."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  await userEvent.click(nextButton);

  //////////////////////////
  // STEP 33 - DATAVIEWER //
  //////////////////////////
  expect(
    await screen.findByText(
      "The visualization tab will show options for configuring the visualization and any visualization arguments."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(nextButton);

  //////////////////////////
  // STEP 34 - DATAVIEWER //
  //////////////////////////
  expect(
    await screen.findByText(
      /Begin by selecting a "Visualization Type" to pick a visualization./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /Once a visualization type has been chosen, additional inputs for arguments will appear for the given visualization./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /Click on the dropdown and select "Custom Image". In this example, the argument is asking for an publicly accessible image url./i
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(nextButton);

  //////////////////////////
  // STEP 35 - DATAVIEWER //
  //////////////////////////
  expect(
    await screen.findByText(
      /The settings tab will show options for configuring any dashboard item settings. Setting options will not be available until a visualization is configured and in the preview./i
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(nextButton);

  //////////////////////////
  // STEP 36 - DATAVIEWER //
  //////////////////////////
  expect(
    await screen.findByText(
      /Once the visualization is loaded, available settings for the visualization will be shown. For more information on potential settings and what they do, please check the official/i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(/TethysDash documentation/i)
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(nextButton);

  //////////////////////////
  // STEP 37 - DATAVIEWER //
  //////////////////////////
  expect(
    await screen.findByText(
      /After the visualization is configured correctly, click on the "Save" button to exit the data viewer and save any changes to the dashboard item./i
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(nextButton);

  //////////////////////////
  // STEP 38 - DATAVIEWER //
  //////////////////////////
  expect(
    await screen.findByText(
      /Click on the "Close" button to exit the data viewer and continue with the App Tour./i
    )
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  const closeDataviewer = await screen.findByLabelText(
    "dataviewer-close-button"
  );
  await userEvent.click(closeDataviewer);

  /////////////
  // STEP 23 //
  /////////////
  expect(
    await screen.findByText(
      "Create a copy of the existing dashboard item. This will copy the visualization and any settings."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(backButton);

  /////////////
  // STEP 22 //
  /////////////
  expect(
    await screen.findByText(
      /Editing the visualization will change the dashboard visualization as well as any dashboard item settings./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /Click on "Edit" in the menu to learn more or continue the App Tour by clicking on "Next"./i
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  await userEvent.click(nextButton);

  /////////////
  // STEP 23 //
  /////////////
  expect(
    await screen.findByText(
      "Create a copy of the existing dashboard item. This will copy the visualization and any settings."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(nextButton);

  /////////////
  // STEP 24 //
  /////////////
  expect(
    await screen.findByText(
      "Export the dashboard item information into a file which can then be imported into dashboards."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(nextButton);

  /////////////
  // STEP 25 //
  /////////////
  expect(
    await screen.findByText(
      "Deleting the dashboard item will remove it from the dashboard layout."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(nextButton);

  /////////////
  // STEP 26 //
  /////////////
  expect(
    await screen.findByText(
      "Exit the dashboard and return to the landing page."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(nextButton);

  /////////////
  // STEP 27 //
  /////////////
  expect(
    await screen.findByText(
      "Cancel any changes made and return the layout to the latest saved version."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(nextButton);

  /////////////
  // STEP 28 //
  /////////////
  expect(
    await screen.findByText(
      "Save any changes made and persist for later sessions."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(nextButton);

  /////////////
  // STEP 29 //
  /////////////
  expect(
    await screen.findByText("Add new dashboard items to the layout.")
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(nextButton);

  /////////////
  // STEP 30 //
  /////////////
  expect(
    await screen.findByText("Lock grid item movement during editing.")
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(nextButton);
  await userEvent.click(nextButton);

  /////////////
  // STEP 31 //
  /////////////
  expect(
    await screen.findByText("Import grid items from a configuration file.")
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(nextButton);

  /////////////
  // STEP 32 //
  /////////////
  expect(
    await screen.findByText(
      /Edit dashboard settings like names, descriptions, thumbnails, sharing status, and notes. These settings, as well as copying and deleting dashboard actions, can be found in this menu./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /Click on the button to learn more about dashboard settings or continue the App Tour by clicking on "Next"./i
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  const dashboardSettingButton = await screen.findByLabelText(
    "dashboardSettingButton"
  );
  await userEvent.click(dashboardSettingButton);

  ////////////////////////////////
  // STEP 41 - DASHBOARD EDITOR //
  ////////////////////////////////
  await waitFor(async () => {
    expect(
      await screen.findByText(
        /General dashboard settings can be altered in this menu. General settings include the following:/i
      )
    ).toBeInTheDocument();
  });
  expect(
    await screen.findByText(
      /The name of dashboard that will show in the url and header./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /The description of the dashboard that will show in the landing page./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /Determines if the dashboard is publicly available./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /This allows grid items to be placed in any location in the dashboard and overlap./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /Write and persist any text for future reference. These notes are publicly viewable if the dashboard is public./i
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  await userEvent.click(nextButton);

  ////////////////////////////////
  // STEP 42 - DASHBOARD EDITOR //
  ////////////////////////////////
  expect(
    await screen.findByText("Save updated dashboard settings.")
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(nextButton);

  ////////////////////////////////
  // STEP 43 - DASHBOARD EDITOR //
  ////////////////////////////////
  expect(
    await screen.findByText(
      "Delete the dashboard. This action cannot be undone."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(nextButton);

  ////////////////////////////////
  // STEP 44 - DASHBOARD EDITOR //
  ////////////////////////////////
  expect(
    await screen.findByText(
      'Copy with the same settings and dashboard items. The new dashboard will have the name with "_copy" at the end.'
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(nextButton);

  ////////////////////////////////
  // STEP 45 - DASHBOARD EDITOR //
  ////////////////////////////////
  expect(
    await screen.findByText(
      'Click on the "Close" button to exit the settings editor and continue with the App Tour.'
    )
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  const cancelDashboardEditorButton = await screen.findByLabelText(
    "Cancel Dashboard Editor Button"
  );
  await userEvent.click(cancelDashboardEditorButton);

  /////////////
  // STEP 33 //
  /////////////
  expect(
    await screen.findByText(/For more information about TethysDash, visit the/i)
  ).toBeInTheDocument();
  expect(
    await screen.findByText(/TethysDash documentation/i)
  ).toBeInTheDocument();
  expect(
    await screen.findByText(/. Please follow instructions found in the/i)
  ).toBeInTheDocument();
  expect(await screen.findByText(/feedback/i)).toBeInTheDocument();
  expect(
    await screen.findByText(/sessions for reporting any bugs or issues./i)
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  endTourButton = await screen.findByLabelText("End App Tour");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(backButton);

  /////////////
  // STEP 32 //
  /////////////
  expect(
    await screen.findByText(
      /Edit dashboard settings like names, descriptions, thumbnails, sharing status, and notes. These settings, as well as copying and deleting dashboard actions, can be found in this menu./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /Click on the button to learn more about dashboard settings or continue the App Tour by clicking on "Next"./i
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(nextButton);

  /////////////
  // STEP 33 //
  /////////////
  expect(
    await screen.findByText(/For more information about TethysDash, visit the/i)
  ).toBeInTheDocument();
  expect(
    await screen.findByText(/TethysDash documentation/i)
  ).toBeInTheDocument();
  expect(
    await screen.findByText(/. Please follow instructions found in the/i)
  ).toBeInTheDocument();
  expect(await screen.findByText(/feedback/i)).toBeInTheDocument();
  expect(
    await screen.findByText(/sessions for reporting any bugs or issues./i)
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  endTourButton = await screen.findByLabelText("End App Tour");
  backButton = await screen.findByLabelText("Back");
  await userEvent.click(endTourButton);

  expect(
    // eslint-disable-next-line
    document.querySelector("#react-joyride-portal")
  ).not.toBeInTheDocument();
}, 40000);

test("Dashboard App Tour while editing and then exit", async () => {
  const mockAddDashboard = jest.fn();
  appAPI.addDashboard = mockAddDashboard;
  mockAddDashboard.mockResolvedValue({
    success: true,
    new_dashboard: {
      id: 1,
      name: "new_name",
      label: "New Name",
      notes: "test_notes",
      editable: true,
      accessGroups: [],
      gridItems: [
        {
          i: "1",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "",
          args_string: "{}",
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
      ],
    },
  });
  mockedConfirm.mockResolvedValueOnce(false);
  mockedConfirm.mockResolvedValueOnce(true);

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <LayoutAlertContextProvider>
            <AppTour />
            <DashboardHeader />
            <DashboardLayout />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: { editableDashboard: true, inEditing: true },
    })
  );

  expect(
    // eslint-disable-next-line
    document.querySelector("#react-joyride-portal")
  ).not.toBeInTheDocument();
  expect(await screen.findByLabelText("cancelButton")).toBeInTheDocument();

  ////////////////////
  // App Info Modal //
  ////////////////////
  expect(await screen.findByText("TethysDash Dashboards")).toBeInTheDocument();
  expect(
    await screen.findByText(
      /If you would like to take a tour of the application, click on the button below to begin./i
    )
  ).toBeInTheDocument();
  const startTourButton = await screen.findByText("Start Dashboard Tour");
  expect(startTourButton).toBeInTheDocument();
  userEvent.click(startTourButton);

  /////////////////////////////////////
  // False Confirmation when Editing //
  /////////////////////////////////////
  expect(await screen.findByText("Start Dashboard Tour")).toBeInTheDocument();
  expect(
    screen.queryByText(
      "Begin by clicking on the dropdown to select or create a dashboard."
    )
  ).not.toBeInTheDocument();
  await waitFor(async () => {
    expect(mockedConfirm).toHaveBeenCalledTimes(1);
  });

  //////////////////////////////////////////////
  // Retry and True Confirmation when Editing //
  //////////////////////////////////////////////
  userEvent.click(startTourButton);
  await waitFor(() => {
    expect(screen.queryByText("Start Dashboard Tour")).not.toBeInTheDocument();
  });
  expect(mockedConfirm).toHaveBeenCalledTimes(2);

  /////////////
  // STEP 17 //
  /////////////
  expect(
    await screen.findByText(
      "This is the main layout of the dashboard where dashboards items will be shown."
    )
  ).toBeInTheDocument();
  const closeButton = await screen.findByLabelText("End App Tour");
  await userEvent.click(closeButton);

  expect(
    // eslint-disable-next-line
    document.querySelector("#react-joyride-portal")
  ).not.toBeInTheDocument();
});

test("Landing Page App Tour", async () => {
  let nextButton;
  let endTourButton;
  const mockAddDashboard = jest.fn();
  appAPI.addDashboard = mockAddDashboard;
  mockAddDashboard.mockResolvedValue({
    success: true,
    new_dashboard: {
      id: 1,
      name: "new_name",
      label: "New Name",
      notes: "test_notes",
      editable: true,
      accessGroups: [],
      gridItems: [
        {
          i: "1",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "",
          args_string: "{}",
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
      ],
    },
  });

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <AppTour />
          <LandingPage />
        </MemoryRouter>
      ),
      options: { editableDashboard: true },
    })
  );

  expect(
    // eslint-disable-next-line
    document.querySelector("#react-joyride-portal")
  ).not.toBeInTheDocument();

  ////////////////////
  // App Info Modal //
  ////////////////////
  expect(
    await screen.findByText("TethysDash Landing Page")
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /If you would like to take a tour of the application, click on the button below to begin./i
    )
  ).toBeInTheDocument();
  const startTourButton = await screen.findByText("Start Landing Page Tour");
  expect(startTourButton).toBeInTheDocument();
  userEvent.click(startTourButton);
  await waitFor(() => {
    expect(
      screen.queryByText("Start Landing Page Tour")
    ).not.toBeInTheDocument();
  });

  ////////////
  // STEP 0 //
  ////////////
  expect(
    await screen.findByText(
      "All available user and public dashboards will be displayed on this page."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  await userEvent.click(nextButton);

  ////////////
  // STEP 1 //
  ////////////
  expect(
    await screen.findByText(
      /Dashboard can be created by clicking on the "Create a New Dashboard" card./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /Click on this card to create a new dashboard and continue with the App tour./i
    )
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  const createNewCardButton = await screen.findByLabelText("Create New Card");
  await userEvent.click(createNewCardButton);

  ////////////
  // STEP 2 //
  ////////////
  expect(
    await screen.findByText(
      /This is a modal for creating a new dashboard. Provide a name and a description for your dashboard and then click on "Create"./i
    )
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();

  const closeModalButton = screen.getByLabelText("Close Modal Button");
  await userEvent.click(closeModalButton);

  ////////////
  // STEP 1 //
  ////////////
  expect(
    await screen.findByText(
      /Dashboard can be created by clicking on the "Create a New Dashboard" card./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /Click on this card to create a new dashboard and continue with the App tour./i
    )
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  await userEvent.click(createNewCardButton);

  ////////////
  // STEP 2 //
  ////////////
  expect(
    await screen.findByText(
      /This is a modal for creating a new dashboard. Provide a name and a description for your dashboard and then click on "Create"./i
    )
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();

  const nameInput = screen.getByLabelText("Name Input");
  const descriptionInput = screen.getByLabelText("Description Input");
  fireEvent.change(nameInput, { target: { value: "Some New Name" } });
  fireEvent.change(descriptionInput, {
    target: { value: "Some new Description" },
  });
  const createDashboardButton = screen.getByLabelText(
    "Create Dashboard Button"
  );
  await userEvent.click(createDashboardButton);

  ////////////
  // STEP 3 //
  ////////////
  expect(
    await screen.findByText(
      "Each card in the landing page represents a dashboard and its information."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  await userEvent.click(nextButton);

  ////////////
  // STEP 4 //
  ////////////
  expect(
    await screen.findByText(
      /Card icons will indicate ownership and public availability./i
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(await screen.findByLabelText("Back")).toBeInTheDocument();
  await userEvent.click(nextButton);

  ////////////
  // STEP 5 //
  ////////////
  expect(
    await screen.findByText("Dashboard names are displayed in the card header.")
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(await screen.findByLabelText("Back")).toBeInTheDocument();
  await userEvent.click(nextButton);

  ////////////
  // STEP 6 //
  ////////////
  expect(
    await screen.findByText(
      "Thumbnails provide an image representing the dashboard. Hover over the card body to see the description of the dashboard."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(await screen.findByLabelText("Back")).toBeInTheDocument();
  await userEvent.click(nextButton);

  ////////////
  // STEP 7 //
  ////////////
  expect(
    await screen.findByText(
      /Additional dashboard options and interactions are available through the card context menu./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /Click on the context menu to see additional options./i
    )
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  const contextMenuButton = await screen.findAllByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton[0]);

  ////////////
  // STEP 8 //
  ////////////
  expect(
    await screen.findByText(
      "Open and view the dashboard. You can also double click on the card to open the dashboard."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  await userEvent.click(nextButton);

  ////////////
  // STEP 9 //
  ////////////
  expect(
    await screen.findByText(
      "Rename the dashboard. This will also update any public urls tied to this dashboard."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(await screen.findByLabelText("Back")).toBeInTheDocument();
  await userEvent.click(nextButton);

  /////////////
  // STEP 10 //
  /////////////
  expect(
    await screen.findByText("Update the description of the dashboard.")
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(await screen.findByLabelText("Back")).toBeInTheDocument();
  await userEvent.click(nextButton);

  /////////////
  // STEP 11 //
  /////////////
  expect(
    await screen.findByText("Update the thumbnail of the dashboard.")
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(await screen.findByLabelText("Back")).toBeInTheDocument();
  await userEvent.click(nextButton);

  /////////////
  // STEP 12 //
  /////////////
  expect(
    await screen.findByText(
      "Update the sharing status of the dashboard or copy the public link for the dashboard if it is public."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(await screen.findByLabelText("Back")).toBeInTheDocument();
  await userEvent.click(nextButton);

  /////////////
  // STEP 13 //
  /////////////
  expect(
    await screen.findByText(
      /Copy with the same settings and dashboard items. The new dashboard will have the name with "_copy" at the end./i
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(await screen.findByLabelText("Back")).toBeInTheDocument();
  await userEvent.click(nextButton);

  /////////////
  // STEP 14 //
  /////////////
  expect(
    await screen.findByText(
      "Delete the dashboard. This action cannot be undone."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  await userEvent.click(nextButton);

  /////////////
  // STEP 15 //
  /////////////
  expect(
    await screen.findByText(/For more information about TethysDash, visit the/i)
  ).toBeInTheDocument();
  expect(
    await screen.findByText(/TethysDash documentation/i)
  ).toBeInTheDocument();
  expect(
    await screen.findByText(/. Please follow instructions found in the/i)
  ).toBeInTheDocument();
  expect(await screen.findByText(/feedback/i)).toBeInTheDocument();
  expect(
    await screen.findByText(/sessions for reporting any bugs or issues./i)
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  endTourButton = await screen.findByLabelText("End App Tour");
  await userEvent.click(endTourButton);

  expect(
    // eslint-disable-next-line
    document.querySelector("#react-joyride-portal")
  ).not.toBeInTheDocument();
}, 40000);
