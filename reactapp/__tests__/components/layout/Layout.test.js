import { render, screen } from "@testing-library/react";
import Layout from "components/layout/Layout";
import Loader from "components/loader/AppLoader";
import { MemoryRouter } from "react-router-dom";
import { userDashboard } from "__tests__/utilities/constants";
import { ModalPriorityProvider } from "components/contexts/ModalPriorityContext";
import { server } from "__tests__/utilities/server";
import { rest } from "msw";

// eslint-disable-next-line
jest.mock("views/Dashboard", () => (props) => (
  <>
    <div>A Dashboard Loaded</div>
  </>
));

// Holds the app's dashboard list open so the loading screen is still up when a
// test looks for it. Otherwise the test races the app's own data load, which
// finishes almost at once now that tests give the loader no minimum on-screen
// time. Once released, the request falls through to the default handler.
const holdAppLoad = () => {
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  server.use(
    rest.get("http://api.test/apps/tethysdash/dashboards/list/", async () => {
      await held;
    }),
  );
  return release;
};

test("Layout loading", async () => {
  const releaseAppLoad = holdAppLoad();
  render(
    <MemoryRouter initialEntries={["/dashboard/some_dashboard"]}>
      <ModalPriorityProvider>
        <Loader>
          <Layout />
        </Loader>
      </ModalPriorityProvider>
    </MemoryRouter>,
  );

  expect(await screen.findByText("Loading TethysDash...")).toBeInTheDocument();
  releaseAppLoad();
  expect(await screen.findByText("Page Not Found")).toBeInTheDocument();
});

test("Layout not found", async () => {
  render(
    <MemoryRouter initialEntries={["/some_bad_url"]}>
      <ModalPriorityProvider>
        <Loader>
          <Layout />
        </Loader>
      </ModalPriorityProvider>
    </MemoryRouter>,
  );

  expect(await screen.findByText("Page Not Found")).toBeInTheDocument();
});

test("Layout loading valid dashboard", async () => {
  const releaseAppLoad = holdAppLoad();
  render(
    <MemoryRouter initialEntries={[`/dashboard/${userDashboard.uuid}`]}>
      <ModalPriorityProvider>
        <Loader>
          <Layout />
        </Loader>
      </ModalPriorityProvider>
    </MemoryRouter>,
  );

  expect(await screen.findByText("Loading TethysDash...")).toBeInTheDocument();
  releaseAppLoad();
  expect(await screen.findByText("A Dashboard Loaded")).toBeInTheDocument();
});

test("Layout loading invalid dashboard", async () => {
  const releaseAppLoad = holdAppLoad();
  render(
    <MemoryRouter initialEntries={["/dashboard/nonexist"]}>
      <ModalPriorityProvider>
        <Loader>
          <Layout />
        </Loader>
      </ModalPriorityProvider>
    </MemoryRouter>,
  );

  expect(await screen.findByText("Loading TethysDash...")).toBeInTheDocument();
  releaseAppLoad();
  expect(await screen.findByText("Page Not Found")).toBeInTheDocument();
});
