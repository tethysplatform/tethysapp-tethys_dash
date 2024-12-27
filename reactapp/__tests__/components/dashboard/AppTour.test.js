import { act } from "react";
import userEvent from "@testing-library/user-event";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import Header from "components/layout/Header";
import DashboardLayout from "components/dashboard/DashboardLayout";
import AppTour from "components/dashboard/AppTour";
import { MemoryRouter } from "react-router-dom";
import renderWithLoaders from "__tests__/utilities/customRender";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import appAPI from "services/api/app";
import { confirm } from "components/dashboard/DeleteConfirmation";

jest.mock("components/dashboard/DeleteConfirmation", () => {
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

test("App Tour skip steps 3", async () => {
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

  renderWithLoaders({
    children: (
      <MemoryRouter initialEntries={["/"]}>
        <LayoutAlertContextProvider>
          <AppTour />
          <Header />
          <DashboardLayout />
        </LayoutAlertContextProvider>
      </MemoryRouter>
    ),
  });

  expect(
    // eslint-disable-next-line
    document.querySelector("#react-joyride-portal")
  ).not.toBeInTheDocument();

  ////////////////////
  // App Info Modal //
  ////////////////////
  expect(await screen.findByText("Welcome to TethysDash")).toBeInTheDocument();
  expect(
    await screen.findByText(
      /If you would like to take a tour of the application, click on the button below to begin./i
    )
  ).toBeInTheDocument();
  const startTourButton = await screen.findByText("Start App Tour");
  expect(startTourButton).toBeInTheDocument();
  userEvent.click(startTourButton);
  await waitFor(() => {
    expect(screen.queryByText("Start App Tour")).not.toBeInTheDocument();
  });

  ////////////
  // STEP 0 //
  ////////////
  expect(
    await screen.findByText(
      "Begin by clicking on the dropdown to select or create a dashboard."
    )
  ).toBeInTheDocument();
  // eslint-disable-next-line
  expect(document.querySelector("#react-joyride-portal")).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  const selector = await screen.findByRole("combobox");
  expect(selector).toBeInTheDocument();
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(selector);
  });

  ////////////
  // STEP 1 //
  ////////////
  expect(
    await screen.findByText(
      'Select an existing dashboard to view or create a new dashboard with the "Create a New Dashboard" option.'
    )
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  const newDashboardOption = await screen.findByText("Create a New Dashboard");
  expect(newDashboardOption).toBeInTheDocument();
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(newDashboardOption);
  });

  ////////////
  // STEP 2 //
  ////////////
  expect(
    await screen.findByText('Enter the dashboard name and select "Create".')
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  const dashboardNameInput = await screen.findByLabelText(
    "Dashboard Name Input"
  );
  fireEvent.change(dashboardNameInput, { target: { value: "new_name" } });
  const createDashboardInput = await screen.findByLabelText(
    "Create Dashboard Button"
  );
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(createDashboardInput);
  });
  await waitFor(() => {
    expect(
      screen.queryByLabelText("Create Dashboard Button")
    ).not.toBeInTheDocument();
  });

  ////////////
  // STEP 4 //
  ////////////
  expect(
    await screen.findByText(
      "This is the main layout of the dashboard where dashboards items will be shown."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(nextButton);
  });

  ////////////
  // STEP 5 //
  ////////////
  expect(
    await screen.findByText(
      "Dashboards are composed of dashboard items. Each dashboard item can be customized to show visualizations and be changed in size to the users liking. Dashboards and items can only be changed by the dashboard owner and when the dashboard is in edit mode."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(backButton);
  });

  ////////////
  // STEP 4 //
  ////////////
  expect(
    await screen.findByText(
      "This is the main layout of the dashboard where dashboards items will be shown."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(nextButton);
  });

  ////////////
  // STEP 5 //
  ////////////
  expect(
    await screen.findByText(
      "Dashboards are composed of dashboard items. Each dashboard item can be customized to show visualizations and be changed in size to the users liking. Dashboards and items can only be changed by the dashboard owner and when the dashboard is in edit mode."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(nextButton);
  });

  ////////////
  // STEP 6 //
  ////////////
  expect(
    await screen.findByText("Click on the edit button to turn on edit mode.")
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  const dashboardEditButton = await screen.findByLabelText("editButton");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dashboardEditButton);
  });

  ////////////
  // STEP 7 //
  ////////////
  expect(
    await screen.findByText(
      "Once in edit mode, update the size of a dashboard item by dragging the resize handle."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(nextButton);
  });

  ////////////
  // STEP 8 //
  ////////////
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
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dashboardItemDropdownToggle);
  });

  ////////////
  // STEP 9 //
  ////////////
  expect(
    await screen.findByText(
      /Editing the visualization will change the dashboard visualization as well as any dashboard item settings./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /Click on "Edit Visualization" in the menu to learn more or continue the App Tour by clicking on "Next"./i
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  const editGridItemButton = await screen.findByText("Edit Visualization");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(editGridItemButton);
  });

  //////////////////////////
  // STEP 17 - DATAVIEWER //
  //////////////////////////
  expect(
    await screen.findByText(
      "This is a modal for configuring and previewing visualizations."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(nextButton);
  });

  //////////////////////////
  // STEP 18 - DATAVIEWER //
  //////////////////////////
  expect(
    await screen.findByText(
      "The visualization tab will show options for configuring the visualization and any visualization arguments."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(nextButton);
  });

  //////////////////////////
  // STEP 19 - DATAVIEWER //
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
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(nextButton);
  });

  //////////////////////////
  // STEP 20 - DATAVIEWER //
  //////////////////////////
  expect(
    await screen.findByText(
      /The settings tab will show options for configuring any dashboard item settings. Setting options will not be available until a visualization is configured and in the preview./i
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(nextButton);
  });

  //////////////////////////
  // STEP 21 - DATAVIEWER //
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
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(nextButton);
  });

  //////////////////////////
  // STEP 22 - DATAVIEWER //
  //////////////////////////
  expect(
    await screen.findByText(
      /After the visualization is configured correctly, click on the "Save" button to exit the data viewer and save any changes to the dashboard item./i
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(nextButton);
  });

  //////////////////////////
  // STEP 23 - DATAVIEWER //
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
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(closeDataviewer);
  });

  /////////////
  // STEP 10 //
  /////////////
  expect(
    await screen.findByText(
      "Create a copy of the existing dashboard item. This will copy the visualization and any settings."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(backButton);
  });

  ////////////
  // STEP 9 //
  ////////////
  expect(
    await screen.findByText(
      /Editing the visualization will change the dashboard visualization as well as any dashboard item settings./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /Click on "Edit Visualization" in the menu to learn more or continue the App Tour by clicking on "Next"./i
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(nextButton);
  });

  /////////////
  // STEP 10 //
  /////////////
  expect(
    await screen.findByText(
      "Create a copy of the existing dashboard item. This will copy the visualization and any settings."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(nextButton);
  });

  /////////////
  // STEP 11 //
  /////////////
  expect(
    await screen.findByText(
      "Deleting the dashboard item will remove it from the dashboard layout."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(nextButton);
  });

  /////////////
  // STEP 12 //
  /////////////
  expect(
    await screen.findByText(
      "Click on the revert changes button to cancel any changes made and return the layout to the latest saved version."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(nextButton);
  });

  /////////////
  // STEP 13 //
  /////////////
  expect(
    await screen.findByText(
      "Click on the save changes button to save any changes made and persist for later sessions."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(nextButton);
  });

  /////////////
  // STEP 14 //
  /////////////
  expect(
    await screen.findByText(
      "Click on the add dashboard items button to add new dashboard items to the layout."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(nextButton);
  });

  /////////////
  // STEP 15 //
  /////////////
  expect(
    await screen.findByText(
      /Each dashboard has general settings like names, labels, sharing status, and notes. These settings, as well as copying and deleting dashboard actions, can be found in this menu./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /Click on the hamburger menu to learn more about dashboard settings./i
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  const dashboardSettingButton = await screen.findByLabelText(
    "dashboardSettingButton"
  );
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dashboardSettingButton);
  });

  ////////////////////////////////
  // STEP 24 - DASHBOARD EDITOR //
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
      /The name of dashboard. This will be the name in the url of a public dashboard./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /The label for the dashboard that will show in the Dashboard selection dropdown./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /Determines if the dashboard is publicly available./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /Write and persist any text for future reference. These notes are publicly viewable if the dashboard is public./i
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(nextButton);
  });

  ////////////////////////////////
  // STEP 25 - DASHBOARD EDITOR //
  ////////////////////////////////
  expect(
    await screen.findByText("Persist dashboard setting changes by saving them.")
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(nextButton);
  });

  ////////////////////////////////
  // STEP 26 - DASHBOARD EDITOR //
  ////////////////////////////////
  expect(
    await screen.findByText(
      "Dashboards can be deleted. Once deleted, they can not be retrieved again."
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(nextButton);
  });

  ////////////////////////////////
  // STEP 27 - DASHBOARD EDITOR //
  ////////////////////////////////
  expect(
    await screen.findByText(
      'Dashboards can be copied with the same settings and dashboard items. The new dashboard will have the name with "_copy" at the end.'
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(nextButton);
  });

  ////////////////////////////////
  // STEP 28 - DASHBOARD EDITOR //
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
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(cancelDashboardEditorButton);
  });

  /////////////
  // STEP 16 //
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
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(backButton);
  });

  /////////////
  // STEP 15 //
  /////////////
  expect(
    await screen.findByText(
      /Each dashboard has general settings like names, labels, sharing status, and notes. These settings, as well as copying and deleting dashboard actions, can be found in this menu./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /Click on the hamburger menu to learn more about dashboard settings./i
    )
  ).toBeInTheDocument();
  nextButton = await screen.findByLabelText("Next");
  backButton = await screen.findByLabelText("Back");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(nextButton);
  });

  /////////////
  // STEP 16 //
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
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(endTourButton);
  });

  expect(
    // eslint-disable-next-line
    document.querySelector("#react-joyride-portal")
  ).not.toBeInTheDocument();
}, 20000);

test("App Tour skip to step 3", async () => {
  let dashboardNameInput;
  let createDashboardInput;
  const mockAddDashboard = jest.fn();
  appAPI.addDashboard = mockAddDashboard;
  mockAddDashboard
    .mockResolvedValueOnce({
      success: false,
    })
    .mockResolvedValueOnce({
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

  renderWithLoaders({
    children: (
      <MemoryRouter initialEntries={["/"]}>
        <LayoutAlertContextProvider>
          <AppTour />
          <Header />
          <DashboardLayout />
        </LayoutAlertContextProvider>
      </MemoryRouter>
    ),
  });

  expect(
    // eslint-disable-next-line
    document.querySelector("#react-joyride-portal")
  ).not.toBeInTheDocument();

  ////////////////////
  // App Info Modal //
  ////////////////////
  expect(await screen.findByText("Welcome to TethysDash")).toBeInTheDocument();
  expect(
    await screen.findByText(
      /If you would like to take a tour of the application, click on the button below to begin./i
    )
  ).toBeInTheDocument();
  const startTourButton = await screen.findByText("Start App Tour");
  expect(startTourButton).toBeInTheDocument();
  userEvent.click(startTourButton);
  await waitFor(() => {
    expect(screen.queryByText("Start App Tour")).not.toBeInTheDocument();
  });

  ////////////
  // STEP 0 //
  ////////////
  expect(
    await screen.findByText(
      "Begin by clicking on the dropdown to select or create a dashboard."
    )
  ).toBeInTheDocument();
  // eslint-disable-next-line
  expect(document.querySelector("#react-joyride-portal")).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  const selector = await screen.findByRole("combobox");
  expect(selector).toBeInTheDocument();
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(selector);
  });

  ////////////
  // STEP 1 //
  ////////////
  expect(
    await screen.findByText(
      'Select an existing dashboard to view or create a new dashboard with the "Create a New Dashboard" option.'
    )
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  const newDashboardOption = await screen.findByText("Create a New Dashboard");
  expect(newDashboardOption).toBeInTheDocument();
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(newDashboardOption);
  });

  ////////////
  // STEP 2 //
  ////////////
  expect(
    await screen.findByText('Enter the dashboard name and select "Create".')
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  dashboardNameInput = await screen.findByLabelText("Dashboard Name Input");
  fireEvent.change(dashboardNameInput, { target: { value: "editable" } });
  createDashboardInput = await screen.findByLabelText(
    "Create Dashboard Button"
  );
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(createDashboardInput);
  });

  ////////////
  // STEP 3 //
  ////////////
  expect(
    await screen.findByText(
      'The dashboard name is already used. Try to update the dashboard name and select "Create" again.'
    )
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  dashboardNameInput = await screen.findByLabelText("Dashboard Name Input");
  fireEvent.change(dashboardNameInput, { target: { value: "new_name" } });
  createDashboardInput = await screen.findByLabelText(
    "Create Dashboard Button"
  );
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(createDashboardInput);
  });
  await waitFor(() => {
    expect(
      screen.queryByLabelText("Create Dashboard Button")
    ).not.toBeInTheDocument();
  });

  ////////////
  // STEP 4 //
  ////////////
  expect(
    await screen.findByText(
      "This is the main layout of the dashboard where dashboards items will be shown."
    )
  ).toBeInTheDocument();

  const closeButton = await screen.findByLabelText("Close");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(closeButton);
  });

  expect(
    // eslint-disable-next-line
    document.querySelector("#react-joyride-portal")
  ).not.toBeInTheDocument();
}, 10000);

test("App Tour from header and select existing dashboard", async () => {
  let selector;
  let existingDashboardOption;
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

  renderWithLoaders({
    children: (
      <MemoryRouter initialEntries={["/"]}>
        <LayoutAlertContextProvider>
          <AppTour />
          <Header />
          <DashboardLayout />
        </LayoutAlertContextProvider>
      </MemoryRouter>
    ),
  });

  expect(
    // eslint-disable-next-line
    document.querySelector("#react-joyride-portal")
  ).not.toBeInTheDocument();

  ////////////////////
  // App Info Modal //
  ////////////////////
  expect(await screen.findByText("Welcome to TethysDash")).toBeInTheDocument();
  expect(
    await screen.findByText(
      /If you would like to take a tour of the application, click on the button below to begin./i
    )
  ).toBeInTheDocument();
  const closeButton = await screen.findByLabelText("Close");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(closeButton);
  });

  //////////////////////
  // Main Application //
  //////////////////////
  expect(
    // eslint-disable-next-line
    document.querySelector("#react-joyride-portal")
  ).not.toBeInTheDocument();

  ////////////////////////////////////////
  // Select Existing Dashboard and Edit //
  ////////////////////////////////////////
  selector = await screen.findByRole("combobox");
  expect(selector).toBeInTheDocument();
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(selector);
  });
  existingDashboardOption = await screen.findByText("test_label");
  expect(existingDashboardOption).toBeInTheDocument();
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(existingDashboardOption);
  });
  const dashboardEditButton = await screen.findByLabelText("editButton");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dashboardEditButton);
  });

  /////////////////////////
  // Open App Info Modal //
  /////////////////////////
  const appInfoButton = await screen.findByLabelText("appInfoButton");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(appInfoButton);
  });

  ////////////////////
  // App Info Modal //
  ////////////////////
  expect(await screen.findByText("Welcome to TethysDash")).toBeInTheDocument();
  expect(
    await screen.findByText(
      /If you would like to take a tour of the application, click on the button below to begin./i
    )
  ).toBeInTheDocument();
  const startTourButton = await screen.findByText("Start App Tour");
  expect(startTourButton).toBeInTheDocument();
  userEvent.click(startTourButton);

  /////////////////////////////////////
  // False Confirmation when Editing //
  /////////////////////////////////////
  expect(await screen.findByText("Start App Tour")).toBeInTheDocument();
  expect(
    screen.queryByText(
      "Begin by clicking on the dropdown to select or create a dashboard."
    )
  ).not.toBeInTheDocument();

  //////////////////////////////////////////////
  // Retry and True Confirmation when Editing //
  //////////////////////////////////////////////
  userEvent.click(startTourButton);
  await waitFor(() => {
    expect(screen.queryByText("Start App Tour")).not.toBeInTheDocument();
  });

  ////////////
  // STEP 0 //
  ////////////
  expect(
    await screen.findByText(
      "Begin by clicking on the dropdown to select or create a dashboard."
    )
  ).toBeInTheDocument();
  // eslint-disable-next-line
  expect(document.querySelector("#react-joyride-portal")).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  selector = await screen.findByRole("combobox");
  expect(selector).toBeInTheDocument();
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(selector);
  });

  ////////////
  // STEP 1 //
  ////////////
  expect(
    await screen.findByText(
      'Select an existing dashboard to view or create a new dashboard with the "Create a New Dashboard" option.'
    )
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  existingDashboardOption = await screen.findByText("test_label");
  expect(existingDashboardOption).toBeInTheDocument();
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(existingDashboardOption);
  });

  ////////////
  // STEP 4 //
  ////////////
  expect(
    await screen.findByText(
      "This is the main layout of the dashboard where dashboards items will be shown."
    )
  ).toBeInTheDocument();
  expect(await screen.findByLabelText("Next")).toBeInTheDocument();
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
});
