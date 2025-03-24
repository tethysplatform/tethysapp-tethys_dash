import PropTypes from "prop-types";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DashboardImportModal from "components/modals/DashboardImport";
import createLoadedComponent from "__tests__/utilities/customRender";
import { AvailableDashboardsContext } from "components/contexts/Contexts";
import { LayoutSuccessAlertContext } from "components/contexts/LayoutAlertContext";
import * as dashboardUtils from "components/dashboard/DashboardItem";

const TestingComponent = ({ onImportGridItem }) => {
  const [showModal, setShowModal] = useState(true);

  return (
    <DashboardImportModal
      showModal={showModal}
      setShowModal={setShowModal}
      onImportGridItem={onImportGridItem}
    />
  );
};

test("DashboardImportModal Landing Page", async () => {
  const importedDashboard = {
    name: "Test",
    description: "this is a new description",
  };
  const mockImportDashboard = jest.fn();
  mockImportDashboard.mockResolvedValue({
    success: true,
    new_dashboard: importedDashboard,
  });
  const mockSetSuccessMessage = jest.fn();
  const mockSetShowSuccessMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <LayoutSuccessAlertContext.Provider
          value={{
            setSuccessMessage: mockSetSuccessMessage,
            setShowSuccessMessage: mockSetShowSuccessMessage,
          }}
        >
          <AvailableDashboardsContext.Provider
            value={{ importDashboard: mockImportDashboard }}
          >
            <TestingComponent />
          </AvailableDashboardsContext.Provider>
        </LayoutSuccessAlertContext.Provider>
      ),
    })
  );

  expect(await screen.findByText("Import Dashboard")).toBeInTheDocument();

  const file = new File([JSON.stringify(importedDashboard)], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  const importButton = screen.getByLabelText("Import Button");
  await waitFor(() => expect(importButton).not.toBeDisabled());
  await userEvent.click(importButton);

  expect(mockImportDashboard).toHaveBeenCalledWith({
    name: "Test",
    description: "this is a new description",
  });
  expect(mockSetShowSuccessMessage).toHaveBeenCalledWith(true);
  expect(mockSetSuccessMessage).toHaveBeenCalledWith(
    `Successfully imported the dashboard as ${importedDashboard.name}`
  );
});

test("DashboardImportModal Landing Page Error", async () => {
  const importedDashboard = {
    name: "Test",
    description: "this is a new description",
  };
  const mockImportDashboard = jest.fn();
  mockImportDashboard.mockResolvedValue({
    success: false,
  });
  const mockSetSuccessMessage = jest.fn();
  const mockSetShowSuccessMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <LayoutSuccessAlertContext.Provider
          value={{
            setSuccessMessage: mockSetSuccessMessage,
            setShowSuccessMessage: mockSetShowSuccessMessage,
          }}
        >
          <AvailableDashboardsContext.Provider
            value={{ importDashboard: mockImportDashboard }}
          >
            <TestingComponent />
          </AvailableDashboardsContext.Provider>
        </LayoutSuccessAlertContext.Provider>
      ),
    })
  );

  expect(await screen.findByText("Import Dashboard")).toBeInTheDocument();

  const file = new File([JSON.stringify(importedDashboard)], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  const importButton = screen.getByLabelText("Import Button");
  await waitFor(() => expect(importButton).not.toBeDisabled());
  await userEvent.click(importButton);

  expect(mockImportDashboard).toHaveBeenCalledWith({
    name: "Test",
    description: "this is a new description",
  });
  expect(mockSetShowSuccessMessage).toHaveBeenCalledTimes(0);
  expect(mockSetSuccessMessage).toHaveBeenCalledTimes(0);

  expect(
    await screen.findByText("Failed to import the dashboard")
  ).toBeInTheDocument();
});

test("DashboardImportModal Landing Page Error with message", async () => {
  const importedDashboard = {
    name: "Test",
    description: "this is a new description",
  };
  const mockImportDashboard = jest.fn();
  mockImportDashboard.mockResolvedValue({
    success: false,
    message: "failed import",
  });
  const mockSetSuccessMessage = jest.fn();
  const mockSetShowSuccessMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <LayoutSuccessAlertContext.Provider
          value={{
            setSuccessMessage: mockSetSuccessMessage,
            setShowSuccessMessage: mockSetShowSuccessMessage,
          }}
        >
          <AvailableDashboardsContext.Provider
            value={{ importDashboard: mockImportDashboard }}
          >
            <TestingComponent />
          </AvailableDashboardsContext.Provider>
        </LayoutSuccessAlertContext.Provider>
      ),
    })
  );

  expect(await screen.findByText("Import Dashboard")).toBeInTheDocument();

  const file = new File([JSON.stringify(importedDashboard)], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  const importButton = screen.getByLabelText("Import Button");
  await waitFor(() => expect(importButton).not.toBeDisabled());
  await userEvent.click(importButton);

  expect(mockImportDashboard).toHaveBeenCalledWith({
    name: "Test",
    description: "this is a new description",
  });
  expect(mockSetShowSuccessMessage).toHaveBeenCalledTimes(0);
  expect(mockSetSuccessMessage).toHaveBeenCalledTimes(0);

  expect(await screen.findByText("failed import")).toBeInTheDocument();
});

test("DashboardImportModal Dashboard View", async () => {
  const importedGridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "Variable Input",
    args_string: {
      initial_value: "",
      variable_name: "Test Variable",
      variable_options_source: "text",
      variable_input_type: "text",
    },
    metadata_string: {
      refreshRate: 0,
    },
  };

  const mockHandleGridItemImport = jest.fn();
  const spyHandleGridItemImport = jest
    .spyOn(dashboardUtils, "handleGridItemImport")
    .mockImplementation(mockHandleGridItemImport);
  mockHandleGridItemImport.mockResolvedValue({
    success: true,
    importedGridItem,
  });

  const mockOnImportGridItem = jest.fn();
  const mockImportDashboard = jest.fn();
  mockImportDashboard.mockResolvedValue({
    success: true,
    importedGridItem,
  });
  const mockSetSuccessMessage = jest.fn();
  const mockSetShowSuccessMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <LayoutSuccessAlertContext.Provider
          value={{
            setSuccessMessage: mockSetSuccessMessage,
            setShowSuccessMessage: mockSetShowSuccessMessage,
          }}
        >
          <TestingComponent onImportGridItem={mockOnImportGridItem} />
        </LayoutSuccessAlertContext.Provider>
      ),
    })
  );

  expect(await screen.findByText("Import Dashboard Item")).toBeInTheDocument();

  const file = new File([JSON.stringify(importedGridItem)], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  const importButton = screen.getByLabelText("Import Button");
  await waitFor(() => expect(importButton).not.toBeDisabled());
  await userEvent.click(importButton);

  expect(spyHandleGridItemImport).toHaveBeenCalledWith(
    importedGridItem,
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );
  expect(mockOnImportGridItem).toHaveBeenCalledWith(importedGridItem);
  expect(mockSetShowSuccessMessage).toHaveBeenCalledWith(true);
  expect(mockSetSuccessMessage).toHaveBeenCalledWith(
    "Successfully imported dashboard item"
  );
});

test("DashboardImportModal Dashboard View bad json", async () => {
  const mockOnImportGridItem = jest.fn();
  const mockSetSuccessMessage = jest.fn();
  const mockSetShowSuccessMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <LayoutSuccessAlertContext.Provider
          value={{
            setSuccessMessage: mockSetSuccessMessage,
            setShowSuccessMessage: mockSetShowSuccessMessage,
          }}
        >
          <TestingComponent onImportGridItem={mockOnImportGridItem} />
        </LayoutSuccessAlertContext.Provider>
      ),
    })
  );

  expect(await screen.findByText("Import Dashboard Item")).toBeInTheDocument();

  const file = new File(["{'dd':}"], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  expect(await screen.findByText("Invalid JSON structure")).toBeInTheDocument();

  const closeAlert = await screen.findByLabelText("Close alert");
  await userEvent.click(closeAlert);

  await waitFor(() => {
    expect(
      screen.queryByText("Invalid JSON structure")
    ).not.toBeInTheDocument();
  });
});

test("DashboardImportModal Dashboard View close header", async () => {
  const mockOnImportGridItem = jest.fn();
  const mockSetSuccessMessage = jest.fn();
  const mockSetShowSuccessMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <LayoutSuccessAlertContext.Provider
          value={{
            setSuccessMessage: mockSetSuccessMessage,
            setShowSuccessMessage: mockSetShowSuccessMessage,
          }}
        >
          <TestingComponent onImportGridItem={mockOnImportGridItem} />
        </LayoutSuccessAlertContext.Provider>
      ),
    })
  );
  expect(await screen.findByText("Import Dashboard Item")).toBeInTheDocument();

  const closeButton = await screen.findByLabelText("Close");
  await userEvent.click(closeButton);

  await waitFor(() => {
    expect(screen.queryByText("Import Dashboard Item")).not.toBeInTheDocument();
  });
});

test("DashboardImportModal Dashboard View close footer", async () => {
  const mockOnImportGridItem = jest.fn();
  const mockSetSuccessMessage = jest.fn();
  const mockSetShowSuccessMessage = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <LayoutSuccessAlertContext.Provider
          value={{
            setSuccessMessage: mockSetSuccessMessage,
            setShowSuccessMessage: mockSetShowSuccessMessage,
          }}
        >
          <TestingComponent onImportGridItem={mockOnImportGridItem} />
        </LayoutSuccessAlertContext.Provider>
      ),
    })
  );
  expect(await screen.findByText("Import Dashboard Item")).toBeInTheDocument();

  const closeButton = await screen.findByLabelText("Close Import Modal Button");
  await userEvent.click(closeButton);

  await waitFor(() => {
    expect(screen.queryByText("Import Dashboard Item")).not.toBeInTheDocument();
  });
});

TestingComponent.propTypes = {
  onImportGridItem: PropTypes.func,
};
