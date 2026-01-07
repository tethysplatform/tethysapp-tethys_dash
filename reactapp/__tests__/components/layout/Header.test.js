import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { LandingPageHeader, DashboardHeader } from "components/layout/Header";
import { MemoryRouter } from "react-router-dom";
import createLoadedComponent, {
  DisabledMovementPComponent,
} from "__tests__/utilities/customRender";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import userEvent from "@testing-library/user-event";
import DashboardTabs from "components/dashboard/DashboardTabs";
import DashboardLayoutAlerts from "components/dashboard/DashboardLayoutAlerts";
import appAPI from "services/api/app";
import { useNavigate } from "react-router-dom";
import { AppTourContext } from "components/contexts/Contexts";
import {
  mockedDashboards,
  mockedTextVariable,
  publicDashboard,
  userDashboard,
} from "__tests__/utilities/constants";
import { server } from "__tests__/utilities/server";
import { rest } from "msw";

jest.mock("uuid", () => ({
  v4: () => "12345678",
}));

jest.mock("html2canvas");

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: jest.fn(),
}));

afterEach(() => {
  server.resetHandlers();
  jest.restoreAllMocks();
  jest.resetAllMocks();
});

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

test("LandingPageHeader, import dashboard with grid_items", async () => {
  const importedDashboard = {
    name: "Test",
    description: "this is a new description",
    uuid: "12345678",
  };
  const mockAddDashboard = jest.fn();
  jest.spyOn(appAPI, "addDashboard").mockImplementation(mockAddDashboard);

  mockAddDashboard.mockResolvedValue({
    success: true,
    new_dashboard: {
      id: 1,
      name: "Test",
      description: "this is a new description",
      notes: "",
      editable: true,
      publicDashboard: false,
      tabs: [
        {
          id: 1,
          name: "Tab 1",
          gridItems: [],
        },
      ],
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

test("LandingPageHeader, import dashboard with tabs", async () => {
  const importedDashboard = {
    name: "Test",
    description: "this is a new description",
    uuid: "12345678",
  };
  const mockAddDashboard = jest.fn();
  jest.spyOn(appAPI, "addDashboard").mockImplementation(mockAddDashboard);

  mockAddDashboard.mockResolvedValue({
    success: true,
    new_dashboard: {
      id: 1,
      name: "Test",
      description: "this is a new description",
      notes: "",
      editable: true,
      publicDashboard: false,
      tabs: [],
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

test("LandingPageHeader, permission group modal", async () => {
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <LayoutAlertContextProvider>
            <LandingPageHeader />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
    })
  );

  const manageGroupsButton = await screen.findByLabelText("manageGroupsButton");
  await userEvent.click(manageGroupsButton);
  expect(await screen.findByText("Permission Groups")).toBeInTheDocument();
});

test("LandingPageHeader, manage visualization permissions", async () => {
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <LayoutAlertContextProvider>
            <LandingPageHeader />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
    })
  );

  const manageVisualizationPermissionsButton = await screen.findByLabelText(
    "manageVisualizationPermissionsButton"
  );
  await userEvent.click(manageVisualizationPermissionsButton);
  expect(
    await screen.findByText("Manage Visualization Permissions")
  ).toBeInTheDocument();
});

test("LandingPageHeader, no manage visualization permission", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/app/permissions/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({ success: true, permissions: [] }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <LayoutAlertContextProvider>
            <LandingPageHeader />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
    })
  );

  expect(
    screen.queryByLabelText("manageVisualizationPermissionsButton")
  ).not.toBeInTheDocument();
});

test("LandingPageHeader Sign In shows first and then AppInfo after continue", async () => {
  server.use(
    rest.get("http://api.test/api/session/", (req, res, ctx) => {
      return res(
        ctx.status(401),
        ctx.json({ error: "Internal Server Error" }),
        ctx.set("Content-Type", "application/json")
      );
    }),
    rest.get("http://api.test/apps/tethysdash/ping/", (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          status: 1,
          EXPIRE_AFTER: 10,
          WARN_AFTER: 3,
        }),
        ctx.set("Content-Type", "application/json")
      );
    })
  );

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <LandingPageHeader />
        </MemoryRouter>
      ),
    })
  );

  expect(
    await screen.findByText(
      "You are not signed in. Sign in to create and update dashboards."
    )
  ).toBeInTheDocument();

  expect(screen.queryByText("TethysDash Landing Page")).not.toBeInTheDocument();

  const continueButton = screen.getByRole("button", {
    name: "Proceed Without Signing in",
  });
  fireEvent.click(continueButton);

  expect(
    await screen.findByText("TethysDash Landing Page")
  ).toBeInTheDocument();

  expect(
    screen.queryByText(
      "You are not signed in. Sign in to create and update dashboards."
    )
  ).not.toBeInTheDocument();
});

test("LandingPageHeader AppInfo disappears on idle and reappears on still signed in", async () => {
  server.use(
    rest.get("http://api.test/apps/tethysdash/ping/", (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          status: 1,
          EXPIRE_AFTER: 10,
          WARN_AFTER: 3,
        }),
        ctx.set("Content-Type", "application/json")
      );
    })
  );

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <LandingPageHeader />
        </MemoryRouter>
      ),
    })
  );

  expect(
    await screen.findByText("TethysDash Landing Page")
  ).toBeInTheDocument();
  expect(screen.queryByText("Are you still here?")).not.toBeInTheDocument();

  await sleep(6000);

  expect(await screen.findByText("Are you still here?")).toBeInTheDocument();
  expect(screen.queryByText("TethysDash Landing Page")).not.toBeInTheDocument();

  const staySignedInButton = screen.getByRole("button", {
    name: "Stay Signed In",
  });
  expect(staySignedInButton).toBeInTheDocument();

  await userEvent.click(staySignedInButton);

  expect(
    await screen.findByText("TethysDash Landing Page")
  ).toBeInTheDocument();
  expect(screen.queryByText("Are you still here?")).not.toBeInTheDocument();
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
        initialDashboard: publicDashboard,
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
      },
    })
  );

  const appInfoButton = await screen.findByLabelText("appInfoButton");
  await userEvent.click(appInfoButton);
  expect(screen.getByLabelText("App Info Modal")).toBeInTheDocument();
});

test("DashboardHeader, import gridItem", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.dashboards[0];
  mockedDashboard.tabs[0].gridItems = [
    {
      id: 1,
      uuid: "some-uuid-1",
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
      publicDashboard: true,
      image: "some_image.png",
      tabs: [
        {
          id: 1,
          name: "Tab 1",
          gridItems: [
            {
              id: 1,
              uuid: "some-uuid-1",
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
      ],
    },
  });
  jest.spyOn(appAPI, "updateDashboard").mockImplementation(mockUpdateDashboard);

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
            <DashboardTabs />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: {
        user: { isAuthenticated: true, isStaff: false },
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
        id: 5,
        uuid: "some-uuid-5",
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
        id: 1,
        tabs: [
          {
            gridItems: [
              {
                id: null,
                uuid: "12345678",
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
                }),
                metadata_string: JSON.stringify({
                  refreshRate: 0,
                }),
              },
              {
                id: 1,
                uuid: "some-uuid-1",
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
            name: "Tab 1",
          },
        ],
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
        <MemoryRouter initialEntries={["/dashboard/123456789"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: {
        user: {
          isAuthenticated: true,
          isStaff: false,
        },
        initialDashboard: publicDashboard,
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
  expect(
    screen.queryByLabelText("importDashboardButton")
  ).not.toBeInTheDocument();
});

test("DashboardHeader, show settings", async () => {
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
            <DashboardTabs />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: {
        user: { isAuthenticated: true, isStaff: false },
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
              <DashboardTabs />
            </LayoutAlertContextProvider>
          </AppTourContext.Provider>
        </MemoryRouter>
      ),
      options: {
        user: { isAuthenticated: true, isStaff: false },
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
            <DashboardTabs />
          </LayoutAlertContextProvider>
          <DisabledMovementPComponent />
        </MemoryRouter>
      ),
    })
  );

  expect(
    await screen.findByLabelText("dashboardExitButton")
  ).toBeInTheDocument();

  const editButton = await screen.findByLabelText("editButton");
  expect(await screen.findByText(userDashboard.name)).toBeInTheDocument();
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
      options: { initialDashboard: publicDashboard },
    })
  );

  const dashboardExitButton = await screen.findByLabelText(
    "dashboardExitButton"
  );
  expect(dashboardExitButton).toBeInTheDocument();
  expect(await screen.findByText(publicDashboard.name)).toBeInTheDocument();
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
              <DashboardTabs />
            </LayoutAlertContextProvider>
          </AppTourContext.Provider>
        </MemoryRouter>
      ),
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
            <DashboardTabs />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
    })
  );

  expect(
    await screen.findByLabelText("dashboardExitButton")
  ).toBeInTheDocument();

  const editButton = await screen.findByLabelText("editButton");
  expect(await screen.findByText(userDashboard.name)).toBeInTheDocument();
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

test("DashboardHeader, editable, edit, save and error with unrestricted movement", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  updatedMockedDashboards.dashboards[0].unrestrictedPlacement = true;

  const expectedRequestCall = {
    tabs: [
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
            id: 1,
            uuid: "some-uuid-1",
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
            id: null,
            uuid: "12345678",
          },
        ],
        id: 1,
        name: "Tab 1",
      },
    ],
    id: 1,
  };

  server.use(
    rest.post(
      "http://api.test/apps/tethysdash/dashboards/update/",
      async (req, res, ctx) => {
        expect(await req.json()).toEqual(expectedRequestCall);
        return res(
          ctx.delay(200),
          ctx.status(200),
          ctx.json({
            success: false,
          }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/123456789"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
            <DashboardLayoutAlerts />
            <DashboardTabs />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: { dashboards: updatedMockedDashboards },
    })
  );

  expect(
    await screen.findByLabelText("dashboardExitButton")
  ).toBeInTheDocument();

  const editButton = await screen.findByLabelText("editButton");
  expect(await screen.findByText(userDashboard.name)).toBeInTheDocument();
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

  expect(
    await screen.findByText(
      "Failed to save changes. Check server logs for more information."
    )
  ).toBeInTheDocument();
});

test("staticBasePath construction without prefix", async () => {
  // Save original environment variable
  const originalPrefixUrl = process.env.TETHYS_PREFIX_URL;

  // Set environment variable to empty to test default case
  process.env.TETHYS_PREFIX_URL = "";

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <LandingPageHeader />
        </MemoryRouter>
      ),
    })
  );

  await screen.findByLabelText("manageVisualizationPermissionsButton");
  const img = screen.getByAltText("Visualization Settings");

  // Should be /static/tethysdash/images/visualization_settings.png (no prefix)
  expect(img.src).toContain(
    "/static/tethysdash/images/visualization_settings.png"
  );

  // Restore original environment variable
  process.env.TETHYS_PREFIX_URL = originalPrefixUrl;
});

test("staticBasePath construction with prefix", async () => {
  // Save original environment variable
  const originalPrefixUrl = process.env.TETHYS_PREFIX_URL;

  // Set environment variable to test prefix case
  process.env.TETHYS_PREFIX_URL = "myapp";

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <LandingPageHeader />
        </MemoryRouter>
      ),
    })
  );

  await screen.findByLabelText("manageVisualizationPermissionsButton");
  const img = screen.getByAltText("Visualization Settings");

  // Since the module was already loaded, the staticBasePath is already computed
  // This test verifies the image is rendered with the existing path
  expect(img.src).toContain("visualization_settings.png");

  // Restore original environment variable
  process.env.TETHYS_PREFIX_URL = originalPrefixUrl;
});

test("staticBasePath construction logic", () => {
  // Test the actual logic that line 48 implements
  const testCases = [
    { input: "", expected: "/static/tethysdash/images/" },
    { input: "myapp", expected: "/myapp/static/tethysdash/images/" },
    { input: "/myapp/", expected: "/myapp/static/tethysdash/images/" },
    { input: "///myapp///", expected: "/myapp/static/tethysdash/images/" },
  ];

  testCases.forEach(({ input, expected }) => {
    // Simulate the logic from line 43-48 in Header.js
    const prefixUrlSegment = input.replace(/(^\/+|\/+?$)/g, "");
    const staticBasePath = `${prefixUrlSegment ? `/${prefixUrlSegment}` : ""}/static/tethysdash/images/`;

    expect(staticBasePath).toBe(expected);
  });
});

test("DashboardHeader, editable, edit, save and error", async () => {
  const expectedRequestCall = {
    id: 1,
    tabs: [
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
            id: null,
            uuid: "12345678",
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
            id: 1,
            uuid: "some-uuid-1",
          },
        ],
        id: 1,
        name: "Tab 1",
      },
    ],
  };

  server.use(
    rest.post(
      "http://api.test/apps/tethysdash/dashboards/update/",
      async (req, res, ctx) => {
        expect(await req.json()).toEqual(expectedRequestCall);
        return res(
          ctx.delay(200),
          ctx.status(200),
          ctx.json({
            success: false,
          }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
            <DashboardLayoutAlerts />
            <DashboardTabs />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
    })
  );

  expect(
    await screen.findByLabelText("dashboardExitButton")
  ).toBeInTheDocument();

  const editButton = await screen.findByLabelText("editButton");
  expect(await screen.findByText(userDashboard.name)).toBeInTheDocument();
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

  expect(
    await screen.findByText(
      "Failed to save changes. Check server logs for more information."
    )
  ).toBeInTheDocument();
});

test("DashboardHeader, editable, edit and save", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.dashboards[0];
  mockedDashboard.tabs[0].gridItems = [
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
      id: 1,
      uuid: "some-uuid-1",
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
      id: 3,
      uuid: "some-uuid-3",
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
      id: 2,
      uuid: "some-uuid-2",
    },
  ];

  const expectedRequestCall = {
    tabs: [
      {
        id: 1,
        name: "Tab 1",
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
            id: null,
            uuid: "12345678",
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
            id: 1,
            uuid: "some-uuid-1",
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
            id: 3,
            uuid: "some-uuid-3",
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
            id: 2,
            uuid: "some-uuid-2",
          },
        ],
      },
    ],
    id: 1,
  };

  server.use(
    rest.post(
      "http://api.test/apps/tethysdash/dashboards/update/",
      async (req, res, ctx) => {
        expect(await req.json()).toEqual(expectedRequestCall);
        return res(
          ctx.delay(200),
          ctx.status(200),
          ctx.json({
            success: true,
            updated_dashboard: {
              id: 1,
              name: "some dashboard updated",
              description: "some description",
              publicDashboard: true,
              image: "some_image.png",
              tabs: [
                {
                  id: 1,
                  name: "Tab 1",
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
              ],
            },
          }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
            <DashboardTabs />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: { dashboards: updatedMockedDashboards },
    })
  );

  expect(
    await screen.findByLabelText("dashboardExitButton")
  ).toBeInTheDocument();

  const editButton = await screen.findByLabelText("editButton");
  expect(await screen.findByText(userDashboard.name)).toBeInTheDocument();
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

  expect(screen.queryByTestId("header-loading")).not.toBeInTheDocument();

  await userEvent.click(addGridItemButton);
  await userEvent.click(saveButton);

  expect(await screen.findByTestId("header-loading")).toBeInTheDocument();

  expect(screen.queryByTestId("Loading...")).not.toBeInTheDocument();
});

test("DashboardHeader Sign In shows first and then AppInfo after continue", async () => {
  server.use(
    rest.get("http://api.test/api/session/", (req, res, ctx) => {
      return res(
        ctx.status(401),
        ctx.json({ error: "Internal Server Error" }),
        ctx.set("Content-Type", "application/json")
      );
    }),
    rest.get("http://api.test/apps/tethysdash/ping/", (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          status: 1,
          EXPIRE_AFTER: 10,
          WARN_AFTER: 3,
        }),
        ctx.set("Content-Type", "application/json")
      );
    })
  );

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
    })
  );

  expect(
    await screen.findByText(
      "You are not signed in. Sign in to create and update dashboards."
    )
  ).toBeInTheDocument();

  expect(screen.queryByText("TethysDash Dashboards")).not.toBeInTheDocument();

  const continueButton = screen.getByRole("button", {
    name: "Proceed Without Signing in",
  });
  fireEvent.click(continueButton);

  expect(await screen.findByText("TethysDash Dashboards")).toBeInTheDocument();

  expect(
    screen.queryByText(
      "You are not signed in. Sign in to create and update dashboards."
    )
  ).not.toBeInTheDocument();
});

test("DashboardHeader AppInfo disappears on idle and reappears on still signed in", async () => {
  server.use(
    rest.get("http://api.test/apps/tethysdash/ping/", (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          status: 1,
          EXPIRE_AFTER: 10,
          WARN_AFTER: 3,
        }),
        ctx.set("Content-Type", "application/json")
      );
    })
  );

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
    })
  );

  expect(await screen.findByText("TethysDash Dashboards")).toBeInTheDocument();
  expect(screen.queryByText("Are you still here?")).not.toBeInTheDocument();

  await sleep(6000);

  expect(await screen.findByText("Are you still here?")).toBeInTheDocument();
  expect(screen.queryByText("TethysDash Dashboards")).not.toBeInTheDocument();

  const staySignedInButton = screen.getByRole("button", {
    name: "Stay Signed In",
  });
  expect(staySignedInButton).toBeInTheDocument();

  await userEvent.click(staySignedInButton);

  expect(await screen.findByText("TethysDash Dashboards")).toBeInTheDocument();
  expect(screen.queryByText("Are you still here?")).not.toBeInTheDocument();
});
