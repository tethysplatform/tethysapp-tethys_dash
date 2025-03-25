import { render, screen } from "@testing-library/react";

import LandingPage from "views/LandingPage";
import {
  AppContext,
  AvailableDashboardsContext,
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
            availableDashboards: { public: [], user: [] },
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
    const publicDashboards = [
      {
        id: 1,
        uuid: "aa8a8ce9-f940-4abd-b476-2091e901a030",
        name: "test",
        description: "test",
        accessGroups: ["public"],
        image: "/static/tethysdash/images/tethys_dash.png",
      },
    ];

    const userDashboards = [
      {
        id: 2,
        uuid: "ce3d4dab-334c-4143-8f74-6e4983574f01",
        name: "Private Test",
        description: "Nobody should have access to this one!",
        accessGroups: [],
        image: "/media/tethysdash/app/ce3d4dab-334c-4143-8f74-6e4983574f01.png",
      },
    ];
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppContext.Provider
          value={{
            user: { username: "johnSmith" },
            tethysApp: { exitUrl: "/home" },
          }}
        >
          <AvailableDashboardsContext.Provider
            value={{
              availableDashboards: {
                public: publicDashboards,
                user: userDashboards,
              },
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

    expect(screen.getByText("Create a New Dashboard")).toBeInTheDocument();
    expect(screen.getAllByTitle("You are the owner")).toHaveLength(1);
    expect(screen.getAllByTitle("Public dashboard")).toHaveLength(1);
  });

  it("Shows only public dashboards when not logged in", () => {
    const publicDashboards = [
      {
        id: 1,
        uuid: "aa8a8ce9-f940-4abd-b476-2091e901a030",
        name: "test",
        description: "test",
        accessGroups: ["public"],
        image: "/static/tethysdash/images/tethys_dash.png",
      },
    ];

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppContext.Provider
          value={{ user: { username: null }, tethysApp: { exitUrl: "/home" } }}
        >
          <AvailableDashboardsContext.Provider
            value={{
              availableDashboards: { public: publicDashboards, user: [] },
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
              availableDashboards: { public: [], user: [] },
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
