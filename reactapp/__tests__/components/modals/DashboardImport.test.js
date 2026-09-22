import PropTypes from "prop-types";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DashboardImportModal from "components/modals/DashboardImport";
import createLoadedComponent from "__tests__/utilities/customRender";
import {
  AppContext,
  AvailableDashboardsContext,
} from "components/contexts/Contexts";
import { LayoutSuccessAlertContext } from "components/contexts/LayoutAlertContext";
import * as dashboardUtils from "components/dashboard/DashboardItem";
import * as importIdentity from "components/dashboard/importIdentity";
import { discoverGroupSeeds } from "components/map/viewGroup";
import appAPI from "services/api/app";

// Captured before any test installs a spy, so a test that wants the real
// behaviour can ask for it explicitly. `resetMocks` clears implementations
// between tests but leaves the spied property in place, so "no spy" and
// "the real function" are not the same thing once any test has spied.
const realHandleGridItemImport = dashboardUtils.handleGridItemImport;
const realApplyBatchIdentityRules = importIdentity.applyBatchIdentityRules;

// A built-in Map grid item claiming to supply its view group's opening view.
// The `Map` source is load-bearing, not decoration: only the built-in map
// carries a stored extent that can seed a group (R19).
const flaggedMapGridItem = ({ i = "1", group, extent = "-100,30,-90,40" }) => ({
  i,
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  source: "Map",
  args_string: {
    map_extent: { extent, viewGroup: group, isGroupInitialExtent: true },
  },
  metadata_string: { refreshRate: 0 },
});

// Stand in for the per-item pass, returning what the real one returns: a grid
// item whose `args_string` is back to a JSON string. The batch pass reads the
// stored representation, so a stub handing back a parsed object would make
// every flag invisible to it and every assertion below vacuous.
const stubPerItemImport = () => {
  const mock = jest.fn(async (gridItem) => ({
    success: true,
    importedGridItem: {
      ...gridItem,
      args_string: JSON.stringify(gridItem.args_string),
      metadata_string: JSON.stringify(gridItem.metadata_string),
    },
  }));
  jest.spyOn(dashboardUtils, "handleGridItemImport").mockImplementation(mock);
  return mock;
};

const readInitialExtentFlag = (gridItem) =>
  Boolean(JSON.parse(gridItem.args_string).map_extent.isGroupInitialExtent);

const TestingComponent = ({ onImportGridItem, targetGroupNames }) => {
  const [showModal, setShowModal] = useState(true);

  return (
    <DashboardImportModal
      showModal={showModal}
      setShowModal={setShowModal}
      onImportGridItem={onImportGridItem}
      targetGroupNames={targetGroupNames}
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
    }),
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
    `Successfully imported the dashboard as ${importedDashboard.name}`,
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
    }),
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
      "Grid Items must include i, x, y, w, h, source, args_string, metadata_string keys",
    ),
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
    }),
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
            importedDashboard.gridItems[0].args_string,
          ),
          h: 20,
          i: "1",
          metadata_string: JSON.stringify(
            importedDashboard.gridItems[0].metadata_string,
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
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy",
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
    }),
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
      "Grid Items must include i, x, y, w, h, source, args_string, metadata_string keys",
    ),
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
    }),
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
                importedDashboard.tabs[0].gridItems[0].args_string,
              ),
              h: 20,
              i: "1",
              metadata_string: JSON.stringify(
                importedDashboard.tabs[0].gridItems[0].metadata_string,
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
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy",
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
    }),
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
    await screen.findByText("Failed to import the dashboard"),
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
    }),
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
    await screen.findByText("Dashboards must include a name"),
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
    }),
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
    "user-uuid",
  );
  expect(mockOnImportGridItem).toHaveBeenCalledWith({
    type: "single",
    gridItems: [importedGridItem],
    tabs: [],
  });
  expect(mockSetShowSuccessMessage).toHaveBeenCalledWith(true);
  expect(mockSetSuccessMessage).toHaveBeenCalledWith(
    "Successfully imported dashboard item",
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
    }),
  );

  expect(await screen.findByText("Import Dashboard Item")).toBeInTheDocument();

  const file = new File(["{'dd':}"], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  expect(
    await screen.findByText("Invalid JSON in test-file.json"),
  ).toBeInTheDocument();

  const closeAlert = await screen.findByLabelText("Close alert");
  await userEvent.click(closeAlert);

  await waitFor(() => {
    expect(
      screen.queryByText("Invalid JSON in test-file.json"),
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
    }),
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
    }),
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
    }),
  );

  expect(await screen.findByText("Import Dashboard Item")).toBeInTheDocument();

  const file = new File([JSON.stringify(gridItems)], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  await waitFor(() => {
    expect(screen.getByTestId("import-preview")).toHaveTextContent(
      "2 grid items to add to current tab",
    );
  });

  const importButton = screen.getByLabelText("Import Button");
  await waitFor(() => expect(importButton).not.toBeDisabled());
  await userEvent.click(importButton);

  expect(mockHandleGridItemImport).toHaveBeenCalledTimes(2);
  expect(mockOnImportGridItem).toHaveBeenCalledWith(
    expect.objectContaining({ type: "array" }),
  );
  expect(mockSetSuccessMessage).toHaveBeenCalledWith(
    "Successfully imported 2 dashboard items",
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

  const processedItem = {
    ...tab.gridItems[0],
    args_string: "{}",
    metadata_string: '{"refreshRate":0}',
  };
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
    }),
  );

  expect(await screen.findByText("Import Dashboard Item")).toBeInTheDocument();

  const file = new File([JSON.stringify(tab)], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  await waitFor(() => {
    expect(screen.getByTestId("import-preview")).toHaveTextContent(
      "Tab: MyTab with 1 item",
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
    }),
  );
  expect(mockSetSuccessMessage).toHaveBeenCalledWith(
    "Successfully imported 1 tab",
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
    }),
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
    }),
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
    }),
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
    }),
  );

  expect(await screen.findByText("Import Dashboard Item")).toBeInTheDocument();

  const file = new File([JSON.stringify({ foo: "bar" })], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  await waitFor(() => {
    expect(
      screen.getByText("Unrecognized JSON format in one or more files"),
    ).toBeInTheDocument();
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
    }),
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
    }),
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

  expect(await screen.findByText("GeoJSON upload failed")).toBeInTheDocument();
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
    }),
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
    await screen.findByText("Failed to import grid item"),
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
    }),
  );

  expect(await screen.findByText("Import Dashboard")).toBeInTheDocument();

  const file = new File(["not valid json"], "bad.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  expect(await screen.findByText("Invalid JSON structure")).toBeInTheDocument();
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
    }),
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
      /1 grid item.*to active tab.*1 tab/,
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
    }),
  );
  expect(mockSetSuccessMessage).toHaveBeenCalledWith(
    "Successfully imported 1 item to active tab and 1 tab",
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
    }),
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
    }),
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
    }),
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
      /2 grid items.*to active tab.*2 tabs/,
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
    expect.objectContaining({ type: "mixed" }),
  );
  expect(mockSetSuccessMessage).toHaveBeenCalledWith(
    "Successfully imported 2 items to active tab and 2 tabs",
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
    }),
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
      "2 tabs: Tab One (1 items), Tab Two (1 items)",
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
    }),
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
    }),
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
      "1 tab: Solo Tab (1 items)",
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
    }),
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
      /1 grid item.*to active tab.*1 tab.*Only Tab/,
    );
  });
});

const renderDashboardModal = ({ onImportGridItem, targetGroupNames }) => {
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
          <TestingComponent
            onImportGridItem={onImportGridItem}
            targetGroupNames={targetGroupNames}
          />
        </LayoutSuccessAlertContext.Provider>
      ),
    }),
  );

  return { mockSetSuccessMessage, mockSetShowSuccessMessage };
};

const importFiles = async (files, title) => {
  expect(await screen.findByText(title)).toBeInTheDocument();
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files } });
  const importButton = screen.getByLabelText("Import Button");
  await waitFor(() => expect(importButton).not.toBeDisabled());
  await userEvent.click(importButton);
};

const jsonFile = (payload, name) =>
  new File([JSON.stringify(payload)], name, { type: "text/plain" });

test("DashboardImportModal clears a duplicate initial extent flag across tabs", async () => {
  const dashboard = {
    tabs: [
      { name: "Tab A", gridItems: [flaggedMapGridItem({ group: "Basin" })] },
      { name: "Tab B", gridItems: [flaggedMapGridItem({ group: "Basin" })] },
    ],
  };
  stubPerItemImport();
  const mockOnImportGridItem = jest.fn();

  renderDashboardModal({ onImportGridItem: mockOnImportGridItem });
  await importFiles(
    [jsonFile(dashboard, "dashboard.json")],
    "Import Dashboard Item",
  );

  const { tabs } = mockOnImportGridItem.mock.calls[0][0];
  // The batch spans both tabs, so the second flag loses to the first even
  // though nothing on either tab alone could tell.
  expect(readInitialExtentFlag(tabs[0].gridItems[0])).toBe(true);
  expect(readInitialExtentFlag(tabs[1].gridItems[0])).toBe(false);
});

test("DashboardImportModal keeps initial extent flags naming different groups", async () => {
  const dashboard = {
    tabs: [
      { name: "Tab A", gridItems: [flaggedMapGridItem({ group: "Basin" })] },
      { name: "Tab B", gridItems: [flaggedMapGridItem({ group: "Coast" })] },
    ],
  };
  stubPerItemImport();
  const mockOnImportGridItem = jest.fn();

  renderDashboardModal({ onImportGridItem: mockOnImportGridItem });
  await importFiles(
    [jsonFile(dashboard, "dashboard.json")],
    "Import Dashboard Item",
  );

  const { tabs } = mockOnImportGridItem.mock.calls[0][0];
  expect(readInitialExtentFlag(tabs[0].gridItems[0])).toBe(true);
  expect(readInitialExtentFlag(tabs[1].gridItems[0])).toBe(true);
});

test("DashboardImportModal clears an initial extent flag the target already claims", async () => {
  stubPerItemImport();
  const mockOnImportGridItem = jest.fn();

  renderDashboardModal({
    onImportGridItem: mockOnImportGridItem,
    targetGroupNames: ["Basin"],
  });
  await importFiles(
    [jsonFile(flaggedMapGridItem({ group: "Basin" }), "item.json")],
    "Import Dashboard Item",
  );

  const { gridItems } = mockOnImportGridItem.mock.calls[0][0];
  expect(readInitialExtentFlag(gridItems[0])).toBe(false);
});

test("DashboardImportModal keeps a lone initial extent flag the target does not claim", async () => {
  stubPerItemImport();
  const mockOnImportGridItem = jest.fn();

  // The regression the collision-scoped rule exists to avoid: one flagged map
  // imported into a dashboard that claims no such group must keep its flag.
  renderDashboardModal({
    onImportGridItem: mockOnImportGridItem,
    targetGroupNames: ["Coast"],
  });
  await importFiles(
    [jsonFile(flaggedMapGridItem({ group: "Basin" }), "item.json")],
    "Import Dashboard Item",
  );

  const { gridItems } = mockOnImportGridItem.mock.calls[0][0];
  expect(readInitialExtentFlag(gridItems[0])).toBe(true);
});

test("DashboardImportModal clears against a target group whose seed is null", async () => {
  // The target's flagged member points its extent at a variable input, so the
  // group seeds nothing and `discoverGroupSeeds` stores null for it. The group
  // is claimed all the same, which is why the modal is handed the seed map's
  // keys rather than the groups that produced a usable extent.
  const targetTabs = [
    {
      name: "Existing",
      gridItems: [
        {
          ...flaggedMapGridItem({ group: "Basin" }),
          args_string: JSON.stringify({
            map_extent: {
              // eslint-disable-next-line no-template-curly-in-string
              extent: "${Basin Extent}",
              viewGroup: "Basin",
              isGroupInitialExtent: true,
            },
          }),
        },
      ],
    },
  ];
  const seeds = discoverGroupSeeds(targetTabs);
  expect(seeds.get("Basin")).toBeNull();

  stubPerItemImport();
  const mockOnImportGridItem = jest.fn();

  renderDashboardModal({
    onImportGridItem: mockOnImportGridItem,
    targetGroupNames: [...seeds.keys()],
  });
  await importFiles(
    [jsonFile(flaggedMapGridItem({ group: "Basin" }), "item.json")],
    "Import Dashboard Item",
  );

  const { gridItems } = mockOnImportGridItem.mock.calls[0][0];
  expect(readInitialExtentFlag(gridItems[0])).toBe(false);
});

test("DashboardImportModal applies the batch pass once per import, not once per tab", async () => {
  const dashboard = {
    tabs: [
      {
        name: "Tab A",
        gridItems: [
          flaggedMapGridItem({ i: "1", group: "Basin" }),
          flaggedMapGridItem({ i: "2", group: "Coast" }),
        ],
      },
      {
        name: "Tab B",
        gridItems: [
          flaggedMapGridItem({ i: "1", group: "Basin" }),
          flaggedMapGridItem({ i: "2", group: "Coast" }),
        ],
      },
    ],
  };
  stubPerItemImport();
  const spyApplyBatch = jest
    .spyOn(importIdentity, "applyBatchIdentityRules")
    .mockImplementation(realApplyBatchIdentityRules);
  const mockOnImportGridItem = jest.fn();

  renderDashboardModal({ onImportGridItem: mockOnImportGridItem });
  await importFiles(
    [jsonFile(dashboard, "dashboard.json")],
    "Import Dashboard Item",
  );

  expect(spyApplyBatch).toHaveBeenCalledTimes(1);
  // One flat array holding every item from every tab -- a per-tab call would
  // see two items at a time and could never spot the cross-tab collision.
  expect(spyApplyBatch.mock.calls[0][0]).toHaveLength(4);
});

test("DashboardImportModal mixed import keeps each item with the tab it arrived in", async () => {
  const looseItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "LooseSource",
    args_string: {},
    metadata_string: { refreshRate: 0 },
  };
  const tab = {
    name: "MyTab",
    gridItems: [
      flaggedMapGridItem({ i: "1", group: "Basin" }),
      {
        i: "2",
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
  stubPerItemImport();
  const mockOnImportGridItem = jest.fn();

  renderDashboardModal({ onImportGridItem: mockOnImportGridItem });
  await importFiles(
    [jsonFile(looseItem, "item.json"), jsonFile(tab, "tab.json")],
    "Import Dashboard Item",
  );

  const result = mockOnImportGridItem.mock.calls[0][0];
  // The batch transform is positional, and the slicing that rebuilds the tabs
  // trusts that: a reorder or a drop would silently move items between tabs.
  expect(result.gridItems.map((item) => item.source)).toEqual(["LooseSource"]);
  expect(result.tabs).toHaveLength(1);
  expect(result.tabs[0].gridItems.map((item) => item.source)).toEqual([
    "Map",
    "TabSource",
  ]);
  expect(readInitialExtentFlag(result.tabs[0].gridItems[0])).toBe(true);
});

test("a tab whose gridItems is not an array cannot steal a sibling tab's items", async () => {
  // flatMap only spreads a real array, so a non-array `gridItems` contributes
  // nothing to the flatten. Reading `.length` off the raw value at re-split
  // time would then slice a sibling tab's items onto this one.
  const realItem = {
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "Text",
    args_string: "{}",
    metadata_string: JSON.stringify({ refreshRate: 0 }),
  };
  jest
    .spyOn(dashboardUtils, "handleGridItemImport")
    .mockImplementation(realHandleGridItemImport);

  const mockOnImportGridItem = jest.fn();
  renderDashboardModal({ onImportGridItem: mockOnImportGridItem });
  await importFiles(
    [
      jsonFile(
        {
          name: "Sneaky",
          tabs: [
            // Not an array, but it carries a length.
            { name: "Tab A", gridItems: { ...realItem, length: 1 } },
            { name: "Tab B", gridItems: [realItem] },
          ],
        },
        "dashboard.json",
      ),
    ],
    "Import Dashboard Item",
  );

  const [payload] = mockOnImportGridItem.mock.calls[0];
  const byName = Object.fromEntries(
    payload.tabs.map((tab) => [tab.name, tab.gridItems.length]),
  );
  expect(byName).toEqual({ "Tab A": 0, "Tab B": 1 });
});

test("DashboardImportModal falls back when the thrown value carries no message", async () => {
  // A rejection that is not an Error still has to produce something readable
  // rather than "Import failed: undefined".
  jest
    .spyOn(dashboardUtils, "handleGridItemImport")
    .mockRejectedValue("not an Error");

  renderDashboardModal({ onImportGridItem: jest.fn() });
  await importFiles(
    [
      jsonFile(
        {
          i: "1",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "Text",
          args_string: "{}",
          metadata_string: JSON.stringify({ refreshRate: 0 }),
        },
        "item.json",
      ),
    ],
    "Import Dashboard Item",
  );

  expect(
    await screen.findByText(/Import failed: unexpected error/),
  ).toBeInTheDocument();
});

test("whole-dashboard import falls back when the thrown value carries no message", async () => {
  jest
    .spyOn(dashboardUtils, "handleGridItemImport")
    .mockRejectedValue("not an Error");
  jest.spyOn(appAPI, "addDashboard").mockImplementation(jest.fn());

  renderDashboardModal({});
  await importFiles(
    [
      jsonFile(
        {
          name: "Thrower",
          gridItems: [
            {
              i: "1",
              x: 0,
              y: 0,
              w: 20,
              h: 20,
              source: "Text",
              args_string: {},
              metadata_string: { refreshRate: 0 },
            },
          ],
        },
        "dashboard.json",
      ),
    ],
    "Import Dashboard",
  );

  expect(
    await screen.findByText(/Import failed: unexpected error/),
  ).toBeInTheDocument();
});

test("whole-dashboard import reports a thrown failure rather than rejecting", async () => {
  // importDashboard is awaited from a click handler with no catch of its own,
  // so it has to convert a throw into a returned failure.
  jest
    .spyOn(dashboardUtils, "handleGridItemImport")
    .mockRejectedValue(new Error("upload exploded"));
  const mockAddDashboard = jest.fn();
  jest.spyOn(appAPI, "addDashboard").mockImplementation(mockAddDashboard);

  renderDashboardModal({});
  await importFiles(
    [
      jsonFile(
        {
          name: "Thrower",
          gridItems: [
            {
              i: "1",
              x: 0,
              y: 0,
              w: 20,
              h: 20,
              source: "Text",
              args_string: {},
              metadata_string: { refreshRate: 0 },
            },
          ],
        },
        "dashboard.json",
      ),
    ],
    "Import Dashboard",
  );

  expect(
    await screen.findByText(/Import failed: upload exploded/),
  ).toBeInTheDocument();
  expect(mockAddDashboard).not.toHaveBeenCalled();
});

test("DashboardImportModal surfaces a thrown import failure instead of stalling", async () => {
  // Without the guard this rejection reaches the onClick handler unhandled:
  // no error, no success, the modal just sits there with the button live.
  jest
    .spyOn(dashboardUtils, "handleGridItemImport")
    .mockRejectedValue(new Error("boom"));

  const mockOnImportGridItem = jest.fn();
  renderDashboardModal({ onImportGridItem: mockOnImportGridItem });
  await importFiles(
    [
      jsonFile(
        {
          i: "1",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "Text",
          args_string: "{}",
          metadata_string: JSON.stringify({ refreshRate: 0 }),
        },
        "item.json",
      ),
    ],
    "Import Dashboard Item",
  );

  expect(await screen.findByText(/Import failed: boom/)).toBeInTheDocument();
  expect(mockOnImportGridItem).not.toHaveBeenCalled();
});

test("DashboardImportModal whole dashboard import enforces one flag and keeps tab membership", async () => {
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
        source: "LooseSource",
        args_string: {},
        metadata_string: { refreshRate: 0 },
      },
    ],
    tabs: [
      {
        id: "1",
        name: "Tab 1",
        gridItems: [flaggedMapGridItem({ group: "Basin" })],
      },
      {
        id: "2",
        name: "Tab 2",
        gridItems: [flaggedMapGridItem({ group: "Basin" })],
      },
    ],
  };
  jest
    .spyOn(dashboardUtils, "handleGridItemImport")
    .mockImplementation(realHandleGridItemImport);
  const mockAddDashboard = jest.fn();
  jest.spyOn(appAPI, "addDashboard").mockImplementation(mockAddDashboard);
  mockAddDashboard.mockResolvedValue({
    success: true,
    new_dashboard: importedDashboard,
  });

  renderDashboardModal({});
  await importFiles(
    [jsonFile(importedDashboard, "dashboard.json")],
    "Import Dashboard",
  );

  const [payload] = mockAddDashboard.mock.calls[0];
  // Flattened loose-items-then-tabs and re-split by the lengths each tab
  // arrived with, so nothing crosses a tab boundary.
  expect(payload.gridItems.map((item) => item.source)).toEqual(["LooseSource"]);
  expect(payload.tabs).toHaveLength(2);
  expect(payload.tabs[0].name).toBe("Tab 1");
  expect(payload.tabs[0].gridItems).toHaveLength(1);
  expect(payload.tabs[1].name).toBe("Tab 2");
  expect(payload.tabs[1].gridItems).toHaveLength(1);
  expect(readInitialExtentFlag(payload.tabs[0].gridItems[0])).toBe(true);
  expect(readInitialExtentFlag(payload.tabs[1].gridItems[0])).toBe(false);
});

test("DashboardImportModal landing page mount renders with no TabContext provider", async () => {
  // The regression guard for the hazard this prop exists to avoid: the modal
  // is mounted on the landing page outside any TabContext provider, so reading
  // that context here would throw at render and blank the page. Every other
  // case in this file renders inside DashboardLoader, which supplies one.
  render(
    <AppContext.Provider value={{ csrf: "test-csrf" }}>
      <LayoutSuccessAlertContext.Provider
        value={{
          setSuccessMessage: jest.fn(),
          setShowSuccessMessage: jest.fn(),
        }}
      >
        <AvailableDashboardsContext.Provider
          value={{ importDashboard: jest.fn() }}
        >
          <DashboardImportModal showModal={true} setShowModal={jest.fn()} />
        </AvailableDashboardsContext.Provider>
      </LayoutSuccessAlertContext.Provider>
    </AppContext.Provider>,
  );

  expect(await screen.findByText("Import Dashboard")).toBeInTheDocument();
});

TestingComponent.propTypes = {
  onImportGridItem: PropTypes.func,
  targetGroupNames: PropTypes.arrayOf(PropTypes.string),
};
