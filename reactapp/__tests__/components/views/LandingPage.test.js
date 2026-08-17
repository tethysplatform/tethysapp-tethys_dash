import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import { ModalPriorityProvider } from "components/contexts/ModalPriorityContext";
import { MemoryRouter } from "react-router-dom";

describe("LandingPage", () => {
  it("Shows just the New Dashboard Card when there aren't availableDashboards", () => {
    render(
      <ModalPriorityProvider>
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
      </ModalPriorityProvider>,
    );

    expect(screen.getByText("Create a New Dashboard")).toBeInTheDocument();
    expect(screen.queryByTitle("You are the owner")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Public dashboard")).not.toBeInTheDocument();
  });

  it("Shows both public and user dashboard cards when they are available", () => {
    const customDashboards = JSON.parse(
      JSON.stringify(mockedDashboards.dashboards),
    );
    customDashboards[1].owner = "random_owner";

    render(
      <MemoryRouter initialEntries={["/"]}>
        <ModalPriorityProvider>
          <AppContext.Provider
            value={{
              user: { username: "admin" },
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
                  availableDashboards: customDashboards,
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
        </ModalPriorityProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Create a New Dashboard")).toBeInTheDocument();
    expect(screen.getAllByTitle("You are the owner")).toHaveLength(1);
    expect(screen.getAllByTitle("Public dashboard")).toHaveLength(1);
  });

  it("Shows only public dashboards when not logged in", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <ModalPriorityProvider>
          <AppContext.Provider
            value={{
              user: { username: null },
              tethysApp: { exitUrl: "/home" },
            }}
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
        </ModalPriorityProvider>
      </MemoryRouter>,
    );

    expect(
      screen.queryByText("Create a New Dashboard"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTitle("You are the owner")).not.toBeInTheDocument();
    expect(screen.getAllByTitle("Public dashboard")).toHaveLength(1);
  });

  describe("search", () => {
    // Purpose-built records: one description repeats "the" so a stopword-only
    // query has something it could wrongly match, and neither name contains it.
    const searchDashboards = [
      {
        ...JSON.parse(JSON.stringify(mockedDashboards.dashboards[0])),
        id: 1,
        name: "Flood Depth",
        description: "Shows the flood depth across the basin",
      },
      {
        ...JSON.parse(JSON.stringify(mockedDashboards.dashboards[1])),
        id: 2,
        name: "Reservoir Storage",
        description: "Willamette reservoir storage and forecasts",
      },
    ];

    const renderLandingPage = (availableDashboards = searchDashboards) =>
      render(
        <MemoryRouter initialEntries={["/"]}>
          <ModalPriorityProvider>
            <AppContext.Provider
              value={{
                user: { username: "admin" },
                tethysApp: { exitUrl: "/home" },
              }}
            >
              <PermissionGroupContext.Provider value={{ permissionGroups: [] }}>
                <AvailableDashboardsContext.Provider
                  value={{
                    availableDashboards,
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
          </ModalPriorityProvider>
        </MemoryRouter>,
      );

    const searchInput = () => screen.getByLabelText("Dashboard Search Input");

    it("shows every dashboard before anything is typed", () => {
      renderLandingPage();

      expect(screen.getByText("Flood Depth")).toBeInTheDocument();
      expect(screen.getByText("Reservoir Storage")).toBeInTheDocument();
      expect(screen.queryByText(/dashboards$/)).not.toBeInTheDocument();
    });

    it("filters on a partial name", async () => {
      renderLandingPage();

      await userEvent.type(searchInput(), "flood");

      expect(screen.getByText("Flood Depth")).toBeInTheDocument();
      expect(screen.queryByText("Reservoir Storage")).not.toBeInTheDocument();
      expect(screen.getByText("1 of 2 dashboards")).toBeInTheDocument();
    });

    it("filters on a word that only appears in the description", async () => {
      renderLandingPage();

      await userEvent.type(searchInput(), "willamette");

      expect(screen.getByText("Reservoir Storage")).toBeInTheDocument();
      expect(screen.queryByText("Flood Depth")).not.toBeInTheDocument();
    });

    it("ignores an insignificant word rather than matching descriptions on it", async () => {
      // "the" appears twice in the Flood Depth description and in neither name.
      renderLandingPage();

      await userEvent.type(searchInput(), "the");

      expect(screen.queryByText("Flood Depth")).not.toBeInTheDocument();
      expect(screen.queryByText("Reservoir Storage")).not.toBeInTheDocument();
      expect(
        screen.getByText(/No dashboards match/, { exact: false }),
      ).toBeInTheDocument();
      expect(screen.getByText("0 of 2 dashboards")).toBeInTheDocument();
    });

    it("still matches significant words when stopwords are typed alongside", async () => {
      renderLandingPage();

      await userEvent.type(searchInput(), "the basin");

      expect(screen.getByText("Flood Depth")).toBeInTheDocument();
      expect(screen.getByText("1 of 2 dashboards")).toBeInTheDocument();
    });

    it("hides the New Dashboard tile while filtering and restores it after", async () => {
      renderLandingPage();
      expect(screen.getByText("Create a New Dashboard")).toBeInTheDocument();

      await userEvent.type(searchInput(), "flood");
      expect(
        screen.queryByText("Create a New Dashboard"),
      ).not.toBeInTheDocument();

      await userEvent.click(screen.getByLabelText("Clear Dashboard Search"));
      expect(screen.getByText("Create a New Dashboard")).toBeInTheDocument();
    });

    it("clearing the box restores every dashboard", async () => {
      renderLandingPage();

      await userEvent.type(searchInput(), "flood");
      expect(screen.queryByText("Reservoir Storage")).not.toBeInTheDocument();

      await userEvent.click(screen.getByLabelText("Clear Dashboard Search"));
      expect(searchInput()).toHaveValue("");
      expect(screen.getByText("Flood Depth")).toBeInTheDocument();
      expect(screen.getByText("Reservoir Storage")).toBeInTheDocument();
    });

    it("omits the search box entirely when there is nothing to search", () => {
      renderLandingPage([]);

      expect(
        screen.queryByLabelText("Dashboard Search Input"),
      ).not.toBeInTheDocument();
    });
  });

  it("Doesn't show Create new Dashboard when signed in as public with no dashboards", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <ModalPriorityProvider>
          <AppContext.Provider
            value={{
              user: { username: null },
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
        </ModalPriorityProvider>
      </MemoryRouter>,
    );

    expect(
      screen.queryByText("Create a New Dashboard"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTitle("You are the owner")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Public Dashboard")).not.toBeInTheDocument();
    expect(
      screen.getByText("There are no available public dashboards"),
    ).toBeInTheDocument();
  });
});
