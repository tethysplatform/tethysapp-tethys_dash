import { act, useState } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NewDashboardModal from "components/modals/NewDashboard";
import { AvailableDashboardsContext } from "components/contexts/AvailableDashboardsContext";
import { EditingContext } from "components/contexts/EditingContext";
import { AppContext } from "components/contexts/AppContext";
import SelectedDashboardContextProvider from "components/contexts/SelectedDashboardContext";
import VariableInputsContextProvider from "components/contexts/VariableInputsContext";

const TestingComponent = () => {
  const [showModal, setShowModal] = useState(true);

  return (
    <>
      <NewDashboardModal showModal={showModal} setShowModal={setShowModal} />
    </>
  );
};

test("New Dashboard Modal add dashboard success", async () => {
  const mockAddDashboard = jest.fn();
  const mockSetIsEditing = jest.fn();
  mockAddDashboard.mockResolvedValue({ success: true });

  render(
    <AppContext.Provider value={{ csrf: "csrf" }}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContext.Provider
            value={{
              addDashboard: mockAddDashboard,
            }}
          >
            <EditingContext.Provider value={{ setIsEditing: mockSetIsEditing }}>
              <TestingComponent />
            </EditingContext.Provider>
          </AvailableDashboardsContext.Provider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(await screen.findByText("Create a new dashboard")).toBeInTheDocument();
  expect(await screen.findByText("Dashboard Name")).toBeInTheDocument();

  const dashboardNameInput = await screen.findByLabelText(
    "Dashboard Name Input"
  );
  fireEvent.change(dashboardNameInput, { target: { value: "new_name" } });

  const createDashboardInput = await screen.findByLabelText(
    "Create Dashboard Button"
  );
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(createDashboardInput);
  });
  expect(screen.queryByText("Create a new dashboard")).not.toBeInTheDocument();
  expect(mockSetIsEditing).toHaveBeenCalledWith(true);
});

test("New Dashboard Modal add dashboard fail", async () => {
  const mockAddDashboard = jest.fn();
  const mockSetIsEditing = jest.fn();
  mockAddDashboard.mockResolvedValue({
    success: false,
    message: "failed to add",
  });

  render(
    <AppContext.Provider value={{ csrf: "csrf" }}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContext.Provider
            value={{
              addDashboard: mockAddDashboard,
            }}
          >
            <EditingContext.Provider value={{ setIsEditing: mockSetIsEditing }}>
              <TestingComponent />
            </EditingContext.Provider>
          </AvailableDashboardsContext.Provider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(await screen.findByText("Create a new dashboard")).toBeInTheDocument();
  expect(await screen.findByText("Dashboard Name")).toBeInTheDocument();

  const dashboardNameInput = await screen.findByLabelText(
    "Dashboard Name Input"
  );
  fireEvent.change(dashboardNameInput, { target: { value: "new_name" } });

  const createDashboardInput = await screen.findByLabelText(
    "Create Dashboard Button"
  );
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(createDashboardInput);
  });
  expect(await screen.findByText("failed to add")).toBeInTheDocument();

  const closeModalButton = await screen.findByLabelText("Close Modal Button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(closeModalButton);
  });
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
