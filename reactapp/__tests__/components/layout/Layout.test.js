import { render, screen } from "@testing-library/react";
import Layout from "components/layout/Layout";
import { MemoryRouter } from "react-router-dom";

test("Layout loading", async () => {
  render(
    <MemoryRouter initialEntries={["/dashboard/some_dashboard"]}>
      <Layout />
    </MemoryRouter>
  );

  expect(await screen.findByText("Loading...")).toBeInTheDocument();
});

test("Layout not found", async () => {
  render(
    <MemoryRouter initialEntries={["/some_bad_url"]}>
      <Layout />
    </MemoryRouter>
  );

  expect(await screen.findByText("Page Not Found")).toBeInTheDocument();
});
