import { render, screen } from "@testing-library/react";
import { LandingPageHeader, DashboardHeader } from "components/layout/Header";
import { MemoryRouter } from "react-router-dom";
import createLoadedComponent from "__tests__/utilities/customRender";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";

window.matchMedia =
  window.matchMedia ||
  function () {
    return {
      matches: false,
      addListener: function () {},
      removeListener: function () {},
    };
  };

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
  expect(screen.getByLabelText("appExitButton")).toBeInTheDocument();
});

test("LandingPageHeader, non staff user", async () => {
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <LandingPageHeader />
        </MemoryRouter>
      ),
      options: { user: { isAuthenticated: true, isStaff: false } },
    })
  );

  expect(await screen.findByLabelText("appExitButton")).toBeInTheDocument();
  expect(screen.getByText("Available Dashboards")).toBeInTheDocument();
  expect(screen.queryByLabelText("appSettingButton")).not.toBeInTheDocument();
  expect(screen.getByLabelText("appInfoButton")).toBeInTheDocument();
  expect(screen.getByLabelText("appExitButton")).toBeInTheDocument();
});

test("LandingPageHeader, public user", async () => {
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <LandingPageHeader />
        </MemoryRouter>
      ),
      options: { user: { username: "public", isAuthenticated: true, isStaff: false } },
    })
  );

  expect(await screen.findByLabelText("appExitButton")).toBeInTheDocument();
  expect(screen.getByText("Available Dashboards")).toBeInTheDocument();
  expect(screen.queryByLabelText("appSettingButton")).not.toBeInTheDocument();
  expect(screen.getByLabelText("appInfoButton")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "dashboardLoginButton" })).toBeInTheDocument();
  expect(screen.getByLabelText("appExitButton")).toBeInTheDocument();
});

test("DashboardHeader, not editable", async () => {
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
  expect(await screen.findByText("editable")).toBeInTheDocument();
  expect(screen.queryByLabelText("editButton")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("appInfoButton")).not.toBeInTheDocument();
  expect(screen.getByLabelText("dashboardSettingButton")).toBeInTheDocument();
});

test("DashboardHeader, editable", async () => {
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: { editableDashboard: true },
    })
  );

  expect(
    await screen.findByLabelText("dashboardExitButton")
  ).toBeInTheDocument();
  expect(await screen.findByText("editable")).toBeInTheDocument();
  expect(screen.getByLabelText("editButton")).toBeInTheDocument();
  expect(screen.getByLabelText("appInfoButton")).toBeInTheDocument();
  expect(screen.getByLabelText("dashboardSettingButton")).toBeInTheDocument();
});
