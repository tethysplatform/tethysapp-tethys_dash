import { render, screen } from "@testing-library/react";
import {
  publicDashboard,
  mockedDashboards,
} from "__tests__/utilities/constants";
import LandingPage from "views/LandingPage";
import {
  AppContext,
  AvailableDashboardsContext,
  PermissionGroupContext,
} from "components/contexts/Contexts";
import AppTourContextProvider from "components/contexts/AppTourContext";
import { MemoryRouter } from "react-router-dom";

describe("LandingPage", () => {
  it("Shows just the New Dashboard Card when there aren't availableDashboards", () => {
    render(
      <AppContext.Provider
        value={{
          user: { username: "johnSmith" },
          tethysApp: { exitUrl: "/home" },
        }}
      >
        <AvailableDashboardsContext.Provider
          value={{
            availableDashboards: [],
            deleteDashboard: jest.fn(),
            copyDashboard: jest.fn(),
            updateDashboard: jest.fn(),
          }}
        >
          <AppTourContextProvider>
            <LandingPage />
          </AppTourContextProvider>
        </AvailableDashboardsContext.Provider>
      </AppContext.Provider>
    );

    expect(screen.getByText("Create a New Dashboard")).toBeInTheDocument();
    expect(screen.queryByTitle("You are the owner")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Public dashboard")).not.toBeInTheDocument();
  });

  it("Shows both public and user dashboard cards when they are available", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppContext.Provider
          value={{
            user: { username: "johnSmith" },
            tethysApp: { exitUrl: "/home" },
          }}
        >
          <PermissionGroupContext.Provider
            value={{
              permissionGroups: [],
            }}
          >
            <AvailableDashboardsContext.Provider
              value={{
                availableDashboards: mockedDashboards.dashboards,
                deleteDashboard: jest.fn(),
                copyDashboard: jest.fn(),
                updateDashboard: jest.fn(),
              }}
            >
              <AppTourContextProvider>
                <LandingPage />
              </AppTourContextProvider>
            </AvailableDashboardsContext.Provider>
          </PermissionGroupContext.Provider>
        </AppContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByText("Create a New Dashboard")).toBeInTheDocument();
    expect(screen.getAllByTitle("You are the owner")).toHaveLength(1);
    expect(screen.getAllByTitle("Public dashboard")).toHaveLength(1);
  });

  it("Shows only public dashboards when not logged in", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppContext.Provider
          value={{ user: { username: null }, tethysApp: { exitUrl: "/home" } }}
        >
          <AvailableDashboardsContext.Provider
            value={{
              availableDashboards: [publicDashboard],
              deleteDashboard: jest.fn(),
              copyDashboard: jest.fn(),
              updateDashboard: jest.fn(),
            }}
          >
            <AppTourContextProvider>
              <LandingPage />
            </AppTourContextProvider>
          </AvailableDashboardsContext.Provider>
        </AppContext.Provider>
      </MemoryRouter>
    );

    expect(
      screen.queryByText("Create a New Dashboard")
    ).not.toBeInTheDocument();
    expect(screen.queryByTitle("You are the owner")).not.toBeInTheDocument();
    expect(screen.getAllByTitle("Public dashboard")).toHaveLength(1);
  });

  it("Doesn't show Create new Dashboard when signed in as public with no dashboards", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppContext.Provider
          value={{ user: { username: null }, tethysApp: { exitUrl: "/home" } }}
        >
          <AvailableDashboardsContext.Provider
            value={{
              availableDashboards: [],
              deleteDashboard: jest.fn(),
              copyDashboard: jest.fn(),
              updateDashboard: jest.fn(),
            }}
          >
            <AppTourContextProvider>
              <LandingPage />
            </AppTourContextProvider>
          </AvailableDashboardsContext.Provider>
        </AppContext.Provider>
      </MemoryRouter>
    );

    expect(
      screen.queryByText("Create a New Dashboard")
    ).not.toBeInTheDocument();
    expect(screen.queryByTitle("You are the owner")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Public Dashboard")).not.toBeInTheDocument();
    expect(
      screen.getByText("There are no available public dashboards")
    ).toBeInTheDocument();
  });
});
