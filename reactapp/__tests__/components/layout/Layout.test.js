import { render, screen } from "@testing-library/react";
import Layout from "components/layout/Layout";
import RoutesContextProvider from "components/contexts/RoutesContext";
import { MemoryRouter } from "react-router-dom";

// eslint-disable-next-line
jest.mock("views/dashboard/Dashboard", () => (props) => (
  <>
    <div>A Dashboard Loaded</div>
  </>
));

test("Layout loading", async () => {
  render(
    <MemoryRouter initialEntries={["/dashboard/some_dashboard"]}>
      <RoutesContextProvider>
        <Layout />
      </RoutesContextProvider>
    </MemoryRouter>
  );

  expect(await screen.findByText("Loading...")).toBeInTheDocument();
});

test("Layout not found", async () => {
  render(
    <MemoryRouter initialEntries={["/some_bad_url"]}>
      <RoutesContextProvider>
        <Layout />
      </RoutesContextProvider>
    </MemoryRouter>
  );

  expect(await screen.findByText("Page Not Found")).toBeInTheDocument();
});

test("Layout dashboard", async () => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <RoutesContextProvider>
        <Layout />
      </RoutesContextProvider>
    </MemoryRouter>
  );

  expect(await screen.findByText("A Dashboard Loaded")).toBeInTheDocument();
});
