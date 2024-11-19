import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import AvailableDashboardsContextProvider, {
  useAvailableDashboardsContext,
  useDashboardDropdownContext,
} from "components/contexts/AvailableDashboardsContext";
import {
  mockedDashboards,
  newDashboard,
  copiedDashboard,
  updatedDashboard,
} from "__tests__/utilities/constants";
import appAPI from "services/api/app";
import { useLayoutContext } from "components/contexts/SelectedDashboardContext";
import { useRoutesContext } from "components/contexts/RoutesContext";
import { AppContext } from "components/contexts/AppContext";
import { Route } from "react-router-dom";
import NotFound from "components/error/NotFound";
import DashboardView from "views/dashboard/Dashboard";
import { confirm } from "components/dashboard/DeleteConfirmation";

jest.mock("components/contexts/SelectedDashboardContext", () => {
  return {
    useLayoutContext: jest.fn(),
  };
});

jest.mock("components/contexts/RoutesContext", () => {
  return {
    useRoutesContext: jest.fn(),
  };
});

jest.mock("components/dashboard/DeleteConfirmation", () => {
  return {
    confirm: jest.fn(),
  };
});

appAPI.getDashboards = () => {
  return Promise.resolve(mockedDashboards);
};

const mockSetLayoutContext = jest.fn();
const mockResetLayoutContext = jest.fn();

const TestingComponent = () => {
  const [
    dashboardDropdownOptions,
    selectedDashboardDropdownOption,
    setSelectedDashboardDropdownOption,
  ] = useDashboardDropdownContext();

  const [addDashboard, deleteDashboard, updateDashboard, copyCurrentDashboard] =
    useAvailableDashboardsContext().slice(2, 6);

  useEffect(() => {
    setSelectedDashboardDropdownOption({
      value: "test",
      label: "test_label",
    });
    // eslint-disable-next-line
  }, []);
  return (
    <>
      <ul data-testid="options">
        {dashboardDropdownOptions.map((item) => {
          function joinLabels(arrayItem) {
            return item.label + "-" + arrayItem.label;
          }

          if ("options" in item) {
            return item.options.map((arrayItem) => {
              const newLabel = joinLabels(arrayItem);
              return <li key={arrayItem.label}>{newLabel}</li>;
            });
          } else {
            return <li key={item.label}>{item.label}</li>;
          }
        })}
      </ul>
      <p data-testid="selected">
        {selectedDashboardDropdownOption &&
          selectedDashboardDropdownOption.value}
      </p>
      <button
        data-testid="addDashboard"
        onClick={() => addDashboard(newDashboard)}
      ></button>
      <button data-testid="deleteDashboard" onClick={deleteDashboard}></button>
      <button
        data-testid="updateDashboard"
        onClick={() => updateDashboard(updatedDashboard)}
      ></button>
      <button
        data-testid="copyCurrentDashboard"
        onClick={copyCurrentDashboard}
      ></button>
    </>
  );
};

test("available dashboard context", async () => {
  let mockRoutes = [];
  const mockSetRoutes = jest.fn((x) => (mockRoutes = x));
  const mockedLayoutContext = jest.mocked(useLayoutContext);
  const mockedRoutesContext = jest.mocked(useRoutesContext);
  mockedLayoutContext.mockReturnValue([jest.fn(), jest.fn(), jest.fn()]);
  mockedRoutesContext.mockReturnValue([mockRoutes, mockSetRoutes]);

  render(
    <AppContext.Provider value={"csrf"}>
      <AvailableDashboardsContextProvider>
        <TestingComponent />
      </AvailableDashboardsContextProvider>
    </AppContext.Provider>
  );

  expect(await screen.findByText("test")).toBeInTheDocument();

  expect(await screen.findByText("Create a New Dashboard")).toBeInTheDocument();
  expect(await screen.findByText("User-test_label")).toBeInTheDocument();
  expect(await screen.findByText("Public-test_label2")).toBeInTheDocument();

  expect(mockRoutes).toEqual([
    <Route
      key={"route-not-found"}
      path="/dashboard/*"
      element={<NotFound />}
    />,
    <Route
      path={"/dashboard/test"}
      element={<DashboardView initialDashboard={"test"} />}
      key={"route-test"}
    />,
    <Route
      path={"/dashboard/test2"}
      element={<DashboardView initialDashboard={"test2"} />}
      key={"route-test2"}
    />,
  ]);
});

test("available dashboard context for adding", async () => {
  appAPI.addDashboard = () => {
    return Promise.resolve({
      success: true,
      new_dashboard: newDashboard,
    });
  };
  const mockedLayoutContext = jest.mocked(useLayoutContext);
  const mockedRoutesContext = jest.mocked(useRoutesContext);
  mockedLayoutContext.mockReturnValue([jest.fn(), jest.fn(), jest.fn()]);
  mockedRoutesContext.mockReturnValue([[], jest.fn()]);

  render(
    <AppContext.Provider value={"csrf"}>
      <AvailableDashboardsContextProvider>
        <TestingComponent />
      </AvailableDashboardsContextProvider>
    </AppContext.Provider>
  );

  const addDashboardButton = await screen.findByTestId("addDashboard");
  await userEvent.click(addDashboardButton);
  expect(await screen.findByText("User-test_label3")).toBeInTheDocument();
  expect(await screen.findByText("test3")).toBeInTheDocument();
});

test("available dashboard context for failed adding", async () => {
  appAPI.addDashboard = () => {
    return Promise.resolve({
      success: false,
    });
  };
  const mockedLayoutContext = jest.mocked(useLayoutContext);
  const mockedRoutesContext = jest.mocked(useRoutesContext);
  mockedLayoutContext.mockReturnValue([jest.fn(), jest.fn(), jest.fn()]);
  mockedRoutesContext.mockReturnValue([[], jest.fn()]);

  render(
    <AppContext.Provider value={"csrf"}>
      <AvailableDashboardsContextProvider>
        <TestingComponent />
      </AvailableDashboardsContextProvider>
    </AppContext.Provider>
  );

  const addDashboardButton = await screen.findByTestId("addDashboard");
  await userEvent.click(addDashboardButton);
  expect(screen.queryByText("User-test_label3")).not.toBeInTheDocument();
  expect(screen.queryByText("test3")).not.toBeInTheDocument();
});

test("available dashboard context for deleting", async () => {
  appAPI.deleteDashboard = () => {
    return Promise.resolve({ success: true });
  };
  const mockedLayoutContext = jest.mocked(useLayoutContext);
  const mockedRoutesContext = jest.mocked(useRoutesContext);
  mockedLayoutContext.mockReturnValue([jest.fn(), jest.fn(), jest.fn()]);
  mockedRoutesContext.mockReturnValue([[], jest.fn()]);
  const mockedConfirm = jest.mocked(confirm);
  mockedConfirm.mockReturnValue(Promise.resolve(true));

  render(
    <AppContext.Provider value={"csrf"}>
      <AvailableDashboardsContextProvider>
        <TestingComponent />
      </AvailableDashboardsContextProvider>
    </AppContext.Provider>
  );

  const deleteDashboardButton = await screen.findByTestId("deleteDashboard");
  await userEvent.click(deleteDashboardButton);
  expect(screen.queryByText("User-test_label")).not.toBeInTheDocument();
  expect(screen.queryByText("test")).not.toBeInTheDocument();
});

test("available dashboard context for deleting cancel", async () => {
  const mockedLayoutContext = jest.mocked(useLayoutContext);
  const mockedRoutesContext = jest.mocked(useRoutesContext);
  mockedLayoutContext.mockReturnValue([jest.fn(), jest.fn(), jest.fn()]);
  mockedRoutesContext.mockReturnValue([[], jest.fn()]);
  const mockedConfirm = jest.mocked(confirm);
  mockedConfirm.mockReturnValue(Promise.resolve(false));

  render(
    <AppContext.Provider value={"csrf"}>
      <AvailableDashboardsContextProvider>
        <TestingComponent />
      </AvailableDashboardsContextProvider>
    </AppContext.Provider>
  );

  const deleteDashboardButton = await screen.findByTestId("deleteDashboard");
  await userEvent.click(deleteDashboardButton);
  expect(screen.getByText("User-test_label")).toBeInTheDocument();
  expect(screen.getByText("test")).toBeInTheDocument();
});

test("available dashboard context for deleting failed", async () => {
  appAPI.deleteDashboard = () => {
    return Promise.resolve({ success: false });
  };
  const mockedLayoutContext = jest.mocked(useLayoutContext);
  const mockedRoutesContext = jest.mocked(useRoutesContext);
  mockedLayoutContext.mockReturnValue([jest.fn(), jest.fn(), jest.fn()]);
  mockedRoutesContext.mockReturnValue([[], jest.fn()]);
  const mockedConfirm = jest.mocked(confirm);
  mockedConfirm.mockReturnValue(Promise.resolve(true));

  render(
    <AppContext.Provider value={"csrf"}>
      <AvailableDashboardsContextProvider>
        <TestingComponent />
      </AvailableDashboardsContextProvider>
    </AppContext.Provider>
  );

  const deleteDashboardButton = await screen.findByTestId("deleteDashboard");
  await userEvent.click(deleteDashboardButton);
  expect(screen.getByText("User-test_label")).toBeInTheDocument();
  expect(screen.getByText("test")).toBeInTheDocument();
});

test("available dashboard context for updating new label", async () => {
  appAPI.updateDashboard = () => {
    return Promise.resolve({
      success: true,
      updated_dashboard: updatedDashboard,
    });
  };
  const mockGetLayoutContext = jest.fn(() => {
    return mockedDashboards.test;
  });
  const mockedLayoutContext = jest.mocked(useLayoutContext);
  const mockedRoutesContext = jest.mocked(useRoutesContext);
  const mockedConfirm = jest.mocked(confirm);
  mockedConfirm.mockReturnValue(Promise.resolve(true));
  mockedLayoutContext.mockReturnValue([
    mockSetLayoutContext,
    mockResetLayoutContext,
    mockGetLayoutContext,
  ]);
  mockedRoutesContext.mockReturnValue([[], jest.fn()]);

  render(
    <AppContext.Provider value={"csrf"}>
      <AvailableDashboardsContextProvider>
        <TestingComponent />
      </AvailableDashboardsContextProvider>
    </AppContext.Provider>
  );

  const updateDashboardButton = await screen.findByTestId("updateDashboard");
  await userEvent.click(updateDashboardButton);
  expect(
    await screen.findByText("User-test_label_updated")
  ).toBeInTheDocument();
  expect(screen.queryByText("User-test_label")).not.toBeInTheDocument();
  expect(await screen.findByText("test")).toBeInTheDocument();
});

test("available dashboard context for updating same name and label", async () => {
  const newUpdatedDashboard = updatedDashboard;
  newUpdatedDashboard.label = "test_label";
  appAPI.updateDashboard = () => {
    return Promise.resolve({
      success: true,
      updated_dashboard: updatedDashboard,
    });
  };
  const mockGetLayoutContext = jest.fn(() => {
    return mockedDashboards.test;
  });
  const mockedLayoutContext = jest.mocked(useLayoutContext);
  const mockedRoutesContext = jest.mocked(useRoutesContext);
  const mockedConfirm = jest.mocked(confirm);
  mockedConfirm.mockReturnValue(Promise.resolve(true));
  mockedLayoutContext.mockReturnValue([
    mockSetLayoutContext,
    mockResetLayoutContext,
    mockGetLayoutContext,
  ]);
  mockedRoutesContext.mockReturnValue([[], jest.fn()]);

  render(
    <AppContext.Provider value={"csrf"}>
      <AvailableDashboardsContextProvider>
        <TestingComponent />
      </AvailableDashboardsContextProvider>
    </AppContext.Provider>
  );

  const updateDashboardButton = await screen.findByTestId("updateDashboard");
  await userEvent.click(updateDashboardButton);
  expect(screen.getByText("User-test_label")).toBeInTheDocument();
  expect(await screen.findByText("test")).toBeInTheDocument();
});

test("available dashboard context for updating failed", async () => {
  appAPI.updateDashboard = () => {
    return Promise.resolve({
      success: false,
    });
  };
  const mockGetLayoutContext = jest.fn(() => {
    return mockedDashboards.test;
  });
  const mockedLayoutContext = jest.mocked(useLayoutContext);
  const mockedRoutesContext = jest.mocked(useRoutesContext);
  const mockedConfirm = jest.mocked(confirm);
  mockedConfirm.mockReturnValue(Promise.resolve(true));
  mockedLayoutContext.mockReturnValue([
    mockSetLayoutContext,
    mockResetLayoutContext,
    mockGetLayoutContext,
  ]);
  mockedRoutesContext.mockReturnValue([[], jest.fn()]);

  render(
    <AppContext.Provider value={"csrf"}>
      <AvailableDashboardsContextProvider>
        <TestingComponent />
      </AvailableDashboardsContextProvider>
    </AppContext.Provider>
  );

  const updateDashboardButton = await screen.findByTestId("updateDashboard");
  await userEvent.click(updateDashboardButton);
  expect(screen.queryByText("User-test_label_updated")).not.toBeInTheDocument();
  expect(screen.getByText("User-test_label")).toBeInTheDocument();
  expect(await screen.findByText("test")).toBeInTheDocument();
});

test("available dashboard context for copying", async () => {
  const mockGetLayoutContext = jest.fn(() => {
    return mockedDashboards.test;
  });
  appAPI.addDashboard = () => {
    return Promise.resolve({
      success: true,
      new_dashboard: copiedDashboard,
    });
  };
  const mockedLayoutContext = jest.mocked(useLayoutContext);
  const mockedRoutesContext = jest.mocked(useRoutesContext);
  const mockedConfirm = jest.mocked(confirm);
  mockedConfirm.mockReturnValue(Promise.resolve(true));
  mockedLayoutContext.mockReturnValue([
    mockSetLayoutContext,
    mockResetLayoutContext,
    mockGetLayoutContext,
  ]);
  mockedRoutesContext.mockReturnValue([[], jest.fn()]);

  render(
    <AppContext.Provider value={"csrf"}>
      <AvailableDashboardsContextProvider>
        <TestingComponent />
      </AvailableDashboardsContextProvider>
    </AppContext.Provider>
  );

  const copyCurrentDashboardButton = await screen.findByTestId(
    "copyCurrentDashboard"
  );

  await userEvent.click(copyCurrentDashboardButton);
  expect(await screen.findByText("User-test_label Copy")).toBeInTheDocument();
  expect(await screen.findByText("test_copy")).toBeInTheDocument();
});
