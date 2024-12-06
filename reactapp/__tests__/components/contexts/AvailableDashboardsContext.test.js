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
import SelectedDashboardContextProvider, {
  useLayoutContext,
} from "components/contexts/SelectedDashboardContext";
import VariableInputsContextProvider from "components/contexts/VariableInputsContext";
import { AppContext } from "components/contexts/Contexts";
import { confirm } from "components/dashboard/DeleteConfirmation";
import PropTypes from "prop-types";

jest.mock("components/dashboard/DeleteConfirmation", () => {
  return {
    confirm: jest.fn(),
  };
});

const TestingComponent = (props) => {
  const {
    dashboardDropdownOptions,
    selectedDashboardDropdownOption,
    setSelectedDashboardDropdownOption,
  } = useDashboardDropdownContext();
  const {
    addDashboard,
    deleteDashboard,
    updateDashboard,
    copyCurrentDashboard,
  } = useAvailableDashboardsContext();
  const { setLayoutContext } = useLayoutContext();

  useEffect(() => {
    setLayoutContext(props.layoutContext);
    setSelectedDashboardDropdownOption({
      value: props.layoutContext.name,
      label: props.layoutContext.label,
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
  render(
    <AppContext.Provider value={"csrf"}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContextProvider>
            <TestingComponent layoutContext={mockedDashboards.editable} />
          </AvailableDashboardsContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(await screen.findByText("editable")).toBeInTheDocument();

  expect(await screen.findByText("Create a New Dashboard")).toBeInTheDocument();
  expect(await screen.findByText("User-test_label")).toBeInTheDocument();
  expect(await screen.findByText("Public-test_label2")).toBeInTheDocument();
});

test("available dashboard context for adding", async () => {
  appAPI.addDashboard = () => {
    return Promise.resolve({
      success: true,
      new_dashboard: newDashboard,
    });
  };
  render(
    <AppContext.Provider value={"csrf"}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContextProvider>
            <TestingComponent layoutContext={mockedDashboards.editable} />
          </AvailableDashboardsContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
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

  render(
    <AppContext.Provider value={"csrf"}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContextProvider>
            <TestingComponent layoutContext={mockedDashboards.editable} />
          </AvailableDashboardsContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
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
  const mockedConfirm = jest.mocked(confirm);
  mockedConfirm.mockReturnValue(Promise.resolve(true));

  render(
    <AppContext.Provider value={"csrf"}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContextProvider>
            <TestingComponent layoutContext={mockedDashboards.editable} />
          </AvailableDashboardsContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  const deleteDashboardButton = await screen.findByTestId("deleteDashboard");
  await userEvent.click(deleteDashboardButton);
  expect(screen.queryByText("User-test_label")).not.toBeInTheDocument();
  expect(screen.queryByText("test")).not.toBeInTheDocument();
});

test("available dashboard context for deleting cancel", async () => {
  const mockedConfirm = jest.mocked(confirm);
  mockedConfirm.mockReturnValue(Promise.resolve(false));

  render(
    <AppContext.Provider value={"csrf"}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContextProvider>
            <TestingComponent layoutContext={mockedDashboards.editable} />
          </AvailableDashboardsContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  const deleteDashboardButton = await screen.findByTestId("deleteDashboard");
  await userEvent.click(deleteDashboardButton);
  expect(screen.getByText("User-test_label")).toBeInTheDocument();
  expect(screen.getByText("editable")).toBeInTheDocument();
});

test("available dashboard context for deleting failed", async () => {
  appAPI.deleteDashboard = () => {
    return Promise.resolve({ success: false });
  };
  const mockedConfirm = jest.mocked(confirm);
  mockedConfirm.mockReturnValue(Promise.resolve(true));

  render(
    <AppContext.Provider value={"csrf"}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContextProvider>
            <TestingComponent layoutContext={mockedDashboards.editable} />
          </AvailableDashboardsContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  const deleteDashboardButton = await screen.findByTestId("deleteDashboard");
  await userEvent.click(deleteDashboardButton);
  expect(screen.getByText("User-test_label")).toBeInTheDocument();
  expect(screen.getByText("editable")).toBeInTheDocument();
});

test("available dashboard context for updating new label", async () => {
  const dashboards = JSON.parse(JSON.stringify(mockedDashboards));
  dashboards.editable = updatedDashboard;
  appAPI.updateDashboard = () => {
    return Promise.resolve({
      success: true,
      updated_dashboard: updatedDashboard,
    });
  };

  render(
    <AppContext.Provider value={"csrf"}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContextProvider>
            <TestingComponent layoutContext={mockedDashboards.editable} />
          </AvailableDashboardsContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  const updateDashboardButton = await screen.findByTestId("updateDashboard");
  await userEvent.click(updateDashboardButton);
  expect(
    await screen.findByText("User-test_label_updated")
  ).toBeInTheDocument();
  expect(screen.queryByText("User-test_label")).not.toBeInTheDocument();
  expect(await screen.findByText("editable")).toBeInTheDocument();
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

  render(
    <AppContext.Provider value={"csrf"}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContextProvider>
            <TestingComponent layoutContext={mockedDashboards.editable} />
          </AvailableDashboardsContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  const updateDashboardButton = await screen.findByTestId("updateDashboard");
  await userEvent.click(updateDashboardButton);
  expect(screen.getByText("User-test_label")).toBeInTheDocument();
  expect(await screen.findByText("editable")).toBeInTheDocument();
});

test("available dashboard context for updating failed", async () => {
  appAPI.updateDashboard = () => {
    return Promise.resolve({
      success: false,
    });
  };

  render(
    <AppContext.Provider value={"csrf"}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContextProvider>
            <TestingComponent layoutContext={mockedDashboards.editable} />
          </AvailableDashboardsContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  const updateDashboardButton = await screen.findByTestId("updateDashboard");
  await userEvent.click(updateDashboardButton);
  expect(screen.queryByText("User-test_label_updated")).not.toBeInTheDocument();
  expect(screen.getByText("User-test_label")).toBeInTheDocument();
  expect(await screen.findByText("editable")).toBeInTheDocument();
});

test("available dashboard context for copying", async () => {
  appAPI.addDashboard = () => {
    return Promise.resolve({
      success: true,
      new_dashboard: copiedDashboard,
    });
  };

  render(
    <AppContext.Provider value={"csrf"}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContextProvider>
            <TestingComponent layoutContext={mockedDashboards.editable} />
          </AvailableDashboardsContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  const copyCurrentDashboardButton = await screen.findByTestId(
    "copyCurrentDashboard"
  );

  await userEvent.click(copyCurrentDashboardButton);
  expect(await screen.findByText("User-test_label Copy")).toBeInTheDocument();
  expect(await screen.findByText("test_copy")).toBeInTheDocument();
});

TestingComponent.propTypes = {
  layoutContext: PropTypes.object,
};
