import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { LandingPageHeader, DashboardHeader } from "components/layout/Header";
import { MemoryRouter } from "react-router-dom";
import createLoadedComponent, {
  DisabledMovementPComponent,
} from "__tests__/utilities/customRender";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import userEvent from "@testing-library/user-event";
import DashboardLayout from "components/dashboard/DashboardLayout";
import DashboardLayoutAlerts from "components/dashboard/DashboardLayoutAlerts";
import appAPI from "services/api/app";
import html2canvas from "html2canvas";
import { useNavigate } from "react-router-dom";
import { AppTourContext } from "components/contexts/Contexts";
import {
  mockedDashboards,
  mockedTextVariable,
} from "__tests__/utilities/constants";

jest.mock("html2canvas");

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: jest.fn(),
}));

window.matchMedia =
  window.matchMedia ||
  function () {
    return {
      matches: false,
      addListener: function () {},
      removeListener: function () {},
    };
  };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("LandingPageHeader, staff user", async () => {
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <LandingPageHeader />
        </MemoryRouter>
      ),
    })
  );

  expect(await screen.findByLabelText("appExitButton")).toBeInTheDocument();
  expect(screen.getByText("Available Dashboards")).toBeInTheDocument();
  expect(screen.getByLabelText("appSettingButton")).toBeInTheDocument();
  expect(screen.getByLabelText("appInfoButton")).toBeInTheDocument();
});

test("LandingPageHeader, non staff user", async () => {
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <LandingPageHeader />
        </MemoryRouter>
      ),
      options: {
        user: { username: "jsmith", isAuthenticated: true, isStaff: false },
      },
    })
  );

  expect(await screen.findByLabelText("appExitButton")).toBeInTheDocument();
  expect(screen.getByText("Available Dashboards")).toBeInTheDocument();
  expect(screen.queryByLabelText("appSettingButton")).not.toBeInTheDocument();
  expect(screen.getByLabelText("appInfoButton")).toBeInTheDocument();
  expect(screen.getByLabelText("importDashboardButton")).toBeInTheDocument();
});

test("LandingPageHeader, no user", async () => {
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <LandingPageHeader />
        </MemoryRouter>
      ),
      options: {
        user: { username: null, isAuthenticated: true, isStaff: false },
      },
    })
  );

  const proceedWithoutSigningInButton = await screen.findByText(
    "Proceed Without Signing in"
  );
  await userEvent.click(proceedWithoutSigningInButton);

  expect(await screen.findByLabelText("appExitButton")).toBeInTheDocument();
  expect(screen.getByText("Available Dashboards")).toBeInTheDocument();
  expect(screen.queryByLabelText("appSettingButton")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("appInfoButton")).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("importDashboardButton")
  ).not.toBeInTheDocument();
});

test("LandingPageHeader, signin", async () => {
  delete window.location; // Remove existing location object
  window.location = { assign: jest.fn() }; // Mock location.assign

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <LayoutAlertContextProvider>
            <LandingPageHeader />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: {
        user: { username: null, isAuthenticated: true, isStaff: false },
      },
    })
  );

  const proceedWithoutSigningInButton = await screen.findByText(
    "Proceed Without Signing in"
  );
  await userEvent.click(proceedWithoutSigningInButton);

  const dashboardLoginButton = await screen.findByLabelText(
    "dashboardLoginButton"
  );
  await userEvent.click(dashboardLoginButton);
  expect(window.location.assign).toHaveBeenCalledWith(
    "http://api.test/accounts/login?next=undefined"
  );
});

test("LandingPageHeader, import dashboard", async () => {
  const importedDashboard = {
    name: "Test",
    description: "this is a new description",
  };
  const mockAddDashboard = jest.fn();
  appAPI.addDashboard = mockAddDashboard;
  mockAddDashboard.mockResolvedValue({
    success: true,
    new_dashboard: {
      id: 1,
      name: "Test",
      description: "this is a new description",
      notes: "",
      editable: true,
      accessGroups: [],
      gridItems: [],
    },
  });

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <LayoutAlertContextProvider>
            <LandingPageHeader />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: {
        user: { username: "jsmith", isAuthenticated: true, isStaff: true },
      },
    })
  );

  const importDashboardButton = await screen.findByLabelText(
    "importDashboardButton"
  );
  await userEvent.click(importDashboardButton);
  expect(
    await screen.findByLabelText("Dashboard Import Modal")
  ).toBeInTheDocument();

  const file = new File([JSON.stringify(importedDashboard)], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  const importButton = screen.getByLabelText("Import Button");
  await waitFor(() => expect(importButton).not.toBeDisabled());
  await userEvent.click(importButton);

  expect(mockAddDashboard).toHaveBeenCalledWith(
    importedDashboard,
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );
});

test("LandingPageHeader, show info", async () => {
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <LayoutAlertContextProvider>
            <LandingPageHeader />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: {
        user: { username: "jsmith", isAuthenticated: true, isStaff: true },
      },
    })
  );

  const appInfoButton = await screen.findByLabelText("appInfoButton");
  await userEvent.click(appInfoButton);
  expect(screen.getByLabelText("App Info Modal")).toBeInTheDocument();
});

test("LandingPageHeader, public user and not show info", async () => {
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <LandingPageHeader />
        </MemoryRouter>
      ),
      options: {
        user: { username: null, isAuthenticated: true, isStaff: false },
      },
    })
  );

  const proceedWithoutSigningInButton = await screen.findByText(
    "Proceed Without Signing in"
  );
  await userEvent.click(proceedWithoutSigningInButton);

  expect(await screen.findByLabelText("appExitButton")).toBeInTheDocument();
  expect(screen.getByText("Available Dashboards")).toBeInTheDocument();
  expect(screen.queryByLabelText("appSettingButton")).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("importDashboardButton")
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText("appInfoButton")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "dashboardLoginButton" })
  ).toBeInTheDocument();
  expect(screen.getByLabelText("appExitButton")).toBeInTheDocument();
});

test("DashboardHeader, user and editable", async () => {
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: {
        editableDashboard: true,
      },
    })
  );

  expect(
    await screen.findByLabelText("dashboardExitButton")
  ).toBeInTheDocument();
  expect(screen.getByLabelText("editButton")).toBeInTheDocument();
  expect(screen.getByLabelText("appInfoButton")).toBeInTheDocument();
  expect(
    screen.queryByLabelText("dashboardLoginButton")
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("dashboardSettingButton")).toBeInTheDocument();
});

test("DashboardHeader, user and not editable", async () => {
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: {
        editableDashboard: false,
      },
    })
  );

  expect(
    await screen.findByLabelText("dashboardExitButton")
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("editButton")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("appInfoButton")).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("dashboardLoginButton")
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("dashboardSettingButton")).toBeInTheDocument();
});

test("DashboardHeader, no user", async () => {
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: {
        user: { username: null, isAuthenticated: true, isStaff: false },
      },
    })
  );

  const proceedWithoutSigningInButton = await screen.findByText(
    "Proceed Without Signing in"
  );
  await userEvent.click(proceedWithoutSigningInButton);

  expect(
    await screen.findByLabelText("dashboardExitButton")
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("editButton")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("appInfoButton")).not.toBeInTheDocument();
  expect(screen.getByLabelText("dashboardLoginButton")).toBeInTheDocument();
  expect(screen.getByLabelText("dashboardSettingButton")).toBeInTheDocument();
});

test("DashboardHeader, show info", async () => {
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: {
        user: { isAuthenticated: true, isStaff: false },
        editableDashboard: true,
      },
    })
  );

  const appInfoButton = await screen.findByLabelText("appInfoButton");
  await userEvent.click(appInfoButton);
  expect(screen.getByLabelText("App Info Modal")).toBeInTheDocument();
});

test("DashboardHeader, import gridItem", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.user[0];
  mockedDashboard.gridItems = [
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
  ];

  const mockUpdateDashboard = jest.fn();
  mockUpdateDashboard.mockResolvedValue({
    success: true,
    updated_dashboard: {
      id: 1,
      name: "some dashboard updated",
      description: "some description",
      accessGroups: ["public"],
      image: "some_image.png",
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
        mockedTextVariable,
      ],
    },
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  jest
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockImplementation(() => ({
      width: 100,
      height: 100,
    }));

  const mockCanvas = document.createElement("canvas");
  mockCanvas.toDataURL = jest.fn(() => "data:image/png;base64,mocked-image");
  html2canvas.mockResolvedValue(mockCanvas);

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
            <DashboardLayout />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: {
        user: { isAuthenticated: true, isStaff: false },
        editableDashboard: true,
        dashboards: updatedMockedDashboards,
      },
    })
  );

  const editButton = await screen.findByLabelText("editButton");
  await userEvent.click(editButton);

  const importDashboardItemButton = await screen.findByLabelText(
    "importDashboardItemButton"
  );
  await userEvent.click(importDashboardItemButton);
  expect(
    await screen.findByLabelText("Dashboard Import Modal")
  ).toBeInTheDocument();

  const file = new File(
    [
      JSON.stringify({
        i: "1",
        x: 0,
        y: 0,
        w: 20,
        h: 20,
        source: "Variable Input",
        args_string: {
          initial_value: "",
          variable_name: "Test Variable",
          variable_options_source: "text",
          variable_input_type: "text",
        },
        metadata_string: {
          refreshRate: 0,
        },
      }),
    ],
    "test-file.json",
    {
      type: "text/plain",
    }
  );
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  const importButton = screen.getByLabelText("Import Button");
  await waitFor(() => expect(importButton).not.toBeDisabled());
  await userEvent.click(importButton);

  const saveButton = await screen.findByLabelText("saveButton");
  await userEvent.click(saveButton);

  await waitFor(() => {
    expect(mockUpdateDashboard).toHaveBeenCalledWith(
      {
        gridItems: [
          {
            i: "2",
            x: 0,
            y: 0,
            w: 20,
            h: 20,
            source: "Variable Input",
            args_string: JSON.stringify({
              initial_value: "",
              variable_name: "Test Variable",
              variable_options_source: "text",
              variable_input_type: "text",
            }),
            metadata_string: JSON.stringify({
              refreshRate: 0,
            }),
          },
          {
            i: "1",
            x: 0,
            y: 20,
            w: 20,
            h: 20,
            source: "",
            args_string: "{}",
            metadata_string: JSON.stringify({
              refreshRate: 0,
            }),
          },
        ],
        id: 1,
        image: "data:image/png;base64,mocked-image",
      },
      "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
    );
  });
});

test("DashboardHeader, signin", async () => {
  delete window.location; // Remove existing location object
  window.location = { assign: jest.fn() }; // Mock location.assign

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: {
        user: { username: null, isAuthenticated: true, isStaff: false },
        editableDashboard: true,
      },
    })
  );

  const proceedWithoutSigningInButton = await screen.findByText(
    "Proceed Without Signing in"
  );
  await userEvent.click(proceedWithoutSigningInButton);

  const dashboardLoginButton = await screen.findByLabelText(
    "dashboardLoginButton"
  );
  await userEvent.click(dashboardLoginButton);
  expect(window.location.assign).toHaveBeenCalledWith(
    "http://api.test/accounts/login?next=undefined"
  );
});

test("DashboardHeader, not editable, no show info", async () => {
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: {
        user: { isAuthenticated: true, isStaff: false },
      },
    })
  );

  expect(
    await screen.findByLabelText("dashboardExitButton")
  ).toBeInTheDocument();
  expect(
    await screen.findByLabelText("dashboardSettingButton")
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("appInfoButton")).not.toBeInTheDocument();
});

test("DashboardHeader, show settings", async () => {
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
            <DashboardLayout />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: {
        user: { isAuthenticated: true, isStaff: false },
        editableDashboard: true,
      },
    })
  );

  const dashboardSettingButton = await screen.findByLabelText(
    "dashboardSettingButton"
  );
  await userEvent.click(dashboardSettingButton);
  expect(await screen.findByText("Dashboard Settings")).toBeInTheDocument();
});

test("DashboardHeader, show settings in App Tour", async () => {
  const mockSetAppTourStep = jest.fn();
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <AppTourContext.Provider
            value={{
              activeAppTour: true,
              setAppTourStep: mockSetAppTourStep,
            }}
          >
            <LayoutAlertContextProvider>
              <DashboardHeader />
              <DashboardLayout />
            </LayoutAlertContextProvider>
          </AppTourContext.Provider>
        </MemoryRouter>
      ),
      options: {
        user: { isAuthenticated: true, isStaff: false },
        editableDashboard: true,
      },
    })
  );

  const dashboardSettingButton = await screen.findByLabelText(
    "dashboardSettingButton"
  );
  await userEvent.click(dashboardSettingButton);
  expect(await screen.findByText("Dashboard Settings")).toBeInTheDocument();
  await waitFor(() => {
    expect(mockSetAppTourStep).toHaveBeenCalledWith(41);
  });
});

test("DashboardHeader, editable, lock movement", async () => {
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
            <DashboardLayout />
          </LayoutAlertContextProvider>
          <DisabledMovementPComponent />
        </MemoryRouter>
      ),
      options: { editableDashboard: true },
    })
  );

  expect(
    await screen.findByLabelText("dashboardExitButton")
  ).toBeInTheDocument();

  const editButton = await screen.findByLabelText("editButton");
  expect(await screen.findByText("editable")).toBeInTheDocument();
  expect(editButton).toBeInTheDocument();
  expect(screen.getByLabelText("appInfoButton")).toBeInTheDocument();
  expect(screen.getByLabelText("dashboardSettingButton")).toBeInTheDocument();

  await userEvent.click(editButton);

  const disableMovementButton = await screen.findByLabelText(
    "Disable Movement Button"
  );
  expect(disableMovementButton).toBeInTheDocument();

  expect(await screen.findByTestId("disabledMovement")).toHaveTextContent(
    "allowed movement"
  );

  await userEvent.click(disableMovementButton);

  expect(await screen.findByTestId("disabledMovement")).toHaveTextContent(
    "disabled movement"
  );
});

test("DashboardHeader, not editable and return to landing page", async () => {
  const navigateMock = jest.fn();
  useNavigate.mockReturnValue(navigateMock);

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
    })
  );

  const dashboardExitButton = await screen.findByLabelText(
    "dashboardExitButton"
  );
  expect(dashboardExitButton).toBeInTheDocument();
  expect(await screen.findByText("editable")).toBeInTheDocument();
  expect(screen.queryByLabelText("editButton")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("appInfoButton")).not.toBeInTheDocument();
  expect(screen.getByLabelText("dashboardSettingButton")).toBeInTheDocument();

  await userEvent.click(dashboardExitButton);
  expect(navigateMock).toHaveBeenCalledWith("/");
});

test("DashboardHeader, editable, edit in app tour", async () => {
  const mockSetAppTourStep = jest.fn();
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <AppTourContext.Provider
            value={{
              activeAppTour: true,
              setAppTourStep: mockSetAppTourStep,
            }}
          >
            <LayoutAlertContextProvider>
              <DashboardHeader />
              <DashboardLayout />
            </LayoutAlertContextProvider>
          </AppTourContext.Provider>
        </MemoryRouter>
      ),
      options: { editableDashboard: true },
    })
  );

  const editButton = await screen.findByLabelText("editButton");
  await userEvent.click(editButton);

  await waitFor(() => {
    expect(mockSetAppTourStep).toHaveBeenCalled();
  });
});

test("DashboardHeader, editable, edit and cancel", async () => {
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
            <DashboardLayout />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: { editableDashboard: true },
    })
  );

  expect(
    await screen.findByLabelText("dashboardExitButton")
  ).toBeInTheDocument();

  const editButton = await screen.findByLabelText("editButton");
  expect(await screen.findByText("editable")).toBeInTheDocument();
  expect(editButton).toBeInTheDocument();
  expect(screen.getByLabelText("appInfoButton")).toBeInTheDocument();
  expect(screen.getByLabelText("dashboardSettingButton")).toBeInTheDocument();

  await userEvent.click(editButton);

  const cancelButton = await screen.findByLabelText("cancelButton");
  expect(cancelButton).toBeInTheDocument();
  expect(screen.getByLabelText("saveButton")).toBeInTheDocument();
  const addGridItemButton = await screen.findByLabelText("addGridItemButton");
  expect(addGridItemButton).toBeInTheDocument();
  expect(screen.getByLabelText("Disable Movement Button")).toBeInTheDocument();
  expect(screen.queryByLabelText("editButton")).not.toBeInTheDocument();

  let gridItems = await screen.findAllByLabelText("gridItem");
  expect(gridItems.length).toBe(1);

  await userEvent.click(addGridItemButton);

  gridItems = await screen.findAllByLabelText("gridItem");
  await waitFor(() => {
    expect(gridItems.length).toBe(2);
  });

  await userEvent.click(cancelButton);
  await sleep(200);

  gridItems = await screen.findAllByLabelText("gridItem");
  await waitFor(() => {
    expect(gridItems.length).toBe(1);
  });
});

test("DashboardHeader, editable, edit and save", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.user[0];
  mockedDashboard.gridItems = [
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
    {
      i: "3",
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
    {
      i: "2",
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
  ];

  const mockUpdateDashboard = jest.fn();
  mockUpdateDashboard.mockResolvedValue({
    success: true,
    updated_dashboard: {
      id: 1,
      name: "some dashboard updated",
      description: "some description",
      accessGroups: ["public"],
      image: "some_image.png",
      gridItems: [
        {
          i: "4",
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
        {
          i: "3",
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
        {
          i: "2",
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
  appAPI.updateDashboard = mockUpdateDashboard;

  jest
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockImplementation(() => ({
      width: 100,
      height: 100,
    }));

  const mockCanvas = document.createElement("canvas");
  mockCanvas.toDataURL = jest.fn(() => "data:image/png;base64,mocked-image");
  html2canvas.mockResolvedValue(mockCanvas);

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
            <DashboardLayout />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: { editableDashboard: true, dashboards: updatedMockedDashboards },
    })
  );

  expect(
    await screen.findByLabelText("dashboardExitButton")
  ).toBeInTheDocument();

  const editButton = await screen.findByLabelText("editButton");
  expect(await screen.findByText("editable")).toBeInTheDocument();
  expect(editButton).toBeInTheDocument();
  expect(screen.getByLabelText("appInfoButton")).toBeInTheDocument();
  expect(screen.getByLabelText("dashboardSettingButton")).toBeInTheDocument();

  await userEvent.click(editButton);

  expect(await screen.findByLabelText("cancelButton")).toBeInTheDocument();
  const saveButton = await screen.findByLabelText("saveButton");
  expect(screen.getByLabelText("saveButton")).toBeInTheDocument();
  const addGridItemButton = await screen.findByLabelText("addGridItemButton");
  expect(addGridItemButton).toBeInTheDocument();
  expect(screen.getByLabelText("Disable Movement Button")).toBeInTheDocument();
  expect(screen.queryByLabelText("editButton")).not.toBeInTheDocument();

  await userEvent.click(addGridItemButton);
  userEvent.click(saveButton);

  expect(await screen.findByTestId("Loading...")).toBeInTheDocument();

  await waitFor(() => {
    expect(mockUpdateDashboard).toHaveBeenCalledWith(
      {
        gridItems: [
          {
            i: "4",
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
          {
            i: "1",
            x: 0,
            y: 20,
            w: 20,
            h: 20,
            source: "",
            args_string: "{}",
            metadata_string: JSON.stringify({
              refreshRate: 0,
            }),
          },
          {
            i: "3",
            x: 0,
            y: 40,
            w: 20,
            h: 20,
            source: "",
            args_string: "{}",
            metadata_string: JSON.stringify({
              refreshRate: 0,
            }),
          },
          {
            i: "2",
            x: 0,
            y: 60,
            w: 20,
            h: 20,
            source: "",
            args_string: "{}",
            metadata_string: JSON.stringify({
              refreshRate: 0,
            }),
          },
        ],
        id: 1,
        image: "data:image/png;base64,mocked-image",
      },
      "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
    );
  });

  expect(screen.queryByTestId("Loading...")).not.toBeInTheDocument();
});

test("DashboardHeader, editable, edit, save and error", async () => {
  const mockUpdateDashboard = jest.fn();
  mockUpdateDashboard.mockResolvedValue({
    success: false,
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  jest
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockImplementation(() => ({
      width: 100,
      height: 100,
    }));

  const mockCanvas = document.createElement("canvas");
  mockCanvas.toDataURL = jest.fn(() => "data:image/png;base64,mocked-image");
  html2canvas.mockResolvedValue(mockCanvas);

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
            <DashboardLayoutAlerts />
            <DashboardLayout />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: { editableDashboard: true },
    })
  );

  expect(
    await screen.findByLabelText("dashboardExitButton")
  ).toBeInTheDocument();

  const editButton = await screen.findByLabelText("editButton");
  expect(await screen.findByText("editable")).toBeInTheDocument();
  expect(editButton).toBeInTheDocument();
  expect(screen.getByLabelText("appInfoButton")).toBeInTheDocument();
  expect(screen.getByLabelText("dashboardSettingButton")).toBeInTheDocument();

  await userEvent.click(editButton);

  expect(await screen.findByLabelText("cancelButton")).toBeInTheDocument();
  const saveButton = await screen.findByLabelText("saveButton");
  expect(screen.getByLabelText("saveButton")).toBeInTheDocument();
  const addGridItemButton = await screen.findByLabelText("addGridItemButton");
  expect(addGridItemButton).toBeInTheDocument();
  expect(screen.getByLabelText("Disable Movement Button")).toBeInTheDocument();
  expect(screen.queryByLabelText("editButton")).not.toBeInTheDocument();

  await userEvent.click(addGridItemButton);
  await userEvent.click(saveButton);

  expect(mockUpdateDashboard).toHaveBeenCalledWith(
    {
      gridItems: [
        {
          args_string: "{}",
          h: 20,
          i: "2",
          metadata_string: '{"refreshRate":0}',
          source: "",
          w: 20,
          x: 0,
          y: 0,
        },
        {
          args_string: "{}",
          h: 20,
          i: "1",
          metadata_string: '{"refreshRate":0}',
          source: "",
          w: 20,
          x: 0,
          y: 20,
        },
      ],
      id: 1,
      image: "data:image/png;base64,mocked-image",
    },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );

  expect(
    await screen.findByText(
      "Failed to save changes. Check server logs for more information."
    )
  ).toBeInTheDocument();
});

test("DashboardHeader, editable, edit, save and error with unrestricted movement", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockUpdateDashboard = jest.fn();
  mockUpdateDashboard.mockResolvedValue({
    success: false,
  });
  appAPI.updateDashboard = mockUpdateDashboard;
  updatedMockedDashboards.user[0].unrestrictedPlacement = true;

  jest
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockImplementation(() => ({
      width: 100,
      height: 100,
    }));

  const mockCanvas = document.createElement("canvas");
  mockCanvas.toDataURL = jest.fn(() => "data:image/png;base64,mocked-image");
  html2canvas.mockResolvedValue(mockCanvas);

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
            <DashboardLayoutAlerts />
            <DashboardLayout />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: { editableDashboard: true, dashboards: updatedMockedDashboards },
    })
  );

  expect(
    await screen.findByLabelText("dashboardExitButton")
  ).toBeInTheDocument();

  const editButton = await screen.findByLabelText("editButton");
  expect(await screen.findByText("editable")).toBeInTheDocument();
  expect(editButton).toBeInTheDocument();
  expect(screen.getByLabelText("appInfoButton")).toBeInTheDocument();
  expect(screen.getByLabelText("dashboardSettingButton")).toBeInTheDocument();

  await userEvent.click(editButton);

  expect(await screen.findByLabelText("cancelButton")).toBeInTheDocument();
  const saveButton = await screen.findByLabelText("saveButton");
  expect(screen.getByLabelText("saveButton")).toBeInTheDocument();
  const addGridItemButton = await screen.findByLabelText("addGridItemButton");
  expect(addGridItemButton).toBeInTheDocument();
  expect(screen.getByLabelText("Disable Movement Button")).toBeInTheDocument();
  expect(screen.queryByLabelText("editButton")).not.toBeInTheDocument();

  await userEvent.click(addGridItemButton);
  await userEvent.click(saveButton);

  expect(mockUpdateDashboard).toHaveBeenCalledWith(
    {
      gridItems: [
        {
          args_string: "{}",
          h: 20,
          i: "1",
          metadata_string: '{"refreshRate":0}',
          source: "",
          w: 20,
          x: 0,
          y: 0,
        },
        {
          args_string: "{}",
          h: 20,
          i: "2",
          metadata_string: '{"refreshRate":0}',
          source: "",
          w: 20,
          x: 0,
          y: 0,
        },
      ],
      id: 1,
      image: "data:image/png;base64,mocked-image",
    },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );

  expect(
    await screen.findByText(
      "Failed to save changes. Check server logs for more information."
    )
  ).toBeInTheDocument();
});
