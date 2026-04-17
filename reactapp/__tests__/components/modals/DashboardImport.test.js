import PropTypes from "prop-types";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DashboardImportModal from "components/modals/DashboardImport";
import createLoadedComponent from "__tests__/utilities/customRender";
import { AvailableDashboardsContext } from "components/contexts/Contexts";
import { LayoutSuccessAlertContext } from "components/contexts/LayoutAlertContext";
import * as dashboardUtils from "components/dashboard/DashboardItem";
import appAPI from "services/api/app";

jest.mock("uuid", () => ({
  v4: () => 12345678,
}));

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

test("DashboardImportModal Landing Page no griditems", async () => {
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

test("DashboardImportModal Landing Page with bad griditems", async () => {
  const importedDashboard = {
    name: "Test",
    description: "this is a new description",
    gridItems: [{}],
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
          <TestingComponent />
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

  expect(
    await screen.findByText(
      "Grid Items must include i, x, y, w, h, source, args_string, metadata_string keys"
    )
  ).toBeInTheDocument();
});

test("DashboardImportModal Landing Page with griditems", async () => {
  const importedDashboard = {
    name: "Test",
    description: "this is a new description",
    gridItems: [
      {
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
        },
        metadata_string: {
          refreshRate: 0,
        },
      },
    ],
  };
  const mockAddDashboard = jest.fn();
  jest.spyOn(appAPI, "addDashboard").mockImplementation(mockAddDashboard);
  mockAddDashboard.mockResolvedValue({
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
          <TestingComponent />
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

  expect(mockAddDashboard).toHaveBeenCalledWith(
    {
      description: "this is a new description",
      gridItems: [
        {
          args_string: JSON.stringify(
            importedDashboard.gridItems[0].args_string
          ),
          h: 20,
          i: "1",
          metadata_string: JSON.stringify(
            importedDashboard.gridItems[0].metadata_string
          ),
          source: "Variable Input",
          w: 20,
          x: 0,
          y: 0,
        },
      ],
      name: "Test",
      uuid: 12345678,
    },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );
});

test("DashboardImportModal Landing Page with bad tabs", async () => {
  const importedDashboard = {
    name: "Test",
    description: "this is a new description",
    tabs: [
      {
        id: "1",
        name: "Tab 1",
        gridItems: [{}],
      },
    ],
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
          <TestingComponent />
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

  expect(
    await screen.findByText(
      "Grid Items must include i, x, y, w, h, source, args_string, metadata_string keys"
    )
  ).toBeInTheDocument();
});

test("DashboardImportModal Landing Page with tabs", async () => {
  const importedDashboard = {
    name: "Test",
    description: "this is a new description",
    tabs: [
      {
        id: "1",
        name: "Tab 1",
        gridItems: [
          {
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
            },
            metadata_string: {
              refreshRate: 0,
            },
          },
        ],
      },
    ],
  };
  const mockAddDashboard = jest.fn();
  jest.spyOn(appAPI, "addDashboard").mockImplementation(mockAddDashboard);
  mockAddDashboard.mockResolvedValue({
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
          <TestingComponent />
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

  expect(mockAddDashboard).toHaveBeenCalledWith(
    {
      description: "this is a new description",

      tabs: [
        {
          id: "1",
          name: "Tab 1",
          gridItems: [
            {
              args_string: JSON.stringify(
                importedDashboard.tabs[0].gridItems[0].args_string
              ),
              h: 20,
              i: "1",
              metadata_string: JSON.stringify(
                importedDashboard.tabs[0].gridItems[0].metadata_string
              ),
              source: "Variable Input",
              w: 20,
              x: 0,
              y: 0,
            },
          ],
        },
      ],
      uuid: 12345678,
      name: "Test",
    },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
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
    description: "this is a new description",
  };
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
          <TestingComponent />
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

  expect(
    await screen.findByText("Dashboards must include a name")
  ).toBeInTheDocument();
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
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy",
    "user-uuid"
  );
  expect(mockOnImportGridItem).toHaveBeenCalledWith({
    type: "single",
    gridItems: [importedGridItem],
    tabs: [],
  });
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

  expect(await screen.findByText("Invalid JSON in test-file.json")).toBeInTheDocument();

  const closeAlert = await screen.findByLabelText("Close alert");
  await userEvent.click(closeAlert);

  await waitFor(() => {
    expect(
      screen.queryByText("Invalid JSON in test-file.json")
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

test("DashboardImportModal Dashboard View array import", async () => {
  const gridItems = [
    {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "TestSource",
      args_string: {},
      metadata_string: { refreshRate: 0 },
    },
    {
      i: "2",
      x: 20,
      y: 0,
      w: 20,
      h: 20,
      source: "TestSource2",
      args_string: {},
      metadata_string: { refreshRate: 0 },
    },
  ];

  const mockHandleGridItemImport = jest.fn();
  jest
    .spyOn(dashboardUtils, "handleGridItemImport")
    .mockImplementation(mockHandleGridItemImport);
  mockHandleGridItemImport.mockResolvedValue({
    success: true,
    importedGridItem: gridItems[0],
  });

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

  const file = new File([JSON.stringify(gridItems)], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  await waitFor(() => {
    expect(screen.getByTestId("import-preview")).toHaveTextContent(
      "2 grid items to add to current tab"
    );
  });

  const importButton = screen.getByLabelText("Import Button");
  await waitFor(() => expect(importButton).not.toBeDisabled());
  await userEvent.click(importButton);

  expect(mockHandleGridItemImport).toHaveBeenCalledTimes(2);
  expect(mockOnImportGridItem).toHaveBeenCalledWith(
    expect.objectContaining({ type: "array" })
  );
  expect(mockSetSuccessMessage).toHaveBeenCalledWith(
    "Successfully imported 2 dashboard items"
  );
});

test("DashboardImportModal Dashboard View tab import", async () => {
  const tab = {
    name: "MyTab",
    gridItems: [
      {
        i: "1",
        x: 0,
        y: 0,
        w: 20,
        h: 20,
        source: "TestSource",
        args_string: {},
        metadata_string: { refreshRate: 0 },
      },
    ],
  };

  const processedItem = { ...tab.gridItems[0], args_string: "{}", metadata_string: '{"refreshRate":0}' };
  const mockHandleGridItemImport = jest.fn();
  jest
    .spyOn(dashboardUtils, "handleGridItemImport")
    .mockImplementation(mockHandleGridItemImport);
  mockHandleGridItemImport.mockResolvedValue({
    success: true,
    importedGridItem: processedItem,
  });

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

  const file = new File([JSON.stringify(tab)], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  await waitFor(() => {
    expect(screen.getByTestId("import-preview")).toHaveTextContent(
      "Tab: MyTab with 1 item"
    );
  });

  const importButton = screen.getByLabelText("Import Button");
  await waitFor(() => expect(importButton).not.toBeDisabled());
  await userEvent.click(importButton);

  expect(mockOnImportGridItem).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "tab",
      tabs: expect.arrayContaining([
        expect.objectContaining({ name: "MyTab" }),
      ]),
    })
  );
  expect(mockSetSuccessMessage).toHaveBeenCalledWith(
    "Successfully imported 1 tab"
  );
});

test("DashboardImportModal Dashboard View dashboard import with tab checkboxes", async () => {
  const dashboard = {
    tabs: [
      {
        name: "Tab A",
        gridItems: [
          {
            i: "1",
            x: 0,
            y: 0,
            w: 20,
            h: 20,
            source: "TestSource",
            args_string: {},
            metadata_string: { refreshRate: 0 },
          },
        ],
      },
      {
        name: "Tab B",
        gridItems: [
          {
            i: "1",
            x: 0,
            y: 0,
            w: 20,
            h: 20,
            source: "TestSource2",
            args_string: {},
            metadata_string: { refreshRate: 0 },
          },
        ],
      },
    ],
  };

  const mockHandleGridItemImport = jest.fn();
  jest
    .spyOn(dashboardUtils, "handleGridItemImport")
    .mockImplementation(mockHandleGridItemImport);
  mockHandleGridItemImport.mockResolvedValue({
    success: true,
    importedGridItem: dashboard.tabs[0].gridItems[0],
  });

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

  const file = new File([JSON.stringify(dashboard)], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  await waitFor(() => {
    expect(screen.getByTestId("tab-checkbox-0")).toBeInTheDocument();
  });
  expect(screen.getByTestId("tab-checkbox-1")).toBeInTheDocument();

  // Both checkboxes should be checked by default
  expect(screen.getByTestId("tab-checkbox-0")).toBeChecked();
  expect(screen.getByTestId("tab-checkbox-1")).toBeChecked();

  // Uncheck Tab B
  await userEvent.click(screen.getByTestId("tab-checkbox-1"));
  expect(screen.getByTestId("tab-checkbox-1")).not.toBeChecked();

  const importButton = screen.getByLabelText("Import Button");
  await userEvent.click(importButton);

  // Only 1 grid item should be processed (from Tab A only)
  expect(mockHandleGridItemImport).toHaveBeenCalledTimes(1);
  expect(mockOnImportGridItem).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "dashboard",
      tabs: expect.arrayContaining([
        expect.objectContaining({ name: "Tab A" }),
      ]),
    })
  );
  // Tab B should not be in the imported tabs
  const callArgs = mockOnImportGridItem.mock.calls[0][0];
  expect(callArgs.tabs).toHaveLength(1);
  expect(callArgs.tabs[0].name).toBe("Tab A");
});

test("DashboardImportModal Dashboard View batch validation error", async () => {
  const gridItems = [
    {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "TestSource",
      args_string: {},
      metadata_string: { refreshRate: 0 },
    },
    {
      // Missing required keys
      i: "2",
      x: 0,
    },
  ];

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

  const file = new File([JSON.stringify(gridItems)], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  const importButton = screen.getByLabelText("Import Button");
  await waitFor(() => expect(importButton).not.toBeDisabled());
  await userEvent.click(importButton);

  await waitFor(() => {
    expect(screen.getByText(/Item 2: missing/)).toBeInTheDocument();
  });
  expect(mockOnImportGridItem).not.toHaveBeenCalled();
});

test("DashboardImportModal unrecognized format shows error", async () => {
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

  const file = new File([JSON.stringify({ foo: "bar" })], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  await waitFor(() => {
    expect(screen.getByText("Unrecognized JSON format in one or more files")).toBeInTheDocument();
  });

  // Import button should still be disabled
  expect(screen.getByLabelText("Import Button")).toBeDisabled();
});

test("DashboardImportModal Landing Page still calls importDashboard unchanged", async () => {
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

  // No preview should appear for landing page mode
  const file = new File([JSON.stringify(importedDashboard)], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  const importButton = screen.getByLabelText("Import Button");
  await waitFor(() => expect(importButton).not.toBeDisabled());

  // No preview in landing page mode
  expect(screen.queryByTestId("import-preview")).not.toBeInTheDocument();

  await userEvent.click(importButton);

  expect(mockImportDashboard).toHaveBeenCalledWith(importedDashboard);
});

test("DashboardImportModal Dashboard View handleGridItemImport failure", async () => {
  const gridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "TestSource",
    args_string: {},
    metadata_string: { refreshRate: 0 },
  };

  const mockHandleGridItemImport = jest.fn();
  jest
    .spyOn(dashboardUtils, "handleGridItemImport")
    .mockImplementation(mockHandleGridItemImport);
  mockHandleGridItemImport.mockResolvedValue({
    success: false,
    message: "GeoJSON upload failed",
  });

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

  const file = new File([JSON.stringify(gridItem)], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  const importButton = screen.getByLabelText("Import Button");
  await waitFor(() => expect(importButton).not.toBeDisabled());
  await userEvent.click(importButton);

  expect(
    await screen.findByText("GeoJSON upload failed")
  ).toBeInTheDocument();
  expect(mockOnImportGridItem).not.toHaveBeenCalled();
});

test("DashboardImportModal Dashboard View handleGridItemImport failure no message", async () => {
  const gridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "TestSource",
    args_string: {},
    metadata_string: { refreshRate: 0 },
  };

  const mockHandleGridItemImport = jest.fn();
  jest
    .spyOn(dashboardUtils, "handleGridItemImport")
    .mockImplementation(mockHandleGridItemImport);
  mockHandleGridItemImport.mockResolvedValue({
    success: false,
  });

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

  const file = new File([JSON.stringify(gridItem)], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  const importButton = screen.getByLabelText("Import Button");
  await waitFor(() => expect(importButton).not.toBeDisabled());
  await userEvent.click(importButton);

  expect(
    await screen.findByText("Failed to import grid item")
  ).toBeInTheDocument();
  expect(mockOnImportGridItem).not.toHaveBeenCalled();
});

test("DashboardImportModal Landing Page bad json", async () => {
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
          <TestingComponent />
        </LayoutSuccessAlertContext.Provider>
      ),
    })
  );

  expect(await screen.findByText("Import Dashboard")).toBeInTheDocument();

  const file = new File(["not valid json"], "bad.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  expect(
    await screen.findByText("Invalid JSON structure")
  ).toBeInTheDocument();
});

test("DashboardImportModal mixed import with items and tabs", async () => {
  const gridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "TestSource",
    args_string: {},
    metadata_string: { refreshRate: 0 },
  };

  const tab = {
    name: "MyTab",
    gridItems: [
      {
        i: "1",
        x: 0,
        y: 0,
        w: 20,
        h: 20,
        source: "TabSource",
        args_string: {},
        metadata_string: { refreshRate: 0 },
      },
    ],
  };

  const mockHandleGridItemImport = jest.fn();
  jest
    .spyOn(dashboardUtils, "handleGridItemImport")
    .mockImplementation(mockHandleGridItemImport);
  mockHandleGridItemImport.mockResolvedValue({
    success: true,
    importedGridItem: gridItem,
  });

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

  const itemFile = new File([JSON.stringify(gridItem)], "item.json", {
    type: "text/plain",
  });
  const tabFile = new File([JSON.stringify(tab)], "tab.json", {
    type: "text/plain",
  });

  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [itemFile, tabFile] } });

  await waitFor(() => {
    expect(screen.getByTestId("import-preview")).toHaveTextContent(
      /1 grid item.*to active tab.*1 tab/
    );
  });

  // Tab checkbox should appear
  expect(screen.getByTestId("tab-checkbox-0")).toBeChecked();

  const importButton = screen.getByLabelText("Import Button");
  await waitFor(() => expect(importButton).not.toBeDisabled());
  await userEvent.click(importButton);

  expect(mockHandleGridItemImport).toHaveBeenCalledTimes(2);
  expect(mockOnImportGridItem).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "mixed",
      gridItems: expect.arrayContaining([expect.objectContaining({})]),
      tabs: expect.arrayContaining([
        expect.objectContaining({ name: "MyTab" }),
      ]),
    })
  );
  expect(mockSetSuccessMessage).toHaveBeenCalledWith(
    "Successfully imported 1 item to active tab and 1 tab"
  );
});

test("DashboardImportModal dashboard with all tabs unchecked disables import", async () => {
  const dashboard = {
    tabs: [
      {
        name: "Tab A",
        gridItems: [
          {
            i: "1",
            x: 0,
            y: 0,
            w: 20,
            h: 20,
            source: "TestSource",
            args_string: {},
            metadata_string: { refreshRate: 0 },
          },
        ],
      },
      {
        name: "Tab B",
        gridItems: [],
      },
    ],
  };

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

  const file = new File([JSON.stringify(dashboard)], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  await waitFor(() => {
    expect(screen.getByTestId("tab-checkbox-0")).toBeChecked();
  });
  expect(screen.getByTestId("tab-checkbox-1")).toBeChecked();

  // Uncheck both tabs
  await userEvent.click(screen.getByTestId("tab-checkbox-0"));
  await userEvent.click(screen.getByTestId("tab-checkbox-1"));
  expect(screen.getByTestId("tab-checkbox-0")).not.toBeChecked();
  expect(screen.getByTestId("tab-checkbox-1")).not.toBeChecked();

  // Import button should be disabled
  expect(screen.getByLabelText("Import Button")).toBeDisabled();
});

test("DashboardImportModal empty file list does nothing", async () => {
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

  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [] } });

  // No preview, no error, import still disabled
  expect(screen.queryByTestId("import-preview")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Import Button")).toBeDisabled();
});

test("DashboardImportModal mixed import plural items and tabs with unnamed tab", async () => {
  const gridItems = [
    {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "TestSource",
      args_string: {},
      metadata_string: { refreshRate: 0 },
    },
    {
      i: "2",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "TestSource2",
      args_string: {},
      metadata_string: { refreshRate: 0 },
    },
  ];

  const dashboard = {
    tabs: [
      {
        name: "Tab A",
        gridItems: [
          {
            i: "1",
            x: 0,
            y: 0,
            w: 20,
            h: 20,
            source: "TabSource",
            args_string: {},
            metadata_string: { refreshRate: 0 },
          },
        ],
      },
      {
        name: "",
        gridItems: [],
      },
    ],
  };

  const mockHandleGridItemImport = jest.fn();
  jest
    .spyOn(dashboardUtils, "handleGridItemImport")
    .mockImplementation(mockHandleGridItemImport);
  mockHandleGridItemImport.mockResolvedValue({
    success: true,
    importedGridItem: gridItems[0],
  });

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

  const itemFile = new File([JSON.stringify(gridItems)], "items.json", {
    type: "text/plain",
  });
  const dashFile = new File([JSON.stringify(dashboard)], "dash.json", {
    type: "text/plain",
  });

  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [itemFile, dashFile] } });

  await waitFor(() => {
    expect(screen.getByTestId("import-preview")).toHaveTextContent(
      /2 grid items.*to active tab.*2 tabs/
    );
  });

  // Verify unnamed tab and missing gridItems show in checkbox labels
  expect(screen.getByTestId("tab-checkbox-0")).toBeInTheDocument();
  expect(screen.getByTestId("tab-checkbox-1")).toBeInTheDocument();
  expect(screen.getByText("Unnamed tab (0 items)")).toBeInTheDocument();

  const importButton = screen.getByLabelText("Import Button");
  await waitFor(() => expect(importButton).not.toBeDisabled());
  await userEvent.click(importButton);

  expect(mockOnImportGridItem).toHaveBeenCalledWith(
    expect.objectContaining({ type: "mixed" })
  );
  expect(mockSetSuccessMessage).toHaveBeenCalledWith(
    "Successfully imported 2 items to active tab and 2 tabs"
  );
});

test("DashboardImportModal multiple tab files merge as dashboard", async () => {
  const tab1 = {
    name: "Tab One",
    gridItems: [
      {
        i: "1",
        x: 0,
        y: 0,
        w: 20,
        h: 20,
        source: "TestSource",
        args_string: {},
        metadata_string: { refreshRate: 0 },
      },
    ],
  };
  const tab2 = {
    name: "Tab Two",
    gridItems: [
      {
        i: "1",
        x: 0,
        y: 0,
        w: 20,
        h: 20,
        source: "TestSource2",
        args_string: {},
        metadata_string: { refreshRate: 0 },
      },
    ],
  };

  const mockHandleGridItemImport = jest.fn();
  jest
    .spyOn(dashboardUtils, "handleGridItemImport")
    .mockImplementation(mockHandleGridItemImport);
  mockHandleGridItemImport.mockResolvedValue({
    success: true,
    importedGridItem: tab1.gridItems[0],
  });

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

  const file1 = new File([JSON.stringify(tab1)], "tab1.json", {
    type: "text/plain",
  });
  const file2 = new File([JSON.stringify(tab2)], "tab2.json", {
    type: "text/plain",
  });

  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file1, file2] } });

  await waitFor(() => {
    expect(screen.getByTestId("import-preview")).toHaveTextContent(
      "2 tabs: Tab One (1 items), Tab Two (1 items)"
    );
  });

  // Should have tab checkboxes since it merged to dashboard type
  expect(screen.getByTestId("tab-checkbox-0")).toBeChecked();
  expect(screen.getByTestId("tab-checkbox-1")).toBeChecked();
});

test("DashboardImportModal re-check a previously unchecked tab", async () => {
  const dashboard = {
    tabs: [
      {
        name: "Tab A",
        gridItems: [
          {
            i: "1",
            x: 0,
            y: 0,
            w: 20,
            h: 20,
            source: "TestSource",
            args_string: {},
            metadata_string: { refreshRate: 0 },
          },
        ],
      },
      {
        name: "Tab B",
        gridItems: [],
      },
    ],
  };

  const mockHandleGridItemImport = jest.fn();
  jest
    .spyOn(dashboardUtils, "handleGridItemImport")
    .mockImplementation(mockHandleGridItemImport);
  mockHandleGridItemImport.mockResolvedValue({
    success: true,
    importedGridItem: dashboard.tabs[0].gridItems[0],
  });

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

  const file = new File([JSON.stringify(dashboard)], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  await waitFor(() => {
    expect(screen.getByTestId("tab-checkbox-0")).toBeChecked();
  });

  // Uncheck Tab A
  await userEvent.click(screen.getByTestId("tab-checkbox-0"));
  expect(screen.getByTestId("tab-checkbox-0")).not.toBeChecked();

  // Re-check Tab A (covers the [...prev, index] branch)
  await userEvent.click(screen.getByTestId("tab-checkbox-0"));
  expect(screen.getByTestId("tab-checkbox-0")).toBeChecked();

  // Import should work with both tabs selected
  const importButton = screen.getByLabelText("Import Button");
  expect(importButton).not.toBeDisabled();
  await userEvent.click(importButton);

  const callArgs = mockOnImportGridItem.mock.calls[0][0];
  expect(callArgs.tabs).toHaveLength(2);
});

test("DashboardImportModal tabs-only from two files with one tab uses dashboard summary", async () => {
  const tab = {
    name: "Solo Tab",
    gridItems: [
      {
        i: "1",
        x: 0,
        y: 0,
        w: 20,
        h: 20,
        source: "TestSource",
        args_string: {},
        metadata_string: { refreshRate: 0 },
      },
    ],
  };
  const emptyDashboard = { tabs: [] };

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

  const tabFile = new File([JSON.stringify(tab)], "tab.json", {
    type: "text/plain",
  });
  const emptyFile = new File([JSON.stringify(emptyDashboard)], "empty.json", {
    type: "text/plain",
  });

  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [tabFile, emptyFile] } });

  // allTabs.length === 1, parsedFiles.length === 2 → hits line 235 with singular "1 tab"
  await waitFor(() => {
    expect(screen.getByTestId("import-preview")).toHaveTextContent(
      "1 tab: Solo Tab (1 items)"
    );
  });
});

test("DashboardImportModal two files with one tab total uses singular summary", async () => {
  const tab = {
    name: "Only Tab",
    gridItems: [
      {
        i: "1",
        x: 0,
        y: 0,
        w: 20,
        h: 20,
        source: "TestSource",
        args_string: {},
        metadata_string: { refreshRate: 0 },
      },
    ],
  };
  const gridItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "TestSource2",
    args_string: {},
    metadata_string: { refreshRate: 0 },
  };

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

  const tabFile = new File([JSON.stringify(tab)], "tab.json", {
    type: "text/plain",
  });
  const itemFile = new File([JSON.stringify(gridItem)], "item.json", {
    type: "text/plain",
  });

  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [tabFile, itemFile] } });

  await waitFor(() => {
    expect(screen.getByTestId("import-preview")).toHaveTextContent(
      /1 grid item.*to active tab.*1 tab.*Only Tab/
    );
  });
});

TestingComponent.propTypes = {
  onImportGridItem: PropTypes.func,
};
