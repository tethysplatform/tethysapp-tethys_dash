import { render, screen } from "@testing-library/react";
import Layout from "components/layout/Layout";
import Loader from "components/loader/AppLoader";
import { MemoryRouter } from "react-router-dom";

// eslint-disable-next-line
jest.mock("views/Dashboard", () => (props) => (
  <>
    <div>A Dashboard Loaded</div>
  </>
));

test("Layout loading", async () => {
  render(
    <MemoryRouter initialEntries={["/dashboard/some_dashboard"]}>
      <Loader>
        <Layout />
      </Loader>
    </MemoryRouter>
  );

  expect(await screen.findByText("Loading...")).toBeInTheDocument();
  expect(await screen.findByText("Page Not Found")).toBeInTheDocument();
});

test("Layout not found", async () => {
  render(
    <MemoryRouter initialEntries={["/some_bad_url"]}>
      <Loader>
        <Layout />
      </Loader>
    </MemoryRouter>
  );

  expect(await screen.findByText("Page Not Found")).toBeInTheDocument();
});

test("Layout loading valid dashboard", async () => {
  render(
    <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
      <Loader>
        <Layout />
      </Loader>
    </MemoryRouter>
  );

  expect(await screen.findByText("Loading...")).toBeInTheDocument();
  expect(await screen.findByText("A Dashboard Loaded")).toBeInTheDocument();
});

test("Layout loading invalid dashboard", async () => {
  render(
    <MemoryRouter initialEntries={["/dashboard/nonexist"]}>
      <Loader>
        <Layout />
      </Loader>
    </MemoryRouter>
  );

  expect(await screen.findByText("Loading...")).toBeInTheDocument();
  expect(await screen.findByText("Page Not Found")).toBeInTheDocument();
});
