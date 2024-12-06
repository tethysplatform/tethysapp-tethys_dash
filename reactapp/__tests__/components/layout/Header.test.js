import { act } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import Header from "components/layout/Header";
import SelectedDashboardContextProvider from "components/contexts/SelectedDashboardContext";
import VariableInputsContextProvider from "components/contexts/VariableInputsContext";
import EditingContextProvider from "components/contexts/EditingContext";
import DataViewerModeContextProvider from "components/contexts/DataViewerModeContext";
import { Route, Routes } from "react-router-dom";
import AvailableDashboardsContextProvider from "components/contexts/AvailableDashboardsContext";
import { AppContext } from "components/contexts/Contexts";
import { MemoryRouter } from "react-router-dom";
import PropTypes from "prop-types";

window.matchMedia =
  window.matchMedia ||
  function () {
    return {
      matches: false,
      addListener: function () {},
      removeListener: function () {},
    };
  };

const TestingComponent = (props) => {
  return (
    <>
      <Routes>
        <Route
          path={"/"}
          element={<Header initialDashboard={props.initialDashboard} />}
          key="route-dashboard"
        />
      </Routes>
    </>
  );
};

test("Header, staff user", async () => {
  const tethysApp = {};
  const user = { isStaff: true };
  const csrf = "csrf";
  render(
    <MemoryRouter initialEntries={["/"]}>
      <AppContext.Provider value={{ tethysApp, user, csrf }}>
        <VariableInputsContextProvider>
          <SelectedDashboardContextProvider>
            <AvailableDashboardsContextProvider>
              <EditingContextProvider>
                <DataViewerModeContextProvider>
                  <TestingComponent />
                </DataViewerModeContextProvider>
              </EditingContextProvider>
            </AvailableDashboardsContextProvider>
          </SelectedDashboardContextProvider>
        </VariableInputsContextProvider>
      </AppContext.Provider>
    </MemoryRouter>
  );

  expect(
    screen.queryByLabelText("dashboardSettingButton")
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("appSettingButton")).toBeInTheDocument();
  expect(screen.getByLabelText("appExitButton")).toBeInTheDocument();

  expect(await screen.findByText("Select/Add Dashboard:")).toBeInTheDocument();
  const selector = await screen.findByRole("combobox");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(selector);
  });

  const userOption = await screen.findByText("test_label");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(userOption);
  });

  const dashboardSettingButton = screen.getByLabelText(
    "dashboardSettingButton"
  );
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dashboardSettingButton);
  });
  expect(await screen.findByText("Dashboard Settings")).toBeInTheDocument();
});

test("Header, non staff user", async () => {
  const tethysApp = {};
  const user = { isStaff: false };
  const csrf = "csrf";
  render(
    <MemoryRouter initialEntries={["/"]}>
      <AppContext.Provider value={{ tethysApp, user, csrf }}>
        <VariableInputsContextProvider>
          <SelectedDashboardContextProvider>
            <AvailableDashboardsContextProvider>
              <EditingContextProvider>
                <TestingComponent />
              </EditingContextProvider>
            </AvailableDashboardsContextProvider>
          </SelectedDashboardContextProvider>
        </VariableInputsContextProvider>
      </AppContext.Provider>
    </MemoryRouter>
  );

  expect(
    screen.queryByLabelText("dashboardSettingButton")
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText("appSettingButton")).not.toBeInTheDocument();
  expect(screen.getByLabelText("appExitButton")).toBeInTheDocument();

  expect(await screen.findByText("Select/Add Dashboard:")).toBeInTheDocument();
});

TestingComponent.propTypes = {
  initialDashboard: PropTypes.string,
};
